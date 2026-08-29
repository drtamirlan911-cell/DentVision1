import { DiagnosticWorkspace } from './workspace/DiagnosticWorkspace'

/**
 * The single, role-agnostic entry point behind the sidebar's one "Diagnostics
 * workspace" link (`/center-workspace`). Unlike `CenterDashboard`/`LabDashboard`
 * (which pin `kind`, for deep links and superadmin navigation), this renders
 * `DiagnosticWorkspace` with no pinned kind so it resolves centre vs laboratory
 * from the caller's own membership — see `DiagnosticWorkspace`'s `claimedKind`.
 */
export default function WorkspaceEntry() {
  return <DiagnosticWorkspace />
}
