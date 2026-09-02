package kz.dentvision.crm.ui.inventory

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
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
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
import kz.dentvision.crm.data.model.InventoryItem
import kz.dentvision.crm.lib.formatTenge
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

/** Склад: остатки, приход и списание, фильтр «заканчивается». */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InventoryScreen(
    canWrite: Boolean,
    viewModel: InventoryViewModel = viewModel(),
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
                    Icon(Icons.Filled.Add, contentDescription = "Добавить позицию")
                }
            }
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            OutlinedTextField(
                value = state.query,
                onValueChange = viewModel::onQueryChange,
                singleLine = true,
                label = { Text("Название или поставщик") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            )
            Row(modifier = Modifier.padding(horizontal = 16.dp)) {
                FilterChip(
                    selected = state.onlyLow,
                    onClick = viewModel::toggleOnlyLow,
                    label = { Text("Заканчивается") },
                )
            }

            state.error?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.error,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
                )
            }

            when (val list = state.list) {
                is UiState.Loading -> LoadingSkeleton()
                is UiState.Error -> ErrorState(message = list.message, onRetry = viewModel::load)
                is UiState.Data -> if (list.value.isEmpty()) {
                    EmptyStateView(
                        title = if (state.onlyLow) "Ничего не заканчивается" else "На складе пусто",
                        description = if (state.onlyLow) {
                            "Остатки выше минимума — заказывать пока нечего."
                        } else {
                            null
                        },
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(list.value, key = { it.id }) { item ->
                            InventoryRow(
                                item = item,
                                canWrite = canWrite,
                                busy = state.adjustingId == item.id,
                                onAdjust = { delta -> viewModel.adjust(item, delta) },
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
            InventoryForm(viewModel = viewModel, onSaved = { showForm = false })
        }
    }
}

@Composable
private fun InventoryRow(
    item: InventoryItem,
    canWrite: Boolean,
    busy: Boolean,
    onAdjust: (Int) -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.name,
                    style = MaterialTheme.typography.titleMedium,
                    color = DvTheme.colors.textPrimary,
                )
                val sub = listOfNotNull(
                    "${item.quantity} ${item.unit ?: "шт"}",
                    item.minimum.takeIf { it > 0 }?.let { "минимум $it" },
                    item.price?.takeIf { it > 0 }?.let { formatTenge(it) },
                    item.supplier?.takeIf { it.isNotBlank() },
                ).joinToString(" · ")
                Text(
                    text = sub,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (item.isLow) DvTheme.colors.warning else DvTheme.colors.textMuted,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }

            if (canWrite) {
                if (busy) {
                    CircularProgressIndicator(
                        strokeWidth = 2.dp,
                        color = DvTheme.colors.gold,
                        modifier = Modifier.size(18.dp),
                    )
                } else {
                    IconButton(onClick = { onAdjust(-1) }, enabled = item.quantity > 0) {
                        Icon(
                            Icons.Filled.Remove,
                            contentDescription = "Списать одну единицу",
                            tint = DvTheme.colors.textSecondary,
                        )
                    }
                    IconButton(onClick = { onAdjust(1) }) {
                        Icon(
                            Icons.Filled.Add,
                            contentDescription = "Приход одной единицы",
                            tint = DvTheme.colors.textSecondary,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun InventoryForm(viewModel: InventoryViewModel, onSaved: () -> Unit) {
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
            text = "Новая позиция склада",
            style = MaterialTheme.typography.titleLarge,
            color = DvTheme.colors.textPrimary,
        )

        OutlinedTextField(
            value = form.name,
            onValueChange = { v -> viewModel.updateForm { it.copy(name = v) } },
            label = { Text("Название") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            NumberField("Остаток", form.quantity, Modifier.weight(1f)) { v ->
                viewModel.updateForm { it.copy(quantity = v) }
            }
            NumberField("Минимум", form.minimum, Modifier.weight(1f)) { v ->
                viewModel.updateForm { it.copy(minimum = v) }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = form.unit,
                onValueChange = { v -> viewModel.updateForm { it.copy(unit = v) } },
                label = { Text("Единица") },
                singleLine = true,
                modifier = Modifier.weight(1f),
            )
            NumberField("Цена, ₸", form.price, Modifier.weight(1f)) { v ->
                viewModel.updateForm { it.copy(price = v) }
            }
        }
        OutlinedTextField(
            value = form.category,
            onValueChange = { v -> viewModel.updateForm { it.copy(category = v) } },
            label = { Text("Категория") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = form.supplier,
            onValueChange = { v -> viewModel.updateForm { it.copy(supplier = v) } },
            label = { Text("Поставщик") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        form.error?.let {
            Text(text = it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.error)
        }

        Button(
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
                Text("Добавить")
            }
        }
    }
}

@Composable
private fun NumberField(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    onChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = { onChange(it.filter { c -> c.isDigit() }) },
        label = { Text(label) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = modifier,
    )
}
