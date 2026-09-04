package kz.dentvision.crm.ui.intelligence

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kz.dentvision.crm.data.model.AiAction
import kz.dentvision.crm.data.model.AiAlert
import kz.dentvision.crm.data.model.AiMessage
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Дом приложения. Портирует композицию `AIWorkspaceIndex.tsx` (шапка со
 * статусом → лента диалога с золотыми асимметричными пузырями → тревоги →
 * подсказки → композер) — не список карточек «кабинета», а тот же самый
 * разговор, которым живёт веб-версия на маршруте `/`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IntelligenceScreen(
    onNavigate: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: IntelligenceViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()

    LaunchedEffect(Unit) { viewModel.ensureLoaded() }
    LaunchedEffect(state.messages.size) {
        if (state.messages.isNotEmpty()) listState.animateScrollToItem(state.messages.size - 1)
    }
    LaunchedEffect(state.pendingNavigatePath) {
        val path = state.pendingNavigatePath ?: return@LaunchedEffect
        onNavigate(path)
        viewModel.consumeNavigate()
    }

    Column(modifier = modifier.fillMaxSize().background(DvTheme.colors.surface0)) {
        Box(modifier = Modifier.weight(1f)) {
            when {
                state.loadingThread -> LoadingSkeleton(rows = 4, contentPadding = PaddingValues(20.dp))
                state.messages.isEmpty() -> EmptyHero(isGuest = state.isGuest)
                else -> LazyColumn(
                    state = listState,
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    items(state.messages, key = { it.id }) { message -> MessageBubble(message) }
                    if (state.sending) item { TypingRow() }
                }
            }
        }

        if (state.alerts.isNotEmpty()) {
            AlertStrip(alerts = state.alerts, onTap = viewModel::tapAlert, onDismiss = viewModel::dismissAlert)
        }
        if (state.actions.isNotEmpty()) {
            ActionRow(actions = state.actions, onTap = viewModel::tapAction)
        }
        if (state.suggestions.isNotEmpty() && !state.sending) {
            SuggestionRow(suggestions = state.suggestions, onTap = viewModel::send)
        }
        if (state.isGuest) {
            state.aiRequestsLeft?.let { left ->
                Text(
                    text = if (left > 0) "Бесплатных вопросов осталось: $left" else "Бесплатные вопросы закончились — зарегистрируйтесь, чтобы продолжить",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (left > 0) DvTheme.colors.textMuted else DvTheme.colors.warning,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 2.dp),
                )
            }
        }
        state.error?.let { message ->
            Text(
                text = message,
                style = MaterialTheme.typography.bodySmall,
                color = DvTheme.colors.error,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp),
            )
        }
        Composer(
            value = state.input,
            onChange = viewModel::setInput,
            onSend = { viewModel.send() },
            sending = state.sending,
            isGuest = state.isGuest,
        )
    }

    state.pendingConfirmation?.let { action ->
        AlertDialog(
            onDismissRequest = { viewModel.confirmPending(false) },
            title = { Text("Подтвердите действие") },
            text = { Text(action.label.ifBlank { "Выполнить «${action.type}»?" }) },
            confirmButton = { TextButton(onClick = { viewModel.confirmPending(true) }) { Text("Подтвердить") } },
            dismissButton = { TextButton(onClick = { viewModel.confirmPending(false) }) { Text("Отмена") } },
        )
    }
}

/** Аватар-чип ассистента: золотой градиентный фон, скруглённый квадрат — переносит `Bot`-иконку веба. */
@Composable
private fun BotChip(size: androidx.compose.ui.unit.Dp, iconSize: androidx.compose.ui.unit.Dp) {
    val colors = DvTheme.colors
    Box(
        modifier = Modifier
            .size(size)
            .clip(RoundedCornerShape(size / 2.25f))
            .background(
                Brush.linearGradient(
                    listOf(colors.gold.copy(alpha = 0.25f), colors.gold.copy(alpha = 0.05f)),
                ),
            )
            .border(1.dp, colors.gold.copy(alpha = 0.2f), RoundedCornerShape(size / 2.25f)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(Icons.Filled.SmartToy, contentDescription = null, tint = colors.gold, modifier = Modifier.size(iconSize))
    }
}

/**
 * Заглавный экран Intelligence — первое, что видит и гость, и вошедший.
 * Раньше здесь была статичная плоская иконка робота; теперь — многослойная
 * анимация вокруг мозга (`Icons.Filled.Psychology`): дышащее внешнее
 * свечение, медленно вращающееся золотое кольцо и пульсирующее ядро —
 * тот самый «вау»-момент при первом открытии, а не просто иконка.
 */
@Composable
private fun EmptyHero(isGuest: Boolean) {
    val colors = DvTheme.colors
    val transition = rememberInfiniteTransition(label = "hero")
    val pulse by transition.animateFloat(
        initialValue = 0.94f,
        targetValue = 1.08f,
        animationSpec = infiniteRepeatable(tween(2200, easing = LinearEasing), RepeatMode.Reverse),
        label = "hero-pulse",
    )
    val glowAlpha by transition.animateFloat(
        initialValue = 0.18f,
        targetValue = 0.45f,
        animationSpec = infiniteRepeatable(tween(1800, easing = LinearEasing), RepeatMode.Reverse),
        label = "hero-glow",
    )
    val ringRotation by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(7000, easing = LinearEasing)),
        label = "hero-ring",
    )
    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(modifier = Modifier.size(112.dp), contentAlignment = Alignment.Center) {
            // Дышащее свечение вокруг всей композиции.
            Box(
                modifier = Modifier
                    .size(112.dp)
                    .scale(pulse)
                    .clip(CircleShape)
                    .background(
                        Brush.radialGradient(
                            listOf(colors.gold.copy(alpha = glowAlpha), Color.Transparent),
                        ),
                    ),
            )
            // Вращающееся кольцо — единственный источник «энергии» вокруг ядра.
            Box(
                modifier = Modifier
                    .size(84.dp)
                    .rotate(ringRotation)
                    .clip(CircleShape)
                    .border(
                        width = 2.dp,
                        brush = Brush.sweepGradient(
                            listOf(
                                Color.Transparent,
                                colors.gold.copy(alpha = 0.9f),
                                Color.Transparent,
                                Color.Transparent,
                            ),
                        ),
                        shape = CircleShape,
                    ),
            )
            // Ядро — сам мозг, пульсирует чуть мягче кольца.
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .scale(0.96f + (pulse - 0.94f) * 0.4f)
                    .clip(RoundedCornerShape(22.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(colors.gold.copy(alpha = 0.28f), colors.gold.copy(alpha = 0.04f)),
                        ),
                    )
                    .border(1.dp, colors.gold.copy(alpha = 0.25f), RoundedCornerShape(22.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.Psychology, contentDescription = null, tint = colors.gold, modifier = Modifier.size(34.dp))
            }
        }
        Text(
            text = "Intelligence",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.SemiBold,
            color = colors.textPrimary,
            modifier = Modifier.padding(top = 20.dp),
        )
        Text(
            // Перенос `ai.guest_empty`/`ai.auth_empty` (`src/locales/ru.json`) —
            // гость и вошедший видят один экран, но не один и тот же текст:
            // у гостя ещё нет данных клиники, которые эта фраза обещала бы.
            text = if (isGuest) {
                "Jarvis покажет платформу..."
            } else {
                "AI-операционка клиники. Спросите о расписании..."
            },
            style = MaterialTheme.typography.bodyMedium,
            color = colors.textMuted,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp).widthIn(max = 300.dp),
        )
    }
}

@Composable
private fun MessageBubble(message: AiMessage) {
    val isUser = message.role == "user"
    val colors = DvTheme.colors
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
    ) {
        if (!isUser) {
            BotChip(size = 32.dp, iconSize = 16.dp)
            Spacer(modifier = Modifier.width(8.dp))
        }
        val shape = if (isUser) {
            RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp, bottomStart = 20.dp, bottomEnd = 6.dp)
        } else {
            RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp, bottomStart = 6.dp, bottomEnd = 20.dp)
        }
        Box(
            modifier = Modifier
                .widthIn(max = 300.dp)
                .clip(shape)
                .then(
                    if (isUser) {
                        Modifier.background(Brush.linearGradient(listOf(colors.goldFrom, colors.goldTo)))
                    } else {
                        Modifier
                            .background(colors.surface2)
                            .border(1.dp, colors.borderSubtle, shape)
                    },
                )
                .padding(horizontal = 16.dp, vertical = 11.dp),
        ) {
            Text(
                text = renderPlain(message.content),
                style = MaterialTheme.typography.bodyMedium,
                color = if (isUser) colors.goldOn else colors.textPrimary,
                fontWeight = if (isUser) FontWeight.Medium else FontWeight.Normal,
            )
        }
        if (isUser) {
            Spacer(modifier = Modifier.width(8.dp))
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(colors.surface3),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.Person, contentDescription = null, tint = colors.textSecondary, modifier = Modifier.size(16.dp))
            }
        }
    }
}

/** Ответы модели иногда несут лёгкий `**жирный**` markdown — в чат-пузыре звёздочки просто снимаются. */
private fun renderPlain(content: String): String = content.replace("**", "")

@Composable
private fun TypingRow() {
    val colors = DvTheme.colors
    Row(verticalAlignment = Alignment.CenterVertically) {
        BotChip(size = 32.dp, iconSize = 16.dp)
        Box(
            modifier = Modifier
                .padding(start = 8.dp)
                .clip(RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp, bottomStart = 6.dp, bottomEnd = 20.dp))
                .background(colors.surface2)
                .padding(horizontal = 16.dp, vertical = 14.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                repeat(3) { i ->
                    val transition = rememberInfiniteTransition(label = "dot-$i")
                    val alpha by transition.animateFloat(
                        initialValue = 0.25f,
                        targetValue = 0.9f,
                        animationSpec = infiniteRepeatable(
                            tween(700, delayMillis = i * 150),
                            RepeatMode.Reverse,
                        ),
                        label = "dot-alpha-$i",
                    )
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .clip(CircleShape)
                            .background(colors.gold.copy(alpha = alpha)),
                    )
                }
            }
        }
    }
}

@Composable
private fun AlertStrip(alerts: List<AiAlert>, onTap: (AiAlert) -> Unit, onDismiss: (AiAlert) -> Unit) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(alerts.take(6), key = { it.text + it.priority }) { alert ->
            AlertChip(alert, onTap = { onTap(alert) }, onDismiss = { onDismiss(alert) })
        }
    }
}

@Composable
private fun AlertChip(alert: AiAlert, onTap: () -> Unit, onDismiss: () -> Unit) {
    val colors = DvTheme.colors
    val accent = if (alert.priority >= 8) colors.error else if (alert.priority >= 5) colors.warning else colors.gold
    Surface(
        color = accent.copy(alpha = 0.1f),
        shape = RoundedCornerShape(14.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, accent.copy(alpha = 0.25f)),
        onClick = onTap,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(start = 12.dp, end = 4.dp, top = 6.dp, bottom = 6.dp)) {
            Text(
                text = alert.text.ifBlank { alert.message },
                style = MaterialTheme.typography.labelMedium,
                color = accent,
                modifier = Modifier.widthIn(max = 220.dp),
            )
            IconButton(onClick = onDismiss, modifier = Modifier.size(24.dp).padding(start = 4.dp)) {
                Icon(Icons.Filled.Close, contentDescription = "Скрыть", tint = accent.copy(alpha = 0.7f), modifier = Modifier.size(14.dp))
            }
        }
    }
}

@Composable
private fun ActionRow(actions: List<AiAction>, onTap: (AiAction) -> Unit) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(actions) { action ->
            GoldPillChip(label = action.label.ifBlank { action.type }, onClick = { onTap(action) })
        }
    }
}

@Composable
private fun SuggestionRow(suggestions: List<String>, onTap: (String) -> Unit) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(suggestions.take(6)) { suggestion ->
            Surface(
                color = DvTheme.colors.surface2,
                shape = RoundedCornerShape(50),
                border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
                onClick = { onTap(suggestion) },
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                ) {
                    Icon(
                        Icons.Filled.AutoAwesome,
                        contentDescription = null,
                        tint = DvTheme.colors.textMuted,
                        modifier = Modifier.size(12.dp),
                    )
                    Text(
                        text = suggestion,
                        style = MaterialTheme.typography.labelMedium,
                        color = DvTheme.colors.textSecondary,
                        modifier = Modifier.padding(start = 6.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun GoldPillChip(label: String, onClick: () -> Unit) {
    val colors = DvTheme.colors
    Surface(
        color = colors.gold.copy(alpha = 0.1f),
        shape = RoundedCornerShape(12.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, colors.gold.copy(alpha = 0.25f)),
        onClick = onClick,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
        ) {
            Icon(Icons.Filled.Bolt, contentDescription = null, tint = colors.gold, modifier = Modifier.size(12.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Medium,
                color = colors.gold,
                modifier = Modifier.padding(start = 6.dp),
            )
        }
    }
}

@Composable
private fun Composer(
    value: String,
    onChange: (String) -> Unit,
    onSend: () -> Unit,
    sending: Boolean,
    isGuest: Boolean,
) {
    val colors = DvTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .imePadding()
            .navigationBarsPadding()
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = onChange,
            modifier = Modifier.weight(1f),
            // Перенос `ai.guest_placeholder`/`ai.auth_placeholder`.
            placeholder = {
                Text(
                    if (isGuest) {
                        "Спросите о DentVision, демо, Academy или маркетплейсе…"
                    } else {
                        "Спросите: что важно сегодня, покажи выручку, проверь долги…"
                    },
                )
            },
            maxLines = 4,
            shape = RoundedCornerShape(20.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = colors.surface1,
                unfocusedContainerColor = colors.surface1,
                focusedBorderColor = colors.gold.copy(alpha = 0.5f),
                unfocusedBorderColor = colors.borderSubtle,
            ),
        )
        val canSend = value.isNotBlank() && !sending
        val sendBrush = if (canSend) {
            Brush.linearGradient(listOf(colors.goldFrom, colors.goldTo))
        } else {
            Brush.linearGradient(listOf(colors.surface3, colors.surface3))
        }
        Box(
            modifier = Modifier
                .padding(start = 8.dp, bottom = 4.dp)
                .size(40.dp)
                .clip(CircleShape)
                .background(sendBrush),
            contentAlignment = Alignment.Center,
        ) {
            IconButton(onClick = onSend, enabled = canSend) {
                if (sending) {
                    CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.size(16.dp), color = colors.goldOn)
                } else {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowForward,
                        contentDescription = "Отправить",
                        tint = if (canSend) colors.goldOn else colors.textGhost,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }
        }
    }
}
