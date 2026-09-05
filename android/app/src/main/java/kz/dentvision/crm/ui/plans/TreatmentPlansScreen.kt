package kz.dentvision.crm.ui.plans

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Search
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
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.CrmRepository
import kz.dentvision.crm.data.model.Patient
import kz.dentvision.crm.data.model.PriceListItem
import kz.dentvision.crm.data.model.TreatmentPlan
import kz.dentvision.crm.data.model.TreatmentPlanLineItem
import kz.dentvision.crm.data.model.TreatmentPlanStage
import kz.dentvision.crm.data.model.TreatmentPlanUpsert
import kz.dentvision.crm.lib.formatTenge
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.PatientPickerSheet
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvConfirmDialog
import kz.dentvision.crm.ui.theme.DvOutlineButton
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme

private val PLAN_STATUS_LABELS = mapOf(
    "draft" to "Черновик",
    "proposed" to "Предложен",
    "accepted" to "Принят",
    "in_progress" to "В работе",
    "completed" to "Завершён",
    "rejected" to "Отклонён",
)

data class TreatmentPlansUiState(
    val list: UiState<List<TreatmentPlan>> = UiState.Loading,
    val query: String = "",
    val message: String? = null,
    val deleteError: String? = null,
)

data class PlanLineForm(
    val serviceId: String? = null,
    val serviceName: String = "",
    val price: Int = 0,
    val qty: Int = 1,
)

data class PlanStageForm(
    val title: String = "Этап",
    val items: List<PlanLineForm> = emptyList(),
) {
    val cost: Int get() = items.sumOf { it.price * it.qty }
}

data class PlanFormState(
    val id: String? = null,
    val patient: Patient? = null,
    val title: String = "План лечения",
    val diagnosis: String = "",
    val status: String = "proposed",
    val notes: String = "",
    val stages: List<PlanStageForm> = listOf(PlanStageForm()),
    val priceList: List<PriceListItem> = emptyList(),
    val saving: Boolean = false,
    val error: String? = null,
) {
    val total: Int get() = stages.sumOf { it.cost }
    val canSave: Boolean get() = patient != null && !saving
}

/**
 * Планы лечения клиники — перенос `TreatmentPlans.tsx`/`TreatmentPlanEditor`.
 * Раньше экран был чисто просмотровым (найдено при аудите расхождений с
 * вебом): список без поиска, без создания/редактирования, без удаления —
 * хотя бэкенд (`crm.routes.ts:90,185`) давно умеет и то, и другое.
 *
 * Этапы и услуги внутри них — ручной ввод из прайс-листа клиники, без
 * привязки к зубам/находкам одонтограммы: это делает только сборка плана
 * ИИ (`items.finding`/`alternatives`), которую этот редактор не трогает и не
 * изображает, будто умеет.
 */
class TreatmentPlansViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(TreatmentPlansUiState())
    val state: StateFlow<TreatmentPlansUiState> = _state

    private val _form = MutableStateFlow(PlanFormState())
    val form: StateFlow<PlanFormState> = _form

    private var all: List<TreatmentPlan> = emptyList()
    private var clinicId: String? = null

    fun start(clinicId: String?) {
        if (this.clinicId == clinicId && _state.value.list !is UiState.Loading) return
        this.clinicId = clinicId
        load()
    }

    fun load() {
        val clinic = clinicId
        if (clinic == null) {
            _state.update { it.copy(list = UiState.Error("Клиника не выбрана")) }
            return
        }
        _state.update { it.copy(list = UiState.Loading) }
        viewModelScope.launch {
            runCatching { repository.treatmentPlans(clinic) }
                .onSuccess { plans ->
                    all = plans
                    _state.update { it.copy(list = UiState.Data(filter(plans, it.query))) }
                }
                .onFailure { e ->
                    _state.update { it.copy(list = UiState.Error(e.message ?: "Не удалось загрузить планы")) }
                }
        }
    }

    fun onQueryChange(value: String) {
        _state.update { it.copy(query = value, list = UiState.Data(filter(all, value))) }
    }

    private fun filter(source: List<TreatmentPlan>, query: String): List<TreatmentPlan> {
        val q = query.trim().lowercase()
        if (q.isEmpty()) return source
        return source.filter {
            it.title.lowercase().contains(q) ||
                it.patientName?.lowercase()?.contains(q) == true ||
                it.diagnosis?.lowercase()?.contains(q) == true
        }
    }

    fun openCreate() {
        _form.value = PlanFormState(priceList = _form.value.priceList)
        loadPriceListIfNeeded()
    }

    fun openEdit(plan: TreatmentPlan) {
        _form.value = PlanFormState(
            id = plan.id,
            patient = Patient(id = plan.patientId, name = plan.patientName.orEmpty()),
            title = plan.title.ifBlank { "План лечения" },
            diagnosis = plan.diagnosis.orEmpty(),
            status = plan.status.ifBlank { "proposed" },
            notes = plan.notes.orEmpty(),
            stages = plan.stages.takeIf { it.isNotEmpty() }?.map { stage ->
                PlanStageForm(
                    title = stage.title.ifBlank { "Этап" },
                    items = stage.items.map { item ->
                        PlanLineForm(
                            serviceId = item.serviceId,
                            serviceName = item.serviceName.orEmpty().ifBlank { "Услуга" },
                            price = item.price,
                            qty = item.qty,
                        )
                    },
                )
            }?.ifEmpty { listOf(PlanStageForm()) } ?: listOf(PlanStageForm()),
            priceList = _form.value.priceList,
        )
        loadPriceListIfNeeded()
    }

    private fun loadPriceListIfNeeded() {
        if (_form.value.priceList.isNotEmpty()) return
        viewModelScope.launch {
            runCatching { repository.priceList() }
                .onSuccess { list -> _form.update { it.copy(priceList = list.filter { p -> p.active }) } }
        }
    }

    fun updatePatient(patient: Patient) = _form.update { it.copy(patient = patient) }
    fun updateTitle(value: String) = _form.update { it.copy(title = value) }
    fun updateDiagnosis(value: String) = _form.update { it.copy(diagnosis = value) }
    fun updateStatus(value: String) = _form.update { it.copy(status = value) }
    fun updateNotes(value: String) = _form.update { it.copy(notes = value) }

    fun addStage() = _form.update { s -> s.copy(stages = s.stages + PlanStageForm(title = "Этап ${s.stages.size + 1}")) }

    fun removeStage(index: Int) = _form.update { s ->
        s.copy(stages = s.stages.filterIndexed { i, _ -> i != index }.ifEmpty { listOf(PlanStageForm()) })
    }

    fun updateStageTitle(index: Int, title: String) = _form.update { s ->
        s.copy(stages = s.stages.mapIndexed { i, stage -> if (i == index) stage.copy(title = title) else stage })
    }

    fun addItem(stageIndex: Int, service: PriceListItem) = _form.update { s ->
        s.copy(
            stages = s.stages.mapIndexed { i, stage ->
                if (i != stageIndex || stage.items.any { it.serviceId == service.id }) {
                    stage
                } else {
                    stage.copy(
                        items = stage.items + PlanLineForm(
                            serviceId = service.id,
                            serviceName = service.name?.ifBlank { null } ?: service.serviceCode,
                            price = service.price,
                            qty = 1,
                        ),
                    )
                }
            },
        )
    }

    fun removeItem(stageIndex: Int, itemIndex: Int) = _form.update { s ->
        s.copy(
            stages = s.stages.mapIndexed { i, stage ->
                if (i != stageIndex) stage else stage.copy(items = stage.items.filterIndexed { j, _ -> j != itemIndex })
            },
        )
    }

    fun updateQty(stageIndex: Int, itemIndex: Int, qty: Int) = _form.update { s ->
        s.copy(
            stages = s.stages.mapIndexed { i, stage ->
                if (i != stageIndex) {
                    stage
                } else {
                    stage.copy(
                        items = stage.items.mapIndexed { j, item ->
                            if (j != itemIndex) item else item.copy(qty = qty.coerceAtLeast(1))
                        },
                    )
                }
            },
        )
    }

    fun save(onSaved: () -> Unit) {
        val form = _form.value
        val patient = form.patient ?: return
        _form.update { it.copy(saving = true, error = null) }
        val isNew = form.id == null
        val body = TreatmentPlanUpsert(
            id = form.id,
            patientId = patient.id,
            title = form.title.trim().ifBlank { null },
            diagnosis = form.diagnosis.trim().ifBlank { null },
            status = form.status,
            stages = form.stages.filter { it.items.isNotEmpty() }.map { stage ->
                TreatmentPlanStage(
                    title = stage.title.trim().ifBlank { "Этап" },
                    items = stage.items.map {
                        TreatmentPlanLineItem(serviceId = it.serviceId, serviceName = it.serviceName, price = it.price, qty = it.qty)
                    },
                )
            },
            notes = form.notes.trim().ifBlank { null },
        )
        viewModelScope.launch {
            runCatching { repository.saveTreatmentPlan(body) }
                .onSuccess {
                    _form.update { it.copy(saving = false) }
                    _state.update { it.copy(message = if (isNew) "План создан" else "План обновлён") }
                    load()
                    onSaved()
                }
                .onFailure { e -> _form.update { it.copy(saving = false, error = e.message ?: "Не удалось сохранить план") } }
        }
    }

    fun delete(id: String) {
        viewModelScope.launch {
            runCatching { repository.deleteTreatmentPlan(id) }
                .onSuccess {
                    _state.update { it.copy(message = "План удалён") }
                    load()
                }
                .onFailure { e -> _state.update { it.copy(deleteError = e.message ?: "Не удалось удалить план") } }
        }
    }

    fun consumeMessage() = _state.update { it.copy(message = null) }
    fun consumeDeleteError() = _state.update { it.copy(deleteError = null) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TreatmentPlansScreen(
    clinicId: String?,
    canWrite: Boolean = false,
    viewModel: TreatmentPlansViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var showForm by remember { mutableStateOf(false) }
    var pendingDelete by remember { mutableStateOf<TreatmentPlan?>(null) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
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
                        viewModel.openCreate()
                        showForm = true
                    },
                    containerColor = DvTheme.colors.gold,
                    contentColor = DvTheme.colors.goldOn,
                ) {
                    Icon(Icons.Filled.Add, contentDescription = "Новый план лечения")
                }
            }
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            OutlinedTextField(
                value = state.query,
                onValueChange = viewModel::onQueryChange,
                singleLine = true,
                label = { Text("Пациент, диагноз или план") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            )

            when (val list = state.list) {
                is UiState.Loading -> LoadingSkeleton()
                is UiState.Error -> ErrorState(message = list.message, onRetry = viewModel::load)
                is UiState.Data -> if (list.value.isEmpty()) {
                    EmptyStateView(
                        title = if (state.query.isBlank()) "Планов лечения нет" else "Ничего не найдено",
                        description = if (state.query.isBlank()) {
                            "План собирается из услуг прайса и показывается пациенту."
                        } else {
                            "Измените запрос поиска."
                        },
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(list.value, key = { it.id }) { plan ->
                            PlanRow(
                                plan = plan,
                                canWrite = canWrite,
                                onClick = {
                                    viewModel.openEdit(plan)
                                    showForm = true
                                },
                                onDelete = { pendingDelete = plan },
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
            PlanForm(viewModel = viewModel, canWrite = canWrite, onSaved = { showForm = false })
        }
    }

    pendingDelete?.let { plan ->
        DvConfirmDialog(
            title = "Удалить план лечения?",
            message = "«${plan.title.ifBlank { "План лечения" }}» будет удалён безвозвратно.",
            confirmLabel = "Удалить",
            onConfirm = {
                viewModel.delete(plan.id)
                pendingDelete = null
            },
            onDismiss = { pendingDelete = null },
        )
    }
}

@Composable
private fun PlanRow(plan: TreatmentPlan, canWrite: Boolean, onClick: () -> Unit, onDelete: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
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
                    modifier = Modifier.weight(1f),
                )
                plan.totalBudget?.takeIf { it > 0 }?.let {
                    Text(
                        text = formatTenge(it),
                        style = MaterialTheme.typography.titleMedium,
                        color = DvTheme.colors.gold,
                    )
                }
                if (canWrite) {
                    IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
                        Icon(
                            Icons.Filled.Delete,
                            contentDescription = "Удалить план",
                            tint = DvTheme.colors.textGhost,
                            modifier = Modifier.size(18.dp),
                        )
                    }
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

@Composable
private fun PlanForm(viewModel: TreatmentPlansViewModel, canWrite: Boolean, onSaved: () -> Unit) {
    val form by viewModel.form.collectAsStateWithLifecycle()
    var pickingPatient by remember { mutableStateOf(false) }
    var pickingServiceForStage by remember { mutableStateOf<Int?>(null) }

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
            text = if (form.id != null) "План лечения" else "Новый план лечения",
            style = MaterialTheme.typography.titleLarge,
            color = DvTheme.colors.textPrimary,
        )

        DvOutlineButton(
            onClick = { pickingPatient = true },
            enabled = canWrite && form.id == null,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(form.patient?.name?.ifBlank { "Без имени" } ?: "Выбрать пациента")
        }

        OutlinedTextField(
            value = form.title,
            onValueChange = viewModel::updateTitle,
            label = { Text("Название плана") },
            singleLine = true,
            enabled = canWrite,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = form.diagnosis,
            onValueChange = viewModel::updateDiagnosis,
            label = { Text("Диагноз") },
            minLines = 2,
            enabled = canWrite,
            modifier = Modifier.fillMaxWidth(),
        )

        Text("Статус", style = MaterialTheme.typography.labelMedium, color = DvTheme.colors.textGhost)
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            PLAN_STATUS_LABELS.entries.chunked(2).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    row.forEach { (key, label) ->
                        FilterChip(
                            selected = form.status == key,
                            onClick = { viewModel.updateStatus(key) },
                            enabled = canWrite,
                            label = { Text(label, style = MaterialTheme.typography.labelMedium) },
                        )
                    }
                }
            }
        }

        Text(
            text = "Этапы лечения",
            style = MaterialTheme.typography.titleMedium,
            color = DvTheme.colors.textPrimary,
            modifier = Modifier.padding(top = 6.dp),
        )

        form.stages.forEachIndexed { index, stage ->
            StageCard(
                stage = stage,
                canWrite = canWrite,
                canRemove = form.stages.size > 1,
                onTitleChange = { viewModel.updateStageTitle(index, it) },
                onAddItem = { pickingServiceForStage = index },
                onRemoveItem = { itemIndex -> viewModel.removeItem(index, itemIndex) },
                onQtyChange = { itemIndex, qty -> viewModel.updateQty(index, itemIndex, qty) },
                onRemoveStage = { viewModel.removeStage(index) },
            )
        }

        if (canWrite) {
            DvOutlineButton(onClick = viewModel::addStage, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Text("Добавить этап", modifier = Modifier.padding(start = 6.dp))
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("Итого", style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary)
            Text(formatTenge(form.total), style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.gold)
        }

        OutlinedTextField(
            value = form.notes,
            onValueChange = viewModel::updateNotes,
            label = { Text("Заметки") },
            minLines = 2,
            enabled = canWrite,
            modifier = Modifier.fillMaxWidth(),
        )

        form.error?.let {
            Text(text = it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.error)
        }

        if (canWrite) {
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
                    Text(if (form.id != null) "Сохранить" else "Создать план")
                }
            }
        }
    }

    if (pickingPatient) {
        PatientPickerSheet(
            onDismiss = { pickingPatient = false },
            onSelect = { patient ->
                viewModel.updatePatient(patient)
                pickingPatient = false
            },
        )
    }

    pickingServiceForStage?.let { stageIndex ->
        ServicePickerSheet(
            services = form.priceList,
            onDismiss = { pickingServiceForStage = null },
            onSelect = { service ->
                viewModel.addItem(stageIndex, service)
                pickingServiceForStage = null
            },
        )
    }
}

@Composable
private fun StageCard(
    stage: PlanStageForm,
    canWrite: Boolean,
    canRemove: Boolean,
    onTitleChange: (String) -> Unit,
    onAddItem: () -> Unit,
    onRemoveItem: (Int) -> Unit,
    onQtyChange: (Int, Int) -> Unit,
    onRemoveStage: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface0),
        border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = stage.title,
                    onValueChange = onTitleChange,
                    singleLine = true,
                    enabled = canWrite,
                    label = { Text("Название этапа") },
                    modifier = Modifier.weight(1f),
                )
                if (canWrite && canRemove) {
                    IconButton(onClick = onRemoveStage, modifier = Modifier.size(28.dp).padding(start = 4.dp)) {
                        Icon(
                            Icons.Filled.Close,
                            contentDescription = "Удалить этап",
                            tint = DvTheme.colors.textGhost,
                            modifier = Modifier.size(16.dp),
                        )
                    }
                }
            }

            stage.items.forEachIndexed { itemIndex, item ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = item.serviceName,
                            style = MaterialTheme.typography.bodyMedium,
                            color = DvTheme.colors.textPrimary,
                        )
                        Text(
                            text = "${formatTenge(item.price)} × ${item.qty} = ${formatTenge(item.price * item.qty)}",
                            style = MaterialTheme.typography.labelSmall,
                            color = DvTheme.colors.textMuted,
                        )
                    }
                    if (canWrite) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "−",
                                modifier = Modifier
                                    .wrapContentWidth()
                                    .clickable { onQtyChange(itemIndex, item.qty - 1) }
                                    .padding(8.dp),
                                color = DvTheme.colors.gold,
                                style = MaterialTheme.typography.titleMedium,
                            )
                            Text(
                                text = item.qty.toString(),
                                style = MaterialTheme.typography.bodyMedium,
                                color = DvTheme.colors.textPrimary,
                                modifier = Modifier.padding(horizontal = 4.dp),
                            )
                            Text(
                                text = "+",
                                modifier = Modifier
                                    .wrapContentWidth()
                                    .clickable { onQtyChange(itemIndex, item.qty + 1) }
                                    .padding(8.dp),
                                color = DvTheme.colors.gold,
                                style = MaterialTheme.typography.titleMedium,
                            )
                            IconButton(onClick = { onRemoveItem(itemIndex) }, modifier = Modifier.size(24.dp)) {
                                Icon(
                                    Icons.Filled.Close,
                                    contentDescription = "Убрать услугу",
                                    tint = DvTheme.colors.textGhost,
                                    modifier = Modifier.size(14.dp),
                                )
                            }
                        }
                    }
                }
            }

            if (stage.items.isEmpty()) {
                Text(
                    text = "Услуги ещё не добавлены",
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.textGhost,
                )
            }

            if (canWrite) {
                Text(
                    text = "+ Добавить услугу",
                    style = MaterialTheme.typography.labelMedium,
                    color = DvTheme.colors.gold,
                    modifier = Modifier.clickable(onClick = onAddItem).padding(vertical = 4.dp),
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ServicePickerSheet(
    services: List<PriceListItem>,
    onDismiss: () -> Unit,
    onSelect: (PriceListItem) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val filtered = services.filter {
        query.isBlank() ||
            (it.name?.contains(query, ignoreCase = true) == true) ||
            it.serviceCode.contains(query, ignoreCase = true)
    }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = DvTheme.colors.surface1) {
        Column(modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 16.dp)) {
            Text(
                text = "Услуга из прайса",
                style = MaterialTheme.typography.titleMedium,
                color = DvTheme.colors.textPrimary,
                modifier = Modifier.padding(bottom = 8.dp),
            )
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                singleLine = true,
                label = { Text("Поиск по прайсу") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                modifier = Modifier.fillMaxWidth(),
            )
            if (filtered.isEmpty()) {
                Text(
                    text = if (services.isEmpty()) "Прайс-лист пуст" else "Ничего не найдено",
                    style = MaterialTheme.typography.bodyMedium,
                    color = DvTheme.colors.textMuted,
                    modifier = Modifier.padding(vertical = 24.dp),
                )
            } else {
                LazyColumn(modifier = Modifier.padding(top = 8.dp)) {
                    items(filtered, key = { it.id }) { item ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onSelect(item) }
                                .padding(vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = item.name?.ifBlank { null } ?: item.serviceCode,
                                style = MaterialTheme.typography.bodyMedium,
                                color = DvTheme.colors.textPrimary,
                                modifier = Modifier.weight(1f).padding(end = 8.dp),
                            )
                            Text(
                                text = formatTenge(item.price),
                                style = MaterialTheme.typography.bodyMedium,
                                color = DvTheme.colors.gold,
                            )
                        }
                    }
                }
            }
        }
    }
}
