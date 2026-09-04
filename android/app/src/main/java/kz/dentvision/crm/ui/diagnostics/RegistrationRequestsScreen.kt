package kz.dentvision.crm.ui.diagnostics

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.DiagnosticsRepository
import kz.dentvision.crm.data.model.RegistrationRequest
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvOutlineButton
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme

private val STATUS_LABELS = mapOf(
    "" to "Все",
    "PENDING" to "Ожидает",
    "APPROVED" to "Подтверждён",
    "REJECTED" to "Отклонён",
)

data class RegistrationRequestsUiState(
    val loaded: UiState<List<RegistrationRequest>> = UiState.Loading,
    val statusFilter: String = "PENDING",
    val busyId: String? = null,
)

/**
 * Перенос `RegistrationRequests.tsx` — заявки на регистрацию центров и
 * лабораторий, доступно только SUPERADMIN (`GET/POST /api/diagnostics/
 * registrations*`, `requireSuperadmin` на сервере). Клиент не проверяет
 * роль отдельно — как и веб, полагается на 403 сервера, тот же приём, что
 * уже принят для `ClinicSettingsViewModel`.
 */
class RegistrationRequestsViewModel(
    private val repository: DiagnosticsRepository = DiagnosticsRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(RegistrationRequestsUiState())
    val state: StateFlow<RegistrationRequestsUiState> = _state

    init {
        load()
    }

    fun setStatusFilter(status: String) {
        _state.value = _state.value.copy(statusFilter = status)
        load()
    }

    fun load() {
        _state.value = _state.value.copy(loaded = UiState.Loading)
        val status = _state.value.statusFilter
        viewModelScope.launch {
            runCatching { repository.registrations(status.ifBlank { null }) }
                .onSuccess { _state.value = _state.value.copy(loaded = UiState.Data(it)) }
                .onFailure { _state.value = _state.value.copy(loaded = UiState.Error(it.message ?: "Не удалось получить заявки")) }
        }
    }

    fun approve(id: String) {
        _state.value = _state.value.copy(busyId = id)
        viewModelScope.launch {
            runCatching { repository.approveRegistration(id) }
                .onSuccess { load() }
                .onFailure { _state.value = _state.value.copy(busyId = null) }
        }
    }

    fun reject(id: String, reason: String) {
        _state.value = _state.value.copy(busyId = id)
        viewModelScope.launch {
            runCatching { repository.rejectRegistration(id, reason.ifBlank { null }) }
                .onSuccess { load() }
                .onFailure { _state.value = _state.value.copy(busyId = null) }
        }
    }
}

@Composable
fun RegistrationRequestsScreen(viewModel: RegistrationRequestsViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var rejectTarget by remember { mutableStateOf<RegistrationRequest?>(null) }

    Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            STATUS_LABELS.forEach { (value, label) ->
                FilterChip(
                    selected = state.statusFilter == value,
                    onClick = { viewModel.setStatusFilter(value) },
                    label = { Text(label, style = MaterialTheme.typography.labelSmall) },
                )
            }
        }

        when (val loaded = state.loaded) {
            is UiState.Loading -> LoadingSkeleton()
            is UiState.Error -> ErrorState(message = loaded.message, onRetry = viewModel::load)
            is UiState.Data -> if (loaded.value.isEmpty()) {
                EmptyStateView(title = "Нет заявок")
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(loaded.value, key = { it.id }) { request ->
                        RegistrationRequestRow(
                            request = request,
                            busy = state.busyId == request.id,
                            onApprove = { viewModel.approve(request.id) },
                            onReject = { rejectTarget = request },
                        )
                    }
                }
            }
        }
    }

    rejectTarget?.let { target ->
        RejectDialog(
            name = target.name,
            onDismiss = { rejectTarget = null },
            onConfirm = { reason ->
                viewModel.reject(target.id, reason)
                rejectTarget = null
            },
        )
    }
}

@Composable
private fun RegistrationRequestRow(
    request: RegistrationRequest,
    busy: Boolean,
    onApprove: () -> Unit,
    onReject: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = if (request.type == "center") "Центр" else "Лаборатория",
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.gold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(DvTheme.colors.gold.copy(alpha = 0.1f))
                        .padding(horizontal = 8.dp, vertical = 3.dp),
                )
                Text(text = request.name, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
            }

            val sub = listOfNotNull(
                listOfNotNull(request.city, request.address).joinToString(", ").takeIf { it.isNotBlank() },
                request.phone?.takeIf { it.isNotBlank() },
            ).joinToString(" · ")
            if (sub.isNotBlank()) {
                Text(text = sub, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
            }
            request.comment?.takeIf { it.isNotBlank() }?.let {
                Text(
                    text = "«$it»",
                    style = MaterialTheme.typography.bodySmall.copy(fontStyle = FontStyle.Italic),
                    color = DvTheme.colors.textMuted,
                )
            }
            request.reviewNote?.takeIf { it.isNotBlank() }?.let {
                Text(text = "Причина: $it", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.error)
            }

            if (request.status == "PENDING") {
                Row(modifier = Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    DvPrimaryButton(onClick = onApprove, enabled = !busy) { Text("Подтвердить") }
                    DvOutlineButton(onClick = onReject, enabled = !busy) { Text("Отклонить") }
                }
            } else {
                StatusChip(request.status)
            }
        }
    }
}

@Composable
private fun RejectDialog(name: String, onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var reason by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Отклонить заявку") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(name, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textMuted)
                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    label = { Text("Причина отклонения") },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = { TextButton(onClick = { onConfirm(reason) }) { Text("Отклонить") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}
