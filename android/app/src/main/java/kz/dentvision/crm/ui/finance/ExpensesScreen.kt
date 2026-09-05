package kz.dentvision.crm.ui.finance

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
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.CrmRepository
import kz.dentvision.crm.data.model.Expense
import kz.dentvision.crm.data.model.ExpenseUpsert
import kz.dentvision.crm.lib.formatTenge
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvConfirmDialog
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme

/** Частые категории расходов — те же, что уже группирует отчёт (`ExpenseCategoryRow`). */
private val EXPENSE_CATEGORIES = listOf("Аренда", "Материалы", "Реклама", "Коммунальные", "Прочее")

data class ExpenseFormState(
    val category: String = EXPENSE_CATEGORIES.first(),
    val amount: String = "",
    val notes: String = "",
    val saving: Boolean = false,
    val error: String? = null,
) {
    val canSave: Boolean get() = (amount.toIntOrNull() ?: 0) > 0 && !saving
}

data class ExpensesUiState(
    val list: UiState<List<Expense>> = UiState.Loading,
    val message: String? = null,
)

/**
 * Расходы клиники — перенос `activeTab === 'expenses'` (`Cashier.tsx`), не
 * построенной на Android (найдено при аудите расхождений с вебом).
 * `POST/DELETE /api/crm/expenses` (`ops.routes.ts:158-193`) уже существуют
 * на бэкенде и ждали только экрана.
 */
class ExpensesViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(ExpensesUiState())
    val state: StateFlow<ExpensesUiState> = _state

    private val _form = MutableStateFlow(ExpenseFormState())
    val form: StateFlow<ExpenseFormState> = _form

    fun load() {
        _state.update { it.copy(list = UiState.Loading) }
        viewModelScope.launch {
            runCatching { repository.expenses() }
                .onSuccess { rows -> _state.update { it.copy(list = UiState.Data(rows)) } }
                .onFailure { e -> _state.update { it.copy(list = UiState.Error(e.message ?: "Не удалось загрузить расходы")) } }
        }
    }

    fun openForm() {
        _form.value = ExpenseFormState()
    }

    fun updateForm(transform: (ExpenseFormState) -> ExpenseFormState) {
        _form.value = transform(_form.value).copy(error = null)
    }

    fun save(onSaved: () -> Unit) {
        val form = _form.value
        val amount = form.amount.toIntOrNull() ?: return
        if (!form.canSave) return
        _form.value = form.copy(saving = true, error = null)
        viewModelScope.launch {
            runCatching {
                repository.saveExpense(
                    ExpenseUpsert(category = form.category, amount = amount, notes = form.notes.trim().ifBlank { null }),
                )
            }
                .onSuccess {
                    _form.value = ExpenseFormState()
                    _state.update { it.copy(message = "Расход добавлен") }
                    load()
                    onSaved()
                }
                .onFailure { e -> _form.value = _form.value.copy(saving = false, error = e.message ?: "Не удалось сохранить расход") }
        }
    }

    fun delete(id: String) {
        viewModelScope.launch {
            runCatching { repository.deleteExpense(id) }
                .onSuccess {
                    _state.update { it.copy(message = "Расход удалён") }
                    load()
                }
                .onFailure { e -> _state.update { it.copy(message = e.message ?: "Не удалось удалить расход") } }
        }
    }

    fun consumeMessage() {
        _state.update { it.copy(message = null) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExpensesScreen(canWrite: Boolean, viewModel: ExpensesViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var showForm by remember { mutableStateOf(false) }
    var pendingDelete by remember { mutableStateOf<Expense?>(null) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val snackbarHostState = remember { SnackbarHostState() }

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
                    Icon(Icons.Filled.Add, contentDescription = "Добавить расход")
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
                        title = "Расходов пока нет",
                        description = "Аренда, материалы, реклама — всё, что клиника тратит, кроме зарплаты.",
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(list.value, key = { it.id }) { expense ->
                            ExpenseRow(
                                expense = expense,
                                canDelete = canWrite,
                                onDelete = { pendingDelete = expense },
                            )
                        }
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
            ExpenseForm(viewModel = viewModel, onSaved = { showForm = false })
        }
    }

    pendingDelete?.let { expense ->
        DvConfirmDialog(
            title = "Удалить расход?",
            message = "«${expense.category}» на ${formatTenge(expense.amount)} будет удалён безвозвратно.",
            confirmLabel = "Удалить",
            onConfirm = {
                viewModel.delete(expense.id)
                pendingDelete = null
            },
            onDismiss = { pendingDelete = null },
        )
    }
}

@Composable
private fun ExpenseRow(expense: Expense, canDelete: Boolean, onDelete: () -> Unit) {
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
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = expense.category,
                    style = MaterialTheme.typography.titleMedium,
                    color = DvTheme.colors.textPrimary,
                )
                Text(
                    text = listOfNotNull(expense.date.ifBlank { null }, expense.notes?.ifBlank { null }).joinToString(" · "),
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.textMuted,
                )
            }
            Text(
                text = formatTenge(expense.amount),
                style = MaterialTheme.typography.titleMedium,
                color = DvTheme.colors.textSecondary,
            )
            if (canDelete) {
                IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
                    Icon(
                        Icons.Filled.Delete,
                        contentDescription = "Удалить расход",
                        tint = DvTheme.colors.textGhost,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun ExpenseForm(viewModel: ExpensesViewModel, onSaved: () -> Unit) {
    val form by viewModel.form.collectAsStateWithLifecycle()

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
            text = "Новый расход",
            style = MaterialTheme.typography.titleLarge,
            color = DvTheme.colors.textPrimary,
        )

        Text("Категория", style = MaterialTheme.typography.labelMedium, color = DvTheme.colors.textGhost)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            EXPENSE_CATEGORIES.forEach { category ->
                androidx.compose.material3.FilterChip(
                    selected = form.category == category,
                    onClick = { viewModel.updateForm { it.copy(category = category) } },
                    label = { Text(category, style = MaterialTheme.typography.labelSmall) },
                )
            }
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
                Text("Добавить расход")
            }
        }
    }
}
