package kz.dentvision.crm.ui.marketing

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.MarketingRepository
import kz.dentvision.crm.data.model.MarketingContext
import kz.dentvision.crm.data.model.PlanSummary
import kz.dentvision.crm.ui.common.UiState

val MARKETING_TONES = listOf(
    "спокойная, профессиональная, без давления" to "Спокойная и профессиональная",
    "тёплая и человечная, от первого лица" to "Тёплая, от первого лица",
    "короткая и энергичная, без воды" to "Короткая и энергичная",
    "экспертная, с опорой на цифры" to "Экспертная, с цифрами",
)

data class MarketingUiState(
    val context: UiState<MarketingContext> = UiState.Loading,
    val plans: UiState<List<PlanSummary>> = UiState.Loading,
    val count: Int = 6,
    val tone: String = MARKETING_TONES.first().first,
    val generating: Boolean = false,
    val message: String? = null,
    val deleteError: String? = null,
)

class MarketingViewModel(
    private val repository: MarketingRepository = MarketingRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(MarketingUiState())
    val state: StateFlow<MarketingUiState> = _state

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(context = UiState.Loading, plans = UiState.Loading) }
        viewModelScope.launch {
            coroutineScope {
                val ctxDeferred = async { runCatching { repository.context() } }
                val plansDeferred = async { runCatching { repository.plans() } }
                ctxDeferred.await()
                    .onSuccess { data -> _state.update { it.copy(context = UiState.Data(data)) } }
                    .onFailure { _state.update { s -> s.copy(context = UiState.Error(it.message ?: "Не удалось собрать данные клиники")) } }
                plansDeferred.await()
                    .onSuccess { data -> _state.update { it.copy(plans = UiState.Data(data)) } }
                    .onFailure { _state.update { s -> s.copy(plans = UiState.Error(it.message ?: "Не удалось загрузить планы")) } }
            }
        }
    }

    fun updateCount(count: Int) = _state.update { it.copy(count = count) }
    fun updateTone(tone: String) = _state.update { it.copy(tone = tone) }

    fun generate(onDone: (String) -> Unit) {
        _state.update { it.copy(generating = true) }
        viewModelScope.launch {
            runCatching { repository.generatePlan(_state.value.count, _state.value.tone) }
                .onSuccess { plan ->
                    _state.update { it.copy(generating = false) }
                    load()
                    onDone(plan.id)
                }
                .onFailure { e -> _state.update { it.copy(generating = false, message = e.message ?: "Не удалось собрать план") } }
        }
    }

    fun delete(id: String) {
        viewModelScope.launch {
            runCatching { repository.deletePlan(id) }
                .onSuccess { load() }
                .onFailure { e -> _state.update { it.copy(deleteError = e.message ?: "Не удалось удалить план") } }
        }
    }

    fun consumeMessage() = _state.update { it.copy(message = null) }
    fun consumeDeleteError() = _state.update { it.copy(deleteError = null) }
}
