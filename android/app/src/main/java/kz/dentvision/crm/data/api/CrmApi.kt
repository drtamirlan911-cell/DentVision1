package kz.dentvision.crm.data.api

import kz.dentvision.crm.data.model.Patient
import retrofit2.http.GET
import retrofit2.http.Query

/**
 * Маршруты кабинета клиники. Каждый метод здесь соответствует существующему
 * обработчику на бэкенде — новые эндпоинты не выдумываются, а список растёт
 * ровно по мере того, как появляются экраны, которые их зовут.
 *
 * `GET /api/patients` — `patients.routes.ts:118`, отвечает
 * `{ ok, data: { data: [...], pagination } }`.
 */
interface CrmApi {
    @GET("api/patients")
    suspend fun patients(
        @Query("limit") limit: Int = 200,
        @Query("page") page: Int? = null,
        @Query("search") search: String? = null,
    ): ApiEnvelope<Paged<Patient>>
}
