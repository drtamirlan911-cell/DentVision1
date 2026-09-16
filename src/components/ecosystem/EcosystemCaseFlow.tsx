import React from 'react';
import { ArrowRight, Brain, ClipboardList, FlaskConical, ReceiptText, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import EcosystemContextBridge from './EcosystemContextBridge';
import EcosystemRelationRail from './EcosystemRelationRail';

export interface EcosystemCaseFlowProps {
  patientId?: string;
  caseId?: string;
  branchId?: string;
  organizationId?: string;
  className?: string;
  compact?: boolean;
}

const FLOW = [
  { label: 'Кейс', target: '/crm/cases', icon: ClipboardList },
  { label: 'Диагностика', target: '/diagnostics', icon: FlaskConical },
  { label: 'План', target: '/crm/treatment-plans', icon: ClipboardList },
  { label: 'Лаборатория', target: '/crm/lab', icon: FlaskConical },
  { label: 'Материалы', target: '/shop', icon: ShoppingBag },
  { label: 'Счёт', target: '/crm/cashier', icon: ReceiptText },
  { label: 'AI', target: '/ai', icon: Brain },
] as const;

export default function EcosystemCaseFlow({ patientId, caseId, branchId, organizationId, className, compact = false }: EcosystemCaseFlowProps) {
  const navigate = useNavigate();
  const query = new URLSearchParams();
  if (patientId) query.set('patient', patientId);
  if (caseId) query.set('caseId', caseId);
  if (branchId) query.set('branchId', branchId);
  if (organizationId) query.set('organizationId', organizationId);
  const suffix = query.toString() ? `?${query.toString()}` : '';

  return (
    <section className={cn('space-y-3', className)} aria-label="Связанный рабочий процесс DentVision">
      <EcosystemContextBridge patientId={patientId} caseId={caseId} branchId={branchId} organizationId={organizationId} compact={compact} />
      {!compact && (
        <div className="rounded-2xl border border-bdr-subtle bg-surface-1 p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-txt-primary">Клинический поток</div>
              <div className="text-[11px] text-txt-muted">Один кейс связывает рабочие модули DentVision</div>
            </div>
            <ArrowRight size={14} className="text-dv-gold" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {FLOW.map(({ label, target, icon: Icon }, index) => (
              <React.Fragment key={label}>
                <button
                  type="button"
                  onClick={() => navigate(`${target}${suffix}`)}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-bdr-subtle bg-surface-2 px-2.5 text-[11px] font-medium text-txt-secondary transition hover:border-bdr-focus hover:bg-surface-3 hover:text-txt-primary"
                >
                  <Icon size={13} className={index === 0 ? 'text-dv-gold' : undefined} />
                  {label}
                </button>
                {index < FLOW.length - 1 && <span className="flex items-center text-txt-muted/50">›</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
      {!compact && <EcosystemRelationRail node="clinical-case" patientId={patientId} caseId={caseId} branchId={branchId} organizationId={organizationId} />}
    </section>
  );
}
