import React from 'react';
import type { User } from '../../types';
import EcosystemWorkspaceHeader from './EcosystemWorkspaceHeader';
import EcosystemMetrics from './EcosystemMetrics';
import EcosystemQuickActions from './EcosystemQuickActions';
import EcosystemJourneyStrip from './EcosystemJourneyStrip';

interface Props {
  user?: User | null;
  metricValues?: Partial<Record<'active-cases' | 'pending-results' | 'open-orders' | 'today-appointments' | 'unread-dialogs' | 'finance' | 'turnaround' | 'students' | 'jobs' | 'inventory' | 'network', string | number>>;
  compact?: boolean;
  onSwitchContext?: () => void;
  showJourneys?: boolean;
}

export default function EcosystemWorkspace({
  user,
  metricValues,
  compact = false,
  onSwitchContext,
  showJourneys = true,
}: Props) {
  return (
    <div className="space-y-6">
      <EcosystemWorkspaceHeader user={user} compact={compact} onSwitchContext={onSwitchContext} />
      <EcosystemMetrics values={metricValues} />
      <EcosystemQuickActions />
      {showJourneys && <EcosystemJourneyStrip />}
    </div>
  );
}
