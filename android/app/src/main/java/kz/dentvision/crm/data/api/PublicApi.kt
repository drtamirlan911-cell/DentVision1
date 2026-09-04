package kz.dentvision.crm.data.api

import kz.dentvision.crm.data.model.RegistrationRequest
import kz.dentvision.crm.data.model.SchoolCourse
import kz.dentvision.crm.data.model.ShopCategory
import kz.dentvision.crm.data.model.ShopProduct
import kz.dentvision.crm.data.model.SubmitRegistrationRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

/**
 * То, что платформа отдаёт кому угодно — без входа и без регистрации.
 *
 * Здесь только маршруты, на которых на бэкенде **нет** `authenticate`. Список
 * не подбирался на глаз: он получен обходом роутеров, и каждый метод ниже
 * соответствует обработчику, который открыт по факту, а не по замыслу.
 *
 * Перехватчик всё равно подставит Bearer, если человек уже вошёл, — это не
 * мешает: открытые маршруты просто не смотрят на заголовок.
 */
interface PublicApi {

    @GET("api/shop/products")
    suspend fun products(
        @Query("search") search: String? = null,
        @Query("category") category: String? = null,
        @Query("limit") limit: Int = 60,
    ): ApiEnvelope<List<ShopProduct>>

    @GET("api/shop/categories")
    suspend fun categories(): ApiEnvelope<List<ShopCategory>>

    @GET("api/school/courses")
    suspend fun courses(
        @Query("search") search: String? = null,
        @Query("category") category: String? = null,
    ): ApiEnvelope<List<SchoolCourse>>

    /** `diagnosticsRouter.post('/register', optionalAuth, ...)` — до `authenticate`. */
    @POST("api/diagnostics/register")
    suspend fun registerDiagnostics(@Body body: SubmitRegistrationRequest): ApiEnvelope<RegistrationRequest>
}
