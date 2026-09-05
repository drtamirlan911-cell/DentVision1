package kz.dentvision.crm.ui.diagnostics

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
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
import kz.dentvision.crm.data.model.DiagnosticOrg
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Справочник — перенос `CenterList.tsx`/`LabList.tsx`, урезанный до чтения:
 * только просмотр (создание/редактирование центра или лаборатории —
 * действие суперадмина, вне этого клиента). Тот же
 * `DiagnosticOrgPickerViewModel`, что уже строит список для пикера в форме
 * направления — здесь он же, во весь экран, без выбора.
 */
@Composable
fun DirectoryScreen(
    kind: DiagnosticOrgKind,
    viewModel: DiagnosticOrgPickerViewModel = viewModel(),
) {
    viewModel.ensureLoaded(kind)
    val state by viewModel.state.collectAsStateWithLifecycle()
    var query by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it; viewModel.filter(it) },
            singleLine = true,
            label = { Text("Название или город") },
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        )

        when (val list = state) {
            is UiState.Loading -> LoadingSkeleton()
            is UiState.Error -> ErrorState(message = list.message, onRetry = { viewModel.load(kind) })
            is UiState.Data -> if (list.value.isEmpty()) {
                EmptyStateView(title = "Ничего не нашли")
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(list.value, key = { it.id }) { org -> OrgRow(org) }
                }
            }
        }
    }
}

@Composable
private fun OrgRow(org: DiagnosticOrg) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = org.name.ifBlank { "Без названия" },
                    style = MaterialTheme.typography.titleMedium,
                    color = DvTheme.colors.textPrimary,
                    modifier = Modifier.weight(1f),
                )
                if (org.accredited) {
                    Icon(
                        Icons.Filled.Verified,
                        contentDescription = "Аккредитован",
                        tint = DvTheme.colors.gold,
                        modifier = Modifier.padding(start = 6.dp),
                    )
                }
            }
            val sub = listOfNotNull(
                org.city?.takeIf { it.isNotBlank() },
                org.address?.takeIf { it.isNotBlank() },
            ).joinToString(" · ")
            if (sub.isNotBlank()) {
                Text(
                    text = sub,
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.textMuted,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            Row(modifier = Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                org.phone?.takeIf { it.isNotBlank() }?.let {
                    Text(text = it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textSecondary)
                }
                org.rating?.takeIf { it > 0 }?.let { rating ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(start = 12.dp),
                    ) {
                        Icon(Icons.Filled.Star, contentDescription = null, tint = DvTheme.colors.gold, modifier = Modifier.padding(end = 3.dp))
                        Text(text = String.format("%.1f", rating), style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textSecondary)
                    }
                }
            }
        }
    }
}
