package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * Медкарта. Отдельной таблицы под неё на развёрнутой схеме нет: поля лежат в
 * JSON-колонке `Patient.medicalHistory`, читаются через `GET /api/patients/:id`
 * и пишутся через `PATCH /api/patients/:id` — ровно так, как описано в
 * `src/utils/api.ts:1413`.
 *
 * PATCH на бэкенде **сливает** присланное с уже лежащим
 * (`{...prevHistory, ...body.medicalHistory}`, `patients.routes.ts:566`),
 * поэтому отправка одних только полей карты не стирает ни зубную формулу, ни
 * категорию, ни метки пациента.
 */
@Serializable
data class MedicalHistory(
    val bloodType: String? = null,
    val chronicDiseases: String? = null,
    val pastSurgeries: String? = null,
    val familyHistory: String? = null,
    val allergies: String? = null,
    val emergencyContact: String? = null,
    val emergencyPhone: String? = null,
    val insuranceProvider: String? = null,
    val insuranceNumber: String? = null,
    val notes: String? = null,
)

/** Тело `PATCH /api/patients/:id`, когда меняется только медкарта. */
@Serializable
data class MedicalHistoryPatch(val medicalHistory: MedicalHistory)
