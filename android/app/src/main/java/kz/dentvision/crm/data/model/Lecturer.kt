package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * Кабинет лектора (`GET /api/lecturer/me`) — в отличие от кабинета продавца,
 * у веба нет готовой страницы для сверки (`lecturerWs` в `api.ts` существует,
 * но ни одна страница его не вызывает): вкладки и форма ниже собраны с нуля
 * по самому бэкенду (`school-workspace/lecturer.routes.ts`), а не перенесены.
 */
@Serializable
data class Lecturer(
    val id: String,
    val level: String = "new",
    val bio: String? = null,
    val academyId: String? = null,
)

@Serializable
data class LecturerCourse(
    val id: String,
    val title: String = "",
    val description: String? = null,
    val category: String? = null,
    val price: Double? = null,
    val format: String = "course",
    val formatLabel: String? = null,
    val imageUrl: String? = null,
    val seats: Int? = null,
)

@Serializable
data class LecturerAnalytics(
    val balanceMinor: String = "0",
    val earnedMinor: String = "0",
    val salesCount: Int = 0,
    val courseCount: Int = 0,
    val studentCount: Int = 0,
    val currency: String = "KZT",
)

// ─────────────────────────── Запросы ───────────────────────────

/**
 * Без `academyId` намеренно: с ним `syncPersonFromLecturer` создаёт Person,
 * привязанную к Organization академии, и тогда `switch-context` уходит по
 * первой (unified) ветке, которая не кладёт `lecturerId` в токен вовсе —
 * маршруты кабинета лектора стали бы отвечать 403 всем, кто зарегистрировался с
 * академией. Без неё срабатывает легаси-ветка, и всё работает. Привязку к
 * академии, если она понадобится, стоит заводить отдельным, проверенным
 * потоком — не отсюда.
 */
@Serializable
data class RegisterLecturerRequest(val bio: String? = null)

@Serializable
data class UpdateLecturerProfileRequest(val bio: String? = null)

@Serializable
data class CreateLecturerCourseRequest(
    val title: String,
    val format: String,
    val description: String? = null,
    val category: String? = null,
    val price: Double? = null,
    val seats: Int? = null,
    val imageUrl: String? = null,
)

@Serializable
data class UpdateLecturerCourseRequest(
    val title: String? = null,
    val description: String? = null,
    val category: String? = null,
    val price: Double? = null,
    val seats: Int? = null,
    val imageUrl: String? = null,
)

@Serializable
data class RequestLecturerPayoutRequest(val amountMinor: String)
