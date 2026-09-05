package kz.dentvision.crm.ui.jobs

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.JobsRepository
import kz.dentvision.crm.data.model.CreateJobRequest
import kz.dentvision.crm.data.model.JobVacancy
import kz.dentvision.crm.ui.common.UiState

data class JobsFilters(val query: String = "", val city: String = "")

/** Перенос `Jobs.tsx`: поиск/фильтр по городу с debounce 200-350 мс, свои отклики подгружаются отдельно, только для вошедших. */
class JobsViewModel(
    private val repository: JobsRepository = JobsRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<List<JobVacancy>>>(UiState.Loading)
    val state: StateFlow<UiState<List<JobVacancy>>> = _state

    private val _filters = MutableStateFlow(JobsFilters())
    val filters: StateFlow<JobsFilters> = _filters

    private val _appliedIds = MutableStateFlow<Set<String>>(emptySet())
    val appliedIds: StateFlow<Set<String>> = _appliedIds

    private var isAuthenticated = false
    private var started = false
    private var debounce: Job? = null

    fun start(authenticated: Boolean) {
        if (started) return
        started = true
        isAuthenticated = authenticated
        load()
    }

    fun onQueryChange(value: String) {
        _filters.value = _filters.value.copy(query = value)
        debounce?.cancel()
        debounce = viewModelScope.launch {
            delay(250)
            load()
        }
    }

    fun onCityChange(value: String) {
        _filters.value = _filters.value.copy(city = value)
        debounce?.cancel()
        load()
    }

    fun retry() = load()

    private fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            runCatching { repository.list(_filters.value.query, _filters.value.city) }
                .onSuccess { list ->
                    _state.value = UiState.Data(list)
                    if (isAuthenticated) loadApplications()
                }
                .onFailure { _state.value = UiState.Error(it.message ?: "Не удалось загрузить вакансии") }
        }
    }

    private fun loadApplications() {
        viewModelScope.launch {
            runCatching { repository.myApplications() }
                .onSuccess { apps -> _appliedIds.value = apps.map { it.vacancyId }.toSet() }
        }
    }

    fun apply(vacancyId: String, onResult: (success: Boolean, error: String?) -> Unit) {
        viewModelScope.launch {
            runCatching { repository.apply(vacancyId) }
                .onSuccess {
                    _appliedIds.value = _appliedIds.value + vacancyId
                    onResult(true, null)
                }
                .onFailure { onResult(false, it.message ?: "Не удалось откликнуться") }
        }
    }

    fun post(request: CreateJobRequest, onResult: (success: Boolean, error: String?) -> Unit) {
        viewModelScope.launch {
            runCatching { repository.create(request) }
                .onSuccess {
                    _filters.value = _filters.value.copy(city = request.city)
                    onResult(true, null)
                    load()
                }
                .onFailure { onResult(false, it.message ?: "Не удалось разместить") }
        }
    }
}
