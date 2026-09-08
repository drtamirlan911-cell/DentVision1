package kz.dentvision.crm.ui.today

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.LocalHospital
import androidx.compose.material.icons.filled.Money
import androidx.compose.material.icons.filled.PersonSearch
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch
import androidx.compose.runtime.rememberCoroutineScope
import kz.dentvision.crm.data.ProfileRepository
import kz.dentvision.crm.data.model.APPOINTMENT_STATUS_LABELS
import kz.dentvision.crm.data.model.Appointment
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.lib.formatPhone
import kz.dentvision.crm.navigation.ROUTE_INTELLIGENCE
import kz.dentvision.crm.navigation.ROUTE_SHOP_SCHOOL
import kz.dentvision.crm.navigation.canAccessPage
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.theme.DvSpacing
import kz.dentvision.crm.ui.theme.DvTheme
import java.time.format.DateTimeFormatter
import java.util.Locale

private val DAY_FORMAT = DateTimeFormatter.ofPattern("d MMMM, EEEE", Locale("ru"))

private data class ServiceTile(
    val id: String,
    val title: String,
    val subtitle: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val route: String,
)

private val SERVICES = listOf(
    ServiceTile("schedule", "Расписание", "Приёмы сегодня", Icons.Filled.CalendarMonth, "schedule"),
    ServiceTile("patients", "Пациенты", "Картотека", Icons.Filled.PersonSearch, "patients"),
    ServiceTile("ai", "AI", "Ассистент", Icons.Filled.SmartToy, ROUTE_INTELLIGENCE),
    ServiceTile("diagnostics", "Диагностика", "Исследования", Icons.Filled.Science, "diagnostics"),
    ServiceTile("finance", "Финансы", "Счета и оплаты", Icons.Filled.Money, "finance"),
    ServiceTile("lab", "Лаборатория", "Заказы", Icons.Filled.Science, "lab"),
    ServiceTile("inventory", "Склад", "Материалы", Icons.Filled.Inventory2, "inventory"),
    ServiceTile("shop", "Marketplace", "Товары и обучение", Icons.Filled.LocalHospital, ROUTE_SHOP_SCHOOL),
)

private const val MAX_QUICK = 8

@Composable
fun TodayScreen(
    session: Session,
    onOpenPatient: (String) -> Unit,
    onNavigate: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: TodayViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val profileRepository = remember { ProfileRepository() }
    var quickIds by remember { mutableStateOf(SERVICES.map { it.id }) }
    var autoCollapse by remember { mutableStateOf(true) }
    var aiCollapsed by remember { mutableStateOf(false) }
    var settingsOpen by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { viewModel.ensureLoaded(session) }
    LaunchedEffect(Unit) {
        runCatching { profileRepository.get() }.onSuccess { profile ->
            val ids = profile.user.homeQuickServices.filter { id -> SERVICES.any { it.id == id } }.take(MAX_QUICK)
            if (ids.isNotEmpty()) quickIds = ids
            autoCollapse = profile.user.homeAiAutoCollapse
        }
    }

    fun savePreferences(ids: List<String>, collapse: Boolean = autoCollapse) {
        val normalized = ids.distinct().filter { id -> SERVICES.any { it.id == id } }.take(MAX_QUICK)
        quickIds = normalized
        autoCollapse = collapse
        scope.launch { runCatching { profileRepository.updateHomePreferences(normalized, collapse) } }
    }

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
        contentPadding = PaddingValues(horizontal = DvSpacing.lg, vertical = DvSpacing.md),
        verticalArrangement = Arrangement.spacedBy(DvSpacing.md),
    ) {
        item {
            Column {
                Text("Добрый день, ${session.user.name.ifBlank { session.user.login }}", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold, color = DvTheme.colors.textPrimary)
                Text(state.date.format(DAY_FORMAT).replaceFirstChar { it.uppercase() }, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted, modifier = Modifier.padding(top = 4.dp))
            }
        }

        item {
            AiSmartBanner(
                collapsed = aiCollapsed,
                autoCollapse = autoCollapse,
                onToggle = { aiCollapsed = !aiCollapsed },
                onAutoCollapseChange = { value -> savePreferences(quickIds, value) },
                onOpen = { onNavigate(ROUTE_INTELLIGENCE) },
            )
        }

        item {
            QuickServiceGrid(
                quickIds = quickIds,
                onConfigure = { settingsOpen = true },
                onNavigate = onNavigate,
            )
        }

        state.next?.let { next ->
            item {
                SectionLabel("Следующий приём")
                NextAppointmentCard(next) { viewModel.openPatient(next.patientId, onOpenPatient) }
            }
        }

        if (state.attention.isNotEmpty()) {
            item { SectionLabel("Требует внимания") }
            items(state.attention, key = { it.id }) { attention ->
                AttentionRow(attention) { onNavigate(attention.route) }
            }
        }

        val rest = state.appointments.filter { it.id != state.next?.id }
        if (rest.isNotEmpty()) {
            item { SectionLabel("Остальные приёмы сегодня") }
            items(rest, key = { it.id }) { appointment ->
                AppointmentRow(appointment) { viewModel.openPatient(appointment.patientId, onOpenPatient) }
            }
        }

        if (state.isEmpty) {
            item { Text("На сегодня записей нет.", style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textMuted) }
        }

        item { SectionLabel("Быстрые действия") }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(DvSpacing.sm)) {
                if (canAccessPage(session.pages, "schedule") && session.has("appointments.write")) SmallAction("Запись", Icons.Filled.CalendarMonth) { onNavigate("schedule") }
                if (canAccessPage(session.pages, "patients") && session.has("patients.read")) SmallAction("Пациенты", Icons.Filled.PersonSearch) { onNavigate("patients") }
            }
        }
    }

    if (settingsOpen) {
        ServicePreferencesDialog(
            selected = quickIds,
            onDismiss = { settingsOpen = false },
            onSave = { ids -> savePreferences(ids); settingsOpen = false },
        )
    }
}

@Composable
private fun AiSmartBanner(
    collapsed: Boolean,
    autoCollapse: Boolean,
    onToggle: () -> Unit,
    onAutoCollapseChange: (Boolean) -> Unit,
    onOpen: () -> Unit,
) {
    LaunchedEffect(autoCollapse, collapsed) {
        if (autoCollapse && !collapsed) {
            kotlinx.coroutines.delay(5000)
            onToggle()
        }
    }
    if (collapsed) {
        Surface(onClick = onToggle, color = DvTheme.colors.gold.copy(alpha = .07f), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, DvTheme.colors.gold.copy(alpha = .2f)), modifier = Modifier.fillMaxWidth()) {
            Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.SmartToy, null, tint = DvTheme.colors.gold, modifier = Modifier.size(22.dp))
                Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                    Text("AI Smart Bar", style = MaterialTheme.typography.labelLarge, color = DvTheme.colors.textPrimary)
                    Text("3 новых инсайта готовы к просмотру", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
                }
                Badge { Text("3") }
                Icon(Icons.AutoMirrored.Filled.ArrowForward, null, tint = DvTheme.colors.gold)
            }
        }
        return
    }
    Surface(color = BrushSurface(DvTheme.colors.gold), shape = RoundedCornerShape(18.dp), border = BorderStroke(1.dp, DvTheme.colors.gold.copy(alpha = .25f)), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(DvTheme.colors.gold.copy(alpha = .12f)), contentAlignment = Alignment.Center) { Icon(Icons.Filled.AutoAwesome, null, tint = DvTheme.colors.gold) }
                Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                    Text("AI сегодня", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = DvTheme.colors.textPrimary)
                    Text("3 новых инсайта", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.gold)
                }
                IconButton(onClick = onToggle) { Icon(Icons.Filled.Close, "Свернуть", tint = DvTheme.colors.textMuted) }
            }
            Text("Есть рекомендации по расписанию и подготовке к приёмам.", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textSecondary, modifier = Modifier.padding(top = 8.dp))
            Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onOpen) { Text("Открыть AI") }
                TextButton(onClick = onToggle) { Text("Свернуть") }
            }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                Checkbox(checked = autoCollapse, onCheckedChange = onAutoCollapseChange)
                Text("Автоматически сворачивать", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
            }
        }
    }
}

@Composable
private fun BrushSurface(accent: androidx.compose.ui.graphics.Color): androidx.compose.ui.graphics.Color = accent.copy(alpha = .07f)

@Composable
private fun QuickServiceGrid(quickIds: List<String>, onConfigure: () -> Unit, onNavigate: (String) -> Unit) {
    val quick = quickIds.mapNotNull { id -> SERVICES.find { it.id == id } }
    Column {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Быстрый доступ", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = DvTheme.colors.textSecondary)
                Text("Ваши основные инструменты", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
            }
            TextButton(onClick = onConfigure) { Text("Настроить") }
        }
        Spacer(Modifier.height(4.dp))
        quick.chunked(4).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { tile -> ServiceCard(tile, Modifier.weight(1f), onNavigate) }
                repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun ServiceCard(tile: ServiceTile, modifier: Modifier, onNavigate: (String) -> Unit) {
    Surface(onClick = { onNavigate(tile.route) }, color = DvTheme.colors.surface1, shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, DvTheme.colors.borderSubtle), modifier = modifier) {
        Column(Modifier.padding(12.dp).height(92.dp)) {
            Box(Modifier.size(34.dp).clip(RoundedCornerShape(10.dp)).background(DvTheme.colors.gold.copy(alpha = .1f)), contentAlignment = Alignment.Center) { Icon(tile.icon, null, tint = DvTheme.colors.gold, modifier = Modifier.size(18.dp)) }
            Text(tile.title, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold, color = DvTheme.colors.textPrimary, modifier = Modifier.padding(top = 8.dp))
            Text(tile.subtitle, style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted, maxLines = 1)
        }
    }
}

@Composable
private fun ServicePreferencesDialog(selected: List<String>, onDismiss: () -> Unit, onSave: (List<String>) -> Unit) {
    var draft by remember { mutableStateOf(selected) }
    AlertDialog(onDismissRequest = onDismiss, title = { Text("Настройки Главного экрана") }, text = {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Выберите до 8 сервисов. Порядок сохраняется на сервере и синхронизируется с веб-версией.", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
            SERVICES.forEach { tile ->
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).clickable { draft = if (draft.contains(tile.id)) draft - tile.id else if (draft.size < MAX_QUICK) draft + tile.id else draft }.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = draft.contains(tile.id), onCheckedChange = null)
                    Icon(tile.icon, null, tint = DvTheme.colors.textSecondary, modifier = Modifier.size(18.dp))
                    Text(tile.title, modifier = Modifier.padding(start = 10.dp), color = DvTheme.colors.textPrimary)
                }
            }
        }
    }, confirmButton = { Button(onClick = { onSave(draft) }) { Text("Сохранить") } }, dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } })
}

@Composable
private fun SectionLabel(text: String) = Text(text, style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted, modifier = Modifier.padding(top = DvSpacing.sm, bottom = DvSpacing.xs))

@Composable
private fun NextAppointmentCard(appointment: Appointment, onOpen: () -> Unit) {
    Surface(onClick = onOpen, color = DvTheme.colors.gold.copy(alpha = .08f), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, DvTheme.colors.gold.copy(alpha = .3f)), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(appointment.time, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold, color = DvTheme.colors.gold, modifier = Modifier.width(70.dp))
            Column(Modifier.weight(1f)) {
                Text(appointment.patientName ?: "Пациент", style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary)
                val sub = listOfNotNull(appointment.serviceName.ifBlank { appointment.reason.ifBlank { null } }, formatPhone(appointment.patientPhone)).joinToString(" · ")
                if (sub.isNotBlank()) Text(sub, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textSecondary, modifier = Modifier.padding(top = 4.dp))
            }
            Icon(Icons.AutoMirrored.Filled.ArrowForward, null, tint = DvTheme.colors.gold)
        }
    }
}

@Composable
private fun AppointmentRow(appointment: Appointment, onOpen: () -> Unit) {
    Surface(onClick = onOpen, color = DvTheme.colors.surface1, shape = RoundedCornerShape(12.dp), border = BorderStroke(1.dp, DvTheme.colors.borderSubtle), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(appointment.time, style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary, modifier = Modifier.width(56.dp))
            Column(Modifier.weight(1f)) {
                Text(appointment.patientName ?: "Пациент", style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                Text(APPOINTMENT_STATUS_LABELS[appointment.status] ?: appointment.status, style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted, modifier = Modifier.padding(top = 3.dp))
            }
        }
    }
}

@Composable
private fun AttentionRow(item: AttentionItem, onOpen: () -> Unit) {
    val accent = if (item.urgent) DvTheme.colors.error else DvTheme.colors.textSecondary
    Surface(onClick = onOpen, color = DvTheme.colors.surface1, shape = RoundedCornerShape(12.dp), border = BorderStroke(1.dp, DvTheme.colors.borderSubtle), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(32.dp).clip(RoundedCornerShape(8.dp)).background(accent.copy(alpha = .12f)), contentAlignment = Alignment.Center) { Text(item.count.toString(), style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold, color = accent) }
            Text(item.title, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary, modifier = Modifier.weight(1f).padding(start = 12.dp))
            Icon(Icons.AutoMirrored.Filled.ArrowForward, null, tint = DvTheme.colors.textGhost, modifier = Modifier.size(16.dp))
        }
    }
}

@Composable
private fun SmallAction(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit) {
    Surface(onClick = onClick, color = DvTheme.colors.surface1, shape = RoundedCornerShape(12.dp), border = BorderStroke(1.dp, DvTheme.colors.borderSubtle)) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically) { Icon(icon, null, tint = DvTheme.colors.gold, modifier = Modifier.size(16.dp)); Text(label, color = DvTheme.colors.textSecondary, modifier = Modifier.padding(start = 7.dp)) }
    }
}
