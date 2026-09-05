package kz.dentvision.crm.data.api

import kz.dentvision.crm.data.model.AppNotification
import kz.dentvision.crm.data.model.NotificationPreference
import kz.dentvision.crm.data.model.NotificationPreferenceUpdate
import kz.dentvision.crm.data.model.UnreadCount
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Уведомления — `modules/notifications/notifications.routes.ts`. По
 * пользователю, не по клинике: один и тот же список виден под любым рабочим
 * пространством.
 */
interface NotificationsApi {

    @GET("api/notifications")
    suspend fun list(
        @Query("limit") limit: Int = 50,
        @Query("type") type: String? = null,
    ): ApiEnvelope<List<AppNotification>>

    @GET("api/notifications/unread-count")
    suspend fun unreadCount(): ApiEnvelope<UnreadCount>

    @POST("api/notifications/{id}/read")
    suspend fun markRead(@Path("id") id: String): ApiEnvelope<AppNotification>

    @POST("api/notifications/read-all")
    suspend fun markAllRead(): ApiEnvelope<Unit>

    @GET("api/notifications/preferences")
    suspend fun preferences(): ApiEnvelope<List<NotificationPreference>>

    @PUT("api/notifications/preferences")
    suspend fun updatePreference(@Body body: NotificationPreferenceUpdate): ApiEnvelope<NotificationPreference>
}
