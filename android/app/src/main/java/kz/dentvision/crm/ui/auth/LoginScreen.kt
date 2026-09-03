package kz.dentvision.crm.ui.auth

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
import androidx.compose.material3.Button
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
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kz.dentvision.crm.ui.common.DvBrandMark
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Вход. Поля и подписи — те же, что на `src/pages/auth/Login.tsx`: «Логин»
 * принимает и логин, и почту (бэкенд кладёт и то и другое в поле `email`),
 * пароль со скрытием.
 *
 * Регистрации и восстановления пароля здесь нет: и то и другое на вебе уводит
 * на почту и на публичные страницы, у которых на Android пока нет своего
 * маршрута. Ставить кнопку, ведущую в никуда, задание запрещает.
 */
@Composable
fun LoginScreen(
    onBrowsePublic: () -> Unit,
    viewModel: LoginViewModel = viewModel(),
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
        DvBrandMark(
            subtitle = "Кабинет клиники",
            modifier = Modifier.padding(bottom = 28.dp),
        )

        OutlinedTextField(
            value = state.login,
            onValueChange = viewModel::onLoginChange,
            label = { Text("Логин") },
            placeholder = { Text("admin_c1") },
            singleLine = true,
            enabled = !state.submitting,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Email,
                imeAction = ImeAction.Next,
            ),
            modifier = Modifier.fillMaxWidth().widthIn(max = 420.dp),
        )

        OutlinedTextField(
            value = state.password,
            onValueChange = viewModel::onPasswordChange,
            label = { Text("Пароль") },
            singleLine = true,
            enabled = !state.submitting,
            visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Password,
                imeAction = ImeAction.Done,
            ),
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

        Button(
            onClick = viewModel::submit,
            enabled = state.canSubmit,
            modifier = Modifier.fillMaxWidth().widthIn(max = 420.dp).padding(top = 20.dp),
        ) {
            if (state.submitting) {
                CircularProgressIndicator(
                    strokeWidth = 2.dp,
                    color = DvTheme.colors.goldOn,
                    modifier = Modifier.size(18.dp),
                )
            } else {
                Text("Войти в систему")
            }
        }

        // Витрина и курсы открыты на бэкенде без входа — значит, и здесь им
        // незачем прятаться за логином. Кабинет клиники за ним остаётся: там
        // чужие медицинские данные.
        TextButton(
            onClick = onBrowsePublic,
            enabled = !state.submitting,
            modifier = Modifier.padding(top = 8.dp),
        ) {
            Text("Магазин и курсы — без входа")
        }
    }
}
