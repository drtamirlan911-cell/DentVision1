package kz.dentvision.crm.ui.theme

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable

enum class DvConfirmVariant { DANGER, WARNING }

/**
 * Перенос `ConfirmModal` (`src/components/ui/ds/Modal.tsx:147-208`): одна
 * формулировка отмены («Отмена») и одна форма подтверждения на всё
 * приложение, вместо семи самописных `AlertDialog` с разным текстом
 * (`«Назад»` в одном месте, `«Отмена»` в другом — найдено при аудите
 * расхождений с вебом).
 */
@Composable
fun DvConfirmDialog(
    title: String,
    message: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    confirmLabel: String = "Подтвердить",
    variant: DvConfirmVariant = DvConfirmVariant.DANGER,
) {
    val colors = DvTheme.colors
    val confirmColor = if (variant == DvConfirmVariant.DANGER) colors.error else colors.warning
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(message) },
        confirmButton = {
            TextButton(onClick = onConfirm) { Text(confirmLabel, color = confirmColor) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Отмена") }
        },
    )
}
