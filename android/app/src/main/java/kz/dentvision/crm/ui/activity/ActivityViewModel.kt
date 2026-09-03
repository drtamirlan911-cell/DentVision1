package kz.dentvision.crm.ui.activity

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.AiRepository
import kz.dentvision.crm.data.model.AiTimelineEvent
import kz.dentvision.crm.data.model.AiTimelineStats
import kz.dentvision.crm.ui.common.UiState

data class ActivityUiState(
    val entries: UiState<List<AiTimelineEvent>> = UiState.Loading,
    val stats: AiTimelineStats? = null,
)

/**
 * Центр активности ИИ (`GET /api/ai/timeline[/stats]`, `AgentActivity`).
 * Видимость и PHI-редактирование строк решает сервер (`buildActivityFilter`,
 * `redactPhiRows`) — экран показывает ровно то, что пришло, не дополняя.
 */
class ActivityViewModel(
    private val repository: AiRepository = AiRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(ActivityUiState())
    val state: StateFlow<ActivityUiState> = _state

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(entries = UiState.Loading) }
        viewModelScope.launch {
            runCatching { repository.timeline(limit = 50) }
                .onSuccess { response -> _state.update { it.copy(entries = UiState.Data(response.entries)) } }
                .onFailure { e ->
                    _state.update { it.copy(entries = UiState.Error(e.message ?: "Не удалось получить журнал")) }
                }
        }
        viewModelScope.launch {
            runCatching { repository.timelineStats() }
                .onSuccess { stats -> _state.update { it.copy(stats = stats) } }
                .onFailure { /* Сводка необязательна для полезности экрана — список важнее. */ }
        }
    }
}
