import React from 'react';
import { ChevronDown, ChevronUp, GitBranch } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import EcosystemCaseFlow from './EcosystemCaseFlow';

interface Props {
  patientId?: string;
  caseId?: string;
  branchId?: string;
  organizationId?: string;
}

export default function EcosystemContextDock({ patientId, caseId, branchId, organizationId }: Props) {
  const location = useLocation();
  const [open, setOpen] = React.useState(false);

  const hasContext = Boolean(patientId || caseId);
  const supportedRoute = /^(\/crm\/(patients|dental-chart|treatment-plans|lab|cashier|schedule|visits|medical-card)|\/diagnostics|\/shop|\/ai)/.test(location.pathname);

  if (!hasContext || !supportedRoute) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 hidden px-4 lg:block">
      <div className="mx-auto flex max-w-7xl justify-end">
        <div className="pointer-events-auto w-full max-w-3xl rounded-2xl border border-dv-gold/20 bg-surface-0/95 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
            aria-expanded={open}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-dv-gold/10 text-dv-gold">
              <GitBranch size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-txt-primary">Clinical Case Context</span>
              <span className="block truncate text-[10px] text-txt-muted">Кейс связан с диагностикой, планом, лабораторией, материалами, финансами и AI</span>
            </span>
            {caseId && <span className="hidden rounded-full border border-dv-gold/20 px-2 py-1 text-[10px] text-dv-gold sm:inline-flex">Case</span>}
            <span className={cn('grid h-7 w-7 place-items-center rounded-lg text-txt-muted transition', open && 'bg-surface-2 text-txt-primary')}>
              {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </span>
          </button>
          {open && (
            <div className="border-t border-bdr-subtle p-3">
              <EcosystemCaseFlow
                patientId={patientId}
                caseId={caseId}
                branchId={branchId}
                organizationId={organizationId}
                compact={false}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
