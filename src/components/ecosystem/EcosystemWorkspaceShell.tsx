import React from 'react';
import EcosystemWorkspaceHeader from './EcosystemWorkspaceHeader';
import EcosystemMetrics from './EcosystemMetrics';
import EcosystemQuickActions from './EcosystemQuickActions';
import EcosystemCommandCenter from './EcosystemCommandCenter';
import EcosystemNextBestAction from './EcosystemNextBestAction';
import EcosystemJourneyStrip from './EcosystemJourneyStrip';
import EcosystemCaseFlow from './EcosystemCaseFlow';
import { useEcosystemUrlContext } from '@/hooks/useEcosystemUrlContext';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  showCommandCenter?: boolean;
  showNextBestAction?: boolean;
  showJourneys?: boolean;
  showCaseFlow?: boolean;
  children?: React.ReactNode;
}

export const EcosystemWorkspaceShell: React.FC<Props> = ({
  className,
  showCommandCenter = true,
  showNextBestAction = true,
  showJourneys = true,
  showCaseFlow = true,
  children,
}) => {
  const context = useEcosystemUrlContext();
  const hasClinicalContext = Boolean(context.patientId || context.caseId);

  return (
    <div className={cn('space-y-5', className)}>
      <EcosystemWorkspaceHeader />
      {showCommandCenter && <EcosystemCommandCenter />}
      {showNextBestAction && <EcosystemNextBestAction />}
      {showCaseFlow && hasClinicalContext && (
        <EcosystemCaseFlow
          patientId={context.patientId}
          caseId={context.caseId}
          branchId={context.branchId}
          organizationId={context.organizationId}
          compact
        />
      )}
      <EcosystemMetrics />
      <EcosystemQuickActions />
      {children}
      {showJourneys && <EcosystemJourneyStrip />}
    </div>
  );
};

export default EcosystemWorkspaceShell;
