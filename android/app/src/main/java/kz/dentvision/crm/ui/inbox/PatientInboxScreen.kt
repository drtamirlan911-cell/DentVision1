package kz.dentvision.crm.ui.inbox

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.PatientInboxRepository
import kz.dentvision.crm.data.model.ConversationMessage
import kz.dentvision.crm.data.model.InboxConversationSummary
import kz.dentvision.crm.data.model.InboxThread
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvOutlineButton
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme
import java.time.Instant
import java.time.temporal.ChronoUnit

private val STATUS_TABS = listOf(
    "WAITING" to "Ждут ответа",
    "LIVE" to "В работе",
    "RESOLVED" to "Закрытые",
    "ALL" to "Все",
)

data class PatientInboxState(
    val conversations: UiState<List<InboxConversationSummary>> = UiState.Loading,
    val statusFilter: String = "WAITING",
    val selectedId: String? = null,
    val thread: UiState<InboxThread>? = null,
    val draft: String = "",
    val replying: Boolean = false,
    val claiming: Boolean = false,
    val resolving: Boolean = false,
    val actionError: String? = null,
)

/**
 * Перенос `PatientInbox.tsx` — диалоги, которые ИИ-ассистент пациента
 * передал сотруднику клиники. Веб слушает SSE и по сигналу делает обычный
 * REST-рефетч; здесь того же результата достигает таймер опроса (список —
 * 5 с, открытый тред — 4 с), не заводя ради одного экрана отдельный
 * долгоживущий поток. Диалог показывается полностью, просто обновление —
 * по таймеру, а не мгновенное.
 */
class PatientInboxViewModel(
    private val repository: PatientInboxRepository = PatientInboxRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(PatientInboxState())
    val state: StateFlow<PatientInboxState> = _state

    init {
        viewModelScope.launch {
            while (isActive) {
                loadConversations()
                delay(5_000)
            }
        }
    }

    private suspend fun loadConversations() {
        val filter = _state.value.statusFilter
        runCatching { repository.conversations(if (filter == "ALL") null else filter) }
            .onSuccess { list -> _state.update { it.copy(conversations = UiState.Data(list)) } }
            .onFailure { e -> _state.update { it.copy(conversations = UiState.Error(e.message ?: "Не удалось получить диалоги")) } }
    }

    fun setStatusFilter(status: String) {
        if (status == _state.value.statusFilter) return
        _state.update { it.copy(statusFilter = status, conversations = UiState.Loading) }
        viewModelScope.launch { loadConversations() }
    }

    fun selectConversation(id: String) {
        _state.update { it.copy(selectedId = id, thread = UiState.Loading, draft = "", actionError = null) }
        viewModelScope.launch {
            while (isActive && _state.value.selectedId == id) {
                loadThread(id)
                delay(4_000)
            }
        }
    }

    private suspend fun loadThread(id: String) {
        runCatching { repository.thread(id) }
            .onSuccess { t -> if (_state.value.selectedId == id) _state.update { it.copy(thread = UiState.Data(t)) } }
            .onFailure { e -> if (_state.value.selectedId == id) _state.update { it.copy(thread = UiState.Error(e.message ?: "Не удалось получить диалог")) } }
    }

    fun back() {
        _state.update { it.copy(selectedId = null, thread = null) }
    }

    fun setDraft(value: String) {
        _state.update { it.copy(draft = value) }
    }

    fun claim() {
        val id = _state.value.selectedId ?: return
        _state.update { it.copy(claiming = true, actionError = null) }
        viewModelScope.launch {
            runCatching { repository.claim(id) }
                .onSuccess {
                    _state.update { it.copy(claiming = false) }
                    loadThread(id)
                    loadConversations()
                }
                .onFailure { e -> _state.update { it.copy(claiming = false, actionError = e.message ?: "Не удалось взять диалог в работу") } }
        }
    }

    fun reply() {
        val id = _state.value.selectedId ?: return
        val text = _state.value.draft.trim()
        if (text.isBlank() || _state.value.replying) return
        _state.update { it.copy(replying = true, actionError = null) }
        viewModelScope.launch {
            runCatching { repository.reply(id, text) }
                .onSuccess {
                    _state.update { it.copy(replying = false, draft = "") }
                    loadThread(id)
                    loadConversations()
                }
                .onFailure { e -> _state.update { it.copy(replying = false, actionError = e.message ?: "Не удалось отправить сообщение") } }
        }
    }

    fun resolve() {
        val id = _state.value.selectedId ?: return
        _state.update { it.copy(resolving = true, actionError = null) }
        viewModelScope.launch {
            runCatching { repository.resolve(id) }
                .onSuccess {
                    _state.update { it.copy(resolving = false) }
                    loadThread(id)
                    loadConversations()
                }
                .onFailure { e -> _state.update { it.copy(resolving = false, actionError = e.message ?: "Не удалось закрыть диалог") } }
        }
    }
}

@Composable
fun PatientInboxScreen(clinicId: String?, viewModel: PatientInboxViewModel = viewModel()) {
    if (clinicId == null) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Text(
                text = "Не удалось определить клинику текущего рабочего пространства.",
                style = MaterialTheme.typography.bodyMedium,
                color = DvTheme.colors.textMuted,
            )
        }
        return
    }

    val state by viewModel.state.collectAsStateWithLifecycle()

    if (state.selectedId != null) {
        ThreadPanel(state = state, viewModel = viewModel)
    } else {
        ConversationList(state = state, viewModel = viewModel)
    }
}

@Composable
private fun ConversationList(state: PatientInboxState, viewModel: PatientInboxViewModel) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(text = "Диалоги с пациентами", style = MaterialTheme.typography.titleLarge, color = DvTheme.colors.textPrimary)

        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            STATUS_TABS.forEach { (value, label) ->
                FilterChip(
                    selected = state.statusFilter == value,
                    onClick = { viewModel.setStatusFilter(value) },
                    label = { Text(label, style = MaterialTheme.typography.labelSmall) },
                )
            }
        }

        when (val c = state.conversations) {
            is UiState.Loading -> LoadingSkeleton()
            is UiState.Error -> ErrorState(message = c.message)
            is UiState.Data -> {
                if (c.value.isEmpty()) {
                    EmptyStateView(
                        title = "Пусто",
                        description = "Здесь появятся вопросы, которые ассистент передал сотруднику клиники.",
                    )
                } else {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(c.value, key = { it.id }) { conv ->
                            ConversationRow(conv, onClick = { viewModel.selectConversation(conv.id) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ConversationRow(c: InboxConversationSummary, onClick: () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick,
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(text = patientName(c), style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                StatusChip(c.status)
            }
            Text(
                text = c.escalationReason?.ifBlank { null } ?: "Вопрос пациенту ассистенту",
                style = MaterialTheme.typography.bodySmall,
                color = DvTheme.colors.textMuted,
            )
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(text = relativeTime(c.lastPatientMessageAt ?: c.createdAt), style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textGhost)
                c.assignedTo?.let { Text(text = "${it.firstName} ${it.lastName}".trim(), style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textGhost) }
            }
        }
    }
}

@Composable
private fun ThreadPanel(state: PatientInboxState, viewModel: PatientInboxViewModel) {
    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = viewModel::back) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад", tint = DvTheme.colors.textPrimary)
            }
            Text(text = "Назад к списку", style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
        }

        when (val t = state.thread) {
            null, is UiState.Loading -> LoadingSkeleton()
            is UiState.Error -> ErrorState(message = t.message)
            is UiState.Data -> ThreadContent(thread = t.value, state = state, viewModel = viewModel)
        }
    }
}

@Composable
private fun ThreadContent(thread: InboxThread, state: PatientInboxState, viewModel: PatientInboxViewModel) {
    val conversation = thread.conversation
    val closed = conversation.status == "RESOLVED"

    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Column(modifier = Modifier.padding(bottom = 8.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Text(text = patientName(conversation), style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatusChip(conversation.status)
                        conversation.patientUser.phone?.let { Text(text = it, style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted) }
                    }
                }
            }
            conversation.escalationReason?.let {
                Text(text = "Ассистент передал: $it", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textGhost, modifier = Modifier.padding(top = 4.dp))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                if (conversation.status == "WAITING") {
                    DvOutlineButton(onClick = viewModel::claim, enabled = !state.claiming) { Text("Взять в работу") }
                }
                if (!closed) {
                    DvOutlineButton(onClick = viewModel::resolve, enabled = !state.resolving) { Text("Закрыть") }
                }
            }
            state.actionError?.let { Text(text = it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.error, modifier = Modifier.padding(top = 4.dp)) }
        }

        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(thread.messages, key = { it.id }) { message -> MessageBubble(message) }
        }

        if (!closed) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = state.draft,
                    onValueChange = viewModel::setDraft,
                    placeholder = { Text("Ответить пациенту…") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = viewModel::reply, enabled = state.draft.isNotBlank() && !state.replying) {
                    if (state.replying) {
                        CircularProgressIndicator(strokeWidth = 2.dp, color = DvTheme.colors.gold, modifier = Modifier.padding(4.dp))
                    } else {
                        Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Отправить", tint = DvTheme.colors.gold)
                    }
                }
            }
        }
    }
}

@Composable
private fun MessageBubble(message: ConversationMessage) {
    val mine = message.authorType == "STAFF"
    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = if (mine) Alignment.CenterEnd else Alignment.CenterStart) {
        Card(
            colors = CardDefaults.cardColors(containerColor = if (mine) DvTheme.colors.gold.copy(alpha = 0.12f) else DvTheme.colors.surface1),
            border = if (mine) null else BorderStroke(1.dp, DvTheme.colors.borderSubtle),
        ) {
            Text(
                text = message.body,
                style = MaterialTheme.typography.bodyMedium,
                color = DvTheme.colors.textPrimary,
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
            )
        }
    }
}

@Composable
private fun StatusChip(status: String) {
    val (label, color) = when (status) {
        "WAITING" -> "ждёт" to DvTheme.colors.warning
        "LIVE" -> "в работе" to DvTheme.colors.success
        else -> "закрыт" to DvTheme.colors.textMuted
    }
    Text(text = label, style = MaterialTheme.typography.labelSmall, color = color)
}

private fun patientName(c: InboxConversationSummary): String {
    val name = "${c.patientUser.firstName} ${c.patientUser.lastName}".trim()
    return name.ifBlank { "Пациент" }
}

private fun relativeTime(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    val instant = runCatching { Instant.parse(iso) }.getOrNull() ?: return ""
    val minutes = ChronoUnit.MINUTES.between(instant, Instant.now())
    if (minutes < 1) return "только что"
    if (minutes < 60) return "$minutes мин назад"
    val hours = minutes / 60
    if (hours < 24) return "$hours ч назад"
    return "${hours / 24} дн назад"
}
