import React from 'react';
import { ArrowRight, Building2, GitBranch, Sparkles, UserRound } from 'lucide-react';
import { useEcosystemContext } from '@/hooks/useEcosystemContext';
import { useEcosystemDeepLinks } from '@/hooks/useEcosystemDeepLinks';
import { useEcosystemActionRegistry } from '@/hooks/useEcosystemActionRegistry';
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
  const { availableActions } = useEcosystemActionRegistry();
  const contextLabel = organizationName || (hasOrganization || hasClinic ? 'Рабочий контекст' : 'Личный контекст');
  const contextState = [patientId && 'пациент', caseId && 'кейс', branchId && 'филиал'].filter(Boolean).join(' · ');
  const actions = availableActions.slice(0, compact ? 2 : 3);

  return (
    <section className={cn('rounded-2xl border border-bdr-subtle bg-surface-1 px-3 py-2.5', className)}>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-dv-gold/10 text-dv-gold">
          {organizationName ? <Building2 size={15} /> : <UserRound size={15} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-txt-primary">{contextLabel}</div>
          <div className="truncate text-[10px] text-txt-muted">{role || participant}{contextState ? ` · ${contextState}` : ''}</div>
        </div>
        <div className="flex items-center gap-1.5">
          {!compact && <button type="button" onClick={() => open('ai')} className="inline-flex items-center gap-1.5 rounded-xl border border-dv-gold/20 px-2.5 py-2 text-[10px] font-medium text-txt-secondary hover:border-dv-gold/35 hover:text-dv-gold"><Sparkles size={12} /> AI</button>}
          <button type="button" onClick={() => open(caseId ? 'case' : patientId ? 'patient' : 'ai')} className="inline-flex items-center gap-1 text-[10px] text-txt-muted hover:text-dv-gold">Открыть <ArrowRight size={12} /></button>
        </div>
      </div>
      {actions.length > 0 && !compact && (
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto border-t border-bdr-subtle pt-2.5">
          {actions.map(action => (
            <button key={action.id} type="button" onClick={() => open(action.id === 'find-provider' ? 'diagnostics' : action.id === 'find-material' ? 'market' : 'ai')} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[10px] text-txt-secondary hover:text-txt-primary">
              <GitBranch size={11} className="text-dv-gold" /> {action.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
