/**
 * Mirrors a plan stage's `appointmentId`/`invoiceId` (already written into the
 * stage's own JSON by the caller) onto the real rows, so
 * `Appointment.treatmentPlanId` / `Invoice.treatmentPlanId` — the columns a
 * funnel or reporting query can actually join on — stay in sync with what the
 * JSON has always recorded.
 *
 * Scoped by `clinicId` on both writes: without it, a crafted id from another
 * tenant would silently link a plan to someone else's appointment or invoice.
 * `updateMany` rather than `update` for the same reason `resolveEscalation`
 * uses it — a mismatched clinicId means zero rows matched, not an error.
 *
 * Best-effort: the JSON write is the source of truth for "which stage"; this
 * only keeps the plan-level anchor queryable, so a failure here must not fail
 * the stage update itself.
 */
export interface StageLinkClient {
  appointment: { updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<unknown> };
  invoice: { updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<unknown> };
}

export interface StageLinkParams {
  planId: string;
  clinicId: string | null | undefined;
  appointmentId?: string;
  invoiceId?: string;
}

export async function linkStageReferences(client: StageLinkClient, params: StageLinkParams): Promise<void> {
  const { planId, clinicId, appointmentId, invoiceId } = params;
  if (appointmentId) {
    await client.appointment
      .updateMany({ where: { id: appointmentId, clinicId }, data: { treatmentPlanId: planId } })
      .catch(() => {});
  }
  if (invoiceId) {
    await client.invoice
      .updateMany({ where: { id: invoiceId, clinicId }, data: { treatmentPlanId: planId } })
      .catch(() => {});
  }
}
