package kz.dentvision.crm.ui.myclinics

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.automirrored.filled.Login
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Science
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.MyClinicsRepository
import kz.dentvision.crm.data.WorkspaceRepository
import kz.dentvision.crm.data.model.WorkspaceContext
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme

data class MyClinicsUiState(
    val clinics: UiState<List<WorkspaceContext>> = UiState.Loading,
    val enteringId: String? = null,
    val creating: Boolean = false,
    val joining: Boolean = false,
    val demoLoading: Boolean = false,
    val error: String? = null,
)

class MyClinicsViewModel(
    private val repository: MyClinicsRepository = MyClinicsRepository(),
    private val workspaceRepository: WorkspaceRepository = WorkspaceRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(MyClinicsUiState())
    val state: StateFlow<MyClinicsUiState> = _state

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(clinics = UiState.Loading) }
        viewModelScope.launch {
            runCatching { workspaceRepository.contexts() }
                .onSuccess { list ->
                    _state.update { it.copy(clinics = UiState.Data(list.filter { ws -> ws.scopeType == "CLINIC" })) }
                }
                .onFailure { e -> _state.update { s -> s.copy(clinics = UiState.Error(e.message ?: "Не удалось загрузить клиники")) } }
        }
    }

    fun enter(context: WorkspaceContext, onDone: () -> Unit) {
        _state.update { it.copy(enteringId = context.id) }
        viewModelScope.launch {
            runCatching { workspaceRepository.switchTo(context) }
                .onSuccess { onDone() }
                .onFailure { e -> _state.update { it.copy(error = e.message ?: "Не удалось войти") } }
            _state.update { it.copy(enteringId = null) }
        }
    }

    fun createClinic(name: String, city: String, address: String, phone: String, onDone: () -> Unit) {
        if (name.isBlank()) {
            _state.update { it.copy(error = "Введите название клиники") }
            return
        }
        _state.update { it.copy(creating = true) }
        viewModelScope.launch {
            runCatching {
                repository.createClinic(name.trim(), city.trim().ifBlank { null }, address.trim().ifBlank { null }, phone.trim().ifBlank { null })
            }
                .onSuccess { onDone() }
                .onFailure { e -> _state.update { it.copy(error = e.message ?: "Не удалось создать клинику") } }
            _state.update { it.copy(creating = false) }
        }
    }

    fun joinByCode(code: String, onDone: () -> Unit) {
        if (code.isBlank()) {
            _state.update { it.copy(error = "Введите код приглашения") }
            return
        }
        _state.update { it.copy(joining = true) }
        viewModelScope.launch {
            runCatching { repository.joinByCode(code.trim()) }
                .onSuccess { onDone() }
                .onFailure { e -> _state.update { it.copy(error = e.message ?: "Приглашение не найдено") } }
            _state.update { it.copy(joining = false) }
        }
    }

    fun createDemo(onDone: () -> Unit) {
        _state.update { it.copy(demoLoading = true) }
        viewModelScope.launch {
            runCatching { repository.createDemoClinic() }
                .onSuccess { onDone() }
                .onFailure { e -> _state.update { it.copy(error = e.message ?: "Не удалось создать демо-клинику") } }
            _state.update { it.copy(demoLoading = false) }
        }
    }

    fun consumeError() = _state.update { it.copy(error = null) }
}

/**
 * Мои клиники — перенос `MyClinics.tsx`. Раньше единственным способом
 * получить клинику на Android было уже её иметь: ни создать, ни
 * присоединиться по коду было нельзя, и вошедший без единой клиники упирался
 * в пустой кабинет без единого выхода.
 */
@Composable
fun MyClinicsScreen(onEntered: () -> Unit, viewModel: MyClinicsViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var showCreate by remember { mutableStateOf(false) }
    var showJoin by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        when (val clinics = state.clinics) {
            is UiState.Loading -> LoadingSkeleton(rows = 2)
            is UiState.Error -> ErrorState(message = clinics.message, onRetry = viewModel::load)
            is UiState.Data -> if (clinics.value.isNotEmpty()) {
                Column {
                    Text("Ваши клиники", style = MaterialTheme.typography.labelLarge, color = DvTheme.colors.textMuted, modifier = Modifier.padding(bottom = 8.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        clinics.value.forEach { ws ->
                            ClinicRow(workspace = ws, busy = state.enteringId == ws.id, onClick = { viewModel.enter(ws, onEntered) })
                        }
                    }
                }
            }
        }

        state.error?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.error)
        }

        Column {
            Text("Действия", style = MaterialTheme.typography.labelLarge, color = DvTheme.colors.textMuted, modifier = Modifier.padding(bottom = 8.dp))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ActionRow(
                    icon = Icons.Filled.Add,
                    title = "Создать клинику",
                    desc = "Для владельцев бизнеса",
                    onClick = { showCreate = true },
                )
                ActionRow(
                    icon = Icons.AutoMirrored.Filled.Login,
                    title = "Присоединиться",
                    desc = "По коду приглашения",
                    onClick = { showJoin = true },
                )
                ActionRow(
                    icon = Icons.Filled.Science,
                    title = "Попробовать демо",
                    desc = "Клиника с готовыми данными, временный доступ",
                    loading = state.demoLoading,
                    onClick = { viewModel.createDemo(onEntered) },
                )
            }
        }
    }

    if (showCreate) {
        CreateClinicSheet(
            saving = state.creating,
            onDismiss = { showCreate = false },
            onSave = { name, city, address, phone ->
                viewModel.createClinic(name, city, address, phone) { showCreate = false; onEntered() }
            },
        )
    }
    if (showJoin) {
        JoinClinicSheet(
            saving = state.joining,
            onDismiss = { showJoin = false },
            onSave = { code -> viewModel.joinByCode(code) { showJoin = false; onEntered() } },
        )
    }
}

@Composable
private fun ClinicRow(workspace: WorkspaceContext, busy: Boolean, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(enabled = !busy, onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(36.dp).clip(CircleShape).background(DvTheme.colors.gold.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.Business, contentDescription = null, tint = DvTheme.colors.gold, modifier = Modifier.size(18.dp))
            }
            Column(modifier = Modifier.padding(start = 12.dp).weight(1f)) {
                Text(workspace.name, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                if (workspace.roleLabel.isNotBlank()) {
                    Text(workspace.roleLabel, style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
                }
            }
            when {
                busy -> CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = DvTheme.colors.gold)
                else -> Icon(Icons.Filled.ChevronRight, contentDescription = null, tint = DvTheme.colors.textGhost, modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
private fun ActionRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    desc: String,
    loading: Boolean = false,
    onClick: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(enabled = !loading, onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).background(DvTheme.colors.gold.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = null, tint = DvTheme.colors.gold, modifier = Modifier.size(18.dp))
            }
            Column(modifier = Modifier.padding(start = 12.dp).weight(1f)) {
                Text(title, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                Text(desc, style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
            }
            if (loading) {
                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = DvTheme.colors.gold)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreateClinicSheet(
    saving: Boolean,
    onDismiss: () -> Unit,
    onSave: (name: String, city: String, address: String, phone: String) -> Unit,
) {
    var name by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = DvTheme.colors.surface1) {
        Column(modifier = Modifier.padding(horizontal = 20.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Создание клиники", style = MaterialTheme.typography.titleLarge, color = DvTheme.colors.textPrimary)
            OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Название клиники *") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = city, onValueChange = { city = it }, label = { Text("Город") }, singleLine = true, modifier = Modifier.weight(1f))
                OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Телефон") }, singleLine = true, modifier = Modifier.weight(1f))
            }
            OutlinedTextField(value = address, onValueChange = { address = it }, label = { Text("Адрес") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 6.dp)) {
                DvPrimaryButton(onClick = { onSave(name, city, address, phone) }, enabled = !saving && name.isNotBlank(), modifier = Modifier.weight(1f)) {
                    if (saving) {
                        CircularProgressIndicator(strokeWidth = 2.dp, color = DvTheme.colors.goldOn, modifier = Modifier.size(18.dp))
                    } else {
                        Text("Создать клинику")
                    }
                }
                TextButton(onClick = onDismiss) { Text("Отмена") }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun JoinClinicSheet(
    saving: Boolean,
    onDismiss: () -> Unit,
    onSave: (code: String) -> Unit,
) {
    var code by remember { mutableStateOf("") }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = DvTheme.colors.surface1) {
        Column(modifier = Modifier.padding(horizontal = 20.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Присоединиться к клинике", style = MaterialTheme.typography.titleLarge, color = DvTheme.colors.textPrimary)
            OutlinedTextField(
                value = code,
                onValueChange = { code = it },
                label = { Text("Код приглашения") },
                placeholder = { Text("ABCD-1234") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 6.dp)) {
                DvPrimaryButton(onClick = { onSave(code) }, enabled = !saving && code.isNotBlank(), modifier = Modifier.weight(1f)) {
                    if (saving) {
                        CircularProgressIndicator(strokeWidth = 2.dp, color = DvTheme.colors.goldOn, modifier = Modifier.size(18.dp))
                    } else {
                        Text("Присоединиться")
                    }
                }
                TextButton(onClick = onDismiss) { Text("Отмена") }
            }
        }
    }
}
