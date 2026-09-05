package kz.dentvision.crm.ui.patients

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kz.dentvision.crm.data.model.Patient
import kz.dentvision.crm.data.session.FocusHolder
import kz.dentvision.crm.data.session.ScreenFocus
import kz.dentvision.crm.lib.formatDate
import kz.dentvision.crm.lib.formatPhone
import kz.dentvision.crm.navigation.ROUTE_PATIENT_DETAIL
import kz.dentvision.crm.ui.dentalchart.DentalChartScreen
import kz.dentvision.crm.ui.documents.DocumentsScreen
import kz.dentvision.crm.ui.medcard.MedicalCardScreen
import kz.dentvision.crm.ui.plans.TreatmentPlansScreen
import kz.dentvision.crm.ui.theme.DvSpacing
import kz.dentvision.crm.ui.theme.DvTheme
import kz.dentvision.crm.ui.visits.VisitsScreen

/**
 * Вкладки карточки. Порядок — от того, что открывают чаще, к тому, что реже:
 * карта → визиты → зубная формула → планы → документы.
 *
 * Каждая вкладка обязана нести собственные данные пациента. Вкладка ради
 * счёта, показывающая общий список клиники, была бы хуже её отсутствия.
 */
private enum class PatientDetailTab(val label: String) {
    CARD("Карта"),
    VISITS("Визиты"),
    CHART("Зубная карта"),
    PLANS("Планы"),
    DOCUMENTS("Документы"),
}

/**
 * Карточка пациента — рабочее место вокруг человека, а не вокруг раздела.
 *
 * Было две вкладки из семи возможных: карта и визиты. Зубная формула, планы
 * лечения и документы жили отдельными разделами меню и, что хуже, требовали
 * выбрать пациента заново — того самого, чью карточку врач держал открытой.
 * Ошибиться человеком на этом шаге ничего не стоило.
 *
 * Ни один из этих экранов не переписан: каждый уже умел принимать пациента
 * извне или получил такую же возможность тем же приёмом, каким её с самого
 * начала имели медкарта и визиты.
 *
 * Пока карточка открыта, ассистент знает, о ком идёт речь ([FocusHolder]):
 * контекст-движок на сервере принимает `focusType`/`focusId` и до сих пор
 * получал только имя маршрута — то есть спрашивал пациента, которого человек
 * уже выбрал.
 */
@Composable
fun PatientDetailScreen(
    patient: Patient,
    clinicId: String?,
    canWrite: Boolean,
) {
    var tab by remember { mutableStateOf(PatientDetailTab.CARD) }

    // Заявляем открытую сущность на время жизни экрана и снимаем заявку при
    // уходе: устаревший фокус хуже отсутствующего — ассистент отвечал бы про
    // пациента, которого на экране уже нет.
    DisposableEffect(patient.id) {
        FocusHolder.set(
            ScreenFocus(
                pathname = "$ROUTE_PATIENT_DETAIL/${patient.id}",
                type = "patient",
                id = patient.id,
            ),
        )
        onDispose { FocusHolder.set(ScreenFocus(pathname = ROUTE_PATIENT_DETAIL)) }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxWidth().padding(DvSpacing.lg)) {
            Text(
                text = patient.name.ifBlank { "Без имени" },
                style = MaterialTheme.typography.titleLarge,
                color = DvTheme.colors.textPrimary,
            )
            val meta = listOfNotNull(
                formatPhone(patient.phone.ifBlank { null }),
                formatDate(patient.dob.ifBlank { null }),
            ).joinToString(" · ")
            if (meta.isNotBlank()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = meta,
                        style = MaterialTheme.typography.bodySmall,
                        color = DvTheme.colors.textMuted,
                    )
                }
            }
        }

        // Пять вкладок не помещаются в фиксированный TabRow на узком экране —
        // подписи обрезались бы. Прокручиваемый ряд показывает их целиком.
        ScrollableTabRow(
            selectedTabIndex = tab.ordinal,
            containerColor = DvTheme.colors.surface1,
            contentColor = DvTheme.colors.gold,
            edgePadding = DvSpacing.md,
        ) {
            PatientDetailTab.entries.forEach { entry ->
                Tab(
                    selected = tab == entry,
                    onClick = { tab = entry },
                    text = { Text(entry.label, style = MaterialTheme.typography.labelLarge) },
                )
            }
        }

        when (tab) {
            PatientDetailTab.CARD -> MedicalCardScreen(canWrite = canWrite, initialPatient = patient)
            PatientDetailTab.VISITS -> VisitsScreen(clinicId = clinicId, canWrite = canWrite, initialPatient = patient)
            PatientDetailTab.CHART -> DentalChartScreen(initialPatient = patient, clinicId = clinicId)
            PatientDetailTab.PLANS -> TreatmentPlansScreen(
                clinicId = clinicId,
                canWrite = canWrite,
                patientFilter = patient,
            )
            PatientDetailTab.DOCUMENTS -> DocumentsScreen(patientFilter = patient)
        }
    }
}
