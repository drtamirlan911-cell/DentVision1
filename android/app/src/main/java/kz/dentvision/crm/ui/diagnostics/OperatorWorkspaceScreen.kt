package kz.dentvision.crm.ui.diagnostics

import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kz.dentvision.crm.data.DiagnosticsRepository
import kz.dentvision.crm.data.model.Referral
import kz.dentvision.crm.data.model.UploadFileRequest
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.lib.formatTenge
import kz.dentvision.crm.navigation.LocalAssistantNavigate
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_REFERRALS
import kz.dentvision.crm.navigation.ROUTE_OPERATOR_CASHIER
import kz.dentvision.crm.navigation.ROUTE_OPERATOR_FINANCE
import kz.dentvision.crm.navigation.ROUTE_OPERATOR_PAYMENTS
import kz.dentvision.crm.navigation.ROUTE_OPERATOR_SERVICES
import kz.dentvision.crm.navigation.ROUTE_OPERATOR_TEAM
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvOutlineButton
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme
import java.util.UUID

enum class OperatorKind { CENTER, LAB }

/**
 * `organizationType` активного пространства → вид кабинета приёма, или
 * `null`, если пространство не диагностическое вообще (SUPPLIER/ACADEMY/
 * PARTNER/CLINIC — сюда попадать не должны через обычную навигацию после
 * починки маршрутизации в `AppShell.kt`, но экран не должен угадывать).
 * `internal`, единственная копия на пакет `ui.diagnostics` — переиспользуется
 * во всех шести экранах кабинета приёма, чтобы не повторять одну и ту же
 * проверку и не заваливаться в CENTER по умолчанию для любого «не LABORATORY».
 */
internal fun operatorKindFor(organizationType: String?): OperatorKind? = when (organizationType) {
    "LABORATORY" -> OperatorKind.LAB
    "DIAGNOSTIC_CENTER" -> OperatorKind.CENTER
    else -> null
}

private data class OperatorConfig(val title: String, val referralsLabel: String)

private val OPERATOR_CONFIGS = mapOf(
    OperatorKind.CENTER to OperatorConfig("Диагностический центр", "Направления"),
    OperatorKind.LAB to OperatorConfig("Лаборатория", "Заказы"),
)

private val PHASE_LABELS = mapOf(
    ReferralPhase.AWAITING to "Ждут ответа",
    ReferralPhase.ACCEPTED to "Приняты",
    ReferralPhase.IN_PROGRESS to "В работе",
    ReferralPhase.DONE to "Готово",
)

private const val MAX_RESULT_FILE_BYTES = 10 * 1024 * 1024

data class OperatorPendingFile(
    val id: String,
    val fileName: String,
    val fileType: String,
    val fileSize: Long,
    val dataUri: String,
)

data class OperatorWorkspaceState(
    val loaded: UiState<List<Referral>> = UiState.Loading,
    val phaseFilter: ReferralPhase? = null,
    val search: String = "",
    val busyId: String? = null,
    val acceptTarget: Referral? = null,
    val acceptCost: String = "",
    val acceptFee: String = "",
    val acceptError: String? = null,
    val resultTarget: Referral? = null,
    val reportText: String = "",
    val conclusion: String = "",
    val resultFiles: List<OperatorPendingFile> = emptyList(),
    val generatingAi: Boolean = false,
    val submittingResult: Boolean = false,
    val resultError: String? = null,
)

/**
 * Приёмная сторона диагностики — перенос очереди направлений из
 * `DiagnosticWorkspace.tsx`/`ReferralsTab.tsx` (вкладка «Направления»/
 * «Заказы», Этап 6a). Остальные пять вкладок веб-кабинета (касса, финансы,
 * услуги, оплаты, сотрудники) — сознательно не входят, следующие срезы.
 *
 * `orgId` берётся только из `session.user.organizationId` — оно отражает
 * АКТИВНОЕ рабочее пространство (JWT переиздаётся при `switch-context`,
 * `middleware/auth.ts:159`), не фиксированный атрибут пользователя.
 * Пикер по нескольким членствам и каталог для суперадмина, которые есть на
 * вебе, здесь не строятся — честная граница, см. план Этапа 6a.
 */
class OperatorWorkspaceViewModel(
    private val repository: DiagnosticsRepository = DiagnosticsRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(OperatorWorkspaceState())
    val state: StateFlow<OperatorWorkspaceState> = _state

    private var kind: OperatorKind = OperatorKind.CENTER
    private var orgId: String = ""
    private var startedFor: String? = null

    fun start(kind: OperatorKind, orgId: String) {
        val key = "$kind:$orgId"
        if (startedFor == key) return
        startedFor = key
        this.kind = kind
        this.orgId = orgId
        load()
    }

    fun load() {
        _state.update { it.copy(loaded = UiState.Loading) }
        viewModelScope.launch {
            runCatching {
                if (kind == OperatorKind.CENTER) repository.referrals(limit = 100, centerId = orgId) else repository.referrals(limit = 100, labId = orgId)
            }
                .onSuccess { (items, _) -> _state.update { it.copy(loaded = UiState.Data(items)) } }
                .onFailure { e -> _state.update { it.copy(loaded = UiState.Error(e.message ?: "Не удалось получить направления")) } }
        }
    }

    fun setSearch(q: String) {
        _state.update { it.copy(search = q) }
    }

    fun togglePhaseFilter(phase: ReferralPhase) {
        _state.update { it.copy(phaseFilter = if (it.phaseFilter == phase) null else phase) }
    }

    fun openAccept(referral: Referral) {
        _state.update { it.copy(acceptTarget = referral, acceptCost = "", acceptFee = "", acceptError = null) }
    }

    fun dismissAccept() {
        _state.update { it.copy(acceptTarget = null) }
    }

    fun setAcceptCost(v: String) {
        _state.update { it.copy(acceptCost = v) }
    }

    fun setAcceptFee(v: String) {
        _state.update { it.copy(acceptFee = v) }
    }

    fun confirmAccept() {
        val target = _state.value.acceptTarget ?: return
        val cost = _state.value.acceptCost.toDoubleOrNull()
        if (cost == null || cost <= 0) return
        val fee = _state.value.acceptFee.toDoubleOrNull()
        _state.update { it.copy(busyId = target.id, acceptError = null) }
        viewModelScope.launch {
            runCatching { repository.changeReferralStatus(target.id, "ACCEPTED", cost, fee) }
                .onSuccess { _state.update { it.copy(busyId = null, acceptTarget = null) }; load() }
                .onFailure { e -> _state.update { it.copy(busyId = null, acceptError = e.message ?: "Не удалось принять направление") } }
        }
    }

    fun startWork(referralId: String) {
        _state.update { it.copy(busyId = referralId) }
        viewModelScope.launch {
            runCatching { repository.changeReferralStatus(referralId, "IN_PROGRESS") }
                .onSuccess { _state.update { it.copy(busyId = null) }; load() }
                .onFailure { _state.update { it.copy(busyId = null) } }
        }
    }

    fun openResult(referral: Referral) {
        _state.update {
            it.copy(resultTarget = referral, reportText = "", conclusion = "", resultFiles = emptyList(), resultError = null)
        }
    }

    fun dismissResult() {
        _state.update { it.copy(resultTarget = null) }
    }

    fun setReportText(v: String) {
        _state.update { it.copy(reportText = v) }
    }

    fun setConclusion(v: String) {
        _state.update { it.copy(conclusion = v) }
    }

    fun generateAi() {
        val target = _state.value.resultTarget ?: return
        _state.update { it.copy(generatingAi = true, resultError = null) }
        viewModelScope.launch {
            runCatching { repository.aiGenerateResult(target.id) }
                .onSuccess { result -> _state.update { it.copy(generatingAi = false, reportText = result.reportText ?: it.reportText) } }
                .onFailure { e -> _state.update { it.copy(generatingAi = false, resultError = e.message ?: "Не удалось сгенерировать заключение") } }
        }
    }

    fun addResultFile(resolver: ContentResolver, uri: Uri) {
        viewModelScope.launch(Dispatchers.IO) {
            runCatching {
                val bytes = resolver.openInputStream(uri)?.use { it.readBytes() } ?: error("Не удалось прочитать файл")
                if (bytes.size > MAX_RESULT_FILE_BYTES) error("Файл больше 10 МБ")
                val mime = resolver.getType(uri) ?: "application/octet-stream"
                val name = displayName(resolver, uri) ?: uri.lastPathSegment ?: "файл"
                val dataUri = "data:$mime;base64,${Base64.encodeToString(bytes, Base64.NO_WRAP)}"
                OperatorPendingFile(id = UUID.randomUUID().toString(), fileName = name, fileType = mime, fileSize = bytes.size.toLong(), dataUri = dataUri)
            }
                .onSuccess { file -> _state.update { it.copy(resultFiles = it.resultFiles + file) } }
                .onFailure { e -> _state.update { it.copy(resultError = e.message ?: "Не удалось добавить файл") } }
        }
    }

    fun removeResultFile(id: String) {
        _state.update { it.copy(resultFiles = it.resultFiles.filterNot { f -> f.id == id }) }
    }

    private fun displayName(resolver: ContentResolver, uri: Uri): String? =
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (!cursor.moveToFirst()) return@use null
            val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (idx >= 0) cursor.getString(idx) else null
        }

    fun submitResult() {
        val target = _state.value.resultTarget ?: return
        val report = _state.value.reportText
        if (report.isBlank()) return
        val conclusion = _state.value.conclusion.trim().ifBlank { null }
        val files = _state.value.resultFiles
        _state.update { it.copy(submittingResult = true, resultError = null) }
        viewModelScope.launch {
            runCatching { repository.signResult(target.id, report, conclusion) }
                .onSuccess {
                    for (file in files) {
                        runCatching {
                            repository.uploadFile(
                                UploadFileRequest(
                                    referralId = target.id,
                                    fileName = file.fileName,
                                    fileData = file.dataUri,
                                    fileType = file.fileType,
                                    fileSize = file.fileSize,
                                ),
                            )
                        }
                    }
                    _state.update { it.copy(submittingResult = false, resultTarget = null, reportText = "", conclusion = "", resultFiles = emptyList()) }
                    load()
                }
                .onFailure { e -> _state.update { it.copy(submittingResult = false, resultError = e.message ?: "Не удалось отправить результат") } }
        }
    }
}

/**
 * `Decimal?` с провода: число или строка — приводим в месте показа, не в
 * модели. `internal`, единственная копия на пакет `ui.diagnostics` —
 * переиспользуется из `ReferralDetailScreen.kt` и `CashierScreen.kt`.
 */
internal fun JsonElement?.asTengeOrNull(): Int? =
    (this as? JsonPrimitive)?.content?.toDoubleOrNull()?.toInt()

@Composable
fun OperatorWorkspaceScreen(session: Session, viewModel: OperatorWorkspaceViewModel = viewModel()) {
    val kind = operatorKindFor(session.user.organizationType)
    val orgId = session.user.organizationId
    val onNavigate = LocalAssistantNavigate.current

    if (kind == null || orgId == null) {
        Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
            Text(
                text = "Не удалось определить организацию текущего рабочего пространства.",
                style = MaterialTheme.typography.bodyMedium,
                color = DvTheme.colors.textMuted,
            )
        }
        return
    }

    LaunchedEffect(kind, orgId) { viewModel.start(kind, orgId) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val config = OPERATOR_CONFIGS.getValue(kind)

    when (val loaded = state.loaded) {
        is UiState.Loading -> LoadingSkeleton()
        is UiState.Error -> ErrorState(message = loaded.message, onRetry = viewModel::load)
        is UiState.Data -> OperatorWorkspaceContent(
            config = config,
            state = state,
            referrals = loaded.value,
            viewModel = viewModel,
            onOpenDetail = { id -> onNavigate("$ROUTE_DIAGNOSTICS_REFERRALS/$id") },
            onOpenCashier = { onNavigate(ROUTE_OPERATOR_CASHIER) },
            onOpenFinance = { onNavigate(ROUTE_OPERATOR_FINANCE) },
            onOpenServices = { onNavigate(ROUTE_OPERATOR_SERVICES) },
            onOpenPayments = { onNavigate(ROUTE_OPERATOR_PAYMENTS) },
            onOpenTeam = { onNavigate(ROUTE_OPERATOR_TEAM) },
        )
    }
}

@Composable
private fun OperatorWorkspaceContent(
    config: OperatorConfig,
    state: OperatorWorkspaceState,
    referrals: List<Referral>,
    viewModel: OperatorWorkspaceViewModel,
    onOpenDetail: (String) -> Unit,
    onOpenCashier: () -> Unit,
    onOpenFinance: () -> Unit,
    onOpenServices: () -> Unit,
    onOpenPayments: () -> Unit,
    onOpenTeam: () -> Unit,
) {
    val counts = referrals.groupingBy { referralPhase(it.status) }.eachCount()
    val awaiting = (counts[ReferralPhase.AWAITING] ?: 0) + (counts[ReferralPhase.ACCEPTED] ?: 0)
    val inProgress = counts[ReferralPhase.IN_PROGRESS] ?: 0
    val done = counts[ReferralPhase.DONE] ?: 0

    val filtered = referrals
        .let { list -> state.phaseFilter?.let { phase -> list.filter { referralPhase(it.status) == phase } } ?: list }
        .let { list ->
            val q = state.search.trim().lowercase()
            if (q.isEmpty()) list else list.filter { it.patientName.lowercase().contains(q) || it.studyType.lowercase().contains(q) }
        }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(text = config.title, style = MaterialTheme.typography.titleLarge, color = DvTheme.colors.textPrimary)

        Card(
            colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
            border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = awaiting.toString(),
                    style = MaterialTheme.typography.headlineMedium,
                    color = if (awaiting > 0) DvTheme.colors.gold else DvTheme.colors.success,
                )
                Text(text = "Ждут вашего действия", style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                Text(
                    text = "$inProgress в работе · $done завершено",
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.textMuted,
                )
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DvOutlineButton(onClick = onOpenCashier, modifier = Modifier.weight(1f)) {
                Text("Касса")
            }
            DvOutlineButton(onClick = onOpenFinance, modifier = Modifier.weight(1f)) {
                Text("Финансы")
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DvOutlineButton(onClick = onOpenServices, modifier = Modifier.weight(1f)) {
                Text("Услуги")
            }
            DvOutlineButton(onClick = onOpenPayments, modifier = Modifier.weight(1f)) {
                Text("Оплаты")
            }
            DvOutlineButton(onClick = onOpenTeam, modifier = Modifier.weight(1f)) {
                Text("Сотрудники")
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            PHASE_LABELS.forEach { (phase, label) ->
                FilterChip(
                    selected = state.phaseFilter == phase,
                    onClick = { viewModel.togglePhaseFilter(phase) },
                    label = { Text("$label (${counts[phase] ?: 0})", style = MaterialTheme.typography.labelSmall) },
                )
            }
        }

        OutlinedTextField(
            value = state.search,
            onValueChange = viewModel::setSearch,
            singleLine = true,
            label = { Text("Поиск по пациенту или исследованию") },
            modifier = Modifier.fillMaxWidth(),
        )

        if (filtered.isEmpty()) {
            Text(
                text = "${config.referralsLabel}: пусто",
                style = MaterialTheme.typography.bodyMedium,
                color = DvTheme.colors.textMuted,
                modifier = Modifier.padding(top = 24.dp),
            )
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(filtered, key = { it.id }) { referral ->
                    OperatorReferralRow(
                        referral = referral,
                        busy = state.busyId == referral.id,
                        onOpenDetail = { onOpenDetail(referral.id) },
                        onAccept = { viewModel.openAccept(referral) },
                        onStart = { viewModel.startWork(referral.id) },
                        onOpenResult = { viewModel.openResult(referral) },
                    )
                }
            }
        }
    }

    state.acceptTarget?.let { target ->
        AcceptDialog(
            referral = target,
            cost = state.acceptCost,
            fee = state.acceptFee,
            error = state.acceptError,
            busy = state.busyId == target.id,
            onCostChange = viewModel::setAcceptCost,
            onFeeChange = viewModel::setAcceptFee,
            onDismiss = viewModel::dismissAccept,
            onConfirm = viewModel::confirmAccept,
        )
    }

    if (state.resultTarget != null) {
        ResultSheet(state = state, viewModel = viewModel)
    }
}

@Composable
private fun OperatorReferralRow(
    referral: Referral,
    busy: Boolean,
    onOpenDetail: () -> Unit,
    onAccept: () -> Unit,
    onStart: () -> Unit,
    onOpenResult: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onOpenDetail),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                    Text(text = referral.patientName.ifBlank { "Неизвестно" }, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                    val sub = listOfNotNull(
                        referral.studyType.ifBlank { null },
                        referral.clinic?.name?.takeIf { it.isNotBlank() },
                    ).joinToString(" · ")
                    if (sub.isNotBlank()) {
                        Text(text = sub, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
                    }
                    referral.cost.asTengeOrNull()?.let {
                        Text(text = formatTenge(it), style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.gold)
                    }
                }
                Column(horizontalAlignment = Alignment.End) {
                    StatusChip(referral.status)
                    if (referral.paid) {
                        Text(text = "Оплачено", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.success)
                    }
                }
            }
            when (referral.status) {
                "SENT" -> Row(modifier = Modifier.padding(top = 8.dp)) {
                    DvPrimaryButton(onClick = onAccept, enabled = !busy) { Text("Принять") }
                }
                "ACCEPTED" -> Row(modifier = Modifier.padding(top = 8.dp)) {
                    DvPrimaryButton(onClick = onStart, enabled = !busy) { Text("Начать") }
                }
                "IN_PROGRESS" -> Row(modifier = Modifier.padding(top = 8.dp)) {
                    DvPrimaryButton(onClick = onOpenResult, enabled = !busy) { Text("Результат") }
                }
            }
        }
    }
}

@Composable
private fun AcceptDialog(
    referral: Referral,
    cost: String,
    fee: String,
    error: String?,
    busy: Boolean,
    onCostChange: (String) -> Unit,
    onFeeChange: (String) -> Unit,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Принять направление") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(text = referral.patientName.ifBlank { "Неизвестно" }, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textMuted)
                OutlinedTextField(
                    value = cost,
                    onValueChange = onCostChange,
                    label = { Text("Стоимость услуги (₸)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = fee,
                    onValueChange = onFeeChange,
                    label = { Text("Комиссия платформы (₸, опционально)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
                )
                error?.let { Text(text = it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.error) }
            }
        },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = !busy && (cost.toDoubleOrNull() ?: 0.0) > 0.0) { Text("Принять") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ResultSheet(state: OperatorWorkspaceState, viewModel: OperatorWorkspaceViewModel) {
    val context = LocalContext.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val filePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { viewModel.addResultFile(context.contentResolver, it) }
    }

    ModalBottomSheet(
        onDismissRequest = viewModel::dismissResult,
        sheetState = sheetState,
        containerColor = DvTheme.colors.surface1,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .imePadding()
                .padding(horizontal = 16.dp)
                .padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(text = "Отправить результат", style = MaterialTheme.typography.titleLarge, color = DvTheme.colors.textPrimary)

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(text = "Заключение", style = MaterialTheme.typography.labelMedium, color = DvTheme.colors.textGhost)
                TextButton(onClick = viewModel::generateAi, enabled = !state.generatingAi) {
                    if (state.generatingAi) {
                        CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.padding(2.dp))
                    } else {
                        Text("AI")
                    }
                }
            }
            OutlinedTextField(
                value = state.reportText,
                onValueChange = viewModel::setReportText,
                minLines = 4,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = state.conclusion,
                onValueChange = viewModel::setConclusion,
                label = { Text("Вывод (опционально)") },
                minLines = 2,
                modifier = Modifier.fillMaxWidth(),
            )

            Text(text = "Файлы результатов", style = MaterialTheme.typography.labelMedium, color = DvTheme.colors.textGhost)
            state.resultFiles.forEach { file ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(text = file.fileName, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary, modifier = Modifier.weight(1f))
                    IconButton(onClick = { viewModel.removeResultFile(file.id) }) {
                        Icon(Icons.Filled.Close, contentDescription = "Убрать файл", tint = DvTheme.colors.textMuted)
                    }
                }
            }
            DvOutlineButton(onClick = { filePicker.launch("*/*") }, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Filled.AttachFile, contentDescription = null, modifier = Modifier.padding(end = 6.dp))
                Text("Добавить файл")
            }

            state.resultError?.let { Text(text = it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.error) }

            DvPrimaryButton(
                onClick = viewModel::submitResult,
                enabled = !state.submittingResult && state.reportText.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (state.submittingResult) {
                    CircularProgressIndicator(strokeWidth = 2.dp, color = DvTheme.colors.goldOn, modifier = Modifier.padding(2.dp))
                } else {
                    Text("Отправить результат")
                }
            }
        }
    }
}
