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
    /**
     * Удовлетворяет ли набор прав требуемому ключу.
     *
     * Перенос `permissionsSatisfy` из `dentvision-backend/src/lib/permissions.ts`
     * вместе с лестницей действий и подстановкой устаревших имён. Наивная
     * проверка «есть ли такая строка в списке» здесь не годится по двум
     * причинам, и обе стоили бы человеку рабочих кнопок:
     *
     *  - у SUPERADMIN весь набор прав — это одна звёздочка `*`;
     *  - матрица не выводит младшие действия из старших, поэтому владелец с
     *    `shop.manage` не имеет `shop.read` буквально, но должен проходить.
     *
     * Клиент решает этим только одно — показывать ли кнопку. Настоящая проверка
     * всё равно на сервере: расхождение здесь может спрятать действие, но не
     * может его разрешить.
     */
    fun has(permission: String): Boolean {
        if (permissions.contains("*")) return true
        val required = LEGACY_KEY_MAP[permission] ?: permission
        if (permissions.contains(required)) return true

        val parts = required.split(".")
        if (parts.size != 2) return false
        val (module, action) = parts
        val satisfying = ACTION_SATISFIED_BY[action] ?: listOf(action)
        return satisfying.any { permissions.contains("$module.$it") }
    }

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

/**
 * Лестница действий: чем правее в списке, тем шире право. Копия
 * `ACTION_SATISFIED_BY` с бэкенда.
 */
private val ACTION_SATISFIED_BY: Map<String, List<String>> = mapOf(
    "read" to listOf("read", "write", "delete", "manage"),
    "write" to listOf("write", "delete", "manage"),
    "delete" to listOf("delete", "manage"),
    "manage" to listOf("manage"),
)

/**
 * Устаревшие имена прав в единственном числе → канонические. Копия
 * `LEGACY_KEY_MAP` с бэкенда: сервер присылает канонические (`patients.write`),
 * но часть кода исторически спрашивает про `patient.write`.
 */
private val LEGACY_KEY_MAP: Map<String, String> = mapOf(
    "patient.read" to "patients.read",
    "patient.write" to "patients.write",
    "patient.delete" to "patients.delete",
    "appointment.read" to "appointments.read",
    "appointment.write" to "appointments.write",
    "appointment.delete" to "appointments.delete",
    "finance.manage" to "billing.manage",
    "finance.read" to "billing.read",
)
