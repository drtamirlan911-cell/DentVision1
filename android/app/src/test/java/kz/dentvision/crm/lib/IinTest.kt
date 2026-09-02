package kz.dentvision.crm.lib

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Проверка не «на глазок»: все ожидаемые значения ниже получены прогоном
 * настоящего `src/lib/iin.ts` из этого же репозитория. Если Kotlin разойдётся с
 * TypeScript, тест упадёт — а разойтись им нельзя, иначе телефон и браузер
 * начнут по-разному отвечать на один и тот же номер.
 */
class IinTest {

    @Test
    fun `контрольная цифра совпадает с вебом`() {
        assertEquals("900101300017", completeIin("90010130001"))
        assertEquals("001229501237", completeIin("00122950123"))
        assertEquals("850731254678", completeIin("85073125467"))
        assertEquals("991231456789", completeIin("99123145678"))
        assertEquals("500101200017", completeIin("50010120001"))
        assertEquals("200229600125", completeIin("20022960012"))
        assertEquals("960430102030", completeIin("96043010203"))
    }

    @Test
    fun `дата и пол читаются из номера`() {
        assertEquals("1990-01-01", iinBirthDate("900101300017"))
        assertEquals(IinSex.MALE, iinSex("900101300017"))

        assertEquals("2000-12-29", iinBirthDate("001229501237"))
        assertEquals(IinSex.MALE, iinSex("001229501237"))

        // 1/2 в седьмой цифре — девятнадцатый век; такие номера есть.
        assertEquals("1885-07-31", iinBirthDate("850731254678"))
        assertEquals(IinSex.FEMALE, iinSex("850731254678"))

        assertEquals("1850-01-01", iinBirthDate("500101200017"))
        assertEquals("1999-12-31", iinBirthDate("991231456789"))
    }

    @Test
    fun `29 февраля проходит в високосный год и не проходит в обычный`() {
        assertEquals("2020-02-29", iinBirthDate("200229600125"))
        assertTrue(isValidIin("200229600125"))

        // 2002 не високосный: контрольная сумма сходится, а дня такого нет.
        assertNull(iinBirthDate("020229600008"))
        assertFalse(isValidIin("020229600008"))
    }

    @Test
    fun `31 апреля не существует`() {
        assertNull(iinBirthDate("960431102030"))
        assertEquals("1896-04-30", iinBirthDate("960430102030"))
    }

    @Test
    fun `негодные номера отвергаются`() {
        // Седьмая цифра вне 1..6 — века такого нет.
        assertFalse(isValidIin("123456789012"))
        assertNull(iinBirthDate("123456789012"))

        // Дата настоящая, контрольная цифра — нет.
        assertFalse(isValidIin("900101300010"))
        assertEquals("1990-01-01", iinBirthDate("900101300010"))

        // Обрезанная вставка.
        assertFalse(isValidIin("9001013000"))
        assertNull(iinBirthDate("9001013000"))

        assertFalse(isValidIin("000000700001"))
        assertFalse(isValidIin("900231300012"))
        assertFalse(isValidIin(null))
        assertFalse(isValidIin(""))
    }

    @Test
    fun `пробелы и дефисы отбрасываются`() {
        assertEquals("900101300017", normalizeIin("900101-300 017"))
        assertTrue(isValidIin("900101-300 017"))
    }

    @Test
    fun `parseIin отдаёт всё сразу`() {
        val parsed = parseIin("900101300017")
        assertEquals("900101300017", parsed?.iin)
        assertEquals("1990-01-01", parsed?.birthDate)
        assertEquals(IinSex.MALE, parsed?.sex)
        assertNull(parseIin("900101300010"))
    }

    @Test
    fun `одиннадцатая цифра на контрольную не влияет`() {
        // Свойство стандарта: вес одиннадцатой позиции равен 11, а 11 ≡ 0 (mod 11).
        // Тест фиксирует его как факт, чтобы никто не «починил» его позже.
        assertTrue(isValidIin("900101300017"))
        assertTrue(isValidIin("900101300097"))
    }
}
