package kz.dentvision.crm.ui.pricelist

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.CrmRepository
import kz.dentvision.crm.data.model.PriceListItem
import kz.dentvision.crm.data.model.PriceListUpsert
import kz.dentvision.crm.ui.common.UiState

data class PriceListUiState(
    val list: UiState<List<PriceListItem>> = UiState.Loading,
    val query: String = "",
)

data class PriceFormState(
    /** Ключ позиции: бэкенд делает upsert по паре (клиника, serviceCode). */
    val serviceCode: String = "",
    val name: String = "",
    val price: String = "",
    val matCost: String = "",
    val saving: Boolean = false,
    val error: String? = null,
) {
    val priceValue: Int? get() = price.filter { it.isDigit() }.toIntOrNull()
    val canSave: Boolean
        get() = serviceCode.isNotBlank() && (priceValue ?: -1) >= 0 && !saving
}

class PriceListViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(PriceListUiState())
    val state: StateFlow<PriceListUiState> = _state

    private val _form = MutableStateFlow(PriceFormState())
    val form: StateFlow<PriceFormState> = _form

    private var all: List<PriceListItem> = emptyList()

    init {
        load()
    }

    fun load() {
        _state.value = _state.value.copy(list = UiState.Loading)
        viewModelScope.launch {
            runCatching { repository.priceList() }
                .onSuccess {
                    all = it
                    _state.value = _state.value.copy(list = UiState.Data(filter(it, _state.value.query)))
                }
                .onFailure {
                    _state.value = _state.value.copy(
                        list = UiState.Error(it.message ?: "Не удалось загрузить прайс"),
                    )
                }
        }
    }

    fun onQueryChange(value: String) {
        _state.value = _state.value.copy(query = value, list = UiState.Data(filter(all, value)))
    }

    private fun filter(source: List<PriceListItem>, query: String): List<PriceListItem> {
        val q = query.trim().lowercase()
        if (q.isEmpty()) return source
        return source.filter {
            it.serviceCode.lowercase().contains(q) || it.name.orEmpty().lowercase().contains(q)
        }
    }

    /** Правка существующей позиции: код услуги — ключ, поэтому он не меняется. */
    fun editItem(item: PriceListItem) {
        _form.value = PriceFormState(
            serviceCode = item.serviceCode,
            name = item.name.orEmpty(),
            price = item.price.toString(),
            matCost = item.matCost.toString(),
        )
    }

    fun newItem() {
        _form.value = PriceFormState()
    }

    fun updateForm(transform: (PriceFormState) -> PriceFormState) {
        _form.value = transform(_form.value).copy(error = null)
    }

    fun save(onSaved: () -> Unit) {
        val form = _form.value
        val price = form.priceValue ?: return
        if (!form.canSave) return
        _form.value = form.copy(saving = true, error = null)

        val body = PriceListUpsert(
            serviceCode = form.serviceCode.trim(),
            price = price,
            name = form.name.trim().ifBlank { null },
            matCost = form.matCost.filter { it.isDigit() }.toIntOrNull(),
        )
        viewModelScope.launch {
            runCatching { repository.savePriceItem(body) }
                .onSuccess {
                    _form.value = PriceFormState()
                    load()
                    onSaved()
                }
                .onFailure {
                    _form.value = _form.value.copy(
                        saving = false,
                        error = it.message ?: "Не удалось сохранить цену",
                    )
                }
        }
    }
}
