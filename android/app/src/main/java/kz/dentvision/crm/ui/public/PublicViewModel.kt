package kz.dentvision.crm.ui.public

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.CommerceRepository
import kz.dentvision.crm.data.PublicRepository
import kz.dentvision.crm.data.model.PurchaseResult
import kz.dentvision.crm.data.model.SchoolCourse
import kz.dentvision.crm.data.model.ShopCategory
import kz.dentvision.crm.data.model.ShopProduct
import kz.dentvision.crm.ui.common.UiState

class ShopCatalogViewModel(
    private val repository: PublicRepository = PublicRepository(),
    private val commerce: CommerceRepository = CommerceRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<List<ShopProduct>>>(UiState.Loading)
    val state: StateFlow<UiState<List<ShopProduct>>> = _state

    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query

    private val _categories = MutableStateFlow<List<ShopCategory>>(emptyList())
    val categories: StateFlow<List<ShopCategory>> = _categories

    private val _category = MutableStateFlow<String?>(null)
    val category: StateFlow<String?> = _category

    private val _selected = MutableStateFlow<ShopProduct?>(null)
    val selected: StateFlow<ShopProduct?> = _selected

    private val _purchase = MutableStateFlow(PurchaseUiState())
    val purchase: StateFlow<PurchaseUiState> = _purchase

    private var job: Job? = null

    init {
        load("")
        viewModelScope.launch {
            // Список категорий короткий и общий для всей платформы — грузится
            // один раз, отдельно от каждой перезагрузки товаров.
            runCatching { repository.categories() }.onSuccess { _categories.value = it }
        }
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

    fun onCategoryChange(slug: String?) {
        _category.value = slug
        load(_query.value)
    }

    fun retry() = load(_query.value)

    fun openDetails(product: ShopProduct) {
        _selected.value = product
        _purchase.value = PurchaseUiState()
    }

    fun closeDetails() {
        _selected.value = null
    }

    fun buy(clinicId: String?, quantity: Int) {
        val product = _selected.value ?: return
        _purchase.value = _purchase.value.copy(purchasing = true, error = null)
        viewModelScope.launch {
            runCatching { commerce.buyProduct(product.id, quantity, clinicId) }
                .onSuccess { _purchase.value = _purchase.value.copy(purchasing = false, result = it) }
                .onFailure { _purchase.value = _purchase.value.copy(purchasing = false, error = it.message ?: "Не удалось оформить заказ") }
        }
    }

    fun consumePurchaseError() {
        _purchase.value = _purchase.value.copy(error = null)
    }

    private fun load(search: String) {
        _state.value = UiState.Loading
        viewModelScope.launch {
            runCatching { repository.products(search, _category.value) }
                .onSuccess { _state.value = UiState.Data(it) }
                .onFailure { _state.value = UiState.Error(it.message ?: "Каталог недоступен") }
        }
    }
}

class SchoolCatalogViewModel(
    private val repository: PublicRepository = PublicRepository(),
    private val commerce: CommerceRepository = CommerceRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<List<SchoolCourse>>>(UiState.Loading)
    val state: StateFlow<UiState<List<SchoolCourse>>> = _state

    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query

    // В отличие от товаров, у курсов нет отдельной ручки списка категорий —
    // категория здесь свободная строка на самом курсе (`SchoolCourse.category`).
    // Фильтруем на клиенте по уже загруженному списку, а не заводим лишний запрос.
    private val _category = MutableStateFlow<String?>(null)
    val category: StateFlow<String?> = _category

    private val _selected = MutableStateFlow<SchoolCourse?>(null)
    val selected: StateFlow<SchoolCourse?> = _selected

    private val _purchase = MutableStateFlow(PurchaseUiState())
    val purchase: StateFlow<PurchaseUiState> = _purchase

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

    fun onCategoryChange(category: String?) {
        _category.value = category
    }

    fun openDetails(course: SchoolCourse) {
        _selected.value = course
        _purchase.value = PurchaseUiState()
    }

    fun closeDetails() {
        _selected.value = null
    }

    fun enroll() {
        val course = _selected.value ?: return
        // `format` — свойство самого курса (вебинар/офис/учебник), а не выбор
        // покупателя, ровно как в `School.tsx::buy()`.
        val format = course.format ?: "webinar"
        _purchase.value = _purchase.value.copy(purchasing = true, error = null)
        viewModelScope.launch {
            runCatching { commerce.registerCourse(course.id, format) }
                .onSuccess { _purchase.value = _purchase.value.copy(purchasing = false, result = it) }
                .onFailure { _purchase.value = _purchase.value.copy(purchasing = false, error = it.message ?: "Не удалось оформить запись") }
        }
    }

    fun consumePurchaseError() {
        _purchase.value = _purchase.value.copy(error = null)
    }

    private fun load(search: String) {
        _state.value = UiState.Loading
        viewModelScope.launch {
            runCatching { repository.courses(search) }
                .onSuccess { _state.value = UiState.Data(it) }
                .onFailure { _state.value = UiState.Error(it.message ?: "Курсы недоступны") }
        }
    }
}

data class PurchaseUiState(
    val purchasing: Boolean = false,
    val result: PurchaseResult? = null,
    val error: String? = null,
)
