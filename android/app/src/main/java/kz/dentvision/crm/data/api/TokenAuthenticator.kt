package kz.dentvision.crm.data.api

import kotlinx.serialization.json.Json
import kz.dentvision.crm.data.model.RefreshRequest
import kz.dentvision.crm.data.model.RefreshResponse
import kz.dentvision.crm.data.session.SessionStore
import okhttp3.Authenticator
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route
import java.util.concurrent.TimeUnit

/**
 * Обновление токена на 401 — ровно одна попытка, как в вебе.
 *
 * OkHttp сам повторяет запрос с тем, что вернёт `authenticate()`; `null`
 * означает «сдаюсь». Проверка `responseCount` даёт тот самый единственный
 * повтор: если и после обновления пришёл 401, второй раз мы не пробуем, а
 * гасим сессию — иначе получится бесконечный круг.
 *
 * Запрос на обновление идёт отдельным клиентом без этого авторизатора: иначе
 * 401 от самого `/api/auth/refresh` снова позвал бы обновление.
 */
class TokenAuthenticator(
    private val baseUrl: String,
    private val session: SessionStore,
    private val onSessionLost: () -> Unit,
) : Authenticator {

    private val json = Json { ignoreUnknownKeys = true }
    private val refreshLock = Any()
    // Match the primary API client's cold-start tolerance; refresh must not
    // expire faster than the request that triggered it on Render's free tier.
    private val bareClient = OkHttpClient.Builder()
        .connectTimeout(60, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .callTimeout(90, TimeUnit.SECONDS)
        .build()
    private val jsonType = "application/json; charset=utf-8".toMediaType()

    override fun authenticate(route: Route?, response: Response): Request? = synchronized(refreshLock) {
        val sentToken = response.request.header("Authorization")
            ?.removePrefix("Bearer ")
            ?.takeIf { it.isNotBlank() }
        val currentAccessToken = session.accessToken
        val responseCount = responseCount(response)

        // Another call may have rotated the session while this 401 was waiting
        // for the lock. Reuse the newer token instead of replaying the same
        // one-time refresh token and accidentally clearing a healthy session.
        if (currentAccessToken != null && currentAccessToken != sentToken && responseCount <= 2) {
            return@synchronized response.request.newBuilder()
                .header("Authorization", "Bearer $currentAccessToken")
                .build()
        }

        if (responseCount > 1) {
            session.clear()
            onSessionLost()
            return@synchronized null
        }
        val refresh = session.refreshToken ?: return@synchronized null

        val body = json.encodeToString(RefreshRequest.serializer(), RefreshRequest(refresh))
            .toRequestBody(jsonType)
        val request = Request.Builder()
            .url("$baseUrl/api/auth/refresh")
            .post(body)
            .header("Content-Type", "application/json")
            .build()

        val refreshed = runCatching {
            bareClient.newCall(request).execute().use { res ->
                if (!res.isSuccessful) return@use null
                val text = res.body?.string() ?: return@use null
                // `/api/auth/refresh` responds with `{ ok, data }`; tolerate
                // the bare DTO response too, for parity with the web client.
                val envelope = runCatching {
                    json.decodeFromString(ApiEnvelope.serializer(RefreshResponse.serializer()), text)
                }.getOrNull()
                envelope?.data
                    ?: runCatching { json.decodeFromString(RefreshResponse.serializer(), text) }.getOrNull()
            }
        }.getOrNull()

        if (refreshed == null) {
            session.clear()
            onSessionLost()
            return@synchronized null
        }

        session.updateTokens(refreshed.accessToken, refreshed.refreshToken)
        response.request.newBuilder()
            .header("Authorization", "Bearer ${refreshed.accessToken}")
            .build()
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count += 1
            prior = prior.priorResponse
        }
        return count
    }
}
