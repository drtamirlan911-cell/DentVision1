package kz.dentvision.crm.ui.workflow

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.CrmRepository
import kz.dentvision.crm.data.model.Workflow
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

class WorkflowViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<List<Workflow>>>(UiState.Loading)
    val state: StateFlow<UiState<List<Workflow>>> = _state

    init {
        load()
    }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            runCatching { repository.workflows() }
                .onSuccess { _state.value = UiState.Data(it) }
                .onFailure { _state.value = UiState.Error(it.message ?: "Не удалось загрузить сценарии") }
        }
    }
}

/**
 * Автоматизация: какие сценарии заведены и работают ли они.
 *
 * Только список. Сценарий описывается графом узлов — его сборка на телефоне
 * была бы отдельным редактором, а показать «что вообще включено» полезно уже
 * сейчас.
 */
@Composable
fun WorkflowScreen(viewModel: WorkflowViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Column(modifier = Modifier.fillMaxSize()) {
        when (val list = state) {
            is UiState.Loading -> LoadingSkeleton()
            is UiState.Error -> ErrorState(message = list.message, onRetry = viewModel::load)
            is UiState.Data -> if (list.value.isEmpty()) {
                EmptyStateView(
                    title = "Сценариев нет",
                    description = "Автоматизация запускает действия по событиям — например, напоминание после приёма.",
                )
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(list.value, key = { it.id }) { workflow ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(14.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column {
                                    Text(
                                        text = workflow.name.ifBlank { "Без названия" },
                                        style = MaterialTheme.typography.titleMedium,
                                        color = DvTheme.colors.textPrimary,
                                    )
                                    Text(
                                        text = "Событие: ${workflow.trigger}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = DvTheme.colors.textMuted,
                                        modifier = Modifier.padding(top = 2.dp),
                                    )
                                }
                                Text(
                                    text = if (workflow.status == "active") "Работает" else "Черновик",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = if (workflow.status == "active") {
                                        DvTheme.colors.success
                                    } else {
                                        DvTheme.colors.textGhost
                                    },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
