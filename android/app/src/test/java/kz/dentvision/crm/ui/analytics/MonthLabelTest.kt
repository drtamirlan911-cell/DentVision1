package kz.dentvision.crm.ui.analytics

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Ось из двенадцати месяцев и подпись выбранного столбца. Сервер отдаёт ключ
 * `YYYY-MM`; ошибка здесь означает, что человек читает выручку не за тот месяц.
 */
class MonthLabelTest {

    @Test
    fun `короткая подпись оси`() {
        assertEquals("янв", shortMonth("2026-01"))
        assertEquals("сен", shortMonth("2026-09"))
        assertEquals("дек", shortMonth("2026-12"))
    }

    @Test
    fun `полная подпись выбранного столбца несёт год`() {
        assertEquals("Сентябрь 2026", longMonth("2026-09"))
        assertEquals("Январь 2025", longMonth("2025-01"))
    }

    /**
     * Неожиданный ключ показывается как есть, а не подменяется соседним
     * месяцем: увидеть сырую строку честнее, чем неверную дату.
     */
    @Test
    fun `непонятный ключ отдаётся сырым`() {
        assertEquals("мусор", shortMonth("мусор"))
        assertEquals("2026-13", shortMonth("2026-13"))
        assertEquals("2026-00", longMonth("2026-00"))
        assertEquals("", shortMonth(""))
    }
}
