package kz.dentvision.crm.data.api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import retrofit2.HttpException
import java.io.IOException
import java.net.SocketTimeoutException

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
    } catch (e: SocketTimeoutException) {
        // Таймаут и отсутствие сети — разные беды, и лечатся по-разному.
        // Сервер на Render засыпает без нагрузки, поэтому первый запрос после
        // долгого перерыва может не уложиться в минуту. Сказать здесь «нет
        // связи» значит отправить человека проверять телефон, когда проверять
        // нечего: надо просто повторить.
        throw ApiException(
            status = 0,
            message = "Сервер не ответил вовремя. Если им давно не пользовались, ему нужно до минуты, чтобы проснуться — повторите попытку.",
        )
    } catch (e: IOException) {
        throw ApiException(status = 0, message = "Нет связи с сервером. Проверьте подключение.")
    } catch (e: SerializationException) {
        // Конверт разобрался, а форма `data` — нет: несовпадение модели с
        // бэкендом. Сырое сообщение kotlinx (английское, с путём в JSON)
        // человеку не показываем — оно не про то, что случилось, а про то,
        // как это устроено внутри.
        throw ApiException(status = 200, message = "Сервер вернул данные в неожиданном формате. Мы уже знаем об этом.")
    }
    if (!envelope.ok) {
        throw ApiException(status = 200, message = envelope.error ?: "Неизвестная ошибка", code = envelope.code)
    }
    envelope.data ?: throw ApiException(status = 200, message = envelope.error ?: "Сервер вернул пустой ответ")
}

/**
 * Как [apiCall], но для маршрутов, что при успехе честно шлют `data: null`
 * (`stock-rules`/`marketing content-plans` delete отвечают именно так) —
 * там нечего возвращать, и требовать непустой `data`, как это делает
 * [apiCall], значило бы принимать успешное удаление за ошибку сервера.
 */
suspend fun apiCallUnit(block: suspend () -> ApiEnvelope<*>): Unit = withContext(Dispatchers.IO) {
    val envelope = try {
        block()
    } catch (e: HttpException) {
        throw e.toApiException()
    } catch (e: SocketTimeoutException) {
        throw ApiException(
            status = 0,
            message = "Сервер не ответил вовремя. Если им давно не пользовались, ему нужно до минуты, чтобы проснуться — повторите попытку.",
        )
    } catch (e: IOException) {
        throw ApiException(status = 0, message = "Нет связи с сервером. Проверьте подключение.")
    } catch (e: SerializationException) {
        throw ApiException(status = 200, message = "Сервер вернул данные в неожиданном формате. Мы уже знаем об этом.")
    }
    if (!envelope.ok) {
        throw ApiException(status = 200, message = envelope.error ?: "Неизвестная ошибка", code = envelope.code)
    }
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
