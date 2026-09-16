import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/store/auth.store';
import DentalLabPlatform from './DentalLabPlatform';
import { DiagnosticWorkspace } from './workspace/DiagnosticWorkspace';

/**
 * The existing `/diagnostics/lab` route serves two ecosystem contexts:
 * - dental laboratory production (`/crm/lab` remains the canonical production
 *   workspace for clinical lab orders);
 * - medical laboratory analysis/referral operations.
 *
 * Keep the route stable for existing users/bookmarks, but make the workspace
 * explicit for ecosystem deep links instead of silently conflating the two
 * domains.
 */
export default function LabDashboard() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const medicalLab = searchParams.get('workspace') === 'medical-lab';

  if (medicalLab) return <DiagnosticWorkspace kind="LAB" />;
  if (user?.organizationType === 'LABORATORY') return <DentalLabPlatform />;
  return <DiagnosticWorkspace kind="LAB" />;
}
