import React from 'react';
import EcosystemWorkspaceHeader from './EcosystemWorkspaceHeader';
import EcosystemMetrics from './EcosystemMetrics';
import EcosystemQuickActions from './EcosystemQuickActions';
import EcosystemCommandCenter from './EcosystemCommandCenter';
import EcosystemJourneyStrip from './EcosystemJourneyStrip';
import { cn } from '@/lib/utils';

interface Props { className?: string; showCommandCenter?: boolean; showJourneys?: boolean; children?: React.ReactNode }

export const EcosystemWorkspaceShell: React.FC<Props> = ({ className, showCommandCenter = true, showJourneys = true, children }) => <div className={cn('space-y-5', className)}>
  <EcosystemWorkspaceHeader />
  {showCommandCenter && <EcosystemCommandCenter />}
  <EcosystemMetrics />
  <EcosystemQuickActions />
  {children}
  {showJourneys && <EcosystemJourneyStrip />}
</div>;

export default EcosystemWorkspaceShell;
