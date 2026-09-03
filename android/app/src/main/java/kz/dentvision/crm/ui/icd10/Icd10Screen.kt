package kz.dentvision.crm.ui.icd10

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
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
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.CrmRepository
import kz.dentvision.crm.data.model.Icd10Code
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Справочник МКБ-10.
 *
 * Поиск идёт на сервер, а не по загруженному списку: без запроса маршрут
 * отдаёт первые 300 кодов, а полный классификатор в память телефона тянуть
 * незачем — и не нужно, раз бэкенд уже умеет искать по коду, описанию и
 * категории.
 */
class Icd10ViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<List<Icd10Code>>>(UiState.Loading)
    val state: StateFlow<UiState<List<Icd10Code>>> = _state

    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query

    private var job: Job? = null

    init {
        search("")
    }

    fun onQueryChange(value: String) {
        _query.value = value
        job?.cancel()
        job = viewModelScope.launch {
            // Пауза, чтобы не слать запрос на каждую букву.
            delay(300)
            search(value)
        }
    }

    fun retry() {
        search(_query.value)
    }

    private fun search(query: String) {
        _state.value = UiState.Loading
        viewModelScope.launch {
            runCatching { repository.icd10(query.trim().ifBlank { null }) }
                .onSuccess { _state.value = UiState.Data(it) }
                .onFailure { _state.value = UiState.Error(it.message ?: "Справочник недоступен") }
        }
    }
}

@Composable
fun Icd10Screen(viewModel: Icd10ViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val query by viewModel.query.collectAsStateWithLifecycle()

    Column(modifier = Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = query,
            onValueChange = viewModel::onQueryChange,
            singleLine = true,
            label = { Text("Код, диагноз или раздел") },
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
            modifier = Modifier.fillMaxWidth().padding(16.dp),
        )

        when (val list = state) {
            is UiState.Loading -> LoadingSkeleton()
            is UiState.Error -> ErrorState(message = list.message, onRetry = viewModel::retry)
            is UiState.Data -> if (list.value.isEmpty()) {
                EmptyStateView(title = "Ничего не нашли")
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    items(list.value, key = { it.code }) { code ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
                            border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(
                                    text = code.code,
                                    style = MaterialTheme.typography.labelLarge,
                                    color = DvTheme.colors.gold,
                                )
                                Text(
                                    text = code.description,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = DvTheme.colors.textPrimary,
                                    modifier = Modifier.padding(top = 2.dp),
                                )
                                code.category?.takeIf { it.isNotBlank() }?.let {
                                    Text(
                                        text = it,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = DvTheme.colors.textMuted,
                                        modifier = Modifier.padding(top = 2.dp),
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
