package kz.dentvision.crm.data.api

import kz.dentvision.crm.data.model.CarouselRequest
import kz.dentvision.crm.data.model.ContentIdeaPatch
import kz.dentvision.crm.data.model.ContentPlanRequest
import kz.dentvision.crm.data.model.ImageQuota
import kz.dentvision.crm.data.model.MarketingContext
import kz.dentvision.crm.data.model.PlanSummary
import kz.dentvision.crm.data.model.StoredIdea
import kz.dentvision.crm.data.model.StoredPlan
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/** Контент и продвижение — `modules/marketing/marketing.routes.ts`. */
interface MarketingApi {

    @GET("api/marketing/context")
    suspend fun context(): ApiEnvelope<MarketingContext>

    /** Дёргает модель — может занять заметно больше времени, чем обычный запрос. */
    @POST("api/marketing/content-plan")
    suspend fun generatePlan(@Body body: ContentPlanRequest): ApiEnvelope<StoredPlan>

    @GET("api/marketing/content-plans")
    suspend fun plans(@Query("limit") limit: Int = 20): ApiEnvelope<List<PlanSummary>>

    @GET("api/marketing/content-plans/{id}")
    suspend fun plan(@Path("id") id: String): ApiEnvelope<StoredPlan>

    @DELETE("api/marketing/content-plans/{id}")
    suspend fun deletePlan(@Path("id") id: String): ApiEnvelope<Unit>

    @PATCH("api/marketing/content-ideas/{id}")
    suspend fun updateIdea(@Path("id") id: String, @Body body: ContentIdeaPatch): ApiEnvelope<StoredIdea>

    @GET("api/marketing/image-quota")
    suspend fun imageQuota(): ApiEnvelope<ImageQuota>

    @POST("api/marketing/content-ideas/{id}/cover")
    suspend fun generateCover(@Path("id") id: String): ApiEnvelope<StoredIdea>

    @POST("api/marketing/content-ideas/{id}/carousel")
    suspend fun generateCarousel(@Path("id") id: String, @Body body: CarouselRequest): ApiEnvelope<StoredIdea>
}
