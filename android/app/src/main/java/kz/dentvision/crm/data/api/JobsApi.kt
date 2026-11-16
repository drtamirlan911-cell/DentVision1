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
 * `dentvision-backend/src/modules/jobs/jobs.routes.ts`. Список, отклики
 * и свои отклики возвращаются плоскими ответами; создание резюме обёрнуто
 * в `ApiEnvelope`. `POST /api/jobs` разрешён только для резюме; публикация
 * вакансии идёт через legal-gated employer endpoint, пока не подключённый в Android.
 */
interface JobsApi {
    @GET("api/jobs")
    suspend fun list(@Query("q") q: String? = null, @Query("city") city: String? = null): List<JobVacancy>

    @GET("api/jobs/me/applications")
    suspend fun myApplications(): List<JobApplication>

    @POST("api/jobs")
    suspend fun create(@Body body: CreateJobRequest): ApiEnvelope<JobVacancy>

    @POST("api/jobs/{id}/apply")
    suspend fun apply(@Path("id") id: String, @Body body: ApplyJobRequest): JobApplication
}
