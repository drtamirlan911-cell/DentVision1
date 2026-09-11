import { useAuth } from '@/store/auth.store';
import DentalLabPlatform from './DentalLabPlatform';
import { DiagnosticWorkspace } from './workspace/DiagnosticWorkspace';

/**
 * LABORATORY organizations get the dedicated dental-production workspace.
 * Diagnostic-center administration keeps the existing shared LAB workspace.
 */
export default function LabDashboard() {
  const { user } = useAuth();
  if (user?.organizationType === 'LABORATORY') return <DentalLabPlatform />;
  return <DiagnosticWorkspace kind="LAB" />;
}
