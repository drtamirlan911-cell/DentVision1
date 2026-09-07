package kz.dentvision.crm.ui.guest

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Login
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Biotech
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.MedicalServices
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.Sell
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.Store
import androidx.compose.material.icons.filled.TipsAndUpdates
import androidx.compose.material.icons.filled.Work
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDrawerState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import kz.dentvision.crm.ui.auth.LoginScreen
import kz.dentvision.crm.ui.common.DvLogo
import kz.dentvision.crm.ui.community.CommunityScreen
import kz.dentvision.crm.ui.intelligence.IntelligenceScreen
import kz.dentvision.crm.ui.jobs.JobsScreen
import kz.dentvision.crm.ui.public.DiagnosticsRegisterScreen
import kz.dentvision.crm.ui.public.PublicScreen
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Куда попадает гость внутри постоянной оболочки.
 */
private enum class GuestDestination { HOME, PUBLIC_MARKET, PUBLIC_ACADEMY, REGISTER_DIAGNOSTICS, JOBS, COMMUNITY, PRICING, DEMO, LOGIN, REGISTER }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GuestShell() {
    var destination by rememberSaveable { mutableStateOf(GuestDestination.HOME) }
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    var guideOpen by remember { mutableStateOf(false) }

    fun open(target: GuestDestination) {
        destination = target
        scope.launch { drawerState.close() }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(drawerContainerColor = DvTheme.colors.surface1) {
                GuestDrawerContent(destination = destination, onOpen = ::open)
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
                            Text(
                                text = "DentVision",
                                style = MaterialTheme.typography.titleMedium,
                                color = DvTheme.colors.textPrimary,
                            )
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(Icons.Filled.Menu, contentDescription = "Меню разделов", tint = DvTheme.colors.textSecondary)
                        }
                    },
                    actions = {
                        IconButton(onClick = { guideOpen = true }) {
                            Icon(
                                Icons.Filled.TipsAndUpdates,
                                contentDescription = "Гид по платформе",
                                tint = DvTheme.colors.gold,
                            )
                        }
                        TextButton(onClick = { open(GuestDestination.LOGIN) }) { Text("Войти") }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = DvTheme.colors.surface1),
                )
            },
            bottomBar = {
                NavigationBar(
                    containerColor = DvTheme.colors.surface1,
                    contentColor = DvTheme.colors.textSecondary,
                ) {
                    NavigationBarItem(
                        selected = destination == GuestDestination.DEMO,
                        onClick = { open(GuestDestination.DEMO) },
                        icon = { Icon(Icons.Filled.MedicalServices, contentDescription = null) },
                        label = { Text("CRM", style = MaterialTheme.typography.labelSmall) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = DvTheme.colors.gold,
                            selectedTextColor = DvTheme.colors.gold,
                            indicatorColor = DvTheme.colors.gold.copy(alpha = 0.15f),
                            unselectedIconColor = DvTheme.colors.textSecondary,
                            unselectedTextColor = DvTheme.colors.textSecondary,
                        )
                    )
                    NavigationBarItem(
                        selected = destination == GuestDestination.PUBLIC_MARKET,
                        onClick = { open(GuestDestination.PUBLIC_MARKET) },
                        icon = { Icon(Icons.Filled.ShoppingCart, contentDescription = null) },
                        label = { Text("Маркет", style = MaterialTheme.typography.labelSmall) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = DvTheme.colors.gold,
                            selectedTextColor = DvTheme.colors.gold,
                            indicatorColor = DvTheme.colors.gold.copy(alpha = 0.15f),
                            unselectedIconColor = DvTheme.colors.textSecondary,
                            unselectedTextColor = DvTheme.colors.textSecondary,
                        )
                    )
                    NavigationBarItem(
                        selected = destination == GuestDestination.HOME,
                        onClick = { open(GuestDestination.HOME) },
                        icon = { Icon(Icons.Filled.SmartToy, contentDescription = null) },
                        label = { Text("AI", style = MaterialTheme.typography.labelSmall) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = DvTheme.colors.gold,
                            selectedTextColor = DvTheme.colors.gold,
                            indicatorColor = DvTheme.colors.gold.copy(alpha = 0.15f),
                            unselectedIconColor = DvTheme.colors.textSecondary,
                            unselectedTextColor = DvTheme.colors.textSecondary,
                        )
                    )
                    NavigationBarItem(
                        selected = destination == GuestDestination.PUBLIC_ACADEMY,
                        onClick = { open(GuestDestination.PUBLIC_ACADEMY) },
                        icon = { Icon(Icons.Filled.School, contentDescription = null) },
                        label = { Text("Academy", style = MaterialTheme.typography.labelSmall) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = DvTheme.colors.gold,
                            selectedTextColor = DvTheme.colors.gold,
                            indicatorColor = DvTheme.colors.gold.copy(alpha = 0.15f),
                            unselectedIconColor = DvTheme.colors.textSecondary,
                            unselectedTextColor = DvTheme.colors.textSecondary,
                        )
                    )
                    NavigationBarItem(
                        selected = destination == GuestDestination.COMMUNITY,
                        onClick = { open(GuestDestination.COMMUNITY) },
                        icon = { Icon(Icons.Filled.Groups, contentDescription = null) },
                        label = { Text("Сеть", style = MaterialTheme.typography.labelSmall) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = DvTheme.colors.gold,
                            selectedTextColor = DvTheme.colors.gold,
                            indicatorColor = DvTheme.colors.gold.copy(alpha = 0.15f),
                            unselectedIconColor = DvTheme.colors.textSecondary,
                            unselectedTextColor = DvTheme.colors.textSecondary,
                        )
                    )
                }
            }
        ) { padding ->
            Column(modifier = Modifier.padding(padding)) {
                when (destination) {
                    GuestDestination.HOME -> IntelligenceScreen(
                        onNavigate = { path -> resolveGuestPath(path, ::open) },
                    )
                    GuestDestination.PUBLIC_MARKET -> PublicScreen(
                        embedded = true,
                        showRegisterBanner = true,
                        onRegisterDiagnostics = { open(GuestDestination.REGISTER_DIAGNOSTICS) },
                        isAuthenticated = false,
                        onRequireLogin = { open(GuestDestination.LOGIN) },
                    )
                    GuestDestination.PUBLIC_ACADEMY -> PublicScreen(
                        embedded = true,
                        showRegisterBanner = true,
                        onRegisterDiagnostics = { open(GuestDestination.REGISTER_DIAGNOSTICS) },
                        isAuthenticated = false,
                        onRequireLogin = { open(GuestDestination.LOGIN) },
                    )
                    GuestDestination.REGISTER_DIAGNOSTICS -> DiagnosticsRegisterScreen(
                        onBack = { open(GuestDestination.HOME) },
                    )
                    GuestDestination.PRICING -> PricingScreen(
                        onRegister = { open(GuestDestination.REGISTER) },
                        onContactUs = { open(GuestDestination.COMMUNITY) },
                    )
                    GuestDestination.JOBS -> JobsScreen(
                        isAuthenticated = false,
                        onRequireLogin = { open(GuestDestination.LOGIN) },
                        onAskAi = { open(GuestDestination.HOME) },
                    )
                    GuestDestination.COMMUNITY -> CommunityScreen(
                        isAuthenticated = false,
                        onRequireLogin = { open(GuestDestination.LOGIN) },
                        onOpenSchool = { open(GuestDestination.PUBLIC_ACADEMY) },
                    )
                    GuestDestination.DEMO -> GuestDemoScreen(
                        onBack = { open(GuestDestination.HOME) },
                        onSignIn = { open(GuestDestination.LOGIN) },
                    )
                    GuestDestination.LOGIN -> LoginScreen(
                        onBrowsePublic = { open(GuestDestination.HOME) },
                    )
                    GuestDestination.REGISTER -> GuestRegisterScreen(
                        onBack = { open(GuestDestination.HOME) },
                        onSignIn = { open(GuestDestination.LOGIN) },
                    )
                }
            }
        }
    }

    if (guideOpen) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { guideOpen = false },
            sheetState = sheetState,
            containerColor = DvTheme.colors.surface1,
        ) {
            GuestGuideSheet(
                onDemo = {
                    guideOpen = false
                    open(GuestDestination.DEMO)
                },
                onLogin = {
                    guideOpen = false
                    open(GuestDestination.LOGIN)
                },
            )
        }
    }
}

/**
 * `/shop`,`/school` → витрина; `/register-diagnostics` → регистрация центра;
 * `/crm/schedule?demo=1` → демо-клиника; всё остальное — вход.
 */
private fun resolveGuestPath(path: String, open: (GuestDestination) -> Unit) {
    if (path.contains("demo=1")) {
        open(GuestDestination.DEMO)
        return
    }
    when (path.substringBefore('?')) {
        "/shop" -> open(GuestDestination.PUBLIC_MARKET)
        "/school" -> open(GuestDestination.PUBLIC_ACADEMY)
        "/register-diagnostics" -> open(GuestDestination.REGISTER_DIAGNOSTICS)
        "/jobs" -> open(GuestDestination.JOBS)
        "/community" -> open(GuestDestination.COMMUNITY)
        "/pricing" -> open(GuestDestination.PRICING)
        else -> open(GuestDestination.LOGIN)
    }
}

@Composable
private fun GuestDrawerContent(destination: GuestDestination, onOpen: (GuestDestination) -> Unit) {
    Column(modifier = Modifier.verticalScroll(rememberScrollState()).padding(vertical = 12.dp)) {
        // Logo & Title
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
        ) {
            DvLogo(size = 32.dp, modifier = Modifier.padding(end = 10.dp))
            Text(text = "DentVision", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = DvTheme.colors.textPrimary)
        }

        // Guest Card Block
        Box(
            modifier = Modifier
                .padding(horizontal = 20.dp, vertical = 6.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(DvTheme.colors.surface2)
                .padding(12.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(DvTheme.colors.surface3),
                    contentAlignment = Alignment.Center
                ) {
                    Text(text = "Г", style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary, fontWeight = FontWeight.Bold)
                }
                Column(modifier = Modifier.padding(start = 12.dp)) {
                    Text(text = "Гость", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, color = DvTheme.colors.textPrimary)
                    Text(text = "Анонимный доступ", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
                }
            }
        }

        // Intelligence Block
        Box(
            modifier = Modifier
                .padding(horizontal = 20.dp, vertical = 6.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .clickable { onOpen(GuestDestination.HOME) }
                .padding(8.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(18.dp))
                        .background(DvTheme.colors.gold.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Filled.SmartToy, contentDescription = null, tint = DvTheme.colors.gold, modifier = Modifier.size(20.dp))
                }
                Column(modifier = Modifier.padding(start = 12.dp)) {
                    Text(text = "Intelligence", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = DvTheme.colors.gold)
                    Text(text = "Цифровой ассистент", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
                }
            }
        }

        // Hero Intro Card
        Box(
            modifier = Modifier
                .padding(horizontal = 20.dp, vertical = 8.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .border(1.dp, DvTheme.colors.borderSubtle, RoundedCornerShape(16.dp))
                .background(DvTheme.colors.surface1)
                .padding(16.dp)
        ) {
            Column {
                Text(
                    text = "Знакомство с DentVision",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = DvTheme.colors.textPrimary
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "CRM, маркетплейс и Academy в одной SuperApp. Откройте демо или спросите ИИ.",
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.textSecondary
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedButton(
                    onClick = { onOpen(GuestDestination.DEMO) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = DvTheme.colors.gold.copy(alpha = 0.65f),
                        contentColor = DvTheme.colors.surface0,
                    ),
                    border = null,
                ) {
                    Text("Открыть демо", fontWeight = FontWeight.Bold)
                }
            }
        }

        Text(
            text = "ОТКРЫТЬ",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = DvTheme.colors.textMuted,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
        )

        GuestDrawerItem(
            label = "Демо клиника",
            icon = Icons.Filled.Business,
            active = destination == GuestDestination.DEMO,
            onClick = { onOpen(GuestDestination.DEMO) },
        )
        GuestDrawerItem(
            label = "Маркетплейс",
            icon = Icons.Filled.ShoppingCart,
            active = destination == GuestDestination.PUBLIC_MARKET,
            onClick = { onOpen(GuestDestination.PUBLIC_MARKET) },
        )
        GuestDrawerItem(
            label = "Academy OS",
            icon = Icons.Filled.School,
            active = destination == GuestDestination.PUBLIC_ACADEMY,
            onClick = { onOpen(GuestDestination.PUBLIC_ACADEMY) },
        )
        GuestDrawerItem(
            label = "Вакансии",
            icon = Icons.Filled.Work,
            active = destination == GuestDestination.JOBS,
            onClick = { onOpen(GuestDestination.JOBS) },
        )
        GuestDrawerItem(
            label = "Сообщество",
            icon = Icons.Filled.Groups,
            active = destination == GuestDestination.COMMUNITY,
            onClick = { onOpen(GuestDestination.COMMUNITY) },
        )

        HorizontalDivider(color = DvTheme.colors.borderSubtle, modifier = Modifier.padding(vertical = 12.dp, horizontal = 20.dp))

        GuestDrawerItem(
            label = "Войти",
            icon = Icons.AutoMirrored.Filled.Login,
            active = destination == GuestDestination.LOGIN,
            onClick = { onOpen(GuestDestination.LOGIN) },
        )
        GuestDrawerItem(
            label = "Зарегистрироваться",
            icon = Icons.Filled.PersonAdd,
            active = destination == GuestDestination.REGISTER,
            onClick = { onOpen(GuestDestination.REGISTER) },
            tint = DvTheme.colors.gold,
        )
    }
}

@Composable
private fun GuestDrawerItem(
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
            .padding(horizontal = 20.dp, vertical = 10.dp),
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
            color = if (active) colors.textPrimary else colors.textSecondary,
            modifier = Modifier.padding(start = 12.dp),
        )
    }
}
