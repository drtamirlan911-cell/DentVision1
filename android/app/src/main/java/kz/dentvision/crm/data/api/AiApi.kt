package kz.dentvision.crm.data.api

import kz.dentvision.crm.data.model.AiActionRequest
import kz.dentvision.crm.data.model.AiActionResult
import kz.dentvision.crm.data.model.AiApprovalDecision
import kz.dentvision.crm.data.model.AiApprovalItem
import kz.dentvision.crm.data.model.AiBriefing
import kz.dentvision.crm.data.model.AiConfirmRequest
import kz.dentvision.crm.data.model.AiConfirmResult
import kz.dentvision.crm.data.model.AiInsight
import kz.dentvision.crm.data.model.AiProactiveResponse
import kz.dentvision.crm.data.model.AiQueryRequest
import kz.dentvision.crm.data.model.AiQueryResponse
import kz.dentvision.crm.data.model.AiThread
import kz.dentvision.crm.data.model.AiThreadRef
import kz.dentvision.crm.data.model.AiTimelineResponse
import kz.dentvision.crm.data.model.AiTimelineStats
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * ИИ-слой (`dentvision-backend/src/modules/ai`). Каждый метод — маршрут,
 * который уже существует и уже управляем governance-ядром (права, скоуп,
 * аудит, evidence, подтверждения). Клиент здесь ничего не решает сам —
 * решения принимает `runAiAction` на сервере, клиент только зовёт и
 * показывает.
 */
interface AiApi {

    /** Требует вошедшего сотрудника клиники — гостю сервер отвечает 403. */
    @GET("api/ai/briefing")
    suspend fun briefing(): ApiEnvelope<AiBriefing>

    /** Работает и для гостя, поэтому используется на публичном входе тоже. */
    @GET("api/ai/proactive")
    suspend fun proactive(): ApiEnvelope<AiProactiveResponse>

    @POST("api/ai/query")
    suspend fun query(@Body body: AiQueryRequest): ApiEnvelope<AiQueryResponse>

    @GET("api/ai/threads/active")
    suspend fun activeThread(): ApiEnvelope<AiThread>

    @POST("api/ai/threads/new")
    suspend fun newThread(): ApiEnvelope<AiThreadRef>

    @POST("api/ai/action")
    suspend fun action(@Body body: AiActionRequest): ApiEnvelope<AiActionResult>

    @POST("api/ai/confirm")
    suspend fun confirm(@Body body: AiConfirmRequest): ApiEnvelope<AiConfirmResult>

    @GET("api/ai/insights")
    suspend fun insights(
        @Query("entityType") entityType: String,
        @Query("entityId") entityId: String,
    ): ApiEnvelope<List<AiInsight>>

    @POST("api/ai/insights/{id}/dismiss")
    suspend fun dismissInsight(@Path("id") id: String): ApiEnvelope<Unit>

    // ── Очередь подтверждений (os/approvals.routes.ts) ──

    @GET("api/ai/approvals")
    suspend fun approvals(@Query("status") status: String? = null): ApiEnvelope<List<AiApprovalItem>>

    @POST("api/ai/approvals/{id}/approve")
    suspend fun approveApproval(
        @Path("id") id: String,
        @Body body: AiApprovalDecision = AiApprovalDecision(),
    ): ApiEnvelope<AiApprovalItem>

    @POST("api/ai/approvals/{id}/reject")
    suspend fun rejectApproval(
        @Path("id") id: String,
        @Body body: AiApprovalDecision = AiApprovalDecision(),
    ): ApiEnvelope<AiApprovalItem>

    // ── Центр активности (ai.timeline.routes.ts) ──

    @GET("api/ai/timeline")
    suspend fun timeline(
        @Query("limit") limit: Int = 50,
        @Query("offset") offset: Int = 0,
        @Query("status") status: String? = null,
    ): ApiEnvelope<AiTimelineResponse>

    @GET("api/ai/timeline/stats")
    suspend fun timelineStats(): ApiEnvelope<AiTimelineStats>
}
