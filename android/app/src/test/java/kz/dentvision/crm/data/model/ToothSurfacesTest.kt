package kz.dentvision.crm.data.model

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Поверхности зуба приходят с сервера всегда (`serializePatient` собирает
 * полную одонтограмму из `medicalHistory` и достаёт их даже из заметок таблицы
 * `teeth`), но в клиентской модели поля не было — и клиент их молча терял.
 *
 * Молча: неизвестные ключи игнорируются, поэтому ответ разбирался успешно, а
 * кариес на жевательной поверхности просто не доезжал до экрана. Тест ловит
 * ровно эту потерю.
 */
class ToothSurfacesTest {

    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `поверхности не теряются при разборе ответа`() {
        val body = """{"status":"healthy","diagnosis":null,"notes":null,"surfaces":{"O":"caries","M":"filled"}}"""
        val tooth = json.decodeFromString(ToothState.serializer(), body)
        assertEquals("caries", tooth.surfaces["O"])
        assertEquals("filled", tooth.surfaces["M"])
    }

    /**
     * Зуб, здоровый в целом, но с находкой на стороне — тот самый случай, ради
     * которого в сетке появилась метка: по заливке он неотличим от здорового.
     */
    @Test
    fun `здоровый зуб с кариесом на поверхности отличим от полностью здорового`() {
        val withFinding = json.decodeFromString(
            ToothState.serializer(),
            """{"status":"healthy","surfaces":{"O":"caries"}}""",
        )
        val clean = json.decodeFromString(
            ToothState.serializer(),
            """{"status":"healthy","surfaces":{"O":"healthy"}}""",
        )
        fun hasFinding(t: ToothState) =
            t.surfaces.any { (_, s) -> s.isNotBlank() && s != "healthy" }

        assertTrue(hasFinding(withFinding))
        assertTrue(!hasFinding(clean))
    }

    @Test
    fun `зуб без поверхностей разбирается и даёт пустую карту, а не падает`() {
        val tooth = json.decodeFromString(ToothState.serializer(), """{"status":"crown"}""")
        assertTrue(tooth.surfaces.isEmpty())
        assertEquals("crown", tooth.status)
    }

    /** Ключи сторон — те же пять букв, что объявляет веб в `SURFACE_KEYS`. */
    @Test
    fun `подписаны ровно пять сторон зуба`() {
        assertEquals(setOf("M", "O", "D", "B", "L"), TOOTH_SURFACE_LABELS.keys)
        for ((key, label) in TOOTH_SURFACE_LABELS) {
            assertTrue("сторона $key без подписи", label.isNotBlank())
        }
    }
}
