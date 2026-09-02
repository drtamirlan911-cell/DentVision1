package kz.dentvision.crm.data.session

import kz.dentvision.crm.data.model.User
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Права решают, какие кнопки человек вообще увидит, поэтому ошибка здесь тихая
 * и оттого неприятная: приложение просто выглядит меньше, чем есть.
 *
 * Ожидания взяты из `dentvision-backend/src/lib/permissions.ts`: DOCTOR
 * получает `patients: [read, write]`, SUPERADMIN — одну звёздочку на всё,
 * а `permissionsSatisfy` разрешает младшее действие через старшее.
 */
class SessionPermissionsTest {

    private fun session(vararg permissions: String) = Session(
        user = User(id = "u1"),
        accessToken = "a",
        refreshToken = "r",
        permissions = permissions.toList(),
    )

    @Test
    fun `точное совпадение проходит`() {
        val s = session("patients.read", "patients.write", "appointments.read")
        assertTrue(s.has("patients.write"))
        assertFalse(s.has("billing.manage"))
    }

    @Test
    fun `звёздочка суперадмина открывает всё`() {
        val s = session("*")
        assertTrue(s.has("patients.write"))
        assertTrue(s.has("billing.manage"))
        assertTrue(s.has("что.угодно"))
    }

    @Test
    fun `старшее действие покрывает младшее`() {
        // Матрица не выводит младшие действия из старших: у владельца есть
        // shop.manage и нет shop.read буквально. Проверка обязана его пропустить.
        val s = session("shop.manage")
        assertTrue(s.has("shop.read"))
        assertTrue(s.has("shop.write"))
        assertTrue(s.has("shop.manage"))

        val writer = session("patients.write")
        assertTrue(writer.has("patients.read"))
        assertFalse(writer.has("patients.delete"))
    }

    @Test
    fun `устаревшее имя в единственном числе тоже находит право`() {
        // Сервер присылает канонические имена, а часть кода спрашивает старыми.
        val s = session("patients.write", "appointments.write", "billing.manage")
        assertTrue(s.has("patient.write"))
        assertTrue(s.has("appointment.write"))
        assertTrue(s.has("finance.manage"))
    }

    @Test
    fun `пустой набор ничего не открывает`() {
        val s = session()
        assertFalse(s.has("patients.read"))
        assertFalse(s.has("*"))
    }

    @Test
    fun `мусорный ключ не роняет проверку`() {
        val s = session("patients.write")
        assertFalse(s.has("безточки"))
        assertFalse(s.has(""))
    }
}
