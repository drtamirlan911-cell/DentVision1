package kz.dentvision.crm.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.navigation.CRM_PAGES
import kz.dentvision.crm.navigation.canAccessPage
import kz.dentvision.crm.ui.common.DvLogo
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Кабинет клиники — разделы CRM. Дом приложения теперь не здесь: им стал
 * Intelligence (`ui/intelligence/IntelligenceScreen.kt`), как на вебе первый
 * маршрут — `/`, а раздел `crm` открывается из него отдельным пунктом. Этот экран
 * остаётся тем, чем был до того момента: честным перечнем того, к чему у
 * вошедшего есть доступ и что из этого уже открывается на телефоне.
 *
 * Здесь нет ни одной придуманной цифры. Всё на экране — это то, что сервер
 * прислал при входе: клиника, роль, список страниц.
 */
@Composable
fun WorkspaceScreen(
    session: Session,
    implemented: Set<String>,
    modifier: Modifier = Modifier,
) {
    val allowed = CRM_PAGES.filter { canAccessPage(session.pages, it.id) }
    val ready = allowed.filter { it.id in implemented }
    val notYet = allowed.filterNot { it.id in implemented }

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
}

@Composable
private fun SectionCard(title: String, items: List<String>, note: String? = null) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
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
