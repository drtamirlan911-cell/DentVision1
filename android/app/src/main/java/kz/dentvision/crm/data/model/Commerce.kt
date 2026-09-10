package kz.dentvision.crm.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Один товар в заказе (`POST /api/shop/orders`). */
@Serializable
data class ShopOrderItem(
    @SerialName("product_id") val productId: String,
    val quantity: Int,
)

@Serializable
data class ShopOrderRequest(
    val items: List<ShopOrderItem>,
    @SerialName("clinic_id") val clinicId: String? = null,
)

/**
 * Запись на курс/вебинар (`POST /api/school/commerce/register`). `format`
 * приходит с самим курсом (`SchoolCourse.format`) — тот же формат, которым
 * курс продаётся, а не выбор покупателя.
 */
@Serializable
data class AcademyRegisterRequest(
    val productId: String,
    val format: String,
)

/**
 * Ссылка на оплату Kaspi QR. `qrUrl`/`qr` — то же самое значение продублировано
 * бэкендом дважды (`withPaymentQr` в `kaspi.provider.ts`); берём любое из двух.
 * Открывается системным обработчиком ссылок: если на телефоне установлен
 * Kaspi.kz, он перехватывает такую ссылку сам, иначе — браузер.
 */
@Serializable
data class PurchasePayment(
    val id: String? = null,
    val qr: String? = null,
    val qrUrl: String? = null,
) {
    val openUrl: String? get() = qrUrl ?: qr
}

/**
 * Общий ответ обеих ручек покупки — оформление заказа и запись на курс
 * возвращают разные объекты (`Order` и собранный вручную DTO), но оба несут
 * один и тот же смысл: получилось ли сразу, или нужно сначала заплатить.
 */
@Serializable
data class PurchaseResult(
    val id: String? = null,
    val status: String? = null,
    val message: String? = null,
    val requiresPayment: Boolean = false,
    val paymentUnknown: Boolean = false,
    val payment: PurchasePayment? = null,
)
