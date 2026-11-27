import type { ReactNode } from 'react';
import { ArrowRight, CheckCircle2, UserRound } from 'lucide-react';

import { Badge } from '@/components/ui/ds/Badge';
import { Button } from '@/components/ui/ds/Button';
import { Card } from '@/components/ui/ds/Card';

export interface WorkspaceRoleStartProps {
  roleLabel: string;
  heading: string;
  description: string;
  steps: string[];
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: ReactNode;
  className?: string;
}

/**
 * A compact, role-first entry point for partner workspaces.
 *
 * It explains the employee's responsibility and the real workflow before
 * exposing the domain's full navigation. It does not grant capabilities:
 * callers must derive all actions from server-backed permissions.
 */
export function WorkspaceRoleStart({
  roleLabel,
  heading,
  description,
  steps,
  actionLabel,
  onAction,
  actionIcon,
  className,
}: WorkspaceRoleStartProps) {
  return (
    <Card padding="md" className={['border-bdr-subtle bg-surface-1', className].filter(Boolean).join(' ')}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.72fr)] lg:items-center">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline"><UserRound size={12} className="mr-1 inline" />Ваша роль: {roleLabel}</Badge>
            <span className="text-[11px] font-medium uppercase tracking-wide text-txt-muted">Рабочий маршрут</span>
          </div>
          <h2 className="text-base font-semibold text-txt-primary">{heading}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-txt-secondary">{description}</p>
          {actionLabel && onAction && (
            <Button size="sm" className="mt-3 min-h-10" onClick={onAction}>
              {actionIcon || <ArrowRight size={14} />}
              {actionLabel}
            </Button>
          )}
        </div>
        <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {steps.slice(0, 3).map((step, index) => (
            <li key={`${index}-${step}`} className="flex min-w-0 items-start gap-2 rounded-lg bg-surface-2/70 px-3 py-2">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-dv-gold" />
              <span className="text-xs leading-5 text-txt-secondary">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}

export default WorkspaceRoleStart;
