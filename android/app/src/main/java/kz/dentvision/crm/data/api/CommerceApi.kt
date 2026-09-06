package kz.dentvision.crm.data.api

import kz.dentvision.crm.data.model.AcademyRegisterRequest
import kz.dentvision.crm.data.model.PurchaseResult
import kz.dentvision.crm.data.model.ShopOrderRequest
import retrofit2.http.Body
import retrofit2.http.POST

/**
 * Покупка в маркетплейсе и запись в Academy OS — в отличие от [PublicApi],
 * обе ручки требуют входа (`authenticate` на `shop.routes.ts:162` и
 * `school.routes.ts:601`); гостя `POST /api/shop/orders` отдельно отклоняет
 * ещё до создания заказа (`req.user?.isGuest`).
 */
interface CommerceApi {

    @POST("api/shop/orders")
    suspend fun createOrder(@Body body: ShopOrderRequest): ApiEnvelope<PurchaseResult>

    @POST("api/school/commerce/register")
    suspend fun registerCourse(@Body body: AcademyRegisterRequest): ApiEnvelope<PurchaseResult>
}
