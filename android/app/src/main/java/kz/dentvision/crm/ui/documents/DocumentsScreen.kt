package kz.dentvision.crm.ui.documents

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import kz.dentvision.crm.data.model.Document
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

class DocumentsViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<List<Document>>>(UiState.Loading)
    val state: StateFlow<UiState<List<Document>>> = _state

    init {
        load()
    }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            runCatching { repository.documents(null) }
                .onSuccess { _state.value = UiState.Data(it) }
                .onFailure { _state.value = UiState.Error(it.message ?: "Не удалось загрузить документы") }
        }
    }
}

/**
 * Документы клиники: договоры, согласия, выписки.
 *
 * Только список. Открыть и подписать документ на телефоне пока нельзя: текст
 * хранится закодированным в поле `url` как `data:`-строка, а печать и подпись
 * в вебе завязаны на браузерные диалоги, которым на Android нет прямого
 * соответствия. Показывать кнопку, которая ничего не делает, хуже, чем честно
 * её не иметь.
 */
@Composable
fun DocumentsScreen(viewModel: DocumentsViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Column(modifier = Modifier.fillMaxSize()) {
        when (val list = state) {
            is UiState.Loading -> LoadingSkeleton()
            is UiState.Error -> ErrorState(message = list.message, onRetry = viewModel::load)
            is UiState.Data -> if (list.value.isEmpty()) {
                EmptyStateView(
                    title = "Документов нет",
                    description = "Договоры и согласия появятся здесь, как только их создадут.",
                )
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(list.value, key = { it.id }) { doc ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
                            border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Text(
                                    text = doc.displayTitle,
                                    style = MaterialTheme.typography.titleMedium,
                                    color = DvTheme.colors.textPrimary,
                                )
                                val sub = listOfNotNull(
                                    doc.patientName.takeIf { it.isNotBlank() },
                                    doc.docType ?: doc.type,
                                    doc.createdAt?.take(10),
                                ).joinToString(" · ")
                                if (sub.isNotBlank()) {
                                    Text(
                                        text = sub,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = DvTheme.colors.textMuted,
                                        modifier = Modifier.padding(top = 4.dp),
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
