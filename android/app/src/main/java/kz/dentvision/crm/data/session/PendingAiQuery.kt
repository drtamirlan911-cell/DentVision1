package kz.dentvision.crm.data.session

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Текст, который другой экран хочет сразу отправить в Intelligence при
 * переходе туда — перенос `navigate('/', { state: { aiQuery } })` веба
 * (`Jobs.tsx`, `IntelligenceLayout.tsx:118`, `Odontogram3D.tsx:622`): там
 * это React Router state, здесь навигация — enum (`GuestShell`) или
 * `NavHost` без аргументов (`AppShell`), поэтому общий держатель на
 * процесс, тем же приёмом, что [FocusHolder].
 *
 * Веб не просто подставляет текст в поле ввода — сразу отправляет его
 * (`AIWorkspaceIndex.tsx:274-281`, `handleSend(q)`), поэтому и здесь
 * [IntelligenceScreen] читает и сразу отправляет, а не ждёт нажатия.
 */
object PendingAiQuery {
    private val _value = MutableStateFlow<String?>(null)
    val value: StateFlow<String?> = _value.asStateFlow()

    fun set(query: String) {
        _value.value = query
    }

    fun consume() {
        _value.value = null
    }
}
