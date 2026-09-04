package kz.dentvision.crm.data

import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.api.apiCall
import kz.dentvision.crm.data.model.CreateInvitationRequest
import kz.dentvision.crm.data.model.OrganizationInvitation
import kz.dentvision.crm.data.model.SwitchContextRequest
import kz.dentvision.crm.data.model.WorkspaceContext
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.data.session.SessionStore

/**
 * Список рабочих пространств и переключение между ними. Перенос `pick()` из
 * `WorkspaceSwitcher.tsx`: `switch-context` отдаёт только токены, полную
 * сессию (права, страницы, членства) собирает следующий вызов `/me`.
 */
class WorkspaceRepository(
    private val api: ApiClient = ServiceLocator.api,
    private val session: SessionStore = ServiceLocator.session,
) {
    suspend fun contexts(): List<WorkspaceContext> = apiCall { api.iam.contexts() }.contexts

    suspend fun switchTo(context: WorkspaceContext): Session {
        val tokens = apiCall {
            api.iam.switchContext(
                SwitchContextRequest(
                    scopeType = context.scopeType,
                    scopeId = context.organizationId ?: context.scopeId,
                ),
            )
        }
        // Новые токены — в SessionStore СНАЧАЛА: AuthInterceptor берёт
        // Authorization живьём из session.accessToken, и если вызвать /me
        // раньше этой строки, запрос уйдёт ещё со старым токеном и ответит
        // данными прошлого пространства (organizationType/pages/permissions
        // от него же) — тот же порядок, что setTokens() → restoreSession()
        // на вебе, а не наоборот.
        session.updateTokens(tokens.accessToken, tokens.refreshToken)
        val me = apiCall { api.auth.me() }
        val refreshed = Session.from(me, tokens.accessToken, tokens.refreshToken)
        session.save(refreshed)
        return refreshed
    }

    /** 403 — «недостаточно прав», не ошибка загрузки; вызывающая сторона решает, как показать. */
    suspend fun invitations(organizationId: String): List<OrganizationInvitation> =
        apiCall { api.iam.invitations(organizationId) }

    suspend fun createInvitation(organizationId: String, role: String, email: String?): OrganizationInvitation =
        apiCall { api.iam.createInvitation(CreateInvitationRequest(organizationId = organizationId, role = role, email = email?.ifBlank { null })) }
}
