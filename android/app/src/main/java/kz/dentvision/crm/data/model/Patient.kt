package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * Пациент в том виде, в каком его отдаёт `serializePatient`
 * (`dentvision-backend/src/modules/patients/patients.routes.ts:38`): бэкенд уже
 * склеил `name`, привёл дату к `ГГГГ-ММ-ДД` и расшифровал ИИН. Клиент ничего из
 * этого не пересчитывает.
 *
 * `noIinReason` — причина, по которой ИИН не указан (иностранец, нет документа,
 * заведён без номера). Пустая строка значит, что ИИН есть.
 */
@Serializable
data class Patient(
    val id: String,
    val clinicId: String? = null,
    val name: String = "",
    val firstName: String = "",
    val lastName: String = "",
    val phone: String = "",
    val email: String = "",
    val dob: String = "",
    val gender: String = "",
    val address: String = "",
    val notes: String = "",
    val iin: String = "",
    val noIinReason: String = "",
    val prepaidBalance: Double = 0.0,
    val category: String = "regular",
    val allergies: String = "",
    val medicalHistory: MedicalHistory? = null,
    /**
     * Зубная формула: ключ — номер зуба по FDI («11», «46»), значение — его
     * состояние. Бэкенд уже слил сюда и колонку `teeth`, и то, что лежит в
     * `medicalHistory.teeth`, поэтому разбирать два источника клиенту не нужно.
     */
    val teeth: Map<String, ToothState> = emptyMap(),
    val createdAt: String? = null,
    val updatedAt: String? = null,
)

/**
 * Тело `POST /api/patients`. Поля — те же, что принимает обработчик; `id`
 * превращает создание в обновление (бэкенд делает upsert по нему).
 *
 * ИИН обязателен при создании — либо номер, либо причина его отсутствия. Это
 * правило бэкенда (`buildPatientIinFields(..., required: !existing)`), и клиент
 * его не смягчает: он лишь показывает ошибку раньше, чем уйдёт запрос.
 */
@Serializable
data class PatientUpsert(
    val id: String? = null,
    val name: String,
    val phone: String? = null,
    val email: String? = null,
    val dob: String? = null,
    val gender: String? = null,
    val address: String? = null,
    val notes: String? = null,
    val iin: String? = null,
    val noIinReason: String? = null,
)

/** Состояние одного зуба, как его отдаёт `serializePatient`. */
@Serializable
data class ToothState(
    val status: String? = null,
    val diagnosis: String? = null,
    val notes: String? = null,
    /**
     * Находки по поверхностям: `M`/`O`/`D`/`B`/`L` → состояние этой стороны
     * зуба (`caries`, `filled`, `healthy`).
     *
     * Сервер их присылает всегда — `serializePatient` специально собирает
     * полную одонтограмму из `medicalHistory` и достаёт поверхности даже из
     * заметок таблицы `teeth`. Здесь поля не было, поэтому клиент их молча
     * терял: кариес на жевательной поверхности не показывался вовсе, и врач у
     * кресла видел про зуб меньше, чем тот же врач видит в браузере.
     */
    val surfaces: Map<String, String> = emptyMap(),
)

/**
 * Правка одной поверхности — тело `POST /api/medical/teeth/findings`
 * (`normalizeSurfaceFindings` в `teethStore.ts`). Статус ограничен тем же
 * подмножеством, что и на сервере: `caries`/`filled`/`healthy` — правка по
 * одной поверхности не может выставить общий статус зуба вроде `missing`,
 * который стёр бы остальные четыре поверхности разом.
 */
@Serializable
data class ToothFindingRequestItem(
    val tooth: Int,
    val status: String,
    val surfaces: List<String>,
)

@Serializable
data class ToothFindingsRequest(
    val patientId: String,
    val findings: List<ToothFindingRequestItem>,
)

/** Что изменилось — для подтверждения на экране, а не для показа истории. */
@Serializable
data class ToothFindingChange(
    val tooth: Int,
    val before: String,
    val after: String,
)

/**
 * Стороны зуба в порядке, в котором их принято называть. Ключи — те же буквы,
 * что и в вебе (`SURFACE_KEYS` в `src/lib/odontogram.ts`).
 */
val TOOTH_SURFACE_LABELS: Map<String, String> = mapOf(
    "M" to "Медиальная",
    "O" to "Жевательная",
    "D" to "Дистальная",
    "B" to "Вестибулярная",
    "L" to "Язычная",
)

/**
 * Состояния зуба и их цветовые роли — те же, что показывает зубная карта в
 * вебе. Незнакомое состояние показывается как есть, а не прячется: если
 * бэкенд начнёт присылать новое, врач это увидит.
 */
val TOOTH_STATUS_LABELS: Map<String, String> = mapOf(
    "healthy" to "Здоров",
    "caries" to "Кариес",
    "filled" to "Пломба",
    "crown" to "Коронка",
    "implant" to "Имплант",
    "missing" to "Отсутствует",
    "root" to "Корень",
    "bridge" to "Мост",
    "treatment" to "В лечении",
)
