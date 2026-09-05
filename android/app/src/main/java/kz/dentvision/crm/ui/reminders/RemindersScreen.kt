package kz.dentvision.crm.ui.reminders

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.CrmRepository
import kz.dentvision.crm.lib.AppointmentReminder
import kz.dentvision.crm.lib.buildAppointmentReminders
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme
import java.time.LocalDate

data class RemindersUiState(
    val list: UiState<List<AppointmentReminder>> = UiState.Loading,
    val hideSent: Boolean = true,
    val error: String? = null,
)

class RemindersViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(RemindersUiState())
    val state: StateFlow<RemindersUiState> = _state

    private var clinicId: String? = null
    private var all: List<AppointmentReminder> = emptyList()

    fun start(clinicId: String?) {
        if (this.clinicId == clinicId && _state.value.list !is UiState.Loading) return
        this.clinicId = clinicId
        load()
    }

    fun load() {
        _state.value = _state.value.copy(list = UiState.Loading, error = null)
        val today = LocalDate.now()
        viewModelScope.launch {
            runCatching {
                // Окно в сутки пересекает границу дня, поэтому берём два дня.
                val appointments = repository.appointmentsBetween(
                    from = today.toString(),
                    to = today.plusDays(1).toString(),
                )
                val doctors = clinicId?.let { id ->
                    runCatching { repository.doctors(id) }.getOrDefault(emptyList())
                } ?: emptyList()
                val sent = runCatching { repository.sentReminders() }.getOrDefault(emptyList())
                buildAppointmentReminders(
                    appointments = appointments,
                    doctors = doctors,
                    sentKeys = sent.map { it.reminderKey }.toSet(),
                )
            }
                .onSuccess {
                    all = it
                    _state.value = _state.value.copy(list = UiState.Data(visible()))
                }
                .onFailure {
                    _state.value = _state.value.copy(
                        list = UiState.Error(it.message ?: "Не удалось собрать напоминания"),
                    )
                }
        }
    }

    fun toggleHideSent() {
        _state.value = _state.value.copy(hideSent = !_state.value.hideSent)
        _state.value = _state.value.copy(list = UiState.Data(visible()))
    }

    private fun visible(): List<AppointmentReminder> =
        if (_state.value.hideSent) all.filterNot { it.sent } else all

    /**
     * Отметка ставится сразу после того, как WhatsApp открыт, — доставку
     * приложение подтвердить не может, а сама отметка нужна, чтобы второй
     * администратор не позвонил тому же человеку следом.
     */
    fun markSent(reminder: AppointmentReminder) {
        if (reminder.sent) return
        all = all.map { if (it.id == reminder.id) it.copy(sent = true) else it }
        _state.value = _state.value.copy(list = UiState.Data(visible()))
        viewModelScope.launch {
            runCatching { repository.markReminderSent(reminder.id) }
                .onFailure {
                    // Журнал не принял отметку — возвращаем как было, иначе
                    // напоминание исчезнет, так и не будучи отмеченным.
                    all = all.map { row -> if (row.id == reminder.id) row.copy(sent = false) else row }
                    _state.value = _state.value.copy(
                        list = UiState.Data(visible()),
                        error = it.message ?: "Не удалось отметить напоминание",
                    )
                }
        }
    }
}

/**
 * Напоминания о приёме на ближайшие сутки: кого обзвонить сегодня.
 *
 * Сообщение уходит через WhatsApp — тем же способом, что и в вебе: текст
 * готовится заранее, а отправляет его человек своими руками. Автоматической
 * рассылки отсюда нет, и это правильно: администратор видит, что именно уйдёт
 * пациенту.
 */
@Composable
fun RemindersScreen(
    clinicId: String?,
    canWrite: Boolean,
    viewModel: RemindersViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    LaunchedEffect(clinicId) { viewModel.start(clinicId) }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
            FilterChip(
                selected = state.hideSent,
                onClick = viewModel::toggleHideSent,
                label = { Text("Скрыть отправленные") },
            )
        }
        state.error?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.bodySmall,
                color = DvTheme.colors.error,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
        }

        when (val list = state.list) {
            is UiState.Loading -> LoadingSkeleton()
            is UiState.Error -> ErrorState(message = list.message, onRetry = viewModel::load)
            is UiState.Data -> if (list.value.isEmpty()) {
                EmptyStateView(
                    title = "Обзванивать некого",
                    description = "На ближайшие сутки нет записей, о которых стоит напомнить.",
                )
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(list.value, key = { it.id }) { reminder ->
                        ReminderRow(
                            reminder = reminder,
                            canWrite = canWrite,
                            onSend = {
                                val opened = openWhatsApp(context, reminder.waLink)
                                if (opened) viewModel.markSent(reminder)
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ReminderRow(
    reminder: AppointmentReminder,
    canWrite: Boolean,
    onSend: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = reminder.appointment.patientName ?: "Пациент",
                    style = MaterialTheme.typography.titleMedium,
                    color = DvTheme.colors.textPrimary,
                )
                Text(
                    text = "${reminder.appointment.date.takeLast(5)} ${reminder.appointment.time}",
                    style = MaterialTheme.typography.labelMedium,
                    color = DvTheme.colors.gold,
                )
            }
            val sub = listOfNotNull(
                reminder.doctorName.takeIf { it.isNotBlank() },
                reminder.appointment.patientPhone?.takeIf { it.isNotBlank() },
            ).joinToString(" · ")
            if (sub.isNotBlank()) {
                Text(
                    text = sub,
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.textMuted,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }

            if (reminder.sent) {
                Text(
                    text = "Отправлено",
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.success,
                    modifier = Modifier.padding(top = 6.dp),
                )
            } else if (canWrite) {
                TextButton(onClick = onSend, modifier = Modifier.padding(top = 2.dp)) {
                    Text("Написать в WhatsApp")
                }
            }
        }
    }
}

/**
 * Открывает WhatsApp с готовым текстом. Если его на устройстве нет, ссылка
 * `wa.me` откроется в браузере — поэтому и здесь, и там результат один.
 * Возвращает false, только если открыть нечем совсем: тогда отметку об
 * отправке ставить нельзя.
 */
private fun openWhatsApp(context: android.content.Context, link: String): Boolean = try {
    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link)))
    true
} catch (e: ActivityNotFoundException) {
    false
}
