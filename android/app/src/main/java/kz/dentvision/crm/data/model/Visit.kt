package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * Визит. У модели `Visit` на бэкенде всего восемь колонок, а форма собирает
 * больше — поэтому проведённые процедуры, назначения, дата следующего визита и
 * коды МКБ-10 упакованы в JSON-колонку `treatment` и оттуда же читаются. Это
 * решение бэкенда, а не изобретение клиента: так же делает и веб
 * (`mapVisitFromBackend`, `src/utils/api.ts:1444`).
 */
@Serializable
data class Visit(
    val id: String,
    val patientId: String = "",
    val doctorId: String = "",
    val date: String? = null,
    val diagnosis: String? = null,
    val complaints: String? = null,
    val anamnesis: String? = null,
    val notes: String? = null,
    val treatment: VisitTreatment? = null,
)

@Serializable
data class VisitTreatment(
    val plan: String? = null,
    val proceduresDone: String? = null,
    val prescriptions: String? = null,
    val nextVisitDate: String? = null,
    val icd10Codes: String? = null,
)

/** Тело `POST /api/medical/visits`. */
@Serializable
data class VisitCreate(
    val patientId: String,
    val doctorId: String,
    val diagnosis: String? = null,
    val complaints: String? = null,
    val anamnesis: String? = null,
    val notes: String? = null,
    val treatment: VisitTreatment? = null,
)
