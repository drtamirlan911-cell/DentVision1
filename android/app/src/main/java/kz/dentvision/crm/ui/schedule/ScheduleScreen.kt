package kz.dentvision.crm.ui.schedule

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kz.dentvision.crm.data.model.APPOINTMENT_STATUS_LABELS
import kz.dentvision.crm.data.model.Appointment
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.PatientPickerSheet
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme
import java.time.format.DateTimeFormatter
import java.util.Locale

private val DAY_FORMAT = DateTimeFormatter.ofPattern("d MMMM, EEEE", Locale("ru"))

/**
 * Расписание одного дня. День, а не неделя: на телефоне сетка недели
 * нечитаема, а у кресла нужен именно сегодняшний список по времени.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScheduleScreen(
    clinicId: String?,
    canWrite: Boolean,
    viewModel: ScheduleViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var showForm by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    LaunchedEffect(clinicId) { viewModel.start(clinicId) }

    Scaffold(
        containerColor = DvTheme.colors.surface0,
        floatingActionButton = {
            if (canWrite) {
                FloatingActionButton(
                    onClick = {
                        viewModel.openForm()
                        showForm = true
                    },
                    containerColor = DvTheme.colors.gold,
                    contentColor = DvTheme.colors.goldOn,
                ) {
                    Icon(Icons.Filled.Add, contentDescription = "Записать пациента")
                }
            }
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                IconButton(onClick = { viewModel.shiftDay(-1) }) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Предыдущий день",
                        tint = DvTheme.colors.textSecondary,
                    )
                }
                Text(
                    text = state.date.format(DAY_FORMAT),
                    style = MaterialTheme.typography.titleMedium,
                    color = DvTheme.colors.textPrimary,
                )
                IconButton(onClick = { viewModel.shiftDay(1) }) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowForward,
                        contentDescription = "Следующий день",
                        tint = DvTheme.colors.textSecondary,
                    )
                }
            }

            when (val list = state.list) {
                is UiState.Loading -> LoadingSkeleton()
                is UiState.Error -> ErrorState(message = list.message, onRetry = viewModel::load)
                is UiState.Data -> if (list.value.isEmpty()) {
                    EmptyStateView(
                        title = "На этот день записей нет",
                        description = "Пустой день — это тоже ответ: приёмы не потерялись, их просто нет.",
                    )
                } else {
                    LazyColumn(
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(list.value, key = { it.id }) { AppointmentRow(it) }
                    }
                }
            }
        }
    }

    if (showForm) {
        ModalBottomSheet(
            onDismissRequest = { showForm = false },
            sheetState = sheetState,
            containerColor = DvTheme.colors.surface1,
        ) {
            AppointmentForm(viewModel = viewModel, onSaved = { showForm = false })
        }
    }
}

@Composable
private fun AppointmentRow(appointment: Appointment) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
    ) {
        Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.Top) {
            Column(modifier = Modifier.width(64.dp)) {
                Text(
                    text = appointment.time,
                    style = MaterialTheme.typography.titleMedium,
                    color = DvTheme.colors.gold,
                )
                Text(
                    text = "${appointment.duration} мин",
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.textGhost,
                )
            }
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = appointment.patientName ?: "Пациент",
                    style = MaterialTheme.typography.titleMedium,
                    color = DvTheme.colors.textPrimary,
                )
                val service = appointment.serviceName.ifBlank { appointment.reason }
                if (service.isNotBlank()) {
                    Text(
                        text = service,
                        style = MaterialTheme.typography.bodySmall,
                        color = DvTheme.colors.textSecondary,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                val meta = listOfNotNull(
                    APPOINTMENT_STATUS_LABELS[appointment.status] ?: appointment.status,
                    appointment.chairName.ifBlank { null },
                    appointment.patientPhone,
                ).joinToString(" · ")
                Text(
                    text = meta,
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.textMuted,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun AppointmentForm(viewModel: ScheduleViewModel, onSaved: () -> Unit) {
    val form by viewModel.form.collectAsStateWithLifecycle()
    val state by viewModel.state.collectAsStateWithLifecycle()
    var pickingPatient by remember { mutableStateOf(false) }

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
            text = "Новая запись на ${state.date}",
            style = MaterialTheme.typography.titleLarge,
            color = DvTheme.colors.textPrimary,
        )

        OutlinedButton(
            onClick = { pickingPatient = true },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(form.patient?.name?.ifBlank { "Без имени" } ?: "Выбрать пациента")
        }

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
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = form.time,
                onValueChange = { value -> viewModel.updateForm { it.copy(time = value) } },
                label = { Text("Время") },
                placeholder = { Text("14:30") },
                singleLine = true,
                modifier = Modifier.weight(1f),
            )
            OutlinedTextField(
                value = form.duration,
                onValueChange = { value ->
                    viewModel.updateForm { it.copy(duration = value.filter { c -> c.isDigit() }) }
                },
                label = { Text("Минут") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.weight(1f),
            )
        }

        OutlinedTextField(
            value = form.serviceName,
            onValueChange = { value -> viewModel.updateForm { it.copy(serviceName = value) } },
            label = { Text("Услуга") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = form.notes,
            onValueChange = { value -> viewModel.updateForm { it.copy(notes = value) } },
            label = { Text("Заметки") },
            minLines = 2,
            modifier = Modifier.fillMaxWidth(),
        )

        form.conflict?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.bodySmall,
                color = DvTheme.colors.warning,
            )
        }
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
                Text(if (form.conflict != null) "Записать всё равно" else "Записать")
            }
        }
    }

    if (pickingPatient) {
        PatientPickerSheet(
            onDismiss = { pickingPatient = false },
            onSelect = { patient ->
                viewModel.updateForm { it.copy(patient = patient, conflict = null) }
                pickingPatient = false
            },
        )
    }
}
