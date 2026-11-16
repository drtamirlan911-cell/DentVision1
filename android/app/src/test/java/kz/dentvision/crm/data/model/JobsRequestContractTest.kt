package kz.dentvision.crm.data.model

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
}
