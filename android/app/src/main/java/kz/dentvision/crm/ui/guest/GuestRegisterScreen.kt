package kz.dentvision.crm.ui.guest

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.GuestRepository
import kz.dentvision.crm.ui.common.DvBrandMark
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme

data class GuestRegisterUiState(
    val email: String = "",
    val password: String = "",
    val name: String = "",
    val submitting: Boolean = false,
    val error: String? = null,
) {
    val canSubmit: Boolean get() = email.isNotBlank() && password.length >= 8 && !submitting
}

/**
 * Превращает гостя в обычный аккаунт — `POST /api/guest/convert`
 * (`GuestRepository.convertToAccount`), не полная форма регистрации клиники
 * с почтовым подтверждением (той на Android пока нет и не нужна здесь):
 * этот путь — ровно то, чем гость уже пользовался (ИИ, витрина), просто
 * закреплённое за настоящим логином и паролем.
 */
class GuestRegisterViewModel(
    private val repository: GuestRepository = GuestRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(GuestRegisterUiState())
    val state: StateFlow<GuestRegisterUiState> = _state

    fun onEmailChange(value: String) {
        _state.value = _state.value.copy(email = value, error = null)
    }

    fun onPasswordChange(value: String) {
        _state.value = _state.value.copy(password = value, error = null)
    }

    fun onNameChange(value: String) {
        _state.value = _state.value.copy(name = value, error = null)
    }

    fun submit() {
        val current = _state.value
        if (!current.canSubmit) return
        _state.value = current.copy(submitting = true, error = null)
        viewModelScope.launch {
            runCatching { repository.convertToAccount(current.email.trim(), current.password, current.name.trim()) }
                .onFailure { error ->
                    _state.value = _state.value.copy(submitting = false, error = error.message ?: "Не удалось создать аккаунт")
                }
                .onSuccess {
                    // Сессия сохранена в SessionStore; MainActivity сам
                    // переключит экран на кабинет, подписавшись на неё.
                    _state.value = _state.value.copy(submitting = false, password = "")
                }
        }
    }
}

@Composable
fun GuestRegisterScreen(
    onBack: () -> Unit,
    onSignIn: () -> Unit,
    viewModel: GuestRegisterViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var showPassword by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .imePadding()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        DvBrandMark(subtitle = "Создать аккаунт", modifier = Modifier.padding(bottom = 28.dp))

        OutlinedTextField(
            value = state.name,
            onValueChange = viewModel::onNameChange,
            label = { Text("Имя (необязательно)") },
            singleLine = true,
            enabled = !state.submitting,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
            modifier = Modifier.fillMaxWidth().widthIn(max = 420.dp),
        )

        OutlinedTextField(
            value = state.email,
            onValueChange = viewModel::onEmailChange,
            label = { Text("Email") },
            placeholder = { Text("you@example.com") },
            singleLine = true,
            enabled = !state.submitting,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
            modifier = Modifier.fillMaxWidth().widthIn(max = 420.dp).padding(top = 12.dp),
        )

        OutlinedTextField(
            value = state.password,
            onValueChange = viewModel::onPasswordChange,
            label = { Text("Пароль") },
            supportingText = { Text("Не меньше 8 символов") },
            singleLine = true,
            enabled = !state.submitting,
            visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { viewModel.submit() }),
            trailingIcon = {
                IconButton(onClick = { showPassword = !showPassword }) {
                    Icon(
                        imageVector = if (showPassword) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                        contentDescription = if (showPassword) "Скрыть пароль" else "Показать пароль",
                        tint = DvTheme.colors.textMuted,
                    )
                }
            },
            modifier = Modifier.fillMaxWidth().widthIn(max = 420.dp).padding(top = 12.dp),
        )

        if (state.error != null) {
            Text(
                text = state.error!!,
                style = MaterialTheme.typography.bodySmall,
                color = DvTheme.colors.error,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().widthIn(max = 420.dp).padding(top = 12.dp),
            )
        }

        DvPrimaryButton(
            onClick = viewModel::submit,
            enabled = state.canSubmit,
            modifier = Modifier.fillMaxWidth().widthIn(max = 420.dp).padding(top = 20.dp),
        ) {
            if (state.submitting) {
                CircularProgressIndicator(strokeWidth = 2.dp, color = DvTheme.colors.goldOn, modifier = Modifier.size(18.dp))
            } else {
                Text("Создать аккаунт")
            }
        }

        TextButton(onClick = onSignIn, enabled = !state.submitting, modifier = Modifier.padding(top = 8.dp)) {
            Text("Уже есть аккаунт — войти")
        }
        TextButton(onClick = onBack, enabled = !state.submitting) {
            Text("Назад")
        }
    }
}
