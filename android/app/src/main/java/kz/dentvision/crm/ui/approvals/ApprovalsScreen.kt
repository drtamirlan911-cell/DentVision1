package kz.dentvision.crm.ui.approvals

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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kz.dentvision.crm.data.model.AiApprovalItem
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvConfirmDialog
import kz.dentvision.crm.ui.theme.DvConfirmVariant
import kz.dentvision.crm.ui.theme.DvOutlineButton
import kz.dentvision.crm.ui.theme.DvTheme
import java.util.Locale
import androidx.compose.foundation.layout.Box

/**
 * Центр подтверждений (`GET/POST /api/ai/approvals`, governance-ядро). Строка
 * появляется, когда мутирующее действие ИИ отмечено как требующее человека —
 * список и право решать целиком определяет сервер, экран не гадает по роли.
 */
@Composable
fun ApprovalsScreen(viewModel: ApprovalsViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    var pendingApprove by remember { mutableStateOf<AiApprovalItem?>(null) }

    LaunchedEffect(state.message) {
        val message = state.message ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(message)
        viewModel.consumeMessage()
    }

    Box(modifier = Modifier.fillMaxSize()) {
        when (val items = state.items) {
            is UiState.Loading -> LoadingSkeleton()
            is UiState.Error -> ErrorState(message = items.message, onRetry = viewModel::load)
            is UiState.Data -> if (items.value.isEmpty()) {
                EmptyStateView(
                    title = "Нет подтверждений",
                    description = "Ассистент сам исполняет обычные действия. Здесь появляется только то, что требует вашего решения.",
                )
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    items(items.value, key = { it.id }) { approval ->
                        ApprovalRow(
                            approval = approval,
                            deciding = state.decidingId == approval.id,
                            onApprove = {
                                // Высокий риск — лишний шаг подтверждения нужен именно
                                // здесь: это действие ИИ реально исполнится, а не просто
                                // уйдёт из списка, как при отклонении.
                                if (approval.riskLevel == "high") {
                                    pendingApprove = approval
                                } else {
                                    viewModel.approve(approval.id)
                                }
                            },
                            onReject = { viewModel.reject(approval.id) },
                        )
                    }
                }
            }
        }
        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier.align(Alignment.BottomCenter).padding(16.dp),
        ) { data -> Snackbar(snackbarData = data, containerColor = DvTheme.colors.surface3) }
    }

    pendingApprove?.let { approval ->
        DvConfirmDialog(
            title = "Подтвердить действие высокого риска?",
            message = approval.summary.ifBlank { "Действие «${approval.tool}» будет выполнено немедленно." },
            confirmLabel = "Подтвердить",
            variant = DvConfirmVariant.WARNING,
            onConfirm = {
                viewModel.approve(approval.id)
                pendingApprove = null
            },
            onDismiss = { pendingApprove = null },
        )
    }
}

@Composable
private fun ApprovalRow(
    approval: AiApprovalItem,
    deciding: Boolean,
    onApprove: () -> Unit,
    onReject: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                RiskBadge(approval.riskLevel)
                Text(
                    text = approval.tool,
                    style = MaterialTheme.typography.labelMedium,
                    color = DvTheme.colors.textMuted,
                    modifier = Modifier.padding(start = 8.dp),
                )
            }
            Text(
                text = approval.summary.ifBlank { "Требуется подтверждение действия" },
                style = MaterialTheme.typography.bodyMedium,
                color = DvTheme.colors.textPrimary,
                modifier = Modifier.padding(top = 6.dp),
            )
            Row(modifier = Modifier.padding(top = 12.dp)) {
                if (deciding) {
                    CircularProgressIndicator(modifier = Modifier.padding(8.dp), strokeWidth = 2.dp)
                } else {
                    TextButton(onClick = onReject) { Text("Отклонить", color = DvTheme.colors.error) }
                    DvOutlineButton(onClick = onApprove, modifier = Modifier.padding(start = 8.dp)) {
                        Text("Подтвердить")
                    }
                }
            }
        }
    }
}

@Composable
private fun RiskBadge(riskLevel: String) {
    val color = if (riskLevel == "high") DvTheme.colors.error else DvTheme.colors.warning
    Surface(color = color.copy(alpha = 0.15f), shape = MaterialTheme.shapes.small) {
        Text(
            text = if (riskLevel == "high") "Высокий риск" else riskLevel.replaceFirstChar { it.titlecase(Locale.getDefault()) },
            style = MaterialTheme.typography.labelSmall,
            color = color,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
        )
    }
}
