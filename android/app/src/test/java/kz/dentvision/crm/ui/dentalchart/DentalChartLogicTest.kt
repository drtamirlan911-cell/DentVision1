package kz.dentvision.crm.ui.dentalchart

import kz.dentvision.crm.data.model.ToothState
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * `mergeSurfaceEdit` — та часть правки по поверхностям, где легче всего
 * незаметно затереть чужую находку. Сервер уже сливает аддитивно
 * (`applyToothFindings`), но клиент патчит своё состояние локально после
 * успешного ответа, и здесь та же гарантия обязана держаться независимо.
 */
class DentalChartLogicTest {

    @Test
    fun `правит только тронутую поверхность, соседние остаются как были`() {
        val teeth = mapOf("16" to ToothState(status = "caries", surfaces = mapOf("M" to "caries")))

        val result = mergeSurfaceEdit(teeth, "16", "O", "filled")

        assertEquals(mapOf("M" to "caries", "O" to "filled"), result.getValue("16").surfaces)
    }

    @Test
    fun `не трогает другие зубы`() {
        val teeth = mapOf(
            "16" to ToothState(status = "caries", surfaces = mapOf("M" to "caries")),
            "26" to ToothState(status = "crown", surfaces = emptyMap()),
        )

        val result = mergeSurfaceEdit(teeth, "16", "O", "filled")

        assertEquals(teeth.getValue("26"), result.getValue("26"))
    }

    @Test
    fun `заводит зуб, которого раньше не было в карте`() {
        val result = mergeSurfaceEdit(emptyMap(), "48", "D", "caries")

        assertEquals(mapOf("D" to "caries"), result.getValue("48").surfaces)
    }

    @Test
    fun `переписывает ту же поверхность, если её правят второй раз`() {
        val teeth = mapOf("16" to ToothState(surfaces = mapOf("O" to "caries")))

        val result = mergeSurfaceEdit(teeth, "16", "O", "filled")

        assertEquals(mapOf("O" to "filled"), result.getValue("16").surfaces)
    }

    @Test
    fun `сохраняет статус и диагноз зуба, меняет только поверхности`() {
        val teeth = mapOf("16" to ToothState(status = "caries", diagnosis = "K02.1", surfaces = emptyMap()))

        val result = mergeSurfaceEdit(teeth, "16", "M", "filled")

        assertEquals("caries", result.getValue("16").status)
        assertEquals("K02.1", result.getValue("16").diagnosis)
    }
}
