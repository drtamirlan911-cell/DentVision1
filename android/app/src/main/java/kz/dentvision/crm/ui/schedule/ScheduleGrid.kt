package kz.dentvision.crm.ui.schedule

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import kz.dentvision.crm.data.model.Appointment
import kz.dentvision.crm.data.model.Doctor
import kz.dentvision.crm.ui.common.EmptyStateView
import kz.dentvision.crm.ui.theme.DvSpacing
import kz.dentvision.crm.ui.theme.DvTheme
import kotlin.math.roundToInt

/**
 * Сетка расписания по врачам с переносом приёма перетаскиванием — перенос
 * сетки из `Schedule.tsx` (`viewMode === 'doctors'`). Видимость колонок
 * решает вызывающий: у роли с `ownDataOnly` (врач, ассистент) [doctors]
 * приходит уже урезанным до одного элемента, а не пятью пустыми колонками
 * коллег, как на вебе — там `doctorColumns` не фильтруется по роли вовсе,
 * только данные внутри колонок, и это оставляет на экране ряд пустых
 * карточек чужих врачей. Здесь колонка, которую нельзя увидеть, просто не
 * строится.
 */
private val SLOT_MINUTES = 30
private val SLOT_HEIGHT = 32.dp
private val COLUMN_WIDTH = 240.dp
private val COLUMN_MAX_HEIGHT = 520.dp

private val GRID_SLOTS: List<String> = buildList {
    var minutes = 8 * 60
    while (minutes <= 20 * 60) {
        add("%02d:%02d".format(minutes / 60, minutes % 60))
        minutes += SLOT_MINUTES
    }
}

private fun timeToMinutes(time: String): Int? {
    val parts = time.split(":")
    val h = parts.getOrNull(0)?.toIntOrNull() ?: return null
    val m = parts.getOrNull(1)?.toIntOrNull() ?: return null
    return h * 60 + m
}

@Composable
fun ScheduleGrid(
    doctors: List<Doctor>,
    appointments: List<Appointment>,
    canWrite: Boolean,
    onSlotClick: (doctorId: String, time: String) -> Unit,
    onAppointmentClick: (Appointment) -> Unit,
    onReschedule: (appointment: Appointment, newDoctorId: String, newTime: String) -> Unit,
) {
    if (doctors.isEmpty()) {
        EmptyStateView(
            title = "Нет врачей",
            description = "Добавьте сотрудников с ролью «Врач», чтобы увидеть сетку.",
        )
        return
    }

    // Окно каждого слота в оконных координатах — по нему при отпускании
    // пальца находим, куда перетащили карточку. Ключ "врач|время" проще
    // сравнивать построчно, чем городить Pair как ключ мутируемой карты.
    val slotBounds = remember { mutableStateMapOf<String, Rect>() }
    var rootWindowPosition by remember { mutableStateOf(Offset.Zero) }
    var draggedAppointment by remember { mutableStateOf<Appointment?>(null) }
    var draggedOriginWindowPos by remember { mutableStateOf(Offset.Zero) }
    var draggedWindowPos by remember { mutableStateOf(Offset.Zero) }

    fun endDrag() {
        val appt = draggedAppointment
        if (appt != null) {
            val target = slotBounds.entries.firstOrNull { (_, rect) -> rect.contains(draggedWindowPos) }
            if (target != null) {
                val separator = target.key.indexOf('|')
                val targetDoctorId = target.key.substring(0, separator)
                val targetTime = target.key.substring(separator + 1)
                onReschedule(appt, targetDoctorId, targetTime)
            }
        }
        draggedAppointment = null
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .onGloballyPositioned { rootWindowPosition = it.positionInWindow() },
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(DvSpacing.sm),
        ) {
            doctors.forEach { doctor ->
                DoctorColumn(
                    doctor = doctor,
                    appointments = appointments.filter { it.doctorId == doctor.id },
                    canWrite = canWrite,
                    onSlotClick = onSlotClick,
                    onAppointmentClick = onAppointmentClick,
                    onSlotPositioned = { time, rect -> slotBounds["${doctor.id}|$time"] = rect },
                    onDragStart = { appt, windowPos ->
                        draggedAppointment = appt
                        draggedOriginWindowPos = windowPos
                        draggedWindowPos = windowPos
                    },
                    onDragMove = { windowPos -> draggedWindowPos = windowPos },
                    onDragEnd = { endDrag() },
                )
            }
        }

        // Карточка-призрак: рисуется поверх всей сетки, а не внутри одной
        // колонки — иначе перетаскивание к другому врачу визуально
        // обрывалось бы на границе своей колонки.
        draggedAppointment?.let { appt ->
            val local = draggedWindowPos - rootWindowPosition
            Box(
                modifier = Modifier
                    .graphicsLayer {
                        translationX = local.x - 24.dp.toPx()
                        translationY = local.y - 16.dp.toPx()
                    }
                    .zIndex(10f)
                    .alpha(0.92f)
                    .width(COLUMN_WIDTH - DvSpacing.md * 2),
            ) {
                AppointmentChip(appointment = appt, dense = true)
            }
        }
    }
}

@Composable
private fun DoctorColumn(
    doctor: Doctor,
    appointments: List<Appointment>,
    canWrite: Boolean,
    onSlotClick: (doctorId: String, time: String) -> Unit,
    onAppointmentClick: (Appointment) -> Unit,
    onSlotPositioned: (time: String, rect: Rect) -> Unit,
    onDragStart: (Appointment, Offset) -> Unit,
    onDragMove: (Offset) -> Unit,
    onDragEnd: () -> Unit,
) {
    Column(
        modifier = Modifier
            .width(COLUMN_WIDTH)
            .clip(RoundedCornerShape(12.dp))
            .background(DvTheme.colors.surface1)
            .border(1.dp, DvTheme.colors.borderSubtle, RoundedCornerShape(12.dp)),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(DvTheme.colors.gold.copy(alpha = 0.05f))
                .padding(DvSpacing.md),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = doctor.name.ifBlank { "Врач" },
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = DvTheme.colors.textPrimary,
                    maxLines = 1,
                )
                Text(
                    text = listOfNotNull(doctor.spec?.ifBlank { null } ?: "Врач", "${appointments.size} записей")
                        .joinToString(" · "),
                    style = MaterialTheme.typography.labelSmall,
                    color = DvTheme.colors.textMuted,
                )
            }
        }

        Column(
            modifier = Modifier
                .heightIn(max = COLUMN_MAX_HEIGHT)
                .verticalScroll(rememberScrollState()),
        ) {
            GRID_SLOTS.forEach { time ->
                val slotAppointments = appointments.filter { it.time == time }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = SLOT_HEIGHT)
                        .border(0.5.dp, DvTheme.colors.borderSubtle)
                        .onGloballyPositioned { coordinates ->
                            val pos = coordinates.positionInWindow()
                            onSlotPositioned(time, Rect(pos, coordinates.size.toSize()))
                        }
                        .then(
                            if (slotAppointments.isEmpty() && canWrite) {
                                Modifier.clickable { onSlotClick(doctor.id, time) }
                            } else {
                                Modifier
                            },
                        ),
                ) {
                    Text(
                        text = time,
                        style = MaterialTheme.typography.labelSmall,
                        color = DvTheme.colors.textGhost,
                        modifier = Modifier.width(40.dp).padding(top = 6.dp, start = 4.dp),
                    )
                    Column(modifier = Modifier.weight(1f).padding(2.dp)) {
                        if (slotAppointments.isEmpty()) {
                            Text(
                                text = "",
                                style = MaterialTheme.typography.labelSmall,
                            )
                        } else {
                            slotAppointments.forEach { appt ->
                                DraggableAppointmentChip(
                                    appointment = appt,
                                    canDrag = canWrite,
                                    onClick = { onAppointmentClick(appt) },
                                    onDragStart = onDragStart,
                                    onDragMove = onDragMove,
                                    onDragEnd = onDragEnd,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun androidx.compose.ui.unit.IntSize.toSize(): androidx.compose.ui.geometry.Size =
    androidx.compose.ui.geometry.Size(width.toFloat(), height.toFloat())

@Composable
private fun DraggableAppointmentChip(
    appointment: Appointment,
    canDrag: Boolean,
    onClick: () -> Unit,
    onDragStart: (Appointment, Offset) -> Unit,
    onDragMove: (Offset) -> Unit,
    onDragEnd: () -> Unit,
) {
    var cardWindowPos by remember { mutableStateOf(Offset.Zero) }
    var accumulated by remember { mutableStateOf(Offset.Zero) }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 1.dp)
            .onGloballyPositioned { cardWindowPos = it.positionInWindow() }
            .then(
                if (canDrag) {
                    Modifier.pointerInput(appointment.id) {
                        detectDragGesturesAfterLongPress(
                            onDragStart = {
                                accumulated = Offset.Zero
                                onDragStart(appointment, cardWindowPos)
                            },
                            onDrag = { change, dragAmount ->
                                change.consume()
                                accumulated += dragAmount
                                onDragMove(cardWindowPos + accumulated)
                            },
                            onDragEnd = { onDragEnd() },
                            onDragCancel = { onDragEnd() },
                        )
                    }
                } else {
                    Modifier
                },
            )
            .clickable(onClick = onClick),
    ) {
        AppointmentChip(appointment = appointment, dense = true)
    }
}

@Composable
private fun AppointmentChip(appointment: Appointment, dense: Boolean) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(statusChipColor(appointment.status).copy(alpha = 0.14f))
            .border(1.dp, statusChipColor(appointment.status).copy(alpha = 0.35f), RoundedCornerShape(6.dp))
            .padding(horizontal = 6.dp, vertical = 4.dp),
    ) {
        Text(
            text = appointment.patientName?.ifBlank { null } ?: "Пациент",
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Medium,
            color = DvTheme.colors.textPrimary,
            maxLines = 1,
        )
        if (!dense) {
            Text(
                text = appointment.serviceName.ifBlank { appointment.reason },
                style = MaterialTheme.typography.labelSmall,
                color = DvTheme.colors.textMuted,
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun statusChipColor(status: String) = when (status) {
    "cancelled", "noShow" -> DvTheme.colors.error
    "done" -> DvTheme.colors.success
    "confirmed", "arrived", "in_chair" -> DvTheme.colors.gold
    else -> DvTheme.colors.textMuted
}
