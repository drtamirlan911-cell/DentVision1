package kz.dentvision.crm.data.api

import kz.dentvision.crm.data.model.GuestConvertRequest
import kz.dentvision.crm.data.model.GuestConvertResult
import kz.dentvision.crm.data.model.GuestSessionRequest
import kz.dentvision.crm.data.model.GuestSessionResponse
import retrofit2.http.Body
import retrofit2.http.POST

/** `dentvision-backend/src/modules/guest/guest.routes.ts`. */
interface GuestApi {
    /** Ответ плоский, не `ApiEnvelope` — см. `GuestSessionResponse`. */
    @POST("api/guest/session")
    suspend fun session(@Body body: GuestSessionRequest): GuestSessionResponse

    @POST("api/guest/convert")
    suspend fun convert(@Body body: GuestConvertRequest): ApiEnvelope<GuestConvertResult>
}
