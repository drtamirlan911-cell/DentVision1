package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * Заказ лаборатории — `serializeLabOrder` (`modules/lab/lab.routes.ts:31`).
 * Материал, оттенок и номер зуба лежат в JSON-поле `files.meta`, поэтому
 * бэкенд их сам достаёт и кладёт в ответ плоско: клиенту разбирать нечего.
 */
@Serializable
data class LabOrder(
    val id: String,
    val clinicId: String? = null,
    val patientId: String? = null,
    val patientName: String = "",
    val labType: String? = null,
    val material: String = "",
    @Serializable(with = LooseStringSerializer::class)
    val toothNumber: String = "",
    val shade: String = "",
    val doctorId: String? = null,
    val dueDate: String? = null,
    val notes: String? = null,
    val status: String = "pending",
    val price: Int? = null,
    val createdAt: String? = null,
)

val LAB_STATUS_LABELS: Map<String, String> = mapOf(
    "pending" to "Ожидает",
    "in_progress" to "В работе",
    "inProgress" to "В работе",
    "ready" to "Готов",
    "delivered" to "Выдан",
)

@Serializable
data class LabOrderCreate(
    val id: String? = null,
    val patientId: String,
    val patientName: String? = null,
    val labType: String? = null,
    val material: String? = null,
    val shade: String? = null,
    val toothNumber: String? = null,
    val dueDate: String? = null,
    val notes: String? = null,
    val price: Int? = null,
)

@Serializable
data class LabStatusUpdate(val status: String)

/** Код МКБ-10 (`GET /api/medical/icd10`). Справочник, только чтение. */
@Serializable
data class Icd10Code(
    val code: String,
    val description: String = "",
    val category: String? = null,
)

/**
 * План лечения — `serializePlan` (`modules/crm/crm.routes.ts:29`). Этапы и
 * сумма уже посчитаны на сервере.
 */
@Serializable
data class TreatmentPlan(
    val id: String,
    val patientId: String = "",
    val patientName: String? = null,
    val title: String = "",
    val status: String = "",
    val diagnosis: String? = null,
    val notes: String? = null,
    val totalBudget: Int? = null,
    val teeth: List<String> = emptyList(),
    val stages: List<TreatmentPlanStage> = emptyList(),
    val createdAt: String? = null,
)

/**
 * Этап плана — `TreatmentPlanStage` (`lib/treatmentPlanShape.ts:93`). `cost`
 * при отправке не нужен: сервер сам считает его из `items`
 * (`enrichStages`/`stageTotal`) и не читает присланное значение.
 */
@Serializable
data class TreatmentPlanStage(
    val id: String? = null,
    val title: String = "",
    val status: String? = null,
    val cost: Int? = null,
    val items: List<TreatmentPlanLineItem> = emptyList(),
)

/**
 * Услуга внутри этапа — подмножество `TreatmentPlanLineItem`
 * (`lib/treatmentPlanShape.ts:63`): только то, что заполняет ручное
 * редактирование (услуга из прайса, количество, цена). Поля вроде `finding`/
 * `alternatives`/`teeth` заполняет только ИИ-сборка плана по одонтограмме —
 * ручной редактор их не пишет и намеренно не притворяется, что умеет.
 */
@Serializable
data class TreatmentPlanLineItem(
    val id: String? = null,
    val serviceId: String? = null,
    val serviceName: String? = null,
    val price: Int = 0,
    val qty: Int = 1,
)

/** Тело `POST /api/crm/treatment-plans` — `id` есть только при редактировании. */
@Serializable
data class TreatmentPlanUpsert(
    val id: String? = null,
    val patientId: String,
    val title: String? = null,
    val diagnosis: String? = null,
    val status: String? = null,
    val stages: List<TreatmentPlanStage> = emptyList(),
    val notes: String? = null,
)

/** Документ пациента (`GET /api/files`). */
@Serializable
data class Document(
    val id: String,
    val clinicId: String? = null,
    val patientId: String? = null,
    val title: String? = null,
    val name: String? = null,
    val docType: String? = null,
    val type: String? = null,
    val status: String? = null,
    val createdAt: String? = null,
    val patient: DocumentPatient? = null,
) {
    val displayTitle: String get() = title?.takeIf { it.isNotBlank() }
        ?: name?.takeIf { it.isNotBlank() }
        ?: "Без названия"

    val patientName: String get() = patient
        ?.let { "${it.firstName.orEmpty()} ${it.lastName.orEmpty()}".trim() }
        .orEmpty()
}

@Serializable
data class DocumentPatient(
    val id: String,
    val firstName: String? = null,
    val lastName: String? = null,
)

/** Акция клиники (`GET /api/crm/promotions`). */
@Serializable
data class Promotion(
    val id: String,
    val title: String = "",
    val description: String? = null,
    val discountPercent: Int = 0,
    val startDate: String? = null,
    val endDate: String? = null,
    val status: String = "inactive",
    val active: Boolean = false,
)
