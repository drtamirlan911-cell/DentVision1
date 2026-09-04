package kz.dentvision.crm.ui.diagnostics

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.DiagnosticsRepository
import kz.dentvision.crm.data.model.CollectPaymentRequest
import kz.dentvision.crm.data.model.PaymentReferral
import kz.dentvision.crm.data.model.PricingItem
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.lib.formatTenge
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme

data class CartItem(val studyId: String, val name: String, val price: Double)

data class CashierState(
    val loaded: UiState<Unit> = UiState.Loading,
    val referrals: List<PaymentReferral> = emptyList(),
    val pricing: List<PricingItem> = emptyList(),
    val selectedId: String? = null,
    val cart: List<CartItem> = emptyList(),
    val paidAmount: String = "",
    val feePercent: String = "10",
    val submitting: Boolean = false,
    val error: String? = null,
    val message: String? = null,
)

/**
 * Перенос `CashierTab.tsx` — приём оплаты от пациента за уже принятое
 * направление. Очередь и прайс — уже построенные ручки (`payments`,
 * Этап 6b; `centerPricing`/`labPricing`, Этап 5b). «Комиссия платформы, %»
 * на чеке — целиком локальная прикидка: сервер комиссию из тела не
 * читает вовсе, считает сам через `resolveCommissionBps` — переношу
 * дословно, не выдаю прикидку за реальную величину.
 */
class CashierViewModel(
    private val repository: DiagnosticsRepository = DiagnosticsRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(CashierState())
    val state: StateFlow<CashierState> = _state

    private var kind: OperatorKind = OperatorKind.CENTER
    private var orgId: String = ""
    private var startedFor: String? = null

    fun start(kind: OperatorKind, orgId: String) {
        val key = "$kind:$orgId"
        if (startedFor == key) return
        startedFor = key
        this.kind = kind
        this.orgId = orgId
        load()
    }

    fun load() {
        _state.update { it.copy(loaded = UiState.Loading) }
        viewModelScope.launch {
            runCatching {
                coroutineScope {
                    val payments = async {
                        if (kind == OperatorKind.CENTER) repository.payments(centerId = orgId) else repository.payments(labId = orgId)
                    }
                    val pricing = async {
                        if (kind == OperatorKind.CENTER) repository.centerPricing(orgId) else repository.labPricing(orgId)
                    }
                    payments.await() to pricing.await()
                }
            }
                .onSuccess { (payments, pricing) ->
                    _state.update {
                        it.copy(loaded = UiState.Data(Unit), referrals = payments.referrals, pricing = pricing.filter { p -> p.active })
                    }
                }
                .onFailure { e -> _state.update { it.copy(loaded = UiState.Error(e.message ?: "Не удалось получить очередь оплаты")) } }
        }
    }

    fun select(referralId: String) {
        _state.update { it.copy(selectedId = referralId, cart = emptyList(), paidAmount = "", error = null) }
    }

    fun addToCart(item: PricingItem) {
        val price = item.price?.toDoubleOrNull() ?: return
        _state.update {
            if (it.cart.any { c -> c.studyId == item.id }) it else it.copy(cart = it.cart + CartItem(item.id, item.name, price))
        }
    }

    fun removeFromCart(studyId: String) {
        _state.update { it.copy(cart = it.cart.filterNot { c -> c.studyId == studyId }) }
    }

    fun setPaidAmount(v: String) {
        _state.update { it.copy(paidAmount = v) }
    }

    fun setFeePercent(v: String) {
        _state.update { it.copy(feePercent = v) }
    }

    fun collect(total: Int) {
        val target = _state.value.selectedId ?: return
        val paid = _state.value.paidAmount.toDoubleOrNull() ?: total.toDouble()
        if (paid <= 0) return
        _state.update { it.copy(submitting = true, error = null, message = null) }
        val body = CollectPaymentRequest(referralId = target, cost = paid)
        viewModelScope.launch {
            runCatching {
                if (kind == OperatorKind.CENTER) repository.collectPayment(body, centerId = orgId) else repository.collectPayment(body, labId = orgId)
            }
                .onSuccess {
                    _state.update {
                        it.copy(submitting = false, selectedId = null, cart = emptyList(), paidAmount = "", message = "Оплата ${paid.toInt()} ₸ принята")
                    }
                    load()
                }
                .onFailure { e -> _state.update { it.copy(submitting = false, error = e.message ?: "Не удалось принять оплату") } }
        }
    }
}

@Composable
fun CashierScreen(session: Session, viewModel: CashierViewModel = viewModel()) {
    val kind = if (session.user.organizationType == "LABORATORY") OperatorKind.LAB else OperatorKind.CENTER
    val orgId = session.user.organizationId

    if (orgId == null) {
        Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
            Text(
                text = "Не удалось определить организацию текущего рабочего пространства.",
                style = MaterialTheme.typography.bodyMedium,
                color = DvTheme.colors.textMuted,
            )
        }
        return
    }

    LaunchedEffect(kind, orgId) { viewModel.start(kind, orgId) }
    val state by viewModel.state.collectAsStateWithLifecycle()

    when (val loaded = state.loaded) {
        is UiState.Loading -> LoadingSkeleton()
        is UiState.Error -> ErrorState(message = loaded.message, onRetry = viewModel::load)
        is UiState.Data -> CashierContent(kind = kind, state = state, viewModel = viewModel)
    }
}

@Composable
private fun CashierContent(kind: OperatorKind, state: CashierState, viewModel: CashierViewModel) {
    val unpaid = state.referrals.filter { !it.paid }
    val selected = unpaid.find { it.id == state.selectedId }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(text = "Касса", style = MaterialTheme.typography.titleLarge, color = DvTheme.colors.textPrimary)
        Text(
            text = "Очередь оплаты (${unpaid.size})",
            style = MaterialTheme.typography.labelMedium,
            color = DvTheme.colors.textGhost,
        )

        if (unpaid.isEmpty()) {
            Text(text = "Нет неоплаченных направлений", style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textMuted)
        } else {
            unpaid.forEach { referral ->
                QueueRow(referral = referral, active = referral.id == state.selectedId, onClick = { viewModel.select(referral.id) })
            }
        }

        if (selected != null) {
            HorizontalDivider(color = DvTheme.colors.borderSubtle)
            CheckoutCard(kind = kind, selected = selected, state = state, viewModel = viewModel)
        }

        state.message?.let { Text(text = it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.success) }
    }
}

@Composable
private fun QueueRow(referral: PaymentReferral, active: Boolean, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = if (active) DvTheme.colors.gold.copy(alpha = 0.08f) else DvTheme.colors.surface1),
        border = BorderStroke(1.dp, if (active) DvTheme.colors.gold else DvTheme.colors.borderSubtle),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                Text(text = referral.patientName.ifBlank { "Неизвестно" }, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                Text(text = referral.studyType.ifBlank { "—" }, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
            }
            Text(
                text = formatTenge(referral.cost.asTengeOrNull() ?: 0),
                style = MaterialTheme.typography.bodyMedium,
                color = DvTheme.colors.gold,
            )
        }
    }
}

@Composable
private fun CheckoutCard(kind: OperatorKind, selected: PaymentReferral, state: CashierState, viewModel: CashierViewModel) {
    val baseCost = selected.cost.asTengeOrNull() ?: 0
    val cartTotal = state.cart.sumOf { it.price }
    val total = baseCost + cartTotal.toInt()
    val paid = state.paidAmount.toDoubleOrNull() ?: total.toDouble()
    val fee = Math.round(paid * (state.feePercent.toDoubleOrNull() ?: 0.0) / 100.0)
    val net = paid - fee
    val addedIds = state.cart.map { it.studyId }.toSet()
    val available = state.pricing.filterNot { it.id in addedIds }

    Card(
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                text = "Касса — ${selected.patientName.ifBlank { "Пациент" }}",
                style = MaterialTheme.typography.titleMedium,
                color = DvTheme.colors.textPrimary,
            )

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(text = "Направление · ${selected.studyType.ifBlank { "—" }}", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
                Text(text = formatTenge(baseCost), style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textPrimary)
            }
            state.cart.forEach { item ->
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = item.name, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(text = formatTenge(item.price.toInt()), style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textPrimary)
                        Text(
                            text = "убрать",
                            style = MaterialTheme.typography.labelSmall,
                            color = DvTheme.colors.error,
                            modifier = Modifier.clickable { viewModel.removeFromCart(item.studyId) },
                        )
                    }
                }
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(text = "Стоимость услуг", style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                Text(text = formatTenge(total), style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
            }

            if (available.isNotEmpty()) {
                Text(
                    text = if (kind == OperatorKind.LAB) "Анализы лаборатории (добавить к оплате)" else "Услуги центра (добавить к оплате)",
                    style = MaterialTheme.typography.labelMedium,
                    color = DvTheme.colors.textGhost,
                )
                available.forEach { item ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { viewModel.addToCart(item) }
                            .padding(vertical = 6.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(text = item.name, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textPrimary)
                        item.price?.toDoubleOrNull()?.let {
                            Text(text = formatTenge(it.toInt()), style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.gold)
                        }
                    }
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = state.paidAmount,
                    onValueChange = viewModel::setPaidAmount,
                    label = { Text("Пациент платит (₸)") },
                    placeholder = { Text(total.toString()) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                )
                OutlinedTextField(
                    value = state.feePercent,
                    onValueChange = viewModel::setFeePercent,
                    label = { Text("Комиссия, %") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                )
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(DvTheme.colors.surface0)
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                    Text(text = "Принято от пациента", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
                    Text(text = formatTenge(paid.toInt()), style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                }
                Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                    Text(text = "Комиссия платформы", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
                    Text(text = formatTenge(fee.toInt()), style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.gold)
                }
                HorizontalDivider(color = DvTheme.colors.borderSubtle)
                Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                    Text(text = "К выплате центру", style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                    Text(text = formatTenge(net.toInt()), style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.success)
                }
            }

            state.error?.let { Text(text = it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.error) }

            DvPrimaryButton(
                onClick = { viewModel.collect(total) },
                enabled = !state.submitting && paid > 0,
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (state.submitting) {
                    CircularProgressIndicator(strokeWidth = 2.dp, color = DvTheme.colors.goldOn, modifier = Modifier.padding(2.dp))
                } else {
                    Text("Принять оплату ${paid.toInt()} ₸")
                }
            }
        }
    }
}
