package kz.dentvision.crm.data.session

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kz.dentvision.crm.data.model.Patient

/**
 * Пациент, чью карточку только что открыли из списка — держатель на процесс,
 * тем же приёмом, что [FocusHolder]/[PendingAiQuery]: маршрут детали пациента
 * (`crm/patients/detail/{id}`) получает через Navigation-Compose только строку
 * id, а сам объект [Patient] (уже загруженный списком) передаётся так, минуя
 * повторный запрос к серверу за тем, что уже есть на руках.
 */
object SelectedPatient {
    private val _value = MutableStateFlow<Patient?>(null)
    val value: StateFlow<Patient?> = _value.asStateFlow()

    fun set(patient: Patient) {
        _value.value = patient
    }
}
