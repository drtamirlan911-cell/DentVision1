package kz.dentvision.crm.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Товар витрины (`GET /api/shop/products`).
 *
 * Маршрут открыт без входа — `authenticate` на него не навешан
 * (`shop.routes.ts:16`), и это не упущение бэкенда, а замысел: каталог должен
 * листаться до регистрации.
 *
 * Бэкенд отдаёт одни и те же значения дважды, в двух написаниях
 * (`image_url` и `imageUrl`, `category_name` и `category`) — наследие
 * постепенного перехода. Берём camelCase там, где он есть, и snake_case там,
 * где другого нет; выдумывать третий вариант незачем.
 */
@Serializable
data class ShopProduct(
    val id: String,
    val name: String = "",
    val brand: String = "",
    val price: Int = 0,
    val stock: Int = 0,
    val unit: String? = null,
    val currency: String = "KZT",
    val description: String? = null,
    val imageUrl: String? = null,
    val rating: Double? = null,
    @SerialName("category_name") val categoryName: String? = null,
    @SerialName("supplier_name") val supplierName: String? = null,
    val city: String? = null,
)

/** Категория каталога (`GET /api/shop/categories`). */
@Serializable
data class ShopCategory(
    val id: String? = null,
    val name: String = "",
    val slug: String? = null,
)

/**
 * Курс школы (`GET /api/school/courses`) — тоже открыт без входа
 * (`school.routes.ts:257`). Поля списаны с `mapCourse` (`school.routes.ts:21`).
 */
@Serializable
data class SchoolCourse(
    val id: String,
    val title: String = "",
    val subtitle: String = "",
    val description: String? = null,
    val category: String = "Общее",
    val rating: Double? = null,
    val lessonCount: Int = 0,
    val durationHours: Double? = null,
    val enrolledCount: Int = 0,
    val instructor: String = "",
    val academyName: String? = null,
    val imageUrl: String? = null,
    val price: Int? = null,
    val format: String? = null,
)
