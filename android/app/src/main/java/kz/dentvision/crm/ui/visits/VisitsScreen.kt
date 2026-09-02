package kz.dentvision.crm.ui.visits

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kz.dentvision.crm.data.model.Visit
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.PatientPickerSheet
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

/** Визиты выбранного пациента: история приёмов и запись нового. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VisitsScreen(
    clinicId: String?,
    canWrite: Boolean,
    viewModel: VisitsViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var picking by remember { mutableStateOf(false) }
    var showForm by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    LaunchedEffect(clinicId) { viewModel.loadDoctors(clinicId) }

    Scaffold(
        containerColor = DvTheme.colors.surface0,
        floatingActionButton = {
            if (canWrite && state.patient != null) {
                FloatingActionButton(
                    onClick = {
                        viewModel.openForm()
                        showForm = true
                    },
                    containerColor = DvTheme.colors.gold,
                    contentColor = DvTheme.colors.goldOn,
                ) {
                    Icon(Icons.Filled.Add, contentDescription = "Записать визит")
                }
            }
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            OutlinedButton(
                onClick = { picking = true },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            ) {
                Text(state.patient?.name?.ifBlank { "Без имени" } ?: "Выбрать пациента")
            }

            if (state.patient == null) {
                EmptyStateView(
                    title = "Пациент не выбран",
                    description = "История визитов принадлежит конкретному человеку — выберите его выше.",
                )
                return@Column
            }

            when (val list = state.list) {
                is UiState.Loading -> LoadingSkeleton()
                is UiState.Error -> ErrorState(message = list.message, onRetry = viewModel::load)
                is UiState.Data -> if (list.value.isEmpty()) {
                    EmptyStateView(
                        title = "Визитов пока нет",
                        description = "Этот пациент ещё не был на приёме — или приёмы были до перехода на систему.",
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(list.value, key = { it.id }) { VisitRow(it) }
                    }
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

    if (showForm) {
        ModalBottomSheet(
            onDismissRequest = { showForm = false },
            sheetState = sheetState,
            containerColor = DvTheme.colors.surface1,
        ) {
            VisitForm(viewModel = viewModel, onSaved = { showForm = false })
        }
    }
}

@Composable
private fun VisitRow(visit: Visit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(
                text = visit.date?.take(10) ?: "Дата не указана",
                style = MaterialTheme.typography.labelMedium,
                color = DvTheme.colors.gold,
            )
            visit.diagnosis?.takeIf { it.isNotBlank() }?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.titleMedium,
                    color = DvTheme.colors.textPrimary,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            visit.complaints?.takeIf { it.isNotBlank() }?.let {
                Text(
                    text = "Жалобы: $it",
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.textSecondary,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            visit.treatment?.proceduresDone?.takeIf { it.isNotBlank() }?.let {
                Text(
                    text = "Выполнено: $it",
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.textSecondary,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            val tail = listOfNotNull(
                visit.treatment?.icd10Codes?.takeIf { it.isNotBlank() }?.let { "МКБ-10: $it" },
                visit.treatment?.nextVisitDate?.takeIf { it.isNotBlank() }?.let { "Следующий визит: $it" },
            ).joinToString(" · ")
            if (tail.isNotBlank()) {
                Text(
                    text = tail,
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.textMuted,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
        }
    }
}

@Composable
private fun VisitForm(viewModel: VisitsViewModel, onSaved: () -> Unit) {
    val form by viewModel.form.collectAsStateWithLifecycle()
    val state by viewModel.state.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .imePadding()
            .navigationBarsPadding()
            .padding(horizontal = 20.dp)
            .padding(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            text = "Новый визит",
            style = MaterialTheme.typography.titleLarge,
            color = DvTheme.colors.textPrimary,
        )

        if (state.doctors.isNotEmpty()) {
            Text(
                text = "Врач",
                style = MaterialTheme.typography.labelMedium,
                color = DvTheme.colors.textGhost,
            )
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                state.doctors.forEach { doctor ->
                    FilterChip(
                        selected = form.doctorId == doctor.id,
                        onClick = { viewModel.updateForm { it.copy(doctorId = doctor.id) } },
                        label = {
                            Text(
                                listOfNotNull(doctor.name, doctor.spec).joinToString(" · "),
                                style = MaterialTheme.typography.labelMedium,
                            )
                        },
                    )
                }
            }
        } else {
            // Врач обязателен для бэкенда, поэтому без списка форму не отправить.
            Text(
                text = "Список врачей не загрузился — без врача визит записать нельзя.",
                style = MaterialTheme.typography.bodySmall,
                color = DvTheme.colors.warning,
            )
        }

        VisitField("Жалобы", form.complaints, 2) { v -> viewModel.updateForm { it.copy(complaints = v) } }
        VisitField("Диагноз", form.diagnosis, 1) { v -> viewModel.updateForm { it.copy(diagnosis = v) } }
        VisitField("Анамнез", form.anamnesis, 2) { v -> viewModel.updateForm { it.copy(anamnesis = v) } }
        VisitField("План лечения", form.plan, 2) { v -> viewModel.updateForm { it.copy(plan = v) } }
        VisitField("Что выполнено", form.proceduresDone, 2) { v -> viewModel.updateForm { it.copy(proceduresDone = v) } }
        VisitField("Назначения", form.prescriptions, 2) { v -> viewModel.updateForm { it.copy(prescriptions = v) } }
        VisitField("Коды МКБ-10", form.icd10Codes, 1) { v -> viewModel.updateForm { it.copy(icd10Codes = v) } }
        VisitField("Дата следующего визита", form.nextVisitDate, 1) { v -> viewModel.updateForm { it.copy(nextVisitDate = v) } }
        VisitField("Заметки", form.notes, 2) { v -> viewModel.updateForm { it.copy(notes = v) } }

        form.error?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.bodySmall,
                color = DvTheme.colors.error,
            )
        }

        Button(
            onClick = { viewModel.save(onSaved) },
            enabled = form.canSave,
            modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
        ) {
            if (form.saving) {
                CircularProgressIndicator(
                    strokeWidth = 2.dp,
                    color = DvTheme.colors.goldOn,
                    modifier = Modifier.size(18.dp),
                )
            } else {
                Text("Записать визит")
            }
        }
    }
}

@Composable
private fun VisitField(label: String, value: String, lines: Int, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = lines == 1,
        minLines = lines,
        modifier = Modifier.fillMaxWidth(),
    )
}
