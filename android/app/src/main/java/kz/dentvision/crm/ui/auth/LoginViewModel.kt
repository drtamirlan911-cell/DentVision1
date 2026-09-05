package kz.dentvision.crm.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.AuthRepository
import kz.dentvision.crm.data.ServiceLocator

data class LoginUiState(
    val login: String = "",
    val password: String = "",
    val submitting: Boolean = false,
    val error: String? = null,
) {
    val canSubmit: Boolean get() = login.isNotBlank() && password.isNotBlank() && !submitting
}

class LoginViewModel(
    private val repository: AuthRepository = AuthRepository(ServiceLocator.api, ServiceLocator.session),
) : ViewModel() {

    private val _state = MutableStateFlow(LoginUiState())
    val state: StateFlow<LoginUiState> = _state

    fun onLoginChange(value: String) {
        _state.value = _state.value.copy(login = value, error = null)
    }

    fun onPasswordChange(value: String) {
        _state.value = _state.value.copy(password = value, error = null)
    }

    fun submit() {
        val current = _state.value
        if (!current.canSubmit) return
        _state.value = current.copy(submitting = true, error = null)
        viewModelScope.launch {
            runCatching { repository.login(current.login, current.password) }
                .onFailure { error ->
                    _state.value = _state.value.copy(
                        submitting = false,
                        error = error.message ?: "Не удалось войти",
                    )
                }
                .onSuccess {
                    // Сессия сохранена в SessionStore; оболочка сама переключит
                    // экран, подписавшись на неё.
                    _state.value = _state.value.copy(submitting = false, password = "")
                }
        }
    }
}
