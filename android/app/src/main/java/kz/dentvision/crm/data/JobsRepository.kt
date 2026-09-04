package kz.dentvision.crm.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.api.ApiEnvelope
import kz.dentvision.crm.data.api.ApiException
import kz.dentvision.crm.data.model.ApplyJobRequest
import kz.dentvision.crm.data.model.CreateJobRequest
import kz.dentvision.crm.data.model.JobApplication
import kz.dentvision.crm.data.model.JobVacancy
import retrofit2.HttpException
import java.io.IOException
import java.net.SocketTimeoutException

/**
 * `POST /api/jobs`, `GET /api/jobs`, `POST /api/jobs/:id/apply` — как
 * `getJobs`/`createJob`/`applyToJob` в `src/utils/api.ts`. Ответы плоские
 * (см. `JobsApi.kt`), поэтому не через общий `apiCall` — тот разворачивает
 * `ApiEnvelope`, которого здесь нет; та же обёртка ошибок, что в
 * `GuestRepository`, просто не общая с ней функция (`toApiException()` в
 * `Calls.kt` приватная).
 */
class JobsRepository(private val api: ApiClient = ServiceLocator.api) {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun list(q: String, city: String): List<JobVacancy> = call { api.jobs.list(q.ifBlank { null }, city.ifBlank { null }) }

    suspend fun myApplications(): List<JobApplication> = call { api.jobs.myApplications() }

    suspend fun create(request: CreateJobRequest): JobVacancy = call { api.jobs.create(request) }

    suspend fun apply(vacancyId: String, coverNote: String = ""): JobApplication =
        call { api.jobs.apply(vacancyId, ApplyJobRequest(coverNote)) }

    private suspend fun <T> call(block: suspend () -> T): T = withContext(Dispatchers.IO) {
        try {
            block()
        } catch (e: HttpException) {
            throw e.toJobsApiException()
        } catch (e: SocketTimeoutException) {
            throw ApiException(
                status = 0,
                message = "Сервер не ответил вовремя. Если им давно не пользовались, ему нужно до минуты, чтобы проснуться — повторите попытку.",
            )
        } catch (e: IOException) {
            throw ApiException(status = 0, message = "Нет связи с сервером. Проверьте подключение.")
        }
    }

    private fun HttpException.toJobsApiException(): ApiException {
        val raw = runCatching { response()?.errorBody()?.string() }.getOrNull()
        val parsed = raw?.let {
            runCatching { json.decodeFromString(ApiEnvelope.serializer(JsonElement.serializer()), it) }.getOrNull()
        }
        return ApiException(status = code(), message = parsed?.error ?: "Ошибка сервера (${code()})", code = parsed?.code)
    }
}
