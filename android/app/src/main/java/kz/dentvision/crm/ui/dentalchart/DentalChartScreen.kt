package kz.dentvision.crm.ui.dentalchart

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.CrmRepository
import kz.dentvision.crm.data.model.Patient
import kz.dentvision.crm.data.model.TOOTH_STATUS_LABELS
import kz.dentvision.crm.data.model.ToothState
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.PatientPickerSheet
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Ряды по системе FDI, как их рисует зубная карта в вебе: верхняя челюсть
 * справа налево, нижняя слева направо — так, как врач видит пациента напротив.
 */
private val UPPER = (18 downTo 11).map { it.toString() } + (21..28).map { it.toString() }
private val LOWER = (48 downTo 41).map { it.toString() } + (31..38).map { it.toString() }

class DentalChartViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<Patient>?>(null)
    val state: StateFlow<UiState<Patient>?> = _state

    private var patientId: String? = null

    fun selectPatient(patient: Patient) {
        patientId = patient.id
        load()
    }

    fun load() {
        val id = patientId ?: return
        _state.value = UiState.Loading
        viewModelScope.launch {
            // Формула приходит вместе с карточкой пациента — отдельного
            // маршрута под неё нет, и заводить свой было бы выдумкой.
            runCatching { repository.patient(id) }
                .onSuccess { _state.value = UiState.Data(it) }
                .onFailure { _state.value = UiState.Error(it.message ?: "Не удалось загрузить карту") }
        }
    }
}

/**
 * Зубная карта выбранного пациента — только чтение.
 *
 * Менять состояние зуба отсюда нельзя намеренно: в вебе это делается по
 * поверхностям зуба, и упрощённая правка «одним касанием» затёрла бы более
 * подробную запись, сделанную у кресла. Показать — можно и нужно.
 */
@Composable
fun DentalChartScreen(viewModel: DentalChartViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var picking by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf<Pair<String, ToothState>?>(null) }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        OutlinedButton(onClick = { picking = true }, modifier = Modifier.fillMaxWidth()) {
            val patient = (state as? UiState.Data)?.value
            Text(patient?.name?.ifBlank { "Без имени" } ?: "Выбрать пациента")
        }

        when (val current = state) {
            null -> EmptyStateView(
                title = "Пациент не выбран",
                description = "Зубная карта принадлежит конкретному человеку — выберите его выше.",
            )
            is UiState.Loading -> LoadingSkeleton(
                rows = 4,
                contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
            )
            is UiState.Error -> ErrorState(message = current.message, onRetry = viewModel::load)
            is UiState.Data -> {
                val teeth = current.value.teeth
                ToothRow(numbers = UPPER, teeth = teeth, onPick = { selected = it })
                ToothRow(numbers = LOWER, teeth = teeth, onPick = { selected = it })

                selected?.let { (number, tooth) ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
                        border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Text(
                                text = "Зуб $number",
                                style = MaterialTheme.typography.titleMedium,
                                color = DvTheme.colors.textPrimary,
                            )
                            Text(
                                text = TOOTH_STATUS_LABELS[tooth.status] ?: tooth.status ?: "Состояние не указано",
                                style = MaterialTheme.typography.bodyMedium,
                                color = statusColor(tooth.status),
                                modifier = Modifier.padding(top = 4.dp),
                            )
                            tooth.diagnosis?.takeIf { it.isNotBlank() }?.let {
                                Text(
                                    text = it,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = DvTheme.colors.textSecondary,
                                    modifier = Modifier.padding(top = 4.dp),
                                )
                            }
                            tooth.notes?.takeIf { it.isNotBlank() }?.let {
                                Text(
                                    text = it,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = DvTheme.colors.textMuted,
                                    modifier = Modifier.padding(top = 2.dp),
                                )
                            }
                        }
                    }
                }

                if (teeth.isEmpty()) {
                    Text(
                        text = "Формула пуста — у этого пациента ещё не отмечен ни один зуб.",
                        style = MaterialTheme.typography.bodySmall,
                        color = DvTheme.colors.textMuted,
                    )
                }
            }
        }
    }

    if (picking) {
        PatientPickerSheet(
            onDismiss = { picking = false },
            onSelect = { patient ->
                selected = null
                viewModel.selectPatient(patient)
                picking = false
            },
        )
    }
}

@Composable
private fun ToothRow(
    numbers: List<String>,
    teeth: Map<String, ToothState>,
    onPick: (Pair<String, ToothState>) -> Unit,
) {
    // Шестнадцать зубов в ряд на телефон не влезают читаемо, поэтому ряд
    // разбит пополам — по челюстной половине, как их и нумеруют.
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        numbers.chunked(8).forEach { half ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                half.forEach { number ->
                    val tooth = teeth[number]
                    ToothCell(
                        number = number,
                        tooth = tooth,
                        modifier = Modifier.weight(1f),
                        onClick = { onPick(number to (tooth ?: ToothState())) },
                    )
                }
            }
        }
    }
}

@Composable
private fun ToothCell(
    number: String,
    tooth: ToothState?,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val color = statusColor(tooth?.status)
    Box(
        modifier = modifier
            .size(38.dp)
            .clip(MaterialTheme.shapes.small)
            .background(color.copy(alpha = 0.18f))
            .border(1.dp, color.copy(alpha = 0.5f), MaterialTheme.shapes.small)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = number,
            style = MaterialTheme.typography.labelSmall,
            color = DvTheme.colors.textPrimary,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun statusColor(status: String?): Color = when (status) {
    null, "", "healthy" -> DvTheme.colors.textGhost
    "caries", "root" -> DvTheme.colors.error
    "treatment" -> DvTheme.colors.warning
    "filled", "crown", "bridge", "implant" -> DvTheme.colors.info
    "missing" -> DvTheme.colors.textMuted
    // Незнакомое состояние видно золотом, а не прячется под «здоров».
    else -> DvTheme.colors.gold
}
