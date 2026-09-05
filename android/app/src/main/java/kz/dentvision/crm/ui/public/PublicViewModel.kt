package kz.dentvision.crm.ui.public

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.PublicRepository
import kz.dentvision.crm.data.model.SchoolCourse
import kz.dentvision.crm.data.model.ShopProduct
import kz.dentvision.crm.ui.common.UiState

class ShopCatalogViewModel(
    private val repository: PublicRepository = PublicRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<List<ShopProduct>>>(UiState.Loading)
    val state: StateFlow<UiState<List<ShopProduct>>> = _state

    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query

    private var job: Job? = null

    init {
        load("")
    }

    fun onQueryChange(value: String) {
        _query.value = value
        job?.cancel()
        job = viewModelScope.launch {
            // Поиск на сервере: каталог общий для всей платформы, целиком его в
            // память телефона тянуть незачем, а маршрут искать умеет.
            delay(350)
            load(value)
        }
    }

    fun retry() = load(_query.value)

    private fun load(search: String) {
        _state.value = UiState.Loading
        viewModelScope.launch {
            runCatching { repository.products(search) }
                .onSuccess { _state.value = UiState.Data(it) }
                .onFailure { _state.value = UiState.Error(it.message ?: "Каталог недоступен") }
        }
    }
}

class SchoolCatalogViewModel(
    private val repository: PublicRepository = PublicRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<List<SchoolCourse>>>(UiState.Loading)
    val state: StateFlow<UiState<List<SchoolCourse>>> = _state

    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query

    private var job: Job? = null

    init {
        load("")
    }

    fun onQueryChange(value: String) {
        _query.value = value
        job?.cancel()
        job = viewModelScope.launch {
            delay(350)
            load(value)
        }
    }

    fun retry() = load(_query.value)

    private fun load(search: String) {
        _state.value = UiState.Loading
        viewModelScope.launch {
            runCatching { repository.courses(search) }
                .onSuccess { _state.value = UiState.Data(it) }
                .onFailure { _state.value = UiState.Error(it.message ?: "Курсы недоступны") }
        }
    }
}
