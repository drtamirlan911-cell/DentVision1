package kz.dentvision.crm.ui.guest

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Login
import androidx.compose.material.icons.filled.Biotech
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import kz.dentvision.crm.ui.theme.DvOutlineButton
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme

private data class GuideSkill(val name: String, val level: Int)

/** Дословный перенос `GUEST_PLATFORM_TWIN` (`src/components/ai/DigitalTwin.tsx:36-73`) — не придумано заново. */
private val GUIDE_SKILLS = listOf(
    GuideSkill("CRM клиники", 72),
    GuideSkill("Маркетплейс", 68),
    GuideSkill("Academy OS", 65),
    GuideSkill("ИИ-ассистент", 80),
)

private val GUIDE_STEPS = listOf(
    "Открыть демо-клинику и посмотреть CRM",
    "Заглянуть в Academy OS",
    "Зарегистрироваться и подключить клинику",
)

private val GUIDE_TIPS = listOf(
    "Спросите ИИ: «Чем полезен DentVision?»",
    "Откройте демо — расписание и касса вживую",
    "После входа двойник станет профилем вашей роли",
)

/**
 * Гостевая часть `ContextPanel`/`DigitalTwin` с вебе — там это вкладка
 * «Двойник» внутри трёхвкладочной панели (Контекст/Двойник/Оповещения),
 * для гостя подписанная «Гид по платформе». Переносим только её: вкладка
 * «Контекст» для гостя — тоже просто статичная заглушка-приглашение в демо,
 * а «Оповещения» вообще не имеет гостевой ветки в коде веба — строить
 * ради этого все три вкладки (~1150 строк) не соразмерно тому, что
 * реально увидит гость. На мобильном вебе эта панель и так открывается
 * как bottom sheet (`useCompactShell()`), поэтому здесь тот же выбор
 * компонента, что уже используют `JobsScreen`/`CommunityScreen`.
 *
 * Полностью статично, без `GET /api/ai/digital-twin` — на вебе это
 * необязательное обогащение поверх точно такого же статического fallback.
 */
@Composable
fun GuestGuideSheet(onDemo: () -> Unit, onLogin: () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().padding(20.dp)) {
        HeroCard(onDemo = onDemo, onLogin = onLogin)

        Text(
            text = "Возможности",
            style = MaterialTheme.typography.labelLarge,
            color = DvTheme.colors.textPrimary,
            modifier = Modifier.padding(top = 20.dp, bottom = 10.dp),
        )
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            GUIDE_SKILLS.forEach { skill ->
                Column {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(text = skill.name, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textSecondary)
                        Text(text = "${skill.level}%", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
                    }
                    LinearProgressIndicator(
                        progress = { skill.level / 100f },
                        modifier = Modifier.fillMaxWidth().padding(top = 4.dp).clip(RoundedCornerShape(4.dp)),
                        color = DvTheme.colors.gold,
                        trackColor = DvTheme.colors.surface2,
                    )
                }
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth().padding(top = 20.dp),
            colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
            border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Text(text = "С чего начать", style = MaterialTheme.typography.labelLarge, color = DvTheme.colors.textPrimary)
                Column(modifier = Modifier.padding(top = 10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    GUIDE_STEPS.forEachIndexed { index, step ->
                        Row(verticalAlignment = Alignment.Top) {
                            Box(
                                modifier = Modifier
                                    .size(20.dp)
                                    .clip(CircleShape)
                                    .background(DvTheme.colors.gold.copy(alpha = 0.15f)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    text = "${index + 1}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = DvTheme.colors.gold,
                                )
                            }
                            Text(
                                text = step,
                                style = MaterialTheme.typography.bodySmall,
                                color = DvTheme.colors.textSecondary,
                                modifier = Modifier.padding(start = 10.dp),
                            )
                        }
                    }
                }
            }
        }

        Text(
            text = "Подсказки",
            style = MaterialTheme.typography.labelLarge,
            color = DvTheme.colors.textPrimary,
            modifier = Modifier.padding(top = 20.dp, bottom = 10.dp),
        )
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            GUIDE_TIPS.forEach { tip ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
                    border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        text = tip,
                        style = MaterialTheme.typography.bodySmall,
                        color = DvTheme.colors.textSecondary,
                        modifier = Modifier.padding(12.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun HeroCard(onDemo: () -> Unit, onLogin: () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.gold.copy(alpha = 0.25f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(text = "Гид по DentVision", style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary)
            Text(
                text = "Я гид по DentVision: CRM, маркетплейс и Academy. Данные клиники появятся после входа.",
                style = MaterialTheme.typography.bodySmall,
                color = DvTheme.colors.textSecondary,
                modifier = Modifier.padding(top = 6.dp),
            )
            Row(modifier = Modifier.fillMaxWidth().padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                DvPrimaryButton(onClick = onDemo, modifier = Modifier.weight(1f)) {
                    Icon(Icons.Filled.Biotech, contentDescription = null, modifier = Modifier.size(16.dp))
                    Text(text = "Демо", modifier = Modifier.padding(start = 6.dp))
                }
                DvOutlineButton(onClick = onLogin, modifier = Modifier.weight(1f)) {
                    Icon(Icons.AutoMirrored.Filled.Login, contentDescription = null, modifier = Modifier.size(16.dp))
                    Text(text = "Войти", modifier = Modifier.padding(start = 6.dp))
                }
            }
        }
    }
}
