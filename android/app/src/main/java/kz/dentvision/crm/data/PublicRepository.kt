package kz.dentvision.crm.data

import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.api.apiCall
import kz.dentvision.crm.data.model.SchoolCourse
import kz.dentvision.crm.data.model.ShopProduct

/** Витрины, доступные без входа. */
class PublicRepository(private val api: ApiClient = ServiceLocator.api) {

    suspend fun products(search: String? = null): List<ShopProduct> =
        apiCall { api.public.products(search = search?.ifBlank { null }) }

    suspend fun courses(search: String? = null): List<SchoolCourse> =
        apiCall { api.public.courses(search = search?.ifBlank { null }) }
}
