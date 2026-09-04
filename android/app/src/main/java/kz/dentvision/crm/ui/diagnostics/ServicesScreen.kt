package kz.dentvision.crm.ui.diagnostics

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.DiagnosticsRepository
import kz.dentvision.crm.data.model.CreateServiceRequest
import kz.dentvision.crm.data.model.PricingItem
import kz.dentvision.crm.data.model.PricingUpdateItem
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvOutlineButton
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme

/** Перенос `DIAG_CATEGORIES` (`ServicesTab.tsx:11`) — один список для обоих видов. */
private val DIAG_CATEGORIES = listOf(
    "CBCT", "OPG", "TRG", "TMJ", "STL", "FACE_SCAN", "DICOM",
    "ALLERGY", "HISTOLOGY", "PCR", "MICROBIOLOGY", "BLOOD", "GENETICS", "BIOPSY", "SALIVA", "PATHOLOGY", "OTHER",
)

data class ServicesState(
    val loaded: UiState<List<PricingItem>> = UiState.Loading,
    val prices: Map<String, String> = emptyMap(),
    val saving: Boolean = false,
    val saveError: String? = null,
    val saveMessage: String? = null,
    val addOpen: Boolean = false,
    val addName: String = "",
    val addCategory: String = DIAG_CATEGORIES.first(),
    val addPrice: String = "",
    val creating: Boolean = false,
    val addError: String? = null,
)

/**
 * Перенос `ServicesTab.tsx` — прайс-лист услуг центра/лаборатории.
 * Массовое сохранение цены (`PATCH .../pricing`) и добавление новой
 * услуги (`POST .../pricing`). Веб не переключает `active` из этого
 * экрана вообще — здесь тоже нет.
 */
class ServicesViewModel(
    private val repository: DiagnosticsRepository = DiagnosticsRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(ServicesState())
    val state: StateFlow<ServicesState> = _state

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
                if (kind == OperatorKind.CENTER) repository.centerPricing(orgId) else repository.labPricing(orgId)
            }
                .onSuccess { items ->
                    _state.update {
                        it.copy(loaded = UiState.Data(items), prices = items.associate { p -> p.id to (p.price ?: "") })
                    }
                }
                .onFailure { e -> _state.update { it.copy(loaded = UiState.Error(e.message ?: "Не удалось получить прайс-лист")) } }
        }
    }

    fun setPrice(id: String, value: String) {
        _state.update { it.copy(prices = it.prices + (id to value), saveMessage = null) }
    }

    fun save() {
        val items = _state.value.prices.mapNotNull { (id, v) -> v.toDoubleOrNull()?.let { PricingUpdateItem(id, it) } }
        if (items.isEmpty()) return
        _state.update { it.copy(saving = true, saveError = null, saveMessage = null) }
        viewModelScope.launch {
            runCatching {
                if (kind == OperatorKind.CENTER) repository.updatePricing(items, centerId = orgId) else repository.updatePricing(items, labId = orgId)
            }
                .onSuccess {
                    _state.update { it.copy(saving = false, saveMessage = "Цены обновлены") }
                    load()
                }
                .onFailure { e -> _state.update { it.copy(saving = false, saveError = e.message ?: "Не удалось сохранить цены") } }
        }
    }

    fun openAdd() {
        _state.update { it.copy(addOpen = true, addName = "", addCategory = DIAG_CATEGORIES.first(), addPrice = "", addError = null) }
    }

    fun closeAdd() {
        _state.update { it.copy(addOpen = false) }
    }

    fun setAddName(v: String) {
        _state.update { it.copy(addName = v) }
    }

    fun setAddCategory(v: String) {
        _state.update { it.copy(addCategory = v) }
    }

    fun setAddPrice(v: String) {
        _state.update { it.copy(addPrice = v) }
    }

    fun createService() {
        val name = _state.value.addName.trim()
        if (name.isBlank()) return
        val body = CreateServiceRequest(name = name, category = _state.value.addCategory, price = _state.value.addPrice.toDoubleOrNull())
        _state.update { it.copy(creating = true, addError = null) }
        viewModelScope.launch {
            runCatching {
                if (kind == OperatorKind.CENTER) repository.createService(body, centerId = orgId) else repository.createService(body, labId = orgId)
            }
                .onSuccess {
                    _state.update { it.copy(creating = false, addOpen = false) }
                    load()
                }
                .onFailure { e -> _state.update { it.copy(creating = false, addError = e.message ?: "Не удалось добавить услугу") } }
        }
    }
}

@Composable
fun ServicesScreen(session: Session, viewModel: ServicesViewModel = viewModel()) {
    val kind = operatorKindFor(session.user.organizationType)
    val orgId = session.user.organizationId

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

    when (val loaded = state.loaded) {
        is UiState.Loading -> LoadingSkeleton()
        is UiState.Error -> ErrorState(message = loaded.message, onRetry = viewModel::load)
        is UiState.Data -> ServicesContent(items = loaded.value, state = state, viewModel = viewModel)
    }
}

@Composable
private fun ServicesContent(items: List<PricingItem>, state: ServicesState, viewModel: ServicesViewModel) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(text = "Прайс-лист услуг", style = MaterialTheme.typography.titleLarge, color = DvTheme.colors.textPrimary)

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DvOutlineButton(onClick = viewModel::openAdd, modifier = Modifier.weight(1f)) {
                Text("Добавить услугу")
            }
            DvPrimaryButton(onClick = viewModel::save, enabled = !state.saving, modifier = Modifier.weight(1f)) {
                if (state.saving) {
                    CircularProgressIndicator(strokeWidth = 2.dp, color = DvTheme.colors.goldOn, modifier = Modifier.padding(2.dp))
                } else {
                    Text("Сохранить")
                }
            }
        }

        state.saveMessage?.let { Text(text = it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.success) }
        state.saveError?.let { Text(text = it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.error) }

        if (items.isEmpty()) {
            Text(
                text = "Нет услуг. Добавьте первую услугу.",
                style = MaterialTheme.typography.bodyMedium,
                color = DvTheme.colors.textMuted,
                modifier = Modifier.padding(top = 24.dp),
            )
        } else {
            items.forEach { item ->
                ServiceRow(
                    item = item,
                    price = state.prices[item.id] ?: "",
                    onPriceChange = { viewModel.setPrice(item.id, it) },
                )
            }
        }
    }

    if (state.addOpen) {
        AddServiceDialog(state = state, viewModel = viewModel)
    }
}

@Composable
private fun ServiceRow(item: PricingItem, price: String, onPriceChange: (String) -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                    Text(text = item.name, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                    Text(text = item.category, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
                }
                Text(
                    text = if (item.active) "Активна" else "Не активна",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (item.active) DvTheme.colors.success else DvTheme.colors.error,
                )
            }
            OutlinedTextField(
                value = price,
                onValueChange = onPriceChange,
                label = { Text("Цена (₸)") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            )
        }
    }
}

@Composable
private fun AddServiceDialog(state: ServicesState, viewModel: ServicesViewModel) {
    AlertDialog(
        onDismissRequest = viewModel::closeAdd,
        title = { Text("Добавить услугу") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = state.addName,
                    onValueChange = viewModel::setAddName,
                    label = { Text("Название услуги") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(text = "Категория", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textGhost)
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    DIAG_CATEGORIES.forEach { cat ->
                        FilterChip(
                            selected = state.addCategory == cat,
                            onClick = { viewModel.setAddCategory(cat) },
                            label = { Text(cat, style = MaterialTheme.typography.labelSmall) },
                        )
                    }
                }
                OutlinedTextField(
                    value = state.addPrice,
                    onValueChange = viewModel::setAddPrice,
                    label = { Text("Цена (₸)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
                )
                state.addError?.let { Text(text = it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.error) }
            }
        },
        confirmButton = {
            TextButton(onClick = viewModel::createService, enabled = !state.creating && state.addName.isNotBlank()) { Text("Добавить") }
        },
        dismissButton = { TextButton(onClick = viewModel::closeAdd) { Text("Отмена") } },
    )
}
