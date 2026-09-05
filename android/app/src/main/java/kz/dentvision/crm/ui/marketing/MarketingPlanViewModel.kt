package kz.dentvision.crm.ui.marketing

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.MarketingRepository
import kz.dentvision.crm.data.model.ImageQuota
import kz.dentvision.crm.data.model.StoredPlan
import kz.dentvision.crm.ui.common.UiState

data class MarketingPlanUiState(
    val plan: UiState<StoredPlan> = UiState.Loading,
    val quota: ImageQuota? = null,
    val busyIdeaId: String? = null,
    val message: String? = null,
)

class MarketingPlanViewModel(
    private val repository: MarketingRepository = MarketingRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(MarketingPlanUiState())
    val state: StateFlow<MarketingPlanUiState> = _state

    private var loadedFor: String? = null

    fun ensureLoaded(planId: String) {
        if (loadedFor == planId) return
        loadedFor = planId
        load(planId)
        viewModelScope.launch {
            runCatching { repository.imageQuota() }.onSuccess { q -> _state.update { it.copy(quota = q) } }
        }
    }

    fun load(planId: String) {
        _state.update { it.copy(plan = UiState.Loading) }
        viewModelScope.launch {
            runCatching { repository.plan(planId) }
                .onSuccess { data -> _state.update { it.copy(plan = UiState.Data(data)) } }
                .onFailure { _state.update { s -> s.copy(plan = UiState.Error(it.message ?: "Не удалось загрузить план")) } }
        }
    }

    fun saveIdea(id: String, title: String, hook: String, caption: String, callToAction: String, hashtags: List<String>) {
        viewModelScope.launch {
            runCatching { repository.updateIdea(id, title, hook, caption, callToAction, hashtags) }
                .onSuccess { updated -> replaceIdea(updated.id) { updated }; _state.update { it.copy(message = "Правка сохранена") } }
                .onFailure { e -> _state.update { it.copy(message = e.message ?: "Не удалось сохранить") } }
        }
    }

    fun generateCover(ideaId: String) {
        _state.update { it.copy(busyIdeaId = ideaId) }
        viewModelScope.launch {
            runCatching { repository.generateCover(ideaId) }
                .onSuccess { updated -> replaceIdea(updated.id) { updated } }
                .onFailure { e -> _state.update { it.copy(message = e.message ?: "Не удалось сгенерировать") } }
            refreshQuota()
            _state.update { it.copy(busyIdeaId = null) }
        }
    }

    fun generateCarousel(ideaId: String, slides: Int = 3) {
        _state.update { it.copy(busyIdeaId = ideaId) }
        viewModelScope.launch {
            runCatching { repository.generateCarousel(ideaId, slides) }
                .onSuccess { updated -> replaceIdea(updated.id) { updated } }
                .onFailure { e -> _state.update { it.copy(message = e.message ?: "Не удалось сгенерировать") } }
            refreshQuota()
            _state.update { it.copy(busyIdeaId = null) }
        }
    }

    private suspend fun refreshQuota() {
        runCatching { repository.imageQuota() }.onSuccess { q -> _state.update { it.copy(quota = q) } }
    }

    private fun replaceIdea(id: String, transform: (kz.dentvision.crm.data.model.StoredIdea) -> kz.dentvision.crm.data.model.StoredIdea) {
        val current = (_state.value.plan as? UiState.Data)?.value ?: return
        val next = current.copy(ideas = current.ideas.map { if (it.id == id) transform(it) else it })
        _state.update { it.copy(plan = UiState.Data(next)) }
    }

    fun consumeMessage() = _state.update { it.copy(message = null) }
}
