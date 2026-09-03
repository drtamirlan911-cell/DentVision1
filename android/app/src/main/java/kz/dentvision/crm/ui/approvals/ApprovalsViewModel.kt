package kz.dentvision.crm.ui.approvals

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.AiRepository
import kz.dentvision.crm.data.model.AiApprovalItem
import kz.dentvision.crm.ui.common.UiState

data class ApprovalsUiState(
    val items: UiState<List<AiApprovalItem>> = UiState.Loading,
    /** id строки, которую сейчас решают — блокирует только её кнопки, не весь список. */
    val decidingId: String? = null,
    val message: String? = null,
)

/**
 * Очередь подтверждений governance-ядра (`AiApproval`, Этап 4 бэкенд-плана).
 * Строка появляется, когда мутирующее действие ИИ требует человека, и
 * переживает F5 — подтвердить может любой уполномоченный коллега, не только
 * тот, кто её вызвал. Видимость и право решать сервер проверяет сам
 * (`buildApprovalFilter`, `resolveAiToolAccess`) — экран не дублирует эту
 * логику, только показывает, что сервер прислал.
 */
class ApprovalsViewModel(
    private val repository: AiRepository = AiRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(ApprovalsUiState())
    val state: StateFlow<ApprovalsUiState> = _state

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(items = UiState.Loading) }
        viewModelScope.launch {
            runCatching { repository.approvals(status = "pending") }
                .onSuccess { list -> _state.update { it.copy(items = UiState.Data(list)) } }
                .onFailure { e ->
                    _state.update { it.copy(items = UiState.Error(e.message ?: "Не удалось получить список подтверждений")) }
                }
        }
    }

    fun approve(id: String, note: String? = null) = decide(id) { repository.approve(id, note) }

    fun reject(id: String, note: String? = null) = decide(id) { repository.reject(id, note) }

    private fun decide(id: String, call: suspend () -> AiApprovalItem) {
        _state.update { it.copy(decidingId = id) }
        viewModelScope.launch {
            runCatching { call() }
                .onSuccess {
                    _state.update { s ->
                        val current = s.items
                        s.copy(
                            decidingId = null,
                            items = if (current is UiState.Data) {
                                UiState.Data(current.value.filterNot { row -> row.id == id })
                            } else {
                                current
                            },
                        )
                    }
                }
                .onFailure { e ->
                    _state.update { it.copy(decidingId = null, message = e.message ?: "Не удалось выполнить решение") }
                }
        }
    }

    fun consumeMessage() {
        _state.update { it.copy(message = null) }
    }
}
