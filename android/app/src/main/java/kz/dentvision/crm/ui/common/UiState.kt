package kz.dentvision.crm.ui.common

/**
 * Четыре состояния экрана, ровно те же, что различает веб: загрузка, ошибка с
 * возможностью повторить, пусто и данные. Отдельное «пусто» нужно потому, что
 * пустой список и не пришедший список — разные вещи для того, кто смотрит.
 */
sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Error(val message: String) : UiState<Nothing>
    data class Data<T>(val value: T) : UiState<T>
}
