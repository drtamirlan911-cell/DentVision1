package kz.dentvision.crm.ui.medcard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.CrmRepository
import kz.dentvision.crm.data.model.MedicalHistory
import kz.dentvision.crm.data.model.Patient
import kz.dentvision.crm.ui.common.UiState

data class MedicalCardUiState(
    val patient: Patient? = null,
    val card: UiState<MedicalHistory> = UiState.Data(MedicalHistory()),
    val draft: MedicalHistory = MedicalHistory(),
    val saving: Boolean = false,
    val error: String? = null,
    val saved: Boolean = false,
)

class MedicalCardViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(MedicalCardUiState())
    val state: StateFlow<MedicalCardUiState> = _state

    fun selectPatient(patient: Patient) {
        _state.value = MedicalCardUiState(patient = patient, card = UiState.Loading)
        load()
    }

    fun load() {
        val patient = _state.value.patient ?: return
        _state.value = _state.value.copy(card = UiState.Loading, error = null, saved = false)
        viewModelScope.launch {
            runCatching { repository.medicalHistory(patient.id) }
                .onSuccess { _state.value = _state.value.copy(card = UiState.Data(it), draft = it) }
                .onFailure {
                    _state.value = _state.value.copy(
                        card = UiState.Error(it.message ?: "Не удалось загрузить карту"),
                    )
                }
        }
    }

    fun edit(transform: (MedicalHistory) -> MedicalHistory) {
        _state.value = _state.value.copy(
            draft = transform(_state.value.draft),
            error = null,
            saved = false,
        )
    }

    /**
     * Отправляются только поля карты. PATCH на бэкенде сливает присланное с уже
     * лежащим, поэтому зубная формула, категория и метки пациента остаются на
     * месте — их сюда тянуть не надо и опасно.
     */
    fun save() {
        val patient = _state.value.patient ?: return
        _state.value = _state.value.copy(saving = true, error = null, saved = false)
        viewModelScope.launch {
            runCatching { repository.saveMedicalHistory(patient.id, _state.value.draft) }
                .onSuccess {
                    _state.value = _state.value.copy(
                        saving = false,
                        saved = true,
                        card = UiState.Data(_state.value.draft),
                    )
                }
                .onFailure {
                    _state.value = _state.value.copy(
                        saving = false,
                        error = it.message ?: "Не удалось сохранить карту",
                    )
                }
        }
    }
}
