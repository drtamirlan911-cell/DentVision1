package kz.dentvision.crm.ui.pricelist

import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
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
import kz.dentvision.crm.data.model.PriceListItem
import kz.dentvision.crm.lib.formatTenge
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

/** Прайс клиники: код услуги, цена и себестоимость материалов. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PriceListScreen(
    canWrite: Boolean,
    viewModel: PriceListViewModel = viewModel(),
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
                        viewModel.newItem()
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
                label = { Text("Код или название услуги") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            )

            when (val list = state.list) {
                is UiState.Loading -> LoadingSkeleton()
                is UiState.Error -> ErrorState(message = list.message, onRetry = viewModel::load)
                is UiState.Data -> if (list.value.isEmpty()) {
                    EmptyStateView(
                        title = if (state.query.isBlank()) "Прайс пуст" else "Ничего не нашли",
                        description = if (state.query.isBlank()) {
                            "Добавьте услуги — из них потом собираются счета и планы лечения."
                        } else {
                            null
                        },
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(list.value, key = { it.id }) { item ->
                            PriceRow(
                                item = item,
                                onClick = if (canWrite) {
                                    {
                                        viewModel.editItem(item)
                                        showForm = true
                                    }
                                } else {
                                    null
                                },
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
            PriceForm(viewModel = viewModel, onSaved = { showForm = false })
        }
    }
}

@Composable
private fun PriceRow(item: PriceListItem, onClick: (() -> Unit)?) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
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
                    text = item.name?.takeIf { it.isNotBlank() } ?: item.serviceCode,
                    style = MaterialTheme.typography.titleMedium,
                    color = DvTheme.colors.textPrimary,
                )
                val sub = buildString {
                    append(item.serviceCode)
                    if (item.matCost > 0) append(" · материалы ${formatTenge(item.matCost)}")
                }
                Text(
                    text = sub,
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.textMuted,
                )
            }
            Text(
                text = formatTenge(item.price),
                style = MaterialTheme.typography.titleMedium,
                color = DvTheme.colors.gold,
            )
        }
    }
}

@Composable
private fun PriceForm(viewModel: PriceListViewModel, onSaved: () -> Unit) {
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
            text = "Позиция прайса",
            style = MaterialTheme.typography.titleLarge,
            color = DvTheme.colors.textPrimary,
        )

        OutlinedTextField(
            value = form.serviceCode,
            onValueChange = { v -> viewModel.updateForm { it.copy(serviceCode = v) } },
            label = { Text("Код услуги") },
            supportingText = {
                Text("Ключ позиции: сохранение по существующему коду обновит цену, а не создаст дубль.")
            },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = form.name,
            onValueChange = { v -> viewModel.updateForm { it.copy(name = v) } },
            label = { Text("Название") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = form.price,
            onValueChange = { v -> viewModel.updateForm { it.copy(price = v.filter { c -> c.isDigit() }) } },
            label = { Text("Цена, ₸") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = form.matCost,
            onValueChange = { v -> viewModel.updateForm { it.copy(matCost = v.filter { c -> c.isDigit() }) } },
            label = { Text("Материалы, ₸") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
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
                Text("Сохранить")
            }
        }
    }
}
