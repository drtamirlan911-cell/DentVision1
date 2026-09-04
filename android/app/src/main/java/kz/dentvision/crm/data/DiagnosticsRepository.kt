package kz.dentvision.crm.data

import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.api.ApiException
import kz.dentvision.crm.data.api.apiCall
import kz.dentvision.crm.data.model.CreateReferralRequest
import kz.dentvision.crm.data.model.DiagnosticOrg
import kz.dentvision.crm.data.model.DiagnosticsDashboardStats
import kz.dentvision.crm.data.model.PricingItem
import kz.dentvision.crm.data.model.Referral
import kz.dentvision.crm.data.model.ReferralDetail
import kz.dentvision.crm.data.model.RegistrationRequest
import kz.dentvision.crm.data.model.RejectRegistrationRequest
import kz.dentvision.crm.data.model.UploadFileRequest

/**
 * Кабинет клиники (исходящие направления). `referrals()` не идёт через
 * общий `apiCall` — у этой ручки нет поля `data` в ответе (см. комментарий
 * у `ReferralListEnvelope`), разворачивается вручную.
 */
class DiagnosticsRepository(
    private val api: ApiClient = ServiceLocator.api,
) {
    suspend fun dashboard(): DiagnosticsDashboardStats = apiCall { api.diagnostics.dashboard() }

    suspend fun referrals(status: String? = null, search: String? = null, limit: Int? = null): Pair<List<Referral>, Int> {
        val envelope = api.diagnostics.referrals(status, search, limit)
        if (!envelope.ok) {
            throw ApiException(status = 200, message = envelope.error ?: "Не удалось получить список направлений")
        }
        return envelope.items to envelope.total
    }

    suspend fun referral(id: String): ReferralDetail = apiCall { api.diagnostics.referral(id) }

    suspend fun centers(search: String? = null, city: String? = null): List<DiagnosticOrg> =
        apiCall { api.diagnostics.centers(search, city) }

    suspend fun laboratories(search: String? = null): List<DiagnosticOrg> =
        apiCall { api.diagnostics.laboratories(search) }

    suspend fun centerPricing(id: String): List<PricingItem> = apiCall { api.diagnostics.centerPricing(id) }

    suspend fun labPricing(id: String): List<PricingItem> = apiCall { api.diagnostics.labPricing(id) }

    suspend fun createReferral(body: CreateReferralRequest): Referral = apiCall { api.diagnostics.createReferral(body) }

    suspend fun uploadFile(body: UploadFileRequest) {
        apiCall { api.diagnostics.uploadFile(body) }
    }

    suspend fun registrations(status: String? = null): List<RegistrationRequest> =
        apiCall { api.diagnostics.registrations(status) }

    suspend fun approveRegistration(id: String): RegistrationRequest =
        apiCall { api.diagnostics.approveRegistration(id) }

    suspend fun rejectRegistration(id: String, reason: String?): RegistrationRequest =
        apiCall { api.diagnostics.rejectRegistration(id, RejectRegistrationRequest(reason)) }
}
