package kz.dentvision.crm.data.session

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Что открыто на экране прямо сейчас — тип сущности и её id, если она есть.
 *
 * Существует ради одной вещи: контекст-движок бэкенда принимает `focusType`/
 * `focusId` в `POST /api/ai/query` и не заставляет модель переспрашивать то,
 * что уже видно на экране (`pathname`/`focusType`/`focusId`, `querySchema` в
 * `ai.routes.ts:52`). Без этого поля ассистент был бы слепым к контексту,
 * даже вызывая тот же самый маршрут.
 *
 * Экран сам заявляет, что на нём открыто (см. `FocusOwner`), а не строится
 * попытка угадать это по маршруту навигации: угадывание рано или поздно
 * разойдётся с тем, что реально нарисовано.
 */
data class ScreenFocus(
    val pathname: String,
    val type: String? = null,
    val id: String? = null,
)

/**
 * Общий держатель фокуса на процесс. Простой `MutableStateFlow`, а не
 * `CompositionLocal`: ассистент вызывается из оболочки, а не из дерева
 * текущего экрана, поэтому фокус должен быть виден снаружи этого дерева.
 */
object FocusHolder {
    private val _current = MutableStateFlow(ScreenFocus(pathname = "workspace"))
    val current: StateFlow<ScreenFocus> = _current.asStateFlow()

    fun set(focus: ScreenFocus) {
        _current.value = focus
    }
}
