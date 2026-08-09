import { DiagnosticWorkspace } from './workspace/DiagnosticWorkspace';

/** Laboratory workspace — see CenterDashboard and workspace/config.ts. */
export default function LabDashboard() {
  return <DiagnosticWorkspace kind="LAB" />;
}
