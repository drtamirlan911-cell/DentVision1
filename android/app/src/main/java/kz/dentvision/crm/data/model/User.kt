package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/** `User` из `src/types.ts`. Необязательные поля остаются необязательными. */
@Serializable
data class User(
    val id: String,
    val clinicId: String? = null,
    val login: String = "",
    val role: String = "",
    val name: String = "",
    val phone: String? = null,
    val email: String? = null,
    val spec: String? = null,
    val photoUrl: String? = null,
    val avatar: String? = null,
    val platformRole: String? = null,
    val organizationType: String? = null,
    val organizationId: String? = null,
    val personType: String? = null,
    val memberships: List<Membership> = emptyList(),
    val activeMembership: Membership? = null,
    val createdAt: String? = null,
)

/** `Clinic` из `src/types.ts`. */
@Serializable
data class Clinic(
    val id: String,
    val name: String = "",
    val city: String? = null,
    val address: String? = null,
    val phone: String? = null,
    val logo: String? = null,
    val plan: String? = null,
    val active: Boolean? = null,
    val country: String? = null,
    val currency: String? = null,
    val locale: String? = null,
    val createdAt: String? = null,
)
