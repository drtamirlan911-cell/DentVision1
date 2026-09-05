package kz.dentvision.crm.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.api.ApiEnvelope
import kz.dentvision.crm.data.api.ApiException
import kz.dentvision.crm.data.api.apiCall
import kz.dentvision.crm.data.model.GuestConvertRequest
import kz.dentvision.crm.data.model.GuestSessionRequest
import kz.dentvision.crm.data.session.GuestIdentity
import kz.dentvision.crm.data.session.GuestSessionStore
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.data.session.SessionStore
import retrofit2.HttpException
import java.io.IOException
import java.net.SocketTimeoutException
import java.util.Base64

/**
 * Гостевая сессия — `POST /api/guest/session` (плоский ответ, не через
 * `apiCall`) и `POST /api/guest/convert` (обычный конверт). Перенос
 * `initGuest()`/`convertGuest()` из `src/store/guest.store.ts`: та же
 * гостевая личность переиспользуется, пока её JWT не истёк.
 */
class GuestRepository(
    private val api: ApiClient = ServiceLocator.api,
    private val guestStore: GuestSessionStore = ServiceLocator.guest,
    private val sessionStore: SessionStore = ServiceLocator.session,
) {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun ensureSession(): GuestIdentity {
        val current = guestStore.identity.value
        if (current != null && !isJwtExpired(current.guestToken)) return current

        val response = withContext(Dispatchers.IO) {
            try {
                api.guest.session(GuestSessionRequest(guestId = current?.guestId))
            } catch (e: HttpException) {
                throw e.toGuestApiException()
            } catch (e: SocketTimeoutException) {
                throw ApiException(
                    status = 0,
                    message = "Сервер не ответил вовремя. Если им давно не пользовались, ему нужно до минуты, чтобы проснуться — повторите попытку.",
                )
            } catch (e: IOException) {
                throw ApiException(status = 0, message = "Нет связи с сервером. Проверьте подключение.")
            }
        }
        val identity = GuestIdentity(response.guestId, response.token, response.aiRequestsLeft)
        guestStore.save(identity)
        return identity
    }

    /**
     * Превращает гостя в обычный аккаунт и сразу входит под ним — то же, что
     * `convertGuest()` в `guest.store.ts` делает через `setTokens()`, только
     * здесь нужна ещё полная `Session` (права/страницы/членства), которых
     * ответ `/convert` не несёт (`{user, accessToken, refreshToken}`, без
     * `pages`/`permissions` — свежий аккаунт их и не имеет). Поэтому после
     * конвертации — тот же шаг, что уже чинили в `WorkspaceRepository.switchTo`:
     * новый токен должен лечь туда, откуда его возьмёт `AuthInterceptor`,
     * ДО вызова `/me`. Настоящей сессии в `SessionStore` ещё нет (гость), так
     * что временно используем сам гостевой слот как переносчик нового
     * accessToken — `AuthInterceptor` уже умеет брать его оттуда.
     */
    suspend fun convertToAccount(login: String, password: String, name: String): Session {
        val guestId = guestStore.identity.value?.guestId
            ?: throw ApiException(status = 0, message = "Гостевая сессия не найдена — попробуйте ещё раз")
        val result = apiCall {
            api.guest.convert(GuestConvertRequest(guestId = guestId, login = login, email = login, password = password, name = name))
        }
        guestStore.save(GuestIdentity(guestId = guestId, guestToken = result.accessToken))
        val me = apiCall { api.auth.me() }
        val session = Session.from(me, result.accessToken, result.refreshToken)
        sessionStore.save(session)
        guestStore.clear()
        return session
    }

    private fun HttpException.toGuestApiException(): ApiException {
        val raw = runCatching { response()?.errorBody()?.string() }.getOrNull()
        val parsed = raw?.let {
            runCatching { json.decodeFromString(ApiEnvelope.serializer(JsonElement.serializer()), it) }.getOrNull()
        }
        return ApiException(status = code(), message = parsed?.error ?: "Ошибка сервера (${code()})", code = parsed?.code)
    }

    /** Тот же приём, что `isJwtExpired` в `guest.store.ts` — обновляем за 30 с до истечения. */
    private fun isJwtExpired(token: String): Boolean = runCatching {
        val payloadSegment = token.split(".").getOrNull(1) ?: return true
        val padded = payloadSegment.padEnd((payloadSegment.length + 3) / 4 * 4, '=')
        val decoded = Base64.getUrlDecoder().decode(padded)
        val exp = json.parseToJsonElement(String(decoded)).jsonObject["exp"]?.jsonPrimitive?.longOrNull ?: return false
        exp * 1000 < System.currentTimeMillis() + 30_000
    }.getOrElse { true }
}
