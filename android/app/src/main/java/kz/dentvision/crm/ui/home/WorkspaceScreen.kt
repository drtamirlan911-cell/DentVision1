package kz.dentvision.crm.ui.home

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kz.dentvision.crm.data.model.AiAlert
import kz.dentvision.crm.data.model.AiBriefing
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.navigation.CRM_PAGES
import kz.dentvision.crm.navigation.canAccessPage
import kz.dentvision.crm.navigation.resolveAssistantPath
import kz.dentvision.crm.ui.common.DvLogo
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Дом кабинета. Раньше это был список разделов — теперь список остаётся, но
 * не он первый: первым идёт то, что ИИ уже знает сам — брифинг по роли и
 * проактивные тревоги. Кабинеты становятся поверхностями, на которые ИИ
 * указывает, а не плоским меню, которое открывают в первую очередь.
 *
 * Здесь нет ни одной придуманной цифры. Всё на экране — это то, что сервер
 * прислал: клиника, роль, список страниц, брифинг, тревоги.
 */
@Composable
fun WorkspaceScreen(
    session: Session,
    implemented: Set<String>,
    onNavigate: (String) -> Unit,
    modifier: Modifier = Modifier,
    homeViewModel: HomeViewModel = viewModel(),
) {
    val allowed = CRM_PAGES.filter { canAccessPage(session.pages, it.id) }
    val ready = allowed.filter { it.id in implemented }
    val notYet = allowed.filterNot { it.id in implemented }
    val state by homeViewModel.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.pendingNavigatePath) {
        val path = state.pendingNavigatePath ?: return@LaunchedEffect
        resolveAssistantPath(path, implemented)?.let(onNavigate)
        homeViewModel.consumeNavigate()
    }
    LaunchedEffect(state.message) {
        val message = state.message ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(message)
        homeViewModel.consumeMessage()
    }

    Box(modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        DvLogo(size = 40.dp, modifier = Modifier.padding(end = 12.dp))
                        Text(
                            text = session.clinic?.name ?: "Клиника не выбрана",
                            style = MaterialTheme.typography.titleLarge,
                            color = DvTheme.colors.textPrimary,
                        )
                    }
                    Text(
                        text = session.user.name.ifBlank { session.user.login },
                        style = MaterialTheme.typography.bodyMedium,
                        color = DvTheme.colors.textSecondary,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                    session.effectiveRole?.let { role ->
                        Text(
                            text = "Роль: $role",
                            style = MaterialTheme.typography.bodySmall,
                            color = DvTheme.colors.textMuted,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                    if (session.capabilities?.readOnly == true) {
                        Text(
                            text = "Доступ только на чтение",
                            style = MaterialTheme.typography.labelMedium,
                            color = DvTheme.colors.warning,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                    }
                }
            }

            AiBriefingCard(state.briefing)
            AiAlertsCard(state.alerts, onAction = homeViewModel::performAction)

            if (ready.isNotEmpty()) {
                SectionCard(title = "Доступно на телефоне", items = ready.map { it.label })
            }
            if (notYet.isNotEmpty()) {
                SectionCard(
                    title = "Пока только в браузере",
                    items = notYet.map { it.label },
                    note = "Эти разделы открыты вашей роли, но их экран на Android ещё не построен.",
                )
            }
            if (allowed.isEmpty()) {
                Text(
                    text = "Для вашей роли не открыт ни один раздел кабинета клиники.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = DvTheme.colors.textMuted,
                )
            }
        }
        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier.align(Alignment.BottomCenter).padding(16.dp),
        ) { data -> Snackbar(snackbarData = data, containerColor = DvTheme.colors.surface3) }
    }
}

/** Брифинг по роли (`GET /api/ai/briefing`) — то, чем ИИ встречает вход. */
@Composable
private fun AiBriefingCard(state: UiState<AiBriefing>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Ассистент",
                style = MaterialTheme.typography.labelLarge,
                color = DvTheme.colors.gold,
            )
            HorizontalDivider(color = DvTheme.colors.borderSubtle, modifier = Modifier.padding(vertical = 10.dp))
            when (state) {
                is UiState.Loading -> LoadingSkeleton(rows = 3)
                is UiState.Error -> Text(
                    text = state.message,
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.textMuted,
                )
                is UiState.Data -> {
                    val briefing = state.value
                    val text = briefing.message.ifBlank { briefing.reply }
                    Text(
                        text = text.replace("**", ""),
                        style = MaterialTheme.typography.bodyMedium,
                        color = DvTheme.colors.textPrimary,
                    )
                    val stats = briefingStats(briefing)
                    if (stats.isNotEmpty()) {
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.padding(top = 12.dp),
                        ) {
                            items(stats) { (label, value) -> StatChip(label, value) }
                        }
                    }
                }
            }
        }
    }
}

private fun briefingStats(briefing: AiBriefing): List<Pair<String, String>> {
    val payload = briefing.action?.payload ?: return emptyList()
    if (payload.mode == "guest") return emptyList()
    val stats = mutableListOf<Pair<String, String>>()
    if (payload.apptsToday > 0) stats += "Записей сегодня" to payload.apptsToday.toString()
    if (payload.upcomingSoon > 0) stats += "Ближайшие 2 часа" to payload.upcomingSoon.toString()
    if (payload.pendingConfirm > 0) stats += "Не подтверждено" to payload.pendingConfirm.toString()
    if (payload.debtors > 0) stats += "Должников" to payload.debtors.toString()
    if (payload.lowStock > 0) stats += "Ниже минимума на складе" to payload.lowStock.toString()
    if (payload.unreadNotifs > 0) stats += "Уведомлений" to payload.unreadNotifs.toString()
    if (payload.courses > 0) stats += "Курсов в процессе" to payload.courses.toString()
    return stats
}

@Composable
private fun StatChip(label: String, value: String) {
    Surface(
        color = DvTheme.colors.surface2,
        shape = MaterialTheme.shapes.small,
        modifier = Modifier.wrapContentWidth(),
    ) {
        Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
            Text(value, style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary)
            Text(label, style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
        }
    }
}

/** Проактивные тревоги (`GET /api/ai/proactive`) — то, что ИИ сам счёл важным, без вопроса. */
@Composable
private fun AiAlertsCard(state: UiState<List<AiAlert>>, onAction: (String) -> Unit) {
    when (state) {
        is UiState.Loading -> Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        ) { LoadingSkeleton(rows = 2) }
        is UiState.Error -> Unit // Тревоги не критичны для дома: молча пропускаем, брифинг уже показал ошибку выше при её наличии.
        is UiState.Data -> {
            val alerts = state.value
            if (alerts.isEmpty()) return
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Требует внимания",
                        style = MaterialTheme.typography.labelLarge,
                        color = DvTheme.colors.gold,
                    )
                    HorizontalDivider(color = DvTheme.colors.borderSubtle, modifier = Modifier.padding(vertical = 10.dp))
                    alerts.take(6).forEachIndexed { index, alert ->
                        if (index > 0) HorizontalDivider(color = DvTheme.colors.borderSubtle, modifier = Modifier.padding(vertical = 6.dp))
                        AlertRow(alert, onAction)
                    }
                }
            }
        }
    }
}

@Composable
private fun AlertRow(alert: AiAlert, onAction: (String) -> Unit) {
    val actionType = alert.action?.type
    val color = when {
        alert.priority >= 8 -> DvTheme.colors.error
        alert.priority >= 5 -> DvTheme.colors.warning
        else -> DvTheme.colors.textSecondary
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .then(
                if (actionType != null) {
                    Modifier.clickable { onAction(actionType) }
                } else {
                    Modifier
                },
            )
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = alert.text.ifBlank { alert.message },
            style = MaterialTheme.typography.bodyMedium,
            color = color,
            modifier = Modifier.weight(1f).padding(end = 8.dp),
        )
        if (actionType != null) {
            Text(
                text = "Открыть",
                style = MaterialTheme.typography.labelMedium,
                color = DvTheme.colors.gold,
            )
        }
    }
}

@Composable
private fun SectionCard(title: String, items: List<String>, note: String? = null) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.labelLarge,
                color = DvTheme.colors.gold,
            )
            if (note != null) {
                Text(
                    text = note,
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.textMuted,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            HorizontalDivider(
                color = DvTheme.colors.borderSubtle,
                modifier = Modifier.padding(vertical = 10.dp),
            )
            items.forEach { item ->
                Text(
                    text = item,
                    style = MaterialTheme.typography.bodyMedium,
                    color = DvTheme.colors.textSecondary,
                    modifier = Modifier.padding(vertical = 3.dp),
                )
            }
        }
    }
}
