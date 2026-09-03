package kz.dentvision.crm.ui.plans

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
import androidx.compose.runtime.LaunchedEffect
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
import kz.dentvision.crm.data.model.TreatmentPlan
import kz.dentvision.crm.lib.formatTenge
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

private val PLAN_STATUS_LABELS = mapOf(
    "draft" to "Черновик",
    "proposed" to "Предложен",
    "accepted" to "Принят",
    "in_progress" to "В работе",
    "completed" to "Завершён",
    "rejected" to "Отклонён",
)

class TreatmentPlansViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<List<TreatmentPlan>>>(UiState.Loading)
    val state: StateFlow<UiState<List<TreatmentPlan>>> = _state

    private var clinicId: String? = null

    fun start(clinicId: String?) {
        if (this.clinicId == clinicId && _state.value !is UiState.Loading) return
        this.clinicId = clinicId
        load()
    }

    fun load() {
        val clinic = clinicId
        if (clinic == null) {
            // Маршрут планов требует клинику в пути — без неё запрос слать некуда.
            _state.value = UiState.Error("Клиника не выбрана")
            return
        }
        _state.value = UiState.Loading
        viewModelScope.launch {
            runCatching { repository.treatmentPlans(clinic) }
                .onSuccess { _state.value = UiState.Data(it) }
                .onFailure { _state.value = UiState.Error(it.message ?: "Не удалось загрузить планы") }
        }
    }
}

/** Планы лечения клиники: кому, на что и на какую сумму. */
@Composable
fun TreatmentPlansScreen(
    clinicId: String?,
    viewModel: TreatmentPlansViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(clinicId) { viewModel.start(clinicId) }

    Column(modifier = Modifier.fillMaxSize()) {
        when (val list = state) {
            is UiState.Loading -> LoadingSkeleton()
            is UiState.Error -> ErrorState(message = list.message, onRetry = viewModel::load)
            is UiState.Data -> if (list.value.isEmpty()) {
                EmptyStateView(
                    title = "Планов лечения нет",
                    description = "План собирается из услуг прайса и показывается пациенту.",
                )
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(list.value, key = { it.id }) { plan ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
                            border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(
                                        text = plan.title.ifBlank { "План лечения" },
                                        style = MaterialTheme.typography.titleMedium,
                                        color = DvTheme.colors.textPrimary,
                                    )
                                    plan.totalBudget?.takeIf { it > 0 }?.let {
                                        Text(
                                            text = formatTenge(it),
                                            style = MaterialTheme.typography.titleMedium,
                                            color = DvTheme.colors.gold,
                                        )
                                    }
                                }
                                val sub = listOfNotNull(
                                    plan.patientName?.takeIf { it.isNotBlank() },
                                    PLAN_STATUS_LABELS[plan.status] ?: plan.status.takeIf { it.isNotBlank() },
                                    plan.teeth.takeIf { it.isNotEmpty() }?.let { "зубы ${it.joinToString(", ")}" },
                                ).joinToString(" · ")
                                if (sub.isNotBlank()) {
                                    Text(
                                        text = sub,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = DvTheme.colors.textMuted,
                                        modifier = Modifier.padding(top = 4.dp),
                                    )
                                }
                                plan.diagnosis?.takeIf { it.isNotBlank() }?.let {
                                    Text(
                                        text = it,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = DvTheme.colors.textSecondary,
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
