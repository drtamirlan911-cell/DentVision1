package kz.dentvision.crm.ui.lab

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.CrmRepository
import kz.dentvision.crm.data.model.LabOrder
import kz.dentvision.crm.data.model.LabOrderCreate
import kz.dentvision.crm.data.model.Patient
import kz.dentvision.crm.ui.common.UiState

data class LabUiState(
    val list: UiState<List<LabOrder>> = UiState.Loading,
    val busyId: String? = null,
    val error: String? = null,
)

data class LabFormState(
    val patient: Patient? = null,
    val labType: String = "",
    val material: String = "",
    val shade: String = "",
    val toothNumber: String = "",
    val dueDate: String = "",
    val notes: String = "",
    val saving: Boolean = false,
    val error: String? = null,
) {
    val canSave: Boolean get() = patient != null && !saving
}

/**
 * Порядок статусов заказа. Кнопка «дальше» ведёт по нему, потому что заказ
 * лаборатории движется в одну сторону: приняли — делают — готов — выдали.
 */
private val STATUS_FLOW = listOf("pending", "in_progress", "ready", "delivered")

fun nextLabStatus(current: String): String? {
    val index = STATUS_FLOW.indexOf(current)
    // Незнакомый статус (или уже выданный заказ) двигать некуда.
    if (index < 0 || index == STATUS_FLOW.lastIndex) return null
    return STATUS_FLOW[index + 1]
}

class LabViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(LabUiState())
    val state: StateFlow<LabUiState> = _state

    private val _form = MutableStateFlow(LabFormState())
    val form: StateFlow<LabFormState> = _form

    init {
        load()
    }

    fun load() {
        _state.value = _state.value.copy(list = UiState.Loading, error = null)
        viewModelScope.launch {
            runCatching { repository.labOrders() }
                .onSuccess { _state.value = _state.value.copy(list = UiState.Data(it)) }
                .onFailure {
                    _state.value = _state.value.copy(
                        list = UiState.Error(it.message ?: "Не удалось загрузить заказы"),
                    )
                }
        }
    }

    fun advance(order: LabOrder) {
        val next = nextLabStatus(order.status) ?: return
        if (_state.value.busyId != null) return
        _state.value = _state.value.copy(busyId = order.id, error = null)
        viewModelScope.launch {
            runCatching { repository.setLabStatus(order.id, next) }
                .onSuccess {
                    val current = (_state.value.list as? UiState.Data)?.value.orEmpty()
                    _state.value = _state.value.copy(
                        busyId = null,
                        list = UiState.Data(current.map { row -> if (row.id == order.id) it else row }),
                    )
                }
                .onFailure {
                    _state.value = _state.value.copy(
                        busyId = null,
                        error = it.message ?: "Не удалось сменить статус",
                    )
                }
        }
    }

    fun openForm() {
        _form.value = LabFormState()
    }

    fun updateForm(transform: (LabFormState) -> LabFormState) {
        _form.value = transform(_form.value).copy(error = null)
    }

    fun save(onSaved: () -> Unit) {
        val form = _form.value
        val patient = form.patient ?: return
        if (!form.canSave) return
        _form.value = form.copy(saving = true, error = null)
        val body = LabOrderCreate(
            patientId = patient.id,
            patientName = patient.name.ifBlank { null },
            labType = form.labType.trim().ifBlank { null },
            material = form.material.trim().ifBlank { null },
            shade = form.shade.trim().ifBlank { null },
            toothNumber = form.toothNumber.trim().ifBlank { null },
            dueDate = form.dueDate.trim().ifBlank { null },
            notes = form.notes.trim().ifBlank { null },
        )
        viewModelScope.launch {
            runCatching { repository.saveLabOrder(body) }
                .onSuccess {
                    _form.value = LabFormState()
                    load()
                    onSaved()
                }
                .onFailure {
                    _form.value = _form.value.copy(
                        saving = false,
                        error = it.message ?: "Не удалось создать заказ",
                    )
                }
        }
    }
}
