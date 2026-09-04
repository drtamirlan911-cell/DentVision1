package kz.dentvision.crm.ui.theme

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Кнопки веб-репозитория (`src/components/ui/ds/Button.tsx`): `rounded-lg`
 * (8dp), не стадион, которым Material3 рисует кнопку по умолчанию
 * (`ButtonDefaults.shape` = `shapes.full`), и первичная — золотой градиент
 * (`from-dv-gold-from to-dv-gold-to`), а не плоская заливка. Переопределить
 * форму кнопки глобально через `MaterialTheme.shapes` нельзя — M3 всегда
 * читает именно `full` для кнопок, поэтому форма и градиент задаются здесь,
 * на самом компоненте, а не в теме.
 */
private val DvButtonShape = RoundedCornerShape(8.dp)

/**
 * `whileTap={{ scale: 0.97 }}` с вебовской `Button.tsx:140-151` — там это
 * настроено один раз в общем компоненте и работает на каждой кнопке
 * приложения; здесь так же: и `DvPrimaryButton`, и `DvOutlineButton` — общие
 * компоненты, поэтому эффект нажатия достаточно завести один раз тут, а не
 * на каждом экране отдельно (найдено при аудите: раньше ни у одной кнопки
 * не было отклика на нажатие, только стоковый ripple).
 */
@Composable
private fun rememberPressScale(interactionSource: MutableInteractionSource): Float {
    val pressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(targetValue = if (pressed) 0.97f else 1f, label = "dvButtonPressScale")
    return scale
}

@Composable
fun DvPrimaryButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit,
) {
    val colors = DvTheme.colors
    val interactionSource = remember { MutableInteractionSource() }
    val scale = rememberPressScale(interactionSource)
    val background = if (enabled) {
        Modifier.background(
            brush = Brush.horizontalGradient(listOf(colors.goldFrom, colors.goldTo)),
            shape = DvButtonShape,
        )
    } else {
        Modifier.background(color = colors.surface3, shape = DvButtonShape)
    }
    Button(
        onClick = onClick,
        modifier = modifier.scale(scale).then(background),
        enabled = enabled,
        shape = DvButtonShape,
        interactionSource = interactionSource,
        colors = ButtonDefaults.buttonColors(
            containerColor = Color.Transparent,
            contentColor = colors.goldOn,
            disabledContainerColor = Color.Transparent,
            disabledContentColor = colors.textGhost,
        ),
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp, disabledElevation = 0.dp),
        content = content,
    )
}

/** `outline`-вариант: рамка и золотой текст, без заливки — вторичное действие рядом с первичным. */
@Composable
fun DvOutlineButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit,
) {
    val colors = DvTheme.colors
    val interactionSource = remember { MutableInteractionSource() }
    val scale = rememberPressScale(interactionSource)
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.scale(scale),
        enabled = enabled,
        shape = DvButtonShape,
        interactionSource = interactionSource,
        border = BorderStroke(1.dp, if (enabled) colors.gold.copy(alpha = 0.5f) else colors.borderSubtle),
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = colors.gold,
            disabledContentColor = colors.textGhost,
        ),
        content = content,
    )
}
