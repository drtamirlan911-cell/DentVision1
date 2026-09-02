package kz.dentvision.crm.data

import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.api.apiCall
import kz.dentvision.crm.data.model.Appointment
import kz.dentvision.crm.data.model.AppointmentUpsert
import kz.dentvision.crm.data.model.ConflictCheck
import kz.dentvision.crm.data.model.Doctor
import kz.dentvision.crm.data.model.IinLookup
import kz.dentvision.crm.data.model.MedicalHistory
import kz.dentvision.crm.data.model.MedicalHistoryPatch
import kz.dentvision.crm.data.model.Patient
import kz.dentvision.crm.data.model.PatientUpsert
import kz.dentvision.crm.data.model.Visit
import kz.dentvision.crm.data.model.VisitCreate
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

    // ── Персонал ──

    suspend fun doctors(clinicId: String): List<Doctor> =
        apiCall { api.crm.clinic(clinicId) }.doctors()
}
