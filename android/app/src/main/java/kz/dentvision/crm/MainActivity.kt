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

/**
 * Одна развилка на всё приложение: есть живая сессия — кабинет, нет — вход.
 *
 * Пока сессия читается с диска, не показывается ни то ни другое: мелькнувший
 * экран входа у вошедшего человека выглядит как разлогин, которого не было.
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

    // Публичная витрина — не «состояние входа», а отдельное место, куда можно
    // зайти и вернуться. Поэтому обычный флаг, а не третий вид сессии: сессии
    // тут нет вовсе, и делать вид, что есть, было бы враньём в модели.
    var browsingPublic by rememberSaveable { mutableStateOf(false) }

    when {
        !restored -> Box(modifier = Modifier.fillMaxSize()) { LoadingSkeleton(rows = 3) }
        session == null && browsingPublic -> PublicScreen(onSignIn = { browsingPublic = false })
        session == null -> LoginScreen(onBrowsePublic = { browsingPublic = true })
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
