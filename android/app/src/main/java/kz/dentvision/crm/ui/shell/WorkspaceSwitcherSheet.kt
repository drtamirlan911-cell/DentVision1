package kz.dentvision.crm.ui.shell

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.Store
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
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
import kz.dentvision.crm.data.model.WorkspaceContext
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

data class WorkspaceSwitcherUiState(
    val items: UiState<List<WorkspaceContext>> = UiState.Loading,
    val busyId: String? = null,
    val message: String? = null,
    val switchedTo: WorkspaceContext? = null,
)

/**
 * Список рабочих пространств и переключение. Перенос `pick()` из
 * `WorkspaceSwitcher.tsx`; сама пересборка сессии (токены + `/me`) целиком
 * лежит в `WorkspaceRepository.switchTo`, здесь только состояние экрана.
 */
class WorkspaceSwitcherViewModel(
    private val repository: WorkspaceRepository = WorkspaceRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(WorkspaceSwitcherUiState())
    val state: StateFlow<WorkspaceSwitcherUiState> = _state

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(items = UiState.Loading) }
        viewModelScope.launch {
            runCatching { repository.contexts() }
                .onSuccess { list -> _state.update { it.copy(items = UiState.Data(list)) } }
                .onFailure { e ->
                    _state.update { it.copy(items = UiState.Error(e.message ?: "Не удалось получить список рабочих пространств")) }
                }
        }
    }

    fun switchTo(context: WorkspaceContext) {
        if (_state.value.busyId != null) return
        _state.update { it.copy(busyId = context.id) }
        viewModelScope.launch {
            runCatching { repository.switchTo(context) }
                .onSuccess { _state.update { it.copy(busyId = null, switchedTo = context) } }
                .onFailure { e ->
                    _state.update { it.copy(busyId = null, message = e.message ?: "Не удалось переключить рабочее пространство") }
                }
        }
    }

    fun consumeMessage() {
        _state.update { it.copy(message = null) }
    }

    fun consumeSwitch() {
        _state.update { it.copy(switchedTo = null) }
    }
}

/** Разделы в том же порядке, что `GROUPS` в `WorkspaceSwitcher.tsx`. */
private data class WorkspaceGroup(val label: String, val types: Set<String>)

private val GROUPS = listOf(
    WorkspaceGroup("Клиники", setOf("CLINIC")),
    WorkspaceGroup("Диагностика", setOf("DIAGNOSTIC_CENTER", "LABORATORY")),
    WorkspaceGroup("Поставщики", setOf("SUPPLIER")),
    WorkspaceGroup("Академия", setOf("LECTURER", "ACADEMY")),
    WorkspaceGroup("Партнёры", setOf("PARTNER")),
)

private fun iconFor(scopeType: String): ImageVector = when (scopeType) {
    "CLINIC" -> Icons.Filled.Business
    "DIAGNOSTIC_CENTER", "LABORATORY" -> Icons.Filled.Science
    "SUPPLIER" -> Icons.Filled.Store
    "LECTURER", "ACADEMY" -> Icons.Filled.School
    else -> Icons.Filled.Business
}

/**
 * То же самое, что решает `isActive()` в `WorkspaceSwitcher.tsx`: вне клиники
 * токен несёт организацию (её тип не `CLINIC`), внутри клиники — правда в
 * `clinic.id`/`activeMembership.clinicId`, потому что клиничный токен не
 * всегда называет организацию явно.
 */
private fun isActive(ws: WorkspaceContext, session: Session): Boolean {
    val orgType = session.user.organizationType
    if (orgType != null && orgType != "CLINIC") {
        val orgId = session.user.organizationId
        return ws.organizationId == orgId || ws.scopeId == orgId
    }
    val clinicId = session.clinic?.id ?: session.activeMembership?.clinicId
    return ws.scopeType == "CLINIC" && ws.scopeId == clinicId
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WorkspaceSwitcherSheet(
    session: Session,
    onDismiss: () -> Unit,
    onSwitched: (WorkspaceContext) -> Unit,
    viewModel: WorkspaceSwitcherViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    LaunchedEffect(state.switchedTo) {
        val context = state.switchedTo ?: return@LaunchedEffect
        onSwitched(context)
        viewModel.consumeSwitch()
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DvTheme.colors.surface1,
    ) {
        Column(modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 16.dp)) {
            Text(
                text = "Рабочее пространство",
                style = MaterialTheme.typography.titleMedium,
                color = DvTheme.colors.textPrimary,
                modifier = Modifier.padding(bottom = 8.dp),
            )
            state.message?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.error,
                    modifier = Modifier.padding(bottom = 8.dp),
                )
            }

            when (val items = state.items) {
                is UiState.Loading -> LoadingSkeleton(rows = 3)
                is UiState.Error -> ErrorState(message = items.message, onRetry = viewModel::load)
                is UiState.Data -> {
                    val grouped = GROUPS.map { g -> g to items.value.filter { it.scopeType in g.types } }
                        .filter { (_, list) -> list.isNotEmpty() }
                    LazyColumn(
                        modifier = Modifier.heightIn(max = 420.dp),
                        contentPadding = PaddingValues(vertical = 8.dp),
                    ) {
                        grouped.forEach { (group, list) ->
                            if (grouped.size > 1) {
                                item {
                                    Text(
                                        text = group.label,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = DvTheme.colors.textGhost,
                                        modifier = Modifier.padding(top = 10.dp, bottom = 4.dp),
                                    )
                                }
                            }
                            items(list, key = { it.id }) { ws ->
                                WorkspaceRow(
                                    workspace = ws,
                                    active = isActive(ws, session),
                                    busy = state.busyId == ws.id,
                                    onClick = { viewModel.switchTo(ws) },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun WorkspaceRow(
    workspace: WorkspaceContext,
    active: Boolean,
    busy: Boolean,
    onClick: () -> Unit,
) {
    val colors = DvTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = !busy, onClick = onClick)
            .background(if (active) colors.gold.copy(alpha = 0.1f) else androidx.compose.ui.graphics.Color.Transparent)
            .padding(horizontal = 8.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(28.dp)
                .clip(RoundedCornerShape(9.dp))
                .background(colors.gold.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(iconFor(workspace.scopeType), contentDescription = null, tint = colors.gold, modifier = Modifier.size(14.dp))
        }
        Column(modifier = Modifier.padding(start = 10.dp).weight(1f)) {
            Text(
                text = workspace.name,
                style = MaterialTheme.typography.bodyMedium,
                color = colors.textPrimary,
            )
            Text(
                text = workspace.roleLabel,
                style = MaterialTheme.typography.labelSmall,
                color = colors.textMuted,
            )
        }
        when {
            busy -> CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
            active -> Icon(Icons.Filled.Check, contentDescription = null, tint = colors.gold, modifier = Modifier.size(16.dp))
        }
    }
}
