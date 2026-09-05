package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * Уведомление пользователя — `notifications.routes.ts`. Не привязано к
 * клинике: сервер фильтрует только по `userId` из токена, поэтому одна и та
 * же лента видна под любым рабочим пространством.
 */
@Serializable
data class AppNotification(
    val id: String,
    val type: String = "system",
    val title: String = "",
    val message: String = "",
    val read: Boolean = false,
    val link: String? = null,
    val createdAt: String = "",
)

@Serializable
data class NotificationPreference(
    val type: String,
    val enabled: Boolean = true,
)

@Serializable
data class NotificationPreferenceUpdate(
    val type: String,
    val enabled: Boolean,
)

@Serializable
data class UnreadCount(
    val unread: Int = 0,
)
