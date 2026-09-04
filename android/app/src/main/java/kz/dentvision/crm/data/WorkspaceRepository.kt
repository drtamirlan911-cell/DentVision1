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
        // /me читается ещё со старым, но всё ещё рабочим токеном из
        // SessionStore — новые подставляются вместе с остальным ответом
        // одним save(), а не двумя шагами, как setTokens()+restoreSession() в вебе.
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
