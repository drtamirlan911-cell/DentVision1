package kz.dentvision.crm.data.api

import kz.dentvision.crm.data.model.SwitchContextRequest
import kz.dentvision.crm.data.model.SwitchContextResponse
import kz.dentvision.crm.data.model.WorkspaceContextsResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

/** `dentvision-backend/src/modules/iam/iam.routes.ts`. */
interface IamApi {
    @GET("api/iam/me/contexts")
    suspend fun contexts(): ApiEnvelope<WorkspaceContextsResponse>

    @POST("api/iam/switch-context")
    suspend fun switchContext(@Body body: SwitchContextRequest): ApiEnvelope<SwitchContextResponse>
}
