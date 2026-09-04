package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * Одна строка на каждое рабочее пространство пользователя — клиника,
 * диагностический центр, лаборатория, поставщик, лекторская позиция,
 * академия, партнёр. Перенос `WorkspaceContext` с бэкенда
 * (`dentvision-backend/src/modules/iam/contexts.ts`), тот же список, что
 * веб показывает в `WorkspaceSwitcher.tsx`.
 */
@Serializable
data class WorkspaceContext(
    val id: String,
    val scopeType: String,
    val scopeId: String,
    val organizationId: String? = null,
    val name: String = "",
    val roleLabel: String = "",
    val logo: String? = null,
)

/** Ответ `GET /api/iam/me/contexts`. */
@Serializable
data class WorkspaceContextsResponse(
    val contexts: List<WorkspaceContext> = emptyList(),
)

/** Тело `POST /api/iam/switch-context`. */
@Serializable
data class SwitchContextRequest(
    val scopeType: String,
    val scopeId: String,
)

/** Ответ переключения — токены плоско, как при входе (`generateTokens`). */
@Serializable
data class SwitchContextResponse(
    val accessToken: String,
    val refreshToken: String,
)

/**
 * Ответ `GET /api/auth/me` (`auth.routes.ts:558`) — не тот же шейп, что у
 * входа: пользователь лежит вложенным полем, а права/страницы/членства
 * рядом с ним, а не внутри. Смешивать с `LoginResponse` нельзя: `me()` был
 * объявлен как `ApiEnvelope<User>` и падал бы на обязательном `User.id`,
 * которого на верхнем уровне `data` нет.
 */
@Serializable
data class MeResponse(
    val user: User,
    val memberships: List<Membership> = emptyList(),
    val activeMembership: Membership? = null,
    val permissions: List<String> = emptyList(),
    val pages: List<String> = emptyList(),
    val capabilities: Capabilities? = null,
    val effectiveRole: String? = null,
)
