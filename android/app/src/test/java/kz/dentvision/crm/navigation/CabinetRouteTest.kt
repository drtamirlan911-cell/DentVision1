package kz.dentvision.crm.navigation

import kz.dentvision.crm.data.model.User
import kz.dentvision.crm.data.session.Session
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * `cabinetRouteFor` — общая развилка «Кабинет» для нижней навигации и
 * drawer (`AppShell.kt`). Была реальным багом: пункт вёл в кабинет клиники
 * безусловно, независимо от активного пространства.
 */
class CabinetRouteTest {

    private fun session(organizationType: String?) = Session(
        user = User(id = "u1", organizationType = organizationType),
        accessToken = "a",
        refreshToken = "r",
    )

    @Test
    fun `клиника и пустой тип ведут в кабинет клиники`() {
        assertEquals(ROUTE_WORKSPACE, cabinetRouteFor(session("CLINIC")))
        assertEquals(ROUTE_WORKSPACE, cabinetRouteFor(session(null)))
    }

    @Test
    fun `центр и лаборатория ведут в кабинет приёма`() {
        assertEquals(ROUTE_OPERATOR_WORKSPACE, cabinetRouteFor(session("DIAGNOSTIC_CENTER")))
        assertEquals(ROUTE_OPERATOR_WORKSPACE, cabinetRouteFor(session("LABORATORY")))
    }

    @Test
    fun `прочие типы пространств не ведут никуда — под них нет экрана`() {
        assertNull(cabinetRouteFor(session("SUPPLIER")))
        assertNull(cabinetRouteFor(session("ACADEMY")))
        assertNull(cabinetRouteFor(session("LECTURER")))
        assertNull(cabinetRouteFor(session("PARTNER")))
    }
}
