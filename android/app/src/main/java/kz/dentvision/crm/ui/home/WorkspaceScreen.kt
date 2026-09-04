package kz.dentvision.crm.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.navigation.CRM_PAGES
import kz.dentvision.crm.navigation.CrmPage
import kz.dentvision.crm.navigation.CrmSection
import kz.dentvision.crm.navigation.canAccessPage
import kz.dentvision.crm.ui.common.DvLogo
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Кабинет клиники — разделы CRM. Дом приложения теперь не здесь: им стал
 * Intelligence (`ui/intelligence/IntelligenceScreen.kt`), как на вебе первый
 * маршрут — `/`, а раздел `crm` открывается из него отдельным пунктом.
 *
 * Группировка и иконки — тот же `CRM_SUBNAV`/`CrmSection`, что в
 * `src/layouts/Sidebar.tsx`: разделы уже построены на Android идут
 * кликабельными строками по секциям («Пациенты», «Финансы и склад», …),
 * как в веб-сайдбаре, а не плоским нередактируемым текстом.
 */
@Composable
fun WorkspaceScreen(
    session: Session,
    implemented: Set<String>,
    onOpenPage: (CrmPage) -> Unit,
    modifier: Modifier = Modifier,
) {
    val allowed = CRM_PAGES.filter { canAccessPage(session.pages, it.id) }
    val ready = allowed.filter { it.id in implemented }
    val notYet = allowed.filterNot { it.id in implemented }
    val readyBySection = CrmSection.entries.mapNotNull { section ->
        val items = ready.filter { it.section == section }
        if (items.isEmpty()) null else section to items
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
            border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
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

        readyBySection.forEach { (section, items) ->
            PageSectionCard(title = section.title, pages = items, onOpenPage = onOpenPage)
        }
        if (notYet.isNotEmpty()) {
            NotYetSectionCard(pages = notYet)
        }
        if (allowed.isEmpty()) {
            Text(
                text = "Для вашей роли не открыт ни один раздел кабинета клиники.",
                style = MaterialTheme.typography.bodyMedium,
                color = DvTheme.colors.textMuted,
            )
        }
    }
}

@Composable
private fun PageSectionCard(title: String, pages: List<CrmPage>, onOpenPage: (CrmPage) -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(vertical = 8.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.labelLarge,
                color = DvTheme.colors.gold,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )
            pages.forEach { page ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onOpenPage(page) }
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(DvTheme.colors.gold.copy(alpha = 0.14f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = page.icon,
                            contentDescription = null,
                            tint = DvTheme.colors.gold,
                            modifier = Modifier.size(15.dp),
                        )
                    }
                    Text(
                        text = page.label,
                        style = MaterialTheme.typography.bodyMedium,
                        color = DvTheme.colors.textPrimary,
                        modifier = Modifier.weight(1f).padding(start = 12.dp),
                    )
                    Icon(
                        imageVector = Icons.Filled.ChevronRight,
                        contentDescription = null,
                        tint = DvTheme.colors.textGhost,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun NotYetSectionCard(pages: List<CrmPage>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Пока только в браузере",
                style = MaterialTheme.typography.labelLarge,
                color = DvTheme.colors.textMuted,
            )
            Text(
                text = "Эти разделы открыты вашей роли, но их экран на Android ещё не построен.",
                style = MaterialTheme.typography.bodySmall,
                color = DvTheme.colors.textMuted,
                modifier = Modifier.padding(top = 4.dp),
            )
            HorizontalDivider(
                color = DvTheme.colors.borderSubtle,
                modifier = Modifier.padding(vertical = 10.dp),
            )
            pages.forEach { page ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = page.icon,
                        contentDescription = null,
                        tint = DvTheme.colors.textGhost,
                        modifier = Modifier.size(15.dp),
                    )
                    Text(
                        text = page.label,
                        style = MaterialTheme.typography.bodyMedium,
                        color = DvTheme.colors.textSecondary,
                        modifier = Modifier.padding(start = 10.dp),
                    )
                }
            }
        }
    }
}
