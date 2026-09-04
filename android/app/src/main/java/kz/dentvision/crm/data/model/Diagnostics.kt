package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** `clinic`/`center`/`lab` в `referralInclude` — везде выборка `{id, name}`. */
@Serializable
data class OrgBrief(
    val id: String,
    val name: String = "",
)

/** `doctor`/`author` — выборка `{id, firstName, lastName}`. */
@Serializable
data class PersonBrief(
    val id: String,
    val firstName: String? = null,
    val lastName: String? = null,
) {
    val fullName: String
        get() = listOfNotNull(firstName, lastName).joinToString(" ").ifBlank { "—" }
}

/** `files` в `referralInclude` — `{id, fileName, fileType, createdAt}`. */
@Serializable
data class ReferralFile(
    val id: String,
    val fileName: String = "",
    val fileType: String = "",
    val createdAt: String? = null,
)

/**
 * `result` на списке/детали направления — сервер выбирает только эти три
 * поля (`referralInclude.result`, `dentvision-backend/src/modules/
 * diagnostics/diagnostics.service.ts:408`), не `reportText`/`conclusion`/
 * `signedBy`: модель `DiagnosticResult` их несёт, но этот `select` их не
 * запрашивает. Веб уже наступает на это (использует поля, которых иногда
 * нет в ответе) — здесь их сознательно не объявляю, чтобы не повторить ту
 * же тихую порчу данных.
 */
@Serializable
data class ReferralResultBrief(
    val id: String,
    val aiGenerated: Boolean = false,
    val createdAt: String? = null,
)

/**
 * Строка списка/дашборда направлений. Поля списаны с реального
 * `model Referral` (`dentvision-backend/prisma/schema.prisma:2956`) и
 * `referralInclude` (`diagnostics.service.ts:399`), не с фронтенд-типов.
 *
 * `cost`/`platformFee` в Prisma — `Decimal?`; форма на проводе (число или
 * строка, в зависимости от сериализации `Decimal.js`) не гарантирована —
 * `JsonElement?`, тот же приём, что у `clinicLoad` в `Ai.kt`, приведение к
 * читаемому виду делает экран, а не модель.
 */
@Serializable
data class Referral(
    val id: String,
    val patientName: String = "",
    val patientIin: String? = null,
    val category: String = "",
    val studyType: String = "",
    val priority: String = "NORMAL",
    val status: String = "DRAFT",
    val clinic: OrgBrief? = null,
    val center: OrgBrief? = null,
    val lab: OrgBrief? = null,
    val doctor: PersonBrief? = null,
    val cost: JsonElement? = null,
    val platformFee: JsonElement? = null,
    val scheduledDate: String? = null,
    val completedAt: String? = null,
    val createdAt: String? = null,
    val files: List<ReferralFile> = emptyList(),
    val result: ReferralResultBrief? = null,
)

/** `comments` — только на детали направления. */
@Serializable
data class ReferralComment(
    val id: String,
    val text: String = "",
    val author: PersonBrief? = null,
    val createdAt: String? = null,
)

/** `GET /api/diagnostics/referrals/:id` — то же плюс клинические поля и комментарии. */
@Serializable
data class ReferralDetail(
    val id: String,
    val patientName: String = "",
    val patientIin: String? = null,
    val patientPhone: String? = null,
    val category: String = "",
    val studyType: String = "",
    val priority: String = "NORMAL",
    val status: String = "DRAFT",
    val complaints: String? = null,
    val preliminaryDx: String? = null,
    val commentForLab: String? = null,
    val clinic: OrgBrief? = null,
    val center: OrgBrief? = null,
    val lab: OrgBrief? = null,
    val doctor: PersonBrief? = null,
    val cost: JsonElement? = null,
    val platformFee: JsonElement? = null,
    val scheduledDate: String? = null,
    val completedAt: String? = null,
    val createdAt: String? = null,
    val files: List<ReferralFile> = emptyList(),
    val result: ReferralResultBrief? = null,
    val comments: List<ReferralComment> = emptyList(),
)

/** `GET /api/diagnostics/dashboard` — обычный `{ok,data}`-конверт. */
@Serializable
data class DiagnosticsDashboardStats(
    val total: Int = 0,
    val todayCount: Int = 0,
    val pending: Int = 0,
    val completed: Int = 0,
    val overdue: Int = 0,
    val recent: List<Referral> = emptyList(),
)

/**
 * `GET /api/diagnostics/referrals` — единственная ручка этого модуля, где
 * `items`/`total` лежат рядом с `ok`, а не под `data`
 * (`diagnosticsRouter.get('/referrals', ...)`: `res.json({ ok: true,
 * ...data })` — спред объекта `{items, total}`, не вложенность). Обычный
 * `ApiEnvelope<T>` эту форму не разберёт: `data` в ответе просто нет. Своя
 * форма ответа вместо общего конверта.
 */
@Serializable
data class ReferralListEnvelope(
    val ok: Boolean = true,
    val items: List<Referral> = emptyList(),
    val total: Int = 0,
    val error: String? = null,
)
