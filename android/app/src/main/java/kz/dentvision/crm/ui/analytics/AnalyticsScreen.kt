package kz.dentvision.crm.ui.analytics

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kz.dentvision.crm.lib.formatTenge
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.theme.DvSpacing
import kz.dentvision.crm.ui.theme.DvTheme
import kotlin.math.roundToLong

/**
 * Аналитика клиники: сводка, выручка и новые пациенты по месяцам, загрузка
 * врачей.
 *
 * Экран существовал только на сервере — четыре посчитанных ручки, к которым
 * на телефоне никто не обращался.
 *
 * Разделение с «Сегодня» намеренное: там оперативный день и действия, здесь
 * ряды за год и никаких действий. Смешать их значило бы получить экран, на
 * который смотрят вместо того, чтобы работать.
 */
@Composable
fun AnalyticsScreen(
    modifier: Modifier = Modifier,
    viewModel: AnalyticsViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.ensureLoaded() }

    if (state.loading) {
        LoadingSkeleton(rows = 5, contentPadding = PaddingValues(DvSpacing.lg))
        return
    }
    val summary = state.summary
    if (summary == null) {
        ErrorState(
            message = state.error ?: "Не удалось загрузить аналитику",
            onRetry = viewModel::load,
        )
        return
    }

    LazyColumn(
        modifier = modifier.fillMaxSize().background(DvTheme.colors.surface0),
        contentPadding = PaddingValues(DvSpacing.lg),
        verticalArrangement = Arrangement.spacedBy(DvSpacing.md),
    ) {
        item {
            // Четыре числа — плитки, а не диаграммы: у каждого одно значение,
            // и столбик из одного столбца это не график, а число, нарисованное
            // дорогим способом.
            Row(horizontalArrangement = Arrangement.spacedBy(DvSpacing.sm)) {
                StatTile("Пациентов", summary.totalPatients.toString(), Modifier.weight(1f))
                StatTile("Приёмов сегодня", summary.appointmentsToday.toString(), Modifier.weight(1f))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(DvSpacing.sm)) {
                StatTile(
                    label = "Выручка за месяц",
                    value = formatTenge(summary.revenueThisMonth.roundToLong()),
                    modifier = Modifier.weight(1f),
                )
                StatTile("Заказов в работе", summary.activeLabOrders.toString(), Modifier.weight(1f))
            }
        }

        if (state.revenue.isNotEmpty()) {
            item {
                MonthlyBars(
                    title = "Выручка по месяцам",
                    months = state.revenue.map { it.month },
                    values = state.revenue.map { it.total },
                    formatValue = { formatTenge(it.roundToLong()) },
                )
            }
        }

        if (state.growth.isNotEmpty()) {
            item {
                MonthlyBars(
                    title = "Новые пациенты по месяцам",
                    months = state.growth.map { it.month },
                    values = state.growth.map { it.newPatients.toDouble() },
                    formatValue = { "${it.roundToLong()}" },
                )
            }
        }

        item {
            Text(
                text = "Загрузка врачей за месяц",
                style = MaterialTheme.typography.labelSmall,
                color = DvTheme.colors.textMuted,
                modifier = Modifier.padding(top = DvSpacing.sm),
            )
        }
        if (state.doctors.isEmpty()) {
            item {
                EmptyStateView(
                    title = "Врачей нет",
                    description = "Как только в клинике появятся врачи, здесь будет их загрузка.",
                )
            }
        } else {
            val busiest = state.doctors.maxOf { it.appointmentsThisMonth }.coerceAtLeast(1)
            items(state.doctors, key = { it.doctorId }) { doctor ->
                DoctorRow(name = doctor.name, count = doctor.appointmentsThisMonth, max = busiest)
            }
        }
    }
}

@Composable
private fun StatTile(label: String, value: String, modifier: Modifier = Modifier) {
    val colors = DvTheme.colors
    Surface(
        color = colors.surface1,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, colors.borderSubtle),
        modifier = modifier,
    ) {
        Column(modifier = Modifier.padding(DvSpacing.lg)) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = colors.textMuted,
            )
            // Значение — обычным текстовым токеном, а не цветом ряда: цвет
            // несут метки данных, текст остаётся текстом.
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
                color = colors.textPrimary,
                modifier = Modifier.padding(top = DvSpacing.xs),
            )
        }
    }
}

/**
 * Один ряд за двенадцать месяцев.
 *
 * Одна серия — один цвет на все столбцы. Заливка «темнее там, где больше»
 * была бы двойным кодированием: длина столбца уже показывает величину, а
 * оттенок сжёг бы единственный свободный канал ни на что.
 *
 * Подпись значения не ставится над каждым столбцом — это нечитаемо и всё
 * равно не читается. Вместо наведения, которого на телефоне нет, столбец
 * нажимается: выбранный подписан под графиком полностью. По умолчанию выбран
 * последний месяц, так что число на экране есть всегда — значение никогда не
 * закодировано одним лишь цветом.
 */
@Composable
private fun MonthlyBars(
    title: String,
    months: List<String>,
    values: List<Double>,
    formatValue: (Double) -> String,
) {
    val colors = DvTheme.colors
    var selected by remember(months) { mutableStateOf(months.lastIndex.coerceAtLeast(0)) }
    val max = values.maxOrNull()?.takeIf { it > 0.0 } ?: 1.0

    Surface(
        color = colors.surface1,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, colors.borderSubtle),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(DvSpacing.lg)) {
            // Одна серия — легенда не нужна, ряд называет заголовок.
            Text(
                text = title,
                style = MaterialTheme.typography.labelSmall,
                color = colors.textMuted,
            )

            Row(
                modifier = Modifier.fillMaxWidth().height(120.dp).padding(top = DvSpacing.md),
                verticalAlignment = Alignment.Bottom,
                // Зазор между столбцами — это фон, а не рамка вокруг каждого.
                horizontalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                months.forEachIndexed { index, _ ->
                    val value = values.getOrElse(index) { 0.0 }
                    val isSelected = index == selected
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            // Нажимается вся колонка целиком, а не сам столбец:
                            // у пустого месяца высота почти нулевая, и попасть
                            // по нему иначе было бы невозможно.
                            .clickable { selected = index },
                        contentAlignment = Alignment.BottomCenter,
                    ) {
                        val fraction = (value / max).coerceIn(0.02, 1.0)
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .fillMaxHeight(fraction.toFloat())
                                .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                                .background(
                                    if (isSelected) colors.gold else colors.gold.copy(alpha = 0.35f),
                                ),
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth().padding(top = DvSpacing.xs),
                horizontalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                months.forEach { month ->
                    Text(
                        text = shortMonth(month),
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.textGhost,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            months.getOrNull(selected)?.let { month ->
                Text(
                    text = "${longMonth(month)} · ${formatValue(values.getOrElse(selected) { 0.0 })}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.textPrimary,
                    modifier = Modifier.padding(top = DvSpacing.sm),
                )
            }
        }
    }
}

/**
 * Строка врача — она же табличное представление: имя и число рядом, поэтому
 * значение читается и без различения цветов, а полоса лишь помогает сравнить
 * соседей глазом.
 */
@Composable
private fun DoctorRow(name: String, count: Int, max: Int) {
    val colors = DvTheme.colors
    Surface(
        color = colors.surface1,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, colors.borderSubtle),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(DvSpacing.lg)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = name,
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.textPrimary,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = "$count",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = colors.textPrimary,
                )
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .padding(top = DvSpacing.xs)
                    .clip(RoundedCornerShape(2.dp))
                    .background(colors.surface3),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(if (max > 0) count.toFloat() / max else 0f)
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(2.dp))
                        .background(colors.gold),
                )
            }
        }
    }
}
