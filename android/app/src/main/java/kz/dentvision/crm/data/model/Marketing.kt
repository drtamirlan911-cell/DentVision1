package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable

/** Факты о клинике, на которых строится контент — без обращения к модели (`contentContext.ts`). */
@Serializable
data class MarketingContext(
    val clinicName: String = "",
    val city: String? = null,
    val topServices: List<MarketingServiceStat> = emptyList(),
    val neglectedServices: List<String> = emptyList(),
    val activePromotions: List<MarketingPromotion> = emptyList(),
    val busiestMonth: MarketingMonthStat? = null,
    val quietestMonth: MarketingMonthStat? = null,
    val frequentDiagnoses: List<MarketingDiagnosisStat> = emptyList(),
    val doctorCount: Int = 0,
    val appointmentsAnalysed: Int = 0,
)

@Serializable
data class MarketingServiceStat(val name: String = "", val count: Int = 0, val averagePrice: Int = 0)

@Serializable
data class MarketingPromotion(
    val title: String = "",
    val description: String? = null,
    val discountPercent: Int = 0,
    val endsAt: String? = null,
)

@Serializable
data class MarketingMonthStat(val month: String = "", val appointments: Int = 0)

@Serializable
data class MarketingDiagnosisStat(val code: String = "", val count: Int = 0)

/** Идея контента — `post`/`reels`/`story`/`carousel`. */
@Serializable
data class StoredIdea(
    val id: String,
    val position: Int = 0,
    val title: String = "",
    val format: String = "post",
    val hook: String = "",
    val caption: String = "",
    val hashtags: List<String> = emptyList(),
    val callToAction: String = "",
    /** Факт клиники, на котором стоит идея — правке не подлежит. */
    val basedOn: String = "",
    /** Правки внёс человек — карточка перестаёт выдавать текст за машинный. */
    val edited: Boolean = false,
    val coverUrl: String? = null,
    val slideUrls: List<String> = emptyList(),
)

@Serializable
data class StoredPlan(
    val id: String,
    val title: String = "",
    val tone: String? = null,
    val deterministic: Boolean = false,
    val createdAt: String = "",
    val ideas: List<StoredIdea> = emptyList(),
    val context: MarketingContext = MarketingContext(),
)

@Serializable
data class PlanSummary(
    val id: String,
    val title: String = "",
    val deterministic: Boolean = false,
    val ideaCount: Int = 0,
    val createdAt: String = "",
)

@Serializable
data class ImageQuota(
    val used: Int = 0,
    val limit: Int = 0,
    val remaining: Int = 0,
    /** Генерация настроена: есть и ключ модели, и объектное хранилище. */
    val configured: Boolean = false,
)

@Serializable
data class ContentPlanRequest(val count: Int = 6, val tone: String? = null)

/** `basedOn` сюда не входит — это происхождение идеи, а не текст, который можно исправить (`marketing.routes.ts:128-131`). */
@Serializable
data class ContentIdeaPatch(
    val title: String? = null,
    val hook: String? = null,
    val caption: String? = null,
    val callToAction: String? = null,
    val hashtags: List<String>? = null,
)

@Serializable
data class CarouselRequest(val slides: Int = 3)
