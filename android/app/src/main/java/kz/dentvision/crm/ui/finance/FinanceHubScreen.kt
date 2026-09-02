package kz.dentvision.crm.ui.finance

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import kz.dentvision.crm.ui.cashier.CashierScreen
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Деньги клиники одной поверхностью — так же, как в вебе, где «Касса» и
 * «Финансы» это один раздел с псевдонимом `finance ↔ cashier` в правах.
 *
 * Вкладки, а не два пункта меню: занятия действительно разные — пробить оплату
 * и посмотреть итоги — но данные одни и те же, и оба маршрута сторожит
 * `finance.manage`. Разводить их по разным разделам значило бы обещать, что
 * доступ к ним разный.
 */
@Composable
fun FinanceHubScreen(canWrite: Boolean) {
    var tab by remember { mutableIntStateOf(0) }

    Column(modifier = Modifier.fillMaxSize()) {
        TabRow(
            selectedTabIndex = tab,
            containerColor = DvTheme.colors.surface1,
            contentColor = DvTheme.colors.gold,
        ) {
            Tab(
                selected = tab == 0,
                onClick = { tab = 0 },
                text = { Text("Касса", style = MaterialTheme.typography.labelLarge) },
            )
            Tab(
                selected = tab == 1,
                onClick = { tab = 1 },
                text = { Text("Итоги", style = MaterialTheme.typography.labelLarge) },
            )
        }
        when (tab) {
            0 -> CashierScreen(canWrite = canWrite)
            else -> FinanceScreen()
        }
    }
}
