package kz.dentvision.crm.ui.diagnostics

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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.DiagnosticsRepository
import kz.dentvision.crm.data.model.DiagnosticOrg
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

enum class DiagnosticOrgKind { CENTER, LABORATORY }

/** По образцу `ui/common/PatientPicker.kt`: одна и та же выборка для центра и лаборатории. */
class DiagnosticOrgPickerViewModel(
    private val repository: DiagnosticsRepository = DiagnosticsRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<List<DiagnosticOrg>>>(UiState.Loading)
    val state: StateFlow<UiState<List<DiagnosticOrg>>> = _state

    private var all: List<DiagnosticOrg> = emptyList()
    private var loadedKind: DiagnosticOrgKind? = null

    fun ensureLoaded(kind: DiagnosticOrgKind) {
        if (loadedKind == kind) return
        loadedKind = kind
        load(kind)
    }

    fun load(kind: DiagnosticOrgKind) {
        _state.value = UiState.Loading
        viewModelScope.launch {
            runCatching {
                if (kind == DiagnosticOrgKind.CENTER) repository.centers() else repository.laboratories()
            }
                .onSuccess { all = it; _state.value = UiState.Data(it) }
                .onFailure { _state.value = UiState.Error(it.message ?: "Не удалось загрузить список") }
        }
    }

    fun filter(query: String) {
        val q = query.trim().lowercase()
        val list = if (q.isEmpty()) all else all.filter {
            it.name.lowercase().contains(q) || (it.city ?: "").lowercase().contains(q)
        }
        _state.value = UiState.Data(list)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DiagnosticOrgPickerSheet(
    kind: DiagnosticOrgKind,
    onDismiss: () -> Unit,
    onSelect: (DiagnosticOrg) -> Unit,
    viewModel: DiagnosticOrgPickerViewModel = viewModel(),
) {
    viewModel.ensureLoaded(kind)
    val state by viewModel.state.collectAsStateWithLifecycle()
    var query by remember { mutableStateOf("") }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DvTheme.colors.surface1,
    ) {
        Column(modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 16.dp)) {
            Text(
                text = if (kind == DiagnosticOrgKind.CENTER) "Диагностический центр" else "Лаборатория",
                style = MaterialTheme.typography.titleMedium,
                color = DvTheme.colors.textPrimary,
                modifier = Modifier.padding(bottom = 8.dp),
            )
            OutlinedTextField(
                value = query,
                onValueChange = { query = it; viewModel.filter(it) },
                singleLine = true,
                label = { Text("Название или город") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                modifier = Modifier.fillMaxWidth(),
            )

            when (val list = state) {
                is UiState.Loading -> LoadingSkeleton(rows = 4)
                is UiState.Error -> ErrorState(message = list.message, onRetry = { viewModel.load(kind) })
                is UiState.Data -> if (list.value.isEmpty()) {
                    Text(
                        text = "Ничего не нашли",
                        style = MaterialTheme.typography.bodyMedium,
                        color = DvTheme.colors.textMuted,
                        modifier = Modifier.padding(vertical = 24.dp),
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.heightIn(max = 420.dp),
                        contentPadding = PaddingValues(vertical = 8.dp),
                    ) {
                        items(list.value, key = { it.id }) { org ->
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onSelect(org) }
                                    .padding(vertical = 12.dp),
                            ) {
                                Text(
                                    text = org.name.ifBlank { "Без названия" },
                                    style = MaterialTheme.typography.bodyLarge,
                                    color = DvTheme.colors.textPrimary,
                                )
                                org.city?.takeIf { it.isNotBlank() }?.let {
                                    Text(text = it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
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
