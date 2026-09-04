package kz.dentvision.crm.ui.diagnostics

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import kz.dentvision.crm.ui.theme.DvOutlineButton
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Перенос `ToothSelector.tsx` — сетка FDI-номеров, без стороннего одонтограф-
 * компонента. Выход — плоский список номеров, без группировки по «региону»:
 * кнопки быстрого выбора (`все/верх/низ/лево/право/сброс`) — это массовые
 * `onChange`, не отдельная сущность.
 */
private val UPPER_ARCH = listOf(18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28)
private val LOWER_ARCH = listOf(48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38)
private val UPPER_LEFT = (21..28).toList()
private val UPPER_RIGHT = (11..18).toList()
private val LOWER_LEFT = (31..38).toList()
private val LOWER_RIGHT = (41..48).toList()

@Composable
fun ToothSelector(selected: List<Int>, onChange: (List<Int>) -> Unit) {
    Column {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            QuickSelectChip("Верх") { onChange(UPPER_ARCH) }
            QuickSelectChip("Низ") { onChange(LOWER_ARCH) }
            QuickSelectChip("Лево") { onChange(UPPER_LEFT + LOWER_LEFT) }
            QuickSelectChip("Право") { onChange(UPPER_RIGHT + LOWER_RIGHT) }
            QuickSelectChip("Все") { onChange(UPPER_ARCH + LOWER_ARCH) }
            QuickSelectChip("Сброс") { onChange(emptyList()) }
        }

        ToothRow(UPPER_ARCH, selected, onChange, modifier = Modifier.padding(top = 8.dp))
        ToothRow(LOWER_ARCH, selected, onChange, modifier = Modifier.padding(top = 4.dp))

        if (selected.isNotEmpty()) {
            Text(
                text = selected.sorted().joinToString(", ") { "${it / 10}.${it % 10}" },
                style = MaterialTheme.typography.labelSmall,
                color = DvTheme.colors.textMuted,
                modifier = Modifier.padding(top = 6.dp),
            )
        }
    }
}

@Composable
private fun QuickSelectChip(label: String, onClick: () -> Unit) {
    DvOutlineButton(onClick = onClick) {
        Text(label, style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun ToothRow(
    teeth: List<Int>,
    selected: List<Int>,
    onChange: (List<Int>) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        teeth.forEach { tooth ->
            val active = tooth in selected
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (active) DvTheme.colors.gold else DvTheme.colors.surface2)
                    .clickable { onChange(if (active) selected - tooth else selected + tooth) },
            ) {
                Text(
                    text = tooth.toString(),
                    style = MaterialTheme.typography.labelSmall,
                    color = if (active) DvTheme.colors.goldOn else DvTheme.colors.textSecondary,
                )
            }
        }
    }
}
