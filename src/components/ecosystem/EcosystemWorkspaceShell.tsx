import React from 'react';
import EcosystemWorkspaceHeader from './EcosystemWorkspaceHeader';
import EcosystemMetrics from './EcosystemMetrics';
import EcosystemQuickActions from './EcosystemQuickActions';
import EcosystemCommandCenter from './EcosystemCommandCenter';
import EcosystemNextBestAction from './EcosystemNextBestAction';
import EcosystemJourneyStrip from './EcosystemJourneyStrip';
import EcosystemClinicalContext from './EcosystemClinicalContext';
import { cn } from '@/lib/utils';

interface Props { className?: string; showCommandCenter?: boolean; showNextBestAction?: boolean; showJourneys?: boolean; showClinicalContext?: boolean; children?: React.ReactNode }

export const EcosystemWorkspaceShell: React.FC<Props> = ({ className, showCommandCenter = true, showNextBestAction = true, showJourneys = true, showClinicalContext = true, children }) => <div className={cn('space-y-5', className)}>
  <EcosystemWorkspaceHeader />
  {showCommandCenter && <EcosystemCommandCenter />}
  {showNextBestAction && <EcosystemNextBestAction />}
  {showClinicalContext && <EcosystemClinicalContext />}
  <EcosystemMetrics />
  <EcosystemQuickActions />
  {children}
  {showJourneys && <EcosystemJourneyStrip />}
</div>;

export default EcosystemWorkspaceShell;
