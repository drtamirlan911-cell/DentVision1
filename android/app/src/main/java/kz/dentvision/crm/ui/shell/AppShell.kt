package kz.dentvision.crm.ui.shell

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.Scaffold
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
import androidx.compose.ui.unit.dp
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
import kz.dentvision.crm.navigation.ROUTE_WORKSPACE
import kz.dentvision.crm.navigation.visiblePages
import kz.dentvision.crm.ui.activity.ActivityScreen
import kz.dentvision.crm.ui.approvals.ApprovalsScreen
import kz.dentvision.crm.ui.assistant.AssistantSheet
import kz.dentvision.crm.ui.common.DvLogo
import kz.dentvision.crm.ui.home.WorkspaceScreen
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Оболочка кабинета.
 *
 * В браузере разделы живут в боковом меню на два десятка пунктов — в телефон
 * оно не помещается. Информационная архитектура при этом сохраняется целиком:
 * те же разделы, те же группы, тот же порядок; меняется только подача — четыре
 * частых раздела внизу, остальное в выдвижном меню. Это единственная
 * адаптация формы, и она не добавляет и не убирает ни одного пункта.
 *
 * Что вообще попадает в меню, решает сервер: `pages` из ответа на вход.
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
    val currentRoute = backStackEntry?.destination?.route ?: ROUTE_WORKSPACE
    var assistantOpen by remember { mutableStateOf(false) }

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
            popUpTo(ROUTE_WORKSPACE) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        gesturesEnabled = pages.isNotEmpty(),
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
                            session.clinic?.name?.let {
                                Text(
                                    text = it,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = DvTheme.colors.textMuted,
                                )
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
            floatingActionButton = {
                FloatingActionButton(
                    onClick = { assistantOpen = true },
                    containerColor = DvTheme.colors.gold,
                    contentColor = DvTheme.colors.goldOn,
                ) {
                    Icon(Icons.Filled.AutoAwesome, contentDescription = "Спросить ассистента")
                }
            },
            bottomBar = {
                // Нижняя панель появляется, только когда разделов больше одного:
                // панель с единственной кнопкой — это не навигация, а украшение.
                if (pages.size > 1) {
                    NavigationBar(containerColor = DvTheme.colors.surface1) {
                        NavigationBarItem(
                            selected = currentRoute == ROUTE_WORKSPACE,
                            onClick = { open(ROUTE_WORKSPACE) },
                            icon = { Icon(Icons.Filled.Dashboard, contentDescription = null) },
                            label = { Text("Кабинет") },
                        )
                        pages.take(4).forEach { page ->
                            NavigationBarItem(
                                selected = currentRoute == page.route,
                                onClick = { open(page.route) },
                                icon = { Icon(page.icon, contentDescription = null) },
                                label = { Text(page.label, style = MaterialTheme.typography.labelSmall) },
                            )
                        }
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

    if (assistantOpen) {
        AssistantSheet(
            onDismiss = { assistantOpen = false },
            onNavigate = { route ->
                scope.launch { drawerState.close() }
                open(route)
            },
            implemented = implemented,
        )
    }
}

/** Заголовки фиксированных экранов ядра ИИ — их нет в `pages`, поэтому нет и в списке разделов. */
private fun fixedRouteTitle(route: String): String? = when (route) {
    ROUTE_APPROVALS -> "Подтверждения ИИ"
    ROUTE_ACTIVITY -> "Активность ИИ"
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
            startDestination = ROUTE_WORKSPACE,
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            composable(ROUTE_WORKSPACE) {
                WorkspaceScreen(session = session, implemented = implemented, onNavigate = onNavigate)
            }
            composable(ROUTE_APPROVALS) { ApprovalsScreen() }
            composable(ROUTE_ACTIVITY) { ActivityScreen() }
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

        NavigationDrawerItem(
            label = { Text("Кабинет") },
            icon = { Icon(Icons.Filled.Dashboard, contentDescription = null) },
            selected = currentRoute == ROUTE_WORKSPACE,
            onClick = { onOpen(ROUTE_WORKSPACE) },
            modifier = Modifier.padding(horizontal = 12.dp),
        )
        // Сквозные поверхности governance-ядра — одинаковые для всех вошедших,
        // поэтому фиксированные пункты рядом с «Кабинетом», а не часть [pages].
        NavigationDrawerItem(
            label = { Text("Подтверждения ИИ") },
            icon = { Icon(Icons.Filled.TaskAlt, contentDescription = null) },
            selected = currentRoute == ROUTE_APPROVALS,
            onClick = { onOpen(ROUTE_APPROVALS) },
            modifier = Modifier.padding(horizontal = 12.dp),
        )
        NavigationDrawerItem(
            label = { Text("Активность ИИ") },
            icon = { Icon(Icons.Filled.History, contentDescription = null) },
            selected = currentRoute == ROUTE_ACTIVITY,
            onClick = { onOpen(ROUTE_ACTIVITY) },
            modifier = Modifier.padding(horizontal = 12.dp),
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
                NavigationDrawerItem(
                    label = { Text(page.label) },
                    icon = { Icon(page.icon, contentDescription = null) },
                    selected = currentRoute == page.route,
                    onClick = { onOpen(page.route) },
                    modifier = Modifier.padding(horizontal = 12.dp),
                )
            }
        }

        HorizontalDivider(
            color = DvTheme.colors.borderSubtle,
            modifier = Modifier.padding(vertical = 12.dp),
        )
        NavigationDrawerItem(
            label = { Text("Выйти") },
            icon = { Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null) },
            selected = false,
            onClick = onLogout,
            modifier = Modifier.padding(horizontal = 12.dp),
        )
    }
}
