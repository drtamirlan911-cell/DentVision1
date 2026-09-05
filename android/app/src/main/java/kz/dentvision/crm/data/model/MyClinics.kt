package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/** Тело `POST /api/auth/clinics` — создание новой клиники текущим пользователем-владельцем. */
@Serializable
data class CreateClinicRequest(
    val name: String,
    val city: String? = null,
    val address: String? = null,
    val phone: String? = null,
)

/**
 * `data` ответа `POST /api/auth/clinics` — сервер сразу выдаёт токены,
 * скоупленные на новую клинику (`auth.routes.ts:743-751`), тем же приёмом,
 * что и `/demo-clinic`: поэтому те же вложенные токены, что [DemoClinicTokens]
 * (переиспользуются, а не дублируются под новым именем).
 */
@Serializable
data class CreateClinicResponse(val tokens: DemoClinicTokens)

/** Тело `POST /api/auth/join-clinic` — только код приглашения; `clinicId` без кода использовать не стоит (см. auth.routes.ts:1062-1066). */
@Serializable
data class JoinClinicRequest(val code: String)

/**
 * `data` ответа `POST /api/auth/join-clinic` — сам `ClinicMember`. Токены
 * сервер здесь не выдаёт (в отличие от create/demo), поэтому после
 * присоединения нужен обычный `switch-context` — `clinicId` берётся отсюда.
 */
@Serializable
data class JoinClinicResponse(val clinicId: String)
