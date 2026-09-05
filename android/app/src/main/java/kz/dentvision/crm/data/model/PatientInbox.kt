package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * «Диалоги с пациентами» — переписка, которую ИИ-ассистент пациента не
 * смог закрыть сам и передал живому сотруднику. Перенос
 * `dentvision-backend/src/modules/patient-conversation/patientInbox.routes.ts`
 * и `src/utils/api.ts` (раздел «Patient inbox (staff side)»).
 */
@Serializable
data class ConversationParticipant(
    val id: String,
    val firstName: String = "",
    val lastName: String = "",
    val phone: String? = null,
)

/** `status` — строка, как везде в приложении (см. `Referral.status`): WAITING | LIVE | RESOLVED. */
@Serializable
data class InboxConversationSummary(
    val id: String,
    val clinicId: String = "",
    val status: String = "",
    val escalationReason: String? = null,
    val lastPatientMessageAt: String? = null,
    val lastStaffMessageAt: String? = null,
    val createdAt: String = "",
    val patientUser: ConversationParticipant,
    val assignedTo: ConversationParticipant? = null,
)

/** `authorType`: PATIENT | STAFF | SYSTEM. */
@Serializable
data class ConversationMessage(
    val id: String,
    val authorType: String = "",
    val body: String = "",
    val createdAt: String = "",
)

@Serializable
data class InboxThread(
    val conversation: InboxConversationSummary,
    val messages: List<ConversationMessage> = emptyList(),
)

/** Тело `POST /api/patient-inbox/conversations/{id}/reply`. */
@Serializable
data class ReplyRequest(val text: String)
