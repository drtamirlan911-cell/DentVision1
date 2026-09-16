import React from 'react';
import { ArrowRight, Brain, Building2, CreditCard, FlaskConical, GraduationCap, Package, ScanLine, Stethoscope } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CLINICAL_WORKFLOW, graphNode, type EcosystemNodeId } from '@/config/ecosystemGraph';
import { ECOSYSTEM_SERVICES } from '@/config/ecosystem';

const icons: Partial<Record<EcosystemNodeId, React.ElementType>> = {
  patient: Building2,
  'clinical-case': Stethoscope,
  'diagnostic-referral': ScanLine,
  'diagnostic-result': FlaskConical,
  'treatment-plan': Stethoscope,
  appointment: Stethoscope,
  'lab-order': FlaskConical,
  material: Package,
  invoice: CreditCard,
};

const paths: Partial<Record<EcosystemNodeId, string>> = {
  patient: '/crm/patients',
  'clinical-case': '/crm/treatment-plans',
  'diagnostic-referral': '/diagnostics',
  'diagnostic-result': '/diagnostics',
  'treatment-plan': '/crm/treatment-plans',
  appointment: '/crm/schedule',
  'lab-order': '/crm/lab',
  material: '/shop',
  invoice: '/crm/cashier',
};

export default function EcosystemWorkflowMap({ activeNode }: { activeNode?: EcosystemNodeId }) {
  const navigate = useNavigate();

  return (
    <section className="rounded-2xl border border-bdr-subtle bg-surface-1 p-4" aria-label="Clinical ecosystem workflow">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-dv-gold/10 text-dv-gold"><Brain size={18} /></span>
        <div>
          <h3 className="text-sm font-semibold text-txt-primary">Сквозной клинический контур</h3>
          <p className="mt-1 text-xs leading-5 text-txt-muted">Один кейс связывает диагностику, лечение, лабораторию, материалы и расчёты. Каждый этап сохраняет свой источник данных и права доступа.</p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        <div className="flex min-w-max items-stretch gap-2">
          {CLINICAL_WORKFLOW.map((id, index) => {
            const node = graphNode(id)!;
            const Icon = icons[id] || GraduationCap;
            const service = ECOSYSTEM_SERVICES.find(item => item.id === node.service);
            const path = paths[id];
            const active = activeNode === id;
            const content = (
              <div className={`w-40 rounded-xl border p-3 text-left transition ${active ? 'border-dv-gold/40 bg-dv-gold/10' : 'border-bdr-subtle bg-surface-2 hover:border-dv-gold/25'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-dv-gold/10 text-dv-gold"><Icon size={15} /></span>
                  <span className="text-[9px] uppercase tracking-wide text-txt-ghost">{service?.label || node.service}</span>
                </div>
                <div className="mt-2 text-xs font-semibold text-txt-primary">{node.label}</div>
                <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-txt-muted">{node.description}</div>
              </div>
            );
            return <React.Fragment key={id}>{path ? <button type="button" onClick={() => navigate(path)}>{content}</button> : content}{index < CLINICAL_WORKFLOW.length - 1 && <ArrowRight size={14} className="mt-7 shrink-0 text-dv-gold/70" />}</React.Fragment>;
          })}
        </div>
      </div>
    </section>
  );
}
