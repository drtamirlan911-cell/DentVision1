package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * Ответ `POST /api/guest/session` (`dentvision-backend/src/modules/guest/
 * guest.routes.ts:92-96`) — единственная ручка в приложении, чей ответ НЕ
 * обёрнут в `{ok, data}`: плоский объект, поэтому не через `ApiEnvelope`.
 */
@Serializable
data class GuestSessionResponse(
    val guestId: String,
    val token: String,
    val aiRequestsLeft: Int = 20,
)

/** Тело `POST /api/guest/session` — переиспользовать ту же гостевую личность при новом токене. */
@Serializable
data class GuestSessionRequest(val guestId: String? = null)

/** Тело `POST /api/guest/convert` — превращает гостя в обычный аккаунт. */
@Serializable
data class GuestConvertRequest(
    val guestId: String,
    val login: String,
    val email: String,
    val password: String,
    val name: String,
)

/** `data` внутри конверта `POST /api/guest/convert` — та же форма, что у входа. */
@Serializable
data class GuestConvertResult(
    val user: User,
    val accessToken: String,
    val refreshToken: String,
)
