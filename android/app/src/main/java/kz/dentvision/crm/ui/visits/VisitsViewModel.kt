package kz.dentvision.crm.ui.visits

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.CrmRepository
import kz.dentvision.crm.data.model.Doctor
import kz.dentvision.crm.data.model.Patient
import kz.dentvision.crm.data.model.Visit
import kz.dentvision.crm.data.model.VisitCreate
import kz.dentvision.crm.data.model.VisitTreatment
import kz.dentvision.crm.ui.common.UiState

data class VisitsUiState(
    val patient: Patient? = null,
    val list: UiState<List<Visit>> = UiState.Data(emptyList()),
    val doctors: List<Doctor> = emptyList(),
)

data class VisitFormState(
    val doctorId: String = "",
    val complaints: String = "",
    val diagnosis: String = "",
    val anamnesis: String = "",
    val plan: String = "",
    val proceduresDone: String = "",
    val prescriptions: String = "",
    val icd10Codes: String = "",
    val nextVisitDate: String = "",
    val notes: String = "",
    val saving: Boolean = false,
    val error: String? = null,
) {
    val canSave: Boolean get() = doctorId.isNotBlank() && !saving
}

class VisitsViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(VisitsUiState())
    val state: StateFlow<VisitsUiState> = _state

    private val _form = MutableStateFlow(VisitFormState())
    val form: StateFlow<VisitFormState> = _form

    fun loadDoctors(clinicId: String?) {
        if (clinicId == null || _state.value.doctors.isNotEmpty()) return
        viewModelScope.launch {
            runCatching { repository.doctors(clinicId) }
                .onSuccess { _state.value = _state.value.copy(doctors = it) }
        }
    }

    fun selectPatient(patient: Patient) {
        _state.value = _state.value.copy(patient = patient, list = UiState.Loading)
        load()
    }

    fun load() {
        val patient = _state.value.patient ?: return
        _state.value = _state.value.copy(list = UiState.Loading)
        viewModelScope.launch {
            runCatching { repository.visits(patient.id) }
                .onSuccess { _state.value = _state.value.copy(list = UiState.Data(it)) }
                .onFailure {
                    _state.value = _state.value.copy(
                        list = UiState.Error(it.message ?: "Не удалось загрузить визиты"),
                    )
                }
        }
    }

    fun openForm() {
        _form.value = VisitFormState(doctorId = _state.value.doctors.firstOrNull()?.id.orEmpty())
    }

    fun updateForm(transform: (VisitFormState) -> VisitFormState) {
        _form.value = transform(_form.value).copy(error = null)
    }

    /**
     * У модели `Visit` на бэкенде восемь колонок, а форма собирает больше:
     * процедуры, назначения, дата следующего визита и коды МКБ-10 уезжают в
     * JSON-колонку `treatment`. Так устроен бэкенд, и веб пишет туда же —
     * заводить свою раскладку значило бы разойтись с браузером на одних и тех
     * же данных.
     */
    fun save(onSaved: () -> Unit) {
        val patient = _state.value.patient ?: return
        val form = _form.value
        if (!form.canSave) return
        _form.value = form.copy(saving = true, error = null)

        val treatment = VisitTreatment(
            plan = form.plan.trim().ifBlank { null },
            proceduresDone = form.proceduresDone.trim().ifBlank { null },
            prescriptions = form.prescriptions.trim().ifBlank { null },
            nextVisitDate = form.nextVisitDate.trim().ifBlank { null },
            icd10Codes = form.icd10Codes.trim().ifBlank { null },
        )
        val body = VisitCreate(
            patientId = patient.id,
            doctorId = form.doctorId,
            diagnosis = form.diagnosis.trim().ifBlank { null },
            complaints = form.complaints.trim().ifBlank { null },
            anamnesis = form.anamnesis.trim().ifBlank { null },
            notes = form.notes.trim().ifBlank { null },
            treatment = treatment,
        )

        viewModelScope.launch {
            runCatching { repository.createVisit(body) }
                .onSuccess {
                    _form.value = VisitFormState()
                    load()
                    onSaved()
                }
                .onFailure {
                    _form.value = _form.value.copy(
                        saving = false,
                        error = it.message ?: "Не удалось записать визит",
                    )
                }
        }
    }
}
