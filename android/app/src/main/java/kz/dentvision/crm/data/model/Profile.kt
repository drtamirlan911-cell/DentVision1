package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * Профиль специалиста — `profile.routes.ts::shapeUser`. Базовые поля лежат в
 * `User`, остальные — в `User.profileMeta`, сервер сливает их в один плоский объект.
 */
@Serializable
data class UserProfile(
    val id: String = "", val email: String = "", val firstName: String = "", val lastName: String = "",
    val phone: String? = null, val spec: String? = null, val avatar: String? = null, val role: String = "",
    val photoUrl: String = "", val username: String = "", val headline: String = "", val bio: String = "",
    val city: String = "", val country: String = "", val experienceYears: Int = 0, val visibility: String = "public",
    val name: String = "", val homeQuickServices: List<String> = emptyList(), val homeAiAutoCollapse: Boolean = true,
)

@Serializable
data class Skill(val id: String, val name: String = "", val level: String? = null)

@Serializable
data class Certificate(val id: String, val title: String = "", val issuer: String? = null, val year: Int? = null, val fileUrl: String? = null)

@Serializable
data class Achievement(val id: String, val title: String = "", val description: String? = null, val date: String? = null)

@Serializable
data class PortfolioItem(val id: String, val title: String = "", val description: String? = null, val imageUrl: String? = null, val link: String? = null)

@Serializable
data class CaseItem(val id: String, val title: String = "", val description: String? = null, val beforeImage: String? = null, val afterImage: String? = null, val tags: List<String> = emptyList())

@Serializable
data class Review(val id: String, val authorName: String? = null, val rating: Int? = null, val comment: String? = null, val createdAt: String? = null)
