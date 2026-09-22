import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/store/auth.store';
import DentalLabPlatform from './DentalLabPlatform';
import MedicalLabWorkspace from './MedicalLabWorkspace';
import { DiagnosticWorkspace } from './workspace/DiagnosticWorkspace';

/**
 * The stable `/diagnostics/lab` entry serves two distinct first-class workflows:
 * medical laboratory analysis and dental laboratory production.
 */
export default function LabDashboard() {
  const { user } = useAuth();
  const role = String(user?.effectiveRole || user?.role || '').toLowerCase();
  const [searchParams] = useSearchParams();
  const medicalLab = searchParams.get('workspace') === 'medical-lab' || role.startsWith('medical_lab_');

  if (medicalLab) return <MedicalLabWorkspace />;
  if (user?.organizationType === 'LABORATORY') return <DentalLabPlatform />;
  return <DiagnosticWorkspace kind="LAB" />;
}
