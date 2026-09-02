package kz.dentvision.crm.ui.inventory

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.CrmRepository
import kz.dentvision.crm.data.model.InventoryCreate
import kz.dentvision.crm.data.model.InventoryItem
import kz.dentvision.crm.ui.common.UiState

data class InventoryUiState(
    val list: UiState<List<InventoryItem>> = UiState.Loading,
    val query: String = "",
    val onlyLow: Boolean = false,
    /** Позиция, по которой сейчас идёт движение — чтобы не жать «+» дважды. */
    val adjustingId: String? = null,
    val error: String? = null,
)

data class InventoryFormState(
    val name: String = "",
    val quantity: String = "0",
    val minimum: String = "0",
    val unit: String = "шт",
    val price: String = "",
    val category: String = "",
    val supplier: String = "",
    val saving: Boolean = false,
    val error: String? = null,
) {
    val canSave: Boolean get() = name.isNotBlank() && !saving
}

class InventoryViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(InventoryUiState())
    val state: StateFlow<InventoryUiState> = _state

    private val _form = MutableStateFlow(InventoryFormState())
    val form: StateFlow<InventoryFormState> = _form

    private var all: List<InventoryItem> = emptyList()

    init {
        load()
    }

    fun load() {
        _state.value = _state.value.copy(list = UiState.Loading, error = null)
        viewModelScope.launch {
            runCatching { repository.inventory() }
                .onSuccess {
                    all = it
                    _state.value = _state.value.copy(list = UiState.Data(visible()))
                }
                .onFailure {
                    _state.value = _state.value.copy(
                        list = UiState.Error(it.message ?: "Не удалось загрузить склад"),
                    )
                }
        }
    }

    fun onQueryChange(value: String) {
        _state.value = _state.value.copy(query = value)
        _state.value = _state.value.copy(list = UiState.Data(visible()))
    }

    fun toggleOnlyLow() {
        _state.value = _state.value.copy(onlyLow = !_state.value.onlyLow)
        _state.value = _state.value.copy(list = UiState.Data(visible()))
    }

    private fun visible(): List<InventoryItem> {
        val q = _state.value.query.trim().lowercase()
        return all
            .filter { q.isEmpty() || it.name.lowercase().contains(q) || it.supplier.orEmpty().lowercase().contains(q) }
            .filter { !_state.value.onlyLow || it.isLow }
    }

    /**
     * Приход или списание.
     *
     * Остаток меняется движением, а не записью нового значения: «+1» — это
     * приход в журнале. Если бы клиент писал сюда посчитанное им число, он затёр
     * бы то, что параллельно списал закрытый приём.
     */
    fun adjust(item: InventoryItem, delta: Int) {
        if (_state.value.adjustingId != null) return
        _state.value = _state.value.copy(adjustingId = item.id, error = null)
        viewModelScope.launch {
            runCatching { repository.adjustInventory(item.id, delta) }
                .onSuccess {
                    all = all.map { row -> if (row.id == item.id) it else row }
                    _state.value = _state.value.copy(
                        adjustingId = null,
                        list = UiState.Data(visible()),
                    )
                }
                .onFailure {
                    _state.value = _state.value.copy(
                        adjustingId = null,
                        error = it.message ?: "Движение не прошло",
                    )
                }
        }
    }

    fun openForm() {
        _form.value = InventoryFormState()
    }

    fun updateForm(transform: (InventoryFormState) -> InventoryFormState) {
        _form.value = transform(_form.value).copy(error = null)
    }

    fun save(onSaved: () -> Unit) {
        val form = _form.value
        if (!form.canSave) return
        _form.value = form.copy(saving = true, error = null)
        val body = InventoryCreate(
            name = form.name.trim(),
            quantity = form.quantity.filter { it.isDigit() }.toIntOrNull() ?: 0,
            minimum = form.minimum.filter { it.isDigit() }.toIntOrNull() ?: 0,
            price = form.price.filter { it.isDigit() }.toIntOrNull(),
            unit = form.unit.trim().ifBlank { null },
            category = form.category.trim().ifBlank { null },
            supplier = form.supplier.trim().ifBlank { null },
        )
        viewModelScope.launch {
            runCatching { repository.createInventoryItem(body) }
                .onSuccess {
                    _form.value = InventoryFormState()
                    load()
                    onSaved()
                }
                .onFailure {
                    _form.value = _form.value.copy(
                        saving = false,
                        error = it.message ?: "Не удалось добавить позицию",
                    )
                }
        }
    }
}
