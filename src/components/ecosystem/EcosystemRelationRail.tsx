import React from 'react';
import { ArrowUpRight, GitBranch } from 'lucide-react';
import { useEcosystemContext } from '@/hooks/useEcosystemContext';
import { useEcosystemDeepLinks } from '@/hooks/useEcosystemDeepLinks';
import { cn } from '@/lib/utils';
import type { EcosystemNodeId } from '@/config/ecosystemGraph';
import { graphNode } from '@/config/ecosystemGraph';
import { relationsFrom } from '@/config/ecosystemRelations';

interface Props { node?: EcosystemNodeId; title?: string; className?: string; patientId?: string; caseId?: string; branchId?: string; organizationId?: string }

export const EcosystemRelationRail: React.FC<Props> = ({ node = 'clinical-case', title = 'Связанный контекст', className, patientId, caseId, branchId, organizationId }) => {
  const { organizationName } = useEcosystemContext();
  const { open } = useEcosystemDeepLinks({ patientId, caseId, branchId, organizationId });
  const relations = relationsFrom(node);
  return <section className={cn('rounded-3xl border border-bdr-subtle bg-surface-1 p-4', className)}>
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-dv-gold/10 text-dv-gold"><GitBranch size={15} /></span><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-txt-primary">{title}</h3><p className="truncate text-2xs text-txt-muted">{organizationName || 'DentVision'} · единый рабочий контекст</p></div></div>
      {caseId && <span className="hidden rounded-full border border-dv-gold/20 px-2 py-1 text-[10px] text-dv-gold sm:inline-flex">Case</span>}
    </div>
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
      {relations.map(relation => {
        const target = graphNode(relation.to);
        const targetPath = relation.to === 'diagnostic-referral' || relation.to === 'diagnostic-result' ? 'diagnostics' : relation.to === 'medical-analysis' ? 'medical-lab' : relation.to === 'lab-order' ? 'dental-lab' : relation.to === 'material' ? 'market' : relation.to === 'invoice' ? 'finance' : relation.to === 'clinical-case' ? 'case' : relation.to === 'organization' ? 'ai' : undefined;
        return <button key={`${relation.from}-${relation.to}`} type="button" onClick={() => targetPath ? open(targetPath) : undefined} className="group min-w-40 rounded-2xl border border-bdr-subtle bg-surface-2/50 p-3 text-left transition hover:border-dv-gold/30 hover:bg-surface-2">
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-txt-primary">{relation.label}</span><ArrowUpRight size={14} className="text-txt-muted group-hover:text-dv-gold" /></div>
          <p className="mt-1 text-[10px] leading-4 text-txt-muted">{target?.description || 'Связанный рабочий объект'}</p>
        </button>;
      })}
    </div>
  </section>;
};

export default EcosystemRelationRail;
