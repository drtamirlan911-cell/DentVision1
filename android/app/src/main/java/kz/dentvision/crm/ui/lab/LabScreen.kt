package kz.dentvision.crm.ui.lab

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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kz.dentvision.crm.data.model.LAB_STATUS_LABELS
import kz.dentvision.crm.data.model.LabOrder
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.PatientPickerSheet
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

/** Заказы лаборатории: что заказано, для кого и на какой стадии. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LabScreen(
    canWrite: Boolean,
    viewModel: LabViewModel = viewModel(),
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
                    Icon(Icons.Filled.Add, contentDescription = "Новый заказ")
                }
            }
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
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
                        title = "Заказов нет",
                        description = "Здесь появятся коронки, вкладки и всё, что делает зуботехническая лаборатория.",
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(list.value, key = { it.id }) { order ->
                            LabRow(
                                order = order,
                                canWrite = canWrite,
                                busy = state.busyId == order.id,
                                onAdvance = { viewModel.advance(order) },
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
            LabForm(viewModel = viewModel, onSaved = { showForm = false })
        }
    }
}

@Composable
private fun LabRow(order: LabOrder, canWrite: Boolean, busy: Boolean, onAdvance: () -> Unit) {
    val next = nextLabStatus(order.status)
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = order.patientName.ifBlank { "Пациент" },
                    style = MaterialTheme.typography.titleMedium,
                    color = DvTheme.colors.textPrimary,
                )
                Text(
                    text = LAB_STATUS_LABELS[order.status] ?: order.status,
                    style = MaterialTheme.typography.labelMedium,
                    color = if (order.status == "delivered") DvTheme.colors.success else DvTheme.colors.gold,
                )
            }
            val details = listOfNotNull(
                order.labType?.takeIf { it.isNotBlank() },
                order.material.takeIf { it.isNotBlank() },
                order.shade.takeIf { it.isNotBlank() }?.let { "оттенок $it" },
                order.toothNumber.takeIf { it.isNotBlank() }?.let { "зуб $it" },
            ).joinToString(" · ")
            if (details.isNotBlank()) {
                Text(
                    text = details,
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.textSecondary,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            order.dueDate?.takeIf { it.isNotBlank() }?.let {
                Text(
                    text = "Срок: ${it.take(10)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.textMuted,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }

            if (canWrite && next != null) {
                if (busy) {
                    CircularProgressIndicator(
                        strokeWidth = 2.dp,
                        color = DvTheme.colors.gold,
                        modifier = Modifier.padding(top = 8.dp).size(18.dp),
                    )
                } else {
                    TextButton(onClick = onAdvance, modifier = Modifier.padding(top = 4.dp)) {
                        Text("→ ${LAB_STATUS_LABELS[next] ?: next}")
                    }
                }
            }
        }
    }
}

@Composable
private fun LabForm(viewModel: LabViewModel, onSaved: () -> Unit) {
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
            text = "Новый заказ лаборатории",
            style = MaterialTheme.typography.titleLarge,
            color = DvTheme.colors.textPrimary,
        )
        OutlinedButton(onClick = { picking = true }, modifier = Modifier.fillMaxWidth()) {
            Text(form.patient?.name?.ifBlank { "Без имени" } ?: "Выбрать пациента")
        }
        LabField("Что заказано", form.labType) { v -> viewModel.updateForm { it.copy(labType = v) } }
        LabField("Материал", form.material) { v -> viewModel.updateForm { it.copy(material = v) } }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = form.shade,
                onValueChange = { v -> viewModel.updateForm { it.copy(shade = v) } },
                label = { Text("Оттенок") },
                singleLine = true,
                modifier = Modifier.weight(1f),
            )
            OutlinedTextField(
                value = form.toothNumber,
                onValueChange = { v -> viewModel.updateForm { it.copy(toothNumber = v) } },
                label = { Text("Зуб") },
                singleLine = true,
                modifier = Modifier.weight(1f),
            )
        }
        LabField("Срок (ГГГГ-ММ-ДД)", form.dueDate) { v -> viewModel.updateForm { it.copy(dueDate = v) } }
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
                Text("Создать заказ")
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

@Composable
private fun LabField(label: String, value: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
    )
}
