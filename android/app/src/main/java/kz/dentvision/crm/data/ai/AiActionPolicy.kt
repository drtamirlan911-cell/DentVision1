package kz.dentvision.crm.data.ai

/**
 * Client-side safety mirror of the web AI action policy.
 * Server-side authorization/confirmation remains authoritative.
 *
 * Navigation is explicitly read-only. Unknown actions fail closed when
 * confidence is unavailable at the client or when the server did not mark
 * the action as safe.
 */
object AiActionPolicy {
    private val explicitMutations = setOf(
        "CreateAppointment", "UpdateAppointment", "UpdateAppointmentStatus", "CancelAppointment",
        "CreatePatient", "UpdatePatient", "DeletePatient",
        "CreateLabOrder", "UpdateLabOrder", "CancelLabOrder",
        "CreateInvoice", "UpdateInvoice", "CancelInvoice",
        "CreateTreatmentPlan", "UpdateTreatmentPlan", "DeleteTreatmentPlan",
        "CreateDiagnosticReferral", "UpdateDiagnosticReferral", "CancelDiagnosticReferral",
        "ApplyToothFindings", "UpdateTooth", "UpdateDentalChart", "GenerateDailyReport",
    )

    private val mutationPattern = Regex(
        "^(create|update|delete|remove|cancel|book|reschedule|assign|unassign|add|apply|write|record|pay|charge|refund|issue|send|submit|approve|reject|archive|restore|complete|close)",
        RegexOption.IGNORE_CASE,
    )

    private val navigationPattern = Regex("^(open|navigate)([A-Z_].*)?$|^NAVIGATE$", RegexOption.IGNORE_CASE)

    fun isNavigation(type: String): Boolean = navigationPattern.matches(type.trim())

    fun isMutation(type: String): Boolean {
        val normalized = type.trim()
        if (isNavigation(normalized)) return false
        return normalized in explicitMutations || mutationPattern.containsMatchIn(normalized)
    }

    fun requiresConfirmation(type: String, serverRequiresConfirmation: Boolean): Boolean {
        return serverRequiresConfirmation || isMutation(type)
    }
}
