package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * Пациент в том виде, в каком его отдаёт `serializePatient`
 * (`dentvision-backend/src/modules/patients/patients.routes.ts:38`): бэкенд уже
 * склеил `name`, привёл дату к `ГГГГ-ММ-ДД` и расшифровал ИИН. Клиент ничего из
 * этого не пересчитывает.
 *
 * `noIinReason` — причина, по которой ИИН не указан (иностранец, нет документа,
 * заведён без номера). Пустая строка значит, что ИИН есть.
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
    val allergies: String = "",
    val medicalHistory: MedicalHistory? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
)

/**
 * Тело `POST /api/patients`. Поля — те же, что принимает обработчик; `id`
 * превращает создание в обновление (бэкенд делает upsert по нему).
 *
 * ИИН обязателен при создании — либо номер, либо причина его отсутствия. Это
 * правило бэкенда (`buildPatientIinFields(..., required: !existing)`), и клиент
 * его не смягчает: он лишь показывает ошибку раньше, чем уйдёт запрос.
 */
@Serializable
data class PatientUpsert(
    val id: String? = null,
    val name: String,
    val phone: String? = null,
    val email: String? = null,
    val dob: String? = null,
    val gender: String? = null,
    val address: String? = null,
    val notes: String? = null,
    val iin: String? = null,
    val noIinReason: String? = null,
)
