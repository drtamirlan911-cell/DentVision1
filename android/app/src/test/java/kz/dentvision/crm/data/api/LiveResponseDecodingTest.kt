package kz.dentvision.crm.data.api

import kotlinx.serialization.json.Json
import kz.dentvision.crm.data.model.InboxConversationSummary
import kz.dentvision.crm.data.model.InboxThread
import kz.dentvision.crm.data.model.NotificationPreference
import kz.dentvision.crm.data.model.TreatmentPlan
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Не синтетический JSON — байт-в-байт ответы настоящего бэкенда этой ветки,
 * снятые curl'ом против локального Postgres во время живой проверки фиксов
 * из этой сессии (АИ-подтверждения, инбокс пациента, план лечения, настройки
 * уведомлений — все семь скриншотов пользователя). Раньше эти же ответы
 * валили декодер `MissingFieldException`; тест ловит момент, когда модель
 * снова разойдётся с тем, что реально шлёт сервер, без эмулятора.
 */
class LiveResponseDecodingTest {

    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `открытие треда инбокса декодируется — раньше падало без include patientUser`() {
        val body = """
            {"ok":true,"data":{"conversation":{"id":"test-convo-1","patientUserId":"test-patient-user-1","clinicId":"8844b87d-6168-4ffe-9a3f-4254e5bd6ad3","status":"WAITING","assignedToUserId":null,"escalationReason":null,"lastPatientMessageAt":"2026-09-05T10:38:46.060Z","lastStaffMessageAt":null,"onCallNotifiedAt":null,"resolvedAt":null,"createdAt":"2026-09-05T10:38:46.060Z","updatedAt":null,"patientUser":{"id":"test-patient-user-1","firstName":"Айгуль","lastName":"Тестова","phone":null},"assignedTo":null},"messages":[{"id":"test-msg-1","authorType":"PATIENT","authorUserId":null,"body":"Здравствуйте, болит зуб уже третий день","createdAt":"2026-09-05T10:38:46.062Z"}]}}
        """.trimIndent()
        val envelope = json.decodeFromString(ApiEnvelope.serializer(InboxThread.serializer()), body)
        assertEquals("test-patient-user-1", envelope.data?.conversation?.patientUser?.id)
        assertEquals(1, envelope.data?.messages?.size)
    }

    @Test
    fun `claim декодируется — раньше падало без include на update()`() {
        val body = """
            {"ok":true,"data":{"id":"test-convo-1","patientUserId":"test-patient-user-1","clinicId":"8844b87d-6168-4ffe-9a3f-4254e5bd6ad3","status":"LIVE","assignedToUserId":"2c430189-17b8-437f-aac6-18e74291469c","escalationReason":null,"lastPatientMessageAt":"2026-09-05T10:38:46.060Z","lastStaffMessageAt":null,"onCallNotifiedAt":null,"resolvedAt":null,"createdAt":"2026-09-05T10:38:46.060Z","updatedAt":"2026-09-05T10:38:50.966Z","patientUser":{"id":"test-patient-user-1","firstName":"Айгуль","lastName":"Тестова","phone":null},"assignedTo":{"id":"2c430189-17b8-437f-aac6-18e74291469c","firstName":"Owner","lastName":"ClinicA"}}}
        """.trimIndent()
        val envelope = json.decodeFromString(ApiEnvelope.serializer(InboxConversationSummary.serializer()), body)
        assertEquals("LIVE", envelope.data?.status)
        assertEquals("Owner", envelope.data?.assignedTo?.firstName)
    }

    @Test
    fun `resolve декодируется — та же строка, что и claim`() {
        val body = """
            {"ok":true,"data":{"id":"test-convo-1","patientUserId":"test-patient-user-1","clinicId":"8844b87d-6168-4ffe-9a3f-4254e5bd6ad3","status":"RESOLVED","assignedToUserId":"2c430189-17b8-437f-aac6-18e74291469c","escalationReason":null,"lastPatientMessageAt":"2026-09-05T10:38:46.060Z","lastStaffMessageAt":null,"onCallNotifiedAt":null,"resolvedAt":"2026-09-05T10:38:50.991Z","createdAt":"2026-09-05T10:38:46.060Z","updatedAt":"2026-09-05T10:38:50.992Z","patientUser":{"id":"test-patient-user-1","firstName":"Айгуль","lastName":"Тестова","phone":null},"assignedTo":{"id":"2c430189-17b8-437f-aac6-18e74291469c","firstName":"Owner","lastName":"ClinicA"}}}
        """.trimIndent()
        val envelope = json.decodeFromString(ApiEnvelope.serializer(InboxConversationSummary.serializer()), body)
        assertEquals("RESOLVED", envelope.data?.status)
    }

    @Test
    fun `план лечения с teeth-числами декодируется — раньше List_String_ падал на raw int`() {
        val body = """
            {"ok":true,"data":{"id":"861e866b-96cc-46f9-b26b-555843cee11b","patientId":"8c919346-83c3-438d-bf99-dcdf926b6144","patientName":"TP Patient","title":"Crash Repro Plan","status":"proposed","diagnosis":"K02.1","notes":"K02.1","totalBudget":45000,"teeth":[14,15,16],"stages":[{"id":"38c95a51-ae73-4eda-96f7-999585866a2b","cost":45000,"items":[{"id":"d16ffcad-65b6-4b96-b84b-606379e8ee84","qty":1,"price":15000,"teeth":[14,15,16],"serviceName":"Пломба"}],"title":"Этап 1","sortOrder":1}],"doctorId":null,"createdAt":"2026-09-05T10:38:15.749Z","updatedAt":"2026-09-05T10:38:15.749Z"}}
        """.trimIndent()
        val envelope = json.decodeFromString(ApiEnvelope.serializer(TreatmentPlan.serializer()), body)
        assertEquals(listOf(14, 15, 16), envelope.data?.teeth)
    }

    @Test
    fun `пустой список настроек уведомлений декодируется — раньше 500 из-за отсутствующей таблицы`() {
        val body = """{"ok":true,"data":[]}"""
        val serializer = ApiEnvelope.serializer(
            kotlinx.serialization.builtins.ListSerializer(NotificationPreference.serializer()),
        )
        val envelope = json.decodeFromString(serializer, body)
        assertEquals(emptyList<NotificationPreference>(), envelope.data)
    }
}
