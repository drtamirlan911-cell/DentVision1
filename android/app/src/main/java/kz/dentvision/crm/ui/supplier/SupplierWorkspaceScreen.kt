package kz.dentvision.crm.ui.supplier

import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AttachMoney
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Tab
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import kz.dentvision.crm.data.model.SupplierOrder
import kz.dentvision.crm.data.model.SupplierProduct
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.theme.DvConfirmDialog
import kz.dentvision.crm.ui.theme.DvOutlineButton
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvSpacing
import kz.dentvision.crm.ui.theme.DvTheme

private val STATUS_LABELS = mapOf(
    "pending" to "На проверке",
    "documents_review" to "Проверка документов",
    "verified" to "Проверен",
    "official_partner" to "Официальный партнёр",
    "suspended" to "Приостановлен",
)

private val ORDER_STATUS_LABELS = mapOf(
    "pending" to "Новый",
    "awaiting_payment" to "Ждёт оплаты",
    "placed" to "Оформлен",
    "paid" to "Оплачен",
    "packing" to "Сборка",
    "shipped" to "В пути",
    "delivered" to "Доставлен",
    "cancelled" to "Отменён",
    "refunded" to "Возврат",
)

private fun money(minorString: String): String {
    val minor = minorString.toLongOrNull() ?: 0L
    return "${(minor / 100)} ₸"
}

private fun tenge(value: Double): String = "${Math.round(value)} ₸"

/**
 * Кабинет продавца — перенос `SupplierWorkspace.tsx`, все 8 вкладок.
 * Достижим только из уже переключённого пространства SUPPLIER
 * (`session.user.organizationType == "SUPPLIER_COMPANY"`, см. докстринг
 * `SupplierViewModel`), поэтому здесь нет состояния «зарегистрируйте
 * компанию» — им ведает `WorkspaceSwitcherSheet`, а не этот экран.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SupplierWorkspaceScreen(viewModel: SupplierViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

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
        when {
            state.loading -> LoadingSkeleton(modifier = Modifier.padding(padding))
            state.loadError != null -> ErrorState(message = state.loadError!!, onRetry = viewModel::load, modifier = Modifier.padding(padding))
            else -> SupplierContent(state = state, viewModel = viewModel, modifier = Modifier.padding(padding))
        }
    }

    if (state.addProductOpen) {
        AddProductSheet(viewModel = viewModel, state = state)
    }
    if (state.promoOpen) {
        PromoSheet(viewModel = viewModel, state = state)
    }
}

@Composable
private fun SupplierContent(state: SupplierUiState, viewModel: SupplierViewModel, modifier: Modifier = Modifier) {
    val dashboard = state.dashboard
    val supplier = state.supplier
    val kpis = dashboard?.kpis

    Column(modifier = modifier.fillMaxSize()) {
        Column(modifier = Modifier.padding(horizontal = DvSpacing.lg, vertical = DvSpacing.md)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Кабинет продавца",
                    style = MaterialTheme.typography.headlineSmall,
                    color = DvTheme.colors.textPrimary,
                    modifier = Modifier.weight(1f),
                )
                supplier?.let {
                    val verified = it.status == "verified" || it.status == "official_partner"
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (verified) DvTheme.colors.success.copy(alpha = 0.15f) else DvTheme.colors.gold.copy(alpha = 0.15f))
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                    ) {
                        Text(
                            text = STATUS_LABELS[it.status] ?: it.status,
                            style = MaterialTheme.typography.labelSmall,
                            color = if (verified) DvTheme.colors.success else DvTheme.colors.gold,
                        )
                    }
                }
            }
            Text(
                text = "${supplier?.name.orEmpty()} · кабинет продавца DentVision",
                style = MaterialTheme.typography.bodySmall,
                color = DvTheme.colors.textMuted,
                modifier = Modifier.padding(top = 2.dp),
            )
        }

        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            modifier = Modifier.fillMaxWidth().padding(horizontal = DvSpacing.lg),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            item { StatCell(Icons.Filled.AttachMoney, "К выплате", kpis?.balanceMinor?.let { money(it) } ?: "—") }
            item { StatCell(Icons.Filled.TrendingUp, "Выручка 30 дн", kpis?.revenue30?.let { tenge(it) } ?: "—") }
            item { StatCell(Icons.Filled.ReceiptLong, "Заказов", "${kpis?.orders30 ?: 0}") }
            item { StatCell(Icons.Filled.Star, "Рейтинг", kpis?.avgRating?.toString() ?: "—") }
            item { StatCell(Icons.Filled.Warning, "Низкий остаток", "${kpis?.lowStockCount ?: 0}") }
            item { StatCell(Icons.Filled.Inventory2, "Возвраты", "${kpis?.openReturns ?: 0}") }
        }

        ScrollableTabRow(
            selectedTabIndex = SupplierTab.entries.indexOf(state.tab),
            containerColor = DvTheme.colors.surface0,
            contentColor = DvTheme.colors.gold,
            edgePadding = DvSpacing.lg,
            modifier = Modifier.padding(top = DvSpacing.md),
        ) {
            SupplierTab.entries.forEach { tab ->
                Tab(
                    selected = state.tab == tab,
                    onClick = { viewModel.selectTab(tab) },
                    text = { Text(tabLabel(tab, dashboard), style = MaterialTheme.typography.labelLarge) },
                )
            }
        }

        Box(modifier = Modifier.fillMaxSize()) {
            when (state.tab) {
                SupplierTab.OVERVIEW -> OverviewTab(state, viewModel)
                SupplierTab.SALES -> SalesTab(state, viewModel)
                SupplierTab.STOCK -> StockTab(state, viewModel)
                SupplierTab.RETURNS -> ReturnsTab(state)
                SupplierTab.ADS -> AdsTab(state, viewModel)
                SupplierTab.DEMAND -> DemandTab(state, viewModel)
                SupplierTab.CATALOG -> CatalogTab(state, viewModel)
                SupplierTab.PROFILE -> ProfileTab(state, viewModel)
            }
        }
    }
}

private fun tabLabel(tab: SupplierTab, dashboard: kz.dentvision.crm.data.model.SupplierDashboard?): String = when (tab) {
    SupplierTab.OVERVIEW -> "Обзор"
    SupplierTab.SALES -> "Продажи" + ((dashboard?.orders?.size ?: 0).takeIf { it > 0 }?.let { " ($it)" } ?: "")
    SupplierTab.STOCK -> "Остатки" + ((dashboard?.kpis?.lowStockCount ?: 0).takeIf { it > 0 }?.let { " ($it)" } ?: "")
    SupplierTab.RETURNS -> "Возвраты" + ((dashboard?.kpis?.openReturns ?: 0).takeIf { it > 0 }?.let { " ($it)" } ?: "")
    SupplierTab.ADS -> "Реклама"
    SupplierTab.DEMAND -> "Спрос"
    SupplierTab.CATALOG -> "Каталог"
    SupplierTab.PROFILE -> "Профиль"
}

// ─────────────────────────── Обзор ───────────────────────────

@Composable
private fun OverviewTab(state: SupplierUiState, viewModel: SupplierViewModel) {
    val dashboard = state.dashboard
    LazyColumn(contentPadding = PaddingValues(DvSpacing.lg), verticalArrangement = Arrangement.spacedBy(DvSpacing.sm)) {
        if (state.canWrite) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = DvSpacing.sm)) {
                    DvOutlineButton(onClick = { viewModel.openPromo() }, modifier = Modifier.weight(1f)) { Text("Акция") }
                    DvPrimaryButton(onClick = viewModel::openAddProduct, modifier = Modifier.weight(1f)) { Text("Товар") }
                }
            }
        }
        val insights = dashboard?.insights.orEmpty()
        if (insights.isEmpty()) {
            item { EmptyHint("Пока нет новых уведомлений — здесь появятся подсказки по остаткам, спросу и отзывам.") }
        } else {
            items(insights, key = { it.id }) { insight ->
                InsightRow(insight, onClick = { if (insight.productName != null) viewModel.selectTab(SupplierTab.STOCK) })
            }
        }
        item {
            Text("Последние заказы", style = MaterialTheme.typography.labelLarge, color = DvTheme.colors.textMuted, modifier = Modifier.padding(top = DvSpacing.md, bottom = 4.dp))
        }
        val recentOrders = dashboard?.orders.orEmpty().take(4)
        if (recentOrders.isEmpty()) {
            item { EmptyHint("Заказов пока нет") }
        } else {
            items(recentOrders, key = { it.id }) { o ->
                MiniRow(title = o.clinicName ?: "Заказ", subtitle = tenge(o.subtotal))
            }
        }
        item {
            Text("Низкий остаток", style = MaterialTheme.typography.labelLarge, color = DvTheme.colors.textMuted, modifier = Modifier.padding(top = DvSpacing.md, bottom = 4.dp))
        }
        val lowStock = dashboard?.stock?.low.orEmpty().take(4)
        if (lowStock.isEmpty()) {
            item { EmptyHint("Все остатки в норме") }
        } else {
            items(lowStock, key = { it.id }) { p ->
                MiniRow(title = p.name, subtitle = "${p.stock} шт")
            }
        }
    }
}

@Composable
private fun InsightRow(insight: kz.dentvision.crm.data.model.SupplierInsight, onClick: () -> Unit) {
    val color = when (insight.severity) {
        "warning" -> DvTheme.colors.warning
        "success" -> DvTheme.colors.success
        else -> DvTheme.colors.info
    }
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, color.copy(alpha = 0.3f)),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(insight.title, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
            Text(insight.message, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted, modifier = Modifier.padding(top = 2.dp))
        }
    }
}

@Composable
private fun MiniRow(title: String, subtitle: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(title, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(subtitle, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
    }
}

@Composable
private fun EmptyHint(text: String) {
    Text(text, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted, modifier = Modifier.padding(vertical = 8.dp))
}

// ─────────────────────────── Продажи ───────────────────────────

@Composable
private fun SalesTab(state: SupplierUiState, viewModel: SupplierViewModel) {
    val orders = state.dashboard?.orders.orEmpty()
    if (orders.isEmpty()) {
        EmptyHint("Заказов пока нет")
        return
    }
    LazyColumn(contentPadding = PaddingValues(DvSpacing.lg), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(orders, key = { it.id }) { order -> OrderCard(order, state.canWrite, viewModel::updateOrderStatus) }
    }
}

@Composable
private fun OrderCard(order: SupplierOrder, canWrite: Boolean, onStatus: (String, String) -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(order.clinicName ?: order.buyerName ?: "Заказ", style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary, modifier = Modifier.weight(1f))
                Text(tenge(order.subtotal), style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.gold)
            }
            Text(
                text = ORDER_STATUS_LABELS[order.status] ?: order.status,
                style = MaterialTheme.typography.labelMedium,
                color = DvTheme.colors.textSecondary,
                modifier = Modifier.padding(top = 4.dp),
            )
            order.items.forEach { item ->
                Text("${item.name} × ${item.qty}", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted, modifier = Modifier.padding(top = 2.dp))
            }
            val terminal = order.status in setOf("delivered", "cancelled", "refunded")
            if (canWrite && !terminal) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 8.dp)) {
                    if (order.status != "packing") {
                        DvOutlineButton(onClick = { onStatus(order.id, "packing") }) { Text("В сборку", style = MaterialTheme.typography.labelSmall) }
                    }
                    if (order.status != "shipped") {
                        DvOutlineButton(onClick = { onStatus(order.id, "shipped") }) { Text("Отправить", style = MaterialTheme.typography.labelSmall) }
                    }
                    DvOutlineButton(onClick = { onStatus(order.id, "delivered") }) { Text("Доставлен", style = MaterialTheme.typography.labelSmall) }
                }
            }
        }
    }
}

// ─────────────────────────── Остатки ───────────────────────────

@Composable
private fun StockTab(state: SupplierUiState, viewModel: SupplierViewModel) {
    val products = state.dashboard?.products.orEmpty()
    Column(modifier = Modifier.fillMaxSize()) {
        if (state.canWrite) {
            Row(modifier = Modifier.padding(horizontal = DvSpacing.lg, vertical = DvSpacing.sm), horizontalArrangement = Arrangement.End) {
                DvOutlineButton(onClick = viewModel::openAddProduct) { Text("Добавить") }
            }
        }
        if (products.isEmpty()) {
            EmptyHint("Товаров пока нет")
        } else {
            LazyColumn(contentPadding = PaddingValues(horizontal = DvSpacing.lg, vertical = DvSpacing.sm), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(products, key = { it.id }) { product ->
                    StockRow(product, state.canWrite, onCommit = { newStock -> viewModel.updateStock(product.id, newStock) })
                }
            }
        }
    }
}

@Composable
private fun StockRow(product: SupplierProduct, canWrite: Boolean, onCommit: (Int) -> Unit) {
    var text by remember(product.id, product.stock) { mutableStateOf(product.stock.toString()) }
    val low = product.stock <= 5
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, if (low) DvTheme.colors.warning.copy(alpha = 0.5f) else DvTheme.colors.borderSubtle),
    ) {
        Row(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(product.name, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(product.category ?: "", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
            }
            OutlinedTextField(
                value = text,
                onValueChange = { text = it.filter(Char::isDigit) },
                enabled = canWrite,
                singleLine = true,
                modifier = Modifier.width(80.dp).padding(start = 8.dp),
                textStyle = MaterialTheme.typography.bodyMedium,
            )
            IconButton(onClick = { text.toIntOrNull()?.let(onCommit) }, enabled = canWrite && text.toIntOrNull() != product.stock) {
                Text("✓", color = DvTheme.colors.gold)
            }
        }
    }
}

// ─────────────────────────── Возвраты ───────────────────────────

@Composable
private fun ReturnsTab(state: SupplierUiState) {
    val returns = state.dashboard?.returns.orEmpty()
    if (returns.isEmpty()) {
        EmptyHint("Открытых возвратов нет")
        return
    }
    LazyColumn(contentPadding = PaddingValues(DvSpacing.lg), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(returns, key = { it.id }) { r ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
                border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(r.reason ?: "Возврат", style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                    Text(r.status, style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted, modifier = Modifier.padding(top = 2.dp))
                }
            }
        }
    }
}

// ─────────────────────────── Реклама ───────────────────────────

@Composable
private fun AdsTab(state: SupplierUiState, viewModel: SupplierViewModel) {
    val products = state.dashboard?.products.orEmpty().take(40)
    val rules = state.cashbackRules
    LazyColumn(contentPadding = PaddingValues(DvSpacing.lg), verticalArrangement = Arrangement.spacedBy(DvSpacing.sm)) {
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
                border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text("Базовый кэшбэк", style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary)
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                        OutlinedTextField(
                            value = state.defaultCashbackPercent,
                            onValueChange = viewModel::updateDefaultCashback,
                            enabled = state.canWrite,
                            singleLine = true,
                            label = { Text("%") },
                            modifier = Modifier.weight(1f),
                        )
                        DvPrimaryButton(
                            onClick = viewModel::saveDefaultCashback,
                            enabled = state.canWrite && !state.savingCashback,
                            modifier = Modifier.padding(start = 8.dp),
                        ) { Text(if (state.savingCashback) "…" else "Сохранить") }
                    }
                }
            }
        }
        if (state.canWrite) {
            item {
                DvOutlineButton(onClick = { viewModel.openPromo() }, modifier = Modifier.fillMaxWidth().padding(top = DvSpacing.sm)) {
                    Text("Создать акцию")
                }
            }
        }
        item {
            Text("Кэшбэк по товарам", style = MaterialTheme.typography.labelLarge, color = DvTheme.colors.textMuted, modifier = Modifier.padding(top = DvSpacing.md, bottom = 4.dp))
        }
        items(products, key = { it.id }) { p ->
            val rule = rules.find { it.scope == "PRODUCT" && it.productId == p.id && it.active }
            AdProductRow(p, rule, state.canWrite, viewModel)
        }
    }
}

@Composable
private fun AdProductRow(product: SupplierProduct, rule: kz.dentvision.crm.data.model.SupplierCashbackRule?, canWrite: Boolean, viewModel: SupplierViewModel) {
    val initialPct = rule?.let { formatPercentLabel(it.rateBps) } ?: ""
    var pct by remember(product.id, rule?.rateBps) { mutableStateOf(initialPct) }
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Row(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(product.name, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("Свой бренд", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted, modifier = Modifier.padding(end = 4.dp))
            Switch(checked = product.ownBrand, onCheckedChange = { viewModel.toggleOwnBrand(product.id, it) }, enabled = canWrite)
            OutlinedTextField(
                value = pct,
                onValueChange = { pct = it },
                enabled = canWrite,
                singleLine = true,
                label = { Text("%") },
                modifier = Modifier.width(72.dp).padding(start = 8.dp),
            )
            if (canWrite) {
                IconButton(onClick = { if (pct.isNotBlank()) viewModel.setProductCashback(product.id, pct) }, enabled = pct != initialPct) {
                    Text("✓", color = DvTheme.colors.gold)
                }
            }
        }
    }
}

private fun formatPercentLabel(rateBps: Int): String {
    val v = rateBps / 100.0
    return if (v == v.toInt().toDouble()) v.toInt().toString() else v.toString()
}

// ─────────────────────────── Спрос ───────────────────────────

@Composable
private fun DemandTab(state: SupplierUiState, viewModel: SupplierViewModel) {
    val kpis = state.dashboard?.kpis
    val demand = state.dashboard?.demandTop.orEmpty()
    LazyColumn(contentPadding = PaddingValues(DvSpacing.lg), verticalArrangement = Arrangement.spacedBy(DvSpacing.sm)) {
        item {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                modifier = Modifier.fillMaxWidth().height(160.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                item { StatCell(Icons.Filled.ReceiptLong, "Продаж всего", "${kpis?.salesCount ?: 0}") }
                item { StatCell(Icons.Filled.AttachMoney, "Заработано", kpis?.earnedMinor?.let { money(it) } ?: "—") }
                item { StatCell(Icons.Filled.Inventory2, "SKU", "${kpis?.productCount ?: 0}") }
                item { StatCell(Icons.Filled.Star, "Рейтинг", kpis?.avgRating?.toString() ?: "—") }
            }
        }
        item {
            val balance = kpis?.balanceMinor?.toLongOrNull() ?: 0L
            DvPrimaryButton(
                onClick = viewModel::requestPayout,
                enabled = state.canWrite && balance > 0 && !state.requestingPayout,
                modifier = Modifier.fillMaxWidth().padding(vertical = DvSpacing.sm),
            ) {
                Text(if (state.requestingPayout) "Отправка…" else "Запросить выплату (${kpis?.balanceMinor?.let { money(it) } ?: "0 ₸"})")
            }
        }
        item {
            Text("Что спрашивают клиники", style = MaterialTheme.typography.labelLarge, color = DvTheme.colors.textMuted, modifier = Modifier.padding(top = DvSpacing.sm, bottom = 4.dp))
        }
        if (demand.isEmpty()) {
            item { EmptyHint("Пока нет данных о спросе") }
        } else {
            items(demand, key = { it.id }) { d -> InsightRow(d, onClick = {}) }
        }
    }
}

// ─────────────────────────── Каталог ───────────────────────────

@Composable
private fun CatalogTab(state: SupplierUiState, viewModel: SupplierViewModel) {
    val products = state.dashboard?.products.orEmpty()
    var pendingDelete by remember { mutableStateOf<SupplierProduct?>(null) }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = DvSpacing.lg, vertical = DvSpacing.sm),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Товаров: ${products.size}", style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textMuted)
            if (state.canWrite) {
                DvPrimaryButton(onClick = viewModel::openAddProduct) { Text("Добавить товар") }
            }
        }
        if (products.isEmpty()) {
            EmptyHint("Каталог пуст — добавьте первый товар")
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                contentPadding = PaddingValues(horizontal = DvSpacing.lg, vertical = DvSpacing.sm),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                items(products, key = { it.id }) { product ->
                    CatalogCard(product, state.canWrite, onDelete = { pendingDelete = product })
                }
            }
        }
    }

    pendingDelete?.let { product ->
        DvConfirmDialog(
            title = "Удалить товар?",
            message = "«${product.name}» пропадёт из каталога и маркетплейса.",
            confirmLabel = "Удалить",
            onConfirm = { viewModel.deleteProduct(product.id); pendingDelete = null },
            onDismiss = { pendingDelete = null },
        )
    }
}

@Composable
private fun CatalogCard(product: SupplierProduct, canWrite: Boolean, onDelete: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column {
            Box(modifier = Modifier.fillMaxWidth().aspectRatio(1f)) {
                if (!product.imageUrl.isNullOrBlank()) {
                    AsyncImage(model = product.imageUrl, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                } else {
                    Box(modifier = Modifier.fillMaxSize().background(DvTheme.colors.surface2), contentAlignment = Alignment.Center) {
                        Icon(Icons.Filled.Storefront, contentDescription = null, tint = DvTheme.colors.textGhost)
                    }
                }
                if (canWrite) {
                    IconButton(onClick = onDelete, modifier = Modifier.align(Alignment.TopEnd)) {
                        Icon(Icons.Filled.Delete, contentDescription = "Удалить", tint = DvTheme.colors.error)
                    }
                }
            }
            Column(modifier = Modifier.padding(10.dp)) {
                Text(product.name, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("Остаток: ${product.stock}", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
                Text(tenge(product.price), style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.gold, modifier = Modifier.padding(top = 4.dp))
            }
        }
    }
}

// ─────────────────────────── Профиль ───────────────────────────

@Composable
private fun ProfileTab(state: SupplierUiState, viewModel: SupplierViewModel) {
    val form = state.profileForm
    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(DvSpacing.lg)) {
        OutlinedTextField(value = form.name, onValueChange = { v -> viewModel.updateProfileForm { it.copy(name = v) } }, enabled = state.canWrite, label = { Text("Название компании") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = form.bin, onValueChange = { v -> viewModel.updateProfileForm { it.copy(bin = v) } }, enabled = state.canWrite, label = { Text("БИН") }, modifier = Modifier.fillMaxWidth().padding(top = DvSpacing.sm))
        OutlinedTextField(value = form.phone, onValueChange = { v -> viewModel.updateProfileForm { it.copy(phone = v) } }, enabled = state.canWrite, label = { Text("Телефон") }, modifier = Modifier.fillMaxWidth().padding(top = DvSpacing.sm))
        OutlinedTextField(value = form.email, onValueChange = { v -> viewModel.updateProfileForm { it.copy(email = v) } }, enabled = state.canWrite, label = { Text("Email") }, modifier = Modifier.fillMaxWidth().padding(top = DvSpacing.sm))
        OutlinedTextField(value = form.contactPerson, onValueChange = { v -> viewModel.updateProfileForm { it.copy(contactPerson = v) } }, enabled = state.canWrite, label = { Text("Контактное лицо") }, modifier = Modifier.fillMaxWidth().padding(top = DvSpacing.sm))
        OutlinedTextField(value = form.legalAddress, onValueChange = { v -> viewModel.updateProfileForm { it.copy(legalAddress = v) } }, enabled = state.canWrite, label = { Text("Юр. адрес") }, modifier = Modifier.fillMaxWidth().padding(top = DvSpacing.sm))
        if (state.canWrite) {
            DvPrimaryButton(
                onClick = viewModel::saveProfile,
                enabled = !state.savingProfile,
                modifier = Modifier.fillMaxWidth().padding(top = DvSpacing.lg),
            ) { Text(if (state.savingProfile) "Сохранение…" else "Сохранить профиль") }
        }
    }
}

// ─────────────────────────── Общие кусочки ───────────────────────────

@Composable
private fun StatCell(icon: ImageVector, label: String, value: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Icon(icon, contentDescription = null, tint = DvTheme.colors.gold, modifier = Modifier.size(16.dp))
            Text(value, style = MaterialTheme.typography.titleSmall, color = DvTheme.colors.textPrimary, modifier = Modifier.padding(top = 4.dp), maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(label, style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

// ─────────────────────────── Модалки ───────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddProductSheet(viewModel: SupplierViewModel, state: SupplierUiState) {
    val form = state.productForm
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val context = LocalContext.current
    val pickPhoto = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let { viewModel.setProductPhotoFromUri(context, it) }
    }

    ModalBottomSheet(onDismissRequest = viewModel::dismissAddProduct, sheetState = sheetState, containerColor = DvTheme.colors.surface1) {
        Column(modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = DvSpacing.lg, vertical = DvSpacing.sm)) {
            Text("Новый товар", style = MaterialTheme.typography.titleLarge, color = DvTheme.colors.textPrimary)

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(140.dp)
                    .padding(top = DvSpacing.md)
                    .clip(RoundedCornerShape(16.dp))
                    .background(DvTheme.colors.surface2)
                    .clickable { pickPhoto.launch("image/*") },
                contentAlignment = Alignment.Center,
            ) {
                if (state.uploadingPhoto) {
                    CircularProgressIndicator(color = DvTheme.colors.gold)
                } else if (!form.imageUrl.isNullOrBlank()) {
                    Image(painter = coil.compose.rememberAsyncImagePainter(form.imageUrl), contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                } else {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Filled.PhotoCamera, contentDescription = null, tint = DvTheme.colors.textGhost)
                        Text("Добавить фото", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted, modifier = Modifier.padding(top = 4.dp))
                    }
                }
            }

            OutlinedTextField(value = form.name, onValueChange = { v -> viewModel.updateProductForm { it.copy(name = v) } }, label = { Text("Название *") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = DvSpacing.md))
            Row(modifier = Modifier.fillMaxWidth().padding(top = DvSpacing.sm)) {
                OutlinedTextField(value = form.price, onValueChange = { v -> viewModel.updateProductForm { it.copy(price = v) } }, label = { Text("Цена *") }, singleLine = true, modifier = Modifier.weight(1f))
                OutlinedTextField(value = form.stock, onValueChange = { v -> viewModel.updateProductForm { it.copy(stock = v) } }, label = { Text("Остаток") }, singleLine = true, modifier = Modifier.weight(1f).padding(start = 8.dp))
            }
            OutlinedTextField(value = form.category, onValueChange = { v -> viewModel.updateProductForm { it.copy(category = v) } }, label = { Text("Категория") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = DvSpacing.sm))
            OutlinedTextField(value = form.description, onValueChange = { v -> viewModel.updateProductForm { it.copy(description = v) } }, label = { Text("Описание") }, modifier = Modifier.fillMaxWidth().padding(top = DvSpacing.sm))

            DvPrimaryButton(
                onClick = viewModel::saveProduct,
                enabled = !state.savingProduct,
                modifier = Modifier.fillMaxWidth().padding(vertical = DvSpacing.lg),
            ) { Text(if (state.savingProduct) "Добавление…" else "Добавить") }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PromoSheet(viewModel: SupplierViewModel, state: SupplierUiState) {
    val form = state.promoForm
    val products = state.dashboard?.products.orEmpty()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(onDismissRequest = viewModel::dismissPromo, sheetState = sheetState, containerColor = DvTheme.colors.surface1) {
        Column(modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = DvSpacing.lg, vertical = DvSpacing.sm)) {
            Text("Новая акция", style = MaterialTheme.typography.titleLarge, color = DvTheme.colors.textPrimary)

            Text("Товар", style = MaterialTheme.typography.labelMedium, color = DvTheme.colors.textMuted, modifier = Modifier.padding(top = DvSpacing.md))
            LazyColumn(modifier = Modifier.fillMaxWidth().height(160.dp).padding(top = 4.dp)) {
                items(products, key = { it.id }) { p ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { viewModel.updatePromoForm { it.copy(productId = p.id) } }
                            .background(if (form.productId == p.id) DvTheme.colors.gold.copy(alpha = 0.12f) else DvTheme.colors.surface0)
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                    ) {
                        Text(p.name, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                    }
                }
            }

            OutlinedTextField(value = form.title, onValueChange = { v -> viewModel.updatePromoForm { it.copy(title = v) } }, label = { Text("Название акции") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = DvSpacing.sm))
            Row(modifier = Modifier.fillMaxWidth().padding(top = DvSpacing.sm)) {
                OutlinedTextField(value = form.discountPercent, onValueChange = { v -> viewModel.updatePromoForm { it.copy(discountPercent = v) } }, label = { Text("Скидка %") }, singleLine = true, modifier = Modifier.weight(1f))
                OutlinedTextField(value = form.cashbackPercent, onValueChange = { v -> viewModel.updatePromoForm { it.copy(cashbackPercent = v) } }, label = { Text("Кэшбэк %") }, singleLine = true, modifier = Modifier.weight(1f).padding(start = 8.dp))
            }

            DvPrimaryButton(
                onClick = viewModel::savePromo,
                enabled = !state.savingPromo,
                modifier = Modifier.fillMaxWidth().padding(vertical = DvSpacing.lg),
            ) { Text(if (state.savingPromo) "Создание…" else "Создать акцию") }
        }
    }
}
