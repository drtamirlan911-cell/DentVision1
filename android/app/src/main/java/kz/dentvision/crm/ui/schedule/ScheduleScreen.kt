package kz.dentvision.crm.ui.schedule

import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.Person
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
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import androidx.compose.ui.text.font.FontWeight
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
import kz.dentvision.crm.ui.theme.DvBadge
import kz.dentvision.crm.ui.theme.DvBadgeVariant
import kz.dentvision.crm.ui.theme.DvConfirmDialog
import kz.dentvision.crm.ui.theme.DvOutlineButton
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme
import java.time.format.DateTimeFormatter
import java.util.Locale

private val DAY_FORMAT = DateTimeFormatter.ofPattern("d MMMM, EEEE", Locale("ru"))

private val PAYMENT_STATUS_LABELS = mapOf(
    "paid" to "Оплачено",
    "partial" to "Частично оплачено",
)

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
    val paymentForm by viewModel.paymentForm.collectAsStateWithLifecycle()
    var showForm by remember { mutableStateOf(false) }
    var pendingDelete by remember { mutableStateOf<Appointment?>(null) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val paymentSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(clinicId) { viewModel.start(clinicId) }

    LaunchedEffect(state.message) {
        val message = state.message ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(message)
        viewModel.consumeMessage()
    }
    LaunchedEffect(state.deleteError) {
        val message = state.deleteError ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(message)
        viewModel.consumeDeleteError()
    }

    Scaffold(
        containerColor = DvTheme.colors.surface0,
        snackbarHost = {
            SnackbarHost(snackbarHostState) { data -> Snackbar(snackbarData = data, containerColor = DvTheme.colors.surface3) }
        },
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
                    // Раньше карточка приёма нигде не показывала врача — при
                    // нескольких докторах в клинике администратор не мог
                    // понять по расписанию, к кому записан пациент, и не видел
                    // при создании новой записи, чьи слоты уже заняты.
                    val doctorsById = state.doctors.associateBy { it.id }
                    LazyColumn(
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(list.value, key = { it.id }) { appointment ->
                            AppointmentRow(
                                appointment = appointment,
                                doctorName = doctorsById[appointment.doctorId]?.name,
                                onClick = if (canWrite) {
                                    {
                                        viewModel.openEdit(appointment)
                                        showForm = true
                                    }
                                } else null,
                                canDelete = canWrite,
                                onDelete = { pendingDelete = appointment },
                                onAcceptPayment = if (canWrite && appointment.paymentStatus != "paid") {
                                    { viewModel.openPayment(appointment) }
                                } else null,
                            )
                        }
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

    if (paymentForm != null) {
        ModalBottomSheet(
            onDismissRequest = viewModel::dismissPayment,
            sheetState = paymentSheetState,
            containerColor = DvTheme.colors.surface1,
        ) {
            AcceptPaymentSheet(viewModel = viewModel)
        }
    }

    pendingDelete?.let { appointment ->
        DvConfirmDialog(
            title = "Отменить запись?",
            message = "Приём ${appointment.time}${appointment.patientName?.let { " — $it" } ?: ""} будет удалён из расписания.",
            confirmLabel = "Отменить приём",
            onConfirm = {
                viewModel.delete(appointment.id)
                pendingDelete = null
            },
            onDismiss = { pendingDelete = null },
        )
    }
}

@Composable
private fun AppointmentRow(
    appointment: Appointment,
    doctorName: String?,
    onClick: (() -> Unit)? = null,
    canDelete: Boolean = false,
    onDelete: (() -> Unit)? = null,
    onAcceptPayment: (() -> Unit)? = null,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
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
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = appointment.patientName ?: "Пациент",
                    style = MaterialTheme.typography.titleMedium,
                    color = DvTheme.colors.textPrimary,
                )
                // Врач — отдельной, заметной строкой сразу под пациентом: в
                // клинике с несколькими докторами это первое, что нужно
                // администратору, чтобы понять, чей это приём и не занят ли
                // нужный врач, когда он записывает следующего пациента.
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(top = 3.dp),
                ) {
                    Icon(
                        imageVector = Icons.Filled.Person,
                        contentDescription = null,
                        tint = DvTheme.colors.gold,
                        modifier = Modifier.size(13.dp),
                    )
                    Text(
                        text = doctorName ?: "Врач не назначен",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (doctorName != null) DvTheme.colors.gold else DvTheme.colors.warning,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.padding(start = 4.dp),
                    )
                }
                val service = appointment.serviceName.ifBlank { appointment.reason }
                if (service.isNotBlank()) {
                    Text(
                        text = service,
                        style = MaterialTheme.typography.bodySmall,
                        color = DvTheme.colors.textSecondary,
                        modifier = Modifier.padding(top = 3.dp),
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
                // Отметка про оплату — только когда есть что показать помимо
                // «не оплачено», это ожидаемое состояние большинства приёмов
                // и не заслуживает бейджа на каждой карточке.
                PAYMENT_STATUS_LABELS[appointment.paymentStatus]?.let { label ->
                    DvBadge(
                        text = label,
                        variant = if (appointment.paymentStatus == "paid") DvBadgeVariant.SUCCESS else DvBadgeVariant.WARNING,
                        size = kz.dentvision.crm.ui.theme.DvBadgeSize.XS,
                        modifier = Modifier.padding(top = 5.dp),
                    )
                }
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                if (onAcceptPayment != null) {
                    IconButton(onClick = onAcceptPayment, modifier = Modifier.size(28.dp)) {
                        Icon(
                            Icons.Filled.Payments,
                            contentDescription = "Принять оплату",
                            tint = DvTheme.colors.gold,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }
                if (canDelete) {
                    IconButton(onClick = { onDelete?.invoke() }, modifier = Modifier.size(28.dp)) {
                        Icon(
                            Icons.Filled.Delete,
                            contentDescription = "Отменить запись",
                            tint = DvTheme.colors.textGhost,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }
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
            text = if (form.id != null) "Приём ${form.time}" else "Новая запись на ${state.date}",
            style = MaterialTheme.typography.titleLarge,
            color = DvTheme.colors.textPrimary,
        )

        DvOutlineButton(
            onClick = { pickingPatient = true },
            // Пациента существующего приёма не переназначаем — это была бы
            // не правка записи, а перенос чужой истории на другого человека.
            enabled = form.id == null,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(form.patient?.name?.ifBlank { "Без имени" } ?: "Выбрать пациента")
        }

        if (form.id != null) {
            Text(
                text = "Статус",
                style = MaterialTheme.typography.labelMedium,
                color = DvTheme.colors.textGhost,
            )
            APPOINTMENT_STATUS_LABELS.entries.chunked(2).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    row.forEach { (key, label) ->
                        FilterChip(
                            selected = form.status == key,
                            onClick = { viewModel.updateForm { it.copy(status = key) } },
                            label = { Text(label, style = MaterialTheme.typography.labelMedium) },
                        )
                    }
                }
            }
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

        DvPrimaryButton(
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
                Text(
                    when {
                        form.conflict != null -> "Записать всё равно"
                        form.id != null -> "Сохранить"
                        else -> "Записать"
                    },
                )
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

/**
 * Приём оплаты — усечённый перенос `AcceptPaymentModal.tsx`: сумма, способ,
 * тип (полностью/предоплата/в долг), заметка. Онлайн QR-оплата (создание и
 * подтверждение платежа через отдельный эндпоинт) не перенесена — список
 * способов сознательно не включает «QR-оплата» (см. докстринг
 * [ACCEPT_PAYMENT_METHODS]), закрытие визита при оплате — тоже отдельная
 * функция, здесь её нет.
 */
@Composable
private fun AcceptPaymentSheet(viewModel: ScheduleViewModel) {
    val form by viewModel.paymentForm.collectAsStateWithLifecycle()
    val current = form ?: return

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
            text = "Приём оплаты",
            style = MaterialTheme.typography.titleLarge,
            color = DvTheme.colors.textPrimary,
        )
        Text(
            text = current.appointment.patientName ?: "Пациент",
            style = MaterialTheme.typography.bodyMedium,
            color = DvTheme.colors.textSecondary,
        )

        OutlinedTextField(
            value = current.amount,
            onValueChange = { value ->
                viewModel.updatePaymentForm { it.copy(amount = value.filter { c -> c.isDigit() }) }
            },
            label = { Text("Сумма, ₸") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
        )

        Text("Способ оплаты", style = MaterialTheme.typography.labelMedium, color = DvTheme.colors.textGhost)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            ACCEPT_PAYMENT_METHODS.forEach { method ->
                FilterChip(
                    selected = current.method == method,
                    onClick = { viewModel.updatePaymentForm { it.copy(method = method) } },
                    label = { Text(method, style = MaterialTheme.typography.labelSmall) },
                )
            }
        }

        Text("Тип оплаты", style = MaterialTheme.typography.labelMedium, color = DvTheme.colors.textGhost)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            PAY_KIND_LABELS.forEach { (key, label) ->
                FilterChip(
                    selected = current.payKind == key,
                    onClick = { viewModel.updatePaymentForm { it.copy(payKind = key) } },
                    label = { Text(label, style = MaterialTheme.typography.labelMedium) },
                )
            }
        }

        OutlinedTextField(
            value = current.notes,
            onValueChange = { value -> viewModel.updatePaymentForm { it.copy(notes = value) } },
            label = { Text("Комментарий") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        current.error?.let {
            Text(text = it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.error)
        }

        DvPrimaryButton(
            onClick = { viewModel.submitPayment {} },
            enabled = current.canSubmit,
            modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
        ) {
            if (current.saving) {
                CircularProgressIndicator(
                    strokeWidth = 2.dp,
                    color = DvTheme.colors.goldOn,
                    modifier = Modifier.size(18.dp),
                )
            } else {
                Text(
                    when (current.payKind) {
                        "credit" -> "Оформить в долг"
                        "prepayment" -> "Принять предоплату"
                        else -> "Принять оплату"
                    },
                )
            }
        }
    }
}
