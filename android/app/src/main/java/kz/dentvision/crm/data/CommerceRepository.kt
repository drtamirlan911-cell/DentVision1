package kz.dentvision.crm.data

import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.api.apiCall
import kz.dentvision.crm.data.model.AcademyRegisterRequest
import kz.dentvision.crm.data.model.PurchaseResult
import kz.dentvision.crm.data.model.ShopOrderItem
import kz.dentvision.crm.data.model.ShopOrderRequest

/** Покупка товара и запись на курс — обе ручки требуют входа, см. [kz.dentvision.crm.data.api.CommerceApi]. */
class CommerceRepository(private val api: ApiClient = ServiceLocator.api) {

    suspend fun buyProduct(productId: String, quantity: Int, clinicId: String?): PurchaseResult =
        apiCall {
            api.commerce.createOrder(
                ShopOrderRequest(items = listOf(ShopOrderItem(productId, quantity)), clinicId = clinicId),
            )
        }

    suspend fun registerCourse(productId: String, format: String): PurchaseResult =
        apiCall { api.commerce.registerCourse(AcademyRegisterRequest(productId, format)) }
}
