package kz.dentvision.crm.ui.intelligence

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import java.util.TimeZone
import java.util.UUID
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kz.dentvision.crm.data.AiRepository
import kz.dentvision.crm.data.GuestRepository
import kz.dentvision.crm.data.ServiceLocator
import kz.dentvision.crm.data.ai.AiActionPolicy
import kz.dentvision.crm.data.model.AiAction
import kz.dentvision.crm.data.model.AiAlert
import kz.dentvision.crm.data.model.AiMessage
import kz.dentvision.crm.data.model.AiSkill
import kz.dentvision.crm.data.session.FocusHolder
import kz.dentvision.crm.navigation.AI_NAV_ACTIONS

data class IntelligenceUiState(
    val isGuest: Boolean = false,
    val messages: List<AiMessage> = emptyList(),
    val suggestions: List<String> = emptyList(),
    val actions: List<AiAction> = emptyList(),
    val alerts: List<AiAlert> = emptyList(),
    val input: String = "",
    val sending: Boolean = false,
    val loadingThread: Boolean = true,
    val error: String? = null,
    val pendingConfirmation: AiAction? = null,
    val pendingNavigatePath: String? = null,
    val aiRequestsLeft: Int? = null,
)

class IntelligenceViewModel(
    private val repository: AiRepository = AiRepository(),
    private val guestRepository: GuestRepository = GuestRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(IntelligenceUiState())
    val state: StateFlow<IntelligenceUiState> = _state

    private var sessionId: String? = null

    fun setInput(text: String) { _state.update { it.copy(input = text) } }

    fun send(text: String = _state.value.input) {
        val trimmed = text.trim()
        if (trimmed.isEmpty() || _state.value.sending) return
        val userMessage = AiMessage(UUID.randomUUID().toString(), "user", trimmed)
        _state.update { it.copy(messages = it.messages + userMessage, input = "", sending = true, error = null, actions = emptyList(), suggestions = emptyList()) }
        viewModelScope.launch {
            runCatching {
                repository.query(trimmed, sessionId, FocusHolder.current.value, TimeZone.getDefault().id)
            }.onSuccess { response ->
                sessionId = response.sessionId ?: sessionId
                _state.update {
                    it.copy(
                        messages = it.messages + AiMessage(response.messageId ?: UUID.randomUUID().toString(), "assistant", response.reply),
                        suggestions = response.suggestions,
                        actions = response.actions,
                        sending = false,
                        aiRequestsLeft = response.aiRequestsLeft ?: it.aiRequestsLeft,
                    )
                }
                response.aiRequestsLeft?.let { ServiceLocator.guest.setAiRequestsLeft(it) }
            }.onFailure { e -> _state.update { it.copy(sending = false, error = e.message ?: "Не удалось отправить сообщение") } }
        }
    }

    /**
     * Client-side policy is fail-closed: even if a backend response accidentally
     * omits requiresConfirmation, known mutation actions cannot execute directly.
     * The backend remains the authoritative RBAC/confirmation gate.
     */
    fun tapAction(action: AiAction) {
        AI_NAV_ACTIONS[action.type]?.let { path ->
            _state.update { it.copy(pendingNavigatePath = path) }
            return
        }
        if (AiActionPolicy.requiresConfirmation(action.type, action.requiresConfirmation)) {
            _state.update { it.copy(pendingConfirmation = action) }
        } else {
            executeAction(action.type, action.params)
        }
    }

    fun tapAlert(alert: AiAlert) {
        val type = alert.action?.type ?: return
        dismissAlert(alert)
        alert.action.path?.let { path ->
            _state.update { it.copy(pendingNavigatePath = path) }
            return
        }
        AI_NAV_ACTIONS[type]?.let { path ->
            _state.update { it.copy(pendingNavigatePath = path) }
            return
        }
        if (AiActionPolicy.requiresConfirmation(type, false)) {
            _state.update { it.copy(pendingConfirmation = AiAction(type = type, label = alert.text)) }
        } else {
            executeAction(type, null)
        }
    }

    fun dismissAlert(alert: AiAlert) { _state.update { it.copy(alerts = it.alerts.filterNot { a -> a === alert }) } }

    fun confirmPending(confirmed: Boolean) {
        val action = _state.value.pendingConfirmation ?: return
        _state.update { it.copy(pendingConfirmation = null) }
        if (!confirmed) return
        viewModelScope.launch {
            runCatching { repository.confirm(action = action.type, confirmed = true, params = action.params) }
                .onSuccess { result ->
                    if (result.path != null) _state.update { it.copy(pendingNavigatePath = result.path) }
                    else appendNote(if (result.confirmed) "Готово." else "Отменено.")
                }
                .onFailure { e -> _state.update { it.copy(error = e.message ?: "Не удалось подтвердить действие") } }
        }
    }

    private fun executeAction(type: String, params: JsonObject?) {
        if (AiActionPolicy.requiresConfirmation(type, false)) {
            _state.update { it.copy(error = "Действие требует подтверждения") }
            return
        }
        viewModelScope.launch {
            runCatching { repository.action(type, params ?: JsonObject(emptyMap())) }
                .onSuccess { result ->
                    when {
                        result.type == "error" -> _state.update { it.copy(error = result.message ?: "Не удалось выполнить действие") }
                        result.path != null -> _state.update { it.copy(pendingNavigatePath = result.path) }
                        else -> appendNote(result.message ?: result.label ?: "Готово")
                    }
                }
                .onFailure { e -> _state.update { it.copy(error = e.message ?: "Не удалось выполнить действие") } }
        }
    }

    private fun appendNote(text: String) {
        _state.update { it.copy(messages = it.messages + AiMessage(UUID.randomUUID().toString(), "assistant", text)) }
    }

    fun consumeNavigate() { _state.update { it.copy(pendingNavigatePath = null) } }
    fun consumeMessage() { _state.update { it.copy(error = null) } }
}
