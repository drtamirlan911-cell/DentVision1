package kz.dentvision.crm.navigation

/**
 * Действия ассистента и тревоги брифинга возвращают веб-пути
 * (`NAVIGATION_ACTION_PATHS` в `ai.routes.ts`: `/crm/schedule`, `/shop`, …).
 * Android понимает только те, для которых уже есть построенный экран —
 * сопоставляем через тот же каталог [CRM_PAGES], которым живёт меню, а не
 * через отдельно придуманный список.
 *
 * Путь без готового экрана — не ошибка, а честная граница: раздел открыт
 * пока только в браузере, и ассистент должен сказать это, а не притвориться,
 * что нажатие сработало.
 */
fun resolveAssistantPath(path: String?, implemented: Set<String>): String? {
    if (path.isNullOrBlank()) return null
    val clean = path.substringBefore('?').removePrefix("/")
    val page = CRM_PAGES.firstOrNull { it.route == clean } ?: return null
    return if (page.id in implemented) page.route else null
}
