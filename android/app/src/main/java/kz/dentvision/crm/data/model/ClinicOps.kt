package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * Настройки клиники (`GET/PUT /api/clinics/:id/settings`).
 *
 * Поля — подмножество `ClinicSettingsPayload` (`modules/clinics/clinicSettings.ts:22`):
 * то, что относится к ежедневной работе кабинета. Остальное — платежи,
 * интеграции, разбор автосписаний — на телефоне не редактируется, и полей под
 * него здесь нет, чтобы не отправить `null` туда, где сервер ждёт настройку.
 *
 * PUT на сервере сливает присланное с лежащим (`mergeClinicSettings`), поэтому
 * частичная отправка безопасна: то, чего здесь нет, не пропадёт.
 */
@Serializable
data class ClinicSettings(
    val timezone: String? = null,
    val currency: String? = null,
    val workStart: String? = null,
    val workEnd: String? = null,
    val workDays: List<Int> = emptyList(),
    val lunchStart: String? = null,
    val lunchEnd: String? = null,
    val reminderHours: Int? = null,
    val hygieneMonths: Int? = null,
    val bookingSlotMinutes: Int? = null,
    val defaultAppointmentDuration: Int? = null,
    val overbookingAllowed: Boolean? = null,
    val requireChair: Boolean? = null,
    val onlineBookingEnabled: Boolean? = null,
    /** `warn` или `block` — что делать при пересечении в расписании. */
    val scheduleConflictMode: String? = null,
    val diagnostics: DiagnosticsSettings? = null,
)

/**
 * Значения по умолчанию для новых направлений диагностики — подобъект
 * `ClinicSettingsPayload.diagnostics` (`clinicSettings.ts:83`). Сервер
 * сливает верхнеуровневые ключи целиком (`Object.assign`, не глубоко), так
 * что сохранение шлёт все четыре поля разом, а не частично — частичный
 * объект здесь стёр бы остальные значения этого подобъекта.
 */
@Serializable
data class DiagnosticsSettings(
    /** `"3D"` или `"LABORATORY"`. */
    val defaultCategory: String? = null,
    val notifyOnStatusChange: Boolean? = null,
    val autoAssignCenter: Boolean? = null,
    val requirePriority: Boolean? = null,
)

@Serializable
data class ClinicSettingsResponse(
    val clinic: Clinic? = null,
    val settings: ClinicSettings = ClinicSettings(),
)

/** Подписка клиники (`GET /api/clinic-billing/me`). */
@Serializable
data class ClinicBilling(
    val clinicId: String? = null,
    val plan: String? = null,
    val status: String? = null,
    val periodEnd: String? = null,
)

val BILLING_STATUS_LABELS: Map<String, String> = mapOf(
    "trial" to "Пробный период",
    "active" to "Активна",
    "past_due" to "Просрочена",
    "canceled" to "Отменена",
    "expired" to "Истекла",
)

/** Сценарий автоматизации (`GET /api/workflows`). */
@Serializable
data class Workflow(
    val id: String,
    val name: String = "",
    val trigger: String = "",
    val status: String = "",
    val createdAt: String? = null,
)
