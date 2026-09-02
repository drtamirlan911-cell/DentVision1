package kz.dentvision.crm.ui.finance

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kz.dentvision.crm.data.model.FinanceReport
import kz.dentvision.crm.lib.formatTenge
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Финансы: выручка, долг, расходы, зарплата и прибыль за период.
 *
 * Все суммы приходят посчитанными с сервера и здесь только показываются. Ни
 * одного пересчёта на устройстве: иначе телефон и браузер начали бы показывать
 * разную выручку за один и тот же день, и правым оказался бы неизвестно кто.
 */
@Composable
fun FinanceScreen(viewModel: FinanceViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FinancePeriod.entries.forEach { period ->
                FilterChip(
                    selected = state.period == period,
                    onClick = { viewModel.selectPeriod(period) },
                    label = { Text(period.label) },
                )
            }
        }

        when (val report = state.report) {
            is UiState.Loading -> LoadingSkeleton(
                rows = 4,
                contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
            )
            is UiState.Error -> ErrorState(message = report.message, onRetry = viewModel::load)
            is UiState.Data -> ReportBody(report.value)
        }
    }
}

@Composable
private fun ReportBody(report: FinanceReport) {
    val totals = report.totals

    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        Metric("Выручка", formatTenge(totals.revenue), DvTheme.colors.success, Modifier.weight(1f))
        Metric(
            label = "Прибыль",
            value = formatTenge(totals.profit),
            // Убыток красным не для драмы: минус в этой строке — единственное,
            // что тут требует немедленного внимания.
            color = if (totals.profit < 0) DvTheme.colors.error else DvTheme.colors.textPrimary,
            modifier = Modifier.weight(1f),
        )
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        Metric("Долг", formatTenge(totals.unpaid), DvTheme.colors.warning, Modifier.weight(1f))
        Metric("Расходы", formatTenge(totals.expenses), DvTheme.colors.textSecondary, Modifier.weight(1f))
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        Metric("Зарплата", formatTenge(totals.payroll), DvTheme.colors.textSecondary, Modifier.weight(1f))
        Metric("Оплачено счетов", totals.paidCount.toString(), DvTheme.colors.textSecondary, Modifier.weight(1f))
    }

    if (report.byMethod.isNotEmpty()) {
        Breakdown(
            title = "По способу оплаты",
            rows = report.byMethod.map { it.method to formatTenge(it.revenue) },
        )
    }
    if (report.byService.isNotEmpty()) {
        Breakdown(
            title = "По услугам",
            rows = report.byService.take(10).map { it.name to formatTenge(it.revenue) },
        )
    }
    if (report.expensesByCategory.isNotEmpty()) {
        Breakdown(
            title = "Расходы по категориям",
            rows = report.expensesByCategory.map { it.category to formatTenge(it.amount) },
        )
    }
}

@Composable
private fun Metric(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(text = value, style = MaterialTheme.typography.titleLarge, color = color)
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = DvTheme.colors.textMuted,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

@Composable
private fun Breakdown(title: String, rows: List<Pair<String, String>>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.labelLarge,
                color = DvTheme.colors.gold,
            )
            HorizontalDivider(
                color = DvTheme.colors.borderSubtle,
                modifier = Modifier.padding(vertical = 8.dp),
            )
            rows.forEach { (name, value) ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = name,
                        style = MaterialTheme.typography.bodySmall,
                        color = DvTheme.colors.textSecondary,
                    )
                    Text(
                        text = value,
                        style = MaterialTheme.typography.bodySmall,
                        color = DvTheme.colors.textPrimary,
                    )
                }
            }
        }
    }
}
