package kz.dentvision.crm.ui.finance

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.CrmRepository
import kz.dentvision.crm.data.model.FinanceReport
import kz.dentvision.crm.ui.common.UiState
import java.time.LocalDate

/** Периоды, которые реально спрашивают: сегодня, неделя, месяц. */
enum class FinancePeriod(val label: String) {
    TODAY("Сегодня"),
    WEEK("7 дней"),
    MONTH("30 дней"),
    ;

    fun from(today: LocalDate): LocalDate = when (this) {
        TODAY -> today
        WEEK -> today.minusDays(6)
        MONTH -> today.minusDays(29)
    }
}

data class FinanceUiState(
    val period: FinancePeriod = FinancePeriod.TODAY,
    val report: UiState<FinanceReport> = UiState.Loading,
)

class FinanceViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(FinanceUiState())
    val state: StateFlow<FinanceUiState> = _state

    init {
        load()
    }

    fun selectPeriod(period: FinancePeriod) {
        _state.value = _state.value.copy(period = period)
        load()
    }

    fun load() {
        _state.value = _state.value.copy(report = UiState.Loading)
        val today = LocalDate.now()
        val from = _state.value.period.from(today).atStartOfDay().toString()
        // Верхняя граница — конец сегодняшнего дня: иначе сегодняшние оплаты,
        // прошедшие после полуночного среза, в отчёт бы не попали.
        val to = today.plusDays(1).atStartOfDay().toString()
        viewModelScope.launch {
            runCatching { repository.financeReport(from = from, to = to) }
                .onSuccess { _state.value = _state.value.copy(report = UiState.Data(it)) }
                .onFailure {
                    _state.value = _state.value.copy(
                        report = UiState.Error(it.message ?: "Не удалось построить отчёт"),
                    )
                }
        }
    }
}
