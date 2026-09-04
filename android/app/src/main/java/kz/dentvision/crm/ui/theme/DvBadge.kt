package kz.dentvision.crm.ui.theme

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Один-в-один с `variantStyles` в `src/components/ui/ds/Badge.tsx`. */
enum class DvBadgeVariant { DEFAULT, SUCCESS, WARNING, ERROR, INFO, GOLD }

enum class DvBadgeSize { XS, SM, MD }

/**
 * Пилюля-бейдж — перенос `<Badge>` из `src/components/ui/ds/Badge.tsx`, а не
 * повод для очередной самописной версии на каждом экране: раньше `Tag()` в
 * `JobsScreen.kt` был простым цветным текстом без фона и рамки вовсе, а
 * `GoldPillChip()` в `IntelligenceScreen.kt` — независимой реализацией с
 * другими радиусами/паддингами. Одна и та же заливка 10%/рамка 20% для всех
 * мест, как на вебе.
 */
@Composable
fun DvBadge(
    text: String,
    modifier: Modifier = Modifier,
    variant: DvBadgeVariant = DvBadgeVariant.DEFAULT,
    size: DvBadgeSize = DvBadgeSize.SM,
    dot: Boolean = false,
) {
    val colors = DvTheme.colors
    val tone = when (variant) {
        DvBadgeVariant.SUCCESS -> colors.success
        DvBadgeVariant.WARNING -> colors.warning
        DvBadgeVariant.ERROR -> colors.error
        DvBadgeVariant.INFO -> colors.info
        DvBadgeVariant.GOLD -> colors.gold
        DvBadgeVariant.DEFAULT -> colors.textSecondary
    }
    val (fontSize, padding) = when (size) {
        DvBadgeSize.XS -> 10.sp to PaddingValues(horizontal = 6.dp, vertical = 2.dp)
        DvBadgeSize.SM -> 11.sp to PaddingValues(horizontal = 8.dp, vertical = 3.dp)
        DvBadgeSize.MD -> 12.sp to PaddingValues(horizontal = 10.dp, vertical = 4.dp)
    }
    Row(
        modifier = modifier
            .background(tone.copy(alpha = 0.10f), CircleShape)
            .border(BorderStroke(1.dp, tone.copy(alpha = 0.20f)), CircleShape)
            .padding(padding),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (dot) {
            Box(modifier = Modifier.size(6.dp).background(tone, CircleShape))
            Spacer(modifier = Modifier.size(4.dp))
        }
        Text(
            text = text,
            style = TextStyle(fontSize = fontSize, fontWeight = FontWeight.Medium),
            color = tone,
        )
    }
}
