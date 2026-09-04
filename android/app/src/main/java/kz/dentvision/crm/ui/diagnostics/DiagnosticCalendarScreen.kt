package kz.dentvision.crm.ui.diagnostics

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.DiagnosticsRepository
import kz.dentvision.crm.data.model.Referral
import kz.dentvision.crm.navigation.LocalAssistantNavigate
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_REFERRALS
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme
import java.time.LocalDate
import java.time.YearMonth

private val MONTH_NAMES = listOf(
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
)
private val DAY_NAMES = listOf("Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс")

/**
 * Перенос `DiagnosticCalendar.tsx` — своей ручки нет, направления того же
 * `/referrals` (лимит 200, как на вебе) раскладываются по датам
 * (`scheduledDate ?: createdAt`, первые 10 символов ISO-строки — сервер
 * уже отдаёт её в UTC, так что это тот же результат, что и
 * `toISOString().slice(0,10)` на вебе).
 */
class DiagnosticCalendarViewModel(
    private val repository: DiagnosticsRepository = DiagnosticsRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<Map<String, List<Referral>>>>(UiState.Loading)
    val state: StateFlow<UiState<Map<String, List<Referral>>>> = _state

    init {
        load()
    }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            runCatching { repository.referrals(limit = 200) }
                .onSuccess { (items, _) -> _state.value = UiState.Data(group(items)) }
                .onFailure { _state.value = UiState.Error(it.message ?: "Не удалось получить направления") }
        }
    }

    private fun group(referrals: List<Referral>): Map<String, List<Referral>> {
        val map = LinkedHashMap<String, MutableList<Referral>>()
        for (r in referrals) {
            val day = (r.scheduledDate ?: r.createdAt)?.take(10) ?: continue
            map.getOrPut(day) { mutableListOf() }.add(r)
        }
        return map
    }
}

@Composable
fun DiagnosticCalendarScreen(viewModel: DiagnosticCalendarViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val onNavigate = LocalAssistantNavigate.current
    var month by remember { mutableStateOf(YearMonth.now()) }

    when (val s = state) {
        is UiState.Loading -> LoadingSkeleton()
        is UiState.Error -> ErrorState(message = s.message, onRetry = viewModel::load)
        is UiState.Data -> CalendarContent(
            month = month,
            referralsByDate = s.value,
            onPrevMonth = { month = month.minusMonths(1) },
            onNextMonth = { month = month.plusMonths(1) },
            onOpenReferral = { id -> onNavigate("$ROUTE_DIAGNOSTICS_REFERRALS/$id") },
        )
    }
}

@Composable
private fun CalendarContent(
    month: YearMonth,
    referralsByDate: Map<String, List<Referral>>,
    onPrevMonth: () -> Unit,
    onNextMonth: () -> Unit,
    onOpenReferral: (String) -> Unit,
) {
    val today = remember { LocalDate.now().toString() }
    // ISO: понедельник = 1 ... воскресенье = 7 — тот же порядок недели,
    // что и `(firstDay.getDay() + 6) % 7` на вебе (тоже с понедельника).
    val startPad = month.atDay(1).dayOfWeek.value - 1
    val daysInMonth = month.lengthOfMonth()
    val cells = buildList {
        repeat(startPad) { add(null) }
        for (d in 1..daysInMonth) add(d)
        while (size % 7 != 0) add(null)
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            IconButton(onClick = onPrevMonth) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Предыдущий месяц", tint = DvTheme.colors.textSecondary)
            }
            Text(
                text = "${MONTH_NAMES[month.monthValue - 1]} ${month.year}",
                style = MaterialTheme.typography.titleMedium,
                color = DvTheme.colors.textPrimary,
            )
            IconButton(onClick = onNextMonth) {
                Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = "Следующий месяц", tint = DvTheme.colors.textSecondary)
            }
        }

        Row(modifier = Modifier.fillMaxWidth()) {
            DAY_NAMES.forEach { d ->
                Text(
                    text = d,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.textMuted,
                )
            }
        }

        LazyVerticalGrid(
            columns = GridCells.Fixed(7),
            horizontalArrangement = Arrangement.spacedBy(2.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            items(cells) { day ->
                if (day == null) {
                    Box(modifier = Modifier.height(72.dp))
                } else {
                    val dateStr = "%04d-%02d-%02d".format(month.year, month.monthValue, day)
                    DayCell(
                        day = day,
                        isToday = dateStr == today,
                        referrals = referralsByDate[dateStr].orEmpty(),
                        onOpenReferral = onOpenReferral,
                    )
                }
            }
        }
    }
}

@Composable
private fun DayCell(day: Int, isToday: Boolean, referrals: List<Referral>, onOpenReferral: (String) -> Unit) {
    Column(
        modifier = Modifier
            .height(72.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .then(if (isToday) Modifier.background(DvTheme.colors.gold.copy(alpha = 0.08f)) else Modifier)
            .padding(4.dp),
    ) {
        Text(text = day.toString(), style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textPrimary)
        referrals.take(3).forEach { r ->
            Text(
                text = r.patientName.substringBefore(" ").ifBlank { "—" },
                style = MaterialTheme.typography.labelSmall,
                color = DvTheme.colors.gold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(4.dp))
                    .background(DvTheme.colors.gold.copy(alpha = 0.1f))
                    .clickable { onOpenReferral(r.id) }
                    .padding(horizontal = 2.dp),
            )
        }
        if (referrals.size > 3) {
            Text(text = "+${referrals.size - 3}", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
        }
    }
}
