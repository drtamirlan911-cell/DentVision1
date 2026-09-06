package kz.dentvision.crm.ui.supplier

import android.content.Context
import android.net.Uri
import android.util.Base64
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kz.dentvision.crm.data.SupplierRepository
import kz.dentvision.crm.data.model.CreateSupplierProductRequest
import kz.dentvision.crm.data.model.Supplier
import kz.dentvision.crm.data.model.SupplierCashbackRule
import kz.dentvision.crm.data.model.SupplierDashboard
import kz.dentvision.crm.data.model.UpdateSupplierProductRequest
import kz.dentvision.crm.data.model.UpdateSupplierProfileRequest

enum class SupplierTab { OVERVIEW, SALES, STOCK, RETURNS, ADS, DEMAND, CATALOG, PROFILE }

data class SupplierProductForm(
    val name: String = "",
    val price: String = "",
    val stock: String = "",
    val category: String = "",
    val description: String = "",
    val imageUrl: String? = null,
)

data class SupplierPromoForm(
    val productId: String = "",
    val title: String = "",
    val discountPercent: String = "10",
    val cashbackPercent: String = "10",
)

data class SupplierProfileForm(
    val name: String = "",
    val bin: String = "",
    val legalAddress: String = "",
    val contactPerson: String = "",
    val phone: String = "",
    val email: String = "",
)

data class SupplierUiState(
    val loading: Boolean = true,
    val loadError: String? = null,
    val supplier: Supplier? = null,
    val dashboard: SupplierDashboard? = null,
    val cashbackRules: List<SupplierCashbackRule> = emptyList(),
    val tab: SupplierTab = SupplierTab.OVERVIEW,
    val message: String? = null,

    val profileForm: SupplierProfileForm = SupplierProfileForm(),
    val savingProfile: Boolean = false,

    val addProductOpen: Boolean = false,
    val productForm: SupplierProductForm = SupplierProductForm(),
    val savingProduct: Boolean = false,
    val uploadingPhoto: Boolean = false,

    val promoOpen: Boolean = false,
    val promoForm: SupplierPromoForm = SupplierPromoForm(),
    val savingPromo: Boolean = false,

    val defaultCashbackPercent: String = "1",
    val savingCashback: Boolean = false,

    val requestingPayout: Boolean = false,
) {
    val canWrite: Boolean get() = supplier?.myRole == "owner" || supplier?.myRole == "manager"
}

private const val MAX_PHOTO_BYTES = 5 * 1024 * 1024

/**
 * Кабинет продавца — перенос `SupplierWorkspace.tsx`. В отличие от веба,
 * который держит скоуп-токен в стейте самого экрана (см. докстринг
 * `SupplierApi.kt`), сюда попадают только уже переключённые в пространство
 * SUPPLIER — регистрация нового поставщика с нуля здесь не строится, тем же
 * решением, что уже принято для «Кабинета диагностики» (см. `Destinations.kt`
 * `cabinetRouteFor`): без готового пространства пункт меню просто не
 * показывается, а не ведёт в недостроенный экран.
 */
class SupplierViewModel(
    private val repository: SupplierRepository = SupplierRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(SupplierUiState())
    val state: StateFlow<SupplierUiState> = _state

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(loading = true, loadError = null) }
        viewModelScope.launch {
            runCatching {
                val me = repository.me()
                val dashboard = repository.dashboard()
                val rules = runCatching { repository.cashbackRules() }.getOrDefault(emptyList())
                Triple(me, dashboard, rules)
            }.onSuccess { (me, dashboard, rules) ->
                val allRule = rules.find { it.scope == "ALL" && it.active }
                _state.update {
                    it.copy(
                        loading = false,
                        supplier = me,
                        dashboard = dashboard,
                        cashbackRules = rules,
                        defaultCashbackPercent = allRule?.let { r -> formatPercent(r.rateBps) } ?: it.defaultCashbackPercent,
                        profileForm = SupplierProfileForm(
                            name = me.name,
                            bin = me.bin.orEmpty(),
                            legalAddress = me.legalAddress.orEmpty(),
                            contactPerson = me.contactPerson.orEmpty(),
                            phone = me.phone.orEmpty(),
                            email = me.email.orEmpty(),
                        ),
                    )
                }
            }.onFailure { e ->
                _state.update { it.copy(loading = false, loadError = e.message ?: "Не удалось загрузить кабинет продавца") }
            }
        }
    }

    fun selectTab(tab: SupplierTab) {
        _state.update { it.copy(tab = tab) }
    }

    fun consumeMessage() {
        _state.update { it.copy(message = null) }
    }

    // ─────────────────────────── Товар ───────────────────────────

    fun openAddProduct() {
        _state.update { it.copy(addProductOpen = true, productForm = SupplierProductForm()) }
    }

    fun dismissAddProduct() {
        _state.update { it.copy(addProductOpen = false) }
    }

    fun updateProductForm(transform: (SupplierProductForm) -> SupplierProductForm) {
        _state.update { it.copy(productForm = transform(it.productForm)) }
    }

    /** Как `readImageAsDataUrl` на вебе — без сжатия, тот же лимит, что уже принят в `ProfileViewModel`. */
    fun setProductPhotoFromUri(context: Context, uri: Uri) {
        _state.update { it.copy(uploadingPhoto = true) }
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                        ?: error("Не удалось прочитать файл")
                    if (bytes.size > MAX_PHOTO_BYTES) error("Файл больше 5 МБ — сожмите фото и попробуйте снова")
                    val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
                    "data:$mime;base64,${Base64.encodeToString(bytes, Base64.NO_WRAP)}"
                }
            }
            result
                .onSuccess { dataUrl -> _state.update { it.copy(uploadingPhoto = false, productForm = it.productForm.copy(imageUrl = dataUrl)) } }
                .onFailure { e -> _state.update { it.copy(uploadingPhoto = false, message = e.message ?: "Не удалось загрузить фото") } }
        }
    }

    fun saveProduct() {
        val form = _state.value.productForm
        val price = form.price.toDoubleOrNull()
        if (form.name.isBlank() || price == null) {
            _state.update { it.copy(message = "Введите название и цену") }
            return
        }
        _state.update { it.copy(savingProduct = true) }
        viewModelScope.launch {
            runCatching {
                repository.createProduct(
                    CreateSupplierProductRequest(
                        name = form.name.trim(),
                        price = price,
                        stock = form.stock.toIntOrNull() ?: 0,
                        category = form.category.trim().ifBlank { null },
                        description = form.description.trim().ifBlank { null },
                        imageUrl = form.imageUrl,
                    ),
                )
            }.onSuccess {
                _state.update { it.copy(savingProduct = false, addProductOpen = false, message = "Товар добавлен") }
                load()
            }.onFailure { e ->
                _state.update { it.copy(savingProduct = false, message = e.message ?: "Ошибка при добавлении") }
            }
        }
    }

    fun deleteProduct(id: String) {
        viewModelScope.launch {
            runCatching { repository.deleteProduct(id) }
                .onSuccess { _state.update { it.copy(message = "Товар удалён") }; load() }
                .onFailure { e -> _state.update { it.copy(message = e.message ?: "Ошибка при удалении") } }
        }
    }

    fun updateStock(id: String, stock: Int) {
        viewModelScope.launch {
            runCatching { repository.updateProduct(id, UpdateSupplierProductRequest(stock = stock)) }
                .onSuccess { _state.update { it.copy(message = "Остаток обновлён") }; load() }
                .onFailure { e -> _state.update { it.copy(message = e.message ?: "Не удалось обновить остаток") } }
        }
    }

    fun toggleOwnBrand(productId: String, ownBrand: Boolean) {
        viewModelScope.launch {
            runCatching { repository.updateProduct(productId, UpdateSupplierProductRequest(ownBrand = ownBrand)) }
                .onSuccess { _state.update { it.copy(message = if (ownBrand) "Свой бренд" else "Обычный товар") }; load() }
                .onFailure { e -> _state.update { it.copy(message = e.message ?: "Ошибка") } }
        }
    }

    // ─────────────────────────── Заказы ───────────────────────────

    fun updateOrderStatus(id: String, status: String) {
        viewModelScope.launch {
            runCatching { repository.updateOrderStatus(id, status) }
                .onSuccess { _state.update { it.copy(message = "Статус заказа обновлён") }; load() }
                .onFailure { e -> _state.update { it.copy(message = e.message ?: "Не удалось обновить заказ") } }
        }
    }

    // ─────────────────────────── Реклама / кэшбэк ───────────────────────────

    fun openPromo(productId: String? = null) {
        _state.update { it.copy(promoOpen = true, promoForm = SupplierPromoForm(productId = productId ?: "")) }
    }

    fun dismissPromo() {
        _state.update { it.copy(promoOpen = false) }
    }

    fun updatePromoForm(transform: (SupplierPromoForm) -> SupplierPromoForm) {
        _state.update { it.copy(promoForm = transform(it.promoForm)) }
    }

    fun savePromo() {
        val form = _state.value.promoForm
        if (form.productId.isBlank()) {
            _state.update { it.copy(message = "Выберите товар") }
            return
        }
        _state.update { it.copy(savingPromo = true) }
        viewModelScope.launch {
            runCatching {
                repository.createPromotion(
                    productId = form.productId,
                    title = form.title.trim().ifBlank { null },
                    discountPercent = form.discountPercent.toIntOrNull() ?: 10,
                    cashbackPercent = form.cashbackPercent.toIntOrNull() ?: 10,
                )
            }.onSuccess {
                _state.update { it.copy(savingPromo = false, promoOpen = false, message = "Акция и правило кэшбэка созданы") }
                load()
            }.onFailure { e ->
                _state.update { it.copy(savingPromo = false, message = e.message ?: "Не удалось создать акцию") }
            }
        }
    }

    fun updateDefaultCashback(value: String) {
        _state.update { it.copy(defaultCashbackPercent = value) }
    }

    fun saveDefaultCashback() {
        val pct = _state.value.defaultCashbackPercent.toDoubleOrNull()?.coerceIn(0.0, 15.0) ?: return
        _state.update { it.copy(savingCashback = true) }
        viewModelScope.launch {
            runCatching { repository.upsertCashbackRule(scope = "ALL", productId = null, rateBps = Math.round(pct * 100).toInt()) }
                .onSuccess { _state.update { it.copy(savingCashback = false, message = "Базовый кэшбэк сохранён") }; load() }
                .onFailure { e -> _state.update { it.copy(savingCashback = false, message = e.message ?: "Ошибка") } }
        }
    }

    fun setProductCashback(productId: String, percentText: String) {
        val pct = percentText.toDoubleOrNull()?.coerceIn(0.0, 15.0) ?: return
        viewModelScope.launch {
            runCatching { repository.upsertCashbackRule(scope = "PRODUCT", productId = productId, rateBps = Math.round(pct * 100).toInt(), active = pct > 0) }
                .onSuccess { _state.update { it.copy(message = "Кэшбэк товара обновлён") }; load() }
                .onFailure { e -> _state.update { it.copy(message = e.message ?: "Ошибка") } }
        }
    }

    // ─────────────────────────── Выплата ───────────────────────────

    fun requestPayout() {
        val balance = _state.value.dashboard?.kpis?.balanceMinor?.toLongOrNull() ?: 0L
        if (balance <= 0) {
            _state.update { it.copy(message = "Нет средств для вывода") }
            return
        }
        _state.update { it.copy(requestingPayout = true) }
        viewModelScope.launch {
            runCatching { repository.requestPayout(balance.toString()) }
                .onSuccess { _state.update { it.copy(requestingPayout = false, message = "Заявка на выплату создана") }; load() }
                .onFailure { e -> _state.update { it.copy(requestingPayout = false, message = e.message ?: "Ошибка при запросе выплаты") } }
        }
    }

    // ─────────────────────────── Профиль ───────────────────────────

    fun updateProfileForm(transform: (SupplierProfileForm) -> SupplierProfileForm) {
        _state.update { it.copy(profileForm = transform(it.profileForm)) }
    }

    fun saveProfile() {
        val form = _state.value.profileForm
        _state.update { it.copy(savingProfile = true) }
        viewModelScope.launch {
            runCatching {
                repository.updateProfile(
                    UpdateSupplierProfileRequest(
                        name = form.name.trim().ifBlank { null },
                        bin = form.bin.trim().ifBlank { null },
                        legalAddress = form.legalAddress.trim().ifBlank { null },
                        contactPerson = form.contactPerson.trim().ifBlank { null },
                        phone = form.phone.trim().ifBlank { null },
                        email = form.email.trim().ifBlank { null },
                    ),
                )
            }.onSuccess {
                _state.update { it.copy(savingProfile = false, message = "Профиль сохранён") }
                load()
            }.onFailure { e ->
                _state.update { it.copy(savingProfile = false, message = e.message ?: "Ошибка") }
            }
        }
    }
}

private fun formatPercent(rateBps: Int): String {
    val pct = rateBps / 100.0
    return if (pct == pct.toInt().toDouble()) pct.toInt().toString() else String.format("%.1f", pct)
}
