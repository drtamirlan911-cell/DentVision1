package kz.dentvision.crm.lib

/**
 * Телефон для показа: «+7 (777) 123-45-67» — тот же вид, что даёт
 * `formatPhone` в `src/utils/formatters.ts`.
 *
 * Ведущая восьмёрка и запись без кода страны приводятся к «7…» по тому же
 * правилу, по которому платформа считает номера одинаковыми при отправке
 * напоминаний (`normalizePhone` здесь же, в `Reminders.kt`). Нераспознанный
 * формат возвращается как есть: лучше показать сырую строку, чем потерять
 * номер.
 *
 * Это только для показа. Там, где номер уходит в `tel:`, `wa.me` или в тело
 * запроса, нужен `normalizePhone` — голые цифры без скобок и дефисов.
 */
fun formatPhone(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    val digits = raw.filter { it.isDigit() }
    val normalized = when {
        digits.length == 11 && digits.startsWith("8") -> "7" + digits.drop(1)
        digits.length == 10 -> "7$digits"
        else -> digits
    }
    if (normalized.length != 11 || !normalized.startsWith("7")) return raw
    return "+7 (${normalized.substring(1, 4)}) ${normalized.substring(4, 7)}-" +
        "${normalized.substring(7, 9)}-${normalized.substring(9, 11)}"
}
