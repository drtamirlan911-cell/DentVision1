package kz.dentvision.crm.data.api

/**
 * Ошибка API в том же виде, в каком её бросает `apiRequest` в вебе: текст для
 * человека из поля `error`, плюс HTTP-статус и код, если бэкенд его прислал.
 */
class ApiException(
    val status: Int,
    override val message: String,
    val code: String? = null,
) : Exception(message)

/** Сессия истекла и обновиться не смогла — надо заново входить. */
class SessionExpiredException : Exception("Сессия истекла. Войдите заново.")
