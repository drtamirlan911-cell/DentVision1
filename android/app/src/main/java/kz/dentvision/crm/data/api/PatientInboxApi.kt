package kz.dentvision.crm.data.api

import kz.dentvision.crm.data.model.ConversationMessage
import kz.dentvision.crm.data.model.InboxConversationSummary
import kz.dentvision.crm.data.model.InboxThread
import kz.dentvision.crm.data.model.ReplyRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/** `dentvision-backend/src/modules/patient-conversation/patientInbox.routes.ts` — сторона сотрудника клиники. */
interface PatientInboxApi {
    @GET("api/patient-inbox/conversations")
    suspend fun conversations(@Query("status") status: String? = null): ApiEnvelope<List<InboxConversationSummary>>

    @GET("api/patient-inbox/conversations/{id}")
    suspend fun thread(@Path("id") id: String): ApiEnvelope<InboxThread>

    @POST("api/patient-inbox/conversations/{id}/claim")
    suspend fun claim(@Path("id") id: String): ApiEnvelope<InboxConversationSummary>

    @POST("api/patient-inbox/conversations/{id}/reply")
    suspend fun reply(@Path("id") id: String, @Body body: ReplyRequest): ApiEnvelope<ConversationMessage>

    @POST("api/patient-inbox/conversations/{id}/resolve")
    suspend fun resolve(@Path("id") id: String): ApiEnvelope<InboxConversationSummary>
}
