package kz.dentvision.crm.ui.diagnostics

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.DiagnosticsRepository
import kz.dentvision.crm.data.model.Referral
import kz.dentvision.crm.navigation.LocalAssistantNavigate
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_REFERRALS
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_REFERRAL_NEW
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

data class ReferralListUiState(
    val items: UiState<List<Referral>> = UiState.Loading,
    val total: Int = 0,
)

/** Перенос `ReferralList.tsx`, урезанный до чтения: `GET /api/diagnostics/referrals`. */
class ReferralListViewModel(
    private val repository: DiagnosticsRepository = DiagnosticsRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(ReferralListUiState())
    val state: StateFlow<ReferralListUiState> = _state

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(items = UiState.Loading) }
        viewModelScope.launch {
            runCatching { repository.referrals() }
                .onSuccess { (items, total) -> _state.update { it.copy(items = UiState.Data(items), total = total) } }
                .onFailure { e -> _state.update { it.copy(items = UiState.Error(e.message ?: "Не удалось получить список направлений")) } }
        }
    }
}

@Composable
fun ReferralListScreen(viewModel: ReferralListViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val onNavigate = LocalAssistantNavigate.current

    Scaffold(
        containerColor = DvTheme.colors.surface0,
        floatingActionButton = {
            FloatingActionButton(
                onClick = { onNavigate(ROUTE_DIAGNOSTICS_REFERRAL_NEW) },
                containerColor = DvTheme.colors.gold,
                contentColor = DvTheme.colors.goldOn,
            ) {
                Icon(Icons.Filled.Add, contentDescription = "Новое направление")
            }
        },
    ) { padding ->
    Column(modifier = Modifier.fillMaxSize().padding(padding)) {
        when (val items = state.items) {
            is UiState.Loading -> LoadingSkeleton()
            is UiState.Error -> ErrorState(message = items.message, onRetry = viewModel::load)
            is UiState.Data -> if (items.value.isEmpty()) {
                EmptyStateView(
                    title = "Направлений нет",
                    description = "Здесь появятся направления, отправленные в диагностические центры и лаборатории.",
                )
            } else {
                Column {
                    if (state.total > items.value.size) {
                        Text(
                            text = "Показаны последние ${items.value.size} из ${state.total}",
                            style = MaterialTheme.typography.labelSmall,
                            color = DvTheme.colors.textMuted,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        )
                    }
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
    }
}
