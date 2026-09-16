import React from 'react';
import { ArrowUpRight, GitBranch } from 'lucide-react';
import { useEcosystemContext } from '@/hooks/useEcosystemContext';
import { useEcosystemDeepLinks } from '@/hooks/useEcosystemDeepLinks';
import { cn } from '@/lib/utils';
import type { EcosystemNodeId } from '@/config/ecosystemGraph';
import { graphNode } from '@/config/ecosystemGraph';
import { relationsFrom } from '@/config/ecosystemRelations';

interface Props {
  node?: EcosystemNodeId;
  title?: string;
  className?: string;
  patientId?: string;
  caseId?: string;
  branchId?: string;
  organizationId?: string;
}

export const EcosystemRelationRail: React.FC<Props> = ({
  node = 'clinical-case', title = 'Связанный контекст', className,
  patientId, caseId, branchId, organizationId,
}) => {
  const { organizationName } = useEcosystemContext();
  const { open } = useEcosystemDeepLinks({ patientId, caseId, branchId, organizationId });
  const relations = relationsFrom(node);

  const targetFor = (relationTo: EcosystemNodeId) => {
    if (relationTo === 'diagnostic-referral' || relationTo === 'diagnostic-result') return 'diagnostics' as const;
    if (relationTo === 'medical-analysis') return 'medical-lab' as const;
    if (relationTo === 'lab-order') return 'dental-lab' as const;
    if (relationTo === 'material') return 'market' as const;
    if (relationTo === 'invoice') return 'finance' as const;
    if (relationTo === 'appointment') return 'appointment' as const;
    if (relationTo === 'clinical-case') return 'case' as const;
    if (relationTo === 'organization') return 'settings' as const;
    return undefined;
  };

  return (
    <section className={cn('rounded-3xl border border-bdr-subtle bg-surface-1 p-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-dv-gold/10 text-dv-gold"><GitBranch size={15} /></span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-txt-primary">{title}</h3>
            <p className="truncate text-2xs text-txt-muted">{organizationName || 'DentVision'} · единый рабочий контекст</p>
          </div>
        </div>
        {caseId && <span className="hidden rounded-full border border-dv-gold/20 px-2 py-1 text-[10px] text-dv-gold sm:inline-flex">Case</span>}
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {relations.map(relation => {
          const target = graphNode(relation.to);
          const targetPath = targetFor(relation.to);
          return (
            <button key={`${relation.from}-${relation.to}`} type="button" disabled={!targetPath}
              onClick={() => targetPath && open(targetPath)}
              className={cn('group min-w-40 rounded-2xl border border-bdr-subtle bg-surface-2/50 p-3 text-left transition hover:border-dv-gold/30 hover:bg-surface-2', !targetPath && 'cursor-default opacity-60')}>
              <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-txt-primary">{relation.label}</span><ArrowUpRight size={14} className="text-txt-muted group-hover:text-dv-gold" /></div>
              <p className="mt-1 text-[10px] leading-4 text-txt-muted">{target?.description || 'Связанный рабочий объект'}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default EcosystemRelationRail;
