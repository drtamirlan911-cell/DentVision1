package kz.dentvision.crm.data.api

import kz.dentvision.crm.data.model.DemoClinicRequest
import kz.dentvision.crm.data.model.DemoClinicResponse
import kz.dentvision.crm.data.model.LoginRequest
import kz.dentvision.crm.data.model.LoginResponse
import kz.dentvision.crm.data.model.MeResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

/** Существующие маршруты `dentvision-backend/src/modules/auth/auth.routes.ts`. */
interface AuthApi {
    @POST("api/auth/login")
    suspend fun login(@Body body: LoginRequest): ApiEnvelope<LoginResponse>

    @GET("api/auth/me")
    suspend fun me(): ApiEnvelope<MeResponse>

    @POST("api/auth/logout")
    suspend fun logout(): ApiEnvelope<Unit>

    /** Создаёт настоящую клинику с засеянными данными для владельца-вызывающего — не мок. */
    @POST("api/auth/demo-clinic")
    suspend fun demoClinic(@Body body: DemoClinicRequest): ApiEnvelope<DemoClinicResponse>
}
