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
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material.icons.filled.Work
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
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
import kz.dentvision.crm.data.NotificationsRepository
import kz.dentvision.crm.data.session.FocusHolder
import kz.dentvision.crm.data.session.NotificationBadge
import kz.dentvision.crm.data.session.ScreenFocus
import kz.dentvision.crm.data.session.SelectedPatient
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.navigation.CrmPage
import kz.dentvision.crm.navigation.CrmSection
import kz.dentvision.crm.navigation.IMPLEMENTED_PAGES
import kz.dentvision.crm.navigation.cabinetRouteFor
import kz.dentvision.crm.navigation.LocalAssistantNavigate
import kz.dentvision.crm.navigation.ROUTE_ACTIVITY
import kz.dentvision.crm.navigation.ROUTE_APPROVALS
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_CENTERS
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_LABS
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_PATIENTS
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_CALENDAR
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_STATISTICS
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_SETTINGS
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_REGISTRATIONS
import kz.dentvision.crm.navigation.ROUTE_OPERATOR_WORKSPACE
import kz.dentvision.crm.navigation.ROUTE_OPERATOR_CASHIER
import kz.dentvision.crm.navigation.ROUTE_OPERATOR_FINANCE
import kz.dentvision.crm.navigation.ROUTE_OPERATOR_PAYMENTS
import kz.dentvision.crm.navigation.ROUTE_OPERATOR_SERVICES
import kz.dentvision.crm.navigation.ROUTE_OPERATOR_TEAM
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_RESULTS
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_REFERRALS
import kz.dentvision.crm.navigation.ROUTE_DIAGNOSTICS_REFERRAL_NEW
import kz.dentvision.crm.navigation.ROUTE_COMMUNITY
import kz.dentvision.crm.navigation.ROUTE_INTELLIGENCE
import kz.dentvision.crm.navigation.ROUTE_JOBS
import kz.dentvision.crm.navigation.ROUTE_NOTIFICATIONS
import kz.dentvision.crm.navigation.ROUTE_NOTIFICATION_PREFERENCES
import kz.dentvision.crm.navigation.ROUTE_PATIENT_DETAIL
import kz.dentvision.crm.navigation.ROUTE_PROFILE
import kz.dentvision.crm.navigation.ROUTE_STOCK_RULES
import kz.dentvision.crm.ui.inventory.StockRulesScreen
import kz.dentvision.crm.ui.notifications.NotificationPreferencesScreen
import kz.dentvision.crm.ui.notifications.NotificationsScreen
import kz.dentvision.crm.ui.profile.ProfileScreen
import kz.dentvision.crm.navigation.ROUTE_SHOP_SCHOOL
import kz.dentvision.crm.navigation.ROUTE_WORKSPACE
import kz.dentvision.crm.navigation.resolveAssistantPath
import kz.dentvision.crm.navigation.visiblePages
import kz.dentvision.crm.ui.activity.ActivityScreen
import kz.dentvision.crm.ui.approvals.ApprovalsScreen
import kz.dentvision.crm.ui.common.DvLogo
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.diagnostics.DiagnosticOrgKind
import kz.dentvision.crm.ui.diagnostics.DiagnosticsHomeScreen
import kz.dentvision.crm.ui.diagnostics.DirectoryScreen
import kz.dentvision.crm.ui.diagnostics.ReferralDetailScreen
import kz.dentvision.crm.ui.diagnostics.ReferralFormScreen
import kz.dentvision.crm.ui.diagnostics.ReferralListScreen
import kz.dentvision.crm.ui.diagnostics.DiagnosticPatientsScreen
import kz.dentvision.crm.ui.diagnostics.DiagnosticCalendarScreen
import kz.dentvision.crm.ui.diagnostics.DiagnosticStatisticsScreen
import kz.dentvision.crm.ui.diagnostics.DiagnosticSettingsScreen
import kz.dentvision.crm.ui.diagnostics.RegistrationRequestsScreen
import kz.dentvision.crm.ui.diagnostics.OperatorWorkspaceScreen
import kz.dentvision.crm.ui.diagnostics.CashierScreen
import kz.dentvision.crm.ui.diagnostics.FinanceScreen
import kz.dentvision.crm.ui.diagnostics.PaymentsScreen
import kz.dentvision.crm.ui.diagnostics.ServicesScreen
import kz.dentvision.crm.ui.diagnostics.TeamScreen
import kz.dentvision.crm.ui.diagnostics.ResultsScreen
import kz.dentvision.crm.ui.community.CommunityScreen
import kz.dentvision.crm.ui.home.WorkspaceScreen
import kz.dentvision.crm.ui.intelligence.IntelligenceScreen
import kz.dentvision.crm.ui.jobs.JobsScreen
import kz.dentvision.crm.ui.patients.PatientDetailScreen
import kz.dentvision.crm.ui.public.PublicScreen
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

    // Разово при входе в кабинет: колокольчик должен показывать верное число
    // ещё до того, как пользователь хоть раз открыл саму ленту (там же
    // счётчик держится в актуальном виде через NotificationBadge.set).
    LaunchedEffect(Unit) {
        runCatching { NotificationsRepository().unreadCount() }.onSuccess(NotificationBadge::set)
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
                    onOpenCabinet = {
                        scope.launch { drawerState.close() }
                        val target = cabinetRouteFor(session)
                        if (target != null) {
                            open(target)
                        } else {
                            scope.launch { snackbarHostState.showSnackbar("Для этого рабочего пространства кабинет пока не построен") }
                        }
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
                    actions = {
                        val unread by NotificationBadge.count.collectAsStateWithLifecycle()
                        IconButton(onClick = { open(ROUTE_NOTIFICATIONS) }) {
                            if (unread > 0) {
                                BadgedBox(badge = { Badge(containerColor = DvTheme.colors.gold) { Text("$unread") } }) {
                                    Icon(
                                        imageVector = Icons.Filled.Notifications,
                                        contentDescription = "Уведомления",
                                        tint = DvTheme.colors.textSecondary,
                                    )
                                }
                            } else {
                                Icon(
                                    imageVector = Icons.Filled.Notifications,
                                    contentDescription = "Уведомления",
                                    tint = DvTheme.colors.textSecondary,
                                )
                            }
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
                // Ровно 4 пункта, у каждого — своя иконка и подпись только у
                // выбранного (`alwaysShowLabel = false`), как в свёрнутом
                // состоянии веб-сайдбара: там тоже показываются одни иконки,
                // а не подпись на каждом пункте разом. Раньше здесь было 5
                // пунктов с постоянными подписями — на узком экране текст
                // обрезался и наезжал друг на друга.
                //
                // Состав — топ-левел пилары, а не CRM-подстраницы: в вебе
                // `Sidebar.tsx` эти два уровня никогда не смешиваются на
                // одной панели (подстраницы CRM живут только внутри
                // развёрнутого пункта «CRM»).
                NavigationBar(containerColor = DvTheme.colors.surface1) {
                    NavigationBarItem(
                        selected = currentRoute == ROUTE_INTELLIGENCE,
                        onClick = { open(ROUTE_INTELLIGENCE) },
                        icon = { Icon(Icons.Filled.AutoAwesome, contentDescription = null) },
                        label = { Text("Intelligence", style = MaterialTheme.typography.labelSmall) },
                        alwaysShowLabel = false,
                    )
                    NavigationBarItem(
                        selected = currentRoute == ROUTE_WORKSPACE || currentRoute == ROUTE_OPERATOR_WORKSPACE,
                        onClick = {
                            val target = cabinetRouteFor(session)
                            if (target != null) {
                                open(target)
                            } else {
                                scope.launch { snackbarHostState.showSnackbar("Для этого рабочего пространства кабинет пока не построен") }
                            }
                        },
                        icon = { Icon(Icons.Filled.Dashboard, contentDescription = null) },
                        label = { Text("Кабинет", style = MaterialTheme.typography.labelSmall) },
                        alwaysShowLabel = false,
                    )
                    NavigationBarItem(
                        selected = currentRoute.startsWith(ROUTE_DIAGNOSTICS),
                        onClick = { open(ROUTE_DIAGNOSTICS) },
                        icon = { Icon(Icons.Filled.Science, contentDescription = null) },
                        label = { Text("Диагностика", style = MaterialTheme.typography.labelSmall) },
                        alwaysShowLabel = false,
                    )
                    NavigationBarItem(
                        selected = false,
                        onClick = { scope.launch { drawerState.open() } },
                        icon = { Icon(Icons.Filled.MoreHoriz, contentDescription = null) },
                        label = { Text("Ещё", style = MaterialTheme.typography.labelSmall) },
                        alwaysShowLabel = false,
                    )
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
                // Кабинет клиники и кабинет приёма (центр/лаборатория) —
                // единственные типы пространств, у которых на Android есть
                // построенный экран; для остальных типов — честный снекбар,
                // а не молчаливое «остаёмся на месте» (при котором открытый
                // сейчас экран продолжил бы работать с id уже переключённого
                // пространства чужого типа).
                when (context.scopeType) {
                    "CLINIC" -> {
                        scope.launch { snackbarHostState.showSnackbar("Активно: ${context.name}") }
                        open(ROUTE_WORKSPACE)
                    }
                    "DIAGNOSTIC_CENTER", "LABORATORY" -> {
                        scope.launch { snackbarHostState.showSnackbar("Активно: ${context.name}") }
                        open(ROUTE_OPERATOR_WORKSPACE)
                    }
                    else -> scope.launch {
                        snackbarHostState.showSnackbar("Активно: ${context.name} — кабинет для этого пространства пока не построен")
                    }
                }
            },
            viewModel = workspaceSwitcherViewModel,
        )
    }
}

/** Заголовки фиксированных экранов ядра ИИ — их нет в `pages`, поэтому нет и в списке разделов. */
private fun fixedRouteTitle(route: String): String? = when (route) {
    ROUTE_INTELLIGENCE -> "Intelligence"
    ROUTE_STOCK_RULES -> "Списание после приёма"
    ROUTE_NOTIFICATIONS -> "Уведомления"
    ROUTE_NOTIFICATION_PREFERENCES -> "Настройки уведомлений"
    ROUTE_PROFILE -> "Мой профиль"
    ROUTE_APPROVALS -> "Подтверждения ИИ"
    ROUTE_ACTIVITY -> "Активность ИИ"
    ROUTE_DIAGNOSTICS -> "Диагностика"
    ROUTE_DIAGNOSTICS_REFERRALS -> "Направления"
    ROUTE_DIAGNOSTICS_REFERRAL_NEW -> "Новое направление"
    "$ROUTE_DIAGNOSTICS_REFERRALS/{id}" -> "Направление"
    ROUTE_DIAGNOSTICS_CENTERS -> "Диагностические центры"
    ROUTE_DIAGNOSTICS_LABS -> "Лаборатории"
    ROUTE_DIAGNOSTICS_RESULTS -> "Результаты исследований"
    ROUTE_DIAGNOSTICS_PATIENTS -> "Пациенты диагностики"
    ROUTE_DIAGNOSTICS_CALENDAR -> "Календарь диагностики"
    ROUTE_DIAGNOSTICS_STATISTICS -> "Статистика диагностики"
    ROUTE_DIAGNOSTICS_SETTINGS -> "Настройки диагностики"
    ROUTE_DIAGNOSTICS_REGISTRATIONS -> "Заявки на регистрацию"
    ROUTE_OPERATOR_WORKSPACE -> "Кабинет приёма"
    ROUTE_OPERATOR_CASHIER -> "Касса"
    ROUTE_OPERATOR_FINANCE -> "Финансы"
    ROUTE_OPERATOR_SERVICES -> "Услуги и цены"
    ROUTE_OPERATOR_PAYMENTS -> "Оплаты"
    ROUTE_OPERATOR_TEAM -> "Сотрудники"
    ROUTE_JOBS -> "Вакансии"
    ROUTE_COMMUNITY -> "Сообщество"
    ROUTE_SHOP_SCHOOL -> "Магазин и школа"
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
                WorkspaceScreen(
                    session = session,
                    implemented = implemented,
                    onOpenPage = { page -> onNavigate(page.route) },
                )
            }
            composable("$ROUTE_PATIENT_DETAIL/{id}") { backStackEntry ->
                val id = backStackEntry.arguments?.getString("id")
                val patient by SelectedPatient.value.collectAsStateWithLifecycle()
                val current = patient?.takeIf { it.id == id }
                if (current != null) {
                    PatientDetailScreen(
                        patient = current,
                        clinicId = session.clinic?.id,
                        canWrite = session.has("patients.write"),
                    )
                } else {
                    // Держатель пуст — процесс пересоздан или маршрут открыт
                    // напрямую (диплинк). Честное сообщение вместо пустого
                    // экрана: у карточки пациента нет собственной ручки
                    // «получить по id», только то, что уже пришло списком.
                    EmptyStateView(
                        title = "Пациент не выбран",
                        description = "Откройте карточку из списка пациентов.",
                    )
                }
            }
            composable(ROUTE_STOCK_RULES) {
                StockRulesScreen(canWrite = session.has("inventory.write"))
            }
            composable(ROUTE_NOTIFICATIONS) {
                NotificationsScreen(onOpenPreferences = { onNavigate(ROUTE_NOTIFICATION_PREFERENCES) })
            }
            composable(ROUTE_NOTIFICATION_PREFERENCES) { NotificationPreferencesScreen() }
            composable(ROUTE_PROFILE) { ProfileScreen() }
            composable(ROUTE_APPROVALS) { ApprovalsScreen() }
            composable(ROUTE_ACTIVITY) { ActivityScreen() }
            composable(ROUTE_DIAGNOSTICS) { DiagnosticsHomeScreen(session = session) }
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
            composable(ROUTE_DIAGNOSTICS_CENTERS) { DirectoryScreen(kind = DiagnosticOrgKind.CENTER) }
            composable(ROUTE_DIAGNOSTICS_LABS) { DirectoryScreen(kind = DiagnosticOrgKind.LABORATORY) }
            composable(ROUTE_DIAGNOSTICS_RESULTS) { ResultsScreen() }
            composable(ROUTE_DIAGNOSTICS_PATIENTS) { DiagnosticPatientsScreen() }
            composable(ROUTE_DIAGNOSTICS_CALENDAR) { DiagnosticCalendarScreen() }
            composable(ROUTE_DIAGNOSTICS_STATISTICS) { DiagnosticStatisticsScreen() }
            composable(ROUTE_DIAGNOSTICS_SETTINGS) { DiagnosticSettingsScreen(clinicId = session.clinic?.id) }
            composable(ROUTE_DIAGNOSTICS_REGISTRATIONS) { RegistrationRequestsScreen() }
            composable(ROUTE_OPERATOR_WORKSPACE) { OperatorWorkspaceScreen(session = session) }
            composable(ROUTE_OPERATOR_CASHIER) { CashierScreen(session = session) }
            composable(ROUTE_OPERATOR_FINANCE) { FinanceScreen(session = session) }
            composable(ROUTE_OPERATOR_SERVICES) { ServicesScreen(session = session) }
            composable(ROUTE_OPERATOR_PAYMENTS) { PaymentsScreen(session = session) }
            composable(ROUTE_OPERATOR_TEAM) { TeamScreen(session = session) }
            // Вошедший — всегда настоящий аккаунт (гость живёт в GuestShell,
            // у AppShell непустая Session), поэтому onRequireLogin сюда не
            // попадёт: isAuthenticated = true снимает саму проверку.
            composable(ROUTE_JOBS) {
                JobsScreen(
                    isAuthenticated = true,
                    onRequireLogin = {},
                    onAskAi = { onNavigate(ROUTE_INTELLIGENCE) },
                )
            }
            composable(ROUTE_COMMUNITY) {
                CommunityScreen(
                    isAuthenticated = true,
                    onRequireLogin = {},
                    onOpenSchool = { onNavigate(ROUTE_SHOP_SCHOOL) },
                )
            }
            composable(ROUTE_SHOP_SCHOOL) { PublicScreen(embedded = true) }
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
    onOpenCabinet: () -> Unit,
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

        // Мой профиль — визитка специалиста, видна любому вошедшему
        // безусловно, тем же принципом, что «Вакансии»/«Сообщество» ниже.
        PillarDrawerItem(
            label = "Мой профиль",
            icon = Icons.Filled.Person,
            active = currentRoute == ROUTE_PROFILE,
            onClick = { onOpen(ROUTE_PROFILE) },
        )
        PillarDrawerItem(
            label = "Кабинет",
            icon = Icons.Filled.Dashboard,
            active = currentRoute == ROUTE_WORKSPACE || currentRoute == ROUTE_OPERATOR_WORKSPACE,
            onClick = onOpenCabinet,
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
        // Кабинет приёма — сторона центра/лаборатории, а не клиники: пункт
        // виден только когда активное пространство и есть такая организация
        // (`session.user.organizationType` отражает АКТИВНОЕ пространство,
        // переиздаётся при switch-context). Без членства пункт вёл бы в
        // тупик (регистрация организации из кабинета не построена), поэтому
        // просто не показывается, а не показывается неработающим.
        if (session.user.organizationType == "DIAGNOSTIC_CENTER" || session.user.organizationType == "LABORATORY") {
            PillarDrawerItem(
                label = "Кабинет приёма",
                icon = Icons.Filled.Science,
                active = currentRoute == ROUTE_OPERATOR_WORKSPACE,
                onClick = { onOpen(ROUTE_OPERATOR_WORKSPACE) },
            )
        }
        // Вакансии — как `nav.jobs` в `Sidebar.tsx`: видны любому вошедшему
        // безусловно, не через `pages` (см. ROUTE_JOBS в Destinations.kt).
        PillarDrawerItem(
            label = "Вакансии",
            icon = Icons.Filled.Work,
            active = currentRoute == ROUTE_JOBS,
            onClick = { onOpen(ROUTE_JOBS) },
        )
        // Сообщество — тем же принципом, что «Вакансии» выше.
        PillarDrawerItem(
            label = "Сообщество",
            icon = Icons.Filled.Groups,
            active = currentRoute == ROUTE_COMMUNITY,
            onClick = { onOpen(ROUTE_COMMUNITY) },
        )
        // Магазин и школа — тот же экран, что уже есть у гостя (`PublicScreen`,
        // `embedded = true`), просто подключённый и для вошедших: раньше сюда
        // нельзя было попасть вообще ни при каком состоянии сессии.
        PillarDrawerItem(
            label = "Магазин и школа",
            icon = Icons.Filled.School,
            active = currentRoute == ROUTE_SHOP_SCHOOL,
            onClick = { onOpen(ROUTE_SHOP_SCHOOL) },
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
        // Уведомления — тем же принципом: колокольчик в шапке уже открывает
        // тот же маршрут, пункт здесь — для того, кто ищет его в «Ещё».
        PillarDrawerItem(
            label = "Уведомления",
            icon = Icons.Filled.Notifications,
            active = currentRoute == ROUTE_NOTIFICATIONS || currentRoute == ROUTE_NOTIFICATION_PREFERENCES,
            onClick = { onOpen(ROUTE_NOTIFICATIONS) },
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
