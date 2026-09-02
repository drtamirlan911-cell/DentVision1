package kz.dentvision.crm.lib

/**
 * ИИН — индивидуальный идентификационный номер РК: разбор, проверка и дата
 * рождения, которую он в себе несёт.
 *
 * Перенос `src/lib/iin.ts` (и зеркального ему `dentvision-backend/src/lib/iin.ts`)
 * буква в букву. Дублировать контрольную сумму — плата не бесплатная, но у
 * телефона нет права ждать ответа сервера, чтобы сказать «в номере опечатка»,
 * а общей сборки у Android и веба нет.
 *
 * Двенадцать цифр:
 *
 *   1-6   ГГММДД, дата рождения
 *   7     век и пол: 1/2 → 18xx, 3/4 → 19xx, 5/6 → 20xx; нечётная — мужской
 *   8-11  порядковый номер внутри этой даты
 *   12    контрольная цифра
 */

/**
 * Веса первого прохода по цифрам 1-11.
 *
 * Одиннадцатый вес равен 11, а 11 ≡ 0 (mod 11) — то есть **одиннадцатая цифра
 * на контрольную не влияет вовсе**. Это свойство стандарта, а не ошибка здесь,
 * и «чинить» его нельзя: более строгое правило начало бы отвергать настоящие,
 * выданные людям номера.
 *
 * Практическое следствие: сошедшаяся контрольная сумма не доказывает, что перед
 * вами тот самый человек — одна опечатка может дать корректный номер другого.
 * Поэтому дату из номера всегда стоит сверять с датой рождения в карте, а сам
 * номер никогда не считать удостоверением личности.
 */
private val WEIGHTS_PRIMARY = intArrayOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11)

/** Нужны только когда первый проход дал 10 — такой контрольной цифры не бывает. */
private val WEIGHTS_SECONDARY = intArrayOf(3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2)

enum class IinSex { MALE, FEMALE }

data class IinDetails(
    val iin: String,
    /** ГГГГ-ММ-ДД. */
    val birthDate: String,
    val sex: IinSex,
)

/** Только цифры. Пробелы и дефисы, которые вставляют при копировании, отбрасываются. */
fun normalizeIin(raw: String?): String = (raw ?: "").filter { it.isDigit() }

private fun checkDigitFor(digits: IntArray): Int? {
    fun weighted(weights: IntArray): Int {
        var sum = 0
        for (i in weights.indices) sum += weights[i] * digits[i]
        return sum % 11
    }

    val first = weighted(WEIGHTS_PRIMARY)
    if (first != 10) return first

    // 10 в одну цифру не записать, поэтому стандарт пересчитывает со сдвинутым
    // набором весов. Если и там 10 — такой номер выдать нельзя.
    val second = weighted(WEIGHTS_SECONDARY)
    return if (second == 10) null else second
}

/**
 * Дата, зашитая в цифры 1-7, или `null`, если они не описывают существующий
 * день календаря. Проверяется отдельно: контрольная сумма на дату не смотрит
 * вовсе и спокойно пропускает `999999`.
 */
fun iinBirthDate(raw: String?): String? {
    val iin = normalizeIin(raw)
    if (iin.length != 12) return null

    val centurySex = iin[6] - '0'
    if (centurySex < 1 || centurySex > 6) return null

    val century = if (centurySex <= 2) 1800 else if (centurySex <= 4) 1900 else 2000
    val year = century + iin.substring(0, 2).toInt()
    val month = iin.substring(2, 4).toInt()
    val day = iin.substring(4, 6).toInt()

    if (month < 1 || month > 12) return null
    if (day < 1 || day > 31) return null
    // Отсекает 31 апреля и 29 февраля в невисокосный год.
    if (day > daysInMonth(year, month)) return null

    return "%04d-%02d-%02d".format(year, month, day)
}

private fun daysInMonth(year: Int, month: Int): Int = when (month) {
    1, 3, 5, 7, 8, 10, 12 -> 31
    4, 6, 9, 11 -> 30
    2 -> if (isLeapYear(year)) 29 else 28
    else -> 0
}

private fun isLeapYear(year: Int): Boolean =
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0

fun iinSex(raw: String?): IinSex? {
    val iin = normalizeIin(raw)
    if (iin.length != 12) return null
    val centurySex = iin[6] - '0'
    if (centurySex < 1 || centurySex > 6) return null
    return if (centurySex % 2 == 1) IinSex.MALE else IinSex.FEMALE
}

/**
 * Формат, дата и контрольная цифра — все три, потому что каждая ловит то, что
 * пропускают остальные: сумма ловит переставленную пару, дата — правдоподобную,
 * но невозможную дату рождения, длина — обрезанную вставку.
 */
fun isValidIin(raw: String?): Boolean {
    val iin = normalizeIin(raw)
    if (iin.length != 12) return false
    if (iinBirthDate(iin) == null) return false

    val digits = IntArray(12) { iin[it] - '0' }
    val expected = checkDigitFor(digits.copyOfRange(0, 11))
    return expected != null && expected == digits[11]
}

/** Всё, что номер в себе несёт, или `null`, если это не ИИН. */
fun parseIin(raw: String?): IinDetails? {
    val iin = normalizeIin(raw)
    if (!isValidIin(iin)) return null
    val birthDate = iinBirthDate(iin) ?: return null
    val sex = iinSex(iin) ?: return null
    return IinDetails(iin = iin, birthDate = birthDate, sex = sex)
}

/** Дописывает контрольную цифру к 11-значному префиксу. Используется тестами. */
fun completeIin(prefix: String): String? {
    val digits = normalizeIin(prefix)
    if (digits.length != 11) return null
    val check = checkDigitFor(IntArray(11) { digits[it] - '0' }) ?: return null
    return "$digits$check"
}
