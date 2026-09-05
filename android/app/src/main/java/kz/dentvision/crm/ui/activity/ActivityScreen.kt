package kz.dentvision.crm.ui.activity

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kz.dentvision.crm.data.model.AiTimelineEvent
import kz.dentvision.crm.data.model.AiTimelineStats
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Что ИИ делал, с чем и почему отказал — журнал, а не чат. Прослеживается до
 * `AgentActivity`/`ActionEvidence`, а не собран из логов клиента: клиент
 * только читает то, что governance-ядро уже записало на сервере.
 */
@Composable
fun ActivityScreen(viewModel: ActivityViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Column(modifier = Modifier.fillMaxSize()) {
        state.stats?.let { StatsRow(it) }
        when (val entries = state.entries) {
            is UiState.Loading -> LoadingSkeleton()
            is UiState.Error -> ErrorState(message = entries.message, onRetry = viewModel::load)
            is UiState.Data -> if (entries.value.isEmpty()) {
                EmptyStateView(
                    title = "Пока пусто",
                    description = "Здесь появляется каждое действие ассистента с тем, на чём оно основано.",
                )
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(entries.value, key = { it.id }) { event -> ActivityRow(event) }
                }
            }
        }
    }
}

@Composable
private fun StatsRow(stats: AiTimelineStats) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        StatCell("Всего", stats.totalEvents.toString(), Modifier.weight(1f))
        StatCell("Сегодня", stats.todayEvents.toString(), Modifier.weight(1f))
        StatCell("Успешно", "${stats.successRate.toInt()}%", Modifier.weight(1f))
    }
}

@Composable
private fun StatCell(label: String, value: String, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(value, style = MaterialTheme.typography.titleLarge, color = DvTheme.colors.textPrimary)
            Text(label, style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
        }
    }
}

@Composable
private fun ActivityRow(event: AiTimelineEvent) {
    val statusColor = when (event.status) {
        "ok" -> DvTheme.colors.success
        "denied" -> DvTheme.colors.warning
        else -> DvTheme.colors.error
    }
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                StatusDot(statusColor)
                Text(
                    text = event.type,
                    style = MaterialTheme.typography.bodyMedium,
                    color = DvTheme.colors.textPrimary,
                    modifier = Modifier.padding(start = 8.dp).weight(1f),
                )
                Text(
                    text = event.timestamp.take(16).replace('T', ' '),
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.textMuted,
                )
            }
            if (event.error != null) {
                Text(
                    text = event.error,
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.error,
                    modifier = Modifier.padding(top = 4.dp, start = 16.dp),
                )
            } else event.result?.summary?.takeIf { it.isNotBlank() }?.let { summary ->
                Text(
                    text = summary,
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.textSecondary,
                    modifier = Modifier.padding(top = 4.dp, start = 16.dp),
                )
            }
            if (event.evidence.isNotEmpty()) {
                HorizontalDivider(color = DvTheme.colors.borderSubtle, modifier = Modifier.padding(vertical = 8.dp))
                Text(
                    text = "На основании: " + event.evidence.joinToString { it.sourceType },
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.textGhost,
                )
            }
        }
    }
}

@Composable
private fun StatusDot(color: androidx.compose.ui.graphics.Color) {
    Box(
        modifier = Modifier
            .size(9.dp)
            .clip(CircleShape)
            .background(color),
    )
}
