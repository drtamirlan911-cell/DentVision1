package kz.dentvision.crm.ui.notifications

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
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
import kz.dentvision.crm.data.NotificationsRepository
import kz.dentvision.crm.data.model.AppNotification
import kz.dentvision.crm.data.session.NotificationBadge
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

data class NotificationsUiState(
    val list: UiState<List<AppNotification>> = UiState.Loading,
    val markingAll: Boolean = false,
)

class NotificationsViewModel(
    private val repository: NotificationsRepository = NotificationsRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(NotificationsUiState())
    val state: StateFlow<NotificationsUiState> = _state

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(list = UiState.Loading) }
        viewModelScope.launch {
            runCatching { repository.list() }
                .onSuccess { list ->
                    _state.update { it.copy(list = UiState.Data(list)) }
                    NotificationBadge.set(list.count { n -> !n.read })
                }
                .onFailure { _state.update { s -> s.copy(list = UiState.Error(it.message ?: "Не удалось загрузить уведомления")) } }
        }
    }

    fun markRead(notification: AppNotification) {
        if (notification.read) return
        val current = (_state.value.list as? UiState.Data)?.value ?: return
        _state.update { it.copy(list = UiState.Data(current.map { n -> if (n.id == notification.id) n.copy(read = true) else n })) }
        NotificationBadge.set((NotificationBadge.count.value - 1).coerceAtLeast(0))
        viewModelScope.launch {
            runCatching { repository.markRead(notification.id) }
        }
    }

    fun markAllRead() {
        _state.update { it.copy(markingAll = true) }
        viewModelScope.launch {
            runCatching { repository.markAllRead() }
                .onSuccess {
                    val current = (_state.value.list as? UiState.Data)?.value.orEmpty()
                    _state.update { it.copy(list = UiState.Data(current.map { n -> n.copy(read = true) }), markingAll = false) }
                    NotificationBadge.set(0)
                }
                .onFailure { _state.update { s -> s.copy(markingAll = false) } }
        }
    }
}

/**
 * Лента уведомлений — колокольчик из шапки веба. Не привязана к клинике:
 * `notifications.routes.ts` фильтрует только по пользователю, поэтому
 * список один и тот же под любым рабочим пространством.
 *
 * Push (FCM) здесь нет — как и у веба: тот тоже только опрашивает
 * `/api/notifications`, отдельного канала доставки в реальном времени в
 * системе не существует ни на одной поверхности.
 */
@Composable
fun NotificationsScreen(
    onOpenPreferences: () -> Unit,
    viewModel: NotificationsViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.End,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = viewModel::markAllRead, enabled = !state.markingAll) {
                Icon(Icons.Filled.DoneAll, contentDescription = "Прочитать всё", tint = DvTheme.colors.textSecondary)
            }
            IconButton(onClick = onOpenPreferences) {
                Icon(Icons.Filled.Settings, contentDescription = "Настройки уведомлений", tint = DvTheme.colors.textSecondary)
            }
        }

        when (val list = state.list) {
            is UiState.Loading -> LoadingSkeleton()
            is UiState.Error -> ErrorState(message = list.message, onRetry = viewModel::load)
            is UiState.Data -> if (list.value.isEmpty()) {
                EmptyStateView(title = "Уведомлений нет")
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(list.value, key = { it.id }) { notification ->
                        NotificationRow(notification = notification, onClick = { viewModel.markRead(notification) })
                    }
                }
            }
        }
    }
}

@Composable
private fun NotificationRow(notification: AppNotification, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (notification.read) DvTheme.colors.surface1 else DvTheme.colors.surface2,
        ),
        border = BorderStroke(1.dp, if (notification.read) DvTheme.colors.borderSubtle else DvTheme.colors.gold.copy(alpha = 0.3f)),
    ) {
        Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.Top) {
            if (!notification.read) {
                androidx.compose.foundation.layout.Box(
                    modifier = Modifier
                        .padding(top = 6.dp, end = 10.dp)
                        .size(8.dp)
                        .background(DvTheme.colors.gold, CircleShape),
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = notification.title,
                    style = MaterialTheme.typography.titleSmall,
                    color = DvTheme.colors.textPrimary,
                )
                if (notification.message.isNotBlank()) {
                    Text(
                        text = notification.message,
                        style = MaterialTheme.typography.bodyMedium,
                        color = DvTheme.colors.textSecondary,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                if (notification.createdAt.isNotBlank()) {
                    Text(
                        text = notification.createdAt.replace('T', ' ').take(16),
                        style = MaterialTheme.typography.labelSmall,
                        color = DvTheme.colors.textMuted,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
        }
    }
}
