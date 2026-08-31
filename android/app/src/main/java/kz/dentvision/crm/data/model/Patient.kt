package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * Пациент в том виде, в каком его отдаёт `serializePatient`
 * (`dentvision-backend/src/modules/patients/patients.routes.ts:38`): бэкенд уже
 * склеил `name`, привёл дату к `YYYY-MM-DD` и расшифровал ИИН. Клиент ничего из
 * этого не пересчитывает.
 *
 * `noIinReason` — причина, по которой ИИН не указан (иностранец, нет документа,
 * заведён без номера); пустая строка означает, что ИИН есть.
 */
@Serializable
data class Patient(
    val id: String,
    val clinicId: String? = null,
    val name: String = "",
    val firstName: String = "",
    val lastName: String = "",
    val phone: String = "",
    val email: String = "",
    val dob: String = "",
    val gender: String = "",
    val address: String = "",
    val notes: String = "",
    val iin: String = "",
    val noIinReason: String = "",
    val prepaidBalance: Double = 0.0,
    val category: String = "regular",
    val source: String = "",
    val allergies: String = "",
    val tags: List<String> = emptyList(),
    val createdAt: String? = null,
    val updatedAt: String? = null,
)
