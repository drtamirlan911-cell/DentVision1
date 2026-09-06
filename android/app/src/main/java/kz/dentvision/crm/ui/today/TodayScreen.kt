package kz.dentvision.crm.ui.today

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.PersonSearch
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kz.dentvision.crm.data.model.APPOINTMENT_STATUS_LABELS
import kz.dentvision.crm.data.model.Appointment
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.lib.formatPhone
import kz.dentvision.crm.navigation.canAccessPage
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.theme.DvSpacing
import kz.dentvision.crm.ui.theme.DvTheme
import java.time.format.DateTimeFormatter
import java.util.Locale

private val DAY_FORMAT = DateTimeFormatter.ofPattern("d MMMM, EEEE", Locale("ru"))

/**
 * Рабочий день сотрудника: кто сегодня, кто следующий, что горит.
 *
 * Занимает место, на котором раньше открывался чат с ассистентом. Чат никуда
 * не делся — он остался отдельной вкладкой; изменилось только то, что первым
 * человек видит свой день, а не пустое поле ввода.
 *
 * Порядок блоков — порядок вопросов, которые сотрудник задаёт себе в начале
 * смены: кто следующий → что ещё сегодня → что не терпит → что я могу
 * сделать прямо сейчас.
 */
@Composable
fun TodayScreen(
    session: Session,
    onOpenPatient: (String) -> Unit,
    onNavigate: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: TodayViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.ensureLoaded(session) }
    val openPatient: (String) -> Unit = { id -> viewModel.openPatient(id, onOpenPatient) }

    if (state.loading) {
        LoadingSkeleton(rows = 5, contentPadding = PaddingValues(DvSpacing.lg))
        return
    }
    if (state.error != null && state.appointments.isEmpty()) {
        ErrorState(message = state.error!!, onRetry = { viewModel.refresh(session) })
        return
    }

    LazyColumn(
        modifier = modifier.fillMaxSize().background(DvTheme.colors.surface0),
        contentPadding = PaddingValues(DvSpacing.lg),
        verticalArrangement = Arrangement.spacedBy(DvSpacing.md),
    ) {
        item {
            Text(
                text = state.date.format(DAY_FORMAT).replaceFirstChar { it.uppercase() },
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
                color = DvTheme.colors.textPrimary,
            )
        }

        state.next?.let { next ->
            item {
                SectionLabel("Следующий приём")
                NextAppointmentCard(next, onOpen = { openPatient(next.patientId) })
            }
        }

        if (state.attention.isNotEmpty()) {
            item { SectionLabel("Требует внимания") }
            items(state.attention, key = { it.id }) { item ->
                AttentionRow(item, onOpen = { onNavigate(item.route) })
            }
        }

        val rest = state.appointments.filter { it.id != state.next?.id }
        if (rest.isNotEmpty()) {
            item { SectionLabel("Остальные приёмы сегодня") }
            items(rest, key = { it.id }) { appointment ->
                AppointmentRow(appointment, onOpen = { openPatient(appointment.patientId) })
            }
        }

        if (state.isEmpty) {
            item {
                Text(
                    text = "На сегодня записей нет.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = DvTheme.colors.textMuted,
                    modifier = Modifier.padding(vertical = DvSpacing.sm),
                )
            }
        }

        item { SectionLabel("Быстрые действия") }
        item {
            QuickActions(
                // `patients.read`/`appointments.write` — те же права, что и
                // у профильных экранов, но не то же самое, что «раздел открыт
                // этой роли»: у лаборатории и поддержки есть `patients.read`
                // для своих ручек, а раздела «Пациенты» в меню нет вовсе — без
                // `canAccessPage` кнопка вела бы на маршрут, которого нет в
                // графе навигации, и `navigate()` падал бы с исключением.
                canWriteAppointments = canAccessPage(session.pages, "schedule") && session.has("appointments.write"),
                canReadPatients = canAccessPage(session.pages, "patients") && session.has("patients.read"),
                onNavigate = onNavigate,
            )
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelSmall,
        color = DvTheme.colors.textMuted,
        modifier = Modifier.padding(top = DvSpacing.sm, bottom = DvSpacing.xs),
    )
}

/**
 * Единственный золотой элемент экрана: то, к чему сотрудник готовится прямо
 * сейчас. Всё остальное нейтрально, иначе выделение перестаёт выделять.
 */
@Composable
private fun NextAppointmentCard(appointment: Appointment, onOpen: () -> Unit) {
    val colors = DvTheme.colors
    Surface(
        color = colors.gold.copy(alpha = 0.08f),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, colors.gold.copy(alpha = 0.3f)),
        onClick = onOpen,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(modifier = Modifier.padding(DvSpacing.lg), verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = appointment.time,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.SemiBold,
                color = colors.gold,
                modifier = Modifier.width(72.dp),
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = appointment.patientName ?: "Пациент",
                    style = MaterialTheme.typography.titleMedium,
                    color = colors.textPrimary,
                )
                val sub = listOfNotNull(
                    appointment.serviceName.ifBlank { appointment.reason.ifBlank { null } },
                    formatPhone(appointment.patientPhone),
                ).joinToString(" · ")
                if (sub.isNotBlank()) {
                    Text(
                        text = sub,
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textSecondary,
                        modifier = Modifier.padding(top = DvSpacing.xs),
                    )
                }
            }
            Icon(
                Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = "Открыть карточку пациента",
                tint = colors.gold,
                modifier = Modifier.size(20.dp),
            )
        }
    }
}

@Composable
private fun AppointmentRow(appointment: Appointment, onOpen: () -> Unit) {
    val colors = DvTheme.colors
    Surface(
        color = colors.surface1,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, colors.borderSubtle),
        onClick = onOpen,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(modifier = Modifier.padding(DvSpacing.lg), verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = appointment.time,
                style = MaterialTheme.typography.titleMedium,
                color = colors.textPrimary,
                modifier = Modifier.width(56.dp),
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = appointment.patientName ?: "Пациент",
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.textPrimary,
                )
                val status = APPOINTMENT_STATUS_LABELS[appointment.status] ?: appointment.status
                Text(
                    text = status,
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.textMuted,
                    modifier = Modifier.padding(top = DvSpacing.xs),
                )
            }
        }
    }
}

@Composable
private fun AttentionRow(item: AttentionItem, onOpen: () -> Unit) {
    val colors = DvTheme.colors
    // Цвет здесь несёт смысл (просрочено против «просто есть»), поэтому он
    // остаётся — но он же продублирован числом и текстом, чтобы состояние
    // читалось и без различения цветов.
    val accent = if (item.urgent) colors.error else colors.textSecondary
    Surface(
        color = colors.surface1,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, colors.borderSubtle),
        onClick = onOpen,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(modifier = Modifier.padding(DvSpacing.lg), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(accent.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = item.count.toString(),
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = accent,
                )
            }
            Text(
                text = item.title,
                style = MaterialTheme.typography.bodyMedium,
                color = colors.textPrimary,
                modifier = Modifier.weight(1f).padding(start = DvSpacing.md),
            )
            Icon(
                Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = null,
                tint = colors.textGhost,
                modifier = Modifier.size(16.dp),
            )
        }
    }
}

/**
 * Действия, а не ярлыки разделов: показываются только те, которые роль
 * действительно может выполнить. Кнопка, ведущая в 403, хуже отсутствующей.
 */
@Composable
private fun QuickActions(
    canWriteAppointments: Boolean,
    canReadPatients: Boolean,
    onNavigate: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(DvSpacing.sm)) {
        if (canWriteAppointments) {
            QuickAction(
                icon = Icons.Filled.CalendarMonth,
                label = "Открыть расписание",
                onClick = { onNavigate("crm/schedule") },
            )
        }
        if (canReadPatients) {
            QuickAction(
                icon = Icons.Filled.PersonSearch,
                label = "Найти пациента",
                onClick = { onNavigate("crm/patients") },
            )
        }
    }
}

@Composable
private fun QuickAction(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit,
) {
    val colors = DvTheme.colors
    Surface(
        color = colors.surface1,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, colors.borderSubtle),
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(modifier = Modifier.padding(DvSpacing.lg), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = colors.textSecondary, modifier = Modifier.size(20.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                color = colors.textPrimary,
                modifier = Modifier.weight(1f).padding(start = DvSpacing.md),
            )
        }
    }
}
