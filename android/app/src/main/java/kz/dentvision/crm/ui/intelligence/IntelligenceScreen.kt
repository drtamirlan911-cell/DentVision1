package kz.dentvision.crm.ui.intelligence

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.delay
import kz.dentvision.crm.data.model.AiAction
import kz.dentvision.crm.data.model.AiAlert
import kz.dentvision.crm.data.model.AiMessage
import kz.dentvision.crm.data.model.AiSkill
import kz.dentvision.crm.data.session.PendingAiQuery
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.theme.DvConfirmDialog
import kz.dentvision.crm.ui.theme.DvConfirmVariant
import kz.dentvision.crm.ui.theme.DvSpacing
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
    val pendingQuery by PendingAiQuery.value.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.ensureLoaded() }
    LaunchedEffect(state.messages.size) {
        if (state.messages.isNotEmpty()) listState.animateScrollToItem(state.messages.size - 1)
    }
    LaunchedEffect(state.pendingNavigatePath) {
        val path = state.pendingNavigatePath ?: return@LaunchedEffect
        onNavigate(path)
        viewModel.consumeNavigate()
    }
    // Другой экран (например, «Спросить AI» на Вакансиях) поставил вопрос
    // и привёл сюда — отправляем его сразу, тем же жестом, что веб делает
    // в `AIWorkspaceIndex.tsx:274-281` (`handleSend(q)` по приходу).
    LaunchedEffect(pendingQuery) {
        val query = pendingQuery ?: return@LaunchedEffect
        PendingAiQuery.consume()
        viewModel.send(query)
    }
    // Сообщение об ошибке раньше не гасло само — оставалось на экране даже
    // после следующей успешной отправки. Не блокирующая ошибка, поэтому
    // не модалка, а как временная плашка, тем же приёмом, что и обычный
    // toast на вебе.
    LaunchedEffect(state.error) {
        if (state.error == null) return@LaunchedEffect
        delay(4000)
        viewModel.consumeError()
    }

    Column(modifier = modifier.fillMaxSize().background(DvTheme.colors.surface0)) {
        if (!state.isGuest && state.messages.isNotEmpty()) {
            Row(modifier = Modifier.fillMaxWidth().padding(horizontal = DvSpacing.sm, vertical = DvSpacing.xs), horizontalArrangement = Arrangement.End) {
                IconButton(onClick = viewModel::startNewThread) {
                    Icon(Icons.Filled.Add, contentDescription = "Новый диалог", tint = DvTheme.colors.textSecondary)
                }
            }
        }
        Box(modifier = Modifier.weight(1f)) {
            when {
                state.loadingThread -> LoadingSkeleton(rows = 4, contentPadding = PaddingValues(DvSpacing.xl))
                state.messages.isEmpty() -> Column(
                    modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
                ) {
                    EmptyHero(isGuest = state.isGuest, greeting = state.greeting)
                    if (state.skills.isNotEmpty()) {
                        SkillGrid(skills = state.skills, onPick = { viewModel.send(it.prompt) })
                        Spacer(modifier = Modifier.padding(bottom = DvSpacing.xxl))
                    }
                }
                else -> LazyColumn(
                    state = listState,
                    contentPadding = PaddingValues(DvSpacing.lg),
                    verticalArrangement = Arrangement.spacedBy(DvSpacing.md),
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
                    modifier = Modifier.padding(horizontal = DvSpacing.xl, vertical = DvSpacing.xs),
                )
            }
        }
        state.error?.let { message ->
            Text(
                text = message,
                style = MaterialTheme.typography.bodySmall,
                color = DvTheme.colors.error,
                modifier = Modifier.padding(horizontal = DvSpacing.xl, vertical = DvSpacing.xs),
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
        DvConfirmDialog(
            title = "Выполнить действие?",
            message = buildString {
                append(action.label.ifBlank { humanAction(action.type) })
                val params = action.params?.entries?.take(4).orEmpty()
                if (params.isNotEmpty()) {
                    append("\n")
                    params.forEach { (key, value) ->
                        append("\n• $key: ${value.toString().trim('"')}")
                    }
                }
            },
            confirmLabel = "Выполнить",
            variant = DvConfirmVariant.WARNING,
            onConfirm = { viewModel.confirmPending(true) },
            onDismiss = { viewModel.confirmPending(false) },
        )
    }
}

/**
 * Машинное имя инструмента — в человеческую фразу, когда сервер не прислал
 * `label`. Подтверждать «createInvoice» человек не может: непонятно, что
 * произойдёт и на какую сумму.
 *
 * Список повторяет мутирующие инструменты из `os/tools.ts` (`mutating: true`)
 * — только они и доходят до подтверждения. Незнакомое имя показываем как
 * есть: лучше честное «выполнить „foo“», чем выдуманный перевод.
 */
private fun humanAction(type: String): String = when (type) {
    "createAppointment" -> "Записать пациента на приём"
    "updateAppointmentStatus" -> "Изменить статус приёма"
    "cancelAppointment" -> "Отменить приём"
    "rescheduleAppointment" -> "Перенести приём"
    "createTreatmentPlan" -> "Создать план лечения"
    "createInvoice" -> "Выставить счёт"
    "createDiagnosticReferral" -> "Оформить направление на диагностику"
    "createLabOrder" -> "Создать заказ в лабораторию"
    "updateLabOrderStatus" -> "Изменить статус заказа лаборатории"
    "applyToothFindings" -> "Внести изменения в зубную формулу"
    else -> "Выполнить «$type»"
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
 * Шапка пустого экрана. Раньше здесь крутилось трёхслойное представление —
 * дышащее свечение, вращающееся кольцо, пульсирующее ядро — и подпись
 * «AI-операционка клиники». Смотреть было на что, но человек всё равно не
 * знал, что спросить, а анимация ничего не сообщала: она шла одинаково и
 * когда всё в порядке, и когда ассистенту нечего предложить.
 *
 * Теперь тут только приветствие и один спокойный знак, а место занимает то,
 * ради чего экран открыли, — список возможностей ниже.
 */
@Composable
private fun EmptyHero(isGuest: Boolean, greeting: String?) {
    val colors = DvTheme.colors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = DvSpacing.xxxl)
            .padding(top = DvSpacing.xxxl, bottom = DvSpacing.xxl),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(56.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(colors.surface2)
                .border(1.dp, colors.borderSubtle, RoundedCornerShape(16.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Filled.AutoAwesome,
                contentDescription = null,
                tint = colors.gold,
                modifier = Modifier.size(24.dp),
            )
        }
        Text(
            text = greeting ?: if (isGuest) "Чем помочь?" else "Чем помочь сегодня?",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = colors.textPrimary,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = DvSpacing.lg),
        )
        Text(
            text = if (isGuest) {
                "Расскажу о платформе, покажу демо и Academy."
            } else {
                "Выберите, с чего начать — или просто спросите."
            },
            style = MaterialTheme.typography.bodyMedium,
            color = colors.textMuted,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = DvSpacing.sm).widthIn(max = 300.dp),
        )
    }
}

/**
 * Каталог возможностей роли. Не «подсказки модели», а список навыков,
 * которые сервер уже разрешил этому пользователю (`GET /api/ai/skills`) —
 * ровно то, что отличает ассистента-сотрудника от пустого поля ввода: видно,
 * что он умеет, ещё до первого вопроса, и врач с кассиром видят разное.
 *
 * Нажатие отправляет готовую формулировку из `prompt`, чтобы человеку не
 * пришлось угадывать, какими словами просить.
 */
@Composable
private fun SkillGrid(skills: List<AiSkill>, onPick: (AiSkill) -> Unit) {
    val colors = DvTheme.colors
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = DvSpacing.lg),
        verticalArrangement = Arrangement.spacedBy(DvSpacing.sm),
    ) {
        Text(
            text = "Чем могу помочь",
            style = MaterialTheme.typography.labelSmall,
            color = colors.textMuted,
            modifier = Modifier.padding(bottom = DvSpacing.xs),
        )
        skills.take(6).forEach { skill ->
            Surface(
                color = colors.surface1,
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, colors.borderSubtle),
                onClick = { onPick(skill) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    modifier = Modifier.padding(DvSpacing.lg),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = skill.title,
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.textPrimary,
                        modifier = Modifier.weight(1f),
                    )
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowForward,
                        contentDescription = null,
                        tint = colors.textGhost,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }
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
            RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomStart = 16.dp, bottomEnd = 4.dp)
        } else {
            RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomStart = 4.dp, bottomEnd = 16.dp)
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
                .padding(horizontal = DvSpacing.lg, vertical = DvSpacing.md),
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
                    .clip(RoundedCornerShape(12.dp))
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
                .padding(start = DvSpacing.sm)
                .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomStart = 4.dp, bottomEnd = 16.dp))
                .background(colors.surface2)
                .padding(horizontal = DvSpacing.lg, vertical = DvSpacing.md),
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
        // Чип — пилюля (П4). Цвет здесь несёт смысл (приоритет тревоги),
        // а не украшает, поэтому он остаётся, в отличие от прочего золота.
        shape = RoundedCornerShape(50),
        border = androidx.compose.foundation.BorderStroke(1.dp, accent.copy(alpha = 0.25f)),
        onClick = onTap,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(start = DvSpacing.md, end = DvSpacing.xs, top = DvSpacing.sm, bottom = DvSpacing.sm)) {
            Text(
                text = alert.text.ifBlank { alert.message },
                style = MaterialTheme.typography.labelMedium,
                color = accent,
                modifier = Modifier.widthIn(max = 220.dp),
            )
            IconButton(onClick = onDismiss, modifier = Modifier.size(48.dp).padding(start = 4.dp)) {
                Icon(Icons.Filled.Close, contentDescription = "Скрыть", tint = accent.copy(alpha = 0.7f), modifier = Modifier.size(12.dp))
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
                    modifier = Modifier.padding(horizontal = DvSpacing.md, vertical = DvSpacing.sm),
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
        shape = RoundedCornerShape(50),
        border = androidx.compose.foundation.BorderStroke(1.dp, colors.gold.copy(alpha = 0.25f)),
        onClick = onClick,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = DvSpacing.md, vertical = DvSpacing.sm),
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
            shape = RoundedCornerShape(24.dp),
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
                .padding(start = DvSpacing.sm, bottom = DvSpacing.xs)
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
