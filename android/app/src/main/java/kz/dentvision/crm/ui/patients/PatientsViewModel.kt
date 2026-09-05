package kz.dentvision.crm.ui.patients

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.CrmRepository
import kz.dentvision.crm.data.model.IinLookup
import kz.dentvision.crm.data.model.Patient
import kz.dentvision.crm.data.model.PatientUpsert
import kz.dentvision.crm.lib.isValidIin
import kz.dentvision.crm.lib.normalizeIin
import kz.dentvision.crm.ui.common.UiState

data class PatientsUiState(
    val list: UiState<List<Patient>> = UiState.Loading,
    val query: String = "",
    /** Ищем на сервере: набран полный ИИН, локального списка недостаточно. */
    val serverSearching: Boolean = false,
    val deletingId: String? = null,
    val deleteError: String? = null,
)

/**
 * Черновик карточки нового пациента. ИИН стоит первым — в Казахстане это
 * главный идентификатор, и вся форма строится вокруг него.
 */
data class PatientFormState(
    val iin: String = "",
    val noIinReason: String = "",
    val name: String = "",
    val phone: String = "",
    val email: String = "",
    val dob: String = "",
    val gender: String = "",
    val notes: String = "",
    val checking: Boolean = false,
    val saving: Boolean = false,
    val error: String? = null,
    /** Что справочник рассказал про этот номер — показывается человеку. */
    val lookup: IinLookup? = null,
    val lookupNote: String? = null,
) {
    val iinDigits: String get() = normalizeIin(iin)

    /**
     * Бэкенд требует при создании либо ИИН, либо явную причину его отсутствия.
     * Клиент это правило не смягчает — только сообщает о нём раньше, чем уйдёт
     * запрос.
     */
    val canSave: Boolean
        get() = name.isNotBlank() && !saving &&
            (isValidIin(iinDigits) || noIinReason.isNotBlank())

    val iinLooksWrong: Boolean
        get() = iinDigits.isNotEmpty() && iinDigits.length == 12 && !isValidIin(iinDigits)
}

class PatientsViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(PatientsUiState())
    val state: StateFlow<PatientsUiState> = _state

    private val _form = MutableStateFlow(PatientFormState())
    val form: StateFlow<PatientFormState> = _form

    private var searchJob: Job? = null
    private var allPatients: List<Patient> = emptyList()

    init {
        load()
    }

    fun load() {
        _state.value = _state.value.copy(list = UiState.Loading)
        viewModelScope.launch {
            runCatching { repository.patients() }
                .onSuccess {
                    allPatients = it
                    _state.value = _state.value.copy(list = UiState.Data(applyFilter(it, _state.value.query)))
                }
                .onFailure {
                    _state.value = _state.value.copy(
                        list = UiState.Error(it.message ?: "Не удалось загрузить пациентов"),
                    )
                }
        }
    }

    /**
     * Полный ИИН ищется на сервере, всё остальное — по уже загруженным записям.
     *
     * Разделение не косметическое: `iin` хранится зашифрованным со случайным
     * вектором, поэтому найти его подстрокой нельзя в принципе — равенство
     * живёт в слепом индексе, и только целый двенадцатизначный номер туда
     * попадает.
     */
    fun onQueryChange(value: String) {
        _state.value = _state.value.copy(query = value)
        searchJob?.cancel()

        val digits = normalizeIin(value)
        if (digits.length == 12) {
            searchJob = viewModelScope.launch {
                delay(300)
                _state.value = _state.value.copy(serverSearching = true)
                runCatching { repository.searchPatients(digits) }
                    .onSuccess {
                        _state.value = _state.value.copy(
                            list = UiState.Data(it),
                            serverSearching = false,
                        )
                    }
                    .onFailure {
                        _state.value = _state.value.copy(
                            list = UiState.Error(it.message ?: "Поиск не удался"),
                            serverSearching = false,
                        )
                    }
            }
            return
        }

        _state.value = _state.value.copy(
            list = UiState.Data(applyFilter(allPatients, value)),
            serverSearching = false,
        )
    }

    private fun applyFilter(source: List<Patient>, query: String): List<Patient> {
        val q = query.trim().lowercase()
        if (q.isEmpty()) return source
        return source.filter {
            it.name.lowercase().contains(q) ||
                it.phone.lowercase().contains(q) ||
                it.email.lowercase().contains(q)
        }
    }

    // ── Форма ──

    fun openForm() {
        _form.value = PatientFormState()
    }

    fun updateForm(transform: (PatientFormState) -> PatientFormState) {
        _form.value = transform(_form.value).copy(error = null)
    }

    /**
     * «Проверить» — тот же жест, что в государственных сервисах: человек
     * называет номер, а система отвечает тем, что уже про него знает, вместо
     * того чтобы спрашивать заново.
     *
     * Подставляется **только пустое**: то, что регистратура успела ввести
     * руками, справочник не перетирает.
     */
    fun checkIin() {
        val digits = _form.value.iinDigits
        if (digits.length != 12) {
            _form.value = _form.value.copy(error = "ИИН должен содержать 12 цифр")
            return
        }
        if (!isValidIin(digits)) {
            _form.value = _form.value.copy(error = "ИИН не проходит проверку контрольной цифры")
            return
        }
        _form.value = _form.value.copy(checking = true, error = null, lookupNote = null)
        viewModelScope.launch {
            runCatching { repository.lookupByIin(digits) }
                .onSuccess { lookup -> _form.value = applyLookup(_form.value, lookup) }
                .onFailure {
                    _form.value = _form.value.copy(
                        checking = false,
                        error = it.message ?: "Проверка не удалась",
                    )
                }
        }
    }

    private fun applyLookup(form: PatientFormState, lookup: IinLookup): PatientFormState {
        val suggested = lookup.suggested
        val filled = form.copy(
            checking = false,
            lookup = lookup,
            dob = form.dob.ifBlank { lookup.derived.birthDate.orEmpty() },
            gender = form.gender.ifBlank { lookup.derived.gender.orEmpty() },
            name = form.name.ifBlank { suggested?.name.orEmpty() },
            phone = form.phone.ifBlank { suggested?.phone.orEmpty() },
            email = form.email.ifBlank { suggested?.email.orEmpty() },
        )
        val note = when {
            lookup.existing != null ->
                "Такой пациент уже есть в этой клинике: ${lookup.existing.name}. Откройте его карту, а не заводите вторую."
            suggested != null ->
                "Имя, телефон и почта подставлены — этот человек уже известен платформе."
            else -> "Дата рождения и пол выведены из самого номера."
        }
        return filled.copy(lookupNote = note)
    }

    fun save(onSaved: () -> Unit) {
        val form = _form.value
        if (!form.canSave) return
        _form.value = form.copy(saving = true, error = null)
        viewModelScope.launch {
            val body = PatientUpsert(
                name = form.name.trim(),
                phone = form.phone.trim().ifBlank { null },
                email = form.email.trim().ifBlank { null },
                dob = form.dob.ifBlank { null },
                gender = form.gender.ifBlank { null },
                notes = form.notes.trim().ifBlank { null },
                iin = form.iinDigits.ifBlank { null },
                noIinReason = form.noIinReason.ifBlank { null },
            )
            runCatching { repository.savePatient(body) }
                .onSuccess {
                    _form.value = PatientFormState()
                    load()
                    onSaved()
                }
                .onFailure {
                    _form.value = _form.value.copy(
                        saving = false,
                        error = it.message ?: "Не удалось сохранить",
                    )
                }
        }
    }

    /**
     * `DELETE /api/patients/:id` уже был на бэкенде и в `CrmRepository`, но
     * ничто в UI его не вызывало — на экране не было ни одной кнопки
     * удаления (найдено при аудите бизнес-логики).
     */
    fun delete(id: String) {
        _state.value = _state.value.copy(deletingId = id)
        viewModelScope.launch {
            runCatching { repository.deletePatient(id) }
                .onSuccess {
                    allPatients = allPatients.filterNot { it.id == id }
                    _state.value = _state.value.copy(
                        list = UiState.Data(applyFilter(allPatients, _state.value.query)),
                        deletingId = null,
                    )
                }
                .onFailure {
                    _state.value = _state.value.copy(
                        deletingId = null,
                        deleteError = it.message ?: "Не удалось удалить пациента",
                    )
                }
        }
    }

    fun consumeDeleteError() {
        _state.value = _state.value.copy(deleteError = null)
    }
}
