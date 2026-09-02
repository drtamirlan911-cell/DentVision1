package kz.dentvision.crm.ui.patients

import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Search
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
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kz.dentvision.crm.data.model.Patient
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Пациенты: список, поиск и заведение новой карты.
 *
 * Поиск по полному ИИН уходит на сервер, всё остальное фильтруется на месте —
 * причина в шифровании номера, объяснена в `PatientsViewModel.onQueryChange`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PatientsScreen(
    canWrite: Boolean,
    viewModel: PatientsViewModel = viewModel(),
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
                    Icon(Icons.Filled.Add, contentDescription = "Добавить пациента")
                }
            }
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            OutlinedTextField(
                value = state.query,
                onValueChange = viewModel::onQueryChange,
                singleLine = true,
                label = { Text("Имя, телефон, почта или полный ИИН") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                trailingIcon = {
                    if (state.serverSearching) {
                        CircularProgressIndicator(
                            strokeWidth = 2.dp,
                            color = DvTheme.colors.gold,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            )

            when (val list = state.list) {
                is UiState.Loading -> LoadingSkeleton()
                is UiState.Error -> ErrorState(message = list.message, onRetry = viewModel::load)
                is UiState.Data -> if (list.value.isEmpty()) {
                    EmptyStateView(
                        title = if (state.query.isBlank()) "Пациентов пока нет" else "Никого не нашли",
                        description = if (state.query.isBlank()) {
                            "Заведите первую карту — начните с ИИН."
                        } else {
                            "Частичный ИИН не ищется: номер хранится зашифрованным, найти можно только целый."
                        },
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(list.value, key = { it.id }) { PatientRow(it) }
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
            PatientForm(viewModel = viewModel, onSaved = { showForm = false })
        }
    }
}

@Composable
private fun PatientRow(patient: Patient, onClick: (() -> Unit)? = null) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = patient.name.ifBlank { "Без имени" },
                    style = MaterialTheme.typography.titleMedium,
                    color = DvTheme.colors.textPrimary,
                )
                if (patient.iin.isBlank()) {
                    // Не упрёк регистратуре: карта могла быть заведена до того,
                    // как ИИН стал обязательным. Пометка нужна, чтобы справочник
                    // достраивался по мере того, как записи трогают.
                    Text(
                        text = "ИИН не указан",
                        style = MaterialTheme.typography.labelSmall,
                        color = DvTheme.colors.warning,
                    )
                }
            }
            val details = listOfNotNull(
                patient.phone.ifBlank { null },
                patient.dob.ifBlank { null },
            ).joinToString(" · ")
            if (details.isNotBlank()) {
                Text(
                    text = details,
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.textMuted,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            if (patient.iin.isNotBlank()) {
                Text(
                    text = "ИИН ${patient.iin}",
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.textGhost,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
    }
}
