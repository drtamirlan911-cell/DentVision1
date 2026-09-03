package kz.dentvision.crm.data

import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.api.apiCall
import kz.dentvision.crm.data.model.AiActionRequest
import kz.dentvision.crm.data.model.AiActionResult
import kz.dentvision.crm.data.model.AiApprovalDecision
import kz.dentvision.crm.data.model.AiApprovalItem
import kz.dentvision.crm.data.model.AiBriefing
import kz.dentvision.crm.data.model.AiConfirmRequest
import kz.dentvision.crm.data.model.AiConfirmResult
import kz.dentvision.crm.data.model.AiInsight
import kz.dentvision.crm.data.model.AiProactiveResponse
import kz.dentvision.crm.data.model.AiQueryRequest
import kz.dentvision.crm.data.model.AiQueryResponse
import kz.dentvision.crm.data.model.AiThread
import kz.dentvision.crm.data.model.AiThreadRef
import kz.dentvision.crm.data.model.AiTimelineResponse
import kz.dentvision.crm.data.model.AiTimelineStats
import kz.dentvision.crm.data.session.ScreenFocus
import kotlinx.serialization.json.JsonObject

/**
 * Единственная точка входа в ИИ-слой. Ничего здесь не решает сам по себе:
 * решения — права, скоуп, нужно ли подтверждение, что записать в журнал —
 * принимает `runAiAction` на сервере; репозиторий только зовёт маршрут и
 * возвращает то, что сервер сказал.
 */
class AiRepository(private val api: ApiClient = ServiceLocator.api) {

    suspend fun briefing(): AiBriefing = apiCall { api.ai.briefing() }

    suspend fun proactive(): List<kz.dentvision.crm.data.model.AiAlert> =
        apiCall { api.ai.proactive() }.alerts

    /**
     * Разговор. `focus` — фокус экрана в момент отправки, а не в момент
     * открытия ассистента: человек мог полистать карточку, пока писал вопрос,
     * и контекст должен быть тем, что видно прямо сейчас.
     */
    suspend fun query(
        text: String,
        sessionId: String?,
        focus: ScreenFocus,
        timezone: String?,
    ): AiQueryResponse = apiCall {
        api.ai.query(
            AiQueryRequest(
                text = text,
                sessionId = sessionId,
                timezone = timezone,
                pathname = focus.pathname,
                focusType = focus.type,
                focusId = focus.id,
            ),
        )
    }

    suspend fun activeThread(): AiThread = apiCall { api.ai.activeThread() }

    suspend fun newThread(): AiThreadRef = apiCall { api.ai.newThread() }

    suspend fun action(action: String, params: JsonObject = JsonObject(emptyMap())): AiActionResult =
        apiCall { api.ai.action(AiActionRequest(action = action, params = params)) }

    suspend fun confirm(action: String, confirmed: Boolean, params: JsonObject?): AiConfirmResult =
        apiCall { api.ai.confirm(AiConfirmRequest(action = action, confirmed = confirmed, params = params)) }

    suspend fun insights(entityType: String, entityId: String): List<AiInsight> =
        apiCall { api.ai.insights(entityType, entityId) }

    suspend fun dismissInsight(id: String) {
        apiCall { api.ai.dismissInsight(id) }
    }

    // ── Очередь подтверждений ──

    suspend fun approvals(status: String? = "pending"): List<AiApprovalItem> =
        apiCall { api.ai.approvals(status) }

    suspend fun approve(id: String, note: String? = null): AiApprovalItem =
        apiCall { api.ai.approveApproval(id, AiApprovalDecision(note)) }

    suspend fun reject(id: String, note: String? = null): AiApprovalItem =
        apiCall { api.ai.rejectApproval(id, AiApprovalDecision(note)) }

    // ── Центр активности ──

    suspend fun timeline(limit: Int = 50, offset: Int = 0, status: String? = null): AiTimelineResponse =
        apiCall { api.ai.timeline(limit, offset, status) }

    suspend fun timelineStats(): AiTimelineStats = apiCall { api.ai.timelineStats() }
}
