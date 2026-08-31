package kz.dentvision.crm.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * Палитра списана один в один с `src/styles/global.css` — те же токены, те же
 * значения, включая светлую тему. Ничего не подбиралось на глаз: у веба и
 * Android один и тот же источник цвета, поэтому расхождение здесь — это дефект,
 * а не вкусовщина.
 *
 * Комментарии к контрасту в CSS объясняют, почему золото инвертируется между
 * темами (на фарфоре шампанское не читается) и почему у заливки есть отдельный
 * цвет текста `goldOn`. Эта же логика перенесена сюда.
 */

// ── Тёмная тема (`:root, html.dark`) ───────────────────────────────────────
val DarkGold = Color(0xFFC9A96E)
val DarkGoldLight = Color(0xFFE2C998)
val DarkGoldDim = Color(0xFF8B6F3E)
val DarkGoldOn = Color(0xFF0B1220)
val DarkSuccess = Color(0xFF27AE60)
val DarkError = Color(0xFFE74C3C)
val DarkWarning = Color(0xFFF39C12)
val DarkInfo = Color(0xFF2980B9)
val DarkSurface0 = Color(0xFF080F1A)
val DarkSurface1 = Color(0xFF0D1B2E)
val DarkSurface2 = Color(0xFF132540)
val DarkSurface3 = Color(0xFF1A2F50)
val DarkSurface4 = Color(0xFF213A5F)
val DarkTextPrimary = Color(0xFFF1F5F9)
val DarkTextSecondary = Color(0xFF94A3B8)
val DarkTextMuted = Color(0xFF8EA0B8)
val DarkTextGhost = Color(0xFF475569)
val DarkBorder = Color(0x26C9A96E) // rgba(201, 169, 110, 0.15)
val DarkBorderSubtle = Color(0x0FFFFFFF) // rgba(255, 255, 255, 0.06)
val DarkOverlay = Color(0x99000000) // rgba(0, 0, 0, 0.6)

// ── Светлая тема (`html.light`) ────────────────────────────────────────────
val LightGold = Color(0xFF785C26)
val LightGoldLight = Color(0xFFA8823C)
val LightGoldDim = Color(0xFF6B5322)
val LightGoldOn = Color(0xFFFFFFFF)
val LightSuccess = Color(0xFF1D8147)
val LightError = Color(0xFFC74134)
val LightWarning = Color(0xFF9C640C)
val LightInfo = Color(0xFF2676AA)
val LightSurface0 = Color(0xFFF5F4F0)
val LightSurface1 = Color(0xFFFFFFFF)
val LightSurface2 = Color(0xFFEDEAE3)
val LightSurface3 = Color(0xFFE4E0D7)
val LightSurface4 = Color(0xFFD8D3C8)
val LightTextPrimary = Color(0xFF1A1D23)
val LightTextSecondary = Color(0xFF4D525B)
val LightTextMuted = Color(0xFF6B7079)
val LightTextGhost = Color(0xFFAEA99E)
val LightBorder = Color(0x1A231F16) // rgba(35, 31, 22, 0.10)
val LightBorderSubtle = Color(0x12231F16) // rgba(35, 31, 22, 0.07)
val LightOverlay = Color(0x6B1C1810) // rgba(28, 24, 16, 0.42)
