package kz.dentvision.crm.lib

import kz.dentvision.crm.data.model.Appointment
import kz.dentvision.crm.data.model.Doctor
import java.net.URLEncoder
import java.time.LocalDateTime
import java.time.format.DateTimeParseException

/**
 * Напоминания о приёме — перенос `src/utils/reminders.ts` в той части, что
 * касается записей.
 *
 * Гигиенические напоминания (пациенты без чистки полгода) сюда не перенесены
 * сознательно: чтобы их вычислить, надо сверить каждого пациента клиники со
 * всеми приёмами и всеми счетами. Это выгрузка всей истории клиники на
 * телефон — не то, что стоит делать ради списка на обзвон. Напоминание о
 * завтрашнем визите требует одного дня расписания, и оно здесь есть.
 */

/**
 * Статусы, при которых напоминать уместно. Пришедшему, отменившему и
 * завершившему приём напоминать не о чем.
 */
private val ELIGIBLE_STATUSES = setOf("scheduled", "confirmed", "pending", "remindersent")

fun isReminderEligible(status: String?): Boolean =
    ELIGIBLE_STATUSES.contains(status.orEmpty().lowercase())

/**
 * Приводит номер к международному виду: «8» в начале одиннадцатизначного
 * заменяется на «7», к десятизначному «7» дописывается. Так же делает веб.
 */
fun normalizePhone(phone: String?): String {
    var digits = (phone ?: "").filter { it.isDigit() }
    if (digits.startsWith("8") && digits.length == 11) digits = "7" + digits.substring(1)
    if (digits.length == 10) digits = "7$digits"
    return digits
}

fun buildWaLink(phone: String?, message: String): String =
    "https://wa.me/${normalizePhone(phone)}?text=${URLEncoder.encode(message, "UTF-8")}"

data class AppointmentReminder(
    /** Ключ журнала — тот же, что пишет веб, чтобы отметки совпадали. */
    val id: String,
    val appointment: Appointment,
    val doctorName: String,
    val message: String,
    val waLink: String,
    val sent: Boolean,
)

/** Текст сообщения — дословно тот же, что отправляет веб. */
fun reminderMessage(appointment: Appointment, doctorName: String): String {
    val patient = appointment.patientName ?: "пациент"
    val reasonLine = appointment.reason.takeIf { it.isNotBlank() }?.let { "📝 $it\n" } ?: ""
    return "Здравствуйте, $patient!\n\n" +
        "Напоминаем о вашей записи:\n" +
        "📅 ${appointment.date} в ${appointment.time}\n" +
        "👨‍⚕️ Врач: ${doctorName.ifBlank { "—" }}\n" +
        reasonLine +
        "\nЕсли не сможете прийти — сообщите заранее. Ждём вас!"
}

/**
 * Записи, попадающие в окно [сейчас + hoursMin, сейчас + hoursWindow].
 *
 * Нижняя граница нужна, чтобы не напоминать о приёме, который уже идёт.
 */
fun buildAppointmentReminders(
    appointments: List<Appointment>,
    doctors: List<Doctor>,
    sentKeys: Set<String>,
    now: LocalDateTime = LocalDateTime.now(),
    hoursWindow: Long = 24,
    hoursMin: Long = 0,
): List<AppointmentReminder> {
    val windowStart = now.plusHours(hoursMin)
    val windowEnd = now.plusHours(hoursWindow)

    return appointments
        .filter { isReminderEligible(it.status) }
        .mapNotNull { appointment ->
            val at = parseAt(appointment.date, appointment.time) ?: return@mapNotNull null
            if (at.isBefore(windowStart) || at.isAfter(windowEnd)) return@mapNotNull null
            val doctorName = doctors.firstOrNull { it.id == appointment.doctorId }?.name.orEmpty()
            val id = "appt_${appointment.id}"
            val message = reminderMessage(appointment, doctorName)
            AppointmentReminder(
                id = id,
                appointment = appointment,
                doctorName = doctorName,
                message = message,
                waLink = buildWaLink(appointment.patientPhone, message),
                sent = sentKeys.contains(id),
            )
        }
        .sortedBy { parseAt(it.appointment.date, it.appointment.time) }
}

private fun parseAt(date: String, time: String): LocalDateTime? = try {
    val safeTime = time.ifBlank { "00:00" }
    LocalDateTime.parse("${date}T$safeTime")
} catch (e: DateTimeParseException) {
    // Битую дату молча пропускаем: одна плохая строка не должна лишить
    // регистратуру всего списка на обзвон.
    null
}
