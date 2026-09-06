package kz.dentvision.crm.ui.today

import kz.dentvision.crm.data.model.Appointment
import kz.dentvision.crm.data.model.Invoice
import kz.dentvision.crm.data.model.LabOrder
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalTime

/**
 * «Сегодня» решает, что показать первым и что назвать срочным. Ошибка здесь
 * не косметическая: врач готовится не к тому приёму, или экран молчит о
 * просроченном заказе.
 */
class TodayLogicTest {

    private fun appointment(
        id: String,
        time: String,
        status: String = "scheduled",
        doctorId: String = "doc-1",
    ) = Appointment(id = id, time = time, status = status, doctorId = doctorId, patientId = "p-$id")

    @Test
    fun `следующий приём — первый, который ещё не начался`() {
        val list = listOf(appointment("a", "09:00"), appointment("b", "14:00"), appointment("c", "17:00"))
        assertEquals("b", nextAppointment(list, now = LocalTime.of(10, 30))?.id)
    }

    @Test
    fun `приём, который идёт прямо сейчас, ещё считается следующим`() {
        val list = listOf(appointment("a", "14:00"))
        assertEquals("a", nextAppointment(list, now = LocalTime.of(14, 0))?.id)
    }

    @Test
    fun `отменённый приём пропускается — к нему никто не готовится`() {
        val list = listOf(appointment("a", "14:00", status = "cancelled"), appointment("b", "15:00"))
        assertEquals("b", nextAppointment(list, now = LocalTime.of(10, 0))?.id)
    }

    @Test
    fun `когда день закончился, следующего нет`() {
        val list = listOf(appointment("a", "09:00"))
        assertNull(nextAppointment(list, now = LocalTime.of(20, 0)))
    }

    @Test
    fun `битое время не роняет экран`() {
        val list = listOf(appointment("a", "не время"), appointment("b", "15:00"))
        assertEquals("b", nextAppointment(list, now = LocalTime.of(10, 0))?.id)
    }

    private val today = LocalDate.of(2026, 9, 5)

    /** Директор/админ — все три раздела, к которым ведут карточки, разрешены. */
    private val fullAccess = listOf("schedule", "finance", "lab")

    @Test
    fun `пустых строк не бывает — блок появляется только когда есть что делать`() {
        val items = buildAttention(
            appointments = listOf(appointment("a", "09:00")),
            invoices = listOf(Invoice(id = "i1", status = "paid")),
            labOrders = emptyList(),
            today = today,
            pages = fullAccess,
        )
        assertTrue(items.isEmpty())
    }

    @Test
    fun `приём без врача попадает в срочное`() {
        val items = buildAttention(
            appointments = listOf(appointment("a", "09:00", doctorId = "")),
            invoices = emptyList(),
            labOrders = emptyList(),
            today = today,
            pages = fullAccess,
        )
        assertEquals(1, items.size)
        assertEquals("unassigned", items[0].id)
        assertTrue(items[0].urgent)
    }

    @Test
    fun `отменённый приём без врача никого не тревожит`() {
        val items = buildAttention(
            appointments = listOf(appointment("a", "09:00", status = "cancelled", doctorId = "")),
            invoices = emptyList(),
            labOrders = emptyList(),
            today = today,
            pages = fullAccess,
        )
        assertTrue(items.isEmpty())
    }

    @Test
    fun `просроченный счёт красный, просто неоплаченный — нет`() {
        val onlyUnpaid = buildAttention(
            appointments = emptyList(),
            invoices = listOf(Invoice(id = "i1", status = "unpaid")),
            labOrders = emptyList(),
            today = today,
            pages = fullAccess,
        ).single()
        assertEquals(1, onlyUnpaid.count)
        assertTrue(!onlyUnpaid.urgent)

        val withOverdue = buildAttention(
            appointments = emptyList(),
            invoices = listOf(Invoice(id = "i1", status = "unpaid"), Invoice(id = "i2", status = "overdue")),
            labOrders = emptyList(),
            today = today,
            pages = fullAccess,
        ).single()
        assertEquals(2, withOverdue.count)
        assertTrue(withOverdue.urgent)
    }

    @Test
    fun `готовый заказ лаборатории не считается просроченным, даже если срок прошёл`() {
        val items = buildAttention(
            appointments = emptyList(),
            invoices = emptyList(),
            labOrders = listOf(
                LabOrder(id = "l1", dueDate = "2026-09-01", status = "ready"),
                LabOrder(id = "l2", dueDate = "2026-09-01", status = "in_progress"),
                LabOrder(id = "l3", dueDate = "2026-09-30", status = "in_progress"),
            ),
            today = today,
            pages = fullAccess,
        )
        val lab = items.single { it.id == "lab" }
        assertEquals(1, lab.count)
    }

    @Test
    fun `заказ без срока не выдумывает просрочку`() {
        val items = buildAttention(
            appointments = emptyList(),
            invoices = emptyList(),
            labOrders = listOf(LabOrder(id = "l1", dueDate = null, status = "in_progress")),
            today = today,
            pages = fullAccess,
        )
        assertTrue(items.isEmpty())
    }

    @Test
    fun `у каждой строки есть куда вести — счётчик без перехода это тупик`() {
        val items = buildAttention(
            appointments = listOf(appointment("a", "09:00", doctorId = "")),
            invoices = listOf(Invoice(id = "i1", status = "overdue")),
            labOrders = listOf(LabOrder(id = "l1", dueDate = "2026-09-01", status = "in_progress")),
            today = today,
            pages = fullAccess,
        )
        assertEquals(3, items.size)
        for (item in items) {
            assertTrue("у «${item.title}» пустой маршрут", item.route.isNotBlank())
            assertTrue("у «${item.title}» нулевой счётчик", item.count > 0)
        }
    }

    /**
     * Регрессия: у лаборатории и менеджера есть `lab.read`/`billing.read` для
     * своих экранов, но разделов «Лаборатория»/«Финансы» в их меню нет — до
     * фильтра по [canAccessPage] карточка вела бы `navigate()` на маршрут,
     * которого нет в графе, и это падает с IllegalArgumentException, а не
     * отказывает мягко.
     */
    @Test
    fun `карточка не заводится на раздел, которого нет в меню роли`() {
        val items = buildAttention(
            appointments = listOf(appointment("a", "09:00", doctorId = "")),
            invoices = listOf(Invoice(id = "i1", status = "overdue")),
            labOrders = listOf(LabOrder(id = "l1", dueDate = "2026-09-01", status = "in_progress")),
            today = today,
            pages = emptyList(),
        )
        assertTrue(items.isEmpty())
    }

    @Test
    fun `каждая карточка проверяется своим разделом, а не чужим`() {
        val items = buildAttention(
            appointments = listOf(appointment("a", "09:00", doctorId = "")),
            invoices = listOf(Invoice(id = "i1", status = "overdue")),
            labOrders = listOf(LabOrder(id = "l1", dueDate = "2026-09-01", status = "in_progress")),
            today = today,
            pages = listOf("schedule"),
        )
        assertEquals(listOf("unassigned"), items.map { it.id })
    }
}
