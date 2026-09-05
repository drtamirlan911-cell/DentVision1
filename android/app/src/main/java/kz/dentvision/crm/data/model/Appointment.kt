package kz.dentvision.crm.data.model

import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.jsonPrimitive

/**
 * Приём в том виде, в каком его отдаёт `serializeAppointment`
 * (`dentvision-backend/src/modules/crm/appointmentMeta.ts:89`): дата уже
 * приведена к `ГГГГ-ММ-ДД`, время и длительность подставлены по умолчанию,
 * услуга и цена распакованы из `meta`.
 *
 * `status` здесь строка, а не перечисление: бэкенд считает статусом и колонку
 * БД, и `flowStatus` из `meta` (`arrived`, `in_chair`), а незнакомое значение с
 * сервера не должно ронять разбор всего ответа.
 */
@Serializable
data class Appointment(
    val id: String,
    val clinicId: String? = null,
    val patientId: String = "",
    val doctorId: String = "",
    val date: String = "",
    val time: String = "09:00",
    val duration: Int = 30,
    val status: String = "scheduled",
    val notes: String = "",
    val serviceName: String = "",
    val servicePrice: Double = 0.0,
    val paymentStatus: String = "unpaid",
    val diagnosis: String = "",
    @Serializable(with = LooseStringSerializer::class)
    val toothNumber: String = "",
    val reason: String = "",
    val chairName: String = "",
    val patientName: String? = null,
    val patientPhone: String? = null,
)

/**
 * Номер зуба приходит то строкой, то числом — в `meta` он лежит так, как его
 * положил тот, кто писал (`toothNumber?: string | number`). Читаем оба вида в
 * строку, вместо того чтобы падать на ответе, который бэкенд считает
 * нормальным.
 */
object LooseStringSerializer : KSerializer<String> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("LooseString", PrimitiveKind.STRING)

    override fun deserialize(decoder: Decoder): String {
        val input = decoder as? JsonDecoder ?: return decoder.decodeString()
        val element = input.decodeJsonElement()
        return runCatching { element.jsonPrimitive.content }.getOrDefault("")
    }

    override fun serialize(encoder: Encoder, value: String) = encoder.encodeString(value)
}

/** Человекочитаемые статусы приёма — те же, что показывает расписание в вебе. */
val APPOINTMENT_STATUS_LABELS: Map<String, String> = mapOf(
    "scheduled" to "Запланирован",
    "confirmed" to "Подтверждён",
    "arrived" to "Пришёл",
    "in_chair" to "В кресле",
    "reminderSent" to "Напоминание отправлено",
    "done" to "Завершён",
    "cancelled" to "Отменён",
    "noShow" to "Не пришёл",
)

/** Тело `POST /api/appointments` — поля те же, что шлёт `upsertAppointment` в вебе. */
@Serializable
data class AppointmentUpsert(
    val id: String? = null,
    val patientId: String,
    val doctorId: String,
    val date: String,
    val time: String,
    val duration: Int? = null,
    val status: String? = null,
    val serviceName: String? = null,
    val notes: String? = null,
    /** `unpaid`/`partial`/`paid` — то же поле, что уже читает GET, здесь пишется отдельно от `status`. */
    val paymentStatus: String? = null,
    /** Занятость увидена человеком и принята сознательно. */
    val force: Boolean? = null,
)

/** Ответ `GET /api/appointments/conflicts`. */
@Serializable
data class ConflictCheck(
    val hasConflict: Boolean = false,
    val conflicts: List<Appointment> = emptyList(),
)
