import React from 'react';
import { ArrowUpRight, GitBranch } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { relationsFrom } from '@/config/ecosystemRelations';
import type { EcosystemNodeId } from '@/config/ecosystemGraph';
import { graphNode } from '@/config/ecosystemGraph';
import { cn } from '@/lib/utils';

interface Props { node?: EcosystemNodeId; title?: string; className?: string }

export const EcosystemRelationRail: React.FC<Props> = ({ node = 'clinical-case', title = 'Связанный контекст', className }) => {
  const navigate = useNavigate();
  const relations = relationsFrom(node);
  return <section className={cn('rounded-3xl border border-bdr-subtle bg-surface-1 p-4', className)}>
    <div className="flex items-center gap-2"><GitBranch size={16} className="text-dv-gold" /><div><h3 className="text-sm font-semibold text-txt-primary">{title}</h3><p className="text-2xs text-txt-muted">Переходы между связанными доменами без потери рабочего контекста.</p></div></div>
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
      {relations.map(relation => {
        const target = graphNode(relation.to);
        return <button key={`${relation.from}-${relation.to}`} type="button" onClick={() => navigate(relation.path)} className="group min-w-40 rounded-2xl border border-bdr-subtle bg-surface-2/50 p-3 text-left transition hover:border-dv-gold/30 hover:bg-surface-2">
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-txt-primary">{relation.label}</span><ArrowUpRight size={14} className="text-txt-muted group-hover:text-dv-gold" /></div>
          <p className="mt-1 text-[10px] leading-4 text-txt-muted">{target?.description || 'Связанный рабочий объект'}</p>
        </button>;
      })}
    </div>
  </section>;
};

export default EcosystemRelationRail;
