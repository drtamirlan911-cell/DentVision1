package kz.dentvision.crm.data

import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.api.apiCall
import kz.dentvision.crm.data.model.ConversationMessage
import kz.dentvision.crm.data.model.InboxConversationSummary
import kz.dentvision.crm.data.model.InboxThread
import kz.dentvision.crm.data.model.ReplyRequest

/** Тонкие обёртки над `PatientInboxApi` — та же форма, что у остальных репозиториев. */
class PatientInboxRepository(
    private val api: ApiClient = ServiceLocator.api,
) {
    suspend fun conversations(status: String? = null): List<InboxConversationSummary> =
        apiCall { api.patientInbox.conversations(status) }

    suspend fun thread(id: String): InboxThread = apiCall { api.patientInbox.thread(id) }

    suspend fun claim(id: String): InboxConversationSummary = apiCall { api.patientInbox.claim(id) }

    suspend fun reply(id: String, text: String): ConversationMessage =
        apiCall { api.patientInbox.reply(id, ReplyRequest(text)) }

    suspend fun resolve(id: String): InboxConversationSummary = apiCall { api.patientInbox.resolve(id) }
}
