package kz.dentvision.crm.ui.medcard

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kz.dentvision.crm.data.model.MedicalHistory
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.PatientPickerSheet
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Медкарта выбранного пациента.
 *
 * Отдельной таблицы под неё на схеме нет — поля лежат в JSON-колонке
 * `Patient.medicalHistory`. Это решение бэкенда, и клиент его повторяет, а не
 * обходит.
 */
@Composable
fun MedicalCardScreen(
    canWrite: Boolean,
    viewModel: MedicalCardViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var picking by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .imePadding()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        OutlinedButton(onClick = { picking = true }, modifier = Modifier.fillMaxWidth()) {
            Text(state.patient?.name?.ifBlank { "Без имени" } ?: "Выбрать пациента")
        }

        when (val card = state.card) {
            is UiState.Loading -> LoadingSkeleton(rows = 5, contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp))
            is UiState.Error -> ErrorState(message = card.message, onRetry = viewModel::load)
            is UiState.Data -> if (state.patient == null) {
                EmptyStateView(
                    title = "Пациент не выбран",
                    description = "Медкарта открывается для конкретного человека — выберите его выше.",
                )
            } else {
                CardFields(
                    draft = state.draft,
                    enabled = canWrite && !state.saving,
                    onEdit = viewModel::edit,
                )

                state.error?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall,
                        color = DvTheme.colors.error,
                    )
                }
                if (state.saved) {
                    Text(
                        text = "Сохранено",
                        style = MaterialTheme.typography.bodySmall,
                        color = DvTheme.colors.success,
                    )
                }

                if (canWrite) {
                    Button(
                        onClick = viewModel::save,
                        enabled = !state.saving,
                        modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                    ) {
                        if (state.saving) {
                            CircularProgressIndicator(
                                strokeWidth = 2.dp,
                                color = DvTheme.colors.goldOn,
                                modifier = Modifier.size(18.dp),
                            )
                        } else {
                            Text("Сохранить карту")
                        }
                    }
                } else {
                    Text(
                        text = "У вашей роли доступ к карте только на чтение.",
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
                viewModel.selectPatient(patient)
                picking = false
            },
        )
    }
}

@Composable
private fun CardFields(
    draft: MedicalHistory,
    enabled: Boolean,
    onEdit: ((MedicalHistory) -> MedicalHistory) -> Unit,
) {
    // Порядок полей — как на вебе: сперва то, что спасает в неотложной
    // ситуации (аллергии, группа крови, экстренный контакт), потом анамнез,
    // потом страховка.
    Field("Аллергии", draft.allergies, enabled) { v -> onEdit { it.copy(allergies = v) } }
    Field("Группа крови", draft.bloodType, enabled) { v -> onEdit { it.copy(bloodType = v) } }
    Field("Экстренный контакт", draft.emergencyContact, enabled) { v -> onEdit { it.copy(emergencyContact = v) } }
    Field("Телефон экстренного контакта", draft.emergencyPhone, enabled) { v -> onEdit { it.copy(emergencyPhone = v) } }
    Field("Хронические заболевания", draft.chronicDiseases, enabled, lines = 2) { v -> onEdit { it.copy(chronicDiseases = v) } }
    Field("Перенесённые операции", draft.pastSurgeries, enabled, lines = 2) { v -> onEdit { it.copy(pastSurgeries = v) } }
    Field("Семейный анамнез", draft.familyHistory, enabled, lines = 2) { v -> onEdit { it.copy(familyHistory = v) } }
    Field("Страховая компания", draft.insuranceProvider, enabled) { v -> onEdit { it.copy(insuranceProvider = v) } }
    Field("Номер полиса", draft.insuranceNumber, enabled) { v -> onEdit { it.copy(insuranceNumber = v) } }
    Field("Заметки", draft.notes, enabled, lines = 3) { v -> onEdit { it.copy(notes = v) } }
}

@Composable
private fun Field(
    label: String,
    value: String?,
    enabled: Boolean,
    lines: Int = 1,
    onChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value.orEmpty(),
        onValueChange = onChange,
        label = { Text(label) },
        enabled = enabled,
        singleLine = lines == 1,
        minLines = lines,
        modifier = Modifier.fillMaxWidth(),
    )
}
