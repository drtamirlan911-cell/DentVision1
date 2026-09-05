package kz.dentvision.crm.navigation

import androidx.compose.runtime.staticCompositionLocalOf

/**
 * Переход между разделами оболочки из глубины дерева экрана — нужен,
 * например, подсказкам ИИ на карточке пациента (`AiInsightSection`),
 * которые лежат внутри [IMPLEMENTED_PAGES] и получают только `Session`.
 * `AppShell`/`AssistantSheet`/`WorkspaceScreen` держат `open(route)` в
 * локальной области видимости и передают его явным параметром — этот
 * `CompositionLocal` открывает тот же переход экранам, до которых явный
 * параметр не дотягивается, тем же приёмом, что уже применён для
 * [kz.dentvision.crm.ui.theme.LocalDvColors].
 */
val LocalAssistantNavigate = staticCompositionLocalOf<(String) -> Unit> { {} }
