package kz.dentvision.crm.ui.diagnostics

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
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
import kz.dentvision.crm.data.model.ReferralDetail
import kz.dentvision.crm.lib.formatTenge
import kz.dentvision.crm.ui.common.ErrorState
import kz.dentvision.crm.ui.common.LoadingSkeleton
import kz.dentvision.crm.ui.common.UiState
import kz.dentvision.crm.ui.theme.DvTheme

/** Перенос `ReferralDetail.tsx`, урезанный до чтения. */
class ReferralDetailViewModel(
    private val repository: DiagnosticsRepository = DiagnosticsRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<ReferralDetail>>(UiState.Loading)
    val state: StateFlow<UiState<ReferralDetail>> = _state

    private var loadedId: String? = null

    fun ensureLoaded(id: String) {
        if (loadedId == id) return
        loadedId = id
        load(id)
    }

    fun load(id: String) {
        _state.value = UiState.Loading
        viewModelScope.launch {
            runCatching { repository.referral(id) }
                .onSuccess { _state.value = UiState.Data(it) }
                .onFailure { _state.value = UiState.Error(it.message ?: "Не удалось загрузить направление") }
        }
    }
}

@Composable
fun ReferralDetailScreen(referralId: String, viewModel: ReferralDetailViewModel = viewModel()) {
    LaunchedEffect(referralId) { viewModel.ensureLoaded(referralId) }
    val state by viewModel.state.collectAsStateWithLifecycle()

    when (val s = state) {
        is UiState.Loading -> LoadingSkeleton()
        is UiState.Error -> ErrorState(message = s.message, onRetry = { viewModel.load(referralId) })
        is UiState.Data -> ReferralDetailContent(s.value)
    }
}

@Composable
private fun ReferralDetailContent(referral: ReferralDetail) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = referral.patientName.ifBlank { "Без имени" },
                style = MaterialTheme.typography.titleLarge,
                color = DvTheme.colors.textPrimary,
            )
            StatusChip(referral.status)
        }

        InfoCard(title = "Исследование") {
            InfoRow("Тип", referral.studyType.ifBlank { "—" })
            InfoRow("Категория", referral.category.ifBlank { "—" })
            InfoRow("Приоритет", referral.priority)
            (referral.center?.name ?: referral.lab?.name)?.takeIf { it.isNotBlank() }?.let {
                InfoRow(if (referral.center != null) "Центр" else "Лаборатория", it)
            }
            referral.doctor?.fullName?.let { InfoRow("Врач", it) }
        }

        val cost = referral.cost.asTengeOrNull()
        val fee = referral.platformFee.asTengeOrNull()
        if (cost != null || fee != null) {
            InfoCard(title = "Стоимость") {
                cost?.let { InfoRow("Стоимость исследования", formatTenge(it)) }
                fee?.let { InfoRow("Комиссия платформы", formatTenge(it)) }
            }
        }

        if (!referral.complaints.isNullOrBlank() || !referral.preliminaryDx.isNullOrBlank()) {
            InfoCard(title = "Клиническая информация") {
                referral.complaints?.takeIf { it.isNotBlank() }?.let { InfoRow("Жалобы", it) }
                referral.preliminaryDx?.takeIf { it.isNotBlank() }?.let { InfoRow("Предв. диагноз", it) }
            }
        }

        if (referral.files.isNotEmpty()) {
            InfoCard(title = "Файлы") {
                referral.files.forEach { file ->
                    Text(
                        text = file.fileName.ifBlank { "Без имени" },
                        style = MaterialTheme.typography.bodyMedium,
                        color = DvTheme.colors.textPrimary,
                        modifier = Modifier.padding(vertical = 4.dp),
                    )
                }
            }
        }

        referral.result?.let {
            InfoCard(title = "Результат") {
                Text(
                    text = if (it.aiGenerated) "Заключение подготовлено с помощью ИИ" else "Заключение готово",
                    style = MaterialTheme.typography.bodyMedium,
                    color = DvTheme.colors.success,
                )
            }
        }

        if (referral.comments.isNotEmpty()) {
            InfoCard(title = "Комментарии") {
                referral.comments.forEach { comment ->
                    Column(modifier = Modifier.padding(vertical = 4.dp)) {
                        Text(
                            text = comment.author?.fullName ?: "—",
                            style = MaterialTheme.typography.labelSmall,
                            color = DvTheme.colors.textMuted,
                        )
                        Text(
                            text = comment.text,
                            style = MaterialTheme.typography.bodyMedium,
                            color = DvTheme.colors.textPrimary,
                        )
                    }
                    HorizontalDivider(color = DvTheme.colors.borderSubtle)
                }
            }
        }
    }
}

@Composable
private fun InfoCard(title: String, content: @Composable () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DvTheme.colors.surface1),
        border = androidx.compose.foundation.BorderStroke(1.dp, DvTheme.colors.borderSubtle),
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(text = title, style = MaterialTheme.typography.labelLarge, color = DvTheme.colors.textMuted)
            content()
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(text = label, style = MaterialTheme.typography.bodySmall, color = DvTheme.colors.textMuted)
        Text(text = value, style = MaterialTheme.typography.bodyMedium, color = DvTheme.colors.textPrimary)
    }
}
