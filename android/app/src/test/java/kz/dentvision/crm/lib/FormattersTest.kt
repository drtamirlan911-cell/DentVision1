package kz.dentvision.crm.lib

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Форматтеры обязаны совпадать с вебом посимвольно — расхождение здесь
 * означает, что одна и та же сумма, дата или телефон выглядят на телефоне
 * иначе, чем в браузере у того же сотрудника, а заметить это можно только
 * положив два экрана рядом.
 *
 * Эталоны взяты из `src/lib/utils.ts` (`fd`) и `src/utils/formatters.ts`
 * (`formatPhone`).
 */
class FormattersTest {

    @Test
    fun `дата день-первый, как fd() в src-lib-utils`() {
        assertEquals("17.08.2026", formatDate("2026-08-17T09:10:00Z"))
        assertEquals("17.08.2026", formatDate("2026-08-17"))
        assertNull(formatDate(null))
        assertNull(formatDate(""))
        assertNull(formatDate("мусор"))
    }

    @Test
    fun `телефон как formatPhone в src-utils-formatters`() {
        assertEquals("+7 (777) 123-45-67", formatPhone("77771234567"))
        assertEquals("+7 (777) 123-45-67", formatPhone("87771234567"))
        assertEquals("+7 (777) 123-45-67", formatPhone("7771234567"))
        assertEquals("+7 (777) 123-45-67", formatPhone("+7 777 123 45 67"))
        assertNull(formatPhone(null))
        assertNull(formatPhone(""))
    }

    /**
     * Нераспознанный номер возвращается как есть — веб делает ровно так же
     * (`return phone`). Молча показать обрезок было бы хуже, чем показать
     * то, что реально лежит в карточке.
     */
    @Test
    fun `непонятный номер отдаётся сырым, а не обрезается`() {
        assertEquals("123", formatPhone("123"))
        assertEquals("+1 202 555 0143", formatPhone("+1 202 555 0143"))
    }

    /**
     * Разделитель разрядов — неразрывный пробел (U+00A0), чтобы сумма не
     * переносилась посреди числа. Обычный пробел здесь — ошибка.
     */
    @Test
    fun `тенге с неразрывным пробелом и символом в конце`() {
        assertEquals("12 500 ₸", formatTenge(12500))
        assertEquals("1 200 000 ₸", formatTenge(1200000))
        assertEquals("0 ₸", formatTenge(0))
        assertEquals("0 ₸", formatTenge(null))
    }
}
