package kz.dentvision.crm.data.model

import kotlinx.serialization.json.Json
import kz.dentvision.crm.data.api.ApiEnvelope
import org.junit.Assert.assertEquals
import org.junit.Test

class JobsRequestContractTest {
    @Test
    fun genericJobsPostDefaultsToCandidateResume() {
        val request = CreateJobRequest(
            title = "Врач-стоматолог-терапевт",
            city = "Тараз",
        )

        assertEquals("resume", request.kind)
    }
 
    @Test
    fun candidateResumeCreationResponseDecodesFromApiEnvelope() {
        val payload = """{"ok":true,"data":{"id":"resume-1","title":"Dentist","city":"Тараз","kind":"resume"}}"""
        val response = Json.decodeFromString(
            ApiEnvelope.serializer(JobVacancy.serializer()),
            payload,
        )

        assertEquals(true, response.ok)
        assertEquals("resume-1", response.data?.id)
        assertEquals("resume", response.data?.kind)
    }
}
