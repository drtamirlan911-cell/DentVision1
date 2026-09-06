package kz.dentvision.crm.ui.public

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import kz.dentvision.crm.data.model.SchoolCourse
import kz.dentvision.crm.data.model.ShopCategory
import kz.dentvision.crm.data.model.ShopProduct
import kz.dentvision.crm.lib.formatTenge
import kz.dentvision.crm.ui.common.DvLogo
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvSpacing
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Что видно без входа.
 *
 * Здесь ровно то, что платформа и так отдаёт кому угодно: витрина магазина и
 * каталог школы. Оба маршрута открыты на бэкенде без `authenticate`, так что
 * это не послабление, придуманное на клиенте, а перенос уже принятого решения.
 * Сама покупка (заказ товара, запись на курс) — уже нет, `authenticate` стоит
 * (`shop.routes.ts:162`, `school.routes.ts:601`), поэтому кнопка «Купить»
 * гостю ведёт на вход, а не в заказ.
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
 *
 * `embedded = true` — экран уже открыт внутри чужой оболочки (`AppShell`
 * для вошедшего, `GuestShell` для гостя), у которой уже есть своя шапка
 * (лого/меню/«Войти») — своя шапка здесь была бы второй такой же под
 * первой, поэтому при `embedded = true` `PublicScreen` не строит `Scaffold`
 * с `TopAppBar` вообще, а `onBack`/`onSignIn` не используются.
 *
 * Баннер регистрации центра/лаборатории от этого не зависит напрямую —
 * `showRegisterBanner` (по умолчанию `!embedded`) решает его отдельно:
 * гостю баннер нужен даже в `embedded`-режиме (у `GuestShell` для этого
 * нет отдельного пункта меню), а вошедшему внутри `AppShell` — нет (там
 * подключение центра идёт через переключатель пространств).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PublicScreen(
    onBack: () -> Unit = {},
    onSignIn: () -> Unit = {},
    onRegisterDiagnostics: () -> Unit = {},
    embedded: Boolean = false,
    showRegisterBanner: Boolean = !embedded,
    isAuthenticated: Boolean = false,
    onRequireLogin: () -> Unit = onSignIn,
    clinicId: String? = null,
) {
    var tab by remember { mutableIntStateOf(0) }

    val body = @Composable {
        Column(modifier = Modifier.fillMaxSize()) {
            if (showRegisterBanner) RegisterDiagnosticsBanner(onClick = onRegisterDiagnostics)
            TabRow(
                selectedTabIndex = tab,
                containerColor = DvTheme.colors.surface1,
                contentColor = DvTheme.colors.gold,
            ) {
                Tab(
                    selected = tab == 0,
                    onClick = { tab = 0 },
                    // "Маркетплейс" — так этот раздел называется везде на
                    // вебе (`nav.shop` в `ru.json`, хлебные крошки товара,
                    // вкладка контекста ИИ), а не «Магазин».
                    text = { Text("Маркетплейс", style = MaterialTheme.typography.labelLarge) },
                )
                Tab(
                    selected = tab == 1,
                    onClick = { tab = 1 },
                    // "Academy OS" — фирменное название, не переводится даже
                    // в русской локали (`Sidebar.tsx`, `School.tsx`).
                    text = { Text("Academy OS", style = MaterialTheme.typography.labelLarge) },
                )
            }
            when (tab) {
                0 -> ShopCatalog(isAuthenticated = isAuthenticated, onRequireLogin = onRequireLogin, clinicId = clinicId)
                else -> SchoolCatalog(isAuthenticated = isAuthenticated, onRequireLogin = onRequireLogin)
            }
        }
    }

    if (embedded) {
        body()
        return
    }

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
            body()
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

// ─────────────────────────── Маркетплейс ───────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ShopCatalog(
    isAuthenticated: Boolean,
    onRequireLogin: () -> Unit,
    clinicId: String?,
    viewModel: ShopCatalogViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val query by viewModel.query.collectAsStateWithLifecycle()
    val categories by viewModel.categories.collectAsStateWithLifecycle()
    val category by viewModel.category.collectAsStateWithLifecycle()
    val selected by viewModel.selected.collectAsStateWithLifecycle()
    val purchase by viewModel.purchase.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val uriHandler = LocalUriHandler.current

    LaunchedEffect(purchase.result) {
        val result = purchase.result ?: return@LaunchedEffect
        val payUrl = result.payment?.takeIf { result.requiresPayment }?.openUrl
        if (payUrl != null) {
            uriHandler.openUri(payUrl)
            snackbarHostState.showSnackbar("Открыли оплату — после неё заказ подтвердится сам")
        } else {
            snackbarHostState.showSnackbar(result.message ?: "Заказ оформлен")
        }
    }
    LaunchedEffect(purchase.error) {
        val error = purchase.error ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(error)
        viewModel.consumePurchaseError()
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize()) {
            SearchField(query, "Товар, бренд или поставщик", viewModel::onQueryChange)
            when (val list = state) {
                is UiState.Loading -> LoadingSkeleton()
                is UiState.Error -> ErrorState(message = list.message, onRetry = viewModel::retry)
                is UiState.Data -> if (list.value.isEmpty()) {
                    EmptyStateView(title = "Ничего не нашли")
                } else {
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(2),
                        contentPadding = PaddingValues(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        if (categories.isNotEmpty()) {
                            item(span = { GridItemSpan(maxLineSpan) }) {
                                CategoryChipRow(
                                    categories = categories,
                                    selected = category,
                                    onSelect = viewModel::onCategoryChange,
                                    modifier = Modifier.padding(bottom = 4.dp),
                                )
                            }
                        }
                        items(list.value, key = { it.id }) { ProductGridCard(it, onClick = { viewModel.openDetails(it) }) }
                    }
                }
            }
        }
        SnackbarHost(snackbarHostState, modifier = Modifier.align(Alignment.BottomCenter))
    }

    selected?.let { product ->
        val result = purchase.result
        ProductDetailSheet(
            product = product,
            isAuthenticated = isAuthenticated,
            purchasing = purchase.purchasing,
            purchased = result != null && !result.requiresPayment,
            awaitingPaymentUrl = result?.takeIf { it.requiresPayment }?.payment?.openUrl,
            onDismiss = viewModel::closeDetails,
            onRequireLogin = onRequireLogin,
            onBuy = { qty -> viewModel.buy(clinicId, qty) },
        )
    }
}

/**
 * Плитка витрины, а не строка списка — тот же язык, что у любого крупного
 * маркетплейса (Kaspi.kz Магазин, Wildberries): фото первым, чтобы товар
 * узнавался с одного взгляда без чтения названия, рейтинг и наличие —
 * поверх фото значками, а не отдельными строками текста ниже.
 */
@Composable
private fun ProductGridCard(product: ShopProduct, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column {
            Box(modifier = Modifier.fillMaxWidth().aspectRatio(1f)) {
                CatalogImage(url = product.imageUrl, fallback = Icons.Filled.Storefront)
                product.rating?.takeIf { it > 0 }?.let {
                    RatingBadge(it, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp))
                }
                if (product.stock <= 0) {
                    Box(
                        modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.55f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "Нет в наличии",
                            style = MaterialTheme.typography.labelMedium,
                            color = Color.White,
                        )
                    }
                }
            }
            Column(modifier = Modifier.padding(12.dp)) {
                Text(
                    text = product.name.ifBlank { "Без названия" },
                    style = MaterialTheme.typography.bodyMedium,
                    color = DvTheme.colors.textPrimary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                val sub = listOfNotNull(
                    product.brand.ifBlank { null },
                    product.categoryName?.takeIf { it.isNotBlank() },
                ).joinToString(" · ")
                if (sub.isNotBlank()) {
                    Text(
                        text = sub,
                        style = MaterialTheme.typography.labelSmall,
                        color = DvTheme.colors.textMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                Text(
                    text = formatTenge(product.price),
                    style = MaterialTheme.typography.titleMedium,
                    color = DvTheme.colors.gold,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProductDetailSheet(
    product: ShopProduct,
    isAuthenticated: Boolean,
    purchasing: Boolean,
    purchased: Boolean,
    awaitingPaymentUrl: String?,
    onDismiss: () -> Unit,
    onRequireLogin: () -> Unit,
    onBuy: (quantity: Int) -> Unit,
) {
    var quantity by remember(product.id) { mutableIntStateOf(1) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val uriHandler = LocalUriHandler.current

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = DvTheme.colors.surface1) {
        Column(
            modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = DvSpacing.lg, vertical = DvSpacing.sm),
        ) {
            HeroImage(url = product.imageUrl, fallback = Icons.Filled.Storefront)
            Text(
                text = product.name.ifBlank { "Без названия" },
                style = MaterialTheme.typography.headlineSmall,
                color = DvTheme.colors.textPrimary,
                modifier = Modifier.padding(top = DvSpacing.md),
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
                    style = MaterialTheme.typography.bodyMedium,
                    color = DvTheme.colors.textMuted,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            RatingRow(product.rating, modifier = Modifier.padding(top = DvSpacing.sm))
            Text(
                text = formatTenge(product.price),
                style = MaterialTheme.typography.headlineMedium,
                color = DvTheme.colors.gold,
                modifier = Modifier.padding(top = DvSpacing.md),
            )
            Text(
                text = if (product.stock > 0) "В наличии: ${product.stock} ${product.unit ?: "шт"}" else "Сейчас нет в наличии",
                style = MaterialTheme.typography.labelMedium,
                color = if (product.stock > 0) DvTheme.colors.success else DvTheme.colors.error,
                modifier = Modifier.padding(top = 4.dp),
            )
            if (!product.description.isNullOrBlank()) {
                Text(
                    text = product.description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = DvTheme.colors.textSecondary,
                    modifier = Modifier.padding(top = DvSpacing.md),
                )
            }

            Spacer(modifier = Modifier.height(DvSpacing.lg))

            when {
                purchased -> Text(
                    text = "Заказ оформлен — спасибо!",
                    style = MaterialTheme.typography.titleMedium,
                    color = DvTheme.colors.success,
                    modifier = Modifier.padding(bottom = DvSpacing.lg),
                )
                awaitingPaymentUrl != null -> Column(modifier = Modifier.padding(bottom = DvSpacing.lg)) {
                    Text(
                        text = "Ждём оплату — заказ подтвердится сам, как только она пройдёт",
                        style = MaterialTheme.typography.bodyMedium,
                        color = DvTheme.colors.textSecondary,
                        modifier = Modifier.padding(bottom = DvSpacing.sm),
                    )
                    DvPrimaryButton(onClick = { uriHandler.openUri(awaitingPaymentUrl) }, modifier = Modifier.fillMaxWidth()) {
                        Text("Открыть оплату ещё раз")
                    }
                }
                !isAuthenticated -> DvPrimaryButton(onClick = onRequireLogin, modifier = Modifier.fillMaxWidth().padding(bottom = DvSpacing.lg)) {
                    Text("Войдите, чтобы купить")
                }
                product.stock <= 0 -> DvPrimaryButton(onClick = {}, modifier = Modifier.fillMaxWidth().padding(bottom = DvSpacing.lg)) {
                    Text("Нет в наличии")
                }
                else -> {
                    QuantityStepper(
                        quantity = quantity,
                        max = product.stock,
                        onChange = { quantity = it },
                        modifier = Modifier.padding(bottom = DvSpacing.md),
                    )
                    DvPrimaryButton(
                        onClick = { onBuy(quantity) },
                        enabled = !purchasing,
                        modifier = Modifier.fillMaxWidth().padding(bottom = DvSpacing.lg),
                    ) {
                        if (purchasing) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), color = DvTheme.colors.gold, strokeWidth = 2.dp)
                        } else {
                            Text("Купить за ${formatTenge(product.price * quantity)}")
                        }
                    }
                }
            }
        }
    }
}

// ─────────────────────────── Academy OS ───────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SchoolCatalog(
    isAuthenticated: Boolean,
    onRequireLogin: () -> Unit,
    viewModel: SchoolCatalogViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val query by viewModel.query.collectAsStateWithLifecycle()
    val category by viewModel.category.collectAsStateWithLifecycle()
    val selected by viewModel.selected.collectAsStateWithLifecycle()
    val purchase by viewModel.purchase.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val uriHandler = LocalUriHandler.current

    LaunchedEffect(purchase.result) {
        val result = purchase.result ?: return@LaunchedEffect
        val payUrl = result.payment?.takeIf { result.requiresPayment }?.openUrl
        if (payUrl != null) {
            uriHandler.openUri(payUrl)
            snackbarHostState.showSnackbar("Открыли оплату — после неё место подтвердится само")
        } else {
            snackbarHostState.showSnackbar(result.message ?: "Готово")
        }
    }
    LaunchedEffect(purchase.error) {
        val error = purchase.error ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(error)
        viewModel.consumePurchaseError()
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize()) {
            SearchField(query, "Курс, тема или автор", viewModel::onQueryChange)
            when (val list = state) {
                is UiState.Loading -> LoadingSkeleton()
                is UiState.Error -> ErrorState(message = list.message, onRetry = viewModel::retry)
                is UiState.Data -> {
                    val courseCategories = remember(list.value) {
                        list.value.map { it.category }.filter { it.isNotBlank() }.distinct().sorted()
                    }
                    val filtered = remember(list.value, category) {
                        if (category == null) list.value else list.value.filter { it.category == category }
                    }
                    if (list.value.isEmpty()) {
                        EmptyStateView(title = "Курсов не нашли")
                    } else {
                        LazyVerticalGrid(
                            columns = GridCells.Fixed(2),
                            contentPadding = PaddingValues(16.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            if (courseCategories.isNotEmpty()) {
                                item(span = { GridItemSpan(maxLineSpan) }) {
                                    CourseCategoryChipRow(
                                        categories = courseCategories,
                                        selected = category,
                                        onSelect = viewModel::onCategoryChange,
                                        modifier = Modifier.padding(bottom = 4.dp),
                                    )
                                }
                            }
                            if (filtered.isEmpty()) {
                                item(span = { GridItemSpan(maxLineSpan) }) {
                                    EmptyStateView(title = "В этой категории пока пусто")
                                }
                            } else {
                                items(filtered, key = { it.id }) { CourseGridCard(it, onClick = { viewModel.openDetails(it) }) }
                            }
                        }
                    }
                }
            }
        }
        SnackbarHost(snackbarHostState, modifier = Modifier.align(Alignment.BottomCenter))
    }

    selected?.let { course ->
        val result = purchase.result
        CourseDetailSheet(
            course = course,
            isAuthenticated = isAuthenticated,
            purchasing = purchase.purchasing,
            purchased = result != null && !result.requiresPayment,
            awaitingPaymentUrl = result?.takeIf { it.requiresPayment }?.payment?.openUrl,
            onDismiss = viewModel::closeDetails,
            onRequireLogin = onRequireLogin,
            onEnroll = viewModel::enroll,
        )
    }
}

@Composable
private fun CourseGridCard(course: SchoolCourse, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column {
            Box(modifier = Modifier.fillMaxWidth().aspectRatio(1.4f)) {
                CatalogImage(url = course.imageUrl, fallback = Icons.Filled.Star)
                course.rating?.takeIf { it > 0 }?.let {
                    RatingBadge(it, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp))
                }
                val free = (course.price ?: 0) <= 0
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(8.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (free) DvTheme.colors.success else DvTheme.colors.surface0.copy(alpha = 0.75f))
                        .padding(horizontal = 8.dp, vertical = 3.dp),
                ) {
                    Text(
                        text = if (free) "Бесплатно" else formatTenge(course.price ?: 0),
                        style = MaterialTheme.typography.labelSmall,
                        color = if (free) Color.White else DvTheme.colors.gold,
                    )
                }
            }
            Column(modifier = Modifier.padding(12.dp)) {
                Text(
                    text = course.title.ifBlank { "Без названия" },
                    style = MaterialTheme.typography.bodyMedium,
                    color = DvTheme.colors.textPrimary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                val sub = listOfNotNull(
                    course.instructor.ifBlank { null },
                    course.academyName?.takeIf { it.isNotBlank() },
                ).joinToString(" · ")
                if (sub.isNotBlank()) {
                    Text(
                        text = sub,
                        style = MaterialTheme.typography.labelSmall,
                        color = DvTheme.colors.textMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                val meta = listOfNotNull(
                    course.lessonCount.takeIf { it > 0 }?.let { "$it уроков" },
                    course.enrolledCount.takeIf { it > 0 }?.let { "$it учатся" },
                ).joinToString(" · ")
                if (meta.isNotBlank()) {
                    Text(
                        text = meta,
                        style = MaterialTheme.typography.labelSmall,
                        color = DvTheme.colors.textMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CourseDetailSheet(
    course: SchoolCourse,
    isAuthenticated: Boolean,
    purchasing: Boolean,
    purchased: Boolean,
    awaitingPaymentUrl: String?,
    onDismiss: () -> Unit,
    onRequireLogin: () -> Unit,
    onEnroll: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val uriHandler = LocalUriHandler.current
    val free = (course.price ?: 0) <= 0

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = DvTheme.colors.surface1) {
        Column(
            modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = DvSpacing.lg, vertical = DvSpacing.sm),
        ) {
            HeroImage(url = course.imageUrl, fallback = Icons.Filled.Star)
            Text(
                text = course.title.ifBlank { "Без названия" },
                style = MaterialTheme.typography.headlineSmall,
                color = DvTheme.colors.textPrimary,
                modifier = Modifier.padding(top = DvSpacing.md),
            )
            if (course.subtitle.isNotBlank()) {
                Text(
                    text = course.subtitle,
                    style = MaterialTheme.typography.bodyMedium,
                    color = DvTheme.colors.textSecondary,
                    modifier = Modifier.padding(top = 4.dp),
                )
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
                    color = DvTheme.colors.textMuted,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            RatingRow(course.rating, modifier = Modifier.padding(top = DvSpacing.sm))
            Text(
                text = if (free) "Бесплатно" else formatTenge(course.price ?: 0),
                style = MaterialTheme.typography.headlineMedium,
                color = DvTheme.colors.gold,
                modifier = Modifier.padding(top = DvSpacing.md),
            )
            val meta = listOfNotNull(
                course.lessonCount.takeIf { it > 0 }?.let { "$it уроков" },
                course.durationHours?.takeIf { it > 0 }?.let { "${it.toInt()} ч" },
                course.enrolledCount.takeIf { it > 0 }?.let { "$it учатся" },
            ).joinToString(" · ")
            if (meta.isNotBlank()) {
                Text(
                    text = meta,
                    style = MaterialTheme.typography.labelMedium,
                    color = DvTheme.colors.textMuted,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            if (!course.description.isNullOrBlank()) {
                Text(
                    text = course.description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = DvTheme.colors.textSecondary,
                    modifier = Modifier.padding(top = DvSpacing.md),
                )
            }

            Spacer(modifier = Modifier.height(DvSpacing.lg))

            when {
                purchased -> Text(
                    text = if (free) "Место подтверждено" else "Место забронировано",
                    style = MaterialTheme.typography.titleMedium,
                    color = DvTheme.colors.success,
                    modifier = Modifier.padding(bottom = DvSpacing.lg),
                )
                awaitingPaymentUrl != null -> Column(modifier = Modifier.padding(bottom = DvSpacing.lg)) {
                    Text(
                        text = "Ждём оплату — место подтвердится само, как только она пройдёт",
                        style = MaterialTheme.typography.bodyMedium,
                        color = DvTheme.colors.textSecondary,
                        modifier = Modifier.padding(bottom = DvSpacing.sm),
                    )
                    DvPrimaryButton(onClick = { uriHandler.openUri(awaitingPaymentUrl) }, modifier = Modifier.fillMaxWidth()) {
                        Text("Открыть оплату ещё раз")
                    }
                }
                !isAuthenticated -> DvPrimaryButton(onClick = onRequireLogin, modifier = Modifier.fillMaxWidth().padding(bottom = DvSpacing.lg)) {
                    Text(if (free) "Войдите, чтобы записаться" else "Войдите, чтобы купить")
                }
                else -> DvPrimaryButton(
                    onClick = onEnroll,
                    enabled = !purchasing,
                    modifier = Modifier.fillMaxWidth().padding(bottom = DvSpacing.lg),
                ) {
                    if (purchasing) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), color = DvTheme.colors.gold, strokeWidth = 2.dp)
                    } else {
                        Text(if (free) "Записаться" else "Купить место")
                    }
                }
            }
        }
    }
}

// ─────────────────────────── Общие кусочки ───────────────────────────

/** Изображение плитки каталога — заполняет весь `Box` родителя (квадрат/карточка задают его снаружи через `aspectRatio`). */
@Composable
private fun CatalogImage(url: String?, fallback: ImageVector) {
    if (!url.isNullOrBlank()) {
        AsyncImage(model = url, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
    } else {
        Box(
            modifier = Modifier.fillMaxSize().background(
                Brush.linearGradient(listOf(DvTheme.colors.surface2, DvTheme.colors.surface3)),
            ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(fallback, contentDescription = null, tint = DvTheme.colors.textGhost, modifier = Modifier.size(32.dp))
        }
    }
}

/** Золотой значок рейтинга поверх фото — как у большинства маркетплейсов, не отдельной строкой текста. */
@Composable
private fun RatingBadge(rating: Double, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(DvTheme.colors.surface0.copy(alpha = 0.85f))
            .padding(horizontal = 6.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Filled.Star, contentDescription = null, tint = DvTheme.colors.gold, modifier = Modifier.size(12.dp))
        Text(
            text = String.format("%.1f", rating),
            style = MaterialTheme.typography.labelSmall,
            color = DvTheme.colors.textPrimary,
            modifier = Modifier.padding(start = 2.dp),
        )
    }
}

/** Горизонтальная лента категорий товара — источник: `GET /api/shop/categories`. */
@Composable
private fun CategoryChipRow(categories: List<ShopCategory>, selected: String?, onSelect: (String?) -> Unit, modifier: Modifier = Modifier) {
    LazyRow(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            CatalogFilterChip(label = "Все", isSelected = selected == null, onClick = { onSelect(null) })
        }
        items(categories.filter { !it.slug.isNullOrBlank() }, key = { it.slug!! }) { cat ->
            CatalogFilterChip(label = cat.name, isSelected = selected == cat.slug, onClick = { onSelect(cat.slug) })
        }
    }
}

/** Та же лента, но категория курса — свободная строка на самом курсе, не отдельный справочник. */
@Composable
private fun CourseCategoryChipRow(categories: List<String>, selected: String?, onSelect: (String?) -> Unit, modifier: Modifier = Modifier) {
    LazyRow(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            CatalogFilterChip(label = "Все", isSelected = selected == null, onClick = { onSelect(null) })
        }
        items(categories, key = { it }) { cat ->
            CatalogFilterChip(label = cat, isSelected = selected == cat, onClick = { onSelect(cat) })
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CatalogFilterChip(label: String, isSelected: Boolean, onClick: () -> Unit) {
    FilterChip(
        selected = isSelected,
        onClick = onClick,
        label = { Text(label) },
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = DvTheme.colors.gold.copy(alpha = 0.18f),
            selectedLabelColor = DvTheme.colors.gold,
        ),
    )
}

@Composable
private fun HeroImage(url: String?, fallback: ImageVector) {
    Box(modifier = Modifier.fillMaxWidth().height(200.dp).clip(RoundedCornerShape(20.dp))) {
        CatalogImage(url = url, fallback = fallback)
        // Затемнение снизу — без него значок рейтинга/цены поверх светлого фото
        // теряется. Тот же приём, что у карточек каталога, только крупнее.
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp)
                .align(Alignment.BottomStart)
                .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.45f)))),
        )
    }
}

@Composable
private fun RatingRow(rating: Double?, modifier: Modifier = Modifier) {
    val value = rating?.takeIf { it > 0 } ?: return
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Filled.Star, contentDescription = null, tint = DvTheme.colors.gold, modifier = Modifier.size(14.dp))
        Text(
            text = String.format("%.1f", value),
            style = MaterialTheme.typography.labelMedium,
            color = DvTheme.colors.textSecondary,
            modifier = Modifier.padding(start = 4.dp),
        )
    }
}

@Composable
private fun QuantityStepper(quantity: Int, max: Int, onChange: (Int) -> Unit, modifier: Modifier = Modifier) {
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        Text(text = "Количество", style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textSecondary, modifier = Modifier.weight(1f))
        IconButton(onClick = { if (quantity > 1) onChange(quantity - 1) }, enabled = quantity > 1) {
            Icon(Icons.Filled.Remove, contentDescription = "Меньше", tint = DvTheme.colors.textSecondary)
        }
        Text(text = "$quantity", style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary)
        IconButton(onClick = { if (quantity < max) onChange(quantity + 1) }, enabled = quantity < max) {
            Icon(Icons.Filled.Add, contentDescription = "Больше", tint = DvTheme.colors.textSecondary)
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
