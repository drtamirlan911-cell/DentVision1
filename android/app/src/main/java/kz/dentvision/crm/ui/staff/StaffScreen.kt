package kz.dentvision.crm.ui.staff

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
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
import kz.dentvision.crm.data.model.ClinicInvitation
import kz.dentvision.crm.data.model.ClinicMember
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme
import kz.dentvision.crm.lib.formatDate
import kz.dentvision.crm.lib.formatPhone

/** Перенос `ROLE_DESC` (`Staff.tsx:91-96`) — те же четыре роли, что доступны приглашению на вебе. */
private val INVITE_ROLES = listOf(
    "director" to "Директор",
    "admin" to "Администратор",
    "doctor" to "Врач",
    "assistant" to "Ассистент",
)

/** Роли состава клиники по-русски. Значения — из `normalizeStaffRole` на бэкенде. */
private val ROLE_LABELS = mapOf(
    "owner" to "Владелец",
    "director" to "Директор",
    "admin" to "Администратор",
    "manager" to "Менеджер",
    "doctor" to "Врач",
    "assistant" to "Ассистент",
    "cashier" to "Кассир",
    "lab" to "Лаборант",
)

data class InviteUiState(
    val open: Boolean = false,
    val role: String = INVITE_ROLES.first().first,
    val email: String = "",
    val expiresInDays: Int = 7,
    val saving: Boolean = false,
    val error: String? = null,
    val result: ClinicInvitation? = null,
)

class StaffViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<List<ClinicMember>>>(UiState.Loading)
    val state: StateFlow<UiState<List<ClinicMember>>> = _state

    private val _invite = MutableStateFlow(InviteUiState())
    val invite: StateFlow<InviteUiState> = _invite

    private var clinicId: String? = null

    fun start(clinicId: String?) {
        if (this.clinicId == clinicId && _state.value !is UiState.Loading) return
        this.clinicId = clinicId
        load()
    }

    fun load() {
        val clinic = clinicId
        if (clinic == null) {
            _state.value = UiState.Error("Клиника не выбрана")
            return
        }
        _state.value = UiState.Loading
        viewModelScope.launch {
            runCatching { repository.members(clinic) }
                .onSuccess { _state.value = UiState.Data(it.filter { m -> m.user != null }) }
                .onFailure { _state.value = UiState.Error(it.message ?: "Не удалось загрузить состав") }
        }
    }

    fun openInvite() {
        _invite.value = InviteUiState()
        _invite.update { it.copy(open = true) }
    }

    fun dismissInvite() {
        _invite.update { it.copy(open = false) }
    }

    fun setInviteRole(role: String) {
        _invite.update { it.copy(role = role) }
    }

    fun setInviteEmail(email: String) {
        _invite.update { it.copy(email = email) }
    }

    fun setInviteExpiresInDays(days: Int) {
        _invite.update { it.copy(expiresInDays = days) }
    }

    fun createInvitation() {
        val clinic = clinicId ?: return
        _invite.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            val form = _invite.value
            runCatching {
                repository.createInvitation(clinic, form.email.trim().ifBlank { null }, form.role, form.expiresInDays)
            }
                .onSuccess { inv -> _invite.update { it.copy(saving = false, result = inv) } }
                .onFailure { e -> _invite.update { it.copy(saving = false, error = e.message ?: "Не удалось создать код") } }
        }
    }
}

/**
 * Сотрудники клиники.
 *
 * Список — только чтение: заведение сотрудника требует пароля и проходит
 * через политику паролей на сервере, а зарплаты и проценты видны лишь по
 * отдельному праву. Показывать это на телефоне вполсилы — хуже, чем не
 * показывать вовсе. Приглашение по коду — тот же лёгкий путь, что и на
 * вебе (`Staff.tsx`): владелец/администратор создаёт код, приглашённый сам
 * заводит себе аккаунт и присоединяется через «Мои клиники».
 */
@Composable
fun StaffScreen(
    clinicId: String?,
    canInvite: Boolean = false,
    viewModel: StaffViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val invite by viewModel.invite.collectAsStateWithLifecycle()
    LaunchedEffect(clinicId) { viewModel.start(clinicId) }

    Column(modifier = Modifier.fillMaxSize()) {
        if (canInvite) {
            Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
                DvPrimaryButton(onClick = viewModel::openInvite, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Filled.PersonAdd, contentDescription = null, modifier = Modifier.padding(end = 8.dp))
                    Text("Пригласить сотрудника")
                }
            }
        }
        when (val list = state) {
            is UiState.Loading -> LoadingSkeleton()
            is UiState.Error -> ErrorState(message = list.message, onRetry = viewModel::load)
            is UiState.Data -> if (list.value.isEmpty()) {
                EmptyStateView(title = "В клинике пока никого нет")
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(list.value, key = { it.user!!.id }) { member ->
                        val user = member.user!!
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
                            border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Text(
                                    text = listOfNotNull(user.firstName, user.lastName)
                                        .joinToString(" ")
                                        .trim()
                                        .ifBlank { "Без имени" },
                                    style = MaterialTheme.typography.titleMedium,
                                    color = DvTheme.colors.textPrimary,
                                )
                                val sub = listOfNotNull(
                                    ROLE_LABELS[member.role.lowercase()] ?: member.role,
                                    user.spec?.takeIf { it.isNotBlank() },
                                    formatPhone(user.phone?.takeIf { it.isNotBlank() }),
                                ).joinToString(" · ")
                                Text(
                                    text = sub,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = DvTheme.colors.textMuted,
                                    modifier = Modifier.padding(top = 4.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (invite.open) {
        InviteSheet(state = invite, viewModel = viewModel)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InviteSheet(state: InviteUiState, viewModel: StaffViewModel) {
    val clipboard = LocalClipboardManager.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(onDismissRequest = viewModel::dismissInvite, sheetState = sheetState, containerColor = DvTheme.colors.surface1) {
        val result = state.result
        if (result != null) {
            Column(modifier = Modifier.padding(horizontal = 20.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Код приглашения готов", style = MaterialTheme.typography.titleLarge, color = DvTheme.colors.textPrimary)
                Text(
                    "Передайте его сотруднику: он введёт код на экране «Мои клиники» → «Присоединиться».",
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.textMuted,
                )
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface2),
                    border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(result.code, style = MaterialTheme.typography.headlineSmall, color = DvTheme.colors.gold)
                        result.email?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted) }
                        result.expiresAt?.let { Text("до ${formatDate(it)}", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted) }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    DvPrimaryButton(onClick = { clipboard.setText(AnnotatedString(result.code)) }, modifier = Modifier.weight(1f)) {
                        Text("Копировать")
                    }
                    TextButton(onClick = viewModel::dismissInvite) { Text("Готово") }
                }
            }
        } else {
            Column(modifier = Modifier.padding(horizontal = 20.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Пригласить сотрудника", style = MaterialTheme.typography.titleLarge, color = DvTheme.colors.textPrimary)
                Text(
                    "Код действует 7 дней и срабатывает один раз. Если указать почту, кодом сможет воспользоваться только её владелец.",
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.textMuted,
                )
                Text("Роль", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textGhost)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    INVITE_ROLES.forEach { (value, label) ->
                        FilterChip(
                            selected = state.role == value,
                            onClick = { viewModel.setInviteRole(value) },
                            label = { Text(label, style = MaterialTheme.typography.labelSmall) },
                        )
                    }
                }
                OutlinedTextField(
                    value = state.email,
                    onValueChange = viewModel::setInviteEmail,
                    label = { Text("Email (необязательно)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                state.error?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.error) }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 6.dp)) {
                    DvPrimaryButton(onClick = viewModel::createInvitation, enabled = !state.saving, modifier = Modifier.weight(1f)) {
                        if (state.saving) {
                            CircularProgressIndicator(strokeWidth = 2.dp, color = DvTheme.colors.goldOn, modifier = Modifier.size(18.dp))
                        } else {
                            Text("Создать код")
                        }
                    }
                    TextButton(onClick = viewModel::dismissInvite) { Text("Отмена") }
                }
            }
        }
    }
}
