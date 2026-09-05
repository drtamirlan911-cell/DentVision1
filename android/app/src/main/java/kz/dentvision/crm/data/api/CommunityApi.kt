package kz.dentvision.crm.data.api

import kz.dentvision.crm.data.model.CommunityComment
import kz.dentvision.crm.data.model.CommunityPost
import kz.dentvision.crm.data.model.CommunitySaveResult
import kz.dentvision.crm.data.model.CreateCommunityCommentRequest
import kz.dentvision.crm.data.model.CreateCommunityPostRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * `dentvision-backend/src/modules/community/community.routes.ts`. Лента и
 * комментарии открыты `optionalAuth`, публикация/лайк/сохранение/комментарий
 * — `authenticate`. Личные сообщения (маршруты `dm`) сюда не входят.
 */
interface CommunityApi {
    @GET("api/community/posts")
    suspend fun posts(
        @Query("topic") topic: String? = null,
        @Query("saved") saved: String? = null,
    ): ApiEnvelope<List<CommunityPost>>

    @POST("api/community/posts")
    suspend fun create(@Body body: CreateCommunityPostRequest): ApiEnvelope<CommunityPost>

    @POST("api/community/posts/{id}/like")
    suspend fun like(@Path("id") id: String): ApiEnvelope<CommunityPost>

    @POST("api/community/posts/{id}/save")
    suspend fun save(@Path("id") id: String): ApiEnvelope<CommunitySaveResult>

    @GET("api/community/posts/{id}/comments")
    suspend fun comments(@Path("id") id: String): ApiEnvelope<List<CommunityComment>>

    @POST("api/community/posts/{id}/comments")
    suspend fun addComment(@Path("id") id: String, @Body body: CreateCommunityCommentRequest): ApiEnvelope<CommunityComment>
}
