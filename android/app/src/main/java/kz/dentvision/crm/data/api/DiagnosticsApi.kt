package kz.dentvision.crm.data.api

import kz.dentvision.crm.data.model.DiagnosticsDashboardStats
import kz.dentvision.crm.data.model.ReferralDetail
import kz.dentvision.crm.data.model.ReferralListEnvelope
import retrofit2.http.GET
import retrofit2.http.Path

/**
 * Кабинет клиники (исходящие направления), `dentvision-backend/src/modules/
 * diagnostics/diagnostics.routes.ts`. `clinicId` не передаётся — все три
 * ручки сами берут его из токена, когда явно не задан (`req.user?.clinicId`
 * fallback в каждом обработчике).
 */
interface DiagnosticsApi {
    @GET("api/diagnostics/dashboard")
    suspend fun dashboard(): ApiEnvelope<DiagnosticsDashboardStats>

    @GET("api/diagnostics/referrals")
    suspend fun referrals(): ReferralListEnvelope

    @GET("api/diagnostics/referrals/{id}")
    suspend fun referral(@Path("id") id: String): ApiEnvelope<ReferralDetail>
}
