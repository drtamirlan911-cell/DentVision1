package kz.dentvision.crm.ui.staff

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.CrmRepository
import kz.dentvision.crm.data.model.ClinicMember
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

/** Роли состава клиники по-русски. Значения — из `normalizeStaffRole` на бэкенде. */
private val ROLE_LABELS = mapOf(
    "owner" to "Владелец",
    "director" to "Директор",
    "admin" to "Администратор",
    "manager" to "Менеджер",
    "doctor" to "Врач",
    "assistant" to "Ассистент",
    "cashier" to "Кассир",
    "lab" to "Лаборант",
)

class StaffViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<List<ClinicMember>>>(UiState.Loading)
    val state: StateFlow<UiState<List<ClinicMember>>> = _state

    private var clinicId: String? = null

    fun start(clinicId: String?) {
        if (this.clinicId == clinicId && _state.value !is UiState.Loading) return
        this.clinicId = clinicId
        load()
    }

    fun load() {
        val clinic = clinicId
        if (clinic == null) {
            _state.value = UiState.Error("Клиника не выбрана")
            return
        }
        _state.value = UiState.Loading
        viewModelScope.launch {
            runCatching { repository.members(clinic) }
                .onSuccess { _state.value = UiState.Data(it.filter { m -> m.user != null }) }
                .onFailure { _state.value = UiState.Error(it.message ?: "Не удалось загрузить состав") }
        }
    }
}

/**
 * Сотрудники клиники.
 *
 * Только список: заведение сотрудника требует пароля и проходит через политику
 * паролей на сервере, а зарплаты и проценты видны лишь по отдельному праву.
 * Показывать это на телефоне вполсилы — хуже, чем не показывать вовсе.
 */
@Composable
fun StaffScreen(
    clinicId: String?,
    viewModel: StaffViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(clinicId) { viewModel.start(clinicId) }

    Column(modifier = Modifier.fillMaxSize()) {
        when (val list = state) {
            is UiState.Loading -> LoadingSkeleton()
            is UiState.Error -> ErrorState(message = list.message, onRetry = viewModel::load)
            is UiState.Data -> if (list.value.isEmpty()) {
                EmptyStateView(title = "В клинике пока никого нет")
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(list.value, key = { it.user!!.id }) { member ->
                        val user = member.user!!
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Text(
                                    text = listOfNotNull(user.firstName, user.lastName)
                                        .joinToString(" ")
                                        .trim()
                                        .ifBlank { "Без имени" },
                                    style = MaterialTheme.typography.titleMedium,
                                    color = DvTheme.colors.textPrimary,
                                )
                                val sub = listOfNotNull(
                                    ROLE_LABELS[member.role.lowercase()] ?: member.role,
                                    user.spec?.takeIf { it.isNotBlank() },
                                    user.phone?.takeIf { it.isNotBlank() },
                                ).joinToString(" · ")
                                Text(
                                    text = sub,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = DvTheme.colors.textMuted,
                                    modifier = Modifier.padding(top = 4.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
