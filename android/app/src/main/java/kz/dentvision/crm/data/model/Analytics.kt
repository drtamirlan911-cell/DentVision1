package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * Сводка клиники — `GET /api/analytics/dashboard`.
 *
 * Четыре числа, а не график: у каждого одно значение и нет ряда, который можно
 * было бы отложить по оси. Столбик из одного столбца — это не диаграмма, это
 * число, нарисованное дорогим способом.
 */
@Serializable
data class AnalyticsSummary(
    val totalPatients: Int = 0,
    val appointmentsToday: Int = 0,
    /**
     * Сервер считает выручку через SQL-SUM и отдаёт дробным числом. Держим
     * `Double`, чтобы не потерять копейки при разборе, и округляем только на
     * показе — цена в тенге всё равно целая.
     */
    val revenueThisMonth: Double = 0.0,
    val activeLabOrders: Int = 0,
)

/** Точка помесячного ряда: `2026-09`. Сервер всегда отдаёт 12 месяцев, добивая нулями. */
@Serializable
data class RevenuePoint(
    val month: String = "",
    val total: Double = 0.0,
)

@Serializable
data class PatientsGrowthPoint(
    val month: String = "",
    val newPatients: Int = 0,
)

/** Загрузка врача за текущий месяц — `GET /api/analytics/doctors`. */
@Serializable
data class DoctorUtilization(
    val doctorId: String = "",
    val firstName: String? = null,
    val lastName: String? = null,
    val appointmentsThisMonth: Int = 0,
) {
    val name: String
        get() = listOfNotNull(lastName?.takeIf { it.isNotBlank() }, firstName?.takeIf { it.isNotBlank() })
            .joinToString(" ")
            .ifBlank { "Без имени" }
}
