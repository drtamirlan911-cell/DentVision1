package kz.dentvision.crm.ui.diagnostics

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
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
import kz.dentvision.crm.data.WorkspaceRepository
import kz.dentvision.crm.data.api.ApiException
import kz.dentvision.crm.data.model.OrganizationInvitation
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.ui.theme.DvOutlineButton
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme

/** Перенос словаря `ROLES`/`ROLE_LABELS` (`TeamTab.tsx:26-33`) — `owner` намеренно не приглашается. */
private val DIAG_ROLES = listOf(
    "operator" to "Оператор",
    "radiologist" to "Рентгенолог",
    "manager" to "Менеджер",
    "admin" to "Администратор",
)
private val DIAG_ROLE_LABELS = DIAG_ROLES.toMap()

data class TeamState(
    val loading: Boolean = true,
    val forbidden: Boolean = false,
    val error: String? = null,
    val invitations: List<OrganizationInvitation> = emptyList(),
    val role: String = DIAG_ROLES.first().first,
    val email: String = "",
    val creating: Boolean = false,
    val createError: String? = null,
)

/**
 * Перенос `TeamTab.tsx` — коды приглашений организации. `GET
 * /api/iam/invitations` отвечает 403 всем ниже владельца/администратора —
 * это честный ответ «нельзя управлять командой», а не ошибка загрузки,
 * поэтому показывается отдельным текстом, как на вебе, а не как [ErrorState].
 */
class TeamViewModel(
    private val repository: WorkspaceRepository = WorkspaceRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(TeamState())
    val state: StateFlow<TeamState> = _state

    private var orgId: String = ""
    private var startedFor: String? = null

    fun start(orgId: String) {
        if (startedFor == orgId) return
        startedFor = orgId
        this.orgId = orgId
        load()
    }

    fun load() {
        _state.update { it.copy(loading = true, forbidden = false, error = null) }
        viewModelScope.launch {
            runCatching { repository.invitations(orgId) }
                .onSuccess { list -> _state.update { it.copy(loading = false, invitations = list) } }
                .onFailure { e ->
                    if (e is ApiException && e.status == 403) {
                        _state.update { it.copy(loading = false, forbidden = true) }
                    } else {
                        _state.update { it.copy(loading = false, error = e.message ?: "Не удалось получить приглашения") }
                    }
                }
        }
    }

    fun setRole(role: String) {
        _state.update { it.copy(role = role) }
    }

    fun setEmail(email: String) {
        _state.update { it.copy(email = email) }
    }

    fun createInvitation() {
        _state.update { it.copy(creating = true, createError = null) }
        viewModelScope.launch {
            runCatching { repository.createInvitation(orgId, _state.value.role, _state.value.email.trim()) }
                .onSuccess {
                    _state.update { it.copy(creating = false, email = "") }
                    load()
                }
                .onFailure { e -> _state.update { it.copy(creating = false, createError = e.message ?: "Не удалось создать код") } }
        }
    }
}

@Composable
fun TeamScreen(session: Session, viewModel: TeamViewModel = viewModel()) {
    val orgId = session.user.organizationId

    if (orgId == null) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Text(
                text = "Не удалось определить организацию текущего рабочего пространства.",
                style = MaterialTheme.typography.bodyMedium,
                color = DvTheme.colors.textMuted,
            )
        }
        return
    }

    LaunchedEffect(orgId) { viewModel.start(orgId) }
    val state by viewModel.state.collectAsStateWithLifecycle()

    TeamContent(state = state, viewModel = viewModel)
}

@Composable
private fun TeamContent(state: TeamState, viewModel: TeamViewModel) {
    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(text = "Сотрудники", style = MaterialTheme.typography.titleLarge, color = DvTheme.colors.textPrimary)

        if (state.forbidden) {
            Text(
                text = "Приглашать сотрудников может владелец или администратор организации.",
                style = MaterialTheme.typography.bodyMedium,
                color = DvTheme.colors.textMuted,
            )
            return@Column
        }

        state.error?.let {
            Text(text = it, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.error)
        }

        InviteCard(state = state, viewModel = viewModel)

        Text(text = "Активные приглашения", style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary)

        if (state.loading) {
            CircularProgressIndicator(color = DvTheme.colors.gold, modifier = Modifier.padding(8.dp))
        } else if (state.invitations.isEmpty()) {
            Text(text = "Пока нет неиспользованных кодов", style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textMuted)
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(state.invitations, key = { it.id }) { inv -> InvitationRow(inv) }
            }
        }
    }
}

@Composable
private fun InviteCard(state: TeamState, viewModel: TeamViewModel) {
    Card(
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(text = "Пригласить сотрудника", style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary)
            Text(
                text = "Код действует 7 дней и срабатывает один раз. Если указать почту, кодом сможет воспользоваться только её владелец.",
                style = MaterialTheme.typography.bodySmall,
                color = DvTheme.colors.textMuted,
            )

            Text(text = "Роль", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textGhost)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                DIAG_ROLES.forEach { (value, label) ->
                    FilterChip(
                        selected = state.role == value,
                        onClick = { viewModel.setRole(value) },
                        label = { Text(label, style = MaterialTheme.typography.labelSmall) },
                    )
                }
            }

            OutlinedTextField(
                value = state.email,
                onValueChange = viewModel::setEmail,
                label = { Text("Email (необязательно)") },
                placeholder = { Text("radiolog@example.kz") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            state.createError?.let { Text(text = it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.error) }

            DvPrimaryButton(onClick = viewModel::createInvitation, enabled = !state.creating, modifier = Modifier.fillMaxWidth()) {
                if (state.creating) {
                    CircularProgressIndicator(strokeWidth = 2.dp, color = DvTheme.colors.goldOn, modifier = Modifier.padding(2.dp))
                } else {
                    Text("Создать код")
                }
            }
        }
    }
}

@Composable
private fun InvitationRow(inv: OrganizationInvitation) {
    val clipboard = LocalClipboardManager.current

    Card(
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(text = inv.code, style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary)
                Text(
                    text = DIAG_ROLE_LABELS[inv.role] ?: inv.role,
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.gold,
                )
            }
            inv.email?.let { Text(text = it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted) }
            inv.expiresAt?.let {
                Text(text = "до ${it.take(10)}", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
            }
            DvOutlineButton(onClick = { clipboard.setText(AnnotatedString(inv.code)) }, modifier = Modifier.fillMaxWidth()) {
                Text("Копировать")
            }
        }
    }
}
