import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/store/auth.store';
import { resolveLaboratoryWorkspaceKind } from '@/lib/laboratoryWorkspace';
import DentalLabPlatform from './DentalLabPlatform';
import MedicalLabWorkspace from './MedicalLabWorkspace';
import { DiagnosticWorkspace } from './workspace/DiagnosticWorkspace';

/**
 * The stable `/diagnostics/lab` entry serves two distinct first-class workflows:
 * medical laboratory analysis and dental laboratory production.
 */
export default function LabDashboard() {
  const { user, activeWorkspace } = useAuth();
  const [searchParams] = useSearchParams();
  const workspaceKind = resolveLaboratoryWorkspaceKind({
    workspaceParam: searchParams.get('workspace'),
    roleKey: activeWorkspace?.roleKey || activeWorkspace?.role,
    effectiveRole: user?.effectiveRole || user?.role,
    organizationType: activeWorkspace?.scopeType || user?.organizationType,
  });

  if (workspaceKind === 'medical') return <MedicalLabWorkspace />;
  if (workspaceKind === 'dental') return <DentalLabPlatform />;
  return <DiagnosticWorkspace kind="LAB" />;
}
