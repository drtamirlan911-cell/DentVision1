package kz.dentvision.crm.ui.assistant

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kz.dentvision.crm.data.model.AiAction
import kz.dentvision.crm.data.model.AiMessage
import kz.dentvision.crm.navigation.resolveAssistantPath
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.DvLogo
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Ассистент открывается поверх любого экрана (кнопка в [kz.dentvision.crm.ui.shell.AppShell]),
 * а не живёт отдельным разделом — это и есть разница между «ИИ как ещё один
 * пункт меню» и «ИИ поверх всей оболочки», о которой шла речь в решении
 * перестроить архитектуру вокруг ассистента.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AssistantSheet(
    onDismiss: () -> Unit,
    onNavigate: (String) -> Unit,
    implemented: Set<String>,
    viewModel: AssistantViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val listState = rememberLazyListState()

    LaunchedEffect(Unit) { viewModel.ensureThreadLoaded() }
    LaunchedEffect(state.messages.size) {
        if (state.messages.isNotEmpty()) listState.animateScrollToItem(state.messages.size - 1)
    }
    LaunchedEffect(state.pendingNavigatePath) {
        val path = state.pendingNavigatePath ?: return@LaunchedEffect
        resolveAssistantPath(path, implemented)?.let(onNavigate)
        viewModel.consumeNavigate()
        onDismiss()
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DvTheme.colors.surface1,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 420.dp, max = 640.dp)
                .imePadding()
                .navigationBarsPadding()
                .padding(horizontal = 16.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 8.dp)) {
                DvLogo(size = 24.dp, modifier = Modifier.padding(end = 8.dp))
                Text(
                    text = "Ассистент DentVision",
                    style = MaterialTheme.typography.titleMedium,
                    color = DvTheme.colors.textPrimary,
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = viewModel::startNewThread) {
                    Icon(Icons.Filled.Add, contentDescription = "Новый диалог", tint = DvTheme.colors.textSecondary)
                }
            }
            HorizontalDivider(color = DvTheme.colors.borderSubtle)

            Box(modifier = Modifier.weight(1f, fill = false).heightIn(min = 180.dp)) {
                when {
                    state.loadingThread -> LoadingSkeleton(rows = 4, contentPadding = PaddingValues(vertical = 12.dp))
                    state.messages.isEmpty() -> Text(
                        text = "Спросите что угодно о клинике — расписание, кассу, склад, пациентов.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = DvTheme.colors.textMuted,
                        modifier = Modifier.padding(vertical = 20.dp),
                    )
                    else -> LazyColumn(
                        state = listState,
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        contentPadding = PaddingValues(vertical = 10.dp),
                    ) {
                        items(state.messages, key = { it.id }) { message -> MessageBubble(message) }
                        if (state.sending) item { TypingRow() }
                    }
                }
            }

            if (state.actions.isNotEmpty()) {
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(vertical = 6.dp),
                ) {
                    items(state.actions) { action ->
                        AssistChip(
                            onClick = { viewModel.tapAction(action) },
                            label = { Text(action.label.ifBlank { action.type }) },
                        )
                    }
                }
            }
            if (state.suggestions.isNotEmpty()) {
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(bottom = 6.dp),
                ) {
                    items(state.suggestions) { suggestion ->
                        SuggestionChip(
                            onClick = { viewModel.send(suggestion) },
                            label = { Text(suggestion) },
                        )
                    }
                }
            }
            state.error?.let { message ->
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.error,
                    modifier = Modifier.padding(bottom = 4.dp),
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(bottom = 12.dp),
            ) {
                OutlinedTextField(
                    value = state.input,
                    onValueChange = viewModel::setInput,
                    placeholder = { Text("Спросите ассистента…") },
                    modifier = Modifier.weight(1f),
                    maxLines = 4,
                )
                IconButton(
                    onClick = { viewModel.send() },
                    enabled = state.input.isNotBlank() && !state.sending,
                    modifier = Modifier.padding(start = 4.dp),
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Send,
                        contentDescription = "Отправить",
                        tint = if (state.input.isNotBlank()) DvTheme.colors.gold else DvTheme.colors.textGhost,
                    )
                }
            }
        }
    }

    state.pendingConfirmation?.let { action -> ConfirmActionDialog(action, viewModel) }
}

@Composable
private fun ConfirmActionDialog(action: AiAction, viewModel: AssistantViewModel) {
    AlertDialog(
        onDismissRequest = { viewModel.confirmPending(false) },
        title = { Text("Подтвердите действие") },
        text = { Text(action.label.ifBlank { "Выполнить «${action.type}»?" }) },
        confirmButton = {
            TextButton(onClick = { viewModel.confirmPending(true) }) { Text("Подтвердить") }
        },
        dismissButton = {
            TextButton(onClick = { viewModel.confirmPending(false) }) { Text("Отмена") }
        },
    )
}

@Composable
private fun MessageBubble(message: AiMessage) {
    val isUser = message.role == "user"
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
    ) {
        Surface(
            color = if (isUser) DvTheme.colors.gold.copy(alpha = 0.16f) else DvTheme.colors.surface2,
            shape = MaterialTheme.shapes.medium,
            modifier = Modifier.widthIn(max = 280.dp),
        ) {
            Text(
                // Брифинг и ответы модели используют лёгкий markdown (`**жирный**`);
                // полноценный рендерер — избыточно для чат-пузыря, поэтому маркеры
                // просто убираются, а не остаются видимыми звёздочками.
                text = message.content.replace("**", ""),
                style = MaterialTheme.typography.bodyMedium,
                color = DvTheme.colors.textPrimary,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            )
        }
    }
}

@Composable
private fun TypingRow() {
    Row(verticalAlignment = Alignment.CenterVertically) {
        CircularProgressIndicator(modifier = Modifier.padding(end = 8.dp).heightIn(max = 16.dp).widthIn(max = 16.dp), strokeWidth = 2.dp)
        Text("Ассистент печатает…", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
    }
}
