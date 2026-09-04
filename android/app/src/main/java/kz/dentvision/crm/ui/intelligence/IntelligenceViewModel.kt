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
import kz.dentvision.crm.data.model.AiAction
import kz.dentvision.crm.data.model.AiAlert
import kz.dentvision.crm.data.model.AiMessage
import kz.dentvision.crm.data.session.FocusHolder
import kz.dentvision.crm.navigation.AI_NAV_ACTIONS

data class IntelligenceUiState(
    val isGuest: Boolean = false,
    val messages: List<AiMessage> = emptyList(),
    val suggestions: List<String> = emptyList(),
    /** Кнопки под последним ответом ассистента — гаснут с новым сообщением. */
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

/**
 * Дом приложения — как `/` на вебе (`AIWorkspaceIndex.tsx`): один живой
 * диалог, а не отдельная страница со статистикой и отдельный виджет чата.
 * Брифинг по роли (`/api/ai/briefing`) заходит в тот же тред первым
 * сообщением ассистента, а не отдельной карточкой — ровно так это делает
 * `pushDailyJarvisBriefing` в вебе. Проактивные тревоги (`/api/ai/proactive`)
 * остаются отдельным списком: их можно скрыть по одной, не трогая переписку.
 */
class IntelligenceViewModel(
    private val repository: AiRepository = AiRepository(),
    private val guestRepository: GuestRepository = GuestRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(IntelligenceUiState())
    val state: StateFlow<IntelligenceUiState> = _state

    private var sessionId: String? = null
    private var threadLoaded = false

    /**
     * Гость и вошедший видят один и тот же экран, но не один и тот же набор
     * вызовов: `/threads/active` и `/briefing` требуют `authenticate`
     * (`ai.routes.ts`), а `/proactive` и `/query` — нет (`optionalAuth`,
     * гостевая квота). Это тот самый Kaspi-принцип: приложением можно
     * пользоваться без входа, вход просят не на пороге, а там, где он
     * реально нужен.
     */
    fun ensureLoaded() {
        if (threadLoaded) return
        threadLoaded = true
        val isGuest = ServiceLocator.session.session.value == null
        _state.update { it.copy(isGuest = isGuest) }
        if (isGuest) {
            _state.update { it.copy(loadingThread = false) }
            // Гостевой JWT нужен для /api/ai/query (enforceGuestAiQuota,
            // ai.routes.ts:30-55) — без него первый же вопрос падает 401
            // GUEST_SESSION_REQUIRED. Заводим сессию заранее, тем же
            // приёмом, что initGuest() в useEffect на вебе, а не по факту
            // ошибки: пусть токен уже будет готов к моменту отправки.
            viewModelScope.launch {
                runCatching { guestRepository.ensureSession() }
                    .onSuccess { identity -> _state.update { it.copy(aiRequestsLeft = identity.aiRequestsLeft) } }
            }
        } else {
            viewModelScope.launch {
                runCatching { repository.activeThread() }
                    .onSuccess { thread ->
                        sessionId = thread.sessionId ?: thread.threadId
                        _state.update { it.copy(messages = thread.messages, loadingThread = false) }
                        if (thread.messages.isEmpty()) injectBriefing()
                    }
                    .onFailure { e ->
                        _state.update { it.copy(loadingThread = false, error = e.message ?: "Не удалось загрузить диалог") }
                    }
            }
        }
        viewModelScope.launch {
            runCatching { repository.proactive() }
                .onSuccess { alerts -> _state.update { it.copy(alerts = alerts) } }
                .onFailure { /* Тревоги необязательны для полезности экрана — диалог важнее. */ }
        }
    }

    /** Первое, чем встречает пустой тред, — брифинг по роли, тем же голосом, что и любой другой ответ. */
    private fun injectBriefing() {
        viewModelScope.launch {
            runCatching { repository.briefing() }
                .onSuccess { briefing ->
                    val text = briefing.message.ifBlank { briefing.reply }
                    if (text.isBlank()) return@onSuccess
                    val note = AiMessage(id = UUID.randomUUID().toString(), role = "assistant", content = text)
                    _state.update { it.copy(messages = it.messages + note, suggestions = briefing.suggestions) }
                }
                .onFailure { /* Гость или клиника ещё не выбрана — брифинг недоступен, это не ошибка экрана. */ }
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
                response.aiRequestsLeft?.let { ServiceLocator.guest.setAiRequestsLeft(it) }
                _state.update {
                    it.copy(
                        messages = it.messages + botMessage,
                        suggestions = response.suggestions,
                        actions = response.actions,
                        sending = false,
                        aiRequestsLeft = response.aiRequestsLeft ?: it.aiRequestsLeft,
                    )
                }
            }.onFailure { e ->
                _state.update { it.copy(sending = false, error = e.message ?: "Не удалось отправить сообщение") }
            }
        }
    }

    /**
     * Обычная кнопка выполняется сразу; кнопка с подтверждением сперва
     * спрашивает человека. Известный алиас навигации (`AI_NAV_ACTIONS`,
     * перенос `AI_NAV_ACTIONS` из `aiPlatformMap.ts`) резолвится прямо на
     * клиенте — так же, как в `AIWorkspaceIndex.tsx:651-653` — а не через
     * `POST /api/ai/action`: этот маршрут требует входа, а часть алиасов
     * (`OpenShop`, `OpenSchool`, `OpenDemo`) приходит именно в гостевых
     * тревогах, где похода на сервер за ними и не предполагалось.
     */
    fun tapAction(action: AiAction) {
        AI_NAV_ACTIONS[action.type]?.let { path ->
            _state.update { it.copy(pendingNavigatePath = path) }
            return
        }
        if (action.requiresConfirmation) {
            _state.update { it.copy(pendingConfirmation = action) }
        } else {
            executeAction(action.type, action.params)
        }
    }

    /** Тревога устроена так же — сперва алиас на клиенте, иначе поход на сервер. */
    fun tapAlert(alert: AiAlert) {
        val type = alert.action?.type ?: return
        dismissAlert(alert)
        AI_NAV_ACTIONS[type]?.let { path ->
            _state.update { it.copy(pendingNavigatePath = path) }
            return
        }
        executeAction(type, null)
    }

    fun dismissAlert(alert: AiAlert) {
        _state.update { it.copy(alerts = it.alerts.filterNot { a -> a === alert }) }
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
                    // `type` в ответе не значит «навигация или нет» — настоящий
                    // вызов инструмента с найденным путём приходит как
                    // `type:'created'` (`ai.routes.ts`: `result.navigate ?
                    // 'created' : 'data'`), решает наличие `path`.
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
        val note = AiMessage(id = UUID.randomUUID().toString(), role = "assistant", content = text)
        _state.update { it.copy(messages = it.messages + note) }
    }

    fun startNewThread() {
        viewModelScope.launch {
            runCatching { repository.newThread() }
                .onSuccess { ref ->
                    sessionId = ref.sessionId
                    _state.update { it.copy(messages = emptyList(), suggestions = emptyList(), actions = emptyList()) }
                    injectBriefing()
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
