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
