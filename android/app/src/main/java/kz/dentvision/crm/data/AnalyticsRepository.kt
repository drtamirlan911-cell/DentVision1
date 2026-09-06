package kz.dentvision.crm.data

import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.api.apiCall
import kz.dentvision.crm.data.model.AnalyticsSummary
import kz.dentvision.crm.data.model.DoctorUtilization
import kz.dentvision.crm.data.model.PatientsGrowthPoint
import kz.dentvision.crm.data.model.RevenuePoint

/**
 * Аналитика клиники. Ничего не считает на клиенте: все четыре ручки уже
 * возвращают посчитанные ряды, причём помесячные — сгруппированными в SQL, а
 * не построчной выгрузкой в приложение.
 */
class AnalyticsRepository(private val api: ApiClient = ServiceLocator.api) {

    suspend fun summary(): AnalyticsSummary = apiCall { api.analytics.summary() }

    suspend fun revenue(): List<RevenuePoint> = apiCall { api.analytics.revenue() }

    suspend fun doctors(): List<DoctorUtilization> = apiCall { api.analytics.doctors() }

    suspend fun patientsGrowth(): List<PatientsGrowthPoint> = apiCall { api.analytics.patientsGrowth() }
}
