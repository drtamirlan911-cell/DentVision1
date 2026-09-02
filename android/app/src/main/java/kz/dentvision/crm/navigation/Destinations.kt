package kz.dentvision.crm.navigation

import androidx.compose.runtime.Composable
import kz.dentvision.crm.data.session.Session
import kz.dentvision.crm.ui.patients.PatientsScreen

/**
 * Экраны, которые действительно построены и работают на настоящих данных.
 *
 * Идентификатор попадает сюда только вместе со своим рабочим экраном. Пока его
 * здесь нет, раздел не появляется ни в меню, ни в графе маршрутов — открыть
 * пустоту нельзя, и счётчик готовых разделов не врёт.
 *
 * Экран получает сессию: право писать проверяется по `permissions`, пришедшим с
 * сервера, а не по роли, угаданной на устройстве.
 */
val IMPLEMENTED_PAGES: Map<String, @Composable (Session) -> Unit> = mapOf(
    "patients" to { session -> PatientsScreen(canWrite = session.has("patient.write")) },
)

/** Домашний маршрут оболочки. */
const val ROUTE_WORKSPACE = "workspace"
