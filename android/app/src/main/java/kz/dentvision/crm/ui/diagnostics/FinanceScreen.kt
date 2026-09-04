package kz.dentvision.crm.ui.diagnostics

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.DiagnosticsRepository
import kz.dentvision.crm.data.model.OperatorDashboard
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.lib.formatTenge
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Перенос `FinanceTab.tsx` — только чтение, никаких действий. Суммы —
 * посчитанные на сервере `Number`-числа (не `Decimal` с провода), см.
 * `OperatorDashboard`.
 */
class FinanceViewModel(
    private val repository: DiagnosticsRepository = DiagnosticsRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<OperatorDashboard>>(UiState.Loading)
    val state: StateFlow<UiState<OperatorDashboard>> = _state

    private var kind: OperatorKind = OperatorKind.CENTER
    private var orgId: String = ""
    private var startedFor: String? = null

    fun start(kind: OperatorKind, orgId: String) {
        val key = "$kind:$orgId"
        if (startedFor == key) return
        startedFor = key
        this.kind = kind
        this.orgId = orgId
        load()
    }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            runCatching {
                if (kind == OperatorKind.CENTER) repository.operatorDashboard(centerId = orgId) else repository.operatorDashboard(labId = orgId)
            }
                .onSuccess { _state.value = UiState.Data(it) }
                .onFailure { e -> _state.value = UiState.Error(e.message ?: "Не удалось получить финансовую сводку") }
        }
    }
}

@Composable
fun FinanceScreen(session: Session, viewModel: FinanceViewModel = viewModel()) {
    val kind = if (session.user.organizationType == "LABORATORY") OperatorKind.LAB else OperatorKind.CENTER
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

    LaunchedEffect(kind, orgId) { viewModel.start(kind, orgId) }
    val state by viewModel.state.collectAsStateWithLifecycle()

    when (val s = state) {
        is UiState.Loading -> LoadingSkeleton()
        is UiState.Error -> ErrorState(message = s.message, onRetry = viewModel::load)
        is UiState.Data -> FinanceContent(s.value)
    }
}

@Composable
private fun FinanceContent(d: OperatorDashboard) {
    Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            items(
                listOf(
                    Triple("Доход сегодня", formatTenge(d.revenue.today.toInt()), "Комиссия: ${formatTenge(d.commissions.today.toInt())}"),
                    Triple("Доход за неделю", formatTenge(d.revenue.week.toInt()), "Чистый: ${formatTenge(d.netRevenue.week.toInt())}"),
                    Triple("Доход за месяц", formatTenge(d.revenue.month.toInt()), "Выполнено: ${d.completedCount} направлений"),
                    Triple("Не оплачено", d.paymentStats.unpaid.toString(), "Оплачено: ${d.paymentStats.paid}"),
                ),
            ) { (label, value, sub) -> RevenueTile(label, value, sub) }
        }

        Card(
            colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
            border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(text = "Сводка по году", style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary)
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = "Общий доход", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
                    Text(text = formatTenge(d.revenue.year.toInt()), style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = "Комиссия платформы", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
                    Text(text = formatTenge(d.commissions.year.toInt()), style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                }
                HorizontalDivider(color = DvTheme.colors.borderSubtle)
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = "Чистый доход центра", style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                    Text(text = formatTenge(d.netRevenue.year.toInt()), style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.success)
                }
            }
        }

        Text(text = "Статусы направлений", style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary)
        if (d.byStatus.isEmpty()) {
            Text(text = "Нет данных", style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textMuted)
        } else {
            val sorted = d.byStatus.entries.sortedByDescending { it.value }
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(sorted, key = { it.key }) { (status, count) ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
                        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            StatusChip(status)
                            Text(text = count.toString(), style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RevenueTile(label: String, value: String, sub: String) {
    Card(
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(text = label, style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
            Text(text = value, style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.gold)
            Text(text = sub, style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
        }
    }
}
