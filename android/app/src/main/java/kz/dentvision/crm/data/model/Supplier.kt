package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/**
 * Кабинет продавца (`GET /api/supplier/me`) — перенос `SupplierWorkspace.tsx`.
 * `status` — реальные значения перечисления `SupplierStatus` на бэкенде
 * (`pending`, `documents_review`, `verified`, `official_partner`, `suspended`,
 * все строчными): у веба свой словарь подписей ключами в верхнем регистре,
 * который из-за этого никогда не совпадает ни с одним настоящим значением —
 * не переносим этот баг, ключи здесь — как в базе.
 */
@Serializable
data class Supplier(
    val id: String,
    val name: String = "",
    val status: String = "pending",
    val myRole: String? = null,
    val bin: String? = null,
    val legalAddress: String? = null,
    val city: String? = null,
    val contactPerson: String? = null,
    val phone: String? = null,
    val email: String? = null,
)

@Serializable
data class SupplierKpis(
    val balanceMinor: String = "0",
    val earnedMinor: String = "0",
    val salesCount: Int = 0,
    val orders30: Int = 0,
    val revenue30: Double = 0.0,
    val productCount: Int = 0,
    val lowStockCount: Int = 0,
    val outOfStockCount: Int = 0,
    val openReturns: Int = 0,
    val avgRating: Double? = null,
    val currency: String = "KZT",
)

@Serializable
data class SupplierInsight(
    val id: String,
    val type: String = "",
    val severity: String = "info",
    val title: String = "",
    val message: String = "",
    val productId: String? = null,
    val productName: String? = null,
)

@Serializable
data class SupplierOrderItem(
    val productId: String? = null,
    val name: String = "",
    val qty: Int = 0,
    val price: Double = 0.0,
    val total: Double = 0.0,
)

@Serializable
data class SupplierOrder(
    val id: String,
    val status: String = "pending",
    val createdAt: String? = null,
    val clinicName: String? = null,
    val clinicCity: String? = null,
    val buyerName: String? = null,
    val items: List<SupplierOrderItem> = emptyList(),
    val subtotal: Double = 0.0,
    val total: Double = 0.0,
)

@Serializable
data class SupplierReturn(
    val id: String,
    val reason: String? = null,
    val status: String = "",
    val refType: String? = null,
    val refId: String? = null,
)

@Serializable
data class SupplierStockItem(
    val id: String,
    val name: String = "",
    val stock: Int = 0,
    val price: Double = 0.0,
    val category: String? = null,
)

@Serializable
data class SupplierStock(
    val low: List<SupplierStockItem> = emptyList(),
    val out: List<SupplierStockItem> = emptyList(),
)

@Serializable
data class SupplierPromotion(
    val id: String,
    val title: String? = null,
    val productId: String? = null,
    val productName: String? = null,
    val active: Boolean = true,
)

@Serializable
data class SupplierProduct(
    val id: String,
    val name: String = "",
    val category: String? = null,
    val price: Double = 0.0,
    val stock: Int = 0,
    val rating: Double? = null,
    val brand: String? = null,
    val description: String? = null,
    val imageUrl: String? = null,
    val ownBrand: Boolean = false,
)

@Serializable
data class SupplierDashboard(
    val kpis: SupplierKpis = SupplierKpis(),
    val insights: List<SupplierInsight> = emptyList(),
    val demandTop: List<SupplierInsight> = emptyList(),
    val orders: List<SupplierOrder> = emptyList(),
    val returns: List<SupplierReturn> = emptyList(),
    val stock: SupplierStock = SupplierStock(),
    val promotions: List<SupplierPromotion> = emptyList(),
    val products: List<SupplierProduct> = emptyList(),
)

@Serializable
data class SupplierCashbackRule(
    val id: String? = null,
    val scope: String = "ALL",
    val scopeKey: String? = null,
    val productId: String? = null,
    val rateBps: Int = 0,
    val active: Boolean = true,
)

// ─────────────────────────── Запросы ───────────────────────────

@Serializable
data class RegisterSupplierRequest(
    val name: String,
    val bin: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val contactPerson: String? = null,
    val legalAddress: String? = null,
)

@Serializable
data class UpdateSupplierProfileRequest(
    val name: String? = null,
    val bin: String? = null,
    val legalAddress: String? = null,
    val contactPerson: String? = null,
    val phone: String? = null,
    val email: String? = null,
)

@Serializable
data class CreateSupplierProductRequest(
    val name: String,
    val price: Double,
    val stock: Int = 0,
    val category: String? = null,
    val description: String? = null,
    val imageUrl: String? = null,
)

/** Частичное обновление — только заполненные поля уходят в запрос (`explicitNulls = false`). */
@Serializable
data class UpdateSupplierProductRequest(
    val stock: Int? = null,
    val ownBrand: Boolean? = null,
    val name: String? = null,
    val price: Double? = null,
    val category: String? = null,
    val description: String? = null,
    val imageUrl: String? = null,
)

@Serializable
data class UpdateOrderStatusRequest(val status: String)

@Serializable
data class CreatePromotionRequest(
    val productId: String,
    val title: String? = null,
    val discountPercent: Int = 10,
    val cashbackPercent: Int = 10,
)

@Serializable
data class UpsertCashbackRuleRequest(
    val scope: String,
    val productId: String? = null,
    val rateBps: Int,
    val active: Boolean = true,
)

@Serializable
data class RequestSupplierPayoutRequest(val amountMinor: String)
