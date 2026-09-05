package kz.dentvision.crm.data.api

import kz.dentvision.crm.data.model.ApplyJobRequest
import kz.dentvision.crm.data.model.CreateJobRequest
import kz.dentvision.crm.data.model.JobApplication
import kz.dentvision.crm.data.model.JobVacancy
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * `dentvision-backend/src/modules/jobs/jobs.routes.ts`. Ответы плоские, не
 * `ApiEnvelope` — см. `Jobs.kt`. Список и поиск открыты `optionalAuth`
 * (виден гостю), отклики/публикация/список своих откликов — `authenticate`.
 */
interface JobsApi {
    @GET("api/jobs")
    suspend fun list(@Query("q") q: String? = null, @Query("city") city: String? = null): List<JobVacancy>

    @GET("api/jobs/me/applications")
    suspend fun myApplications(): List<JobApplication>

    @POST("api/jobs")
    suspend fun create(@Body body: CreateJobRequest): JobVacancy

    @POST("api/jobs/{id}/apply")
    suspend fun apply(@Path("id") id: String, @Body body: ApplyJobRequest): JobApplication
}
