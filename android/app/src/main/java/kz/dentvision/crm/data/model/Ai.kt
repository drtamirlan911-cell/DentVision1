package kz.dentvision.crm.data.model

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

/**
 * Формы ответов ИИ-слоя (`dentvision-backend/src/modules/ai`). Списаны с
 * обработчиков маршрутов, не с деклараций типов — этот урок уже стоил
 * сломанного входа (см. `Auth.kt`), повторять его здесь нельзя.
 *
 * Поля вида `params`/`payload` намеренно остаются `JsonObject`: их форма
 * зависит от конкретного инструмента (`createAppointment`, `cancelAppointment`
 * и так далее), и придумывать для них общую схему значило бы упрощать то,
 * что сервер сознательно оставил открытым.
 */

// ── Брифинг и тревоги: то, чем встречает дом ──────────────────────────────

/** `GET /api/ai/briefing` — «что важно сегодня», требует вошедшего сотрудника клиники. */
@Serializable
data class AiBriefing(
    val reply: String = "",
    val message: String = "",
    val suggestions: List<String> = emptyList(),
    val role: String? = null,
    val timeZone: String? = null,
)

/** `GET /api/ai/proactive` — работает и для гостя (`optionalAuth`). */
@Serializable
data class AiProactiveResponse(val alerts: List<AiAlert> = emptyList())

@Serializable
data class AiAlert(
    val type: String = "",
    val category: String = "",
    val text: String = "",
    val message: String = "",
    val priority: Int = 0,
    val action: AiActionRef? = null,
)

/** Ссылка на быстрое действие внутри тревоги или брифинга (`{ type, payload? }`). */
@Serializable
data class AiActionRef(
    val type: String = "",
    val payload: JsonObject? = null,
)

// ── Разговор ────────────────────────────────────────────────────────────

/**
 * Тело `POST /api/ai/query`. `pathname`/`focusType`/`focusId` — то самое, ради
 * чего строился фокус экрана (Этап 1 плана): контекст-движок бэкенда ждёт эти
 * поля и не заставляет модель переспрашивать то, что уже открыто на экране.
 */
@Serializable
data class AiQueryRequest(
    val text: String,
    val sessionId: String? = null,
    val timezone: String? = null,
    val pathname: String? = null,
    val focusType: String? = null,
    val focusId: String? = null,
)

@Serializable
data class AiQueryResponse(
    val reply: String = "",
    val sessionId: String? = null,
    val messageId: String? = null,
    val suggestions: List<String> = emptyList(),
    val actions: List<AiAction> = emptyList(),
    val toolsUsed: List<String> = emptyList(),
    val activePersonaLabel: String? = null,
    val aiRequestsLeft: Int? = null,
)

/** Кнопка под ответом ассистента (`responseActions`, `ai.routes.ts:232`). */
@Serializable
data class AiAction(
    val type: String = "",
    val label: String = "",
    val params: JsonObject? = null,
    val requiresConfirmation: Boolean = false,
)

// ── Треды ───────────────────────────────────────────────────────────────

@Serializable
data class AiThread(
    val threadId: String? = null,
    val sessionId: String? = null,
    val messages: List<AiMessage> = emptyList(),
    val turnCount: Int = 0,
)

@Serializable
data class AiMessage(
    val id: String,
    val role: String,
    val content: String,
    val timestamp: String? = null,
)

@Serializable
data class AiThreadRef(val threadId: String, val sessionId: String)

// ── Действие и подтверждение ───────────────────────────────────────────

/** Тело `POST /api/ai/action` — кнопка быстрого действия. */
@Serializable
data class AiActionRequest(
    val action: String,
    val params: JsonObject = JsonObject(emptyMap()),
)

/**
 * Ответ `/action`: `type` решает, что показать —
 * `navigate` (открыть раздел), `created`/`data` (готовый результат),
 * `error` (текст для человека).
 */
@Serializable
data class AiActionResult(
    val type: String = "data",
    val path: String? = null,
    val data: JsonElement? = null,
    val label: String? = null,
    val message: String? = null,
)

/** Тело `POST /api/ai/confirm` — подтверждение мутирующего действия человеком. */
@Serializable
data class AiConfirmRequest(
    val action: String,
    val confirmed: Boolean,
    val params: JsonObject? = null,
)

@Serializable
data class AiConfirmResult(
    val confirmed: Boolean = false,
    val action: String? = null,
    val result: JsonElement? = null,
    val path: String? = null,
)

// ── Подсказки на карточке сущности ─────────────────────────────────────

/**
 * `GET /api/ai/insights?entityType=…&entityId=…` — детерминированные
 * подсказки, без обращения к модели: не стоят ничего и не галлюцинируют.
 */
@Serializable
data class AiInsight(
    val id: String,
    val severity: String = "info",
    val title: String = "",
    val evidence: List<AiInsightEvidence> = emptyList(),
    val actions: List<AiInsightAction> = emptyList(),
)

@Serializable
data class AiInsightEvidence(
    val sourceType: String = "",
    val sourceId: String = "",
    val label: String = "",
)

@Serializable
data class AiInsightAction(
    val label: String = "",
    val tool: String = "",
    val params: JsonObject = JsonObject(emptyMap()),
    val requiresApproval: Boolean = false,
)

// ── Очередь подтверждений (governance-ядро) ────────────────────────────

/**
 * Строка `AiApproval`. Появляется, когда мутирующее действие требует
 * подтверждения человеком — переживает F5 и подтвердить может любой
 * уполномоченный коллега, не только тот, кто запросил.
 */
@Serializable
data class AiApprovalItem(
    val id: String,
    val clinicId: String? = null,
    val requestedByUserId: String = "",
    val surface: String = "",
    val agentId: String? = null,
    val tool: String = "",
    val params: JsonObject = JsonObject(emptyMap()),
    val summary: String = "",
    val requiredPermission: String? = null,
    val riskLevel: String = "standard",
    val status: String = "pending",
    val decidedByUserId: String? = null,
    val decidedAt: String? = null,
    val decisionNote: String? = null,
    val expiresAt: String? = null,
    val createdAt: String? = null,
)

@Serializable
data class AiApprovalDecision(val note: String? = null)

// ── Центр активности (evidence — «на чём основано») ────────────────────

/**
 * `GET /api/ai/timeline` — что ИИ делал, с чем и почему отказал. Форма не
 * менялась с версии на `AIEvent`, чтобы старый экран продолжал работать без
 * правок — то же правило действует и здесь: аддитивные поля, не переломные.
 */
@Serializable
data class AiTimelineResponse(
    val entries: List<AiTimelineEvent> = emptyList(),
    val total: Int = 0,
    val limit: Int = 0,
    val offset: Int = 0,
)

@Serializable
data class AiTimelineEvent(
    val id: String,
    val type: String = "",
    val source: String = "",
    val agentId: String? = null,
    val actorRole: String? = null,
    val timestamp: String = "",
    val clinicId: String? = null,
    val userId: String? = null,
    val status: String = "",
    val error: String? = null,
    val durationMs: Int? = null,
    val evidence: List<AiTimelineEvidence> = emptyList(),
)

/**
 * `sourceId` приходит пустым, когда вызывающий не удовлетворяет
 * `medical.read`, а строка помечена как содержащая медицинские данные —
 * видимость самого факта действия и видимость его подробностей разделены
 * на сервере, и клиент эту границу не размывает.
 */
@Serializable
data class AiTimelineEvidence(
    val id: String,
    val sourceType: String = "",
    val sourceId: String = "",
    val access: String? = null,
)

@Serializable
data class AiTimelineStats(
    val totalEvents: Int = 0,
    val todayEvents: Int = 0,
    val successEvents: Int = 0,
    val failedEvents: Int = 0,
    val successRate: Double = 0.0,
)
