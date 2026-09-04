package kz.dentvision.crm.ui.intelligence

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import kz.dentvision.crm.ui.common.DvLogo
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Дом гостя — тот же Intelligence, что и у вошедшего (веб не делит `/` на
 * гостевую и авторизованную версии, только текст и квоту), но без оболочки
 * кабинета: гостю нечего переключать в drawer, у него есть только эти три
 * места — витрина (`PublicScreen`), заявка на подключение диагностики
 * (`DiagnosticsRegisterScreen`) и форма входа.
 *
 * Кнопка «Войти» всегда на виду и никогда не блокирует — это и есть отличие
 * от прежнего поведения (жёсткий `LoginScreen` первым экраном): войти можно
 * в любой момент, а не обязательно сразу.
 */
@Composable
fun GuestHomeScreen(
    onOpenPublic: () -> Unit,
    onRegisterDiagnostics: () -> Unit,
    onLogin: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(DvTheme.colors.surface1)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            DvLogo(size = 28.dp, modifier = Modifier.padding(end = 10.dp))
            Text(
                text = "DentVision",
                style = MaterialTheme.typography.titleMedium,
                color = DvTheme.colors.textPrimary,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = onLogin) { Text("Войти") }
        }
        HorizontalDivider(color = DvTheme.colors.borderSubtle)

        IntelligenceScreen(
            modifier = Modifier.weight(1f),
            onNavigate = { path ->
                val clean = path.substringBefore('?')
                when (clean) {
                    // Раздел открыт без входа на бэкенде (`shop.routes.ts`/
                    // `school.routes.ts` без `authenticate`) — та же витрина,
                    // что уже построена для гостя.
                    "/shop", "/school" -> onOpenPublic()
                    // Тоже открыт без входа (`optionalAuth`, не `authenticate`).
                    "/register-diagnostics" -> onRegisterDiagnostics()
                    // Всё остальное, включая `/crm/*` (демо тоже): своей
                    // анонимной инфраструктуры для кабинета клиники на
                    // Android нет — честная граница, а не выдуманная.
                    else -> onLogin()
                }
            },
        )
    }
}
