package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * Счёт кассы — строка `Invoice` как её отдаёт `GET /api/billing/invoices`.
 *
 * **Суммы здесь в целых тенге, а не в тиынах.** Колонка `amount` объявлена как
 * `Int` и хранит тенге; минорные единицы и `BigInt` живут в отдельном мире —
 * это Finance Core с кошельками и проводками (`lib/money.ts`), к кассе клиники
 * прямого отношения не имеющий. Умножать здесь на сто было бы ошибкой в сто раз.
 */
@Serializable
data class Invoice(
    val id: String,
    val clinicId: String? = null,
    val patientId: String? = null,
    val amount: Int = 0,
    /** `paid`, `pending`, `unpaid`, `partial`, `overdue` — enum `InvoiceStatus`. */
    val status: String = "pending",
    val notes: String? = null,
    val paidAt: String? = null,
    val createdAt: String? = null,
)

val INVOICE_STATUS_LABELS: Map<String, String> = mapOf(
    "paid" to "Оплачен",
    "pending" to "Ожидает оплаты",
    "unpaid" to "Не оплачен",
    "partial" to "Частично",
    "overdue" to "Просрочен",
)

/** Позиция счёта в том виде, в каком её принимает `POST /api/billing/invoices`. */
@Serializable
data class InvoiceItem(
    val name: String,
    val price: Int,
    val qty: Int = 1,
)

@Serializable
data class InvoiceCreate(
    val patientId: String,
    val amount: Int,
    val items: List<InvoiceItem> = emptyList(),
    val notes: String? = null,
    val payMethod: String? = null,
)

/**
 * Финансовый отчёт `GET /api/billing/reports`. Все суммы уже посчитаны на
 * сервере — клиент их только показывает, ничего не пересчитывая: иначе телефон
 * и браузер начали бы показывать разную выручку за один и тот же день.
 */
@Serializable
data class FinanceReport(
    val from: String? = null,
    val to: String? = null,
    val totals: FinanceTotals = FinanceTotals(),
    val byDay: List<DayRevenue> = emptyList(),
    val byService: List<ServiceRevenue> = emptyList(),
    val byMethod: List<MethodRevenue> = emptyList(),
    val expensesByCategory: List<ExpenseCategoryRow> = emptyList(),
)

@Serializable
data class FinanceTotals(
    val revenue: Int = 0,
    val paidCount: Int = 0,
    val unpaid: Int = 0,
    val unpaidCount: Int = 0,
    val expenses: Int = 0,
    val expenseCount: Int = 0,
    val payroll: Int = 0,
    val profit: Int = 0,
)

@Serializable
data class DayRevenue(val date: String, val revenue: Int = 0, val count: Int = 0)

@Serializable
data class ServiceRevenue(val name: String, val revenue: Int = 0, val count: Int = 0)

@Serializable
data class MethodRevenue(val method: String, val revenue: Int = 0, val count: Int = 0)

@Serializable
data class ExpenseCategoryRow(val category: String, val amount: Int = 0, val count: Int = 0)

/** Позиция прайса (`PriceListItem`, `GET/POST /api/crm/price-list`). */
@Serializable
data class PriceListItem(
    val id: String,
    val serviceCode: String = "",
    val name: String? = null,
    val price: Int = 0,
    val matCost: Int = 0,
    val active: Boolean = true,
)

@Serializable
data class PriceListUpsert(
    val serviceCode: String,
    val price: Int,
    val name: String? = null,
    val matCost: Int? = null,
    val active: Boolean? = null,
)
