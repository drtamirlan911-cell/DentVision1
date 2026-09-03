package kz.dentvision.crm.navigation

/**
 * Действия ассистента и тревоги брифинга возвращают веб-пути
 * (`NAVIGATION_ACTION_PATHS` в `ai.routes.ts`: `/crm/schedule`, `/shop`, …).
 * Android понимает только те, для которых уже есть построенный экран —
 * сопоставляем через тот же каталог [CRM_PAGES], которым живёт меню, а не
 * через отдельно придуманный список.
 *
 * Путь без готового экрана — не ошибка, а честная граница: раздел открыт
 * пока только в браузере, и ассистент должен сказать это, а не притвориться,
 * что нажатие сработало.
 */
fun resolveAssistantPath(path: String?, implemented: Set<String>): String? {
    if (path.isNullOrBlank()) return null
    val clean = path.substringBefore('?').removePrefix("/")
    val page = CRM_PAGES.firstOrNull { it.route == clean } ?: return null
    return if (page.id in implemented) page.route else null
}

/**
 * Перенос `AI_NAV_ACTIONS` (`src/lib/aiPlatformMap.ts`) — известные алиасы
 * («OpenSchedule», «OpenShop», …) резолвятся в путь на клиенте, а не через
 * `POST /api/ai/action`. Это не оптимизация: маршрут `/action` требует входа
 * (`authenticate`), а именно эти алиасы приходят в тревогах для гостя
 * (`buildProactiveAlerts`: `OpenDemo`, `OpenShop`, `OpenSchool`) — без этой
 * карты нажатие на них у гостя падало бы 403.
 */
val AI_NAV_ACTIONS: Map<String, String> = mapOf(
    "OpenSchedule" to "/crm/schedule",
    "OPEN_SCHEDULE" to "/crm/schedule",
    "OpenPatients" to "/crm/patients",
    "OPEN_PATIENTS" to "/crm/patients",
    "OpenPatient" to "/crm/patients",
    "OpenMedicalCard" to "/crm/medical-card",
    "OPEN_MEDICAL_CARD" to "/crm/medical-card",
    "OpenCashier" to "/crm/finance",
    "OpenFinance" to "/crm/finance",
    "OPEN_FINANCE" to "/crm/finance",
    "OpenLab" to "/crm/lab",
    "OPEN_LABORATORY" to "/crm/lab",
    "OpenInventory" to "/crm/inventory",
    "OPEN_INVENTORY" to "/crm/inventory",
    "OpenStaff" to "/crm/staff",
    "OpenVisits" to "/crm/visits",
    "OpenDocuments" to "/crm/documents",
    "OPEN_DOCUMENTS" to "/crm/documents",
    "OpenReminders" to "/crm/reminders",
    "OpenDentalChart" to "/crm/dental-chart",
    "OpenTreatmentPlans" to "/crm/treatment-plans",
    "OpenPriceList" to "/crm/pricelist",
    "OpenPromotions" to "/crm/promotions",
    "OpenICD10" to "/crm/icd10",
    "OpenClinicSettings" to "/crm/clinic-settings",
    "OpenBilling" to "/crm/billing",
    "OPEN_BILLING" to "/crm/billing",
    "OPEN_INVOICE" to "/crm/finance",
    "OpenInvoice" to "/crm/finance",
    "OpenShop" to "/shop",
    "OPEN_SHOP" to "/shop",
    "OpenSchool" to "/school",
    "OPEN_SCHOOL" to "/school",
    "OpenSchoolWorkspace" to "/school-workspace",
    "OpenSupplier" to "/supplier",
    "OpenAnalytics" to "/analytics",
    "OPEN_ANALYTICS" to "/analytics",
    "OpenCRM" to "/crm/schedule",
    "OPEN_CRM" to "/crm/schedule",
    "OpenProfile" to "/profile",
    "OpenSettings" to "/settings",
    "OpenMyClinics" to "/my-clinics",
    "OpenDemo" to "/crm/schedule?demo=1",
    "OpenPricing" to "/pricing",
    "OpenJobs" to "/jobs",
    "OpenCommunity" to "/community",
    "OpenAdmin" to "/admin",
    "OpenAudit" to "/audit",
    "OpenBackup" to "/backup",
)
