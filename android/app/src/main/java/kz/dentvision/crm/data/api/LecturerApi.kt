package kz.dentvision.crm.data.api

import kz.dentvision.crm.data.model.CreateLecturerCourseRequest
import kz.dentvision.crm.data.model.Lecturer
import kz.dentvision.crm.data.model.LecturerAnalytics
import kz.dentvision.crm.data.model.LecturerCourse
import kz.dentvision.crm.data.model.RegisterLecturerRequest
import kz.dentvision.crm.data.model.RequestLecturerPayoutRequest
import kz.dentvision.crm.data.model.UpdateLecturerCourseRequest
import kz.dentvision.crm.data.model.UpdateLecturerProfileRequest
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Кабинет лектора — `dentvision-backend/src/modules/school-workspace/lecturer.routes.ts`.
 * `register` не требует контекста лектора (он и создаёт этот контекст), все
 * остальные — требуют `req.user.lecturerId` (см. докстринг `User.lecturerId`).
 */
interface LecturerApi {

    @POST("api/lecturer/register")
    suspend fun register(@Body body: RegisterLecturerRequest): ApiEnvelope<Lecturer>

    @GET("api/lecturer/me")
    suspend fun me(): ApiEnvelope<Lecturer>

    @PATCH("api/lecturer/me")
    suspend fun updateMe(@Body body: UpdateLecturerProfileRequest): ApiEnvelope<Lecturer>

    @GET("api/lecturer/courses")
    suspend fun courses(): ApiEnvelope<List<LecturerCourse>>

    @POST("api/lecturer/courses")
    suspend fun createCourse(@Body body: CreateLecturerCourseRequest): ApiEnvelope<LecturerCourse>

    @PATCH("api/lecturer/courses/{id}")
    suspend fun updateCourse(@Path("id") id: String, @Body body: UpdateLecturerCourseRequest): ApiEnvelope<LecturerCourse>

    @DELETE("api/lecturer/courses/{id}")
    suspend fun deleteCourse(@Path("id") id: String): ApiEnvelope<Unit>

    @GET("api/lecturer/analytics")
    suspend fun analytics(): ApiEnvelope<LecturerAnalytics>

    @POST("api/lecturer/payouts")
    suspend fun requestPayout(@Body body: RequestLecturerPayoutRequest): ApiEnvelope<Unit>
}
