package kz.dentvision.crm.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider

/**
 * Динамический цвет Material You намеренно выключен: у платформы есть свой
 * фирменный цвет, и обои пользователя его перекрашивать не должны.
 */
private fun darkScheme() = darkColorScheme(
    primary = DarkGold,
    onPrimary = DarkGoldOn,
    primaryContainer = DarkGoldDim,
    onPrimaryContainer = DarkTextPrimary,
    secondary = DarkGoldLight,
    onSecondary = DarkGoldOn,
    background = DarkSurface0,
    onBackground = DarkTextPrimary,
    surface = DarkSurface1,
    onSurface = DarkTextPrimary,
    surfaceVariant = DarkSurface2,
    onSurfaceVariant = DarkTextSecondary,
    surfaceContainer = DarkSurface2,
    surfaceContainerHigh = DarkSurface3,
    surfaceContainerHighest = DarkSurface4,
    outline = DarkBorder,
    outlineVariant = DarkBorderSubtle,
    error = DarkError,
    onError = DarkTextPrimary,
    scrim = DarkOverlay,
)

private fun lightScheme() = lightColorScheme(
    primary = LightGold,
    onPrimary = LightGoldOn,
    primaryContainer = LightGoldLight,
    onPrimaryContainer = LightTextPrimary,
    secondary = LightGoldDim,
    onSecondary = LightGoldOn,
    background = LightSurface0,
    onBackground = LightTextPrimary,
    surface = LightSurface1,
    onSurface = LightTextPrimary,
    surfaceVariant = LightSurface2,
    onSurfaceVariant = LightTextSecondary,
    surfaceContainer = LightSurface2,
    surfaceContainerHigh = LightSurface3,
    surfaceContainerHighest = LightSurface4,
    outline = LightBorder,
    outlineVariant = LightBorderSubtle,
    error = LightError,
    onError = LightGoldOn,
    scrim = LightOverlay,
)

@Composable
fun DentVisionTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val dv = if (darkTheme) DarkDvColors else LightDvColors
    CompositionLocalProvider(LocalDvColors provides dv) {
        MaterialTheme(
            colorScheme = if (darkTheme) darkScheme() else lightScheme(),
            typography = DvTypography,
            shapes = DvShapes,
            content = content,
        )
    }
}

/** Короткий доступ к токенам, которых нет в Material: `DvTheme.colors.textMuted`. */
object DvTheme {
    val colors: DvColors
        @Composable get() = LocalDvColors.current
}
