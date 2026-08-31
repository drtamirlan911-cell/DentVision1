package kz.dentvision.crm.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/**
 * Ролевая модель цвета из веба целиком: Material 3 знает про primary и surface,
 * но не про «surface-2», «text-muted» и «gold-on». Эти роли есть в CSS и ими
 * пользуется каждый экран, поэтому они переносятся как есть, а не сплющиваются
 * в ближайшие роли Material.
 */
@Immutable
data class DvColors(
    val gold: Color,
    val goldLight: Color,
    val goldDim: Color,
    val goldOn: Color,
    val success: Color,
    val error: Color,
    val warning: Color,
    val info: Color,
    val surface0: Color,
    val surface1: Color,
    val surface2: Color,
    val surface3: Color,
    val surface4: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val textGhost: Color,
    val border: Color,
    val borderSubtle: Color,
    val overlay: Color,
    val isLight: Boolean,
)

val DarkDvColors = DvColors(
    gold = DarkGold,
    goldLight = DarkGoldLight,
    goldDim = DarkGoldDim,
    goldOn = DarkGoldOn,
    success = DarkSuccess,
    error = DarkError,
    warning = DarkWarning,
    info = DarkInfo,
    surface0 = DarkSurface0,
    surface1 = DarkSurface1,
    surface2 = DarkSurface2,
    surface3 = DarkSurface3,
    surface4 = DarkSurface4,
    textPrimary = DarkTextPrimary,
    textSecondary = DarkTextSecondary,
    textMuted = DarkTextMuted,
    textGhost = DarkTextGhost,
    border = DarkBorder,
    borderSubtle = DarkBorderSubtle,
    overlay = DarkOverlay,
    isLight = false,
)

val LightDvColors = DvColors(
    gold = LightGold,
    goldLight = LightGoldLight,
    goldDim = LightGoldDim,
    goldOn = LightGoldOn,
    success = LightSuccess,
    error = LightError,
    warning = LightWarning,
    info = LightInfo,
    surface0 = LightSurface0,
    surface1 = LightSurface1,
    surface2 = LightSurface2,
    surface3 = LightSurface3,
    surface4 = LightSurface4,
    textPrimary = LightTextPrimary,
    textSecondary = LightTextSecondary,
    textMuted = LightTextMuted,
    textGhost = LightTextGhost,
    border = LightBorder,
    borderSubtle = LightBorderSubtle,
    overlay = LightOverlay,
    isLight = true,
)

val LocalDvColors = staticCompositionLocalOf { DarkDvColors }
