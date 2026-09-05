package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * Позиция склада. Колонки называются `minimum` и `price`, хотя интерфейс всю
 * жизнь говорит «минимальный остаток» и «себестоимость» — веб переименовывает
 * их у себя (`inventoryPayload`, `src/utils/api.ts:764`). Здесь имена оставлены
 * как в базе: одно имя вместо двух надёжнее, чем красивое имя и словарь
 * переводов к нему.
 */
@Serializable
data class InventoryItem(
    val id: String,
    val clinicId: String? = null,
    val name: String = "",
    val category: String? = null,
    val quantity: Int = 0,
    val minimum: Int = 0,
    val price: Int? = null,
    val unit: String? = null,
    val supplier: String? = null,
    val sku: String? = null,
    val expiryDate: String? = null,
) {
    /** Остаток ниже минимума — то, ради чего склад вообще открывают. */
    val isLow: Boolean get() = minimum > 0 && quantity <= minimum
}

@Serializable
data class InventoryCreate(
    val name: String,
    val quantity: Int = 0,
    val minimum: Int = 0,
    val price: Int? = null,
    val unit: String? = null,
    val category: String? = null,
    val supplier: String? = null,
)

/**
 * Приход или списание на заданное число единиц.
 *
 * Отдельно от обновления позиции, и это важно: остаток меняется движением.
 * «+1» — это приход в журнале, а не новое значение поля, которое затёрло бы то,
 * что параллельно списал закрытый приём.
 */
@Serializable
data class InventoryAdjust(
    val delta: Int,
    val note: String? = null,
)

/**
 * Позиция правила списания — сколько какой единицы склада уходит.
 * `item` приходит только при чтении (`deductionRules.routes.ts:60`), при
 * сохранении отправляются только `itemId`/`quantity`.
 */
@Serializable
data class StockRuleItem(
    val itemId: String,
    val quantity: Int,
    val item: StockRuleItemRef? = null,
)

@Serializable
data class StockRuleItemRef(
    val id: String,
    val name: String,
    val unit: String? = null,
    val quantity: Int = 0,
)

/**
 * Правило списания расходников после закрытия приёма — `always` (каждый
 * приём), `service` (`matchKey` — код услуги из прайса) или `diagnosis`
 * (`matchKey` — код МКБ-10, полный или корень рубрики).
 */
@Serializable
data class StockRule(
    val id: String,
    val scope: String,
    val matchKey: String = "",
    val label: String? = null,
    val active: Boolean = true,
    val items: List<StockRuleItem> = emptyList(),
)

/**
 * Сохранение правила — сервер сам решает create/update по паре
 * (клиника, `scope`, `matchKey`): второй раз ту же область не завести
 * дублем (`deductionRules.routes.ts:128`).
 */
@Serializable
data class StockRuleUpsert(
    val scope: String,
    val matchKey: String? = null,
    val label: String? = null,
    val active: Boolean? = null,
    val items: List<StockRuleUpsertLine>,
)

@Serializable
data class StockRuleUpsertLine(
    val itemId: String,
    val quantity: Int,
)

/** Что спишется за приём с такими услугами/диагнозом — тем же расчётом, что и настоящее списание. */
@Serializable
data class StockDeductionPreviewLine(
    val itemId: String,
    val itemName: String,
    val unit: String? = null,
    val quantity: Int,
    val available: Int,
    val sources: List<String> = emptyList(),
)
