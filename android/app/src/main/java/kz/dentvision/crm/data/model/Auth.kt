package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * Ответ `POST /api/auth/login` — списан с `LoginResponse` в `src/types.ts:516`.
 *
 * Ключевое: сервер отдаёт не только токены, но и `pages`, `permissions`,
 * `capabilities`, `effectiveRole`. Матрица прав живёт на бэкенде, клиент её не
 * повторяет и не додумывает — он показывает ровно то, что ему разрешили.
 */
@Serializable
data class LoginResponse(
    val user: User,
    val clinic: Clinic? = null,
    val tokens: AuthTokens,
    val roleInfo: RoleInfo? = null,
    val memberships: List<Membership> = emptyList(),
    val activeMembership: Membership? = null,
    val permissions: List<String> = emptyList(),
    val pages: List<String> = emptyList(),
    val effectiveRole: String? = null,
    val capabilities: Capabilities? = null,
)

@Serializable
data class AuthTokens(
    val accessToken: String,
    val refreshToken: String,
)

@Serializable
data class Membership(
    val id: String,
    val clinicId: String,
    val role: String,
)

@Serializable
data class Capabilities(
    val canSeeSalary: Boolean = false,
    val canAddStaff: Boolean = false,
    val canSeeAudit: Boolean = false,
    val canBackup: Boolean = false,
    val canSeeReports: Boolean = false,
    val canSeeExpenses: Boolean = false,
    val canManageClinicSettings: Boolean = false,
    val canManageFinance: Boolean = false,
    val ownDataOnly: Boolean = false,
    val readOnly: Boolean = false,
)

@Serializable
data class RoleInfo(
    val canSeeSuperAdmin: Boolean = false,
    val canSeeSettings: Boolean = false,
    val canSeeAI: Boolean = false,
    val canSeeAnalytics: Boolean = false,
    val canSeeAdmin: Boolean = false,
    val canSeeAudit: Boolean = false,
    val canSeeBackup: Boolean = false,
    val canSeeShop: Boolean = false,
    val canSeeSchool: Boolean = false,
    val canManageStaff: Boolean = false,
    val canManageFinance: Boolean = false,
    val canManageClinicSettings: Boolean = false,
    val canAddStaff: Boolean = false,
    val ownDataOnly: Boolean = false,
    val readOnly: Boolean = false,
    val pages: List<String> = emptyList(),
)

/** Тело `POST /api/auth/login`: поле называется `email`, но принимает и логин. */
@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
)

/** Тело `POST /api/auth/refresh`. */
@Serializable
data class RefreshRequest(
    val refreshToken: String,
)

@Serializable
data class RefreshResponse(
    val accessToken: String,
    val refreshToken: String? = null,
)
