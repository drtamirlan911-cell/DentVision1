package kz.dentvision.crm.data

import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.api.apiCall
import kz.dentvision.crm.data.model.CreateLecturerCourseRequest
import kz.dentvision.crm.data.model.Lecturer
import kz.dentvision.crm.data.model.LecturerAnalytics
import kz.dentvision.crm.data.model.LecturerCourse
import kz.dentvision.crm.data.model.RegisterLecturerRequest
import kz.dentvision.crm.data.model.RequestLecturerPayoutRequest
import kz.dentvision.crm.data.model.UpdateLecturerCourseRequest
import kz.dentvision.crm.data.model.UpdateLecturerProfileRequest

/** Кабинет лектора — см. `data/api/LecturerApi.kt`. */
class LecturerRepository(private val api: ApiClient = ServiceLocator.api) {

    suspend fun register(bio: String?): Lecturer = apiCall { api.lecturer.register(RegisterLecturerRequest(bio)) }

    suspend fun me(): Lecturer = apiCall { api.lecturer.me() }

    suspend fun updateProfile(bio: String?): Lecturer = apiCall { api.lecturer.updateMe(UpdateLecturerProfileRequest(bio)) }

    suspend fun courses(): List<LecturerCourse> = apiCall { api.lecturer.courses() }

    suspend fun createCourse(body: CreateLecturerCourseRequest): LecturerCourse = apiCall { api.lecturer.createCourse(body) }

    suspend fun updateCourse(id: String, body: UpdateLecturerCourseRequest): LecturerCourse = apiCall { api.lecturer.updateCourse(id, body) }

    suspend fun deleteCourse(id: String) {
        apiCall { api.lecturer.deleteCourse(id) }
    }

    suspend fun analytics(): LecturerAnalytics = apiCall { api.lecturer.analytics() }

    suspend fun requestPayout(amountMinor: String) {
        apiCall { api.lecturer.requestPayout(RequestLecturerPayoutRequest(amountMinor)) }
    }
}
