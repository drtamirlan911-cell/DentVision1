package kz.dentvision.crm.data.api

import kz.dentvision.crm.data.model.LoginRequest
import kz.dentvision.crm.data.model.LoginResponse
import kz.dentvision.crm.data.model.User
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

/** Существующие маршруты `dentvision-backend/src/modules/auth/auth.routes.ts`. */
interface AuthApi {
    @POST("api/auth/login")
    suspend fun login(@Body body: LoginRequest): ApiEnvelope<LoginResponse>

    @GET("api/auth/me")
    suspend fun me(): ApiEnvelope<User>

    @POST("api/auth/logout")
    suspend fun logout(): ApiEnvelope<Unit>
}
