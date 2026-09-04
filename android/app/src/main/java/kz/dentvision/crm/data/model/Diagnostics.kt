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
    val patientId: String? = null,
    val patientName: String = "",
    val patientIin: String? = null,
    val patientPhone: String? = null,
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

/**
 * Строка `GET /centers` / `GET /laboratories` — одна форма для обоих,
 * поля совпадают (`svc.listCenters`/`svc.listLaboratories`). `_count` не
 * переношу — на пикере не нужен.
 */
@Serializable
data class DiagnosticOrg(
    val id: String,
    val name: String = "",
    val city: String? = null,
    val address: String? = null,
    val phone: String? = null,
    val rating: Float? = null,
    val accredited: Boolean = false,
)

/**
 * Строка прайса учреждения — `DiagnosticStudy`/`LaboratoryTest`, обе через
 * один и тот же `select: {id, name, category, price, active}`. `price` —
 * `Decimal?` в Prisma, на проводе строка (`Decimal.js.toJSON()`), не число.
 */
@Serializable
data class PricingItem(
    val id: String,
    val name: String = "",
    val category: String = "",
    val price: String? = null,
    val active: Boolean = true,
)

/**
 * `anatomicalSites` в теле создания — плоский `{teeth: number[]}`, НЕ
 * массив `[{region, teeth[]}]`, как обещает комментарий к полю в
 * `prisma/schema.prisma` — реальный отправитель, `ReferralForm.tsx`,
 * шлёт именно эту плоскую форму.
 */
@Serializable
data class AnatomicalSites(
    val teeth: List<Int> = emptyList(),
)

/**
 * Тело `POST /api/diagnostics/referrals` — только то, что реально
 * принимает явный whitelist в `createReferral`
 * (`diagnostics.service.ts:463`); `doctorId` сервер подставляет сам, его
 * здесь нет намеренно.
 */
@Serializable
data class CreateReferralRequest(
    val patientName: String,
    val patientIin: String? = null,
    val patientBirth: String? = null,
    val patientGender: String? = null,
    val patientPhone: String? = null,
    val patientEmail: String? = null,
    val pregnancy: Boolean? = null,
    val allergies: String? = null,
    val specialNotes: String? = null,
    val clinicId: String,
    val category: String,
    val studyType: String,
    val anatomicalSites: AnatomicalSites? = null,
    val complaints: String? = null,
    val preliminaryDx: String? = null,
    val studyGoal: String? = null,
    val commentForLab: String? = null,
    val priority: String = "NORMAL",
    val centerId: String? = null,
    val labId: String? = null,
)

/**
 * Тело `POST /api/diagnostics/files/upload`. `fileData` — полный
 * `data:<mime>;base64,...` URI (`svc.uploadReferralFile` кладёт его в
 * `fileUrl` дословно), не голый base64.
 */
@Serializable
data class UploadFileRequest(
    val referralId: String,
    val fileName: String,
    val fileData: String,
    val fileType: String,
    val fileSize: Long? = null,
)

/**
 * `GET /api/diagnostics/registrations` (только SUPERADMIN) — сырые строки
 * `model RegistrationRequest` без `select` (`diagnostics.service.ts:326`),
 * поэтому поля списаны прямо со схемы, не с ответа. `type` — `"center"`
 * или `"laboratory"` (строка, не enum на сервере).
 */
@Serializable
data class RegistrationRequest(
    val id: String,
    val type: String = "",
    val name: String = "",
    val city: String? = null,
    val address: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val comment: String? = null,
    val status: String = "PENDING",
    val reviewNote: String? = null,
    val createdAt: String? = null,
)

/** Тело `POST /api/diagnostics/registrations/:id/reject`. */
@Serializable
data class RejectRegistrationRequest(
    val reason: String? = null,
)
