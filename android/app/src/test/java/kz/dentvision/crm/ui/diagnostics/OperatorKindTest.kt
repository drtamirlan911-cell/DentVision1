package kz.dentvision.crm.ui.diagnostics

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * `operatorKindFor` — общая проверка вида кабинета приёма (`OperatorWorkspaceScreen.kt`,
 * `CashierScreen.kt`, `FinanceScreen.kt`, `ServicesScreen.kt`, `PaymentsScreen.kt`).
 * Была реальным багом: любой тип пространства, кроме буквально `"LABORATORY"`
 * (включая SUPPLIER/ACADEMY/PARTNER/CLINIC), молча попадал в `CENTER` и уходил
 * с чужим id организации.
 */
class OperatorKindTest {

    @Test
    fun `лаборатория и центр распознаются явно`() {
        assertEquals(OperatorKind.LAB, operatorKindFor("LABORATORY"))
        assertEquals(OperatorKind.CENTER, operatorKindFor("DIAGNOSTIC_CENTER"))
    }

    @Test
    fun `прочие типы и null не попадают в CENTER по умолчанию`() {
        assertNull(operatorKindFor("SUPPLIER"))
        assertNull(operatorKindFor("ACADEMY"))
        assertNull(operatorKindFor("PARTNER"))
        assertNull(operatorKindFor("CLINIC"))
        assertNull(operatorKindFor(null))
    }
}
