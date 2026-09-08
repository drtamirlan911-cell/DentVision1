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
import androidx.compose.ui.unit.dp

/** Shared Android button treatment: restrained radius, flat brand surface, clear secondary action. */
private val DvButtonShape = RoundedCornerShape(8.dp)

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
    val background = Modifier.background(
        color = if (enabled) colors.gold else colors.surface3,
        shape = DvButtonShape,
    )
    Button(
        onClick = onClick,
        modifier = modifier.scale(scale).then(background),
        enabled = enabled,
        shape = DvButtonShape,
        interactionSource = interactionSource,
        colors = ButtonDefaults.buttonColors(
            containerColor = androidx.compose.ui.graphics.Color.Transparent,
            contentColor = colors.goldOn,
            disabledContainerColor = androidx.compose.ui.graphics.Color.Transparent,
            disabledContentColor = colors.textGhost,
        ),
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp, disabledElevation = 0.dp),
        content = content,
    )
}

/** Secondary action: outline and brand text, no decorative fill. */
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
