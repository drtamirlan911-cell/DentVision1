package kz.dentvision.crm.data.api

import kz.dentvision.crm.data.model.CreateInvitationRequest
import kz.dentvision.crm.data.model.OrganizationInvitation
import kz.dentvision.crm.data.model.SwitchContextRequest
import kz.dentvision.crm.data.model.SwitchContextResponse
import kz.dentvision.crm.data.model.WorkspaceContextsResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

/** `dentvision-backend/src/modules/iam/iam.routes.ts`. */
interface IamApi {
    @GET("api/iam/me/contexts")
    suspend fun contexts(): ApiEnvelope<WorkspaceContextsResponse>

    @POST("api/iam/switch-context")
    suspend fun switchContext(@Body body: SwitchContextRequest): ApiEnvelope<SwitchContextResponse>

    /** 403 для всех ниже владельца/администратора — тот же случай, что и на вебе. */
    @GET("api/iam/invitations")
    suspend fun invitations(@Query("organizationId") organizationId: String): ApiEnvelope<List<OrganizationInvitation>>

    @POST("api/iam/invitations")
    suspend fun createInvitation(@Body body: CreateInvitationRequest): ApiEnvelope<OrganizationInvitation>
}
