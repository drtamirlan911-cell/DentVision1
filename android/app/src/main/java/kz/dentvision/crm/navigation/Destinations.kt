package kz.dentvision.crm.navigation

import androidx.compose.runtime.Composable
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.ui.patients.PatientsScreen
import kz.dentvision.crm.ui.billing.ClinicBillingScreen
import kz.dentvision.crm.ui.dentalchart.DentalChartScreen
import kz.dentvision.crm.ui.documents.DocumentsScreen
import kz.dentvision.crm.ui.finance.FinanceHubScreen
import kz.dentvision.crm.ui.icd10.Icd10Screen
import kz.dentvision.crm.ui.lab.LabScreen
import kz.dentvision.crm.ui.plans.TreatmentPlansScreen
import kz.dentvision.crm.ui.promotions.PromotionsScreen
import kz.dentvision.crm.ui.reminders.RemindersScreen
import kz.dentvision.crm.ui.settings.ClinicSettingsScreen
import kz.dentvision.crm.ui.staff.StaffScreen
import kz.dentvision.crm.ui.workflow.WorkflowScreen
import kz.dentvision.crm.ui.inventory.InventoryScreen
import kz.dentvision.crm.ui.medcard.MedicalCardScreen
import kz.dentvision.crm.ui.pricelist.PriceListScreen
import kz.dentvision.crm.ui.schedule.ScheduleScreen
import kz.dentvision.crm.ui.visits.VisitsScreen

/**
 * Экраны, которые действительно построены и работают на настоящих данных.
 *
 * Идентификатор попадает сюда только вместе со своим рабочим экраном. Пока его
 * здесь нет, раздел не появляется ни в меню, ни в графе маршрутов — открыть
 * пустоту нельзя, и счётчик готовых разделов не врёт.
 *
 * Экран получает сессию: право писать проверяется по `permissions`, пришедшим с
 * сервера, а не по роли, угаданной на устройстве.
 *
 * Право берётся то, которое сторожит **сам маршрут**, а не то, которое кажется
 * подходящим по смыслу. Медкарта и визиты пишутся через `patient.write`
 * (`medical.routes.ts:82`, `patients.routes.ts:544`), хотя данные там
 * медицинские, — спрашивать `medical.write` значило бы показать кнопку
 * «Сохранить», после которой сервер ответит 403.
 */
val IMPLEMENTED_PAGES: Map<String, @Composable (Session) -> Unit> = mapOf(
    "schedule" to { session ->
        ScheduleScreen(
            clinicId = session.clinic?.id,
            canWrite = session.has("appointments.write"),
        )
    },
    "patients" to { session -> PatientsScreen(canWrite = session.has("patients.write")) },
    "visits" to { session ->
        VisitsScreen(
            clinicId = session.clinic?.id,
            canWrite = session.has("patients.write"),
        )
    },
    "medical-card" to { session -> MedicalCardScreen(canWrite = session.has("patients.write")) },
    // Один раздел, как в вебе: там «Касса» и «Финансы» — одна поверхность с
    // псевдонимом finance ↔ cashier в правах, и оба маршрута сторожит
    // finance.manage (он же billing.manage).
    "finance" to { session -> FinanceHubScreen(canWrite = session.has("billing.manage")) },
    "pricelist" to { session -> PriceListScreen(canWrite = session.has("patients.write")) },
    "inventory" to { session -> InventoryScreen(canWrite = session.has("inventory.write")) },
    // Заказы лаборатории сторожит appointments.write, а не lab.write:
    // так объявлены сами маршруты (`lab.routes.ts:184`).
    "lab" to { session -> LabScreen(canWrite = session.has("appointments.write")) },
    "treatment-plans" to { session -> TreatmentPlansScreen(clinicId = session.clinic?.id) },
    "documents" to { DocumentsScreen() },
    "icd10" to { Icd10Screen() },
    "promotions" to { PromotionsScreen() },
    "staff" to { session -> StaffScreen(clinicId = session.clinic?.id) },
    "dental-chart" to { DentalChartScreen() },
    "clinic-settings" to { session -> ClinicSettingsScreen(clinicId = session.clinic?.id) },
    "billing" to { ClinicBillingScreen() },
    "workflow" to { WorkflowScreen() },
    "reminders" to { session ->
        RemindersScreen(
            clinicId = session.clinic?.id,
            canWrite = session.has("appointments.write"),
        )
    },
)

/**
 * Дом оболочки — как `/` на вебе (`IntelligenceLayout.tsx`): диалог с ИИ, а
 * не список разделов CRM. `ROUTE_WORKSPACE` (кабинет клиники) остаётся, но
 * открывается уже из этого экрана или из бокового меню, а не наоборот.
 */
const val ROUTE_INTELLIGENCE = "intelligence"

/** Кабинет клиники — разделы CRM. */
const val ROUTE_WORKSPACE = "workspace"

/**
 * Поверхности governance-ядра ИИ (`AiApproval`, `AgentActivity`) — не часть
 * `pages` с сервера: это не раздел клиники, доступный по роли, а сквозной
 * инструмент, одинаковый для всех вошедших. Поэтому маршрут заводится в
 * оболочке напрямую, а не через [IMPLEMENTED_PAGES]/[CRM_PAGES].
 */
const val ROUTE_APPROVALS = "ai/approvals"
const val ROUTE_ACTIVITY = "ai/activity"

/**
 * Кабинет диагностики (исходящие направления) — как `nav.diagnostics` в
 * `Sidebar.tsx`: доступен любому вошедшему не-гостю всегда, безусловно,
 * независимо от активного рабочего пространства. У сервера нет для него
 * ни списка `pages`, ни проверки прав на клиенте (реальная защита —
 * `loadClinicAccess`/`authorizeReferralListScope` на бэкенде), поэтому
 * маршруты заводятся напрямую, как [ROUTE_APPROVALS]/[ROUTE_ACTIVITY], а не
 * через [IMPLEMENTED_PAGES]/`CRM_PAGES`.
 */
const val ROUTE_DIAGNOSTICS = "diagnostics"
const val ROUTE_DIAGNOSTICS_REFERRALS = "diagnostics/referrals"

/**
 * Форма создания направления. Регистрируется в `AppShell.kt` **раньше**
 * `"$ROUTE_DIAGNOSTICS_REFERRALS/{id}"` — у Navigation-Compose порядок
 * объявления решает, какой маршрут матчится первым, а буквальный `.../new`
 * и параметризованный `.../{id}` иначе конфликтуют.
 */
const val ROUTE_DIAGNOSTICS_REFERRAL_NEW = "$ROUTE_DIAGNOSTICS_REFERRALS/new"

/** Справочники — те же данные, что уже строит пикер учреждения в форме направления. */
const val ROUTE_DIAGNOSTICS_CENTERS = "diagnostics/centers"
const val ROUTE_DIAGNOSTICS_LABS = "diagnostics/laboratories"

/** Завершённые/просмотренные направления — фильтр того же `/referrals`. */
const val ROUTE_DIAGNOSTICS_RESULTS = "diagnostics/results"

/** Пациенты диагностики — группировка того же списка направлений, без своей ручки. */
const val ROUTE_DIAGNOSTICS_PATIENTS = "diagnostics/patients"

/** Календарь диагностики — тот же список направлений, разложенный по датам. */
const val ROUTE_DIAGNOSTICS_CALENDAR = "diagnostics/calendar"

/** Статистика диагностики — тот же список направлений, посчитанный на клиенте. */
const val ROUTE_DIAGNOSTICS_STATISTICS = "diagnostics/statistics"

/** Настройки диагностики — подобъект `diagnostics` общих настроек клиники. */
const val ROUTE_DIAGNOSTICS_SETTINGS = "diagnostics/settings"

/**
 * Заявки на регистрацию центров/лабораторий — только SUPERADMIN
 * (`requireSuperadmin` на сервере). Кнопка входа на [ROUTE_DIAGNOSTICS]
 * скрыта для остальных ролей, но сам маршрут заводится безусловно, как и
 * другие разделы диагностики — реальная защита всё равно на бэкенде.
 */
const val ROUTE_DIAGNOSTICS_REGISTRATIONS = "diagnostics/registrations"

/**
 * Кабинет приёма — сторона диагностического центра/лаборатории, получающая
 * направления (`DiagnosticWorkspace` на вебе, `/center-workspace`). Виден
 * только когда `session.user.organizationType` — `DIAGNOSTIC_CENTER` или
 * `LABORATORY` (см. `DrawerContent` в `AppShell.kt`), в отличие от
 * [ROUTE_DIAGNOSTICS], который виден всем безусловно.
 */
const val ROUTE_OPERATOR_WORKSPACE = "operator-workspace"

/** Касса кабинета приёма — приём оплаты за уже принятое направление. */
const val ROUTE_OPERATOR_CASHIER = "operator-workspace/cashier"

/** Финансы кабинета приёма — доход/комиссия/статусы, только чтение. */
const val ROUTE_OPERATOR_FINANCE = "operator-workspace/finance"

/** Услуги и цены кабинета приёма — прайс-лист центра/лаборатории. */
const val ROUTE_OPERATOR_SERVICES = "operator-workspace/services"

/** Оплаты кабинета приёма — история + итоги, только чтение. */
const val ROUTE_OPERATOR_PAYMENTS = "operator-workspace/payments"

/** Сотрудники кабинета приёма — коды приглашений. */
const val ROUTE_OPERATOR_TEAM = "operator-workspace/team"
