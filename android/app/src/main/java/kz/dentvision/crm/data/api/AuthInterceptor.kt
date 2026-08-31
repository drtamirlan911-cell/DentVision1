package kz.dentvision.crm.data.api

import kz.dentvision.crm.data.session.SessionStore
import okhttp3.Interceptor
import okhttp3.Response
import java.util.TimeZone

/**
 * Заголовки каждого запроса — те же, что ставит `apiRequest`
 * (`src/utils/api.ts:158`): `Authorization: Bearer …`, `X-Client-Timezone` и
 * `Content-Type: application/json`.
 *
 * CSRF-заголовка здесь нет намеренно: `dentvision-backend/src/middleware/csrf.ts`
 * пропускает запросы с Bearer-токеном — защита от подделки межсайтовых запросов
 * нужна там, где авторизация едет в cookie, а мобильный клиент cookie не шлёт.
 */
class AuthInterceptor(private val session: SessionStore) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val builder = chain.request().newBuilder()
        session.accessToken?.let { builder.header("Authorization", "Bearer $it") }
        builder.header("X-Client-Timezone", TimeZone.getDefault().id)
        return chain.proceed(builder.build())
    }
}
