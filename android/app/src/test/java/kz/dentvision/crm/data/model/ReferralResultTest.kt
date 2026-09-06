package kz.dentvision.crm.data.model

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * `result` в ответе `GET /api/diagnostics/referrals/:id`. Раньше сервер
 * выбирал только `id`/`aiGenerated`/`createdAt`, и направивший врач видел
 * «заключение готово», а прочитать само заключение не мог ни на вебе, ни на
 * телефоне. Тест ловит регресс к прежнему усечённому виду.
 */
class ReferralResultTest {

    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `текст заключения и вывод разбираются`() {
        val body = """
            {"id":"res1","aiGenerated":true,"createdAt":"2026-09-01T10:00:00Z",
             "reportText":"Периапикальное разрежение у 16","conclusion":"Рекомендовано лечение",
             "pdfUrl":"https://example.com/r.pdf","signedAt":"2026-09-02T08:00:00Z"}
        """.trimIndent()
        val result = json.decodeFromString(ReferralResultBrief.serializer(), body)
        assertEquals("Периапикальное разрежение у 16", result.reportText)
        assertEquals("Рекомендовано лечение", result.conclusion)
        assertEquals("https://example.com/r.pdf", result.pdfUrl)
        assertEquals("2026-09-02T08:00:00Z", result.signedAt)
    }

    /** Ещё не подписанный результат — только служебные поля, и это не ошибка. */
    @Test
    fun `результат без текста разбирается, а не падает`() {
        val body = """{"id":"res1","aiGenerated":false,"createdAt":"2026-09-01T10:00:00Z"}"""
        val result = json.decodeFromString(ReferralResultBrief.serializer(), body)
        assertNull(result.reportText)
        assertNull(result.conclusion)
    }
}
