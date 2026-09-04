package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * Тело `POST /api/auth/demo-clinic` (`dentvision-backend/src/modules/auth/
 * auth.routes.ts:782-1030`) — все поля опциональны, у сервера есть дефолты
 * («Демо-клиника «Дентал Плюс»», Алматы и т.д.), если оставить пустыми.
 */
@Serializable
data class DemoClinicRequest(
    val name: String? = null,
    val city: String? = null,
    val address: String? = null,
    val phone: String? = null,
)

/** Токены внутри ответа `/demo-clinic` — здесь вложены, в отличие от `/login`, где они плоские. */
@Serializable
data class DemoClinicTokens(
    val accessToken: String,
    val refreshToken: String,
)

/**
 * `data` ответа `POST /api/auth/demo-clinic`. Поле `clinic` сознательно не
 * моделируем: после создания клиники всё равно перечитываем `/me`
 * (`DemoRepository.registerAndCreateDemoClinic`), а `Json { ignoreUnknownKeys
 * = true }` в `ApiClient.kt` спокойно пропускает лишние поля в ответе.
 */
@Serializable
data class DemoClinicResponse(
    val tokens: DemoClinicTokens,
)
