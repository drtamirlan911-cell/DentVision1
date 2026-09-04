package kz.dentvision.crm.ui.guest

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Column
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Login
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.Sell
import androidx.compose.material.icons.filled.Work
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDrawerState
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
 * Куда попадает гость внутри постоянной оболочки. Вход и регистрация — тоже
 * пункты этой же оболочки, а не отдельный экран поверх всего: они не
 * блокируют, к ним просто можно перейти и вернуться.
 */
private enum class GuestDestination { HOME, PUBLIC, REGISTER_DIAGNOSTICS, JOBS, COMMUNITY, PRICING, LOGIN, REGISTER }

/**
 * Постоянная оболочка гостя — тот же принцип, что `AppShell.kt` у вошедшего:
 * выдвижное меню + верхняя панель, а не самодельная 4-состояная развилка без
 * навигации, которая была здесь раньше. Отдельная от `AppShell`, а не его
 * вариант с пустой сессией: тот завязан на непустую `Session` в сотнях мест
 * (клиника, права, разделы CRM) — переделывать его под гостя рискованнее,
 * чем держать маленькую параллельную оболочку с другим, куда более коротким
 * набором разделов.
 *
 * На вебе гость получает тот же список пунктов, что и вошедший, только
 * урезанный (`GUEST_NAV_ITEMS` в `Sidebar.tsx`: Демо/Магазин/Школа/Вакансии/
 * Сообщество/Тарифы) — здесь только то, что уже реально построено и работает
 * (Ассистент, Магазин и Школа, регистрация диагностического центра/
 * лаборатории): Демо-режим CRM и Вакансии/Сообщество/Тарифы — отдельная,
 * пока не построенная работа (см. план), а не пункт в никуда.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GuestShell() {
    var destination by rememberSaveable { mutableStateOf(GuestDestination.HOME) }
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()

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
                        TextButton(onClick = { open(GuestDestination.LOGIN) }) { Text("Войти") }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = DvTheme.colors.surface1),
                )
            },
        ) { padding ->
            Column(modifier = Modifier.padding(padding)) {
                when (destination) {
                    GuestDestination.HOME -> IntelligenceScreen(
                        onNavigate = { path -> resolveGuestPath(path, ::open) },
                    )
                    GuestDestination.PUBLIC -> PublicScreen(
                        onBack = { open(GuestDestination.HOME) },
                        onSignIn = { open(GuestDestination.LOGIN) },
                        onRegisterDiagnostics = { open(GuestDestination.REGISTER_DIAGNOSTICS) },
                    )
                    GuestDestination.REGISTER_DIAGNOSTICS -> DiagnosticsRegisterScreen(
                        onBack = { open(GuestDestination.HOME) },
                    )
                    GuestDestination.PRICING -> PricingScreen(
                        onRegister = { open(GuestDestination.REGISTER) },
                    )
                    GuestDestination.JOBS -> JobsScreen(
                        isAuthenticated = false,
                        onRequireLogin = { open(GuestDestination.LOGIN) },
                    )
                    GuestDestination.COMMUNITY -> CommunityScreen(
                        isAuthenticated = false,
                        onRequireLogin = { open(GuestDestination.LOGIN) },
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
}

/** `/shop`,`/school` → витрина; `/register-diagnostics` → регистрация центра; всё остальное — вход, честная граница (нет анонимного кабинета клиники). */
private fun resolveGuestPath(path: String, open: (GuestDestination) -> Unit) {
    when (path.substringBefore('?')) {
        "/shop", "/school" -> open(GuestDestination.PUBLIC)
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
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
        ) {
            DvLogo(size = 32.dp, modifier = Modifier.padding(end = 10.dp))
            Text(text = "DentVision", style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.gold)
        }
        Text(
            text = "Гость",
            style = MaterialTheme.typography.bodySmall,
            color = DvTheme.colors.textMuted,
            modifier = Modifier.padding(horizontal = 20.dp),
        )
        HorizontalDivider(color = DvTheme.colors.borderSubtle, modifier = Modifier.padding(vertical = 12.dp))

        GuestDrawerItem(
            label = "Ассистент",
            icon = Icons.Filled.AutoAwesome,
            active = destination == GuestDestination.HOME,
            onClick = { onOpen(GuestDestination.HOME) },
        )
        GuestDrawerItem(
            label = "Магазин и школа",
            icon = Icons.Filled.School,
            active = destination == GuestDestination.PUBLIC,
            onClick = { onOpen(GuestDestination.PUBLIC) },
        )
        GuestDrawerItem(
            label = "Диагностический центр или лаборатория",
            icon = Icons.Filled.Science,
            active = destination == GuestDestination.REGISTER_DIAGNOSTICS,
            onClick = { onOpen(GuestDestination.REGISTER_DIAGNOSTICS) },
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
        GuestDrawerItem(
            label = "Тарифы",
            icon = Icons.Filled.Sell,
            active = destination == GuestDestination.PRICING,
            onClick = { onOpen(GuestDestination.PRICING) },
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
        androidx.compose.foundation.layout.Box(
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
