import React from 'react';
import { ArrowRight, CircleCheck, LockKeyhole } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEcosystemActionRegistry, type EcosystemActionId } from '@/hooks/useEcosystemActionRegistry';
import { resolveEcosystemRoute } from '@/config/ecosystemRouteResolver';
import { cn } from '@/lib/utils';

interface Props { actionId: EcosystemActionId; className?: string; showDescription?: boolean }

export const EcosystemActionLauncher: React.FC<Props> = ({ actionId, className, showDescription = true }) => {
  const navigate = useNavigate();
  const { canOffer, availableActions } = useEcosystemActionRegistry();
  const action = availableActions.find(item => item.id === actionId);

  if (!action || !canOffer(actionId)) return null;

  return <button type="button" onClick={() => navigate(resolveEcosystemRoute(action.path))} className={cn('group flex w-full items-center justify-between gap-3 rounded-2xl border border-bdr-subtle bg-surface-1 px-3 py-3 text-left transition hover:border-dv-gold/30 hover:bg-surface-2', className)}>
    <span className="flex min-w-0 items-start gap-2.5">
      <CircleCheck size={16} className="mt-0.5 shrink-0 text-dv-gold" />
      <span className="min-w-0"><span className="block truncate text-xs font-semibold text-txt-primary">{action.label}</span>{showDescription && <span className="mt-0.5 block text-[10px] leading-4 text-txt-muted">{action.description}</span>}</span>
    </span>
    <span className="flex shrink-0 items-center gap-1 text-[10px] text-txt-muted"><LockKeyhole size={11} /> {action.risk === 'confirm' ? 'Подтверждение' : action.risk === 'privileged' ? 'Доступ' : 'Открыть'} <ArrowRight size={13} className="transition group-hover:translate-x-0.5 group-hover:text-dv-gold" /></span>
  </button>;
};

export default EcosystemActionLauncher;
