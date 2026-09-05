package kz.dentvision.crm.data.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Общий конверт бэкенда — `{ ok, data, error }`. Ровно тот же, что разбирает
 * `apiRequest` в `src/utils/api.ts`: при `ok: false` в `error` лежит текст для
 * человека, а не код.
 */
@Serializable
data class ApiEnvelope<T>(
    val ok: Boolean = true,
    val data: T? = null,
    val error: String? = null,
    val code: String? = null,
)

/**
 * Постраничный ответ (`paginatedResponse` в `dentvision-backend/src/lib/helpers.ts`):
 * список лежит вложенным в `data`, рядом — счётчики. Веб распаковывает его
 * функцией `collection()`, здесь это делает тип.
 */
@Serializable
data class Paged<T>(
    val data: List<T> = emptyList(),
    val pagination: Pagination? = null,
)

@Serializable
data class Pagination(
    val page: Int = 1,
    val limit: Int = 0,
    val total: Int = 0,
    @SerialName("pages") val pageCount: Int = 0,
)
