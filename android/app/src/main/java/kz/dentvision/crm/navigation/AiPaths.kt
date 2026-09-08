package kz.dentvision.crm.navigation

/**
 * Сквозные разделы Super App. Пути синхронизированы с web AI platform map.
 */
private val PILLAR_PATHS: Map<String, String> = mapOf(
    "/jobs" to ROUTE_JOBS,
    "/community" to ROUTE_COMMUNITY,
    "/shop" to ROUTE_SHOP_SCHOOL,
    "/school" to ROUTE_SHOP_SCHOOL,
)

fun resolveAssistantPath(path: String?, implemented: Set<String>): String? {
    if (path.isNullOrBlank()) return null
    val cleanWithSlash = path.substringBefore('?')
    PILLAR_PATHS[cleanWithSlash]?.let { return it }
    val clean = cleanWithSlash.removePrefix("/")
    val page = CRM_PAGES.firstOrNull { it.route == clean } ?: return null
    return if (page.id in implemented) page.route else null
}

/**
 * Mirror of web `AI_NAV_ACTIONS`. Keep aliases identical so the same AI
 * response produces the same destination on web and Android.
 */
val AI_NAV_ACTIONS: Map<String, String> = mapOf(
    "OpenSchedule" to "/crm/schedule",
    "OPEN_SCHEDULE" to "/crm/schedule",
    "OpenPatients" to "/crm/patients",
    "OPEN_PATIENTS" to "/crm/patients",
    "OpenPatient" to "/crm/patients",
    "OpenMedicalCard" to "/crm/medical-card",
    "OPEN_MEDICAL_CARD" to "/crm/medical-card",
    "OpenCashier" to "/crm/cashier",
    "OpenFinance" to "/crm/cashier",
    "OPEN_FINANCE" to "/crm/cashier",
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
    "OPEN_INVOICE" to "/crm/cashier",
    "OpenInvoice" to "/crm/cashier",
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
