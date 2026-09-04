package kz.dentvision.crm.ui.diagnostics

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import kz.dentvision.crm.data.model.DiagnosticsSettings
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme

private val DEFAULT_DRAFT = DiagnosticsSettings(
    defaultCategory = "3D",
    notifyOnStatusChange = true,
    autoAssignCenter = false,
    requirePriority = true,
)

data class DiagnosticSettingsUiState(
    val loaded: UiState<Unit> = UiState.Loading,
    val draft: DiagnosticsSettings = DEFAULT_DRAFT,
    val saving: Boolean = false,
    val saved: Boolean = false,
    val error: String? = null,
)

/**
 * Перенос `DiagnosticSettings.tsx` — та же ручка, что и общие настройки
 * клиники (`GET/PUT /api/clinics/:id/settings`), но правится только
 * подобъект `diagnostics`. `mergeClinicSettings` на сервере сливает
 * верхнеуровневые ключи целиком (`Object.assign`, не рекурсивно), поэтому
 * сохранение шлёт `ClinicSettings(diagnostics = draft)` с остальными
 * полями `null` — `explicitNulls = false` в клиенте не кладёт их в JSON,
 * так что PUT трогает только `diagnostics`, не задевая рабочий график и
 * прочие настройки, отредактированные на экране `ClinicSettingsScreen`.
 */
class DiagnosticSettingsViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(DiagnosticSettingsUiState())
    val state: StateFlow<DiagnosticSettingsUiState> = _state

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
                .onSuccess { settings ->
                    val loadedDraft = settings.diagnostics
                    _state.value = _state.value.copy(
                        loaded = UiState.Data(Unit),
                        draft = DiagnosticsSettings(
                            defaultCategory = loadedDraft?.defaultCategory ?: DEFAULT_DRAFT.defaultCategory,
                            notifyOnStatusChange = loadedDraft?.notifyOnStatusChange ?: DEFAULT_DRAFT.notifyOnStatusChange,
                            autoAssignCenter = loadedDraft?.autoAssignCenter ?: DEFAULT_DRAFT.autoAssignCenter,
                            requirePriority = loadedDraft?.requirePriority ?: DEFAULT_DRAFT.requirePriority,
                        ),
                    )
                }
                .onFailure {
                    _state.value = _state.value.copy(loaded = UiState.Error(it.message ?: "Не удалось загрузить настройки"))
                }
        }
    }

    fun edit(transform: (DiagnosticsSettings) -> DiagnosticsSettings) {
        _state.value = _state.value.copy(draft = transform(_state.value.draft), saved = false, error = null)
    }

    fun save() {
        val clinic = clinicId ?: return
        _state.value = _state.value.copy(saving = true, error = null, saved = false)
        viewModelScope.launch {
            runCatching { repository.saveClinicSettings(clinic, ClinicSettings(diagnostics = _state.value.draft)) }
                .onSuccess { _state.value = _state.value.copy(saving = false, saved = true) }
                .onFailure {
                    _state.value = _state.value.copy(saving = false, error = it.message ?: "Не удалось сохранить настройки")
                }
        }
    }
}

@Composable
fun DiagnosticSettingsScreen(
    clinicId: String?,
    viewModel: DiagnosticSettingsViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(clinicId) { viewModel.start(clinicId) }

    if (clinicId == null) {
        Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
            Text(
                text = "Это настройки клиники, создающей направления. У вашего аккаунта нет привязки к клинике — изменить их отсюда нельзя.",
                style = MaterialTheme.typography.bodyMedium,
                color = DvTheme.colors.textMuted,
            )
        }
        return
    }

    when (val loaded = state.loaded) {
        is UiState.Loading -> LoadingSkeleton(rows = 4)
        is UiState.Error -> ErrorState(message = loaded.message, onRetry = viewModel::load)
        is UiState.Data -> Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .imePadding()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            val draft = state.draft

            Text(
                text = "Категория по умолчанию",
                style = MaterialTheme.typography.labelLarge,
                color = DvTheme.colors.gold,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = draft.defaultCategory == "3D",
                    onClick = { viewModel.edit { it.copy(defaultCategory = "3D") } },
                    label = { Text("3D-диагностика") },
                )
                FilterChip(
                    selected = draft.defaultCategory == "LABORATORY",
                    onClick = { viewModel.edit { it.copy(defaultCategory = "LABORATORY") } },
                    label = { Text("Лаборатория") },
                )
            }

            Toggle(
                title = "Уведомлять о смене статуса",
                subtitle = "При изменении статуса направления",
                value = draft.notifyOnStatusChange,
            ) { v -> viewModel.edit { it.copy(notifyOnStatusChange = v) } }

            Toggle(
                title = "Автоназначение центра",
                subtitle = "По типу исследования",
                value = draft.autoAssignCenter,
            ) { v -> viewModel.edit { it.copy(autoAssignCenter = v) } }

            Toggle(
                title = "Обязательный приоритет",
                subtitle = "Требовать выбор приоритета при создании",
                value = draft.requirePriority,
            ) { v -> viewModel.edit { it.copy(requirePriority = v) } }

            state.error?.let {
                Text(text = it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.error)
            }
            if (state.saved) {
                Text(text = "Сохранено", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.success)
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
                    Text("Сохранить")
                }
            }
        }
    }
}

@Composable
private fun Toggle(title: String, subtitle: String, value: Boolean?, onChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
            Text(text = title, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
            Text(text = subtitle, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
        }
        Switch(checked = value == true, onCheckedChange = onChange)
    }
}
