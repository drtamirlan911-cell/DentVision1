package kz.dentvision.crm.ui.today

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.CrmRepository
import kz.dentvision.crm.data.model.Appointment
import kz.dentvision.crm.data.model.Invoice
import kz.dentvision.crm.data.model.LabOrder
import kz.dentvision.crm.data.session.SelectedPatient
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.navigation.canAccessPage
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter

/**
 * Одна строка «требует внимания»: что случилось, сколько таких, и куда вести.
 *
 * Счётчик без перехода — тупик: человек видит, что три счёта не оплачены, и
 * не может ничего с этим сделать, не найдя раздел сам.
 */
data class AttentionItem(
    val id: String,
    val title: String,
    val count: Int,
    val route: String,
    /** true — красный акцент (просрочено), false — обычный. */
    val urgent: Boolean = false,
)

data class TodayUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val date: LocalDate = LocalDate.now(),
    /** Приёмы на сегодня, по возрастанию времени. */
    val appointments: List<Appointment> = emptyList(),
    /**
     * Ближайший ещё не прошедший приём. Отдельно от списка: это то, к чему
     * врач готовится прямо сейчас, и оно должно читаться без поиска глазами
     * по списку.
     */
    val next: Appointment? = null,
    val attention: List<AttentionItem> = emptyList(),
) {
    val isEmpty: Boolean get() = appointments.isEmpty() && attention.isEmpty()
}

/**
 * «Сегодня» — рабочий день, а не меню разделов.
 *
 * До этого экрана дом приложения был чатом с ассистентом, а второй экран —
 * списком из девятнадцати разделов CRM. Ни один из них не отвечал на вопрос,
 * с которого начинается смена: кто у меня сегодня и что горит. Ответ
 * собирался вручную — открыть «Кабинет», найти «Расписание», пролистать до
 * текущего часа.
 *
 * Новых ручек не заводит: расписание, счета и заказы лаборатории уже отдаются
 * теми же маршрутами, которыми пользуются соответствующие экраны. Каждый блок
 * запрашивается только если у роли есть право его видеть — кассиру незачем
 * грузить заказы лаборатории, а роли без `billing.manage` не показывают
 * долги, которых он всё равно не откроет.
 */
class TodayViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(TodayUiState())
    val state: StateFlow<TodayUiState> = _state

    private var loaded = false

    fun ensureLoaded(session: Session) {
        if (loaded) return
        loaded = true
        load(session)
    }

    fun refresh(session: Session) = load(session)

    /**
     * Открыть карточку пациента по приёму.
     *
     * Маршрут карточки берёт объект пациента из [SelectedPatient], а не
     * запрашивает его сам, поэтому пациента нужно донести до держателя. В
     * списке приёмов лежат только `patientId` и имя, так что здесь —
     * единственный запрос: без него переход упёрся бы в «Пациент не выбран».
     *
     * Не удалось загрузить — не ведём никуда: пустая карточка хуже, чем
     * оставшийся на месте экран.
     */
    fun openPatient(patientId: String, onReady: (String) -> Unit) {
        if (patientId.isBlank()) return
        viewModelScope.launch {
            runCatching { repository.patient(patientId) }
                .onSuccess { patient ->
                    SelectedPatient.set(patient)
                    onReady(patientId)
                }
                .onFailure { e ->
                    _state.update { it.copy(error = e.message ?: "Не удалось открыть карточку пациента") }
                }
        }
    }

    private fun load(session: Session) {
        _state.update { it.copy(loading = true, error = null) }
        val today = LocalDate.now()
        val iso = today.format(DateTimeFormatter.ISO_LOCAL_DATE)

        viewModelScope.launch {
            // Блоки грузятся параллельно и падают независимо: пустой список
            // долгов из-за сетевой ошибки не должен стирать расписание, ради
            // которого экран и открывают.
            val appointmentsJob = async { runCatching { repository.appointmentsOn(iso) } }
            val invoicesJob = async {
                if (canAccessPage(session.pages, "finance")) runCatching { repository.invoices() } else null
            }
            val labJob = async {
                if (canAccessPage(session.pages, "lab")) runCatching { repository.labOrders() } else null
            }

            val appointmentsResult = appointmentsJob.await()
            val appointments = appointmentsResult.getOrNull().orEmpty().sortedBy { it.time }
            val invoices = invoicesJob.await()?.getOrNull().orEmpty()
            val labOrders = labJob.await()?.getOrNull().orEmpty()

            _state.update {
                it.copy(
                    loading = false,
                    // Ошибку показываем только если не удалось главное —
                    // расписание. Остальное деградирует молча: блок просто
                    // не появится, и это честнее, чем красная плашка поверх
                    // работающего дня.
                    error = appointmentsResult.exceptionOrNull()
                        ?.let { e -> e.message ?: "Не удалось загрузить расписание" },
                    date = today,
                    appointments = appointments,
                    next = nextAppointment(appointments),
                    attention = buildAttention(appointments, invoices, labOrders, today, session.pages),
                )
            }
        }
    }
}

/**
 * Ближайший приём, который ещё не начался. Отменённые пропускаем: к ним никто
 * не готовится.
 */
internal fun nextAppointment(
    appointments: List<Appointment>,
    now: LocalTime = LocalTime.now(),
): Appointment? = appointments
    .filter { it.status != "cancelled" }
    .firstOrNull { appointment ->
        val time = runCatching { LocalTime.parse(appointment.time) }.getOrNull()
        time != null && !time.isBefore(now)
    }

/**
 * Что требует внимания — только то, по чему есть что сделать, и только
 * непустое: строка «Долгов: 0» занимает место и ничего не сообщает.
 *
 * Каждая карточка ведёт на раздел CRM, а раздел заводится в графе навигации
 * только под роли, которым он разрешён (`visiblePages` в AppShell.kt) —
 * `NavController.navigate()` на маршрут, которого нет в графе, не отказывает
 * мягко, а падает с IllegalArgumentException. У лаборатории и менеджера,
 * например, есть право `lab.read` (нужно другим их ручкам), но раздела
 * «Лаборатория» в меню нет — карточка для них была бы прямым крашем. Поэтому
 * `pages` проверяется тем же [canAccessPage], что решает, попадёт ли маршрут
 * в граф вообще, а не правом, которое лишь исторически с ним совпадает.
 */
internal fun buildAttention(
    appointments: List<Appointment>,
    invoices: List<Invoice>,
    labOrders: List<LabOrder>,
    today: LocalDate,
    pages: List<String>,
): List<AttentionItem> = buildList {
    val unassigned = appointments.count { it.doctorId.isBlank() && it.status != "cancelled" }
    if (unassigned > 0 && canAccessPage(pages, "schedule")) {
        add(
            AttentionItem(
                id = "unassigned",
                title = "Приём без врача",
                count = unassigned,
                route = "crm/schedule",
                urgent = true,
            ),
        )
    }

    val unpaid = invoices.count { it.status == "unpaid" || it.status == "overdue" }
    if (unpaid > 0 && canAccessPage(pages, "finance")) {
        add(
            AttentionItem(
                id = "debts",
                title = "Неоплаченные счета",
                count = unpaid,
                route = "crm/finance",
                urgent = invoices.any { it.status == "overdue" },
            ),
        )
    }

    val overdueLab = labOrders.count { order ->
        if (order.status == "ready" || order.status == "delivered") return@count false
        val due = order.dueDate?.substringBefore('T')?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
        due != null && due.isBefore(today)
    }
    if (overdueLab > 0 && canAccessPage(pages, "lab")) {
        add(
            AttentionItem(
                id = "lab",
                title = "Просроченные заказы лаборатории",
                count = overdueLab,
                route = "crm/lab",
                urgent = true,
            ),
        )
    }
}
