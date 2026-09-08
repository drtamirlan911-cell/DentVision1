package kz.dentvision.crm.ui.insights

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kz.dentvision.crm.data.AiRepository
import kz.dentvision.crm.data.ai.AiActionPolicy
import kz.dentvision.crm.data.model.AiInsight
import kz.dentvision.crm.data.model.AiInsightAction
import kz.dentvision.crm.ui.common.UiState

data class InsightsUiState(
    val items: UiState<List<AiInsight>> = UiState.Loading,
    val pendingNavigatePath: String? = null,
    val message: String? = null,
    val pendingConfirmation: AiInsightAction? = null,
)

/**
 * Детерминированные подсказки на карточке пациента (`GET /api/ai/insights`).
 * Действия проходят через ядро AI; серверная авторизация и подтверждение
 * остаются источником истины.
 */
class InsightsViewModel(
    private val repository: AiRepository = AiRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(InsightsUiState())
    val state: StateFlow<InsightsUiState> = _state

    private var loadedFor: String? = null

    fun ensureLoaded(entityId: String?) {
        if (entityId == null) {
            loadedFor = null
            _state.update { it.copy(items = UiState.Data(emptyList())) }
            return
        }
        if (loadedFor == entityId) return
        loadedFor = entityId
        _state.update { it.copy(items = UiState.Loading) }
        viewModelScope.launch {
            runCatching { repository.insights("patient", entityId) }
                .onSuccess { list -> _state.update { it.copy(items = UiState.Data(list)) } }
                .onFailure { e ->
                    _state.update { it.copy(items = UiState.Error(e.message ?: "Не удалось получить подсказки")) }
                }
        }
    }

    fun dismiss(id: String) {
        val current = _state.value.items
        val before = (current as? UiState.Data)?.value ?: return
        val dismissed = before.firstOrNull { it.id == id } ?: return
        _state.update { it.copy(items = UiState.Data(before.filterNot { insight -> insight.id == id })) }
        viewModelScope.launch {
            runCatching { repository.dismissInsight(id) }
                .onFailure {
                    _state.update { s ->
                        val restored = (s.items as? UiState.Data)?.value ?: emptyList()
                        if (restored.any { it.id == id }) s else s.copy(items = UiState.Data(restored + dismissed))
                    }
                }
        }
    }

    /**
     * Инсайт может пометить действие как требующее approval, но клиент также
     * применяет общий fail-closed policy, чтобы mutation нельзя было выполнить
     * напрямую только потому, что флаг от инсайта отсутствует.
     */
    fun performAction(action: AiInsightAction) {
        if (AiActionPolicy.requiresConfirmation(action.tool, action.requiresApproval)) {
            _state.update { it.copy(pendingConfirmation = action) }
            return
        }
        runAction(action.tool, action.params)
    }

    fun confirmPending(confirmed: Boolean) {
        val action = _state.value.pendingConfirmation ?: return
        _state.update { it.copy(pendingConfirmation = null) }
        if (!confirmed) return

        viewModelScope.launch {
            runCatching {
                repository.confirm(
                    action = action.tool,
                    confirmed = true,
                    params = action.params,
                )
            }.onSuccess { result ->
                when {
                    result.type == "error" -> _state.update {
                        it.copy(message = result.message ?: "Не удалось выполнить действие")
                    }
                    result.path != null -> _state.update { it.copy(pendingNavigatePath = result.path) }
                    else -> _state.update {
                        it.copy(message = if (result.confirmed) "Готово." else "Отменено.")
                    }
                }
            }.onFailure { e ->
                _state.update { it.copy(message = e.message ?: "Не удалось подтвердить действие") }
            }
        }
    }

    private fun runAction(tool: String, params: JsonObject) {
        // Defense in depth: a mutation must never reach /action without the
        // confirmation endpoint, even if this method is called from a future UI.
        if (AiActionPolicy.requiresConfirmation(tool, false)) {
            _state.update { it.copy(message = "Действие требует подтверждения") }
            return
        }

        viewModelScope.launch {
            runCatching { repository.action(tool, params) }
                .onSuccess { result ->
                    when {
                        result.type == "error" -> _state.update {
                            it.copy(message = result.message ?: "Не удалось выполнить действие")
                        }
                        result.path != null -> _state.update { it.copy(pendingNavigatePath = result.path) }
                        else -> _state.update { it.copy(message = result.message ?: result.label ?: "Готово") }
                    }
                }
                .onFailure { e -> _state.update { it.copy(message = e.message ?: "Не удалось выполнить действие") } }
        }
    }

    fun consumeNavigate() {
        _state.update { it.copy(pendingNavigatePath = null) }
    }

    fun consumeMessage() {
        _state.update { it.copy(message = null) }
    }
}
