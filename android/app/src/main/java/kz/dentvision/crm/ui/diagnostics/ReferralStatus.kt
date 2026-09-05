package kz.dentvision.crm.ui.diagnostics

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import kz.dentvision.crm.ui.theme.DvTheme

/**
 * Перенос словаря `src/lib/referralStatus.ts`'s `REFERRAL_STATUS` — одиннадцать
 * статусов, подпись и тон для каждого. Веб различает пять тонов золотой
 * градации (`progress`/`active` — два соседних шага одной шкалы); здесь оба
 * сведены к одному `DvTheme.colors.gold` — упрощение подачи одного и того
 * же смысла («идёт»), а не выдумка нового значения.
 */
private val STATUS_LABELS: Map<String, String> = mapOf(
    "DRAFT" to "Черновик",
    "SENT" to "Отправлено",
    "ACCEPTED" to "Принято",
    "SCHEDULED" to "Запланировано",
    "PATIENT_ARRIVED" to "Пациент прибыл",
    "IN_PROGRESS" to "В работе",
    "COMPLETED" to "Завершено",
    "REVIEWED" to "Просмотрено",
    "DELIVERED" to "Выдано",
    "CLOSED" to "Закрыто",
    "CANCELLED" to "Отменено",
)

private val MUTED_STATUSES = setOf("DRAFT", "CLOSED")
private val PROGRESS_STATUSES = setOf("ACCEPTED", "SCHEDULED", "PATIENT_ARRIVED", "IN_PROGRESS")
private val SUCCESS_STATUSES = setOf("COMPLETED", "REVIEWED", "DELIVERED")

fun referralStatusLabel(status: String): String = STATUS_LABELS[status] ?: status

/**
 * Группировка 11 статусов в 4 стадии воронки — перенос `PHASES`/
 * `countByPhase`/`countAwaitingAction` из `src/lib/referralStatus.ts`.
 * `CANCELLED` вне воронки, как и на вебе.
 */
enum class ReferralPhase { AWAITING, ACCEPTED, IN_PROGRESS, DONE, CANCELLED }

fun referralPhase(status: String): ReferralPhase = when (status) {
    "DRAFT", "SENT" -> ReferralPhase.AWAITING
    "ACCEPTED", "SCHEDULED", "PATIENT_ARRIVED" -> ReferralPhase.ACCEPTED
    "IN_PROGRESS" -> ReferralPhase.IN_PROGRESS
    "COMPLETED", "REVIEWED", "DELIVERED", "CLOSED" -> ReferralPhase.DONE
    "CANCELLED" -> ReferralPhase.CANCELLED
    else -> ReferralPhase.AWAITING
}

@Composable
fun referralStatusColor(status: String): Color {
    val colors = DvTheme.colors
    return when (status) {
        in MUTED_STATUSES -> colors.textMuted
        "SENT" -> colors.info
        in PROGRESS_STATUSES -> colors.gold
        in SUCCESS_STATUSES -> colors.success
        "CANCELLED" -> colors.error
        else -> colors.textMuted
    }
}
