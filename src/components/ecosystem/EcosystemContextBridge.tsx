import React from 'react';
import { ArrowRight, Building2, GitBranch, UserRound } from 'lucide-react';
import { useEcosystemContext } from '@/hooks/useEcosystemContext';
import { useEcosystemDeepLinks } from '@/hooks/useEcosystemDeepLinks';
import { cn } from '@/lib/utils';

export interface EcosystemContextBridgeProps {
  patientId?: string;
  caseId?: string;
  branchId?: string;
  organizationId?: string;
  className?: string;
  compact?: boolean;
}

export default function EcosystemContextBridge({ patientId, caseId, branchId, organizationId, className, compact = false }: EcosystemContextBridgeProps) {
  const { participant, organizationName, role, hasOrganization, hasClinic } = useEcosystemContext();
  const { open } = useEcosystemDeepLinks({ patientId, caseId, branchId, organizationId });
  const contextLabel = organizationName || (hasOrganization || hasClinic ? 'Рабочий контекст' : 'Личный контекст');

  return <div className={cn('flex flex-wrap items-center gap-2 rounded-2xl border border-bdr-subtle bg-surface-1 px-3 py-2.5', className)}>
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-dv-gold/10 text-dv-gold">{organizationName ? <Building2 size={15} /> : <UserRound size={15} />}</span>
    <div className="min-w-0 flex-1">
      <div className="truncate text-xs font-semibold text-txt-primary">{contextLabel}</div>
      <div className="truncate text-[10px] text-txt-muted">{role || participant}{branchId ? ' · филиал выбран' : ''}{caseId ? ' · кейс выбран' : ''}</div>
    </div>
    {!compact && <button type="button" onClick={() => open('ai')} className="inline-flex items-center gap-1.5 rounded-xl border border-dv-gold/20 px-2.5 py-2 text-[10px] font-medium text-txt-secondary hover:border-dv-gold/35 hover:text-dv-gold"><GitBranch size={12} /> AI</button>}
    <button type="button" onClick={() => open(caseId ? 'case' : patientId ? 'patient' : 'ai')} className="inline-flex items-center gap-1 text-[10px] text-txt-muted hover:text-dv-gold">Открыть <ArrowRight size={12} /></button>
  </div>;
}
