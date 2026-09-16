import React from 'react';
import { Activity, ArrowRight, BrainCircuit, FileText, FlaskConical, Package, Stethoscope } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EcosystemRelationRail } from './EcosystemRelationRail';
import { EcosystemActionLauncher } from './EcosystemActionLauncher';
import { cn } from '@/lib/utils';

interface Props { caseId?: string; patientName?: string; diagnosis?: string; className?: string }

export const EcosystemCaseContext: React.FC<Props> = ({ caseId, patientName, diagnosis, className }) => {
  const navigate = useNavigate();
  return <section className={cn('space-y-3', className)}>
    <div className="rounded-3xl border border-bdr-subtle bg-surface-1 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-dv-gold/10 text-dv-gold"><Stethoscope size={19} /></div><div className="min-w-0"><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-txt-muted">Clinical Case</p><h2 className="truncate text-base font-semibold text-txt-primary">{patientName || 'Клинический случай'}</h2><p className="mt-0.5 truncate text-xs text-txt-muted">{diagnosis || 'Диагноз и клинический контекст'}</p></div></div>
        {caseId && <span className="rounded-full border border-bdr-subtle px-2 py-1 text-[10px] text-txt-muted">#{caseId}</span>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[['Диагностика', FlaskConical, '/diagnostics'], ['План лечения', FileText, '/crm/cases'], ['Материалы', Package, '/shop'], ['AI анализ', BrainCircuit, '/ai']].map(([label, Icon, path]) => <button key={String(label)} type="button" onClick={() => navigate(String(path))} className="group flex items-center gap-2 rounded-2xl border border-bdr-subtle bg-surface-2/50 px-3 py-2.5 text-left transition hover:border-dv-gold/30"><Icon size={15} className="shrink-0 text-txt-muted group-hover:text-dv-gold" /><span className="truncate text-xs font-medium text-txt-primary">{String(label)}</span><ArrowRight size={12} className="ml-auto shrink-0 text-txt-muted group-hover:text-dv-gold" /></button>)}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-dv-gold/15 bg-dv-gold/5 px-3 py-2.5"><Activity size={14} className="shrink-0 text-dv-gold" /><p className="text-[10px] leading-4 text-txt-secondary">Контекст кейса связывает диагностику, лечение, лабораторию, материалы и финансовый контур. AI действует только в пределах разрешений.</p></div>
      <div className="mt-3"><EcosystemActionLauncher actionId="create-treatment-plan" /></div>
    </div>
    <EcosystemRelationRail />
  </section>;
};

export default EcosystemCaseContext;
