package kz.dentvision.crm.ui.schedule

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kz.dentvision.crm.data.CrmRepository
import kz.dentvision.crm.data.model.Appointment
import kz.dentvision.crm.data.model.AppointmentUpsert
import kz.dentvision.crm.data.model.Doctor
import kz.dentvision.crm.data.model.InvoiceCreate
import kz.dentvision.crm.data.model.InvoiceItem
import kz.dentvision.crm.data.model.Patient
import kz.dentvision.crm.ui.common.UiState
import java.time.LocalDate

/** Способы оплаты — `PAY_METHODS` (`src/lib/seed-data.ts:49`), без QR: тот вариант ведёт в отдельный
 * онлайн-флоу (`createPayment`/`confirmPayment` в `AcceptPaymentModal.tsx`), который сюда не перенесён —
 * QR-оплату пока принимают только в браузере. */
val ACCEPT_PAYMENT_METHODS = listOf("Наличные", "Банковская карта", "Перевод", "Рассрочка")

/** `PAY_KINDS` (`AcceptPaymentModal.tsx:125-129`). */
val PAY_KIND_LABELS = mapOf(
    "full" to "Полностью",
    "prepayment" to "Предоплата",
    "credit" to "В долг",
)

data class ScheduleUiState(
    val date: LocalDate = LocalDate.now(),
    val list: UiState<List<Appointment>> = UiState.Loading,
    val doctors: List<Doctor> = emptyList(),
    val message: String? = null,
    val deleteError: String? = null,
)

data class AppointmentFormState(
    /** Не null — редактирование существующего приёма, а не новая запись. */
    val id: String? = null,
    val patient: Patient? = null,
    val doctorId: String = "",
    val time: String = "09:00",
    val duration: String = "30",
    val serviceName: String = "",
    val notes: String = "",
    val status: String = "scheduled",
    val saving: Boolean = false,
    val error: String? = null,
    /**
     * Найденная занятость. Пока она здесь, кнопка предлагает записать всё
     * равно — решение принимает человек, а не клиент.
     */
    val conflict: String? = null,
) {
    val canSave: Boolean
        get() = patient != null && doctorId.isNotBlank() && time.isNotBlank() && !saving
}

data class AcceptPaymentFormState(
    val appointment: Appointment,
    val amount: String = "",
    val method: String = ACCEPT_PAYMENT_METHODS.first(),
    val payKind: String = "full",
    val notes: String = "",
    val saving: Boolean = false,
    val error: String? = null,
) {
    val canSubmit: Boolean get() = (amount.toIntOrNull() ?: 0) > 0 && !saving
}

class ScheduleViewModel(
    private val repository: CrmRepository = CrmRepository(),
) : ViewModel() {

    private val _state = MutableStateFlow(ScheduleUiState())
    val state: StateFlow<ScheduleUiState> = _state

    private val _form = MutableStateFlow(AppointmentFormState())
    val form: StateFlow<AppointmentFormState> = _form

    private val _paymentForm = MutableStateFlow<AcceptPaymentFormState?>(null)
    val paymentForm: StateFlow<AcceptPaymentFormState?> = _paymentForm

    fun start(clinicId: String?) {
        load()
        if (clinicId != null && _state.value.doctors.isEmpty()) {
            viewModelScope.launch {
                // Список врачей — вспомогательный: если он не пришёл, день всё
                // равно должен показаться, поэтому ошибка тут не поднимается на
                // весь экран.
                runCatching { repository.doctors(clinicId) }
                    .onSuccess { _state.value = _state.value.copy(doctors = it) }
            }
        }
    }

    fun shiftDay(days: Long) {
        _state.value = _state.value.copy(date = _state.value.date.plusDays(days))
        load()
    }

    fun load() {
        _state.value = _state.value.copy(list = UiState.Loading)
        val date = _state.value.date.toString()
        viewModelScope.launch {
            runCatching { repository.appointmentsOn(date) }
                .onSuccess { rows ->
                    _state.value = _state.value.copy(
                        list = UiState.Data(rows.sortedBy { it.time }),
                    )
                }
                .onFailure {
                    _state.value = _state.value.copy(
                        list = UiState.Error(it.message ?: "Не удалось загрузить расписание"),
                    )
                }
        }
    }

    fun openForm() {
        _form.value = AppointmentFormState(
            doctorId = _state.value.doctors.firstOrNull()?.id.orEmpty(),
        )
    }

    /**
     * Раньше тап по приёму не открывал вообще ничего — форма умела только
     * создавать новую запись (найдено при аудите расхождений с вебом, где
     * `openEdit` в `Schedule.tsx` — обычный сценарий). Тот же `AppointmentUpsert`
     * с `id` уже умеет и создание, и правку — новой ручки не потребовалось.
     */
    fun openEdit(appointment: Appointment) {
        _form.value = AppointmentFormState(
            id = appointment.id,
            patient = Patient(
                id = appointment.patientId,
                name = appointment.patientName.orEmpty(),
                phone = appointment.patientPhone.orEmpty(),
            ),
            doctorId = appointment.doctorId,
            time = appointment.time,
            duration = appointment.duration.toString(),
            serviceName = appointment.serviceName,
            notes = appointment.notes,
            status = appointment.status,
        )
    }

    fun updateForm(transform: (AppointmentFormState) -> AppointmentFormState) {
        _form.value = transform(_form.value).copy(error = null)
    }

    /**
     * Приём оплаты — перенос `handleAcceptPayment` (`Schedule.tsx:548-580`):
     * счёт через ту же кассу, что уже строит `FinanceHubScreen`
     * (`POST /api/billing/invoices` + `/pay`), плюс отметка `paymentStatus` на
     * самом приёме. Онлайн QR-оплата (`createPayment`/`confirmPayment`) сюда
     * не перенесена — это отдельный флоу с созданием и подтверждением
     * платежа, которого пока нет на Android; метод не предлагается в списке.
     */
    fun openPayment(appointment: Appointment) {
        val suggested = appointment.servicePrice.takeIf { it > 0 }?.toInt()
        _paymentForm.value = AcceptPaymentFormState(
            appointment = appointment,
            amount = suggested?.toString().orEmpty(),
        )
    }

    fun updatePaymentForm(transform: (AcceptPaymentFormState) -> AcceptPaymentFormState) {
        _paymentForm.value = _paymentForm.value?.let { transform(it).copy(error = null) }
    }

    fun dismissPayment() {
        _paymentForm.value = null
    }

    fun submitPayment(onDone: () -> Unit) {
        val form = _paymentForm.value ?: return
        if (!form.canSubmit) return
        val appointment = form.appointment
        val amount = form.amount.toIntOrNull() ?: return
        _paymentForm.value = form.copy(saving = true, error = null)

        val paymentStatus = when (form.payKind) {
            "credit" -> "debt"
            "prepayment" -> "partial"
            else -> "paid"
        }
        val serviceName = appointment.serviceName.ifBlank { appointment.reason }.ifBlank { "Услуга" }

        viewModelScope.launch {
            runCatching {
                repository.createInvoice(
                    body = InvoiceCreate(
                        patientId = appointment.patientId,
                        amount = amount,
                        items = listOf(InvoiceItem(name = serviceName, price = amount)),
                        notes = form.notes.trim().ifBlank { null },
                        payMethod = form.method,
                    ),
                    markPaid = paymentStatus == "paid",
                )
            }
                .onSuccess {
                    // Приём считается оплаченным/частично оплаченным сразу — как
                    // на вебе: долг создаёт счёт в очереди кассы, но не трогает
                    // paymentStatus приёма (Schedule.tsx:582: условие проверяет
                    // ровно paid/partial).
                    if (paymentStatus == "paid" || paymentStatus == "partial") {
                        runCatching {
                            repository.saveAppointment(
                                AppointmentUpsert(
                                    id = appointment.id,
                                    patientId = appointment.patientId,
                                    doctorId = appointment.doctorId,
                                    date = appointment.date,
                                    time = appointment.time,
                                    duration = appointment.duration,
                                    paymentStatus = paymentStatus,
                                ),
                            )
                        }
                    }
                    _paymentForm.value = null
                    _state.value = _state.value.copy(
                        message = when (paymentStatus) {
                            "paid" -> "Оплата принята"
                            "partial" -> "Частичная оплата принята"
                            else -> "Долг оформлен"
                        },
                    )
                    load()
                    onDone()
                }
                .onFailure { e ->
                    _paymentForm.value = form.copy(saving = false, error = e.message ?: "Не удалось принять оплату")
                }
        }
    }

    /**
     * Проверка занятости перед записью — тот же маршрут, что зовёт веб.
     * Занятость не запрещает запись: бывает, что врач принимает двоих подряд
     * осознанно. Поэтому конфликт показывается человеку, и повторное нажатие
     * уходит с `force`.
     */
    fun save(onSaved: () -> Unit) {
        val form = _form.value
        val patient = form.patient ?: return
        if (!form.canSave) return
        _form.value = form.copy(saving = true, error = null)
        val date = _state.value.date.toString()
        val duration = form.duration.toIntOrNull()

        val isEdit = form.id != null

        viewModelScope.launch {
            if (form.conflict == null) {
                val check = runCatching {
                    repository.checkConflicts(
                        date = date,
                        time = form.time,
                        doctorId = form.doctorId,
                        duration = duration,
                        patientId = patient.id,
                        excludeId = form.id,
                    )
                }.getOrNull()
                if (check != null && check.hasConflict) {
                    _form.value = _form.value.copy(
                        saving = false,
                        conflict = describeConflicts(check.conflicts),
                    )
                    return@launch
                }
            }

            val body = AppointmentUpsert(
                id = form.id,
                patientId = patient.id,
                doctorId = form.doctorId,
                date = date,
                time = form.time,
                duration = duration,
                status = if (isEdit) form.status else null,
                serviceName = form.serviceName.trim().ifBlank { null },
                notes = form.notes.trim().ifBlank { null },
                force = if (form.conflict != null) true else null,
            )
            runCatching { repository.saveAppointment(body) }
                .onSuccess {
                    _form.value = AppointmentFormState()
                    _state.value = _state.value.copy(message = if (isEdit) "Запись обновлена" else "Запись создана")
                    load()
                    onSaved()
                }
                .onFailure {
                    _form.value = _form.value.copy(
                        saving = false,
                        error = it.message ?: "Не удалось записать",
                    )
                }
        }
    }

    private fun describeConflicts(conflicts: List<Appointment>): String {
        val details = conflicts.take(3).joinToString("; ") { conflict ->
            val who = conflict.patientName ?: "пациент"
            "${conflict.time} — $who"
        }
        return "Это время уже занято: $details. Нажмите ещё раз, чтобы записать всё равно."
    }

    fun delete(id: String) {
        viewModelScope.launch {
            runCatching { repository.deleteAppointment(id) }
                .onSuccess {
                    _state.value = _state.value.copy(message = "Запись отменена")
                    load()
                }
                .onFailure {
                    // Раньше ошибка удаления одной записи заменяла Error-ом весь
                    // список дня — пользователь терял из вида все остальные
                    // приёмы из-за сбоя на одном. Теперь это отдельное,
                    // проходящее сообщение, а список остаётся как был.
                    _state.value = _state.value.copy(
                        deleteError = it.message ?: "Не удалось удалить запись",
                    )
                }
        }
    }

    fun consumeMessage() {
        _state.value = _state.value.copy(message = null)
    }

    fun consumeDeleteError() {
        _state.value = _state.value.copy(deleteError = null)
    }
}
