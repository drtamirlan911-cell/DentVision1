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
    private val bareClient = OkHttpClient.Builder().build()
    private val jsonType = "application/json; charset=utf-8".toMediaType()

    override fun authenticate(route: Route?, response: Response): Request? {
        if (responseCount(response) > 1) {
            session.clear()
            onSessionLost()
            return null
        }
        val refresh = session.refreshToken ?: return null

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
                // `/api/auth/refresh` отвечает конвертом `{ ok, data }`; веб
                // принимает и голое тело (`raw.data || raw`) — здесь так же.
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
            return null
        }

        session.updateTokens(refreshed.accessToken, refreshed.refreshToken)
        return response.request.newBuilder()
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
