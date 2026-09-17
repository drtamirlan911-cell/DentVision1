import React from 'react';
import { Building2, ChevronRight, UserRound } from 'lucide-react';
import type { User } from '../../types';
import { useEcosystemContext } from '../../hooks/useEcosystemContext';
import { workspaceForParticipant } from '../../config/ecosystemWorkspaces';

interface Props { user?: User | null; compact?: boolean; onSwitchContext?: () => void; }

export default function EcosystemWorkspaceHeader({ user, compact = false, onSwitchContext }: Props) {
  const ecosystem = useEcosystemContext();
  const workspace = workspaceForParticipant(ecosystem.participant);
  const orgName = ecosystem.organizationName || (user?.organizationType ? String(user.organizationType) : undefined);
  return (
    <div className="rounded-2xl border border-bdr-subtle bg-surface-1 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0">
      <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-txt-muted"><span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-dv-gold/10 text-dv-gold">{orgName ? <Building2 size={14} /> : <UserRound size={14} />}</span>{orgName ? 'Рабочий контекст' : 'Персональный контекст'}</div>
      <h2 className="truncate text-lg font-semibold text-txt-primary">{workspace.title}</h2>
      {!compact && <p className="mt-1 max-w-3xl text-sm text-txt-secondary">{workspace.description}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-txt-muted"><span>{orgName || 'Личный профиль'}</span>{ecosystem.role && <><span>•</span><span>{ecosystem.role}</span></>}</div>
    </div>{onSwitchContext && <button type="button" onClick={onSwitchContext} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-bdr-subtle px-3 py-2 text-sm font-medium text-txt-primary transition hover:bg-surface-2">Сменить<ChevronRight size={15} /></button>}</div></div>
  );
}
