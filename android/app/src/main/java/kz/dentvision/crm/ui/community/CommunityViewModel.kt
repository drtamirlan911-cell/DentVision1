package kz.dentvision.crm.ui.community

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.CommunityRepository
import kz.dentvision.crm.data.model.CommunityComment
import kz.dentvision.crm.data.model.CommunityPost
import kz.dentvision.crm.ui.common.UiState

enum class CommunityTab { FEED, SAVED }

val COMMUNITY_TOPICS = listOf("Все", "Имплантация", "Терапия", "Ортодонтия", "Хирургия", "Лаборатория", "Обучение")

data class CommunityUiState(
    val tab: CommunityTab = CommunityTab.FEED,
    val topic: String = "Все",
    val draft: String = "",
    val publishing: Boolean = false,
    val posts: UiState<List<CommunityPost>> = UiState.Loading,
    val error: String? = null,
)

/** Перенос `Community.tsx`, урезанный до ленты/лайков/сохранений/комментариев — личные сообщения (`MessagesPanel`) не входят, это отдельная подсистема. */
class CommunityViewModel(
    private val repository: CommunityRepository = CommunityRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(CommunityUiState())
    val state: StateFlow<CommunityUiState> = _state

    private val _comments = MutableStateFlow<UiState<List<CommunityComment>>>(UiState.Loading)
    val comments: StateFlow<UiState<List<CommunityComment>>> = _comments

    private var commentsPostId: String? = null
    private var started = false

    fun start() {
        if (started) return
        started = true
        load()
    }

    fun setTab(tab: CommunityTab) {
        if (_state.value.tab == tab) return
        _state.value = _state.value.copy(tab = tab)
        load()
    }

    fun setTopic(topic: String) {
        if (_state.value.topic == topic) return
        _state.value = _state.value.copy(topic = topic)
        load()
    }

    fun retry() = load()

    fun onDraftChange(value: String) {
        _state.value = _state.value.copy(draft = value)
    }

    fun publish() {
        val content = _state.value.draft.trim()
        if (content.isBlank()) return
        _state.value = _state.value.copy(publishing = true, error = null)
        val tags = if (_state.value.topic != "Все") listOf(_state.value.topic) else listOf("Тред")
        viewModelScope.launch {
            runCatching { repository.create(content, tags) }
                .onSuccess { post ->
                    val current = (_state.value.posts as? UiState.Data)?.value.orEmpty()
                    _state.value = _state.value.copy(
                        posts = UiState.Data(listOf(post) + current),
                        draft = "",
                        publishing = false,
                    )
                }
                .onFailure {
                    // Раньше вызывающий (`{ _, _ -> }` в CommunityScreen)
                    // отбрасывал и успех, и ошибку — при сбое публикации
                    // черновик оставался как был, кнопка просто переставала
                    // крутиться, и пользователь не понимал, ушёл пост или нет.
                    _state.value = _state.value.copy(
                        publishing = false,
                        error = it.message ?: "Не удалось опубликовать",
                    )
                }
        }
    }

    fun toggleLike(postId: String) {
        viewModelScope.launch {
            runCatching { repository.like(postId) }
                .onSuccess { updated -> updatePost(postId) { it.copy(likesCount = updated.likesCount, liked = updated.liked) } }
                .onFailure { _state.value = _state.value.copy(error = it.message ?: "Не удалось отметить") }
        }
    }

    fun toggleSave(postId: String) {
        viewModelScope.launch {
            runCatching { repository.save(postId) }
                .onSuccess { saved ->
                    updatePost(postId) { it.copy(saved = saved) }
                    if (_state.value.tab == CommunityTab.SAVED && !saved) {
                        val current = _state.value.posts
                        if (current is UiState.Data) {
                            _state.value = _state.value.copy(posts = UiState.Data(current.value.filter { it.id != postId }))
                        }
                    }
                }
                .onFailure { _state.value = _state.value.copy(error = it.message ?: "Не удалось сохранить") }
        }
    }

    fun openComments(postId: String) {
        commentsPostId = postId
        _comments.value = UiState.Loading
        viewModelScope.launch {
            runCatching { repository.comments(postId) }
                .onSuccess { _comments.value = UiState.Data(it) }
                .onFailure { _comments.value = UiState.Error(it.message ?: "Не удалось загрузить комментарии") }
        }
    }

    fun sendComment(text: String, onResult: (Boolean) -> Unit) {
        val postId = commentsPostId ?: return
        val trimmed = text.trim()
        if (trimmed.isBlank()) return
        viewModelScope.launch {
            runCatching { repository.addComment(postId, trimmed) }
                .onSuccess { comment ->
                    val current = (_comments.value as? UiState.Data)?.value.orEmpty()
                    _comments.value = UiState.Data(current + comment)
                    updatePost(postId) { it.copy(commentsCount = it.commentsCount + 1) }
                    onResult(true)
                }
                .onFailure {
                    _state.value = _state.value.copy(error = it.message ?: "Не удалось отправить комментарий")
                    onResult(false)
                }
        }
    }

    fun consumeError() {
        _state.value = _state.value.copy(error = null)
    }

    private fun updatePost(id: String, transform: (CommunityPost) -> CommunityPost) {
        val current = _state.value.posts
        if (current is UiState.Data) {
            _state.value = _state.value.copy(posts = UiState.Data(current.value.map { if (it.id == id) transform(it) else it }))
        }
    }

    private fun load() {
        _state.value = _state.value.copy(posts = UiState.Loading)
        viewModelScope.launch {
            runCatching { repository.posts(_state.value.topic, _state.value.tab == CommunityTab.SAVED) }
                .onSuccess { _state.value = _state.value.copy(posts = UiState.Data(it)) }
                .onFailure { _state.value = _state.value.copy(posts = UiState.Error(it.message ?: "Лента недоступна")) }
        }
    }
}
