package kz.dentvision.crm.ui.assistant

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
import kz.dentvision.crm.data.model.AiAction
import kz.dentvision.crm.data.model.AiMessage
import kz.dentvision.crm.data.session.FocusHolder

data class AssistantUiState(
    val messages: List<AiMessage> = emptyList(),
    val suggestions: List<String> = emptyList(),
    /** Кнопки под последним ответом ассистента — гаснут с новым сообщением. */
    val actions: List<AiAction> = emptyList(),
    val input: String = "",
    val sending: Boolean = false,
    val loadingThread: Boolean = true,
    val error: String? = null,
    val pendingConfirmation: AiAction? = null,
    val pendingNavigatePath: String? = null,
    val aiRequestsLeft: Int? = null,
)

/**
 * Один живой диалог с ассистентом на весь процесс — держится на уровне
 * оболочки (см. `AppShell`), а не отдельного экрана, потому что открыть
 * ассистента можно с любого экрана и разговор должен пережить переход между
 * ними.
 */
class AssistantViewModel(
    private val repository: AiRepository = AiRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(AssistantUiState())
    val state: StateFlow<AssistantUiState> = _state

    private var sessionId: String? = null
    private var threadLoaded = false

    /** Тред грузится один раз при первом открытии листа, не при каждой пересборке. */
    fun ensureThreadLoaded() {
        if (threadLoaded) return
        threadLoaded = true
        viewModelScope.launch {
            runCatching { repository.activeThread() }
                .onSuccess { thread ->
                    sessionId = thread.sessionId ?: thread.threadId
                    _state.update { it.copy(messages = thread.messages, loadingThread = false) }
                }
                .onFailure { e ->
                    _state.update { it.copy(loadingThread = false, error = e.message ?: "Не удалось загрузить диалог") }
                }
        }
    }

    fun setInput(text: String) {
        _state.update { it.copy(input = text) }
    }

    fun send(text: String = _state.value.input) {
        val trimmed = text.trim()
        if (trimmed.isEmpty() || _state.value.sending) return
        val userMessage = AiMessage(id = UUID.randomUUID().toString(), role = "user", content = trimmed)
        _state.update {
            it.copy(
                messages = it.messages + userMessage,
                input = "",
                sending = true,
                error = null,
                actions = emptyList(),
                suggestions = emptyList(),
            )
        }
        viewModelScope.launch {
            runCatching {
                repository.query(
                    text = trimmed,
                    sessionId = sessionId,
                    focus = FocusHolder.current.value,
                    timezone = TimeZone.getDefault().id,
                )
            }.onSuccess { response ->
                sessionId = response.sessionId ?: sessionId
                val botMessage = AiMessage(
                    id = response.messageId ?: UUID.randomUUID().toString(),
                    role = "assistant",
                    content = response.reply,
                )
                _state.update {
                    it.copy(
                        messages = it.messages + botMessage,
                        suggestions = response.suggestions,
                        actions = response.actions,
                        sending = false,
                        aiRequestsLeft = response.aiRequestsLeft,
                    )
                }
            }.onFailure { e ->
                _state.update { it.copy(sending = false, error = e.message ?: "Не удалось отправить сообщение") }
            }
        }
    }

    /** Обычная кнопка выполняется сразу; кнопка с подтверждением сперва спрашивает человека. */
    fun tapAction(action: AiAction) {
        if (action.requiresConfirmation) {
            _state.update { it.copy(pendingConfirmation = action) }
        } else {
            executeAction(action.type, action.params)
        }
    }

    fun confirmPending(confirmed: Boolean) {
        val action = _state.value.pendingConfirmation ?: return
        _state.update { it.copy(pendingConfirmation = null) }
        if (!confirmed) return
        viewModelScope.launch {
            runCatching { repository.confirm(action = action.type, confirmed = true, params = action.params) }
                .onSuccess { result ->
                    if (result.path != null) {
                        _state.update { it.copy(pendingNavigatePath = result.path) }
                    } else {
                        appendNote(if (result.confirmed) "Готово." else "Отменено.")
                    }
                }
                .onFailure { e -> _state.update { it.copy(error = e.message ?: "Не удалось подтвердить действие") } }
        }
    }

    private fun executeAction(type: String, params: JsonObject?) {
        viewModelScope.launch {
            runCatching { repository.action(type, params ?: JsonObject(emptyMap())) }
                .onSuccess { result ->
                    when (result.type) {
                        "navigate" -> if (result.path != null) {
                            _state.update { it.copy(pendingNavigatePath = result.path) }
                        } else {
                            appendNote(result.message ?: "Раздел пока доступен только в браузере")
                        }
                        "error" -> _state.update { it.copy(error = result.message ?: "Не удалось выполнить действие") }
                        else -> appendNote(result.label ?: result.message ?: "Готово")
                    }
                }
                .onFailure { e -> _state.update { it.copy(error = e.message ?: "Не удалось выполнить действие") } }
        }
    }

    private fun appendNote(text: String) {
        val note = AiMessage(id = UUID.randomUUID().toString(), role = "assistant", content = text)
        _state.update { it.copy(messages = it.messages + note) }
    }

    fun startNewThread() {
        viewModelScope.launch {
            runCatching { repository.newThread() }
                .onSuccess { ref ->
                    sessionId = ref.sessionId
                    _state.update { it.copy(messages = emptyList(), suggestions = emptyList(), actions = emptyList()) }
                }
                .onFailure { e -> _state.update { it.copy(error = e.message ?: "Не удалось начать новый диалог") } }
        }
    }

    fun consumeNavigate() {
        _state.update { it.copy(pendingNavigatePath = null) }
    }

    fun consumeError() {
        _state.update { it.copy(error = null) }
    }
}
