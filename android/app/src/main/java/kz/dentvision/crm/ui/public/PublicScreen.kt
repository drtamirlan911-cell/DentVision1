package kz.dentvision.crm.ui.public

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kz.dentvision.crm.data.model.SchoolCourse
import kz.dentvision.crm.data.model.ShopProduct
import kz.dentvision.crm.lib.formatTenge
import kz.dentvision.crm.ui.common.DvLogo
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Что видно без входа.
 *
 * Здесь ровно то, что платформа и так отдаёт кому угодно: витрина магазина и
 * каталог школы. Оба маршрута открыты на бэкенде без `authenticate`, так что
 * это не послабление, придуманное на клиенте, а перенос уже принятого решения.
 *
 * Кабинета клиники тут нет и быть не может: пациенты, расписание и деньги —
 * чужие персональные и медицинские данные, показывать их до «кто вы» нельзя.
 *
 * Записи к врачу тоже нет, и причина не в лени: запись начинается со ссылки
 * конкретной клиники (`/book/:clinicId`), а публичного перечня клиник у
 * платформы нет — все списки клиник за входом. Собрать экран «выберите
 * клинику» не из чего, а выдумывать для этого маршрут я не стал.
 *
 * Баннер «Подключить центр или лабораторию» — из того же списка: `POST
 * /api/diagnostics/register` тоже заведён до `authenticate`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PublicScreen(onBack: () -> Unit, onSignIn: () -> Unit, onRegisterDiagnostics: () -> Unit) {
    var tab by remember { mutableIntStateOf(0) }

    Scaffold(
        containerColor = DvTheme.colors.surface0,
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        DvLogo(size = 28.dp, modifier = Modifier.padding(end = 10.dp))
                        Text(
                            text = "DentVision",
                            style = MaterialTheme.typography.titleMedium,
                            color = DvTheme.colors.textPrimary,
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Назад",
                            tint = DvTheme.colors.textSecondary,
                        )
                    }
                },
                actions = {
                    TextButton(onClick = onSignIn) { Text("Войти") }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = DvTheme.colors.surface1,
                ),
            )
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            RegisterDiagnosticsBanner(onClick = onRegisterDiagnostics)
            TabRow(
                selectedTabIndex = tab,
                containerColor = DvTheme.colors.surface1,
                contentColor = DvTheme.colors.gold,
            ) {
                Tab(
                    selected = tab == 0,
                    onClick = { tab = 0 },
                    text = { Text("Магазин", style = MaterialTheme.typography.labelLarge) },
                )
                Tab(
                    selected = tab == 1,
                    onClick = { tab = 1 },
                    text = { Text("Школа", style = MaterialTheme.typography.labelLarge) },
                )
            }
            when (tab) {
                0 -> ShopCatalog()
                else -> SchoolCatalog()
            }
        }
    }
}

@Composable
private fun RegisterDiagnosticsBanner(onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(16.dp, 12.dp, 16.dp, 0.dp).clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                Text(
                    text = "Диагностический центр или лаборатория?",
                    style = MaterialTheme.typography.bodyMedium,
                    color = DvTheme.colors.textPrimary,
                )
                Text(
                    text = "Подключитесь к платформе",
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.textMuted,
                )
            }
            Icon(
                Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = null,
                tint = DvTheme.colors.gold,
            )
        }
    }
}

@Composable
private fun ShopCatalog(viewModel: ShopCatalogViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val query by viewModel.query.collectAsStateWithLifecycle()

    Column(modifier = Modifier.fillMaxSize()) {
        SearchField(query, "Товар, бренд или поставщик", viewModel::onQueryChange)
        when (val list = state) {
            is UiState.Loading -> LoadingSkeleton()
            is UiState.Error -> ErrorState(message = list.message, onRetry = viewModel::retry)
            is UiState.Data -> if (list.value.isEmpty()) {
                EmptyStateView(title = "Ничего не нашли")
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(list.value, key = { it.id }) { ProductRow(it) }
                }
            }
        }
    }
}

@Composable
private fun ProductRow(product: ShopProduct) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
                Text(
                    text = product.name.ifBlank { "Без названия" },
                    style = MaterialTheme.typography.titleMedium,
                    color = DvTheme.colors.textPrimary,
                )
                val sub = listOfNotNull(
                    product.brand.ifBlank { null },
                    product.categoryName?.takeIf { it.isNotBlank() },
                    product.supplierName?.takeIf { it.isNotBlank() },
                    product.city?.takeIf { it.isNotBlank() },
                ).joinToString(" · ")
                if (sub.isNotBlank()) {
                    Text(
                        text = sub,
                        style = MaterialTheme.typography.bodySmall,
                        color = DvTheme.colors.textMuted,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = formatTenge(product.price),
                    style = MaterialTheme.typography.titleMedium,
                    color = DvTheme.colors.gold,
                )
                if (product.stock > 0) {
                    Text(
                        text = "в наличии",
                        style = MaterialTheme.typography.labelSmall,
                        color = DvTheme.colors.success,
                    )
                }
            }
        }
    }
}

@Composable
private fun SchoolCatalog(viewModel: SchoolCatalogViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val query by viewModel.query.collectAsStateWithLifecycle()

    Column(modifier = Modifier.fillMaxSize()) {
        SearchField(query, "Курс, тема или автор", viewModel::onQueryChange)
        when (val list = state) {
            is UiState.Loading -> LoadingSkeleton()
            is UiState.Error -> ErrorState(message = list.message, onRetry = viewModel::retry)
            is UiState.Data -> if (list.value.isEmpty()) {
                EmptyStateView(title = "Курсов не нашли")
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(list.value, key = { it.id }) { CourseRow(it) }
                }
            }
        }
    }
}

@Composable
private fun CourseRow(course: SchoolCourse) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = course.title.ifBlank { "Без названия" },
                    style = MaterialTheme.typography.titleMedium,
                    color = DvTheme.colors.textPrimary,
                    modifier = Modifier.weight(1f).padding(end = 12.dp),
                )
                course.price?.takeIf { it > 0 }?.let {
                    Text(
                        text = formatTenge(it),
                        style = MaterialTheme.typography.titleMedium,
                        color = DvTheme.colors.gold,
                    )
                }
            }
            val sub = listOfNotNull(
                course.instructor.ifBlank { null },
                course.academyName?.takeIf { it.isNotBlank() },
                course.category.takeIf { it.isNotBlank() },
            ).joinToString(" · ")
            if (sub.isNotBlank()) {
                Text(
                    text = sub,
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.textSecondary,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            val meta = listOfNotNull(
                course.lessonCount.takeIf { it > 0 }?.let { "$it уроков" },
                course.durationHours?.takeIf { it > 0 }?.let { "${it.toInt()} ч" },
                course.enrolledCount.takeIf { it > 0 }?.let { "$it учатся" },
            ).joinToString(" · ")
            if (meta.isNotBlank()) {
                Text(
                    text = meta,
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.textMuted,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
        }
    }
}

@Composable
private fun SearchField(value: String, label: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        singleLine = true,
        label = { Text(label) },
        leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
    )
}
