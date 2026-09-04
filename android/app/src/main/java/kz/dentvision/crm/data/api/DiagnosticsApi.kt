package kz.dentvision.crm.data.api

import kotlinx.serialization.json.JsonElement
import kz.dentvision.crm.data.model.AiGenerateResultRequest
import kz.dentvision.crm.data.model.AiGeneratedResult
import kz.dentvision.crm.data.model.ChangeReferralStatusRequest
import kz.dentvision.crm.data.model.CreateReferralRequest
import kz.dentvision.crm.data.model.DiagnosticOrg
import kz.dentvision.crm.data.model.DiagnosticsDashboardStats
import kz.dentvision.crm.data.model.PricingItem
import kz.dentvision.crm.data.model.Referral
import kz.dentvision.crm.data.model.ReferralDetail
import kz.dentvision.crm.data.model.ReferralListEnvelope
import kz.dentvision.crm.data.model.RegistrationRequest
import kz.dentvision.crm.data.model.RejectRegistrationRequest
import kz.dentvision.crm.data.model.SignResultRequest
import kz.dentvision.crm.data.model.UploadFileRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Кабинет клиники (исходящие направления), `dentvision-backend/src/modules/
 * diagnostics/diagnostics.routes.ts`. `clinicId` не передаётся в GET-ручках
 * — они сами берут его из токена, когда явно не задан (`req.user?.clinicId`
 * fallback в каждом обработчике).
 */
interface DiagnosticsApi {
    @GET("api/diagnostics/dashboard")
    suspend fun dashboard(): ApiEnvelope<DiagnosticsDashboardStats>

    @GET("api/diagnostics/referrals")
    suspend fun referrals(
        @Query("status") status: String? = null,
        @Query("search") search: String? = null,
        @Query("limit") limit: Int? = null,
        @Query("centerId") centerId: String? = null,
        @Query("labId") labId: String? = null,
    ): ReferralListEnvelope

    @GET("api/diagnostics/referrals/{id}")
    suspend fun referral(@Path("id") id: String): ApiEnvelope<ReferralDetail>

    @GET("api/diagnostics/centers")
    suspend fun centers(
        @Query("search") search: String? = null,
        @Query("city") city: String? = null,
    ): ApiEnvelope<List<DiagnosticOrg>>

    @GET("api/diagnostics/laboratories")
    suspend fun laboratories(@Query("search") search: String? = null): ApiEnvelope<List<DiagnosticOrg>>

    @GET("api/diagnostics/centers/{id}/pricing")
    suspend fun centerPricing(@Path("id") id: String): ApiEnvelope<List<PricingItem>>

    @GET("api/diagnostics/laboratories/{id}/pricing")
    suspend fun labPricing(@Path("id") id: String): ApiEnvelope<List<PricingItem>>

    @POST("api/diagnostics/referrals")
    suspend fun createReferral(@Body body: CreateReferralRequest): ApiEnvelope<Referral>

    @POST("api/diagnostics/files/upload")
    suspend fun uploadFile(@Body body: UploadFileRequest): ApiEnvelope<JsonElement>

    /** Только SUPERADMIN — сервер отвечает 403 всем остальным. */
    @GET("api/diagnostics/registrations")
    suspend fun registrations(@Query("status") status: String? = null): ApiEnvelope<List<RegistrationRequest>>

    @POST("api/diagnostics/registrations/{id}/approve")
    suspend fun approveRegistration(@Path("id") id: String): ApiEnvelope<RegistrationRequest>

    @POST("api/diagnostics/registrations/{id}/reject")
    suspend fun rejectRegistration(
        @Path("id") id: String,
        @Body body: RejectRegistrationRequest,
    ): ApiEnvelope<RegistrationRequest>

    /** Общая ручка смены статуса — «Принять» и «Начать» на приёмной стороне. */
    @POST("api/diagnostics/referrals/{id}/status")
    suspend fun changeReferralStatus(
        @Path("id") id: String,
        @Body body: ChangeReferralStatusRequest,
    ): ApiEnvelope<Referral>

    @POST("api/diagnostics/results/ai-generate")
    suspend fun aiGenerateResult(@Body body: AiGenerateResultRequest): ApiEnvelope<AiGeneratedResult>

    @POST("api/diagnostics/results/{id}/sign")
    suspend fun signResult(@Path("id") id: String, @Body body: SignResultRequest): ApiEnvelope<JsonElement>
}
