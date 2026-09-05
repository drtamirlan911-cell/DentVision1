package kz.dentvision.crm.ui.cashier

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.CrmRepository
import kz.dentvision.crm.data.model.Invoice
import kz.dentvision.crm.data.model.InvoiceCreate
import kz.dentvision.crm.data.model.InvoiceItem
import kz.dentvision.crm.data.model.Patient
import kz.dentvision.crm.ui.common.UiState

data class CashierUiState(
    val list: UiState<List<Invoice>> = UiState.Loading,
)

/**
 * Черновик счёта. Способ оплаты уезжает в `payMethod` — бэкенд прячет его в
 * заметке (`[payMethod:...]`) и оттуда же читает для разбивки выручки по
 * способам в отчёте.
 */
data class InvoiceFormState(
    val patient: Patient? = null,
    val service: String = "",
    val amount: String = "",
    val payMethod: String = "cash",
    val markPaid: Boolean = true,
    val notes: String = "",
    val saving: Boolean = false,
    val error: String? = null,
) {
    val amountValue: Int? get() = amount.filter { it.isDigit() }.toIntOrNull()
    val canSave: Boolean
        get() = patient != null && (amountValue ?: 0) > 0 && !saving
}

val PAY_METHODS: List<Pair<String, String>> = listOf(
    "cash" to "Наличные",
    "card" to "Карта",
    "kaspi" to "Kaspi",
    "transfer" to "Перевод",
)

class CashierViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(CashierUiState())
    val state: StateFlow<CashierUiState> = _state

    private val _form = MutableStateFlow(InvoiceFormState())
    val form: StateFlow<InvoiceFormState> = _form

    init {
        load()
    }

    fun load() {
        _state.value = CashierUiState(list = UiState.Loading)
        viewModelScope.launch {
            runCatching { repository.invoices() }
                .onSuccess { _state.value = CashierUiState(list = UiState.Data(it)) }
                .onFailure {
                    _state.value = CashierUiState(
                        list = UiState.Error(it.message ?: "Не удалось загрузить счета"),
                    )
                }
        }
    }

    fun openForm() {
        _form.value = InvoiceFormState()
    }

    fun updateForm(transform: (InvoiceFormState) -> InvoiceFormState) {
        _form.value = transform(_form.value).copy(error = null)
    }

    fun save(onSaved: () -> Unit) {
        val form = _form.value
        val patient = form.patient ?: return
        val amount = form.amountValue ?: return
        if (!form.canSave) return
        _form.value = form.copy(saving = true, error = null)

        val service = form.service.trim()
        val body = InvoiceCreate(
            patientId = patient.id,
            amount = amount,
            items = if (service.isNotBlank()) {
                listOf(InvoiceItem(name = service, price = amount, qty = 1))
            } else {
                emptyList()
            },
            notes = form.notes.trim().ifBlank { null },
            payMethod = form.payMethod,
        )

        viewModelScope.launch {
            runCatching { repository.createInvoice(body, markPaid = form.markPaid) }
                .onSuccess {
                    _form.value = InvoiceFormState()
                    load()
                    onSaved()
                }
                .onFailure {
                    _form.value = _form.value.copy(
                        saving = false,
                        error = it.message ?: "Не удалось создать счёт",
                    )
                }
        }
    }
}
