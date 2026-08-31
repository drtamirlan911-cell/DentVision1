package kz.dentvision.crm.data.session

import kotlinx.serialization.Serializable
import kz.dentvision.crm.data.model.Capabilities
import kz.dentvision.crm.data.model.Clinic
import kz.dentvision.crm.data.model.LoginResponse
import kz.dentvision.crm.data.model.Membership
import kz.dentvision.crm.data.model.User

/**
 * Что клиент знает о текущем входе. Права, страницы и возможности приходят от
 * сервера при входе и здесь только хранятся — вычислять их заново на устройстве
 * нельзя: разойдётся с бэкендом.
 */
@Serializable
data class Session(
    val user: User,
    val clinic: Clinic? = null,
    val accessToken: String,
    val refreshToken: String,
    val pages: List<String> = emptyList(),
    val permissions: List<String> = emptyList(),
    val capabilities: Capabilities? = null,
    val effectiveRole: String? = null,
    val memberships: List<Membership> = emptyList(),
    val activeMembership: Membership? = null,
) {
    fun has(permission: String): Boolean = permissions.contains(permission)

    companion object {
        fun from(response: LoginResponse): Session = Session(
            user = response.user,
            clinic = response.clinic,
            accessToken = response.tokens.accessToken,
            refreshToken = response.tokens.refreshToken,
            // Веб объединяет `pages` из ответа входа и из `roleInfo`
            // (`src/iam/resolver.ts:118`) — здесь то же объединение, чтобы меню
            // на Android совпадало с сайдбаром в браузере.
            pages = (response.pages + (response.roleInfo?.pages ?: emptyList())).distinct(),
            permissions = response.permissions,
            capabilities = response.capabilities,
            effectiveRole = response.effectiveRole ?: response.user.role,
            memberships = response.memberships,
            activeMembership = response.activeMembership ?: response.memberships.firstOrNull(),
        )
    }
}
