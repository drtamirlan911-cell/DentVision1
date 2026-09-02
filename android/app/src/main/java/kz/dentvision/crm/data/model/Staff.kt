package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * Сотрудники клиники приходят вложенными в саму клинику
 * (`GET /api/clinics/:id` → `members[]`) — отдельного списка персонала на
 * бэкенде нет, и веб собирает его оттуда же (`getClinicStaff`,
 * `src/utils/api.ts:447`).
 */
@Serializable
data class ClinicWithMembers(
    val id: String,
    val name: String = "",
    val members: List<ClinicMember> = emptyList(),
)

@Serializable
data class ClinicMember(
    val id: String? = null,
    val role: String = "",
    val user: MemberUser? = null,
)

@Serializable
data class MemberUser(
    val id: String,
    val firstName: String? = null,
    val lastName: String? = null,
    val spec: String? = null,
    val email: String? = null,
    val phone: String? = null,
)

/** Врач для выбора в форме: только то, что нужно показать и отправить. */
data class Doctor(val id: String, val name: String, val spec: String?)

/**
 * Роли, которые в этой системе значат «принимает пациентов». `owner` и
 * `director` тоже лечат — в маленькой клинике владелец и есть основной врач,
 * поэтому исключать их из выбора нельзя.
 */
private val TREATING_ROLES = setOf("doctor", "owner", "director")

fun ClinicWithMembers.doctors(): List<Doctor> = members
    .filter { it.user != null && it.role.lowercase() in TREATING_ROLES }
    .map { member ->
        val user = member.user!!
        Doctor(
            id = user.id,
            name = listOfNotNull(user.firstName, user.lastName)
                .joinToString(" ")
                .trim()
                .ifBlank { "Без имени" },
            spec = user.spec,
        )
    }
