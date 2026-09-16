import React from 'react';
import { Activity, BarChart3, CalendarDays, ClipboardList, FlaskConical, GraduationCap, Package, Users } from 'lucide-react';
import { useEcosystemContext } from '../../hooks/useEcosystemContext';
import { workspaceForParticipant, type WorkspaceMetric } from '../../config/ecosystemWorkspaces';

interface Props {
  values?: Partial<Record<WorkspaceMetric['id'], string | number>>;
}

const icons = {
  'active-cases': Activity,
  'pending-results': FlaskConical,
  'open-orders': ClipboardList,
  'today-appointments': CalendarDays,
  'unread-dialogs': Users,
  finance: BarChart3,
  turnaround: Activity,
  students: GraduationCap,
  jobs: Users,
  inventory: Package,
  network: Users,
} as const;

export default function EcosystemMetrics({ values = {} }: Props) {
  const { participant } = useEcosystemContext();
  const workspace = workspaceForParticipant(participant);

  return (
    <section>
      <div className="mb-3">
        <h3 className="text-base font-semibold text-foreground">Контур рабочего пространства</h3>
        <p className="mt-1 text-sm text-muted-foreground">Метрики показываются только при наличии реальных данных.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {workspace.metrics.map((item) => {
          const Icon = icons[item.id] || Activity;
          const value = values[item.id];
          return (
            <div key={item.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</span>
                <Icon size={16} className="text-muted-foreground" />
              </div>
              <div className="mt-3 text-2xl font-semibold text-foreground">{value ?? '—'}</div>
              <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
