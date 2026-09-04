package kz.dentvision.crm.data

import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.api.ApiException
import kz.dentvision.crm.data.api.apiCall
import kz.dentvision.crm.data.model.DiagnosticsDashboardStats
import kz.dentvision.crm.data.model.Referral
import kz.dentvision.crm.data.model.ReferralDetail

/**
 * Кабинет клиники (исходящие направления). `referrals()` не идёт через
 * общий `apiCall` — у этой ручки нет поля `data` в ответе (см. комментарий
 * у `ReferralListEnvelope`), разворачивается вручную.
 */
class DiagnosticsRepository(
    private val api: ApiClient = ServiceLocator.api,
) {
    suspend fun dashboard(): DiagnosticsDashboardStats = apiCall { api.diagnostics.dashboard() }

    suspend fun referrals(): Pair<List<Referral>, Int> {
        val envelope = api.diagnostics.referrals()
        if (!envelope.ok) {
            throw ApiException(status = 200, message = envelope.error ?: "Не удалось получить список направлений")
        }
        return envelope.items to envelope.total
    }

    suspend fun referral(id: String): ReferralDetail = apiCall { api.diagnostics.referral(id) }
}
