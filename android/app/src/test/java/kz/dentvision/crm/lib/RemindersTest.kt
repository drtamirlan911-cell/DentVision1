package kz.dentvision.crm.lib

import kz.dentvision.crm.data.model.Appointment
import kz.dentvision.crm.data.model.Doctor
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime

/**
 * Список на обзвон — та логика, ошибка в которой не видна: пациенту просто не
 * позвонят, и никто не узнает почему. Поэтому окно, статусы и текст сообщения
 * закреплены тестом.
 */
class RemindersTest {

    private val now = LocalDateTime.of(2026, 3, 10, 9, 0)

    private fun appointment(
        id: String,
        date: String,
        time: String,
        status: String = "scheduled",
        doctorId: String = "d1",
    ) = Appointment(
        id = id,
        patientId = "p1",
        doctorId = doctorId,
        date = date,
        time = time,
        status = status,
        patientName = "Айгуль Сериковна",
        patientPhone = "87001234567",
    )

    private val doctors = listOf(Doctor(id = "d1", name = "Иван Петров", spec = "Терапевт"))

    @Test
    fun `в окно попадают только записи ближайших суток`() {
        val result = buildAppointmentReminders(
            appointments = listOf(
                appointment("a1", "2026-03-10", "14:00"), // сегодня днём — да
                appointment("a2", "2026-03-11", "08:00"), // завтра утром — да
                appointment("a3", "2026-03-11", "10:00"), // за границей суток — нет
                appointment("a4", "2026-03-10", "08:00"), // уже прошло — нет
            ),
            doctors = doctors,
            sentKeys = emptySet(),
            now = now,
        )
        assertEquals(listOf("appt_a1", "appt_a2"), result.map { it.id })
    }

    @Test
    fun `пришедшему и отменившему не напоминают`() {
        val result = buildAppointmentReminders(
            appointments = listOf(
                appointment("a1", "2026-03-10", "14:00", status = "scheduled"),
                appointment("a2", "2026-03-10", "15:00", status = "confirmed"),
                appointment("a3", "2026-03-10", "16:00", status = "reminderSent"),
                appointment("a4", "2026-03-10", "17:00", status = "cancelled"),
                appointment("a5", "2026-03-10", "18:00", status = "done"),
                appointment("a6", "2026-03-10", "19:00", status = "arrived"),
            ),
            doctors = doctors,
            sentKeys = emptySet(),
            now = now,
        )
        assertEquals(listOf("appt_a1", "appt_a2", "appt_a3"), result.map { it.id })
    }

    @Test
    fun `список отсортирован по времени приёма`() {
        val result = buildAppointmentReminders(
            appointments = listOf(
                appointment("late", "2026-03-10", "18:00"),
                appointment("early", "2026-03-10", "10:00"),
                appointment("mid", "2026-03-10", "14:00"),
            ),
            doctors = doctors,
            sentKeys = emptySet(),
            now = now,
        )
        assertEquals(listOf("appt_early", "appt_mid", "appt_late"), result.map { it.id })
    }

    @Test
    fun `отметка из журнала переносится на напоминание`() {
        val result = buildAppointmentReminders(
            appointments = listOf(
                appointment("a1", "2026-03-10", "14:00"),
                appointment("a2", "2026-03-10", "15:00"),
            ),
            doctors = doctors,
            sentKeys = setOf("appt_a1"),
            now = now,
        )
        assertTrue(result.first { it.id == "appt_a1" }.sent)
        assertFalse(result.first { it.id == "appt_a2" }.sent)
    }

    @Test
    fun `битая дата не роняет весь список`() {
        val result = buildAppointmentReminders(
            appointments = listOf(
                appointment("bad", "не-дата", "14:00"),
                appointment("good", "2026-03-10", "14:00"),
            ),
            doctors = doctors,
            sentKeys = emptySet(),
            now = now,
        )
        assertEquals(listOf("appt_good"), result.map { it.id })
    }

    @Test
    fun `номер приводится к международному виду`() {
        assertEquals("77001234567", normalizePhone("8 700 123-45-67"))
        assertEquals("77001234567", normalizePhone("+7 (700) 123 45 67"))
        assertEquals("77001234567", normalizePhone("7001234567"))
        assertEquals("", normalizePhone(null))
    }

    @Test
    fun `в сообщении есть имя, дата, время и врач`() {
        val message = reminderMessage(appointment("a1", "2026-03-11", "14:30"), "Иван Петров")
        assertTrue(message.contains("Айгуль Сериковна"))
        assertTrue(message.contains("2026-03-11 в 14:30"))
        assertTrue(message.contains("Иван Петров"))
    }

    @Test
    fun `ссылка WhatsApp несёт нормализованный номер и текст`() {
        val link = buildWaLink("8 700 123-45-67", "Привет")
        assertTrue(link.startsWith("https://wa.me/77001234567?text="))
        assertTrue(link.contains("%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82"))
    }
}
