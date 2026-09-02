package kz.dentvision.crm.data

import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.api.apiCall
import kz.dentvision.crm.data.model.Appointment
import kz.dentvision.crm.data.model.AppointmentUpsert
import kz.dentvision.crm.data.model.ConflictCheck
import kz.dentvision.crm.data.model.ClinicBilling
import kz.dentvision.crm.data.model.ClinicSettings
import kz.dentvision.crm.data.model.Doctor
import kz.dentvision.crm.data.model.Document
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
import kz.dentvision.crm.data.model.TreatmentPlan
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
    ): ConflictCheck = apiCall {
        api.crm.appointmentConflicts(
            date = date,
            time = time,
            doctorId = doctorId,
            duration = duration,
            patientId = patientId,
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

    // ── Касса ──

    suspend fun invoices(): List<Invoice> = apiCall { api.crm.invoices() }.data

    /**
     * Счёт и, если его сразу оплатили, отметка об оплате.
     *
     * Двумя запросами, потому что так устроен бэкенд: создание всегда рождает
     * счёт в статусе `pending`, а оплата — отдельный маршрут. Веб делает ровно
     * то же самое (`upsertReceipt`, `src/utils/api.ts:739`).
     */
    suspend fun createInvoice(body: InvoiceCreate, markPaid: Boolean): Invoice {
        val created = apiCall { api.crm.createInvoice(body) }
        if (!markPaid) return created
        return runCatching { apiCall { api.crm.payInvoice(created.id) } }.getOrDefault(created)
    }

    // ── Финансы ──

    suspend fun financeReport(from: String?, to: String?): FinanceReport =
        apiCall { api.crm.financeReport(from = from, to = to) }

    // ── Прайс ──

    suspend fun priceList(): List<PriceListItem> = apiCall { api.crm.priceList() }

    suspend fun savePriceItem(body: PriceListUpsert): PriceListItem =
        apiCall { api.crm.upsertPriceItem(body) }

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
}
