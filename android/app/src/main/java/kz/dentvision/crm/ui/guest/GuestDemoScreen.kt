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
import kz.dentvision.crm.data.DemoRepository
import kz.dentvision.crm.ui.common.DvBrandMark
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme

data class GuestDemoUiState(
    val email: String = "",
    val password: String = "",
    val name: String = "",
    val clinicName: String = "",
    val city: String = "",
    val address: String = "",
    val phone: String = "",
    val submitting: Boolean = false,
    val error: String? = null,
) {
    val canSubmit: Boolean get() =
        email.isNotBlank() && password.length >= 8 && clinicName.isNotBlank() && !submitting
}

/**
 * Перенос `handleDemo()`/`autoStartDemo` из `GuestCRMModal.tsx`, но одним
 * экраном вместо 3-шаговой модалки веба (меню → вход/регистрация → форма
 * клиники): `GuestShell` уже даёт гостю отдельный пункт «Зарегистрироваться»,
 * второй такой же экран здесь не нужен. Регистрация и создание демо-клиники
 * — один вызов `DemoRepository.registerAndCreateDemoClinic`.
 */
class GuestDemoViewModel(
    private val repository: DemoRepository = DemoRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(GuestDemoUiState())
    val state: StateFlow<GuestDemoUiState> = _state

    fun onEmailChange(value: String) { _state.value = _state.value.copy(email = value, error = null) }
    fun onPasswordChange(value: String) { _state.value = _state.value.copy(password = value, error = null) }
    fun onNameChange(value: String) { _state.value = _state.value.copy(name = value) }
    fun onClinicNameChange(value: String) { _state.value = _state.value.copy(clinicName = value, error = null) }
    fun onCityChange(value: String) { _state.value = _state.value.copy(city = value) }
    fun onAddressChange(value: String) { _state.value = _state.value.copy(address = value) }
    fun onPhoneChange(value: String) { _state.value = _state.value.copy(phone = value) }

    fun submit() {
        val current = _state.value
        if (!current.canSubmit) return
        _state.value = current.copy(submitting = true, error = null)
        viewModelScope.launch {
            runCatching {
                repository.registerAndCreateDemoClinic(
                    login = current.email.trim(),
                    password = current.password,
                    name = current.name.trim(),
                    clinicName = current.clinicName.trim(),
                    city = current.city.trim(),
                    address = current.address.trim(),
                    phone = current.phone.trim(),
                )
            }
                .onFailure { error ->
                    _state.value = _state.value.copy(submitting = false, error = error.message ?: "Не удалось создать демо-клинику")
                }
                .onSuccess {
                    // Сессия сохранена; MainActivity сам переключит на AppShell.
                    _state.value = _state.value.copy(submitting = false, password = "")
                }
        }
    }
}

@Composable
fun GuestDemoScreen(
    onBack: () -> Unit,
    onSignIn: () -> Unit,
    viewModel: GuestDemoViewModel = viewModel(),
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
        DvBrandMark(subtitle = "Демо-клиника за минуту", modifier = Modifier.padding(bottom = 8.dp))
        Text(
            text = "Полноценная клиника с образцами пациентов, приёмов, счетов и заказов лаборатории — можно сразу посмотреть, как работает CRM.",
            style = MaterialTheme.typography.bodySmall,
            color = DvTheme.colors.textMuted,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().widthIn(max = 420.dp).padding(bottom = 20.dp),
        )

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
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Next),
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

        Text(
            text = "Клиника",
            style = MaterialTheme.typography.labelMedium,
            color = DvTheme.colors.gold,
            modifier = Modifier.fillMaxWidth().widthIn(max = 420.dp).padding(top = 20.dp, bottom = 4.dp),
        )
        OutlinedTextField(
            value = state.clinicName,
            onValueChange = viewModel::onClinicNameChange,
            label = { Text("Название клиники") },
            singleLine = true,
            enabled = !state.submitting,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
            modifier = Modifier.fillMaxWidth().widthIn(max = 420.dp),
        )
        OutlinedTextField(
            value = state.city,
            onValueChange = viewModel::onCityChange,
            label = { Text("Город (необязательно)") },
            singleLine = true,
            enabled = !state.submitting,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
            modifier = Modifier.fillMaxWidth().widthIn(max = 420.dp).padding(top = 12.dp),
        )
        OutlinedTextField(
            value = state.address,
            onValueChange = viewModel::onAddressChange,
            label = { Text("Адрес (необязательно)") },
            singleLine = true,
            enabled = !state.submitting,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
            modifier = Modifier.fillMaxWidth().widthIn(max = 420.dp).padding(top = 12.dp),
        )
        OutlinedTextField(
            value = state.phone,
            onValueChange = viewModel::onPhoneChange,
            label = { Text("Телефон (необязательно)") },
            singleLine = true,
            enabled = !state.submitting,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { viewModel.submit() }),
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
                Text("Создать демо-клинику")
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
