package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * Профиль специалиста — `profile.routes.ts::shapeUser`. Базовые поля лежат в
 * `User`, остальные — в `User.profileMeta` (JSON), сервер сливает их в один
 * плоский объект перед отдачей.
 */
@Serializable
data class UserProfile(
    val id: String = "",
    val email: String = "",
    val firstName: String = "",
    val lastName: String = "",
    val phone: String? = null,
    val spec: String? = null,
    val avatar: String? = null,
    val role: String = "",
    val photoUrl: String = "",
    val username: String = "",
    val headline: String = "",
    val bio: String = "",
    val city: String = "",
    val country: String = "",
    val experienceYears: Int = 0,
    val visibility: String = "public",
    val name: String = "",
)

@Serializable
data class Skill(val id: String, val name: String = "", val level: String? = null)

@Serializable
data class Certificate(
    val id: String,
    val title: String = "",
    val issuer: String? = null,
    val year: Int? = null,
    val fileUrl: String? = null,
)

@Serializable
data class Achievement(
    val id: String,
    val title: String = "",
    val description: String? = null,
    val date: String? = null,
)

@Serializable
data class PortfolioItem(
    val id: String,
    val title: String = "",
    val description: String? = null,
    val imageUrl: String? = null,
    val link: String? = null,
)

@Serializable
data class CaseItem(
    val id: String,
    val title: String = "",
    val description: String? = null,
    val beforeImage: String? = null,
    val afterImage: String? = null,
    val tags: List<String> = emptyList(),
)

/** Только для чтения — пишутся другими действиями (заказы, отклики), своей ручки на запись нет. */
@Serializable
data class Review(
    val id: String,
    val authorName: String? = null,
    val rating: Int? = null,
    val comment: String? = null,
    val createdAt: String? = null,
)

@Serializable
data class ProfileActivity(val id: String, val title: String = "", val createdAt: String = "")

@Serializable
data class ProfileResponse(
    val user: UserProfile = UserProfile(),
    val skills: List<Skill> = emptyList(),
    val certificates: List<Certificate> = emptyList(),
    val achievements: List<Achievement> = emptyList(),
    val portfolio: List<PortfolioItem> = emptyList(),
    val cases: List<CaseItem> = emptyList(),
    val reviews: List<Review> = emptyList(),
    val activities: List<ProfileActivity> = emptyList(),
)

/** Тело `PUT /api/profile` — только присланные поля перезаписываются (`profile.routes.ts:109-119`). */
@Serializable
data class ProfileUpdate(
    val firstName: String? = null,
    val lastName: String? = null,
    val username: String? = null,
    val headline: String? = null,
    val bio: String? = null,
    val city: String? = null,
    val country: String? = null,
    val spec: String? = null,
    val experienceYears: Int? = null,
    val phone: String? = null,
    val email: String? = null,
    val photoUrl: String? = null,
    val visibility: String? = null,
)

@Serializable
data class SkillCreate(val name: String, val level: String? = null)

@Serializable
data class CertificateCreate(val title: String, val issuer: String? = null, val year: Int? = null, val fileUrl: String? = null)

@Serializable
data class AchievementCreate(val title: String, val description: String? = null, val date: String? = null)

@Serializable
data class PortfolioCreate(val title: String, val description: String? = null, val imageUrl: String? = null, val link: String? = null)

@Serializable
data class CaseCreate(
    val title: String,
    val description: String? = null,
    val beforeImage: String? = null,
    val afterImage: String? = null,
    val tags: List<String> = emptyList(),
)
