package kz.dentvision.crm.ui.diagnostics

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.DiagnosticsRepository
import kz.dentvision.crm.data.model.DiagnosticsDashboardStats
import kz.dentvision.crm.data.model.Referral
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.navigation.LocalAssistantNavigate
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_CENTERS
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_LABS
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_REFERRALS
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_PATIENTS
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_CALENDAR
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_STATISTICS
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_SETTINGS
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_REGISTRATIONS
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_RESULTS
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvOutlineButton
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Дом кабинета диагностики — перенос `DiagnosticsDashboard.tsx`: пять плиток
 * (`GET /api/diagnostics/dashboard`) и недавние направления. Доступен любому
 * вошедшему не-гостю всегда, независимо от активного рабочего пространства —
 * как на вебе (`Sidebar.tsx`'s `nav.diagnostics`, без проверки прав).
 */
class DiagnosticsHomeViewModel(
    private val repository: DiagnosticsRepository = DiagnosticsRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<DiagnosticsDashboardStats>>(UiState.Loading)
    val state: StateFlow<UiState<DiagnosticsDashboardStats>> = _state

    init {
        load()
    }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            runCatching { repository.dashboard() }
                .onSuccess { _state.value = UiState.Data(it) }
                .onFailure { _state.value = UiState.Error(it.message ?: "Не удалось получить дашборд диагностики") }
        }
    }
}

@Composable
fun DiagnosticsHomeScreen(session: Session, viewModel: DiagnosticsHomeViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val onNavigate = LocalAssistantNavigate.current

    when (val s = state) {
        is UiState.Loading -> LoadingSkeleton()
        is UiState.Error -> ErrorState(message = s.message, onRetry = viewModel::load)
        is UiState.Data -> DiagnosticsHomeContent(
            stats = s.value,
            isSuperadmin = session.effectiveRole == "SUPERADMIN",
            onOpenReferrals = { onNavigate(ROUTE_DIAGNOSTICS_REFERRALS) },
            onOpenReferral = { id -> onNavigate("$ROUTE_DIAGNOSTICS_REFERRALS/$id") },
            onOpenCenters = { onNavigate(ROUTE_DIAGNOSTICS_CENTERS) },
            onOpenLabs = { onNavigate(ROUTE_DIAGNOSTICS_LABS) },
            onOpenResults = { onNavigate(ROUTE_DIAGNOSTICS_RESULTS) },
            onOpenPatients = { onNavigate(ROUTE_DIAGNOSTICS_PATIENTS) },
            onOpenCalendar = { onNavigate(ROUTE_DIAGNOSTICS_CALENDAR) },
            onOpenStatistics = { onNavigate(ROUTE_DIAGNOSTICS_STATISTICS) },
            onOpenSettings = { onNavigate(ROUTE_DIAGNOSTICS_SETTINGS) },
            onOpenRegistrations = { onNavigate(ROUTE_DIAGNOSTICS_REGISTRATIONS) },
        )
    }
}

@Composable
private fun DiagnosticsHomeContent(
    stats: DiagnosticsDashboardStats,
    isSuperadmin: Boolean,
    onOpenReferrals: () -> Unit,
    onOpenReferral: (String) -> Unit,
    onOpenCenters: () -> Unit,
    onOpenLabs: () -> Unit,
    onOpenResults: () -> Unit,
    onOpenPatients: () -> Unit,
    onOpenCalendar: () -> Unit,
    onOpenStatistics: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenRegistrations: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            items(
                listOf(
                    "Всего" to stats.total,
                    "Сегодня" to stats.todayCount,
                    "В работе" to stats.pending,
                    "Завершено" to stats.completed,
                    "Просрочено" to stats.overdue,
                ),
            ) { (label, value) -> StatTile(label, value) }
        }

        DvOutlineButton(onClick = onOpenReferrals, modifier = Modifier.fillMaxWidth()) {
            Text("Все направления")
        }
        DvOutlineButton(onClick = onOpenResults, modifier = Modifier.fillMaxWidth()) {
            Text("Результаты исследований")
        }
        DvOutlineButton(onClick = onOpenPatients, modifier = Modifier.fillMaxWidth()) {
            Text("Пациенты диагностики")
        }
        DvOutlineButton(onClick = onOpenCalendar, modifier = Modifier.fillMaxWidth()) {
            Text("Календарь")
        }
        DvOutlineButton(onClick = onOpenStatistics, modifier = Modifier.fillMaxWidth()) {
            Text("Статистика")
        }
        DvOutlineButton(onClick = onOpenSettings, modifier = Modifier.fillMaxWidth()) {
            Text("Настройки диагностики")
        }
        if (isSuperadmin) {
            DvOutlineButton(onClick = onOpenRegistrations, modifier = Modifier.fillMaxWidth()) {
                Text("Заявки на регистрацию")
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DvOutlineButton(onClick = onOpenCenters, modifier = Modifier.weight(1f)) {
                Text("Центры", style = MaterialTheme.typography.labelMedium)
            }
            DvOutlineButton(onClick = onOpenLabs, modifier = Modifier.weight(1f)) {
                Text("Лаборатории", style = MaterialTheme.typography.labelMedium)
            }
        }

        Text(
            text = "Недавние направления",
            style = MaterialTheme.typography.titleMedium,
            color = DvTheme.colors.textPrimary,
        )

        if (stats.recent.isEmpty()) {
            Text(
                text = "Направлений пока нет",
                style = MaterialTheme.typography.bodyMedium,
                color = DvTheme.colors.textMuted,
            )
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(stats.recent, key = { it.id }) { referral ->
                    ReferralRow(referral = referral, onClick = { onOpenReferral(referral.id) })
                }
            }
        }
    }
}

@Composable
private fun StatTile(label: String, value: Int) {
    Card(
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(text = value.toString(), style = MaterialTheme.typography.headlineSmall, color = DvTheme.colors.gold)
            Text(text = label, style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
        }
    }
}

@Composable
internal fun ReferralRow(referral: Referral, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                Text(
                    text = referral.patientName.ifBlank { "Без имени" },
                    style = MaterialTheme.typography.bodyMedium,
                    color = DvTheme.colors.textPrimary,
                )
                val sub = listOfNotNull(
                    referral.studyType.ifBlank { null },
                    (referral.center?.name ?: referral.lab?.name)?.takeIf { it.isNotBlank() },
                ).joinToString(" · ")
                if (sub.isNotBlank()) {
                    Text(text = sub, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
                }
            }
            StatusChip(referral.status)
        }
    }
}

@Composable
internal fun StatusChip(status: String) {
    val color = referralStatusColor(status)
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(color.copy(alpha = 0.12f))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    ) {
        Text(text = referralStatusLabel(status), style = MaterialTheme.typography.labelSmall, color = color)
    }
}
