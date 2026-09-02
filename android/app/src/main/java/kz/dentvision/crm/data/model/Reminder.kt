package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/** Строка журнала (`GET /api/crm/reminders/sent`). */
@Serializable
data class SentReminder(
    val reminderKey: String,
    val channel: String? = null,
    val sentAt: String? = null,
)

@Serializable
data class MarkReminderSent(
    val reminderKey: String,
    val channel: String = "whatsapp",
)
