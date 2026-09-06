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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_REFERRAL_NEW
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvOutlineButton
import kz.dentvision.crm.ui.theme.DvSpacing
import kz.dentvision.crm.ui.theme.DvTheme

private const val PAGE_SIZE = 50

data class ReferralListUiState(
    val items: UiState<List<Referral>> = UiState.Loading,
    val total: Int = 0,
    val query: String = "",
    /** "" = все статусы — тот же контракт, что у `ResultsScreen`: пустая строка не фильтрует. */
    val statusFilter: String = "",
    val loadingMore: Boolean = false,
)

/**
 * Перенос `ReferralList.tsx`, урезанный до чтения: `GET /api/diagnostics/referrals`.
 *
 * Поиск и фильтр по статусу раньше были только на «Результатах» — том же
 * списке, отфильтрованном по завершённым. «Все направления» с домашнего
 * экрана давал ровно первую полусотню без единого способа найти конкретного
 * пациента среди остальных. Сервер уже принимал `search`/`status`/`offset` —
 * не хватало только их передать.
 */
class ReferralListViewModel(
    private val repository: DiagnosticsRepository = DiagnosticsRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(ReferralListUiState())
    val state: StateFlow<ReferralListUiState> = _state
    private var searchJob: Job? = null

    init {
        load()
    }

    fun setQuery(value: String) {
        _state.update { it.copy(query = value) }
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(300)
            load()
        }
    }

    fun setStatusFilter(status: String) {
        if (status == _state.value.statusFilter) return
        _state.update { it.copy(statusFilter = status) }
        load()
    }

    fun load() {
        _state.update { it.copy(items = UiState.Loading) }
        viewModelScope.launch {
            val f = _state.value
            runCatching {
                repository.referrals(
                    status = f.statusFilter.ifBlank { null },
                    search = f.query.ifBlank { null },
                    limit = PAGE_SIZE,
                )
            }
                .onSuccess { (items, total) -> _state.update { it.copy(items = UiState.Data(items), total = total) } }
                .onFailure { e -> _state.update { it.copy(items = UiState.Error(e.message ?: "Не удалось получить список направлений")) } }
        }
    }

    /** Следующая полусотня поверх уже показанной — а не замена списка, чтобы не терять прокрутку. */
    fun loadMore() {
        val current = (_state.value.items as? UiState.Data)?.value ?: return
        if (_state.value.loadingMore || current.size >= _state.value.total) return
        _state.update { it.copy(loadingMore = true) }
        viewModelScope.launch {
            val f = _state.value
            runCatching {
                repository.referrals(
                    status = f.statusFilter.ifBlank { null },
                    search = f.query.ifBlank { null },
                    limit = PAGE_SIZE,
                    offset = current.size,
                )
            }
                .onSuccess { (more, total) ->
                    _state.update { it.copy(items = UiState.Data(current + more), total = total, loadingMore = false) }
                }
                .onFailure { _state.update { it.copy(loadingMore = false) } }
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
            OutlinedTextField(
                value = state.query,
                onValueChange = viewModel::setQuery,
                singleLine = true,
                label = { Text("Поиск по пациенту") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                modifier = Modifier.fillMaxWidth().padding(horizontal = DvSpacing.lg, vertical = DvSpacing.sm),
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(DvSpacing.sm),
                modifier = Modifier.padding(horizontal = DvSpacing.lg),
            ) {
                FilterChip(
                    selected = state.statusFilter.isEmpty(),
                    onClick = { viewModel.setStatusFilter("") },
                    label = { Text("Все") },
                )
                REFERRAL_LIST_STATUS_FILTERS.forEach { (value, label) ->
                    FilterChip(
                        selected = state.statusFilter == value,
                        onClick = { viewModel.setStatusFilter(value) },
                        label = { Text(label) },
                    )
                }
            }

            when (val items = state.items) {
                is UiState.Loading -> LoadingSkeleton()
                is UiState.Error -> ErrorState(message = items.message, onRetry = viewModel::load)
                is UiState.Data -> if (items.value.isEmpty()) {
                    EmptyStateView(
                        title = if (state.query.isBlank() && state.statusFilter.isBlank()) {
                            "Направлений нет"
                        } else {
                            "Ничего не найдено"
                        },
                        description = if (state.query.isBlank() && state.statusFilter.isBlank()) {
                            "Здесь появятся направления, отправленные в диагностические центры и лаборатории."
                        } else {
                            "Измените запрос или фильтр."
                        },
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(DvSpacing.lg),
                        verticalArrangement = Arrangement.spacedBy(DvSpacing.sm),
                    ) {
                        items(items.value, key = { it.id }) { referral ->
                            ReferralRow(
                                referral = referral,
                                onClick = { onNavigate("$ROUTE_DIAGNOSTICS_REFERRALS/${referral.id}") },
                            )
                        }
                        if (items.value.size < state.total) {
                            item {
                                DvOutlineButton(
                                    onClick = viewModel::loadMore,
                                    enabled = !state.loadingMore,
                                    modifier = Modifier.fillMaxWidth().padding(top = DvSpacing.sm),
                                ) {
                                    Text(
                                        if (state.loadingMore) {
                                            "Загрузка…"
                                        } else {
                                            "Показать ещё (${state.total - items.value.size})"
                                        },
                                        style = MaterialTheme.typography.labelMedium,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Не все одиннадцать статусов — только по одному на стадию воронки
 * (`referralPhase` в `ReferralStatus.kt`), иначе ряд фильтров не влезает и
 * дублирует смысл: разница между «Принято» и «Пациент прибыл» здесь не
 * важна, важно «на какой стадии».
 */
private val REFERRAL_LIST_STATUS_FILTERS = listOf(
    "SENT" to referralStatusLabel("SENT"),
    "ACCEPTED" to referralStatusLabel("ACCEPTED"),
    "IN_PROGRESS" to referralStatusLabel("IN_PROGRESS"),
    "COMPLETED" to referralStatusLabel("COMPLETED"),
)
