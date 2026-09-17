import React from 'react';
import { ArrowUpRight, BarChart3, Bot, BriefcaseBusiness, Building2, FlaskConical, GraduationCap, Package, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEcosystemContext } from '../../hooks/useEcosystemContext';
import { workspaceForParticipant, type WorkspaceAction } from '../../config/ecosystemWorkspaces';

const icons = {
  'open-ai': Bot, today: Building2, patients: Users, cases: BriefcaseBusiness, diagnostics: FlaskConical,
  'medical-lab': FlaskConical, 'dental-lab': FlaskConical, materials: Package, finance: Building2, team: Users,
  academy: GraduationCap, jobs: BriefcaseBusiness, network: Users, orders: Package, catalog: Package, branches: Building2,
  analytics: BarChart3,
} as const;

function ActionCard({ item, onNavigate }: { item: WorkspaceAction; onNavigate: (path: string) => void }) {
  const Icon = icons[item.id] || ArrowUpRight;
  return <button type="button" onClick={() => onNavigate(item.path)} className="group flex min-h-24 flex-col justify-between rounded-2xl border border-bdr-subtle bg-surface-1 p-4 text-left transition hover:-translate-y-0.5 hover:border-dv-gold/30 hover:bg-surface-2"><div className="flex items-start justify-between gap-3"><span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-dv-gold/10 text-dv-gold"><Icon size={18} /></span><ArrowUpRight size={16} className="text-txt-muted transition group-hover:text-txt-primary" /></div><div><div className="mt-3 text-sm font-semibold text-txt-primary">{item.label}</div><div className="mt-1 line-clamp-2 text-xs text-txt-muted">{item.description}</div></div></button>;
}

export default function EcosystemQuickActions({ limit = 6 }: { limit?: number }) {
  const navigate = useNavigate(); const { participant } = useEcosystemContext(); const workspace = workspaceForParticipant(participant);
  return <section><div className="mb-3 flex items-end justify-between gap-3"><div><h3 className="text-base font-semibold text-txt-primary">Быстрые действия</h3><p className="mt-1 text-sm text-txt-muted">Следующие действия для вашего рабочего контекста.</p></div></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{workspace.actions.slice(0, limit).map(item => <ActionCard key={item.id} item={item} onNavigate={navigate} />)}</div></section>;
}
