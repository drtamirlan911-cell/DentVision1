package kz.dentvision.crm.data.session

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Число непрочитанных уведомлений — держатель на процесс, тем же приёмом,
 * что [SelectedPatient]/[FocusHolder]: колокольчик в шапке (`AppShell.kt`) и
 * список уведомлений (`NotificationsScreen.kt`) читают/пишут одно и то же
 * число, не гоняя лишний запрос за счётчиком при каждом открытии шторки.
 *
 * Живёт здесь, а не во `ViewModel` экрана уведомлений: шапка есть на каждом
 * экране кабинета, а её вью-модель — только пока открыт сам список.
 */
object NotificationBadge {
    private val _count = MutableStateFlow(0)
    val count: StateFlow<Int> = _count.asStateFlow()

    fun set(value: Int) {
        _count.value = value
    }
}
