package kz.dentvision.crm.ui.billing

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import kz.dentvision.crm.data.model.BILLING_STATUS_LABELS
import kz.dentvision.crm.data.model.ClinicBilling
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

class ClinicBillingViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<ClinicBilling>>(UiState.Loading)
    val state: StateFlow<UiState<ClinicBilling>> = _state

    init {
        load()
    }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            runCatching { repository.clinicBilling() }
                .onSuccess { _state.value = UiState.Data(it) }
                .onFailure { _state.value = UiState.Error(it.message ?: "Не удалось загрузить тариф") }
        }
    }
}

/**
 * Тариф клиники: какой план, в каком состоянии и до какого числа.
 *
 * Только чтение. Оплата идёт через Kaspi QR — это отдельный платёжный поток с
 * возвратом на страницу подтверждения, и приводить его на телефон вполсилы
 * значило бы риск взять деньги и потерять подтверждение.
 */
@Composable
fun ClinicBillingScreen(viewModel: ClinicBillingViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        when (val current = state) {
            is UiState.Loading -> LoadingSkeleton(
                rows = 2,
                contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
            )
            is UiState.Error -> ErrorState(message = current.message, onRetry = viewModel::load)
            is UiState.Data -> {
                val billing = current.value
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
                    border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = billing.plan?.uppercase() ?: "Тариф не определён",
                            style = MaterialTheme.typography.titleLarge,
                            color = DvTheme.colors.gold,
                        )
                        Text(
                            text = BILLING_STATUS_LABELS[billing.status] ?: billing.status.orEmpty(),
                            style = MaterialTheme.typography.bodyMedium,
                            color = DvTheme.colors.textSecondary,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                        billing.periodEnd?.takeIf { it.isNotBlank() }?.let {
                            Text(
                                text = "Действует до ${it.take(10)}",
                                style = MaterialTheme.typography.bodySmall,
                                color = DvTheme.colors.textMuted,
                                modifier = Modifier.padding(top = 6.dp),
                            )
                        }
                    }
                }
                Text(
                    text = "Смена тарифа и оплата — в браузере: платёж идёт через Kaspi QR с возвратом на страницу подтверждения.",
                    style = MaterialTheme.typography.bodySmall,
                    color = DvTheme.colors.textMuted,
                )
            }
        }
    }
}
