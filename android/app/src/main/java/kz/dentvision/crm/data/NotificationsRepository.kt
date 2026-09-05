package kz.dentvision.crm.data

import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.api.apiCall
import kz.dentvision.crm.data.model.AppNotification
import kz.dentvision.crm.data.model.NotificationPreference
import kz.dentvision.crm.data.model.NotificationPreferenceUpdate

/**
 * Уведомления пользователя — одна лента на все рабочие пространства, вне
 * `CrmRepository`: сервер их не скоупит по клинике, и тут нечего разворачивать
 * по страницам/клиникам, как остальные разделы кабинета.
 */
class NotificationsRepository(private val api: ApiClient = ServiceLocator.api) {

    suspend fun list(limit: Int = 50): List<AppNotification> = apiCall { api.notifications.list(limit = limit) }

    suspend fun unreadCount(): Int = apiCall { api.notifications.unreadCount() }.unread

    suspend fun markRead(id: String): AppNotification = apiCall { api.notifications.markRead(id) }

    suspend fun markAllRead() {
        apiCall { api.notifications.markAllRead() }
    }

    suspend fun preferences(): List<NotificationPreference> = apiCall { api.notifications.preferences() }

    suspend fun updatePreference(type: String, enabled: Boolean): NotificationPreference =
        apiCall { api.notifications.updatePreference(NotificationPreferenceUpdate(type, enabled)) }
}
