package kz.dentvision.crm.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.AiRepository
import kz.dentvision.crm.data.model.AiAlert
import kz.dentvision.crm.data.model.AiBriefing
import kz.dentvision.crm.ui.common.UiState

data class HomeUiState(
    val briefing: UiState<AiBriefing> = UiState.Loading,
    val alerts: UiState<List<AiAlert>> = UiState.Loading,
    /** Путь, на который надо перейти — выставляется один раз и гасится тем, кто его прочитал. */
    val pendingNavigatePath: String? = null,
    val message: String? = null,
)

/**
 * Дом кабинета: то, чем ИИ уже сам знает встретить человека — брифинг по
 * роли и проактивные тревоги, а не список разделов. Список остаётся ниже на
 * этом же экране (см. `WorkspaceScreen`), но теперь не он открывает дом.
 */
class HomeViewModel(
    private val repository: AiRepository = AiRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(HomeUiState())
    val state: StateFlow<HomeUiState> = _state

    init {
        load()
    }

    fun load() {
        loadBriefing()
        loadAlerts()
    }

    private fun loadBriefing() {
        _state.update { it.copy(briefing = UiState.Loading) }
        viewModelScope.launch {
            runCatching { repository.briefing() }
                .onSuccess { b -> _state.update { it.copy(briefing = UiState.Data(b)) } }
                .onFailure { e ->
                    _state.update { it.copy(briefing = UiState.Error(e.message ?: "Не удалось получить брифинг")) }
                }
        }
    }

    private fun loadAlerts() {
        _state.update { it.copy(alerts = UiState.Loading) }
        viewModelScope.launch {
            runCatching { repository.proactive() }
                .onSuccess { a -> _state.update { it.copy(alerts = UiState.Data(a)) } }
                .onFailure { e ->
                    _state.update { it.copy(alerts = UiState.Error(e.message ?: "Не удалось получить тревоги")) }
                }
        }
    }

    /**
     * Тревога и брифинг не несут прямого пути — только имя действия
     * (`OpenSchedule`, `OpenCashier`, …). Путь резолвит сервер тем же
     * `/api/ai/action`, которым исполняются кнопки ассистента: одна точка
     * входа для «нажал» вместо двух параллельных.
     *
     * `type` в ответе — не «навигация или нет»: маршрут `/action` шлёт
     * `type:'navigate'` только для короткого списка алиасов (`OpenSchedule`
     * и т.п.), а для настоящего вызова инструмента с найденным путём —
     * `type:'created'` (см. `ai.routes.ts`: `type: result.navigate ? 'created' : 'data'`).
     * Поэтому решает не `type`, а сам факт, что `path` пришёл.
     */
    fun performAction(type: String) {
        viewModelScope.launch {
            runCatching { repository.action(type) }
                .onSuccess { result ->
                    when {
                        result.type == "error" -> _state.update { it.copy(message = result.message ?: "Не удалось выполнить действие") }
                        result.path != null -> _state.update { it.copy(pendingNavigatePath = result.path) }
                        else -> _state.update { it.copy(message = result.message ?: result.label ?: "Раздел пока доступен только в браузере") }
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
