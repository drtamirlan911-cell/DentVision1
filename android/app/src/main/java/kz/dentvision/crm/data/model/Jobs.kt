package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/** Payload карточки Jobs; используется и в плоском списке, и внутри ApiEnvelope создания резюме. */
@Serializable
data class JobVacancy(
    val id: String,
    val title: String,
    val clinicName: String = "",
    val city: String = "",
    val salary: String = "",
    val employmentType: String = "",
    val description: String = "",
    val tags: List<String> = emptyList(),
    val status: String = "open",
    val kind: String = "vacancy",
    val createdAt: String? = null,
)

@Serializable
data class JobApplication(
    val id: String,
    val vacancyId: String,
    val userId: String = "",
    val userName: String = "",
    val coverNote: String = "",
    val status: String = "new",
    val createdAt: String? = null,
)

/** Тело candidate-only `POST /api/jobs`; employer vacancies use the legal-gated `/api/jobs/employer/vacancies` endpoint. */
@Serializable
data class CreateJobRequest(
    val title: String,
    val clinicName: String? = null,
    val city: String,
    val salary: String? = null,
    val employmentType: String? = null,
    val description: String? = null,
    val tags: List<String> = emptyList(),
    val kind: String = "resume",
)

/** Тело `POST /api/jobs/:id/apply` — `coverNote` необязателен на сервере. */
@Serializable
data class ApplyJobRequest(val coverNote: String = "")
