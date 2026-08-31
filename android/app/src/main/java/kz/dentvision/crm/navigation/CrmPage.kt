package kz.dentvision.crm.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Assignment
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.LocalHospital
import androidx.compose.material.icons.filled.MedicalInformation
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.PriceChange
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Tag
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * Разделы кабинета клиники: идентификаторы — те же строки, что приходят в
 * `pages` от сервера (`CRM_NAV_PAGE_IDS` в `src/lib/roleAccess.ts`), названия —
 * из `src/locales/ru.json`, группировка — из `src/layouts/Sidebar.tsx`.
 *
 * Ни одного идентификатора сверх тех, что уже есть в вебе: если сервер пришлёт
 * страницу, которой здесь нет, она просто не появится в меню, и это честнее,
 * чем показать пункт в никуда.
 */
enum class CrmSection(val title: String) {
    PATIENTS("Пациенты"),
    FINANCE("Финансы и склад"),
    MANAGEMENT("Управление"),
    ADMIN("Администрирование"),
}

data class CrmPage(
    /** id из `pages`, он же сегмент маршрута: `crm/schedule`. */
    val id: String,
    val label: String,
    val section: CrmSection,
    val icon: ImageVector,
) {
    val route: String get() = "crm/$id"
}

/**
 * Полный каталог разделов CRM. Наличие пункта здесь не означает, что экран
 * готов: что реально открывается, перечислено в [implementedPages].
 */
val CRM_PAGES: List<CrmPage> = listOf(
    CrmPage("schedule", "Расписание", CrmSection.PATIENTS, Icons.Filled.CalendarMonth),
    CrmPage("patients", "Пациенты", CrmSection.PATIENTS, Icons.Filled.People),
    CrmPage("visits", "Визиты", CrmSection.PATIENTS, Icons.Filled.LocalHospital),
    CrmPage("medical-card", "Медкарта", CrmSection.PATIENTS, Icons.Filled.MedicalInformation),
    CrmPage("dental-chart", "Зубная карта", CrmSection.PATIENTS, Icons.Filled.Tag),
    CrmPage("treatment-plans", "Планы лечения", CrmSection.PATIENTS, Icons.AutoMirrored.Filled.Assignment),
    CrmPage("documents", "Документы", CrmSection.PATIENTS, Icons.Filled.Description),
    CrmPage("icd10", "МКБ-10", CrmSection.PATIENTS, Icons.Filled.Science),
    CrmPage("finance", "Финансы", CrmSection.FINANCE, Icons.Filled.Payments),
    CrmPage("pricelist", "Прайс", CrmSection.FINANCE, Icons.Filled.PriceChange),
    CrmPage("inventory", "Склад", CrmSection.FINANCE, Icons.Filled.Inventory2),
    CrmPage("lab", "Лаборатория", CrmSection.FINANCE, Icons.Filled.Science),
    CrmPage("promotions", "Акции", CrmSection.FINANCE, Icons.Filled.Campaign),
    CrmPage("staff", "Сотрудники", CrmSection.MANAGEMENT, Icons.Filled.Group),
    CrmPage("reminders", "Напоминания", CrmSection.MANAGEMENT, Icons.Filled.Notifications),
    CrmPage("workflow", "Автоматизация", CrmSection.MANAGEMENT, Icons.Filled.AutoAwesome),
    CrmPage("patient-inbox", "Диалоги с пациентами", CrmSection.ADMIN, Icons.Filled.Forum),
    CrmPage("clinic-settings", "Настройки клиники", CrmSection.ADMIN, Icons.Filled.Settings),
    CrmPage("billing", "Тариф и оплата", CrmSection.ADMIN, Icons.Filled.CreditCard),
)

/**
 * Право открыть страницу — дословный перенос `canAccessPage`
 * (`src/lib/roleAccess.ts:87`), включая псевдоним «касса ↔ финансы»: это одна и
 * та же поверхность, и роль, которой дали одну, держит и другую.
 */
fun canAccessPage(allowedPages: List<String>, pageId: String): Boolean {
    if (allowedPages.isEmpty()) return false
    if (allowedPages.contains(pageId)) return true
    if (pageId == "finance" && allowedPages.contains("cashier")) return true
    if (pageId == "cashier" && allowedPages.contains("finance")) return true
    return false
}

/**
 * Меню = разрешённые сервером страницы ∩ построенные экраны.
 *
 * Второе пересечение здесь не ради осторожности, а по прямому требованию:
 * пустых экранов-заглушек в приложении нет, поэтому пункт появляется в меню
 * только когда за ним стоит работающий экран на настоящих данных.
 */
fun visiblePages(allowedPages: List<String>, implemented: Set<String>): List<CrmPage> =
    CRM_PAGES.filter { it.id in implemented && canAccessPage(allowedPages, it.id) }
