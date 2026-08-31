package kz.dentvision.crm.data.api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import retrofit2.HttpException
import java.io.IOException

private val errorJson = Json { ignoreUnknownKeys = true }

/**
 * Разворачивает конверт так же, как это делает `apiRequest`: при `ok: false`
 * или не-2xx бросает [ApiException] с текстом из поля `error`, потому что этот
 * текст бэкенд уже написал по-русски и для человека.
 *
 * Обрыв связи отдельным сообщением: «HTTP -1» посреди приёма не говорит
 * администратору ничего, а «нет связи с сервером» говорит.
 */
suspend fun <T> apiCall(block: suspend () -> ApiEnvelope<T>): T = withContext(Dispatchers.IO) {
    val envelope = try {
        block()
    } catch (e: HttpException) {
        throw e.toApiException()
    } catch (e: IOException) {
        throw ApiException(status = 0, message = "Нет связи с сервером. Проверьте подключение.")
    }
    if (!envelope.ok) {
        throw ApiException(status = 200, message = envelope.error ?: "Неизвестная ошибка", code = envelope.code)
    }
    envelope.data ?: throw ApiException(status = 200, message = envelope.error ?: "Сервер вернул пустой ответ")
}

private fun HttpException.toApiException(): ApiException {
    val raw = runCatching { response()?.errorBody()?.string() }.getOrNull()
    val parsed = raw?.let {
        runCatching {
            errorJson.decodeFromString(ApiEnvelope.serializer(kotlinx.serialization.json.JsonElement.serializer()), it)
        }.getOrNull()
    }
    return ApiException(
        status = code(),
        message = parsed?.error ?: "Ошибка сервера (${code()})",
        code = parsed?.code,
    )
}
