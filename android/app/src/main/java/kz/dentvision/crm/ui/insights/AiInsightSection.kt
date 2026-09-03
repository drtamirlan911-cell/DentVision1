package kz.dentvision.crm.ui.insights

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kz.dentvision.crm.data.model.AiInsight
import kz.dentvision.crm.data.model.AiInsightAction
import kz.dentvision.crm.navigation.resolveAssistantPath
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Подсказки на карточке пациента — перенос `AiInsightCard.tsx`. Ничего не
 * рисует, пока подсказок нет: ни скелетона, ни пустого состояния, ни при
 * загрузке, ни при ошибке — ровно так же ведёт себя веб-компонент
 * (`if (isLoading || !insights || insights.length === 0) return null`).
 */
@Composable
fun AiInsightSection(
    entityId: String?,
    implemented: Set<String>,
    onNavigate: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: InsightsViewModel = viewModel(),
) {
    LaunchedEffect(entityId) { viewModel.ensureLoaded(entityId) }
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.pendingNavigatePath) {
        val path = state.pendingNavigatePath ?: return@LaunchedEffect
        resolveAssistantPath(path, implemented)?.let(onNavigate)
        viewModel.consumeNavigate()
    }

    val insights = (state.items as? UiState.Data)?.value.orEmpty()
    if (insights.isEmpty()) return

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        insights.forEach { insight ->
            InsightCard(
                insight = insight,
                onDismiss = { viewModel.dismiss(insight.id) },
                onAction = { viewModel.performAction(it) },
            )
        }
        state.message?.let { message ->
            Text(
                text = message,
                style = MaterialTheme.typography.bodySmall,
                color = DvTheme.colors.error,
            )
        }
    }
}

@Composable
private fun InsightCard(
    insight: AiInsight,
    onDismiss: () -> Unit,
    onAction: (AiInsightAction) -> Unit,
) {
    val severityColor = when (insight.severity) {
        "urgent" -> DvTheme.colors.error
        "attention" -> DvTheme.colors.warning
        else -> DvTheme.colors.info
    }
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
    ) {
        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.Top) {
            SeverityBadge(insight.severity, severityColor)
            Column(modifier = Modifier.weight(1f).padding(start = 10.dp)) {
                Text(
                    text = insight.title,
                    style = MaterialTheme.typography.bodyMedium,
                    color = DvTheme.colors.textPrimary,
                )
                if (insight.actions.isNotEmpty()) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.padding(top = 8.dp),
                    ) {
                        insight.actions.forEach { action ->
                            AssistChip(
                                onClick = { onAction(action) },
                                label = { Text(action.label) },
                            )
                        }
                    }
                }
            }
            IconButton(onClick = onDismiss) {
                Icon(
                    imageVector = Icons.Filled.Close,
                    contentDescription = "Скрыть подсказку",
                    tint = DvTheme.colors.textMuted,
                )
            }
        }
    }
}

@Composable
private fun SeverityBadge(severity: String, color: androidx.compose.ui.graphics.Color) {
    val label = when (severity) {
        "urgent" -> "Срочно"
        "attention" -> "Внимание"
        else -> "Инфо"
    }
    Surface(color = color.copy(alpha = 0.15f), shape = MaterialTheme.shapes.small) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = color,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
        )
    }
}
