package kz.dentvision.crm.ui.common

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
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
import kz.dentvision.crm.data.model.Patient
import kz.dentvision.crm.lib.normalizeIin
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Выбор пациента — один и тот же жест в расписании, медкарте и визитах.
 *
 * Поиск ведёт себя так же, как на экране пациентов: полный ИИН уходит на
 * сервер, остальное фильтруется по загруженному списку. Разное поведение в
 * разных местах приложения путало бы сильнее, чем любая экономия кода.
 */
class PatientPickerViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<List<Patient>>>(UiState.Loading)
    val state: StateFlow<UiState<List<Patient>>> = _state

    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query

    private var all: List<Patient> = emptyList()
    private var searchJob: Job? = null

    init {
        load()
    }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            runCatching { repository.patients() }
                .onSuccess {
                    all = it
                    _state.value = UiState.Data(filter(it, _query.value))
                }
                .onFailure {
                    _state.value = UiState.Error(it.message ?: "Не удалось загрузить пациентов")
                }
        }
    }

    fun onQueryChange(value: String) {
        _query.value = value
        searchJob?.cancel()
        val digits = normalizeIin(value)
        if (digits.length == 12) {
            searchJob = viewModelScope.launch {
                delay(300)
                runCatching { repository.searchPatients(digits) }
                    .onSuccess { _state.value = UiState.Data(it) }
                    .onFailure { _state.value = UiState.Error(it.message ?: "Поиск не удался") }
            }
            return
        }
        _state.value = UiState.Data(filter(all, value))
    }

    private fun filter(source: List<Patient>, query: String): List<Patient> {
        val q = query.trim().lowercase()
        if (q.isEmpty()) return source
        return source.filter {
            it.name.lowercase().contains(q) || it.phone.lowercase().contains(q)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PatientPickerSheet(
    onDismiss: () -> Unit,
    onSelect: (Patient) -> Unit,
    viewModel: PatientPickerViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val query by viewModel.query.collectAsStateWithLifecycle()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DvTheme.colors.surface1,
    ) {
        Column(modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 16.dp)) {
            Text(
                text = "Выберите пациента",
                style = MaterialTheme.typography.titleMedium,
                color = DvTheme.colors.textPrimary,
                modifier = Modifier.padding(bottom = 8.dp),
            )
            OutlinedTextField(
                value = query,
                onValueChange = viewModel::onQueryChange,
                singleLine = true,
                label = { Text("Имя, телефон или полный ИИН") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                modifier = Modifier.fillMaxWidth(),
            )

            when (val list = state) {
                is UiState.Loading -> LoadingSkeleton(rows = 4)
                is UiState.Error -> ErrorState(message = list.message, onRetry = viewModel::load)
                is UiState.Data -> if (list.value.isEmpty()) {
                    Text(
                        text = "Никого не нашли",
                        style = MaterialTheme.typography.bodyMedium,
                        color = DvTheme.colors.textMuted,
                        modifier = Modifier.padding(vertical = 24.dp),
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.heightIn(max = 420.dp),
                        contentPadding = PaddingValues(vertical = 8.dp),
                    ) {
                        items(list.value, key = { it.id }) { patient ->
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onSelect(patient) }
                                    .padding(vertical = 12.dp),
                            ) {
                                Text(
                                    text = patient.name.ifBlank { "Без имени" },
                                    style = MaterialTheme.typography.bodyLarge,
                                    color = DvTheme.colors.textPrimary,
                                )
                                val sub = listOfNotNull(
                                    patient.phone.ifBlank { null },
                                    patient.iin.ifBlank { null }?.let { "ИИН $it" },
                                ).joinToString(" · ")
                                if (sub.isNotBlank()) {
                                    Text(
                                        text = sub,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = DvTheme.colors.textMuted,
                                    )
                                }
                            }
                            HorizontalDivider(color = DvTheme.colors.borderSubtle)
                        }
                    }
                }
            }
        }
    }
}
