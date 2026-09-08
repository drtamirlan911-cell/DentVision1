package kz.dentvision.crm.data

import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.api.apiCall
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

class ProfileRepository(private val api: ApiClient = ServiceLocator.api) {
    suspend fun get(): ProfileResponse = apiCall { api.profile.get() }
    suspend fun update(body: ProfileUpdate): UserProfile = apiCall { api.profile.update(body) }
    suspend fun updateHomePreferences(services: List<String>, autoCollapse: Boolean = true): UserProfile =
        update(ProfileUpdate(homeQuickServices = services.take(8), homeAiAutoCollapse = autoCollapse))
    suspend fun addSkill(name: String, level: String?): Skill = apiCall { api.profile.addSkill(SkillCreate(name, level)) }
    suspend fun deleteSkill(id: String) { apiCall { api.profile.deleteSkill(id) } }
    suspend fun addCertificate(title: String, issuer: String?, year: Int?, fileUrl: String?): Certificate = apiCall { api.profile.addCertificate(CertificateCreate(title, issuer, year, fileUrl)) }
    suspend fun deleteCertificate(id: String) { apiCall { api.profile.deleteCertificate(id) } }
    suspend fun addAchievement(title: String, description: String?, date: String?): Achievement = apiCall { api.profile.addAchievement(AchievementCreate(title, description, date)) }
    suspend fun deleteAchievement(id: String) { apiCall { api.profile.deleteAchievement(id) } }
    suspend fun addPortfolioItem(title: String, description: String?, imageUrl: String?, link: String?): PortfolioItem = apiCall { api.profile.addPortfolioItem(PortfolioCreate(title, description, imageUrl, link)) }
    suspend fun deletePortfolioItem(id: String) { apiCall { api.profile.deletePortfolioItem(id) } }
    suspend fun addCase(title: String, description: String?, beforeImage: String?, afterImage: String?, tags: List<String>): CaseItem = apiCall { api.profile.addCase(CaseCreate(title, description, beforeImage, afterImage, tags)) }
    suspend fun deleteCase(id: String) { apiCall { api.profile.deleteCase(id) } }
}
