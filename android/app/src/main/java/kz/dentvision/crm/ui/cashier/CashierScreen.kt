package kz.dentvision.crm.ui.cashier

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kz.dentvision.crm.data.model.INVOICE_STATUS_LABELS
import kz.dentvision.crm.data.model.Invoice
import kz.dentvision.crm.lib.formatTenge
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.PatientPickerSheet
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvOutlineButton
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme

/** Касса: счета клиники и выставление нового. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CashierScreen(
    canWrite: Boolean,
    viewModel: CashierViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var showForm by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    Scaffold(
        containerColor = DvTheme.colors.surface0,
        floatingActionButton = {
            if (canWrite) {
                FloatingActionButton(
                    onClick = {
                        viewModel.openForm()
                        showForm = true
                    },
                    containerColor = DvTheme.colors.gold,
                    contentColor = DvTheme.colors.goldOn,
                ) {
                    Icon(Icons.Filled.Add, contentDescription = "Выставить счёт")
                }
            }
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            when (val list = state.list) {
                is UiState.Loading -> LoadingSkeleton()
                is UiState.Error -> ErrorState(message = list.message, onRetry = viewModel::load)
                is UiState.Data -> if (list.value.isEmpty()) {
                    EmptyStateView(
                        title = "Счетов пока нет",
                        description = "Здесь появятся оплаты и долги по мере работы кассы.",
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(list.value, key = { it.id }) { InvoiceRow(it) }
                    }
                }
            }
        }
    }

    if (showForm) {
        ModalBottomSheet(
            onDismissRequest = { showForm = false },
            sheetState = sheetState,
            containerColor = DvTheme.colors.surface1,
        ) {
            InvoiceForm(viewModel = viewModel, onSaved = { showForm = false })
        }
    }
}

@Composable
private fun InvoiceRow(invoice: Invoice) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text(
                    text = formatTenge(invoice.amount),
                    style = MaterialTheme.typography.titleMedium,
                    color = DvTheme.colors.textPrimary,
                )
                Text(
                    text = (invoice.paidAt ?: invoice.createdAt)?.take(10) ?: "",
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.textGhost,
                )
            }
            Text(
                text = INVOICE_STATUS_LABELS[invoice.status] ?: invoice.status,
                style = MaterialTheme.typography.labelMedium,
                color = if (invoice.status == "paid") DvTheme.colors.success else DvTheme.colors.warning,
            )
        }
    }
}

@Composable
private fun InvoiceForm(viewModel: CashierViewModel, onSaved: () -> Unit) {
    val form by viewModel.form.collectAsStateWithLifecycle()
    var picking by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .imePadding()
            .navigationBarsPadding()
            .padding(horizontal = 20.dp)
            .padding(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            text = "Новый счёт",
            style = MaterialTheme.typography.titleLarge,
            color = DvTheme.colors.textPrimary,
        )

        DvOutlineButton(onClick = { picking = true }, modifier = Modifier.fillMaxWidth()) {
            Text(form.patient?.name?.ifBlank { "Без имени" } ?: "Выбрать пациента")
        }

        OutlinedTextField(
            value = form.amount,
            onValueChange = { v -> viewModel.updateForm { it.copy(amount = v.filter { c -> c.isDigit() }) } },
            label = { Text("Сумма, ₸") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = form.service,
            onValueChange = { v -> viewModel.updateForm { it.copy(service = v) } },
            label = { Text("Услуга") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        Text(
            text = "Способ оплаты",
            style = MaterialTheme.typography.labelMedium,
            color = DvTheme.colors.textGhost,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            PAY_METHODS.forEach { (value, label) ->
                FilterChip(
                    selected = form.payMethod == value,
                    onClick = { viewModel.updateForm { it.copy(payMethod = value) } },
                    label = { Text(label, style = MaterialTheme.typography.labelSmall) },
                )
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text(
                    text = "Оплачен сразу",
                    style = MaterialTheme.typography.bodyMedium,
                    color = DvTheme.colors.textPrimary,
                )
                Text(
                    // Счёт всегда рождается в статусе «ожидает»; оплата — второй
                    // запрос. Выключенный переключатель оставляет долг, а не
                    // теряет счёт.
                    text = "Выключите, если пациент платит позже",
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.textMuted,
                )
            }
            Switch(
                checked = form.markPaid,
                onCheckedChange = { checked -> viewModel.updateForm { it.copy(markPaid = checked) } },
            )
        }

        OutlinedTextField(
            value = form.notes,
            onValueChange = { v -> viewModel.updateForm { it.copy(notes = v) } },
            label = { Text("Заметки") },
            minLines = 2,
            modifier = Modifier.fillMaxWidth(),
        )

        form.error?.let {
            Text(text = it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.error)
        }

        DvPrimaryButton(
            onClick = { viewModel.save(onSaved) },
            enabled = form.canSave,
            modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
        ) {
            if (form.saving) {
                CircularProgressIndicator(
                    strokeWidth = 2.dp,
                    color = DvTheme.colors.goldOn,
                    modifier = Modifier.size(18.dp),
                )
            } else {
                Text("Выставить счёт")
            }
        }
    }

    if (picking) {
        PatientPickerSheet(
            onDismiss = { picking = false },
            onSelect = { patient ->
                viewModel.updateForm { it.copy(patient = patient) }
                picking = false
            },
        )
    }
}
