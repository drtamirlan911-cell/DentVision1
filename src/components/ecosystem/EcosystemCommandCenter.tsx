import React from 'react';
import { ArrowRight, BrainCircuit, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEcosystemContext } from '@/hooks/useEcosystemContext';
import { useEcosystemActionRegistry } from '@/hooks/useEcosystemActionRegistry';
import { cn } from '@/lib/utils';

interface Props { compact?: boolean; className?: string }

export const EcosystemCommandCenter: React.FC<Props> = ({ compact = false, className }) => {
  const navigate = useNavigate();
  const { context, organizationName, role } = useEcosystemContext();
  const { availableActions } = useEcosystemActionRegistry();
  const actions = availableActions.slice(0, compact ? 4 : 6);

  return <section className={cn('rounded-3xl border border-bdr-subtle bg-surface-1 p-4 shadow-sm', className)}>
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-dv-gold/10 text-dv-gold"><BrainCircuit size={20} /></div>
        <div className="min-w-0">
          <div className="flex items-center gap-2"><h2 className="truncate text-sm font-semibold text-txt-primary">DentVision AI Command Center</h2><ShieldCheck size={14} className="text-txt-muted" /></div>
          <p className="mt-0.5 text-2xs leading-4 text-txt-muted">Контекст: {context?.label || role}{organizationName ? ` · ${organizationName}` : ''}</p>
        </div>
      </div>
      <span className="hidden shrink-0 items-center gap-1 rounded-full border border-bdr-subtle px-2 py-1 text-[10px] text-txt-muted sm:inline-flex"><LockKeyhole size={11} /> Permission-aware</span>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {actions.map(action => <button key={action.id} type="button" onClick={() => navigate(action.path)} className="group flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-bdr-subtle bg-surface-2/50 px-3 py-2.5 text-left transition hover:border-dv-gold/30 hover:bg-surface-2">
        <span className="min-w-0"><span className="block truncate text-xs font-semibold text-txt-primary">{action.label}</span><span className="mt-0.5 block line-clamp-2 text-[10px] leading-4 text-txt-muted">{action.description}</span></span>
        <ArrowRight size={15} className="shrink-0 text-txt-muted transition group-hover:translate-x-0.5 group-hover:text-dv-gold" />
      </button>)}
    </div>
  </section>;
};

export default EcosystemCommandCenter;
