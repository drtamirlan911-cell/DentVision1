package kz.dentvision.crm.ui.notifications

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Arrangement
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.NotificationsRepository
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

private data class PrefGroup(val label: String, val types: List<Pair<String, String>>)

/**
 * Тот же список групп и подписей, что `PREF_GROUPS` в
 * `src/pages/NotificationPreferences.tsx` — типы уведомлений это
 * закрытый список на бэкенде (`NOTIFICATION_TYPES`), не то, что стоит
 * тянуть динамически ради пяти строк.
 */
private val PREF_GROUPS = listOf(
    PrefGroup(
        "CRM",
        listOf(
            "crm.appointment.reminder" to "Напоминание о записи",
            "crm.appointment.cancelled" to "Отмена записи",
            "crm.patient.no_show" to "Неявка пациента",
            "crm.invoice.paid" to "Оплата счёта",
            "crm.inventory.low" to "Мало товара на складе",
        ),
    ),
    PrefGroup(
        "Диагностика",
        listOf(
            "diagnostics.referral.sent" to "Новое направление",
            "diagnostics.referral.accepted" to "Направление принято",
            "diagnostics.referral.result" to "Результат готов",
            "diagnostics.referral.payment" to "Оплата за направление",
        ),
    ),
    PrefGroup(
        "Магазин",
        listOf(
            "shop.order.placed" to "Заказ создан",
            "shop.order.status" to "Статус заказа изменился",
            "shop.order.payment" to "Оплата подтверждена",
        ),
    ),
    PrefGroup(
        "Академия",
        listOf(
            "school.enrollment.confirmed" to "Зачисление на курс",
            "school.course.completed" to "Курс завершён",
            "school.certificate.ready" to "Сертификат готов",
        ),
    ),
    PrefGroup(
        "Администрирование",
        listOf(
            "admin.clinic.expiring" to "Подписка истекает",
            "admin.clinic.expired" to "Подписка истекла",
            "admin.clinic.new" to "Новая клиника",
        ),
    ),
)

data class NotificationPreferencesUiState(
    val preferences: UiState<Map<String, Boolean>> = UiState.Loading,
    val saving: String? = null,
)

class NotificationPreferencesViewModel(
    private val repository: NotificationsRepository = NotificationsRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(NotificationPreferencesUiState())
    val state: StateFlow<NotificationPreferencesUiState> = _state

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(preferences = UiState.Loading) }
        viewModelScope.launch {
            runCatching { repository.preferences() }
                .onSuccess { list -> _state.update { it.copy(preferences = UiState.Data(list.associate { p -> p.type to p.enabled })) } }
                .onFailure { _state.update { s -> s.copy(preferences = UiState.Error(it.message ?: "Не удалось загрузить настройки")) } }
        }
    }

    /** По умолчанию включено — так же, как читает веб (`isEnabled`, пока сервер не прислал строку). */
    fun isEnabled(type: String): Boolean = ((_state.value.preferences as? UiState.Data)?.value?.get(type)) ?: true

    fun toggle(type: String, enabled: Boolean) {
        val current = (_state.value.preferences as? UiState.Data)?.value ?: return
        _state.update { it.copy(preferences = UiState.Data(current + (type to enabled)), saving = type) }
        viewModelScope.launch {
            runCatching { repository.updatePreference(type, enabled) }
            _state.update { it.copy(saving = null) }
        }
    }
}

/** Настройки уведомлений — перенос `NotificationPreferences.tsx`. */
@Composable
fun NotificationPreferencesScreen(viewModel: NotificationPreferencesViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    when (val prefs = state.preferences) {
        is UiState.Loading -> LoadingSkeleton()
        is UiState.Error -> ErrorState(message = prefs.message, onRetry = viewModel::load)
        is UiState.Data -> Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        ) {
            PREF_GROUPS.forEach { group ->
                Text(
                    text = group.label,
                    style = MaterialTheme.typography.labelLarge,
                    color = DvTheme.colors.gold,
                    modifier = Modifier.padding(top = 12.dp, bottom = 6.dp),
                )
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
                    border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
                ) {
                    Column {
                        group.types.forEachIndexed { index, (type, label) ->
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(label, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                                Switch(
                                    checked = prefs.value[type] ?: true,
                                    onCheckedChange = { viewModel.toggle(type, it) },
                                    enabled = state.saving != type,
                                    colors = SwitchDefaults.colors(checkedTrackColor = DvTheme.colors.gold),
                                )
                            }
                            if (index != group.types.lastIndex) {
                                HorizontalDivider(color = DvTheme.colors.borderSubtle)
                            }
                        }
                    }
                }
            }
        }
    }
}
