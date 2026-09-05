package kz.dentvision.crm.ui.patients

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kz.dentvision.crm.data.model.Patient
import kz.dentvision.crm.ui.medcard.MedicalCardScreen
import kz.dentvision.crm.ui.theme.DvTheme
import kz.dentvision.crm.ui.visits.VisitsScreen

private enum class PatientDetailTab(val label: String) {
    CARD("Карта"),
    VISITS("Визиты"),
}

/**
 * Карточка пациента — единственное место, куда раньше вело нажатие на строку
 * в `PatientsScreen`, а вело в никуда (найдено при аудите расхождений с
 * вебом: у `Patients.tsx` это полноценный экран с шестью вкладками, а
 * Android-список был чисто просмотровым).
 *
 * Не пересобирает медкарту и визиты заново — оборачивает уже готовые
 * [MedicalCardScreen]/[VisitsScreen] с заранее известным пациентом, так само
 * приложение уже строило детальные экраны с самого начала.
 */
@Composable
fun PatientDetailScreen(
    patient: Patient,
    clinicId: String?,
    canWrite: Boolean,
) {
    var tab by remember { mutableStateOf(PatientDetailTab.CARD) }

    Column(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Text(
                text = patient.name.ifBlank { "Без имени" },
                style = MaterialTheme.typography.titleLarge,
                color = DvTheme.colors.textPrimary,
            )
            val meta = listOfNotNull(
                patient.phone.ifBlank { null },
                patient.dob.ifBlank { null },
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

        TabRow(
            selectedTabIndex = tab.ordinal,
            containerColor = DvTheme.colors.surface1,
            contentColor = DvTheme.colors.gold,
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
        }
    }
}
