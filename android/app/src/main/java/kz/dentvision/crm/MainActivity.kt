package kz.dentvision.crm

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.AuthRepository
import kz.dentvision.crm.data.ServiceLocator
import kz.dentvision.crm.ui.auth.LoginScreen
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.intelligence.GuestHomeScreen
import kz.dentvision.crm.ui.public.DiagnosticsRegisterScreen
import kz.dentvision.crm.ui.public.PublicScreen
import kz.dentvision.crm.ui.shell.AppShell
import kz.dentvision.crm.ui.theme.DentVisionTheme
import kz.dentvision.crm.ui.theme.DvTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            DentVisionTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = DvTheme.colors.surface0,
                ) {
                    DentVisionRoot()
                }
            }
        }
    }
}

/** Куда попадает гость (`session == null`) — вход не входит по умолчанию. */
private enum class GuestDestination { HOME, PUBLIC, REGISTER_DIAGNOSTICS, LOGIN }

/**
 * Одна развилка на всё приложение: есть живая сессия — кабинет, нет — гость.
 *
 * Гость — не «экран входа по умолчанию»: дом гостя тот же Intelligence, что
 * и у вошедшего (`GuestHomeScreen`, тот же принцип, что у Kaspi — без входа
 * можно пользоваться, войти просят не на пороге, а там, где это реально
 * нужно). Форма входа — один из трёх гостевых экранов, а не единственный.
 *
 * Пока сессия читается с диска, не показывается ни один из вариантов:
 * мелькнувший экран у вошедшего человека выглядит как разлогин, которого
 * не было.
 */
@Composable
private fun DentVisionRoot() {
    val store = ServiceLocator.session
    val session by store.session.collectAsStateWithLifecycle()
    val restored by store.restored.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()

    // Обновление токена не удалось — сессии больше нет. Стирает её сам
    // авторизатор, здесь только уводим на вход.
    LaunchedEffect(Unit) {
        ServiceLocator.api.sessionLost.collect { store.clear() }
    }

    var guestDestination by rememberSaveable { mutableStateOf(GuestDestination.HOME) }

    when {
        !restored -> Box(modifier = Modifier.fillMaxSize()) { LoadingSkeleton(rows = 3) }
        session == null -> when (guestDestination) {
            GuestDestination.HOME -> GuestHomeScreen(
                onOpenPublic = { guestDestination = GuestDestination.PUBLIC },
                onRegisterDiagnostics = { guestDestination = GuestDestination.REGISTER_DIAGNOSTICS },
                onLogin = { guestDestination = GuestDestination.LOGIN },
            )
            GuestDestination.PUBLIC -> PublicScreen(
                onBack = { guestDestination = GuestDestination.HOME },
                onSignIn = { guestDestination = GuestDestination.LOGIN },
                onRegisterDiagnostics = { guestDestination = GuestDestination.REGISTER_DIAGNOSTICS },
            )
            GuestDestination.REGISTER_DIAGNOSTICS -> DiagnosticsRegisterScreen(
                onBack = { guestDestination = GuestDestination.HOME },
            )
            GuestDestination.LOGIN -> LoginScreen(
                onBrowsePublic = { guestDestination = GuestDestination.HOME },
            )
        }
        else -> AppShell(
            session = session!!,
            onLogout = {
                scope.launch {
                    AuthRepository(ServiceLocator.api, ServiceLocator.session).logout()
                }
            },
        )
    }
}
