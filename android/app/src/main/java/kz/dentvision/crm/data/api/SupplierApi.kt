package kz.dentvision.crm.data.api

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
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

/**
 * Кабинет продавца — `dentvision-backend/src/modules/supplier-workspace/workspace.routes.ts`.
 * Все маршруты требуют `authenticate` + активное пространство SUPPLIER
 * (`req.user.supplierId`), а не отдельный токен-параметр, как на вебе
 * (`supplierWs.*(token, …)` там держит скоуп-токен в стейте экрана, не
 * трогая глобальную сессию). Android наоборот: переключение пространства
 * (`WorkspaceRepository.switchTo`) целиком заменяет токены в `SessionStore`,
 * тем же путём, что уже работает для DIAGNOSTIC_CENTER/LABORATORY — поэтому
 * здесь достаточно обычных вызовов, `AuthInterceptor` сам подставит
 * актуальный (уже переключённый) Bearer.
 */
interface SupplierApi {

    @GET("api/supplier/me")
    suspend fun me(): ApiEnvelope<Supplier>

    @PATCH("api/supplier/me")
    suspend fun updateMe(@Body body: UpdateSupplierProfileRequest): ApiEnvelope<Supplier>

    @GET("api/supplier/dashboard")
    suspend fun dashboard(): ApiEnvelope<SupplierDashboard>

    @GET("api/supplier/cashback-rules")
    suspend fun cashbackRules(): ApiEnvelope<List<SupplierCashbackRule>>

    @PUT("api/supplier/cashback-rules")
    suspend fun upsertCashbackRule(@Body body: UpsertCashbackRuleRequest): ApiEnvelope<SupplierCashbackRule>

    @POST("api/supplier/products")
    suspend fun createProduct(@Body body: CreateSupplierProductRequest): ApiEnvelope<SupplierProduct>

    @PATCH("api/supplier/products/{id}")
    suspend fun updateProduct(@Path("id") id: String, @Body body: UpdateSupplierProductRequest): ApiEnvelope<SupplierProduct>

    @DELETE("api/supplier/products/{id}")
    suspend fun deleteProduct(@Path("id") id: String): ApiEnvelope<Unit>

    @PATCH("api/supplier/orders/{id}/status")
    suspend fun updateOrderStatus(@Path("id") id: String, @Body body: UpdateOrderStatusRequest): ApiEnvelope<SupplierOrder>

    @POST("api/supplier/promotions")
    suspend fun createPromotion(@Body body: CreatePromotionRequest): ApiEnvelope<SupplierPromotion>

    @POST("api/supplier/payouts")
    suspend fun requestPayout(@Body body: RequestSupplierPayoutRequest): ApiEnvelope<Unit>

    /** `suppliers.routes.ts` — не под общим префиксом маршрутов кабинета: до входа в него ещё нечего скоупить. */
    @POST("api/suppliers/register")
    suspend fun register(@Body body: RegisterSupplierRequest): ApiEnvelope<Supplier>
}
