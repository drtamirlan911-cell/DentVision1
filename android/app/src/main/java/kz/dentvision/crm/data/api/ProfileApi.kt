package kz.dentvision.crm.data.api

import kz.dentvision.crm.data.model.Achievement
import kz.dentvision.crm.data.model.AchievementCreate
import kz.dentvision.crm.data.model.CaseCreate
import kz.dentvision.crm.data.model.CaseItem
import kz.dentvision.crm.data.model.Certificate
import kz.dentvision.crm.data.model.CertificateCreate
import kz.dentvision.crm.data.model.PortfolioCreate
import kz.dentvision.crm.data.model.PortfolioItem
import kz.dentvision.crm.data.model.ProfileResponse
import kz.dentvision.crm.data.model.ProfileUpdate
import kz.dentvision.crm.data.model.Skill
import kz.dentvision.crm.data.model.SkillCreate
import kz.dentvision.crm.data.model.UserProfile
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.POST

/**
 * Профиль специалиста — `modules/profile/profile.routes.ts`. По пользователю,
 * не по клинике: то же основание, что у [NotificationsApi].
 */
interface ProfileApi {

    @GET("api/profile")
    suspend fun get(): ApiEnvelope<ProfileResponse>

    @PUT("api/profile")
    suspend fun update(@Body body: ProfileUpdate): ApiEnvelope<UserProfile>

    @POST("api/profile/skills")
    suspend fun addSkill(@Body body: SkillCreate): ApiEnvelope<Skill>

    @DELETE("api/profile/skills/{id}")
    suspend fun deleteSkill(@Path("id") id: String): ApiEnvelope<Unit>

    @POST("api/profile/certificates")
    suspend fun addCertificate(@Body body: CertificateCreate): ApiEnvelope<Certificate>

    @DELETE("api/profile/certificates/{id}")
    suspend fun deleteCertificate(@Path("id") id: String): ApiEnvelope<Unit>

    @POST("api/profile/achievements")
    suspend fun addAchievement(@Body body: AchievementCreate): ApiEnvelope<Achievement>

    @DELETE("api/profile/achievements/{id}")
    suspend fun deleteAchievement(@Path("id") id: String): ApiEnvelope<Unit>

    @POST("api/profile/portfolio")
    suspend fun addPortfolioItem(@Body body: PortfolioCreate): ApiEnvelope<PortfolioItem>

    @DELETE("api/profile/portfolio/{id}")
    suspend fun deletePortfolioItem(@Path("id") id: String): ApiEnvelope<Unit>

    @POST("api/profile/cases")
    suspend fun addCase(@Body body: CaseCreate): ApiEnvelope<CaseItem>

    @DELETE("api/profile/cases/{id}")
    suspend fun deleteCase(@Path("id") id: String): ApiEnvelope<Unit>
}
