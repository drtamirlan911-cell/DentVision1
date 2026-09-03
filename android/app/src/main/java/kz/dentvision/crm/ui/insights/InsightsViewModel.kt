package kz.dentvision.crm.ui.insights

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.AiRepository
import kz.dentvision.crm.data.model.AiInsight
import kz.dentvision.crm.data.model.AiInsightAction
import kz.dentvision.crm.ui.common.UiState

data class InsightsUiState(
    val items: UiState<List<AiInsight>> = UiState.Loading,
    val pendingNavigatePath: String? = null,
    val message: String? = null,
)

/**
 * Детерминированные подсказки на карточке пациента (`GET /api/ai/insights`,
 * Этап 11 бэкенд-плана — `os/insights.ts`). Без обращения к модели: то же
 * решение, что уже принято в `tryDeterministicStats`/`lib/triage.ts` — нет
 * стоимости и нет галлюцинаций, ответ воспроизводим.
 *
 * Действия карточки идут через ядро (`POST /api/ai/action`), поэтому права,
 * скоуп и очередь подтверждений достаются бесплатно — этот класс их не
 * проверяет и не должен.
 */
class InsightsViewModel(
    private val repository: AiRepository = AiRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(InsightsUiState())
    val state: StateFlow<InsightsUiState> = _state

    private var loadedFor: String? = null

    /** Экран может открыться без выбранного пациента — тогда подсказок просто нет. */
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
        _state.update { it.copy(items = UiState.Data(before.filterNot { insight -> insight.id == id })) }
        viewModelScope.launch {
            runCatching { repository.dismissInsight(id) }
                .onFailure {
                    // Сервер не принял — возвращаем карточку, иначе подсказка
                    // пропадёт молча, так и не будучи скрытой на самом деле.
                    _state.update { s ->
                        val restored = (s.items as? UiState.Data)?.value ?: before
                        if (restored.any { it.id == id }) return@update s
                        s.copy(items = UiState.Data(restored + before.first { it.id == id }))
                    }
                }
        }
    }

    fun performAction(action: AiInsightAction) {
        viewModelScope.launch {
            runCatching { repository.action(action.tool, action.params) }
                .onSuccess { result ->
                    // Как и в HomeViewModel.performAction: решает наличие `path`,
                    // а не строка `type` — настоящий вызов инструмента (в том
                    // числе tool:'navigate' из os/insights.ts) приходит с
                    // type:'created', не type:'navigate'.
                    when {
                        result.type == "error" -> _state.update { it.copy(message = result.message ?: "Не удалось выполнить действие") }
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
