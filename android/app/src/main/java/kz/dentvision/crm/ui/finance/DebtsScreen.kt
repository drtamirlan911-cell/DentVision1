package kz.dentvision.crm.ui.finance

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kz.dentvision.crm.ui.theme.DvConfirmDialog
import kz.dentvision.crm.ui.theme.DvConfirmVariant
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
import kz.dentvision.crm.data.CrmRepository
import kz.dentvision.crm.lib.buildWaLink
import kz.dentvision.crm.lib.formatTenge
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvOutlineButton
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme

data class DebtRow(
    val invoiceId: String,
    val patientName: String,
    val phone: String,
    val amount: Int,
    val date: String,
)

data class DebtsUiState(
    val list: UiState<List<DebtRow>> = UiState.Loading,
    val payingId: String? = null,
    val message: String? = null,
)

/**
 * Долги пациентов — перенос вкладки `activeTab === 'receivables'`
 * (`Cashier.tsx:678-724`), не построенной на Android (найдено при аудите
 * расхождений с вебом).
 *
 * «Долг» здесь — счёт в статусе `pending`: сервер (`billing.routes.ts`) не
 * хранит отдельного поля `paymentType`/`debt`, веб держит его только в своём
 * локальном кеше «оптимистично» — то есть на бэкенде долг неотличим от
 * любого другого ещё не оплаченного счёта. Показывать «pending» как долг —
 * не приближение, а буквально то же самое множество, что видит веб.
 */
class DebtsViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(DebtsUiState())
    val state: StateFlow<DebtsUiState> = _state

    fun load() {
        _state.update { it.copy(list = UiState.Loading) }
        viewModelScope.launch {
            runCatching {
                coroutineScope {
                    val invoices = async { repository.invoices(status = "pending") }
                    val patients = async { repository.patients() }
                    invoices.await() to patients.await()
                }
            }
                .onSuccess { (invoices, patients) ->
                    val byId = patients.associateBy { it.id }
                    val rows = invoices.map { invoice ->
                        val patient = invoice.patientId?.let { byId[it] }
                        DebtRow(
                            invoiceId = invoice.id,
                            patientName = patient?.name?.ifBlank { null } ?: "Пациент не указан",
                            phone = patient?.phone.orEmpty(),
                            amount = invoice.amount,
                            date = (invoice.createdAt ?: "").take(10),
                        )
                    }
                    _state.update { it.copy(list = UiState.Data(rows)) }
                }
                .onFailure { e ->
                    _state.update { it.copy(list = UiState.Error(e.message ?: "Не удалось загрузить долги")) }
                }
        }
    }

    fun pay(invoiceId: String) {
        _state.update { it.copy(payingId = invoiceId) }
        viewModelScope.launch {
            runCatching { repository.payInvoice(invoiceId) }
                .onSuccess {
                    _state.update { it.copy(payingId = null, message = "Долг погашен") }
                    load()
                }
                .onFailure { e ->
                    _state.update { it.copy(payingId = null, message = e.message ?: "Не удалось отметить оплату") }
                }
        }
    }

    fun consumeMessage() {
        _state.update { it.copy(message = null) }
    }

    fun reportNoPhone() {
        _state.update { it.copy(message = "У пациента нет телефона") }
    }

    fun reportNoWhatsApp() {
        _state.update { it.copy(message = "Не удалось открыть WhatsApp") }
    }
}

@Composable
fun DebtsScreen(canWrite: Boolean, viewModel: DebtsViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }
    var pendingPay by remember { mutableStateOf<DebtRow?>(null) }

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(state.message) {
        val message = state.message ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(message)
        viewModel.consumeMessage()
    }

    Scaffold(
        containerColor = DvTheme.colors.surface0,
        snackbarHost = {
            SnackbarHost(snackbarHostState) { data -> Snackbar(snackbarData = data, containerColor = DvTheme.colors.surface3) }
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            when (val list = state.list) {
                is UiState.Loading -> LoadingSkeleton()
                is UiState.Error -> ErrorState(message = list.message, onRetry = viewModel::load)
                is UiState.Data -> if (list.value.isEmpty()) {
                    EmptyStateView(
                        title = "Нет долгов",
                        description = "Долги появятся только из операций этой клиники.",
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(list.value, key = { it.invoiceId }) { debt ->
                            DebtRowCard(
                                debt = debt,
                                canWrite = canWrite,
                                paying = state.payingId == debt.invoiceId,
                                onPay = { pendingPay = debt },
                                onRemind = {
                                    if (debt.phone.isBlank()) {
                                        viewModel.reportNoPhone()
                                        return@DebtRowCard
                                    }
                                    val message = "Здравствуйте, ${debt.patientName}!\n\n" +
                                        "Напоминаем о задолженности ${formatTenge(debt.amount)} в клинике.\n" +
                                        "Оплатить можно в кассе или онлайн. Ответьте, если нужна помощь."
                                    try {
                                        context.startActivity(
                                            Intent(Intent.ACTION_VIEW, Uri.parse(buildWaLink(debt.phone, message))),
                                        )
                                    } catch (e: ActivityNotFoundException) {
                                        viewModel.reportNoWhatsApp()
                                    }
                                },
                            )
                        }
                    }
                }
            }
        }
    }

    pendingPay?.let { debt ->
        DvConfirmDialog(
            title = "Отметить оплаченным?",
            message = "«${debt.patientName}»: ${formatTenge(debt.amount)} будет отмечено как оплаченное. Действие необратимо.",
            confirmLabel = "Оплачено",
            variant = DvConfirmVariant.WARNING,
            onConfirm = {
                viewModel.pay(debt.invoiceId)
                pendingPay = null
            },
            onDismiss = { pendingPay = null },
        )
    }
}

@Composable
private fun DebtRowCard(
    debt: DebtRow,
    canWrite: Boolean,
    paying: Boolean,
    onPay: () -> Unit,
    onRemind: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.error.copy(alpha = 0.06f)),
        border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.error.copy(alpha = 0.2f)),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text(
                        text = debt.patientName,
                        style = MaterialTheme.typography.titleMedium,
                        color = DvTheme.colors.textPrimary,
                    )
                    if (debt.date.isNotBlank()) {
                        Text(
                            text = "от ${debt.date}",
                            style = MaterialTheme.typography.labelSmall,
                            color = DvTheme.colors.textMuted,
                        )
                    }
                }
                Text(
                    text = formatTenge(debt.amount),
                    style = MaterialTheme.typography.titleLarge,
                    color = DvTheme.colors.error,
                )
            }
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (canWrite) {
                    DvPrimaryButton(onClick = onPay, enabled = !paying, modifier = Modifier.weight(1f)) {
                        if (paying) {
                            CircularProgressIndicator(
                                strokeWidth = 2.dp,
                                color = DvTheme.colors.goldOn,
                                modifier = Modifier.size(16.dp),
                            )
                        } else {
                            Text("Оплатить")
                        }
                    }
                }
                DvOutlineButton(onClick = onRemind, modifier = Modifier.weight(1f)) {
                    Text("Напомнить")
                }
            }
        }
    }
}
