package kz.dentvision.crm.data

import kz.dentvision.crm.data.api.ApiClient
import kz.dentvision.crm.data.api.apiCall
import kz.dentvision.crm.data.model.CommunityComment
import kz.dentvision.crm.data.model.CommunityPost
import kz.dentvision.crm.data.model.CreateCommunityCommentRequest
import kz.dentvision.crm.data.model.CreateCommunityPostRequest

/** `getCommunityPosts`/`createCommunityPost`/… в `src/utils/api.ts` — обычный конверт, поэтому через общий `apiCall`. */
class CommunityRepository(private val api: ApiClient = ServiceLocator.api) {
    suspend fun posts(topic: String, savedOnly: Boolean): List<CommunityPost> =
        apiCall { api.community.posts(topic.takeIf { it.isNotBlank() && it != "Все" }, if (savedOnly) "1" else null) }

    suspend fun create(content: String, tags: List<String>): CommunityPost =
        apiCall { api.community.create(CreateCommunityPostRequest(content = content, tags = tags)) }

    suspend fun like(postId: String): CommunityPost = apiCall { api.community.like(postId) }

    suspend fun save(postId: String): Boolean = apiCall { api.community.save(postId) }.saved

    suspend fun comments(postId: String): List<CommunityComment> = apiCall { api.community.comments(postId) }

    suspend fun addComment(postId: String, content: String): CommunityComment =
        apiCall { api.community.addComment(postId, CreateCommunityCommentRequest(content)) }
}
