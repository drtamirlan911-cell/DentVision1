package kz.dentvision.crm.ui.common

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kz.dentvision.crm.R
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Фирменный знак.
 *
 * Берётся готовым из бренд-пакета (`public/brand/favicon/`), а не
 * перерисовывается в векторный drawable. Знак нарисован одним контуром с
 * градиентом в `userSpaceOnUse` и смещённым viewBox — при ручном переводе в
 * `VectorDrawable` легко получить «почти похоже», а логотип, нарисованный
 * почти правильно, хуже отсутствующего. Растр из того же пакета, которым
 * пользуется веб, гарантированно совпадает с ним.
 *
 * Оба размера — из одного источника: 512 px для крупного знака, 192 px для
 * мелкого. Даже на самом плотном экране 96 dp — это 384 px, так что запаса
 * хватает и мылить не будет.
 */
@Composable
fun DvLogo(
    size: Dp = 72.dp,
    modifier: Modifier = Modifier,
) {
    Image(
        painter = painterResource(
            if (size <= 40.dp) R.drawable.dv_logo_small else R.drawable.dv_logo,
        ),
        contentDescription = "DentVision",
        modifier = modifier.size(size),
    )
}

/**
 * Знак вместе с названием — то, чем встречает экран входа.
 *
 * Название остаётся текстом, а не картинкой: так оно наследует шрифт и цвет
 * темы, читается программой чтения с экрана и не мылится ни на каком экране.
 */
@Composable
fun DvBrandMark(
    subtitle: String? = null,
    logoSize: Dp = 88.dp,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        DvLogo(size = logoSize)
        Text(
            text = "DentVision",
            style = MaterialTheme.typography.headlineMedium,
            color = DvTheme.colors.gold,
            modifier = Modifier.padding(top = 12.dp),
        )
        if (subtitle != null) {
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = DvTheme.colors.textSecondary,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}
