package kz.dentvision.crm.data.api

import kz.dentvision.crm.data.model.Appointment
import kz.dentvision.crm.data.model.AppointmentUpsert
import kz.dentvision.crm.data.model.ClinicBilling
import kz.dentvision.crm.data.model.ClinicSettings
import kz.dentvision.crm.data.model.ClinicSettingsResponse
import kz.dentvision.crm.data.model.ClinicWithMembers
import kz.dentvision.crm.data.model.ConflictCheck
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
import kz.dentvision.crm.data.model.MedicalHistoryPatch
import kz.dentvision.crm.data.model.MarkReminderSent
import kz.dentvision.crm.data.model.Patient
import kz.dentvision.crm.data.model.PatientUpsert
import kz.dentvision.crm.data.model.PriceListItem
import kz.dentvision.crm.data.model.PriceListUpsert
import kz.dentvision.crm.data.model.SentReminder
import kz.dentvision.crm.data.model.Promotion
import kz.dentvision.crm.data.model.TreatmentPlan
import kz.dentvision.crm.data.model.Visit
import kz.dentvision.crm.data.model.VisitCreate
import kz.dentvision.crm.data.model.Workflow
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Маршруты кабинета клиники. Каждый метод соответствует существующему
 * обработчику бэкенда — новые эндпоинты не выдумываются, а список растёт ровно
 * по мере появления экранов, которые их зовут.
 */
interface CrmApi {

    // ── Пациенты (modules/patients/patients.routes.ts) ──

    /** `GET /api/patients` → `{ ok, data: { data: [...], pagination } }`. */
    @GET("api/patients")
    suspend fun patients(
        @Query("limit") limit: Int = 200,
        @Query("page") page: Int? = null,
        @Query("search") search: String? = null,
    ): ApiEnvelope<Paged<Patient>>

    @GET("api/patients/{id}")
    suspend fun patient(@Path("id") id: String): ApiEnvelope<Patient>

    /**
     * Справочник по ИИН. Ищется только полный двенадцатизначный номер: `iin`
     * зашифрован со случайным вектором, равенство живёт в слепом индексе, и
     * частичный номер не ищется by design.
     */
    @GET("api/patients/lookup")
    suspend fun lookupByIin(@Query("iin") iin: String): ApiEnvelope<IinLookup>

    @POST("api/patients")
    suspend fun upsertPatient(@Body body: PatientUpsert): ApiEnvelope<Patient>

    /** Медкарта пишется сюда: PATCH сливает присланное с уже лежащим. */
    @PATCH("api/patients/{id}")
    suspend fun patchMedicalHistory(
        @Path("id") id: String,
        @Body body: MedicalHistoryPatch,
    ): ApiEnvelope<Patient>

    @DELETE("api/patients/{id}")
    suspend fun deletePatient(@Path("id") id: String): ApiEnvelope<Unit>

    // ── Расписание (modules/appointments/appointments.routes.ts) ──

    @GET("api/appointments")
    suspend fun appointments(
        @Query("limit") limit: Int = 200,
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
        @Query("doctorId") doctorId: String? = null,
        @Query("status") status: String? = null,
    ): ApiEnvelope<Paged<Appointment>>

    @GET("api/appointments/conflicts")
    suspend fun appointmentConflicts(
        @Query("date") date: String,
        @Query("time") time: String,
        @Query("doctorId") doctorId: String? = null,
        @Query("duration") duration: Int? = null,
        @Query("patientId") patientId: String? = null,
        @Query("excludeId") excludeId: String? = null,
    ): ApiEnvelope<ConflictCheck>

    /** Журнал отправленных напоминаний: `reminderKey` — ключ, а не текст. */
    @GET("api/crm/reminders/sent")
    suspend fun sentReminders(): ApiEnvelope<List<SentReminder>>

    @POST("api/crm/reminders/sent")
    suspend fun markReminderSent(@Body body: MarkReminderSent): ApiEnvelope<SentReminder>

    @POST("api/appointments")
    suspend fun upsertAppointment(@Body body: AppointmentUpsert): ApiEnvelope<Appointment>

    @DELETE("api/appointments/{id}")
    suspend fun deleteAppointment(@Path("id") id: String): ApiEnvelope<Unit>

    // ── Визиты (modules/medical/medical.routes.ts) ──

    @GET("api/medical/patients/{patientId}/visits")
    suspend fun visits(@Path("patientId") patientId: String): ApiEnvelope<List<Visit>>

    @POST("api/medical/visits")
    suspend fun createVisit(@Body body: VisitCreate): ApiEnvelope<Visit>

    // ── Касса и финансы (modules/billing/billing.routes.ts) ──

    @GET("api/billing/invoices")
    suspend fun invoices(
        @Query("limit") limit: Int = 200,
        @Query("status") status: String? = null,
    ): ApiEnvelope<Paged<Invoice>>

    @POST("api/billing/invoices")
    suspend fun createInvoice(@Body body: InvoiceCreate): ApiEnvelope<Invoice>

    /** Отметить счёт оплаченным. Тело пустое — состояние меняет сам маршрут. */
    @POST("api/billing/invoices/{id}/pay")
    suspend fun payInvoice(@Path("id") id: String): ApiEnvelope<Invoice>

    @GET("api/billing/reports")
    suspend fun financeReport(
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
    ): ApiEnvelope<FinanceReport>

    // ── Прайс (modules/crm/ops.routes.ts) ──

    @GET("api/crm/price-list")
    suspend fun priceList(): ApiEnvelope<List<PriceListItem>>

    @POST("api/crm/price-list")
    suspend fun upsertPriceItem(@Body body: PriceListUpsert): ApiEnvelope<PriceListItem>

    // ── Склад (modules/inventory/inventory.routes.ts) ──

    @GET("api/inventory")
    suspend fun inventory(@Query("q") query: String? = null): ApiEnvelope<List<InventoryItem>>

    @POST("api/inventory")
    suspend fun createInventoryItem(@Body body: InventoryCreate): ApiEnvelope<InventoryItem>

    /** Движение по остатку, а не запись нового значения. */
    @POST("api/inventory/{id}/adjust")
    suspend fun adjustInventory(
        @Path("id") id: String,
        @Body body: InventoryAdjust,
    ): ApiEnvelope<InventoryItem>

    // ── Лаборатория (modules/lab/lab.routes.ts) ──

    @GET("api/lab-orders")
    suspend fun labOrders(): ApiEnvelope<List<LabOrder>>

    @POST("api/lab-orders")
    suspend fun upsertLabOrder(@Body body: LabOrderCreate): ApiEnvelope<LabOrder>

    @PATCH("api/lab-orders/{id}/status")
    suspend fun updateLabStatus(
        @Path("id") id: String,
        @Body body: LabStatusUpdate,
    ): ApiEnvelope<LabOrder>

    // ── Справочники и документы ──

    /** МКБ-10. Пустой запрос отдаёт первые 300 кодов, с запросом — до 50. */
    @GET("api/medical/icd10")
    suspend fun icd10(@Query("q") query: String? = null): ApiEnvelope<List<Icd10Code>>

    @GET("api/files")
    suspend fun documents(@Query("patientId") patientId: String? = null): ApiEnvelope<List<Document>>

    /** Планы лечения: клиника в пути, как этого требует маршрут. */
    @GET("api/crm/{clinicId}/treatment-plans")
    suspend fun treatmentPlans(
        @Path("clinicId") clinicId: String,
        @Query("patientId") patientId: String? = null,
        @Query("status") status: String? = null,
    ): ApiEnvelope<List<TreatmentPlan>>

    @GET("api/crm/promotions")
    suspend fun promotions(): ApiEnvelope<List<Promotion>>

    // ── Персонал (modules/clinics/clinics.routes.ts) ──

    /** Отдельного списка персонала нет — сотрудники вложены в клинику. */
    @GET("api/clinics/{id}")
    suspend fun clinic(@Path("id") id: String): ApiEnvelope<ClinicWithMembers>

    @GET("api/clinics/{id}/settings")
    suspend fun clinicSettings(@Path("id") id: String): ApiEnvelope<ClinicSettingsResponse>

    /** PUT сливает присланное с лежащим, поэтому частичная отправка безопасна. */
    @PUT("api/clinics/{id}/settings")
    suspend fun saveClinicSettings(
        @Path("id") id: String,
        @Body body: ClinicSettings,
    ): ApiEnvelope<ClinicSettingsResponse>

    @GET("api/clinic-billing/me")
    suspend fun clinicBilling(): ApiEnvelope<ClinicBilling>

    @GET("api/workflows")
    suspend fun workflows(): ApiEnvelope<List<Workflow>>
}
