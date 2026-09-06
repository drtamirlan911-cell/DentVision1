package kz.dentvision.crm.data

import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.api.ApiException
import kz.dentvision.crm.data.api.apiCall
import kz.dentvision.crm.data.api.apiCallUnit
import kz.dentvision.crm.data.model.Appointment
import kz.dentvision.crm.data.model.AppointmentUpsert
import kz.dentvision.crm.data.model.ConflictCheck
import kz.dentvision.crm.data.model.ClinicBilling
import kz.dentvision.crm.data.model.ClinicInvitation
import kz.dentvision.crm.data.model.ClinicSettings
import kz.dentvision.crm.data.model.CreateClinicInvitationRequest
import kz.dentvision.crm.data.model.Doctor
import kz.dentvision.crm.data.model.Document
import kz.dentvision.crm.data.model.Expense
import kz.dentvision.crm.data.model.ExpenseUpsert
import kz.dentvision.crm.data.model.FinanceReport
import kz.dentvision.crm.data.model.Icd10Code
import kz.dentvision.crm.data.model.IinLookup
import kz.dentvision.crm.data.model.InventoryAdjust
import kz.dentvision.crm.data.model.InventoryCreate
import kz.dentvision.crm.data.model.InventoryItem
import kz.dentvision.crm.data.model.Invoice
import kz.dentvision.crm.data.model.InvoiceCreate
import kz.dentvision.crm.data.model.LabOrder
import kz.dentvision.crm.data.model.LabOrderCreate
import kz.dentvision.crm.data.model.LabStatusUpdate
import kz.dentvision.crm.data.model.MedicalHistory
import kz.dentvision.crm.data.model.MedicalHistoryPatch
import kz.dentvision.crm.data.model.Patient
import kz.dentvision.crm.data.model.PatientUpsert
import kz.dentvision.crm.data.model.PriceListItem
import kz.dentvision.crm.data.model.MarkReminderSent
import kz.dentvision.crm.data.model.PriceListUpsert
import kz.dentvision.crm.data.model.SentReminder
import kz.dentvision.crm.data.model.Promotion
import kz.dentvision.crm.data.model.StockDeductionPreviewLine
import kz.dentvision.crm.data.model.StockRule
import kz.dentvision.crm.data.model.StockRuleUpsert
import kz.dentvision.crm.data.model.ToothFindingChange
import kz.dentvision.crm.data.model.ToothFindingRequestItem
import kz.dentvision.crm.data.model.ToothFindingsRequest
import kz.dentvision.crm.data.model.TreatmentPlan
import kz.dentvision.crm.data.model.TreatmentPlanUpsert
import kz.dentvision.crm.data.model.Visit
import kz.dentvision.crm.data.model.VisitCreate
import kz.dentvision.crm.data.model.Workflow
import kz.dentvision.crm.data.model.doctors

/**
 * Данные кабинета клиники. Слой тонкий намеренно: он разворачивает конверты и
 * постраничность, но ничего не пересчитывает и не «улучшает» — что прислал
 * бэкенд, то экран и показывает.
 *
 * Кэша здесь нет. Расписание и список пациентов меняются под руками у другой
 * регистратуры, и показать устаревшее вместо свежего — хуже, чем показать
 * загрузку.
 */
class CrmRepository(private val api: ApiClient = ServiceLocator.api) {

    // ── Пациенты ──

    suspend fun patients(): List<Patient> = apiCall { api.crm.patients() }.data

    /**
     * Поиск. Экран держит первые 200 записей и фильтрует их на месте, но полный
     * ИИН обязан уходить на сервер: нужный человек может быть тысячным в
     * списке, а слепой индекс найдёт его сразу.
     */
    suspend fun searchPatients(query: String): List<Patient> =
        apiCall { api.crm.patients(limit = 50, search = query) }.data

    suspend fun patient(id: String): Patient = apiCall { api.crm.patient(id) }

    suspend fun lookupByIin(iin: String): IinLookup = apiCall { api.crm.lookupByIin(iin) }

    suspend fun savePatient(body: PatientUpsert): Patient = apiCall { api.crm.upsertPatient(body) }

    suspend fun deletePatient(id: String) {
        apiCall { api.crm.deletePatient(id) }
    }

    // ── Медкарта ──

    suspend fun medicalHistory(patientId: String): MedicalHistory =
        apiCall { api.crm.patient(patientId) }.medicalHistory ?: MedicalHistory()

    suspend fun saveMedicalHistory(patientId: String, history: MedicalHistory) {
        apiCall { api.crm.patchMedicalHistory(patientId, MedicalHistoryPatch(history)) }
    }

    // ── Расписание ──

    /** Один день: бэкенд принимает `from`/`to` как границы по дате. */
    suspend fun appointmentsOn(date: String): List<Appointment> =
        apiCall { api.crm.appointments(from = date, to = date) }.data

    /** Диапазон дней — напоминание на завтра пересекает границу суток. */
    suspend fun appointmentsBetween(from: String, to: String): List<Appointment> =
        apiCall { api.crm.appointments(from = from, to = to) }.data

    suspend fun sentReminders(): List<SentReminder> = apiCall { api.crm.sentReminders() }

    suspend fun markReminderSent(key: String) {
        apiCall { api.crm.markReminderSent(MarkReminderSent(reminderKey = key)) }
    }

    suspend fun checkConflicts(
        date: String,
        time: String,
        doctorId: String?,
        duration: Int?,
        patientId: String?,
        excludeId: String? = null,
    ): ConflictCheck = apiCall {
        api.crm.appointmentConflicts(
            date = date,
            time = time,
            doctorId = doctorId,
            duration = duration,
            patientId = patientId,
            excludeId = excludeId,
        )
    }

    suspend fun saveAppointment(body: AppointmentUpsert): Appointment =
        apiCall { api.crm.upsertAppointment(body) }

    suspend fun deleteAppointment(id: String) {
        apiCall { api.crm.deleteAppointment(id) }
    }

    // ── Визиты ──

    suspend fun visits(patientId: String): List<Visit> = apiCall { api.crm.visits(patientId) }

    suspend fun createVisit(body: VisitCreate): Visit = apiCall { api.crm.createVisit(body) }

    /** Одна поверхность одного зуба — сервер сам сливает её с уже сохранёнными. */
    suspend fun applyToothFinding(patientId: String, tooth: Int, surface: String, status: String): List<ToothFindingChange> =
        apiCall {
            api.crm.applyToothFindings(
                ToothFindingsRequest(patientId, listOf(ToothFindingRequestItem(tooth, status, listOf(surface)))),
            )
        }

    // ── Касса ──

    suspend fun invoices(status: String? = null): List<Invoice> = apiCall { api.crm.invoices(status = status) }.data

    /** Отметить уже выставленный счёт оплаченным — долг, погашенный отдельно от его создания. */
    suspend fun payInvoice(id: String): Invoice = apiCall { api.crm.payInvoice(id) }

    /**
     * Счёт и, если его сразу оплатили, отметка об оплате.
     *
     * Двумя запросами, потому что так устроен бэкенд: создание всегда рождает
     * счёт в статусе `pending`, а оплата — отдельный маршрут. Веб делает ровно
     * то же самое (`upsertReceipt`, `src/utils/api.ts:739`).
     *
     * Провал второго запроса раньше проглатывался (`getOrDefault(created)`), и
     * оба вызывающих экрана — касса и приём оплаты в расписании — сообщали
     * человеку об успехе: форма очищалась, тост говорил «оплата принята». На
     * сервере счёт при этом оставался `pending`. То есть деньги у стойки взяты,
     * а система считает их невзятыми — расхождение, которое всплывёт при сверке
     * кассы, когда вспомнить конкретный приём уже нельзя. Теперь ошибка
     * доходит до человека и прямо говорит, что делать: счёт создан, отметить
     * оплату можно из списка счетов (тот же `payInvoice` отдельным действием).
     */
    suspend fun createInvoice(body: InvoiceCreate, markPaid: Boolean): Invoice {
        val created = apiCall { api.crm.createInvoice(body) }
        if (!markPaid) return created
        return try {
            apiCall { api.crm.payInvoice(created.id) }
        } catch (e: ApiException) {
            // `apiCall` сводит к `ApiException` все виды отказа — HTTP, таймаут,
            // обрыв связи, `ok: false` — поэтому этой ветки достаточно.
            // `SessionExpiredException` намеренно не ловим: её сообщение
            // («войдите заново») точнее любого, что можно написать здесь.
            throw ApiException(
                status = e.status,
                message = "Счёт создан, но отметить оплату не удалось: ${e.message} " +
                    "Отметьте оплату в списке счетов, чтобы касса сошлась.",
                code = e.code,
            )
        }
    }

    // ── Финансы ──

    suspend fun financeReport(from: String?, to: String?): FinanceReport =
        apiCall { api.crm.financeReport(from = from, to = to) }

    // ── Прайс ──

    suspend fun priceList(): List<PriceListItem> = apiCall { api.crm.priceList() }

    suspend fun savePriceItem(body: PriceListUpsert): PriceListItem =
        apiCall { api.crm.upsertPriceItem(body) }

    // ── Расходы ──

    suspend fun expenses(from: String? = null, to: String? = null): List<Expense> =
        apiCall { api.crm.expenses(from = from, to = to) }

    suspend fun saveExpense(body: ExpenseUpsert): Expense = apiCall { api.crm.upsertExpense(body) }

    suspend fun deleteExpense(id: String) {
        apiCall { api.crm.deleteExpense(id) }
    }

    // ── Списание расходников ──

    suspend fun stockRules(): List<StockRule> = apiCall { api.crm.stockRules() }

    suspend fun saveStockRule(body: StockRuleUpsert): StockRule =
        apiCall { api.crm.saveStockRule(body) }

    suspend fun deleteStockRule(id: String) {
        // `data: null` при успехе (`deductionRules.routes.ts`) — apiCall() принял
        // бы это за пустой ответ и бросил ошибку на успешном удалении.
        apiCallUnit { api.crm.deleteStockRule(id) }
    }

    suspend fun previewStockDeduction(serviceCodes: List<String>, diagnosis: String?): List<StockDeductionPreviewLine> =
        apiCall {
            api.crm.previewStockDeduction(
                services = serviceCodes.takeIf { it.isNotEmpty() }?.joinToString(","),
                diagnosis = diagnosis,
            )
        }

    // ── Склад ──

    suspend fun inventory(query: String? = null): List<InventoryItem> =
        apiCall { api.crm.inventory(query) }

    suspend fun createInventoryItem(body: InventoryCreate): InventoryItem =
        apiCall { api.crm.createInventoryItem(body) }

    suspend fun adjustInventory(id: String, delta: Int, note: String? = null): InventoryItem =
        apiCall { api.crm.adjustInventory(id, InventoryAdjust(delta = delta, note = note)) }

    // ── Лаборатория ──

    suspend fun labOrders(): List<LabOrder> = apiCall { api.crm.labOrders() }

    suspend fun saveLabOrder(body: LabOrderCreate): LabOrder =
        apiCall { api.crm.upsertLabOrder(body) }

    suspend fun setLabStatus(id: String, status: String): LabOrder =
        apiCall { api.crm.updateLabStatus(id, LabStatusUpdate(status)) }

    // ── Справочники и документы ──

    suspend fun icd10(query: String?): List<Icd10Code> = apiCall { api.crm.icd10(query) }

    suspend fun documents(patientId: String?): List<Document> =
        apiCall { api.crm.documents(patientId) }

    suspend fun treatmentPlans(clinicId: String, patientId: String? = null): List<TreatmentPlan> =
        apiCall { api.crm.treatmentPlans(clinicId, patientId) }

    suspend fun saveTreatmentPlan(body: TreatmentPlanUpsert): TreatmentPlan =
        apiCall { api.crm.saveTreatmentPlan(body) }

    suspend fun deleteTreatmentPlan(id: String) {
        apiCall { api.crm.deleteTreatmentPlan(id) }
    }

    suspend fun promotions(): List<Promotion> = apiCall { api.crm.promotions() }

    /** Весь состав клиники, не только врачи — для экрана «Сотрудники». */
    suspend fun members(clinicId: String) = apiCall { api.crm.clinic(clinicId) }.members

    // ── Настройки, тариф, автоматизация ──

    suspend fun clinicSettings(clinicId: String): ClinicSettings =
        apiCall { api.crm.clinicSettings(clinicId) }.settings

    suspend fun saveClinicSettings(clinicId: String, settings: ClinicSettings): ClinicSettings =
        apiCall { api.crm.saveClinicSettings(clinicId, settings) }.settings

    suspend fun clinicBilling(): ClinicBilling = apiCall { api.crm.clinicBilling() }

    suspend fun workflows(): List<Workflow> = apiCall { api.crm.workflows() }

    // ── Персонал ──

    suspend fun doctors(clinicId: String): List<Doctor> =
        apiCall { api.crm.clinic(clinicId) }.doctors()

    /**
     * Код приглашения в клинику — легаси-маршрут `POST /api/auth/invitations`,
     * не тот же, что у центра/лаборатории/поставщика (`api.iam.createInvitation`,
     * `WorkspaceRepository`): у клиники нет строки в едином графе Organization,
     * только `ClinicMember`/`ClinicInvitation`.
     */
    suspend fun createInvitation(clinicId: String, email: String?, role: String, expiresInDays: Int): ClinicInvitation =
        apiCall { api.auth.createInvitation(CreateClinicInvitationRequest(clinicId, email, role, expiresInDays)) }
}
