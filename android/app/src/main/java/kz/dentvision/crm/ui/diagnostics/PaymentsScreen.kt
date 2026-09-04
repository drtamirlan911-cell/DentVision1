package kz.dentvision.crm.ui.diagnostics

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import kz.dentvision.crm.data.DiagnosticsRepository
import kz.dentvision.crm.data.model.PaymentReferral
import kz.dentvision.crm.data.model.PaymentsSummary
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.lib.formatTenge
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Перенос `PaymentsTab.tsx` — только чтение, история оплат + итоги. Та же
 * ручка (`payments()`), что уже загружает касса (Этап 6b), здесь просто
 * показывает `totals`, который кассе не был нужен.
 */
class PaymentsViewModel(
    private val repository: DiagnosticsRepository = DiagnosticsRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<PaymentsSummary>>(UiState.Loading)
    val state: StateFlow<UiState<PaymentsSummary>> = _state

    private var kind: OperatorKind = OperatorKind.CENTER
    private var orgId: String = ""
    private var startedFor: String? = null

    fun start(kind: OperatorKind, orgId: String) {
        val key = "$kind:$orgId"
        if (startedFor == key) return
        startedFor = key
        this.kind = kind
        this.orgId = orgId
        load()
    }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            runCatching {
                if (kind == OperatorKind.CENTER) repository.payments(centerId = orgId) else repository.payments(labId = orgId)
            }
                .onSuccess { _state.value = UiState.Data(it) }
                .onFailure { e -> _state.value = UiState.Error(e.message ?: "Не удалось получить историю оплат") }
        }
    }
}

@Composable
fun PaymentsScreen(session: Session, viewModel: PaymentsViewModel = viewModel()) {
    val kind = if (session.user.organizationType == "LABORATORY") OperatorKind.LAB else OperatorKind.CENTER
    val orgId = session.user.organizationId

    if (orgId == null) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Text(
                text = "Не удалось определить организацию текущего рабочего пространства.",
                style = MaterialTheme.typography.bodyMedium,
                color = DvTheme.colors.textMuted,
            )
        }
        return
    }

    LaunchedEffect(kind, orgId) { viewModel.start(kind, orgId) }
    val state by viewModel.state.collectAsStateWithLifecycle()

    when (val s = state) {
        is UiState.Loading -> LoadingSkeleton()
        is UiState.Error -> ErrorState(message = s.message, onRetry = viewModel::load)
        is UiState.Data -> PaymentsContent(s.value)
    }
}

@Composable
private fun PaymentsContent(summary: PaymentsSummary) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            items(
                listOf(
                    Pair("Выручка", formatTenge(summary.totals.totalRevenue.toInt())),
                    Pair("Комиссия платформы", formatTenge(summary.totals.totalFees.toInt())),
                    Pair("Оплачено", summary.totals.paidCount.toString()),
                    Pair("Ожидают оплаты", summary.totals.unpaidCount.toString()),
                ),
            ) { (label, value) -> PaymentTotalTile(label, value) }
        }

        Text(text = "История оплат", style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.textPrimary)

        if (summary.referrals.isEmpty()) {
            Text(text = "Нет завершённых направлений", style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textMuted)
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(summary.referrals, key = { it.id }) { referral -> PaymentRow(referral) }
            }
        }
    }
}

@Composable
private fun PaymentTotalTile(label: String, value: String) {
    Card(
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(text = label, style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
            Text(text = value, style = MaterialTheme.typography.titleMedium, color = DvTheme.colors.gold)
        }
    }
}

@Composable
private fun PaymentRow(referral: PaymentReferral) {
    val cost = referral.cost.asTengeOrNull() ?: 0
    val fee = referral.platformFee.asTengeOrNull() ?: 0
    val net = cost - fee

    Card(
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = BorderStroke(1.dp, DvTheme.colors.borderSubtle),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                    Text(text = referral.patientName, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
                    Text(text = referral.studyType.ifBlank { "—" }, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
                }
                Text(
                    text = if (referral.paid) "Оплачено" else "Ожидание",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (referral.paid) DvTheme.colors.success else DvTheme.colors.gold,
                )
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(text = "Стоимость: ${formatTenge(cost)}", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
                Text(text = "Комиссия: ${formatTenge(fee)}", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(text = "К выплате: ${formatTenge(net)}", style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.success)
                Text(text = referral.createdAt?.take(10) ?: "—", style = MaterialTheme.typography.labelSmall, color = DvTheme.colors.textMuted)
            }
        }
    }
}
