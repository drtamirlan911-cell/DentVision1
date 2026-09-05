package kz.dentvision.crm.ui.public

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Science
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.PublicRepository
import kz.dentvision.crm.data.model.SubmitRegistrationRequest
import kz.dentvision.crm.ui.theme.DvPrimaryButton
import kz.dentvision.crm.ui.theme.DvTheme

private enum class RegisterStep { TYPE, FORM, DONE }

class DiagnosticsRegisterViewModel(
    private val repository: PublicRepository = PublicRepository(),
) : ViewModel() {

    private val _submitting = MutableStateFlow(false)
    val submitting: StateFlow<Boolean> = _submitting

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    fun submit(body: SubmitRegistrationRequest, onDone: () -> Unit) {
        _submitting.value = true
        _error.value = null
        viewModelScope.launch {
            runCatching { repository.registerDiagnostics(body) }
                .onSuccess {
                    _submitting.value = false
                    onDone()
                }
                .onFailure {
                    _submitting.value = false
                    _error.value = it.message ?: "Ошибка отправки"
                }
        }
    }
}

/**
 * Перенос `DiagnosticsRegister.tsx` — публичная заявка на подключение
 * диагностического центра или лаборатории, три шага (тип → анкета →
 * готово). Ручка (`POST /api/diagnostics/register`) заведена до
 * `authenticate`, так что форма доступна гостю — тот же принцип, что у
 * `PublicApi`: не выдуманное послабление, а перенос уже открытого на
 * бэкенде маршрута.
 */
@Composable
fun DiagnosticsRegisterScreen(
    onBack: () -> Unit,
    viewModel: DiagnosticsRegisterViewModel = viewModel(),
) {
    var step by remember { mutableStateOf(RegisterStep.TYPE) }
    var type by remember { mutableStateOf<String?>(null) }
    var name by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var comment by remember { mutableStateOf("") }
    val submitting by viewModel.submitting.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        TextButton(onClick = { if (step == RegisterStep.FORM) step = RegisterStep.TYPE else onBack() }) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, modifier = Modifier.size(16.dp))
            Text("Назад", modifier = Modifier.padding(start = 4.dp))
        }

        if (step != RegisterStep.DONE) {
            Text(
                text = "Регистрация в системе диагностики",
                style = MaterialTheme.typography.titleLarge,
                color = DvTheme.colors.textPrimary,
            )
            Text(
                text = "Подключите ваш диагностический центр или лабораторию к платформе",
                style = MaterialTheme.typography.bodyMedium,
                color = DvTheme.colors.textMuted,
            )
        }

        when (step) {
            RegisterStep.TYPE -> {
                TypeOption(
                    icon = Icons.Filled.Build,
                    title = "Диагностический центр",
                    subtitle = "3D-снимки, МРТ, КТ, радиология",
                    onClick = { type = "center"; step = RegisterStep.FORM },
                )
                TypeOption(
                    icon = Icons.Filled.Science,
                    title = "Лаборатория",
                    subtitle = "Анализы, гистология, биопсия",
                    onClick = { type = "laboratory"; step = RegisterStep.FORM },
                )
            }

            RegisterStep.FORM -> {
                Field("Название *", name) { name = it }
                Field("Город", city) { city = it }
                Field("Адрес", address) { address = it }
                Field("Телефон", phone) { phone = it }
                Field("Email", email) { email = it }
                Field("Комментарий", comment, singleLine = false) { comment = it }

                error?.let {
                    Text(text = it, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.error)
                }

                DvPrimaryButton(
                    onClick = {
                        val t = type ?: return@DvPrimaryButton
                        viewModel.submit(
                            SubmitRegistrationRequest(
                                type = t,
                                name = name,
                                city = city.ifBlank { null },
                                address = address.ifBlank { null },
                                phone = phone.ifBlank { null },
                                email = email.ifBlank { null },
                                comment = comment.ifBlank { null },
                            ),
                        ) { step = RegisterStep.DONE }
                    },
                    enabled = name.isNotBlank() && !submitting,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (submitting) {
                        CircularProgressIndicator(
                            strokeWidth = 2.dp,
                            color = DvTheme.colors.goldOn,
                            modifier = Modifier.size(18.dp),
                        )
                    } else {
                        Text("Отправить заявку")
                    }
                }
            }

            RegisterStep.DONE -> Column(
                modifier = Modifier.fillMaxWidth().padding(top = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = DvTheme.colors.success, modifier = Modifier.size(48.dp))
                Text(
                    text = "Заявка отправлена!",
                    style = MaterialTheme.typography.titleLarge,
                    color = DvTheme.colors.textPrimary,
                )
                Text(
                    text = "Администратор проверит вашу заявку и активирует ${if (type == "center") "центр" else "лабораторию"} в ближайшее время.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = DvTheme.colors.textMuted,
                )
                DvPrimaryButton(onClick = onBack) { Text("На главную") }
            }
        }
    }
}

@Composable
private fun TypeOption(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .then(Modifier),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Icon(icon, contentDescription = null, tint = DvTheme.colors.gold)
            }
            Column(modifier = Modifier.padding(start = 12.dp)) {
                Text(text = title, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                Text(text = subtitle, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
            }
        }
    }
}

@Composable
private fun Field(label: String, value: String, singleLine: Boolean = true, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = singleLine,
        modifier = Modifier.fillMaxWidth(),
    )
}
