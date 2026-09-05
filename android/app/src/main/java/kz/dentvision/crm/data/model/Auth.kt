package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * Ответ `POST /api/auth/login`.
 *
 * **Списан с самого сервера (`buildSignInPayload`, `auth.routes.ts:104`), а не
 * с `LoginResponse` в `src/types.ts`.** Тот тип обещает вложенный объект
 * `tokens` и поле `clinic` — на проводе нет ни того, ни другого, и первая же
 * попытка входа с настоящего телефона это доказала:
 *
 *     Field 'tokens' is required ... but it was missing at path: $.data
 *
 * Сервер делает `...tokens` — раскладывает `accessToken` и `refreshToken`
 * плоско рядом с остальными полями. Клиника отдельным полем не приходит вовсе:
 * она лежит внутри `activeMembership.clinic`, и веб собирает её оттуда
 * (`buildClinicFromMembership`, `src/store/auth.store.ts:287`).
 *
 * Урок записан здесь, чтобы не повторился: источник правды о форме ответа —
 * код, который этот ответ строит, а не тип, который его описывает. Тип может
 * отстать, сериализатор — нет.
 */
@Serializable
data class LoginResponse(
    val user: User,
    val accessToken: String,
    val refreshToken: String,
    val roleInfo: RoleInfo? = null,
    val memberships: List<Membership> = emptyList(),
    val activeMembership: Membership? = null,
    val permissions: List<String> = emptyList(),
    val pages: List<String> = emptyList(),
    val effectiveRole: String? = null,
    val capabilities: Capabilities? = null,
)

/**
 * Членство в клинике. `clinic` приходит выборкой
 * `{ id, name, city, plan, logo }` — ровно эти поля и объявлены.
 */
@Serializable
data class Membership(
    val id: String,
    val clinicId: String,
    val role: String,
    val joinedAt: String? = null,
    val clinic: ClinicBrief? = null,
)

/** Клиника в том объёме, в каком её отдаёт вход. */
@Serializable
data class ClinicBrief(
    val id: String,
    val name: String = "",
    val city: String? = null,
    val plan: String? = null,
    val logo: String? = null,
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

/** Ответ обновления — токены тоже плоско. */
@Serializable
data class RefreshResponse(
    val accessToken: String,
    val refreshToken: String? = null,
)
