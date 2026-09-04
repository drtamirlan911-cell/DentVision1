package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * `dentvision-backend/src/modules/community/community.routes.ts` —
 * стандартный конверт `{ok, data}`, в отличие от `Jobs.kt`. Личные
 * сообщения (маршруты `dm`) сюда не входят — отдельная, ещё не
 * перенесённая подсистема (`MessagesPanel` на вебе).
 */
@Serializable
data class CommunityPost(
    val id: String,
    val authorId: String? = null,
    val authorName: String = "",
    val authorRole: String = "",
    val authorPhotoUrl: String? = null,
    val content: String = "",
    val tags: List<String> = emptyList(),
    val kind: String = "thread",
    val likesCount: Int = 0,
    val commentsCount: Int = 0,
    val createdAt: String? = null,
    val liked: Boolean = false,
    val saved: Boolean = false,
)

@Serializable
data class CommunityComment(
    val id: String,
    val postId: String = "",
    val authorId: String? = null,
    val authorName: String = "",
    val authorPhotoUrl: String? = null,
    val content: String = "",
    val createdAt: String? = null,
)

/** Тело `POST /api/community/posts`. */
@Serializable
data class CreateCommunityPostRequest(
    val content: String,
    val tags: List<String> = emptyList(),
    val kind: String = "thread",
)

/** Тело `POST /api/community/posts/:id/comments`. */
@Serializable
data class CreateCommunityCommentRequest(val content: String)

/** `data` ответа `POST /api/community/posts/:id/save`. */
@Serializable
data class CommunitySaveResult(val saved: Boolean)
