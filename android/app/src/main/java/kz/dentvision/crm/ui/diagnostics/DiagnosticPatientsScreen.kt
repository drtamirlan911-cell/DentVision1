package kz.dentvision.crm.ui.diagnostics

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.DiagnosticsRepository
import kz.dentvision.crm.data.model.Referral
import kz.dentvision.crm.navigation.LocalAssistantNavigate
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_REFERRALS
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

data class DiagnosticPatient(
    val key: String,
    val name: String,
    val phone: String?,
    val iin: String?,
    val referrals: List<Referral>,
)

/**
 * Перенос `DiagnosticPatients.tsx` — своей ручки нет, пациенты собираются
 * группировкой уже загруженного списка направлений по `patientId ||
 * patientName`, дословно как в `useMemo` на вебе.
 */
class DiagnosticPatientsViewModel(
    private val repository: DiagnosticsRepository = DiagnosticsRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<List<DiagnosticPatient>>>(UiState.Loading)
    val state: StateFlow<UiState<List<DiagnosticPatient>>> = _state
    private var all: List<DiagnosticPatient> = emptyList()

    init {
        load()
    }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            runCatching { repository.referrals() }
                .onSuccess { (items, _) ->
                    all = group(items)
                    _state.value = UiState.Data(all)
                }
                .onFailure { _state.value = UiState.Error(it.message ?: "Не удалось получить пациентов") }
        }
    }

    fun filter(query: String) {
        val q = query.trim().lowercase()
        val list = if (q.isEmpty()) {
            all
        } else {
            all.filter { it.name.lowercase().contains(q) || (it.phone ?: "").contains(q) }
        }
        _state.value = UiState.Data(list)
    }

    private fun group(referrals: List<Referral>): List<DiagnosticPatient> {
        val order = LinkedHashMap<String, MutableList<Referral>>()
        for (r in referrals) {
            val key = r.patientId ?: r.patientName.ifBlank { null } ?: continue
            order.getOrPut(key) { mutableListOf() }.add(r)
        }
        return order.map { (key, list) ->
            val first = list.first()
            DiagnosticPatient(
                key = key,
                name = first.patientName.ifBlank { "Неизвестно" },
                phone = first.patientPhone,
                iin = first.patientIin,
                referrals = list,
            )
        }
    }
}

@Composable
fun DiagnosticPatientsScreen(viewModel: DiagnosticPatientsViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val onNavigate = LocalAssistantNavigate.current
    var query by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it; viewModel.filter(it) },
            singleLine = true,
            label = { Text("Поиск по имени или телефону") },
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        )

        when (val items = state) {
            is UiState.Loading -> LoadingSkeleton()
            is UiState.Error -> ErrorState(message = items.message, onRetry = viewModel::load)
            is UiState.Data -> if (items.value.isEmpty()) {
                EmptyStateView(title = if (query.isBlank()) "Нет пациентов" else "Ничего не нашли")
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(items.value, key = { it.key }) { patient ->
                        // Тем же ключом, что на вебе: последний элемент массива —
                        // список приходит отсортированным по убыванию даты, так
                        // что при group-порядке это самое старое направление
                        // пациента, а не самое новое (веб называет его lastRef,
                        // но открывает именно этот элемент — переношу как есть).
                        val target = patient.referrals.last()
                        PatientRow(
                            patient = patient,
                            onClick = { onNavigate("$ROUTE_DIAGNOSTICS_REFERRALS/${target.id}") },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PatientRow(patient: DiagnosticPatient, onClick: () -> Unit) {
    val activeCount = patient.referrals.count { it.status == "IN_PROGRESS" || it.status == "ACCEPTED" }
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(DvTheme.colors.gold.copy(alpha = 0.1f)),
                ) {
                    Text(
                        text = patient.name.take(1).uppercase(),
                        style = MaterialTheme.typography.titleMedium,
                        color = DvTheme.colors.gold,
                    )
                }
                Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                    Text(text = patient.name, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                    val sub = listOfNotNull(
                        patient.phone?.takeIf { it.isNotBlank() },
                        patient.iin?.takeIf { it.isNotBlank() },
                        "${patient.referrals.size} направлений",
                    ).joinToString(" · ")
                    Text(text = sub, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
                }
                if (activeCount > 0) {
                    Text(
                        text = "$activeCount активн.",
                        style = MaterialTheme.typography.labelSmall,
                        color = DvTheme.colors.warning,
                    )
                }
            }
            Row(modifier = Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                patient.referrals.takeLast(3).forEach { r -> StatusChip(r.status) }
            }
        }
    }
}
