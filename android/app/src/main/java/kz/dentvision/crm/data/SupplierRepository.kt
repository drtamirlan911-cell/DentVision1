package kz.dentvision.crm.data

import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.api.apiCall
import kz.dentvision.crm.data.model.CreatePromotionRequest
import kz.dentvision.crm.data.model.CreateSupplierProductRequest
import kz.dentvision.crm.data.model.RegisterSupplierRequest
import kz.dentvision.crm.data.model.RequestSupplierPayoutRequest
import kz.dentvision.crm.data.model.Supplier
import kz.dentvision.crm.data.model.SupplierCashbackRule
import kz.dentvision.crm.data.model.SupplierDashboard
import kz.dentvision.crm.data.model.SupplierOrder
import kz.dentvision.crm.data.model.SupplierProduct
import kz.dentvision.crm.data.model.SupplierPromotion
import kz.dentvision.crm.data.model.UpdateOrderStatusRequest
import kz.dentvision.crm.data.model.UpdateSupplierProductRequest
import kz.dentvision.crm.data.model.UpdateSupplierProfileRequest
import kz.dentvision.crm.data.model.UpsertCashbackRuleRequest

/** Кабинет продавца — см. `data/api/SupplierApi.kt`. */
class SupplierRepository(private val api: ApiClient = ServiceLocator.api) {

    suspend fun me(): Supplier = apiCall { api.supplier.me() }

    suspend fun updateProfile(body: UpdateSupplierProfileRequest): Supplier =
        apiCall { api.supplier.updateMe(body) }

    suspend fun dashboard(): SupplierDashboard = apiCall { api.supplier.dashboard() }

    suspend fun cashbackRules(): List<SupplierCashbackRule> = apiCall { api.supplier.cashbackRules() }

    suspend fun upsertCashbackRule(scope: String, productId: String?, rateBps: Int, active: Boolean = true): SupplierCashbackRule =
        apiCall { api.supplier.upsertCashbackRule(UpsertCashbackRuleRequest(scope = scope, productId = productId, rateBps = rateBps, active = active)) }

    suspend fun createProduct(body: CreateSupplierProductRequest): SupplierProduct =
        apiCall { api.supplier.createProduct(body) }

    suspend fun updateProduct(id: String, body: UpdateSupplierProductRequest): SupplierProduct =
        apiCall { api.supplier.updateProduct(id, body) }

    suspend fun deleteProduct(id: String) {
        apiCall { api.supplier.deleteProduct(id) }
    }

    suspend fun updateOrderStatus(id: String, status: String): SupplierOrder =
        apiCall { api.supplier.updateOrderStatus(id, UpdateOrderStatusRequest(status)) }

    suspend fun createPromotion(productId: String, title: String?, discountPercent: Int, cashbackPercent: Int): SupplierPromotion =
        apiCall { api.supplier.createPromotion(CreatePromotionRequest(productId, title, discountPercent, cashbackPercent)) }

    suspend fun requestPayout(amountMinor: String) {
        apiCall { api.supplier.requestPayout(RequestSupplierPayoutRequest(amountMinor)) }
    }

    suspend fun register(body: RegisterSupplierRequest): Supplier = apiCall { api.supplier.register(body) }
}
