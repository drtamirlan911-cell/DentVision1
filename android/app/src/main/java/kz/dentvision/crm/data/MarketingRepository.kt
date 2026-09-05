package kz.dentvision.crm.data

import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.api.apiCall
import kz.dentvision.crm.data.api.apiCallUnit
import kz.dentvision.crm.data.model.CarouselRequest
import kz.dentvision.crm.data.model.ContentIdeaPatch
import kz.dentvision.crm.data.model.ContentPlanRequest
import kz.dentvision.crm.data.model.ImageQuota
import kz.dentvision.crm.data.model.MarketingContext
import kz.dentvision.crm.data.model.PlanSummary
import kz.dentvision.crm.data.model.StoredIdea
import kz.dentvision.crm.data.model.StoredPlan

/** Контент и продвижение клиники — вне `CrmRepository`: своя область прав (`patients.read/write`), свой домен. */
class MarketingRepository(private val api: ApiClient = ServiceLocator.api) {

    suspend fun context(): MarketingContext = apiCall { api.marketing.context() }

    suspend fun generatePlan(count: Int, tone: String?): StoredPlan =
        apiCall { api.marketing.generatePlan(ContentPlanRequest(count, tone)) }

    suspend fun plans(limit: Int = 20): List<PlanSummary> = apiCall { api.marketing.plans(limit) }

    suspend fun plan(id: String): StoredPlan = apiCall { api.marketing.plan(id) }

    suspend fun deletePlan(id: String) {
        // `data: null` при успехе (`marketing.routes.ts`) — apiCall() принял бы
        // это за пустой ответ и бросил ошибку на успешном удалении.
        apiCallUnit { api.marketing.deletePlan(id) }
    }

    suspend fun updateIdea(
        id: String,
        title: String,
        hook: String,
        caption: String,
        callToAction: String,
        hashtags: List<String>,
    ): StoredIdea = apiCall {
        api.marketing.updateIdea(id, ContentIdeaPatch(title, hook, caption, callToAction, hashtags))
    }

    suspend fun imageQuota(): ImageQuota = apiCall { api.marketing.imageQuota() }

    suspend fun generateCover(ideaId: String): StoredIdea = apiCall { api.marketing.generateCover(ideaId) }

    suspend fun generateCarousel(ideaId: String, slides: Int): StoredIdea =
        apiCall { api.marketing.generateCarousel(ideaId, CarouselRequest(slides)) }
}
