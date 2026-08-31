package kz.dentvision.crm.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

/**
 * `--dv-radius: 0.75rem` = 12dp — базовый радиус карточек и полей ввода в вебе.
 * Мелкий и крупный варианты — те же, что дают Tailwind-классы rounded-lg (8dp)
 * и rounded-2xl (16dp) на экранах CRM.
 */
val DvShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(24.dp),
)
