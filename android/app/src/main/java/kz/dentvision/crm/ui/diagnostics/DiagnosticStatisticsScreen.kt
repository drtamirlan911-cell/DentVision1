package kz.dentvision.crm.ui.diagnostics

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

private val COMPLETED_STATUSES = setOf("COMPLETED", "REVIEWED", "DELIVERED", "CLOSED")

data class DiagnosticsStatistics(
    val total: Int,
    val todayCount: Int,
    val completed: Int,
    val pending: Int,
    val statusCounts: List<Pair<String, Int>>,
)

/**
 * Перенос `DiagnosticStatistics.tsx` — своей ручки нет, те же направления
 * (`/referrals`, limit=500, как на вебе), четыре плитки и разбивка по
 * статусам считаются на клиенте. `total` — из конверта списка (реальное
 * число на сервере), а не `items.size`, который limit может обрезать —
 * то же различие, что веб делает через `listData?.total ?? items.length`.
 */
class DiagnosticStatisticsViewModel(
    private val repository: DiagnosticsRepository = DiagnosticsRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<DiagnosticsStatistics>>(UiState.Loading)
    val state: StateFlow<UiState<DiagnosticsStatistics>> = _state

    init {
        load()
    }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            runCatching { repository.referrals(limit = 500) }
                .onSuccess { (items, total) -> _state.value = UiState.Data(compute(items, total)) }
                .onFailure { _state.value = UiState.Error(it.message ?: "Не удалось получить статистику") }
        }
    }

    private fun compute(items: List<kz.dentvision.crm.data.model.Referral>, total: Int): DiagnosticsStatistics {
        val todayStart = LocalDate.now(ZoneId.systemDefault()).atStartOfDay(ZoneId.systemDefault()).toInstant()
        val todayCount = items.count { r ->
            val created = r.createdAt?.let { runCatching { Instant.parse(it) }.getOrNull() }
            created != null && !created.isBefore(todayStart)
        }
        val completed = items.count { it.status in COMPLETED_STATUSES }
        val counts = LinkedHashMap<String, Int>()
        for (r in items) counts[r.status] = (counts[r.status] ?: 0) + 1
        return DiagnosticsStatistics(
            total = if (total > 0) total else items.size,
            todayCount = todayCount,
            completed = completed,
            pending = items.size - completed,
            statusCounts = counts.entries.sortedByDescending { it.value }.map { it.key to it.value },
        )
    }
}

@Composable
fun DiagnosticStatisticsScreen(viewModel: DiagnosticStatisticsViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    when (val s = state) {
        is UiState.Loading -> LoadingSkeleton()
        is UiState.Error -> ErrorState(message = s.message, onRetry = viewModel::load)
        is UiState.Data -> StatisticsContent(s.value)
    }
}

@Composable
private fun StatisticsContent(stats: DiagnosticsStatistics) {
    Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            items(
                listOf(
                    "Всего" to stats.total,
                    "За сегодня" to stats.todayCount,
                    "В работе" to stats.pending,
                    "Готово" to stats.completed,
                ),
            ) { (label, value) -> StatTile(label, value) }
        }

        Text(
            text = "Распределение по статусам",
            style = MaterialTheme.typography.titleMedium,
            color = DvTheme.colors.textPrimary,
        )

        if (stats.statusCounts.isEmpty()) {
            Text(text = "Нет данных", style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textMuted)
        } else {
            val maxCount = stats.statusCounts.maxOf { it.second }.coerceAtLeast(1)
            LazyColumn(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                items(stats.statusCounts, key = { it.first }) { (status, count) ->
                    StatusBar(status = status, count = count, maxCount = maxCount)
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
private fun StatusBar(status: String, count: Int, maxCount: Int) {
    val color = referralStatusColor(status)
    Column {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(text = referralStatusLabel(status), style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textPrimary)
            Text(text = count.toString(), style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(DvTheme.colors.surface1),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(count.toFloat() / maxCount)
                    .height(8.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(color),
            )
        }
    }
}
