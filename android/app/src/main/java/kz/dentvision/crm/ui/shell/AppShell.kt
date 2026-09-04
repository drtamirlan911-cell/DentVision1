package kz.dentvision.crm.ui.shell

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.session.FocusHolder
import kz.dentvision.crm.data.session.ScreenFocus
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.navigation.CrmPage
import kz.dentvision.crm.navigation.CrmSection
import kz.dentvision.crm.navigation.IMPLEMENTED_PAGES
import kz.dentvision.crm.navigation.LocalAssistantNavigate
import kz.dentvision.crm.navigation.ROUTE_ACTIVITY
import kz.dentvision.crm.navigation.ROUTE_APPROVALS
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_REFERRALS
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_REFERRAL_NEW
import kz.dentvision.crm.navigation.ROUTE_INTELLIGENCE
import kz.dentvision.crm.navigation.ROUTE_WORKSPACE
import kz.dentvision.crm.navigation.resolveAssistantPath
import kz.dentvision.crm.navigation.visiblePages
import kz.dentvision.crm.ui.activity.ActivityScreen
import kz.dentvision.crm.ui.approvals.ApprovalsScreen
import kz.dentvision.crm.ui.common.DvLogo
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.diagnostics.DiagnosticsHomeScreen
import kz.dentvision.crm.ui.diagnostics.ReferralDetailScreen
import kz.dentvision.crm.ui.diagnostics.ReferralFormScreen
import kz.dentvision.crm.ui.diagnostics.ReferralListScreen
import kz.dentvision.crm.ui.home.WorkspaceScreen
import kz.dentvision.crm.ui.intelligence.IntelligenceScreen
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Оболочка приложения. Дом — Intelligence (диалог с ИИ), как `/` на вебе;
 * кабинет клиники (CRM) — один из пунктов меню, а не наоборот. В браузере
 * разделы CRM живут в развёрнутом боковом меню — в телефон оно не помещается,
 * поэтому подача адаптирована (выдвижное меню вместо постоянного), но состав
 * и порядок разделов внутри CRM не меняются — меняется только то, что стоит
 * перед ним.
 *
 * Что попадает в меню CRM, решает сервер: `pages` из ответа на вход.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppShell(
    session: Session,
    onLogout: () -> Unit,
    navController: NavHostController = rememberNavController(),
) {
    val implemented = IMPLEMENTED_PAGES.keys
    val pages = visiblePages(session.pages, implemented)
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route ?: ROUTE_INTELLIGENCE

    // Один и тот же ViewModel для чипа в шапке и для самой шторки: список
    // рабочих пространств грузится один раз на весь кабинет, а не заново при
    // каждом открытии переключателя.
    val workspaceSwitcherViewModel: WorkspaceSwitcherViewModel = viewModel()
    val workspaceSwitcherState by workspaceSwitcherViewModel.state.collectAsStateWithLifecycle()
    val workspaceCount = (workspaceSwitcherState.items as? UiState.Data)?.value?.size ?: 0
    var workspaceSwitcherOpen by remember { mutableStateOf(false) }
    val snackbarHostState = remember { SnackbarHostState() }

    // Контекст-движок бэкенда принимает pathname текущего экрана
    // (`querySchema` в `ai.routes.ts`) и не переспрашивает то, что уже видно.
    // Экраны с сущностью внутри (карточка пациента и т.п.) уточнят фокус
    // сами через FocusHolder.set — здесь только базовый уровень маршрута.
    LaunchedEffect(currentRoute) {
        FocusHolder.set(ScreenFocus(pathname = currentRoute))
    }

    fun open(route: String) {
        if (route == currentRoute) return
        navController.navigate(route) {
            popUpTo(ROUTE_INTELLIGENCE) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(drawerContainerColor = DvTheme.colors.surface1) {
                DrawerContent(
                    session = session,
                    pages = pages,
                    currentRoute = currentRoute,
                    onOpen = { route ->
                        scope.launch { drawerState.close() }
                        open(route)
                    },
                    onLogout = onLogout,
                )
            }
        },
    ) {
        Scaffold(
            containerColor = DvTheme.colors.surface0,
            topBar = {
                TopAppBar(
                    title = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                        DvLogo(size = 28.dp, modifier = Modifier.padding(end = 10.dp))
                        Column {
                            Text(
                                text = pages.firstOrNull { it.route == currentRoute }?.label
                                    ?: fixedRouteTitle(currentRoute)
                                    ?: "Кабинет клиники",
                                style = MaterialTheme.typography.titleMedium,
                                color = DvTheme.colors.textPrimary,
                            )
                            if (workspaceCount > 1) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.clickable { workspaceSwitcherOpen = true },
                                ) {
                                    Text(
                                        text = session.clinic?.name ?: "Рабочее пространство",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = DvTheme.colors.textMuted,
                                    )
                                    Icon(
                                        imageVector = Icons.Filled.ExpandMore,
                                        contentDescription = "Сменить рабочее пространство",
                                        tint = DvTheme.colors.textMuted,
                                        modifier = Modifier.size(14.dp).padding(start = 2.dp),
                                    )
                                }
                            } else {
                                session.clinic?.name?.let {
                                    Text(
                                        text = it,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = DvTheme.colors.textMuted,
                                    )
                                }
                            }
                        }
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(
                                imageVector = Icons.Filled.Menu,
                                contentDescription = "Меню разделов",
                                tint = DvTheme.colors.textSecondary,
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = DvTheme.colors.surface1,
                    ),
                )
            },
            snackbarHost = {
                SnackbarHost(snackbarHostState) { data ->
                    Snackbar(snackbarData = data, containerColor = DvTheme.colors.surface3)
                }
            },
            bottomBar = {
                NavigationBar(containerColor = DvTheme.colors.surface1) {
                    NavigationBarItem(
                        selected = currentRoute == ROUTE_INTELLIGENCE,
                        onClick = { open(ROUTE_INTELLIGENCE) },
                        icon = { Icon(Icons.Filled.AutoAwesome, contentDescription = null) },
                        label = { Text("Intelligence", style = MaterialTheme.typography.labelSmall) },
                    )
                    NavigationBarItem(
                        selected = currentRoute == ROUTE_WORKSPACE,
                        onClick = { open(ROUTE_WORKSPACE) },
                        icon = { Icon(Icons.Filled.Dashboard, contentDescription = null) },
                        label = { Text("Кабинет", style = MaterialTheme.typography.labelSmall) },
                    )
                    pages.take(3).forEach { page ->
                        NavigationBarItem(
                            selected = currentRoute == page.route,
                            onClick = { open(page.route) },
                            icon = { Icon(page.icon, contentDescription = null) },
                            label = { Text(page.label, style = MaterialTheme.typography.labelSmall) },
                        )
                    }
                }
            },
        ) { padding ->
            ShellNavHost(
                navController = navController,
                session = session,
                implemented = implemented,
                padding = padding,
                onNavigate = ::open,
            )
        }
    }

    if (workspaceSwitcherOpen) {
        WorkspaceSwitcherSheet(
            session = session,
            onDismiss = { workspaceSwitcherOpen = false },
            onSwitched = { context ->
                workspaceSwitcherOpen = false
                scope.launch { snackbarHostState.showSnackbar("Активно: ${context.name}") }
                // Кабинет клиники — единственный тип пространства, у которого
                // на Android есть построенный экран (см. тело PR #233); для
                // остальных типов остаёмся на месте, а `session.pages` сами
                // честно покажут в меню только то, что реализовано.
                if (context.scopeType == "CLINIC") open(ROUTE_WORKSPACE)
            },
            viewModel = workspaceSwitcherViewModel,
        )
    }
}

/** Заголовки фиксированных экранов ядра ИИ — их нет в `pages`, поэтому нет и в списке разделов. */
private fun fixedRouteTitle(route: String): String? = when (route) {
    ROUTE_INTELLIGENCE -> "Intelligence"
    ROUTE_APPROVALS -> "Подтверждения ИИ"
    ROUTE_ACTIVITY -> "Активность ИИ"
    ROUTE_DIAGNOSTICS -> "Диагностика"
    ROUTE_DIAGNOSTICS_REFERRALS -> "Направления"
    ROUTE_DIAGNOSTICS_REFERRAL_NEW -> "Новое направление"
    "$ROUTE_DIAGNOSTICS_REFERRALS/{id}" -> "Направление"
    else -> null
}

@Composable
private fun ShellNavHost(
    navController: NavHostController,
    session: Session,
    implemented: Set<String>,
    padding: PaddingValues,
    onNavigate: (String) -> Unit,
) {
    CompositionLocalProvider(LocalAssistantNavigate provides onNavigate) {
        NavHost(
            navController = navController,
            startDestination = ROUTE_INTELLIGENCE,
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            composable(ROUTE_INTELLIGENCE) {
                IntelligenceScreen(
                    onNavigate = { path -> resolveAssistantPath(path, implemented)?.let(onNavigate) },
                )
            }
            composable(ROUTE_WORKSPACE) {
                WorkspaceScreen(session = session, implemented = implemented)
            }
            composable(ROUTE_APPROVALS) { ApprovalsScreen() }
            composable(ROUTE_ACTIVITY) { ActivityScreen() }
            composable(ROUTE_DIAGNOSTICS) { DiagnosticsHomeScreen() }
            composable(ROUTE_DIAGNOSTICS_REFERRALS) { ReferralListScreen() }
            // Буквальный .../new регистрируется раньше параметризованного
            // .../{id} — иначе Navigation-Compose матчит "new" как значение id.
            composable(ROUTE_DIAGNOSTICS_REFERRAL_NEW) {
                ReferralFormScreen(
                    session = session,
                    onSaved = { id -> onNavigate("$ROUTE_DIAGNOSTICS_REFERRALS/$id") },
                )
            }
            composable("$ROUTE_DIAGNOSTICS_REFERRALS/{id}") { backStackEntry ->
                val id = backStackEntry.arguments?.getString("id")
                if (id != null) ReferralDetailScreen(referralId = id)
            }
            // Маршрут заводится только под построенный экран и только если роль
            // имеет на него право — иначе его в графе просто нет.
            visiblePages(session.pages, implemented).forEach { page ->
                val screen = IMPLEMENTED_PAGES.getValue(page.id)
                composable(page.route) { screen(session) }
            }
        }
    }
}

@Composable
private fun DrawerContent(
    session: Session,
    pages: List<CrmPage>,
    currentRoute: String,
    onOpen: (String) -> Unit,
    onLogout: () -> Unit,
) {
    Column(modifier = Modifier.verticalScroll(rememberScrollState()).padding(vertical = 12.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
        ) {
            DvLogo(size = 32.dp, modifier = Modifier.padding(end = 10.dp))
            Text(
                text = session.clinic?.name ?: "DentVision",
                style = MaterialTheme.typography.titleMedium,
                color = DvTheme.colors.gold,
            )
        }
        Text(
            text = session.user.name.ifBlank { session.user.login },
            style = MaterialTheme.typography.bodySmall,
            color = DvTheme.colors.textMuted,
            modifier = Modifier.padding(horizontal = 20.dp),
        )
        HorizontalDivider(
            color = DvTheme.colors.borderSubtle,
            modifier = Modifier.padding(vertical = 12.dp),
        )

        // Intelligence — всегда первым, крупнее и золотистее остальных пунктов:
        // это дом приложения, а не ещё один раздел меню (см. `Sidebar.tsx`,
        // где Intelligence — единственный пункт вне общего списка навигации).
        IntelligenceDrawerItem(
            active = currentRoute == ROUTE_INTELLIGENCE,
            onClick = { onOpen(ROUTE_INTELLIGENCE) },
        )

        HorizontalDivider(
            color = DvTheme.colors.borderSubtle,
            modifier = Modifier.padding(vertical = 10.dp, horizontal = 20.dp),
        )

        PillarDrawerItem(
            label = "Кабинет",
            icon = Icons.Filled.Dashboard,
            active = currentRoute == ROUTE_WORKSPACE,
            onClick = { onOpen(ROUTE_WORKSPACE) },
        )
        // Кабинет диагностики (исходящие направления) — как `nav.diagnostics`
        // в `Sidebar.tsx`: виден всегда, безусловно, а не только в рабочем
        // пространстве типа DIAGNOSTIC_CENTER/LABORATORY — это другой, ещё не
        // построенный кабинет (см. ROUTE_DIAGNOSTICS в Destinations.kt).
        PillarDrawerItem(
            label = "Диагностика",
            icon = Icons.Filled.Science,
            active = currentRoute.startsWith(ROUTE_DIAGNOSTICS),
            onClick = { onOpen(ROUTE_DIAGNOSTICS) },
        )
        // Сквозные поверхности governance-ядра — одинаковые для всех вошедших,
        // поэтому фиксированные пункты рядом с «Кабинетом», а не часть [pages].
        PillarDrawerItem(
            label = "Подтверждения ИИ",
            icon = Icons.Filled.TaskAlt,
            active = currentRoute == ROUTE_APPROVALS,
            onClick = { onOpen(ROUTE_APPROVALS) },
        )
        PillarDrawerItem(
            label = "Активность ИИ",
            icon = Icons.Filled.History,
            active = currentRoute == ROUTE_ACTIVITY,
            onClick = { onOpen(ROUTE_ACTIVITY) },
        )

        CrmSection.entries.forEach { section ->
            val inSection = pages.filter { it.section == section }
            if (inSection.isEmpty()) return@forEach
            Text(
                text = section.title,
                style = MaterialTheme.typography.labelMedium,
                color = DvTheme.colors.textGhost,
                modifier = Modifier.padding(start = 20.dp, top = 14.dp, bottom = 6.dp),
            )
            inSection.forEach { page ->
                PillarDrawerItem(
                    label = page.label,
                    icon = page.icon,
                    active = currentRoute == page.route,
                    onClick = { onOpen(page.route) },
                )
            }
        }

        HorizontalDivider(
            color = DvTheme.colors.borderSubtle,
            modifier = Modifier.padding(vertical = 12.dp),
        )
        PillarDrawerItem(
            label = "Выйти",
            icon = Icons.AutoMirrored.Filled.Logout,
            active = false,
            onClick = onLogout,
            tint = DvTheme.colors.error,
        )
    }
}

/**
 * Обычный пункт меню — скруглённая иконка-чип на фирменном золоте, а не
 * системная иконка Material на пустом месте (см. `NavIconChip` в
 * `Sidebar.tsx`). Один тон на всё меню, потому что на Android построен пока
 * только один раздел-«пилар» (CRM) — красить каждый пункт в свой цвет, как на
 * вебе (диагностика, магазин, Academy…), нечем: тех разделов здесь нет.
 */
@Composable
private fun PillarDrawerItem(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    active: Boolean,
    onClick: () -> Unit,
    tint: androidx.compose.ui.graphics.Color? = null,
) {
    val colors = DvTheme.colors
    val accent = tint ?: colors.gold
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .background(if (active) colors.gold.copy(alpha = 0.08f) else androidx.compose.ui.graphics.Color.Transparent)
            .padding(horizontal = 20.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(9.dp))
                .background(accent.copy(alpha = if (active) 0.22f else 0.12f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(16.dp))
        }
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
            color = if (active) colors.textPrimary else colors.textSecondary,
            modifier = Modifier.padding(start = 12.dp),
        )
    }
}

/** Особый, самый заметный пункт меню — вход в дом приложения. */
@Composable
private fun IntelligenceDrawerItem(active: Boolean, onClick: () -> Unit) {
    val colors = DvTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .background(if (active) colors.gold.copy(alpha = 0.12f) else androidx.compose.ui.graphics.Color.Transparent)
            .padding(horizontal = 20.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(13.dp))
                .background(
                    Brush.linearGradient(
                        listOf(colors.gold.copy(alpha = if (active) 0.4f else 0.22f), colors.gold.copy(alpha = 0.06f)),
                    ),
                )
                .border(1.dp, colors.gold.copy(alpha = 0.25f), RoundedCornerShape(13.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.SmartToy, contentDescription = null, tint = colors.gold, modifier = Modifier.size(19.dp))
        }
        Column(modifier = Modifier.padding(start = 12.dp)) {
            Text(
                text = "Intelligence",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = if (active) colors.gold else colors.textPrimary,
            )
            Text(
                text = "Цифровой ассистент",
                style = MaterialTheme.typography.labelSmall,
                color = colors.textMuted,
            )
        }
    }
}
