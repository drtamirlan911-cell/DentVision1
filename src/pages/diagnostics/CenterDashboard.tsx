import { DiagnosticWorkspace } from './workspace/DiagnosticWorkspace';

/**
 * Diagnostic-centre workspace.
 *
 * The implementation is shared with the laboratory — the two screens were
 * maintained as separate 786- and 474-line files that shared 381 identical
 * lines once names were normalised. Everything that genuinely differs lives in
 * `workspace/config.ts`. The route and the sidebar entry are unchanged.
 */
export default function CenterDashboard() {
  return <DiagnosticWorkspace kind="CENTER" />;
}
