package kz.dentvision.crm.ui.diagnostics

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.DiagnosticsRepository
import kz.dentvision.crm.data.model.Referral
import kz.dentvision.crm.navigation.LocalAssistantNavigate
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_REFERRALS
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState

data class ResultsUiState(
    val items: UiState<List<Referral>> = UiState.Loading,
    /** "" (все, как на вебе — `statusFilter=''` не фильтрует вовсе), COMPLETED, REVIEWED. */
    val statusFilter: String = "",
    val query: String = "",
)

/**
 * Перенос `ResultList.tsx`. «Все результаты» на вебе шлёт пустой
 * `status` — обработчик (`diagnostics.routes.ts:253`) применяет фильтр,
 * только когда значение непустое, так что «все» буквально значит «все
 * направления», а не «все завершённые». Переношу это поведение как есть,
 * а не то, что подсказывает заголовок экрана.
 */
class ResultsViewModel(
    private val repository: DiagnosticsRepository = DiagnosticsRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(ResultsUiState())
    val state: StateFlow<ResultsUiState> = _state
    private var searchJob: Job? = null

    init {
        load()
    }

    fun setStatusFilter(status: String) {
        _state.update { it.copy(statusFilter = status) }
        load()
    }

    fun onQueryChange(value: String) {
        _state.update { it.copy(query = value) }
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(300)
            load()
        }
    }

    fun load() {
        _state.update { it.copy(items = UiState.Loading) }
        viewModelScope.launch {
            val f = _state.value
            runCatching { repository.referrals(status = f.statusFilter.ifBlank { null }, search = f.query.ifBlank { null }) }
                .onSuccess { (items, _) -> _state.update { it.copy(items = UiState.Data(items)) } }
                .onFailure { e -> _state.update { it.copy(items = UiState.Error(e.message ?: "Не удалось получить результаты")) } }
        }
    }
}

@Composable
fun ResultsScreen(viewModel: ResultsViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val onNavigate = LocalAssistantNavigate.current

    Column(modifier = Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = state.query,
            onValueChange = viewModel::onQueryChange,
            singleLine = true,
            label = { Text("Поиск по пациенту") },
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(horizontal = 16.dp),
        ) {
            FilterChip(
                selected = state.statusFilter.isEmpty(),
                onClick = { viewModel.setStatusFilter("") },
                label = { Text("Все результаты") },
            )
            FilterChip(
                selected = state.statusFilter == "COMPLETED",
                onClick = { viewModel.setStatusFilter("COMPLETED") },
                label = { Text("Готово") },
            )
            FilterChip(
                selected = state.statusFilter == "REVIEWED",
                onClick = { viewModel.setStatusFilter("REVIEWED") },
                label = { Text("Просмотрено") },
            )
        }

        when (val items = state.items) {
            is UiState.Loading -> LoadingSkeleton()
            is UiState.Error -> ErrorState(message = items.message, onRetry = viewModel::load)
            is UiState.Data -> if (items.value.isEmpty()) {
                EmptyStateView(title = "Нет завершённых исследований")
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(items.value, key = { it.id }) { referral ->
                        ReferralRow(
                            referral = referral,
                            onClick = { onNavigate("$ROUTE_DIAGNOSTICS_REFERRALS/${referral.id}") },
                        )
                    }
                }
            }
        }
    }
}
