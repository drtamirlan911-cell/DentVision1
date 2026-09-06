package kz.dentvision.crm.ui.schedule

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.PaddingValues
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
import kz.dentvision.crm.ui.theme.DvSpacing
import kz.dentvision.crm.lib.formatPhone
import kz.dentvision.crm.lib.formatTenge
import kz.dentvision.crm.lib.TOOTH_NAMES
import kz.dentvision.crm.lib.TOOTH_QUADRANTS
import kz.dentvision.crm.data.model.PriceListItem
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
    /**
     * Не null — сетка показывает только эту колонку врача, а не всех
     * коллег. Роль с `ownDataOnly` (врач, ассистент) видит только себя;
     * администратор и владелец передают null и получают полную сетку.
     */
    ownDoctorId: String? = null,
    /** `billing.manage` — ручка `POST /api/billing/invoices` требует именно его, а не `appointments.write`. */
    canAcceptPayment: Boolean = canWrite,
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
                modifier = Modifier.fillMaxWidth().padding(horizontal = DvSpacing.sm),
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
                is UiState.Data -> {
                    // Своя колонка у роли с ownDataOnly — коллеги не заведены
                    // в сетку вовсе, а не показаны пустыми: `doctorId` не
                    // приходит null для настоящего врача, поэтому сравнение
                    // здесь безопасно и не прячет чужую колонку по ошибке.
                    val visibleDoctors = if (ownDoctorId != null) {
                        state.doctors.filter { it.id == ownDoctorId }
                    } else {
                        state.doctors
                    }
                    Box(modifier = Modifier.padding(horizontal = DvSpacing.sm, vertical = DvSpacing.sm)) {
                        ScheduleGrid(
                            doctors = visibleDoctors,
                            appointments = list.value,
                            canWrite = canWrite,
                            onSlotClick = { doctorId, time ->
                                viewModel.openForm(doctorId = doctorId, time = time)
                                showForm = true
                            },
                            onAppointmentClick = { appointment ->
                                if (canWrite) {
                                    viewModel.openEdit(appointment)
                                    showForm = true
                                }
                            },
                            onReschedule = { appointment, newDoctorId, newTime ->
                                viewModel.rescheduleAppointment(appointment, newDoctorId, newTime)
                            },
                        )
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
            AppointmentForm(
                viewModel = viewModel,
                canAcceptPayment = canAcceptPayment,
                onSaved = { showForm = false },
                onDelete = { id ->
                    (state.list as? UiState.Data)?.value?.firstOrNull { it.id == id }?.let { pendingDelete = it }
                    showForm = false
                },
                onAcceptPayment = { id ->
                    (state.list as? UiState.Data)?.value?.firstOrNull { it.id == id }?.let { viewModel.openPayment(it) }
                    showForm = false
                },
            )
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

    state.rescheduleConflict?.let { conflict ->
        DvConfirmDialog(
            title = "Время уже занято",
            message = "${conflict.message}\n\nПеренести на ${conflict.newTime} всё равно?",
            confirmLabel = "Перенести всё равно",
            onConfirm = viewModel::confirmRescheduleAnyway,
            onDismiss = viewModel::dismissRescheduleConflict,
        )
    }
}

@Composable
private fun AppointmentForm(
    viewModel: ScheduleViewModel,
    canAcceptPayment: Boolean,
    onSaved: () -> Unit,
    onDelete: (String) -> Unit,
    onAcceptPayment: (String) -> Unit,
) {
    val form by viewModel.form.collectAsStateWithLifecycle()
    val state by viewModel.state.collectAsStateWithLifecycle()
    val priceList by viewModel.priceList.collectAsStateWithLifecycle()
    var pickingPatient by remember { mutableStateOf(false) }
    var pickingService by remember { mutableStateOf(false) }
    var pickingTooth by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .imePadding()
            .navigationBarsPadding()
            .padding(horizontal = DvSpacing.xl)
            .padding(bottom = DvSpacing.xxl),
        verticalArrangement = Arrangement.spacedBy(DvSpacing.md),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = if (form.id != null) "Приём ${form.time}" else "Новая запись на ${state.date}",
                style = MaterialTheme.typography.titleLarge,
                color = DvTheme.colors.textPrimary,
            )
            // Отменить/принять оплату — раньше это было доступно только из
            // плоского списка (`AppointmentRow`), которого сетка не рисует;
            // без этой строки правка приёма из сетки лишилась бы обеих
            // возможностей.
            form.id?.let { id ->
                Row {
                    if (canAcceptPayment && form.paymentStatus != "paid") {
                        IconButton(onClick = { onAcceptPayment(id) }) {
                            Icon(
                                Icons.Filled.Payments,
                                contentDescription = "Принять оплату",
                                tint = DvTheme.colors.gold,
                            )
                        }
                    }
                    IconButton(onClick = { onDelete(id) }) {
                        Icon(
                            Icons.Filled.Delete,
                            contentDescription = "Отменить приём",
                            tint = DvTheme.colors.textGhost,
                        )
                    }
                }
            }
        }

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
                Row(horizontalArrangement = Arrangement.spacedBy(DvSpacing.sm)) {
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
            Column(verticalArrangement = Arrangement.spacedBy(DvSpacing.sm)) {
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

        Row(horizontalArrangement = Arrangement.spacedBy(DvSpacing.sm)) {
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

        Text(
            text = "Услуга из прайса",
            style = MaterialTheme.typography.labelMedium,
            color = DvTheme.colors.textGhost,
        )
        DvOutlineButton(onClick = { pickingService = true }, modifier = Modifier.fillMaxWidth()) {
            Text(
                if (form.serviceName.isBlank()) {
                    "Выбрать услугу"
                } else if (form.servicePrice > 0) {
                    "${form.serviceName} · ${formatTenge(form.servicePrice.toLong())}"
                } else {
                    form.serviceName
                },
            )
        }

        // Диагноз/зуб относятся к самому визиту, а не к бронированию слота —
        // показываем только при правке уже существующего приёма, тем же
        // приёмом, что `Schedule.tsx`: просить указать зуб раньше, чем
        // пациента вообще осмотрели, значило бы гадать.
        if (form.id != null) {
            Text(
                text = "Зуб (по FDI)",
                style = MaterialTheme.typography.labelMedium,
                color = DvTheme.colors.textGhost,
            )
            DvOutlineButton(onClick = { pickingTooth = true }, modifier = Modifier.fillMaxWidth()) {
                Text(
                    form.toothNumber.toIntOrNull()?.let { n -> "$n — ${TOOTH_NAMES[n] ?: ""}" }
                        ?: "Без указания зуба",
                )
            }
        }

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
            modifier = Modifier.fillMaxWidth().padding(top = DvSpacing.sm),
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

    if (pickingService) {
        ServicePickerSheet(
            services = priceList,
            onDismiss = { pickingService = false },
            onSelect = { item ->
                viewModel.selectService(item)
                pickingService = false
            },
        )
    }

    if (pickingTooth) {
        ToothPickerSheet(
            selected = form.toothNumber.toIntOrNull(),
            onDismiss = { pickingTooth = false },
            onSelect = { number ->
                viewModel.updateForm { it.copy(toothNumber = number?.toString().orEmpty()) }
                pickingTooth = false
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ServicePickerSheet(
    services: List<PriceListItem>,
    onDismiss: () -> Unit,
    onSelect: (PriceListItem) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = DvTheme.colors.surface1) {
        if (services.isEmpty()) {
            Text(
                text = "Прайс пуст — добавьте услуги в разделе «Прайс».",
                style = MaterialTheme.typography.bodyMedium,
                color = DvTheme.colors.textMuted,
                modifier = Modifier.fillMaxWidth().padding(DvSpacing.xl),
            )
        } else {
            LazyColumn(contentPadding = PaddingValues(bottom = DvSpacing.xxl)) {
                items(services, key = { it.id }) { item ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onSelect(item) }
                            .padding(horizontal = DvSpacing.xl, vertical = DvSpacing.md),
                    ) {
                        Text(
                            item.name?.ifBlank { null } ?: item.serviceCode,
                            style = MaterialTheme.typography.bodyMedium,
                            color = DvTheme.colors.textPrimary,
                        )
                        Text(
                            formatTenge(item.price),
                            style = MaterialTheme.typography.bodySmall,
                            color = DvTheme.colors.textMuted,
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ToothPickerSheet(
    selected: Int?,
    onDismiss: () -> Unit,
    onSelect: (Int?) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = DvTheme.colors.surface1) {
        LazyColumn(contentPadding = PaddingValues(bottom = DvSpacing.xxl)) {
            item {
                Text(
                    text = "Без указания зуба",
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (selected == null) DvTheme.colors.gold else DvTheme.colors.textPrimary,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelect(null) }
                        .padding(horizontal = DvSpacing.xl, vertical = DvSpacing.md),
                )
            }
            TOOTH_QUADRANTS.forEach { (label, numbers) ->
                item {
                    Text(
                        text = label,
                        style = MaterialTheme.typography.labelSmall,
                        color = DvTheme.colors.textGhost,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = DvSpacing.xl, vertical = DvSpacing.sm),
                    )
                }
                items(numbers) { number ->
                    Text(
                        text = "$number — ${TOOTH_NAMES[number] ?: ""}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (selected == number) DvTheme.colors.gold else DvTheme.colors.textPrimary,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onSelect(number) }
                            .padding(horizontal = DvSpacing.xl, vertical = DvSpacing.sm),
                    )
                }
            }
        }
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
            .padding(horizontal = DvSpacing.xl)
            .padding(bottom = DvSpacing.xxl),
        verticalArrangement = Arrangement.spacedBy(DvSpacing.md),
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
        Row(horizontalArrangement = Arrangement.spacedBy(DvSpacing.sm)) {
            ACCEPT_PAYMENT_METHODS.forEach { method ->
                FilterChip(
                    selected = current.method == method,
                    onClick = { viewModel.updatePaymentForm { it.copy(method = method) } },
                    label = { Text(method, style = MaterialTheme.typography.labelSmall) },
                )
            }
        }

        Text("Тип оплаты", style = MaterialTheme.typography.labelMedium, color = DvTheme.colors.textGhost)
        Row(horizontalArrangement = Arrangement.spacedBy(DvSpacing.sm)) {
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
            modifier = Modifier.fillMaxWidth().padding(top = DvSpacing.sm),
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
