package kz.dentvision.crm.ui.marketing

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.delay
import kz.dentvision.crm.data.model.MarketingContext
import kz.dentvision.crm.data.model.PlanSummary
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvConfirmDialog
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Контент и продвижение — перенос `Marketing.tsx`. Идеи строятся на данных
 * клиники, а не с потолка: сборка плана и генерация картинок дёргают модель
 * на сервере (эндпоинты уже сами делают всю ИИ-часть), клиент здесь — только
 * обычный REST-клиент над готовым контрактом.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MarketingScreen(
    onOpenPlan: (String) -> Unit,
    viewModel: MarketingViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var toDelete by remember { mutableStateOf<PlanSummary?>(null) }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("На чём строятся идеи", style = MaterialTheme.typography.titleSmall, color = DvTheme.colors.textPrimary)
        when (val ctx = state.context) {
            is UiState.Loading -> LoadingSkeleton(rows = 2)
            is UiState.Error -> ErrorState(message = ctx.message, onRetry = viewModel::load)
            is UiState.Data -> ContextSummary(ctx.value)
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
            border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
        ) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Тональность", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    MARKETING_TONES.forEach { (value, label) ->
                        FilterChip(selected = state.tone == value, onClick = { viewModel.updateTone(value) }, label = { Text(label) })
                    }
                }
                Text("Сколько идей", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(3, 6, 9, 12).forEach { n ->
                        FilterChip(selected = state.count == n, onClick = { viewModel.updateCount(n) }, label = { Text("$n") })
                    }
                }
                DvPrimaryButton(
                    onClick = { viewModel.generate(onOpenPlan) },
                    enabled = !state.generating,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (state.generating) {
                        CircularProgressIndicator(strokeWidth = 2.dp, color = DvTheme.colors.goldOn, modifier = Modifier.padding(end = 8.dp))
                        Text("Собираем план…")
                    } else {
                        Icon(Icons.Filled.AutoAwesome, contentDescription = null, modifier = Modifier.padding(end = 6.dp))
                        Text("Собрать контент-план")
                    }
                }
            }
        }

        state.message?.let { msg ->
            LaunchedEffect(msg) { delay(3000); viewModel.consumeMessage() }
            Text(msg, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.warning)
        }
        state.deleteError?.let { err ->
            Text(err, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.error)
        }

        Text("Сохранённые планы", style = MaterialTheme.typography.titleSmall, color = DvTheme.colors.textPrimary)
        when (val plans = state.plans) {
            is UiState.Loading -> LoadingSkeleton(rows = 3)
            is UiState.Error -> ErrorState(message = plans.message, onRetry = viewModel::load)
            is UiState.Data -> if (plans.value.isEmpty()) {
                EmptyStateView(
                    title = "Планов пока нет",
                    description = "Соберите первый — он сохранится и будет доступен завтра.",
                )
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    plans.value.forEach { plan ->
                        PlanRow(plan = plan, onClick = { onOpenPlan(plan.id) }, onDelete = { toDelete = plan })
                    }
                }
            }
        }
    }

    toDelete?.let { plan ->
        DvConfirmDialog(
            title = "Удалить план?",
            message = "«${plan.title}» и все ${plan.ideaCount} идей будут удалены безвозвратно.",
            confirmLabel = "Удалить",
            onConfirm = { viewModel.delete(plan.id); toDelete = null },
            onDismiss = { toDelete = null },
        )
    }
}

@Composable
private fun ContextSummary(ctx: MarketingContext) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                "Приёмов проанализировано: ${ctx.appointmentsAnalysed} · услуг в работе: ${ctx.topServices.size} · акций: ${ctx.activePromotions.size} · врачей: ${ctx.doctorCount}",
                style = MaterialTheme.typography.bodySmall,
                color = DvTheme.colors.textSecondary,
            )
            if (ctx.topServices.isNotEmpty()) {
                Text(
                    "Чаще всего делают: " + ctx.topServices.take(4).joinToString(", ") { "${it.name} (${it.count})" },
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.textMuted,
                )
            }
            ctx.quietestMonth?.let {
                Text("Спад записи: ${it.month} (${it.appointments})", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.warning)
            }
            if (ctx.neglectedServices.isNotEmpty()) {
                Text(
                    "В прайсе есть, но не делают: " + ctx.neglectedServices.take(4).joinToString(", "),
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.textMuted,
                )
            }
            if (ctx.appointmentsAnalysed == 0) {
                Text(
                    "Закрытых приёмов за полгода пока нет — идеи будут опираться на прайс и акции.",
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.textMuted,
                )
            }
        }
    }
}

@Composable
private fun PlanRow(plan: PlanSummary, onClick: () -> Unit, onDelete: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(plan.title, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                Text(
                    plan.createdAt.replace('T', ' ').take(10) + " · идей: ${plan.ideaCount}" + (if (plan.deterministic) " · без модели" else ""),
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.textMuted,
                )
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Filled.Delete, contentDescription = "Удалить план", tint = DvTheme.colors.error.copy(alpha = 0.7f))
            }
        }
    }
}
