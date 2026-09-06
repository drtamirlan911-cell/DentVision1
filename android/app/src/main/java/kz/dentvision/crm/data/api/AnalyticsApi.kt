package kz.dentvision.crm.data.api

import kz.dentvision.crm.data.model.AnalyticsSummary
import kz.dentvision.crm.data.model.DoctorUtilization
import kz.dentvision.crm.data.model.PatientsGrowthPoint
import kz.dentvision.crm.data.model.RevenuePoint
import retrofit2.http.GET

/**
 * Аналитика клиники.
 *
 * Весь маршрут сторожат два гейта на сервере: право `bi.clinic` и тариф
 * (`guardAnalytics`). Клиент их не дублирует и не угадывает — показывает
 * раздел тем, у кого право есть, а отказ по тарифу приходит ответом сервера
 * и показывается как есть.
 */
interface AnalyticsApi {

    @GET("api/analytics/dashboard")
    suspend fun summary(): ApiEnvelope<AnalyticsSummary>

    /** Двенадцать месяцев по возрастанию; месяцы без выручки приходят нулями. */
    @GET("api/analytics/revenue")
    suspend fun revenue(): ApiEnvelope<List<RevenuePoint>>

    @GET("api/analytics/doctors")
    suspend fun doctors(): ApiEnvelope<List<DoctorUtilization>>

    @GET("api/analytics/patients-growth")
    suspend fun patientsGrowth(): ApiEnvelope<List<PatientsGrowthPoint>>
}
