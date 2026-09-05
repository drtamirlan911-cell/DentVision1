package kz.dentvision.crm.data

import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.api.apiCall
import kz.dentvision.crm.data.model.LoginRequest
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.data.session.SessionStore

/**
 * Вход и выход. Права после входа не вычисляются заново — сервер прислал
 * `pages`, `permissions` и `capabilities`, они и сохраняются.
 */
class AuthRepository(
    private val api: ApiClient,
    private val session: SessionStore,
) {
    suspend fun login(login: String, password: String): Session {
        val response = apiCall { api.auth.login(LoginRequest(email = login.trim(), password = password)) }
        val created = Session.from(response)
        session.save(created)
        return created
    }

    /**
     * Выход: сначала гасим сессию на сервере, потом стираем локальную. Если
     * сервер недоступен, локальную всё равно стираем — иначе человек остаётся
     * внутри приложения, будучи уверенным, что вышел.
     */
    suspend fun logout() {
        runCatching { apiCall { api.auth.logout() } }
        session.clear()
    }
}
