package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * Что регистратура получает, нажав «Проверить» на ИИН
 * (`GET /api/patients/lookup`, `patients.routes.ts:371`).
 *
 * `derived` выведено из самого номера — дата рождения и пол в нём закодированы.
 * `existing` — пациент **этой** клиники с таким ИИН: значит, надо открыть его
 * карту, а не заводить дубль. `suggested` — контактная личность, которую
 * платформа уже знает о человеке, чтобы он не диктовал имя и телефон второй раз
 * в жизни.
 *
 * Медицинской истории здесь нет и не будет: она идёт только через согласие
 * пациента. По той же причине в `suggested` не приходит ни идентификатор чужой
 * записи, ни название клиники — это заполнение формы, а не доступ к чужому
 * пациенту.
 */
@Serializable
data class IinLookup(
    val derived: IinDerived = IinDerived(),
    val existing: ExistingPatient? = null,
    val suggested: SuggestedIdentity? = null,
)

@Serializable
data class IinDerived(
    val birthDate: String? = null,
    /** `male` или `female`. */
    val gender: String? = null,
)

@Serializable
data class ExistingPatient(
    val id: String,
    val name: String = "",
    val phone: String = "",
)

@Serializable
data class SuggestedIdentity(
    val name: String = "",
    val phone: String = "",
    val email: String = "",
)

/**
 * Почему у пациента нет ИИН. Список — из `NO_IIN_REASONS`
 * (`dentvision-backend/src/lib/patientIin.ts`); сервер других значений не
 * принимает.
 */
val NO_IIN_REASONS: List<Pair<String, String>> = listOf(
    "foreign" to "Иностранный гражданин",
    "no_document" to "Нет документа",
    "created_without_iin" to "Заведён без ИИН",
)
