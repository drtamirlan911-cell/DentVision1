package kz.dentvision.crm.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.CrmRepository
import kz.dentvision.crm.data.model.ClinicSettings
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme

private val WEEKDAYS = listOf(
    1 to "Пн", 2 to "Вт", 3 to "Ср", 4 to "Чт", 5 to "Пт", 6 to "Сб", 0 to "Вс",
)

data class SettingsUiState(
    val loaded: UiState<ClinicSettings> = UiState.Loading,
    val draft: ClinicSettings = ClinicSettings(),
    val saving: Boolean = false,
    val saved: Boolean = false,
    val error: String? = null,
)

class ClinicSettingsViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(SettingsUiState())
    val state: StateFlow<SettingsUiState> = _state

    private var clinicId: String? = null

    fun start(clinicId: String?) {
        if (this.clinicId == clinicId && _state.value.loaded !is UiState.Loading) return
        this.clinicId = clinicId
        load()
    }

    fun load() {
        val clinic = clinicId
        if (clinic == null) {
            _state.value = _state.value.copy(loaded = UiState.Error("Клиника не выбрана"))
            return
        }
        _state.value = _state.value.copy(loaded = UiState.Loading, saved = false, error = null)
        viewModelScope.launch {
            runCatching { repository.clinicSettings(clinic) }
                .onSuccess { _state.value = _state.value.copy(loaded = UiState.Data(it), draft = it) }
                .onFailure {
                    // Сервер отвечает 403 всем, кроме руководителя и
                    // администратора, — его текст и показываем как есть.
                    _state.value = _state.value.copy(
                        loaded = UiState.Error(it.message ?: "Не удалось загрузить настройки"),
                    )
                }
        }
    }

    fun edit(transform: (ClinicSettings) -> ClinicSettings) {
        _state.value = _state.value.copy(
            draft = transform(_state.value.draft),
            saved = false,
            error = null,
        )
    }

    fun save() {
        val clinic = clinicId ?: return
        _state.value = _state.value.copy(saving = true, error = null, saved = false)
        viewModelScope.launch {
            runCatching { repository.saveClinicSettings(clinic, _state.value.draft) }
                .onSuccess {
                    _state.value = _state.value.copy(
                        saving = false,
                        saved = true,
                        loaded = UiState.Data(it),
                        draft = it,
                    )
                }
                .onFailure {
                    _state.value = _state.value.copy(
                        saving = false,
                        error = it.message ?: "Не удалось сохранить настройки",
                    )
                }
        }
    }
}

/**
 * Настройки клиники — операционная часть: график, обед, длительность приёма,
 * шаг записи, напоминания, онлайн-запись.
 *
 * Платежи, интеграции и разбор автосписаний сюда не вынесены: их правка
 * требует ключей и сверки, которую на телефоне делать неудобно и опасно.
 * PUT на сервере сливает присланное с лежащим, поэтому отсутствие этих полей
 * их не стирает.
 */
@Composable
fun ClinicSettingsScreen(
    clinicId: String?,
    viewModel: ClinicSettingsViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(clinicId) { viewModel.start(clinicId) }

    when (val loaded = state.loaded) {
        is UiState.Loading -> LoadingSkeleton(rows = 6)
        is UiState.Error -> ErrorState(message = loaded.message, onRetry = viewModel::load)
        is UiState.Data -> Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .imePadding()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            val draft = state.draft

            Text(
                text = "Рабочий день",
                style = MaterialTheme.typography.labelLarge,
                color = DvTheme.colors.gold,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TimeField("Начало", draft.workStart, Modifier.weight(1f)) { v ->
                    viewModel.edit { it.copy(workStart = v) }
                }
                TimeField("Конец", draft.workEnd, Modifier.weight(1f)) { v ->
                    viewModel.edit { it.copy(workEnd = v) }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TimeField("Обед с", draft.lunchStart, Modifier.weight(1f)) { v ->
                    viewModel.edit { it.copy(lunchStart = v) }
                }
                TimeField("Обед до", draft.lunchEnd, Modifier.weight(1f)) { v ->
                    viewModel.edit { it.copy(lunchEnd = v) }
                }
            }

            Text(
                text = "Рабочие дни",
                style = MaterialTheme.typography.labelMedium,
                color = DvTheme.colors.textGhost,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                WEEKDAYS.forEach { (day, label) ->
                    FilterChip(
                        selected = draft.workDays.contains(day),
                        onClick = {
                            viewModel.edit {
                                val next = if (it.workDays.contains(day)) {
                                    it.workDays - day
                                } else {
                                    (it.workDays + day).sorted()
                                }
                                it.copy(workDays = next)
                            }
                        },
                        label = { Text(label, style = MaterialTheme.typography.labelSmall) },
                    )
                }
            }

            Text(
                text = "Приём",
                style = MaterialTheme.typography.labelLarge,
                color = DvTheme.colors.gold,
                modifier = Modifier.padding(top = 6.dp),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                NumberField("Длительность, мин", draft.defaultAppointmentDuration, Modifier.weight(1f)) { v ->
                    viewModel.edit { it.copy(defaultAppointmentDuration = v) }
                }
                NumberField("Шаг записи, мин", draft.bookingSlotMinutes, Modifier.weight(1f)) { v ->
                    viewModel.edit { it.copy(bookingSlotMinutes = v) }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                NumberField("Напомнить за, ч", draft.reminderHours, Modifier.weight(1f)) { v ->
                    viewModel.edit { it.copy(reminderHours = v) }
                }
                NumberField("Гигиена, мес", draft.hygieneMonths, Modifier.weight(1f)) { v ->
                    viewModel.edit { it.copy(hygieneMonths = v) }
                }
            }

            Toggle("Онлайн-запись", draft.onlineBookingEnabled) { v ->
                viewModel.edit { it.copy(onlineBookingEnabled = v) }
            }
            Toggle("Разрешать наложение записей", draft.overbookingAllowed) { v ->
                viewModel.edit { it.copy(overbookingAllowed = v) }
            }
            Toggle("Кресло обязательно", draft.requireChair) { v ->
                viewModel.edit { it.copy(requireChair = v) }
            }

            state.error?.let {
                Text(text = it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.error)
            }
            if (state.saved) {
                Text(
                    text = "Сохранено",
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.success,
                )
            }

            DvPrimaryButton(
                onClick = viewModel::save,
                enabled = !state.saving,
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
            ) {
                if (state.saving) {
                    CircularProgressIndicator(
                        strokeWidth = 2.dp,
                        color = DvTheme.colors.goldOn,
                        modifier = Modifier.size(18.dp),
                    )
                } else {
                    Text("Сохранить настройки")
                }
            }
        }
    }
}

@Composable
private fun TimeField(label: String, value: String?, modifier: Modifier, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value.orEmpty(),
        onValueChange = onChange,
        label = { Text(label) },
        placeholder = { Text("09:00") },
        singleLine = true,
        modifier = modifier,
    )
}

@Composable
private fun NumberField(label: String, value: Int?, modifier: Modifier, onChange: (Int?) -> Unit) {
    OutlinedTextField(
        value = value?.toString().orEmpty(),
        onValueChange = { raw -> onChange(raw.filter { it.isDigit() }.toIntOrNull()) },
        label = { Text(label) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = modifier,
    )
}

@Composable
private fun Toggle(label: String, value: Boolean?, onChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = DvTheme.colors.textPrimary,
        )
        Switch(checked = value == true, onCheckedChange = onChange)
    }
}
