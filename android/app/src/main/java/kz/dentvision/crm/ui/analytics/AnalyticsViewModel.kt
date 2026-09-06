package kz.dentvision.crm.ui.analytics

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.AnalyticsRepository
import kz.dentvision.crm.data.model.AnalyticsSummary
import kz.dentvision.crm.data.model.DoctorUtilization
import kz.dentvision.crm.data.model.PatientsGrowthPoint
import kz.dentvision.crm.data.model.RevenuePoint

data class AnalyticsUiState(
    val loading: Boolean = true,
    /** Ошибка сводки — единственная, из-за которой экран не имеет смысла. */
    val error: String? = null,
    val summary: AnalyticsSummary? = null,
    val revenue: List<RevenuePoint> = emptyList(),
    val growth: List<PatientsGrowthPoint> = emptyList(),
    val doctors: List<DoctorUtilization> = emptyList(),
)

/**
 * Аналитика клиники.
 *
 * Четыре ручки грузятся параллельно и падают независимо: график выручки,
 * который не пришёл, не должен уносить с собой загрузку врачей. Экран
 * целиком уходит в ошибку только если не удалось получить сводку — без неё
 * показывать нечего.
 *
 * Доступ сторожит сервер (`bi.clinic` + тарифный гейт). Клиент эти проверки
 * не повторяет: раздел показывается тем, у кого есть право, а отказ по тарифу
 * приходит ответом и показывается его же словами — выдуманная формулировка
 * разошлась бы с тем, что видит тот же человек в вебе.
 */
class AnalyticsViewModel(
    private val repository: AnalyticsRepository = AnalyticsRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(AnalyticsUiState())
    val state: StateFlow<AnalyticsUiState> = _state

    private var loaded = false

    fun ensureLoaded() {
        if (loaded) return
        loaded = true
        load()
    }

    fun load() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            val summaryJob = async { runCatching { repository.summary() } }
            val revenueJob = async { runCatching { repository.revenue() } }
            val growthJob = async { runCatching { repository.patientsGrowth() } }
            val doctorsJob = async { runCatching { repository.doctors() } }

            val summary = summaryJob.await()
            _state.update {
                it.copy(
                    loading = false,
                    error = summary.exceptionOrNull()?.let { e -> e.message ?: "Не удалось загрузить аналитику" },
                    summary = summary.getOrNull(),
                    revenue = revenueJob.await().getOrNull().orEmpty(),
                    growth = growthJob.await().getOrNull().orEmpty(),
                    // Врачи без единого приёма за месяц — тоже ответ, но
                    // сверху полезнее самые загруженные.
                    doctors = doctorsJob.await().getOrNull().orEmpty()
                        .sortedByDescending { d -> d.appointmentsThisMonth },
                )
            }
        }
    }
}

/**
 * `2026-09` → `сен`. Ось из двенадцати месяцев на телефоне читается только
 * сокращениями; полное имя месяца показывается у выбранного столбца.
 */
internal fun shortMonth(key: String): String {
    val month = key.substringAfter('-', "").toIntOrNull() ?: return key
    return SHORT_MONTHS.getOrNull(month - 1) ?: key
}

/** `2026-09` → `сентябрь 2026` — подпись выбранного столбца. */
internal fun longMonth(key: String): String {
    val year = key.substringBefore('-')
    val month = key.substringAfter('-', "").toIntOrNull() ?: return key
    val name = LONG_MONTHS.getOrNull(month - 1) ?: return key
    return "$name $year"
}

private val SHORT_MONTHS = listOf(
    "янв", "фев", "мар", "апр", "май", "июн",
    "июл", "авг", "сен", "окт", "ноя", "дек",
)

private val LONG_MONTHS = listOf(
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
)
