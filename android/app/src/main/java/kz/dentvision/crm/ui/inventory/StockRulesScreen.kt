package kz.dentvision.crm.ui.inventory

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.CrmRepository
import kz.dentvision.crm.data.model.Icd10Code
import kz.dentvision.crm.data.model.InventoryItem
import kz.dentvision.crm.data.model.PriceListItem
import kz.dentvision.crm.data.model.StockDeductionPreviewLine
import kz.dentvision.crm.data.model.StockRule
import kz.dentvision.crm.data.model.StockRuleUpsert
import kz.dentvision.crm.data.model.StockRuleUpsertLine
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvBadge
import kz.dentvision.crm.ui.theme.DvBadgeVariant
import kz.dentvision.crm.ui.theme.DvConfirmDialog
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme

private enum class RuleScope(val value: String, val title: String, val hint: String) {
    ALWAYS("always", "Каждый приём", "Расходники, которые уходят независимо от того, что делали: перчатки, маска, слюноотсос."),
    SERVICE("service", "По услугам", "Материалы под конкретную услугу из прайса. Сработает, если эта услуга есть в закрытом приёме."),
    DIAGNOSIS("diagnosis", "По диагнозам", "Материалы под диагноз МКБ-10. Код рубрики («K02») охватывает всю рубрику, точный код («K02.1») — только себя."),
}

data class RuleLine(val itemId: String, val quantity: Int)

data class StockRulesUiState(
    val rules: UiState<List<StockRule>> = UiState.Loading,
    val inventory: List<InventoryItem> = emptyList(),
    val priceList: List<PriceListItem> = emptyList(),
    val message: String? = null,
    val deleteError: String? = null,
    val savingRuleId: String? = null,
    val creatingRule: Boolean = false,
)

class StockRulesViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(StockRulesUiState())
    val state: StateFlow<StockRulesUiState> = _state

    init {
        load()
        viewModelScope.launch {
            runCatching { repository.inventory() }
                .onSuccess { list -> _state.update { it.copy(inventory = list) } }
            runCatching { repository.priceList() }
                .onSuccess { list -> _state.update { it.copy(priceList = list.filter { p -> p.active }) } }
        }
    }

    fun load() {
        _state.update { it.copy(rules = UiState.Loading) }
        viewModelScope.launch {
            runCatching { repository.stockRules() }
                .onSuccess { list -> _state.update { it.copy(rules = UiState.Data(list)) } }
                .onFailure { _state.update { s -> s.copy(rules = UiState.Error(it.message ?: "Не удалось загрузить правила")) } }
        }
    }

    fun save(scope: String, matchKey: String, label: String?, active: Boolean, items: List<RuleLine>, ruleId: String? = null, onDone: (() -> Unit)? = null) {
        if (ruleId != null) {
            if (_state.value.savingRuleId == ruleId) return
        } else if (_state.value.creatingRule) {
            return
        }
        _state.update { if (ruleId != null) it.copy(savingRuleId = ruleId) else it.copy(creatingRule = true) }
        viewModelScope.launch {
            runCatching {
                repository.saveStockRule(
                    StockRuleUpsert(
                        scope = scope,
                        matchKey = matchKey,
                        label = label,
                        active = active,
                        items = items.map { StockRuleUpsertLine(it.itemId, it.quantity) },
                    ),
                )
            }
                .onSuccess {
                    load()
                    _state.update { s ->
                        if (ruleId != null) s.copy(message = "Правило сохранено", savingRuleId = null)
                        else s.copy(message = "Правило сохранено", creatingRule = false)
                    }
                    onDone?.invoke()
                }
                .onFailure { e ->
                    _state.update { s ->
                        val msg = e.message ?: "Не удалось сохранить правило"
                        if (ruleId != null) s.copy(message = msg, savingRuleId = null) else s.copy(message = msg, creatingRule = false)
                    }
                }
        }
    }

    fun delete(id: String) {
        viewModelScope.launch {
            runCatching { repository.deleteStockRule(id) }
                .onSuccess {
                    load()
                    _state.update { s -> s.copy(message = "Правило удалено") }
                }
                .onFailure { _state.update { s -> s.copy(deleteError = it.message ?: "Не удалось удалить правило") } }
        }
    }

    suspend fun searchIcd10(query: String): List<Icd10Code> =
        runCatching { repository.icd10(query.trim().ifBlank { null }) }.getOrDefault(emptyList())

    suspend fun preview(serviceCodes: List<String>, diagnosis: String?): List<StockDeductionPreviewLine> =
        runCatching { repository.previewStockDeduction(serviceCodes, diagnosis) }.getOrDefault(emptyList())

    fun consumeMessage() = _state.update { it.copy(message = null) }
    fun consumeDeleteError() = _state.update { it.copy(deleteError = null) }
}

/**
 * Списание расходников после приёма — перенос `StockRules.tsx`: то же
 * различие областей (каждый приём/услуга/диагноз), то же правило «на
 * область — одно правило, второй раз клиника его правит, а не заводит
 * дублем» (сервер решает это сам через upsert по `(scope, matchKey)`).
 *
 * Диагноз ищется через `/api/medical/icd10`, а не по статичному списку, как
 * в вебе (`DENTAL_ICD10`) — на Android этого справочника нет, а сервер уже
 * умеет искать по коду и описанию.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StockRulesScreen(canWrite: Boolean, viewModel: StockRulesViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var addScope by remember { mutableStateOf<RuleScope?>(null) }
    var previewOpen by remember { mutableStateOf(false) }
    var toDelete by remember { mutableStateOf<StockRule?>(null) }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Что уходит со склада, когда приём закрыт",
                style = MaterialTheme.typography.bodyMedium,
                color = DvTheme.colors.textMuted,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = { previewOpen = true }) {
                Icon(Icons.Filled.Visibility, contentDescription = null, modifier = Modifier.padding(end = 4.dp))
                Text("Проверить на примере")
            }
        }

        state.message?.let { msg ->
            LaunchedEffect(msg) {
                delay(2500)
                viewModel.consumeMessage()
            }
            Text(
                text = msg,
                style = MaterialTheme.typography.bodySmall,
                color = DvTheme.colors.gold,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
            )
        }
        state.deleteError?.let { err ->
            Text(
                text = err,
                style = MaterialTheme.typography.bodySmall,
                color = DvTheme.colors.error,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
            )
        }

        when (val rules = state.rules) {
            is UiState.Loading -> LoadingSkeleton()
            is UiState.Error -> ErrorState(message = rules.message, onRetry = viewModel::load)
            is UiState.Data -> Column(
                modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                RuleScope.entries.forEach { section ->
                    val sectionRules = rules.value.filter { it.scope == section.value }
                    val canAdd = canWrite && (section != RuleScope.ALWAYS || sectionRules.isEmpty())
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Top,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(section.title, style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary)
                                Text(section.hint, style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted, modifier = Modifier.padding(top = 2.dp))
                            }
                            if (canAdd) {
                                TextButton(onClick = { addScope = section }) {
                                    Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.padding(end = 4.dp))
                                    Text("Добавить")
                                }
                            }
                        }
                        if (sectionRules.isEmpty()) {
                            Text(
                                "Правил нет — по этой области ничего не списывается.",
                                style = MaterialTheme.typography.bodySmall,
                                color = DvTheme.colors.textMuted,
                                modifier = Modifier.padding(top = 8.dp),
                            )
                        } else {
                            Column(modifier = Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                sectionRules.forEach { rule ->
                                    RuleCard(
                                        rule = rule,
                                        title = targetLabel(rule, state.priceList),
                                        inventory = state.inventory,
                                        canWrite = canWrite,
                                        saving = state.savingRuleId == rule.id,
                                        onSave = { lines, active -> viewModel.save(rule.scope, rule.matchKey, rule.label, active, lines, ruleId = rule.id) },
                                        onDelete = { toDelete = rule },
                                    )
                                }
                            }
                        }
                    }
                }
                androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(bottom = 16.dp))
            }
        }
    }

    addScope?.let { section ->
        AddRuleSheet(
            section = section,
            inventory = state.inventory,
            priceList = state.priceList,
            searchIcd10 = viewModel::searchIcd10,
            creating = state.creatingRule,
            onDismiss = { addScope = null },
            onSave = { matchKey, label, lines ->
                viewModel.save(section.value, matchKey, label, true, lines) { addScope = null }
            },
        )
    }

    if (previewOpen) {
        PreviewSheet(
            priceList = state.priceList,
            searchIcd10 = { q -> viewModel.searchIcd10(q) },
            preview = { services, diagnosis -> viewModel.preview(services, diagnosis) },
            onDismiss = { previewOpen = false },
        )
    }

    toDelete?.let { rule ->
        DvConfirmDialog(
            title = "Удалить правило?",
            message = "«${targetLabel(rule, state.priceList)}» перестанет списывать материалы.",
            confirmLabel = "Удалить",
            onConfirm = {
                viewModel.delete(rule.id)
                toDelete = null
            },
            onDismiss = { toDelete = null },
        )
    }
}

private fun targetLabel(rule: StockRule, priceList: List<PriceListItem>): String {
    return when (rule.scope) {
        "always" -> "Каждый приём"
        "service" -> priceList.find { it.serviceCode == rule.matchKey }?.name?.takeIf { it.isNotBlank() } ?: rule.matchKey
        else -> rule.matchKey
    }
}

@Composable
private fun RuleCard(
    rule: StockRule,
    title: String,
    inventory: List<InventoryItem>,
    canWrite: Boolean,
    saving: Boolean,
    onSave: (List<RuleLine>, Boolean) -> Unit,
    onDelete: () -> Unit,
) {
    var lines by remember(rule.id) { mutableStateOf(rule.items.map { RuleLine(it.itemId, it.quantity) }) }
    var active by remember(rule.id) { mutableStateOf(rule.active) }
    var pickerOpen by remember { mutableStateOf(false) }
    val original = remember(rule.id) { rule.items.map { RuleLine(it.itemId, it.quantity) } to rule.active }
    val dirty = lines != original.first || active != original.second

    fun nameOf(itemId: String) = inventory.find { it.id == itemId }?.name
        ?: rule.items.find { it.itemId == itemId }?.item?.name ?: "Позиция удалена"
    fun unitOf(itemId: String) = inventory.find { it.id == itemId }?.unit
        ?: rule.items.find { it.itemId == itemId }?.item?.unit ?: "шт"

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(title, style = MaterialTheme.typography.titleSmall, color = DvTheme.colors.textPrimary)
                    if (!active) {
                        DvBadge(text = "Выключено", variant = DvBadgeVariant.WARNING, modifier = Modifier.padding(top = 4.dp))
                    }
                }
                if (canWrite) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        TextButton(onClick = { active = !active }) {
                            Text(if (active) "Выключить" else "Включить")
                        }
                        IconButton(onClick = onDelete) {
                            Icon(Icons.Filled.Delete, contentDescription = "Удалить правило", tint = DvTheme.colors.error)
                        }
                    }
                }
            }

            if (lines.isEmpty()) {
                Text(
                    "Позиций нет — правило ничего не спишет.",
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.textMuted,
                    modifier = Modifier.padding(top = 8.dp),
                )
            } else {
                Column(modifier = Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    lines.forEach { line ->
                        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                nameOf(line.itemId),
                                style = MaterialTheme.typography.bodyMedium,
                                color = DvTheme.colors.textPrimary,
                                modifier = Modifier.weight(1f),
                            )
                            if (canWrite) {
                                IconButton(onClick = {
                                    lines = lines.map { if (it.itemId == line.itemId) it.copy(quantity = (it.quantity - 1).coerceAtLeast(1)) else it }
                                }) { Icon(Icons.Filled.Remove, contentDescription = "Меньше") }
                            }
                            Text(
                                "${line.quantity} ${unitOf(line.itemId)}",
                                style = MaterialTheme.typography.bodyMedium,
                                color = DvTheme.colors.textPrimary,
                                modifier = Modifier.wrapContentWidth(),
                            )
                            if (canWrite) {
                                IconButton(onClick = {
                                    lines = lines.map { if (it.itemId == line.itemId) it.copy(quantity = it.quantity + 1) else it }
                                }) { Icon(Icons.Filled.Add, contentDescription = "Больше") }
                                IconButton(onClick = { lines = lines.filter { it.itemId != line.itemId } }) {
                                    Icon(Icons.Filled.Delete, contentDescription = "Убрать из правила", tint = DvTheme.colors.error.copy(alpha = 0.7f))
                                }
                            }
                        }
                    }
                }
            }

            if (canWrite) {
                Row(modifier = Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(onClick = { pickerOpen = true }) {
                        Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.padding(end = 4.dp))
                        Text("Добавить позицию")
                    }
                    if (dirty) {
                        DvPrimaryButton(onClick = { onSave(lines, active) }, enabled = !saving) {
                            if (saving) {
                                CircularProgressIndicator(strokeWidth = 2.dp, color = DvTheme.colors.goldOn, modifier = Modifier.padding(end = 8.dp))
                            }
                            Text("Сохранить")
                        }
                    }
                }
            }
        }
    }

    if (pickerOpen) {
        InventoryPickerSheet(
            inventory = inventory.filter { item -> lines.none { it.itemId == item.id } },
            onDismiss = { pickerOpen = false },
            onSelect = { item ->
                lines = lines + RuleLine(item.id, 1)
                pickerOpen = false
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InventoryPickerSheet(
    inventory: List<InventoryItem>,
    onDismiss: () -> Unit,
    onSelect: (InventoryItem) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val filtered = inventory.filter { query.isBlank() || it.name.contains(query, ignoreCase = true) }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = DvTheme.colors.surface1) {
        Column(modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 16.dp)) {
            Text("Позиция со склада", style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary, modifier = Modifier.padding(bottom = 8.dp))
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                singleLine = true,
                label = { Text("Поиск") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                modifier = Modifier.fillMaxWidth(),
            )
            if (filtered.isEmpty()) {
                Text(
                    if (inventory.isEmpty()) "Все позиции уже добавлены" else "Ничего не найдено",
                    style = MaterialTheme.typography.bodyMedium,
                    color = DvTheme.colors.textMuted,
                    modifier = Modifier.padding(vertical = 24.dp),
                )
            } else {
                LazyColumn(modifier = Modifier.padding(top = 8.dp)) {
                    items(filtered, key = { it.id }) { item ->
                        Row(
                            modifier = Modifier.fillMaxWidth().clickable { onSelect(item) }.padding(vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(item.name, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                            Text("остаток ${item.quantity}", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
                        }
                    }
                }
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
    val filtered = services.filter { query.isBlank() || it.name?.contains(query, ignoreCase = true) == true || it.serviceCode.contains(query, ignoreCase = true) }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = DvTheme.colors.surface1) {
        Column(modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 16.dp)) {
            Text("Услуга из прайса", style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary, modifier = Modifier.padding(bottom = 8.dp))
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
                    if (services.isEmpty()) "Прайс-лист пуст" else "Ничего не найдено",
                    style = MaterialTheme.typography.bodyMedium,
                    color = DvTheme.colors.textMuted,
                    modifier = Modifier.padding(vertical = 24.dp),
                )
            } else {
                LazyColumn(modifier = Modifier.padding(top = 8.dp)) {
                    items(filtered, key = { it.id }) { item ->
                        Row(
                            modifier = Modifier.fillMaxWidth().clickable { onSelect(item) }.padding(vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(item.name?.ifBlank { null } ?: item.serviceCode, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DiagnosisPickerSheet(
    search: suspend (String) -> List<Icd10Code>,
    onDismiss: () -> Unit,
    onSelect: (Icd10Code) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<Icd10Code>>(emptyList()) }
    var job by remember { mutableStateOf<Job?>(null) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) { results = search("") }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = DvTheme.colors.surface1) {
        Column(modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 16.dp)) {
            Text("Диагноз МКБ-10", style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary, modifier = Modifier.padding(bottom = 8.dp))
            OutlinedTextField(
                value = query,
                onValueChange = { value ->
                    query = value
                    job?.cancel()
                    job = scope.launch {
                        delay(300)
                        results = search(value)
                    }
                },
                singleLine = true,
                label = { Text("Код или название") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                modifier = Modifier.fillMaxWidth(),
            )
            if (results.isEmpty()) {
                Text("Ничего не нашли", style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textMuted, modifier = Modifier.padding(vertical = 24.dp))
            } else {
                LazyColumn(modifier = Modifier.padding(top = 8.dp)) {
                    items(results, key = { it.code }) { code ->
                        Column(
                            modifier = Modifier.fillMaxWidth().clickable { onSelect(code) }.padding(vertical = 10.dp),
                        ) {
                            Text(code.code, style = MaterialTheme.typography.labelLarge, color = DvTheme.colors.gold)
                            Text(code.description, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textPrimary)
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddRuleSheet(
    section: RuleScope,
    inventory: List<InventoryItem>,
    priceList: List<PriceListItem>,
    searchIcd10: suspend (String) -> List<Icd10Code>,
    creating: Boolean,
    onDismiss: () -> Unit,
    onSave: (matchKey: String, label: String?, items: List<RuleLine>) -> Unit,
) {
    var matchKey by remember { mutableStateOf("") }
    var matchLabel by remember { mutableStateOf("") }
    var lines by remember { mutableStateOf<List<RuleLine>>(emptyList()) }
    var pickerOpen by remember { mutableStateOf(false) }
    var targetPickerOpen by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val ready = (section == RuleScope.ALWAYS || matchKey.isNotBlank()) && lines.isNotEmpty() && !creating

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = DvTheme.colors.surface1) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                when (section) {
                    RuleScope.SERVICE -> "Правило на услугу"
                    RuleScope.DIAGNOSIS -> "Правило на диагноз"
                    RuleScope.ALWAYS -> "Расходники каждого приёма"
                },
                style = MaterialTheme.typography.titleLarge,
                color = DvTheme.colors.textPrimary,
            )

            if (section != RuleScope.ALWAYS) {
                Row(
                    modifier = Modifier.fillMaxWidth().clickable { targetPickerOpen = true }.padding(vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        if (matchKey.isBlank()) {
                            if (section == RuleScope.SERVICE) "— выберите услугу —" else "— выберите диагноз —"
                        } else {
                            matchLabel.ifBlank { matchKey }
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (matchKey.isBlank()) DvTheme.colors.textMuted else DvTheme.colors.textPrimary,
                    )
                }
                if (section == RuleScope.DIAGNOSIS) {
                    Text(
                        "Правило сработает и на уточнённые коды той же рубрики: выбрав «K02.1», вы охватите только его, а рубрику целиком — код без точки.",
                        style = MaterialTheme.typography.labelSmall,
                        color = DvTheme.colors.textMuted,
                    )
                }
            }

            Text("Что списывать", style = MaterialTheme.typography.labelLarge, color = DvTheme.colors.textMuted)
            lines.forEach { line ->
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        inventory.find { it.id == line.itemId }?.name ?: line.itemId,
                        style = MaterialTheme.typography.bodyMedium,
                        color = DvTheme.colors.textPrimary,
                        modifier = Modifier.weight(1f),
                    )
                    IconButton(onClick = { lines = lines.map { if (it.itemId == line.itemId) it.copy(quantity = (it.quantity - 1).coerceAtLeast(1)) else it } }) {
                        Icon(Icons.Filled.Remove, contentDescription = "Меньше")
                    }
                    Text("${line.quantity}", style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                    IconButton(onClick = { lines = lines.map { if (it.itemId == line.itemId) it.copy(quantity = it.quantity + 1) else it } }) {
                        Icon(Icons.Filled.Add, contentDescription = "Больше")
                    }
                    IconButton(onClick = { lines = lines.filter { it.itemId != line.itemId } }) {
                        Icon(Icons.Filled.Delete, contentDescription = "Убрать позицию", tint = DvTheme.colors.error.copy(alpha = 0.7f))
                    }
                }
            }
            TextButton(onClick = { pickerOpen = true }) {
                Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.padding(end = 4.dp))
                Text(if (inventory.isEmpty()) "Склад пуст" else "Добавить позицию со склада")
            }

            Row(modifier = Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                DvPrimaryButton(
                    onClick = { onSave(if (section == RuleScope.ALWAYS) "" else matchKey, matchLabel.ifBlank { null }, lines) },
                    enabled = ready,
                    modifier = Modifier.weight(1f),
                ) {
                    if (creating) {
                        CircularProgressIndicator(strokeWidth = 2.dp, color = DvTheme.colors.goldOn, modifier = Modifier.padding(end = 8.dp))
                    }
                    Text("Создать правило")
                }
                TextButton(onClick = onDismiss, enabled = !creating) { Text("Отмена") }
            }
        }
    }

    if (pickerOpen) {
        InventoryPickerSheet(
            inventory = inventory.filter { item -> lines.none { it.itemId == item.id } },
            onDismiss = { pickerOpen = false },
            onSelect = { item ->
                lines = lines + RuleLine(item.id, 1)
                pickerOpen = false
            },
        )
    }

    if (targetPickerOpen && section == RuleScope.SERVICE) {
        ServicePickerSheet(
            services = priceList,
            onDismiss = { targetPickerOpen = false },
            onSelect = { service ->
                matchKey = service.serviceCode
                matchLabel = service.name ?: service.serviceCode
                targetPickerOpen = false
            },
        )
    }
    if (targetPickerOpen && section == RuleScope.DIAGNOSIS) {
        DiagnosisPickerSheet(
            search = searchIcd10,
            onDismiss = { targetPickerOpen = false },
            onSelect = { code ->
                matchKey = code.code
                matchLabel = "${code.code} — ${code.description}"
                targetPickerOpen = false
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PreviewSheet(
    priceList: List<PriceListItem>,
    searchIcd10: suspend (String) -> List<Icd10Code>,
    preview: suspend (List<String>, String?) -> List<StockDeductionPreviewLine>,
    onDismiss: () -> Unit,
) {
    var service by remember { mutableStateOf<PriceListItem?>(null) }
    var diagnosis by remember { mutableStateOf<Icd10Code?>(null) }
    var lines by remember { mutableStateOf<List<StockDeductionPreviewLine>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var servicePickerOpen by remember { mutableStateOf(false) }
    var diagnosisPickerOpen by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    LaunchedEffect(service, diagnosis) {
        loading = true
        lines = preview(listOfNotNull(service?.serviceCode), diagnosis?.code)
        loading = false
    }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = DvTheme.colors.surface1) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Что спишется", style = MaterialTheme.typography.titleLarge, color = DvTheme.colors.textPrimary)
            Text(
                "Тот же расчёт, что и при закрытии приёма — не отдельная прикидка.",
                style = MaterialTheme.typography.labelSmall,
                color = DvTheme.colors.textMuted,
            )

            Row(
                modifier = Modifier.fillMaxWidth().clickable { servicePickerOpen = true }.padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("Услуга приёма", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
                Text(
                    service?.name?.ifBlank { null } ?: service?.serviceCode ?: "— без услуги —",
                    style = MaterialTheme.typography.bodyMedium,
                    color = DvTheme.colors.textPrimary,
                )
            }
            Row(
                modifier = Modifier.fillMaxWidth().clickable { diagnosisPickerOpen = true }.padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("Диагноз", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
                Text(
                    diagnosis?.code ?: "— без диагноза —",
                    style = MaterialTheme.typography.bodyMedium,
                    color = DvTheme.colors.textPrimary,
                )
            }

            if (loading) {
                CircularProgressIndicator(strokeWidth = 2.dp, color = DvTheme.colors.gold)
            } else if (lines.isEmpty()) {
                EmptyStateView(title = "Ничего не спишется", description = "Под такой приём правил нет.")
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    lines.forEach { line ->
                        val short = line.available < line.quantity
                        Card(
                            colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
                            border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text(line.itemName, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                                    Text(
                                        "−${line.quantity} ${line.unit ?: "шт"}",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = if (short) DvTheme.colors.warning else DvTheme.colors.textPrimary,
                                    )
                                }
                                Text(
                                    "По правилам: ${line.sources.joinToString(", ")} · на складе ${line.available}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = DvTheme.colors.textMuted,
                                )
                                if (short) {
                                    Text(
                                        "Не хватит: спишется ${line.available} из ${line.quantity}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = DvTheme.colors.warning,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (servicePickerOpen) {
        ServicePickerSheet(
            services = priceList,
            onDismiss = { servicePickerOpen = false },
            onSelect = { service = it; servicePickerOpen = false },
        )
    }
    if (diagnosisPickerOpen) {
        DiagnosisPickerSheet(
            search = searchIcd10,
            onDismiss = { diagnosisPickerOpen = false },
            onSelect = { diagnosis = it; diagnosisPickerOpen = false },
        )
    }
}
