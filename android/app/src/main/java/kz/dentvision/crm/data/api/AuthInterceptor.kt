package kz.dentvision.crm.data.api

import kz.dentvision.crm.data.session.GuestSessionStore
import kz.dentvision.crm.data.session.SessionStore
import okhttp3.Interceptor
import okhttp3.Response
import java.util.TimeZone

/**
 * Заголовки каждого запроса — те же, что ставит `apiRequest`
 * (`src/utils/api.ts:158`): `Authorization: Bearer …`, `X-Client-Timezone` и
 * `Content-Type: application/json`.
 *
 * Без настоящей сессии — гостевой токен, если он есть (тот же приём, что
 * `aiChatSSE()` в `src/utils/api.ts:2723-2733` делает точечно для ИИ-чата;
 * здесь — на уровне перехватчика, безопасно для любого маршрута: сервер
 * либо примет гостевой JWT там, где это предусмотрено (`optionalAuth`),
 * либо ответит 401, и `TokenAuthenticator` тихо сдастся, не тронув
 * настоящую сессию — `session.refreshToken` для гостя всегда `null`).
 *
 * CSRF-заголовка здесь нет намеренно: `dentvision-backend/src/middleware/csrf.ts`
 * пропускает запросы с Bearer-токеном — защита от подделки межсайтовых запросов
 * нужна там, где авторизация едет в cookie, а мобильный клиент cookie не шлёт.
 */
class AuthInterceptor(
    private val session: SessionStore,
    private val guestSession: GuestSessionStore,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val builder = chain.request().newBuilder()
        val token = session.accessToken ?: guestSession.guestToken
        token?.let { builder.header("Authorization", "Bearer $it") }
        builder.header("X-Client-Timezone", TimeZone.getDefault().id)
        return chain.proceed(builder.build())
    }
}
