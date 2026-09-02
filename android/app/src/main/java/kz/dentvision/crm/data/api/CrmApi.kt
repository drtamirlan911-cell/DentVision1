package kz.dentvision.crm.data.api

import kz.dentvision.crm.data.model.Appointment
import kz.dentvision.crm.data.model.AppointmentUpsert
import kz.dentvision.crm.data.model.ClinicWithMembers
import kz.dentvision.crm.data.model.ConflictCheck
import kz.dentvision.crm.data.model.IinLookup
import kz.dentvision.crm.data.model.MedicalHistoryPatch
import kz.dentvision.crm.data.model.Patient
import kz.dentvision.crm.data.model.PatientUpsert
import kz.dentvision.crm.data.model.Visit
import kz.dentvision.crm.data.model.VisitCreate
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
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

    @POST("api/appointments")
    suspend fun upsertAppointment(@Body body: AppointmentUpsert): ApiEnvelope<Appointment>

    @DELETE("api/appointments/{id}")
    suspend fun deleteAppointment(@Path("id") id: String): ApiEnvelope<Unit>

    // ── Визиты (modules/medical/medical.routes.ts) ──

    @GET("api/medical/patients/{patientId}/visits")
    suspend fun visits(@Path("patientId") patientId: String): ApiEnvelope<List<Visit>>

    @POST("api/medical/visits")
    suspend fun createVisit(@Body body: VisitCreate): ApiEnvelope<Visit>

    // ── Персонал (modules/clinics/clinics.routes.ts) ──

    /** Отдельного списка персонала нет — сотрудники вложены в клинику. */
    @GET("api/clinics/{id}")
    suspend fun clinic(@Path("id") id: String): ApiEnvelope<ClinicWithMembers>
}
