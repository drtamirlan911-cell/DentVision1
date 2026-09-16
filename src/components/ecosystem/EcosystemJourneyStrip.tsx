import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ECOSYSTEM_JOURNEYS, ECOSYSTEM_SERVICES } from '@/config/ecosystem';
import { cn } from '@/lib/utils';

interface Props { journeyIds?: string[]; className?: string }

export const EcosystemJourneyStrip: React.FC<Props> = ({ journeyIds, className }) => {
  const navigate = useNavigate();
  const journeys = ECOSYSTEM_JOURNEYS.filter(j => !journeyIds || journeyIds.includes(j.id));
  return <section className={cn('space-y-2', className)}>
    <div className="flex items-center gap-2 px-1"><Sparkles size={15} className="text-dv-gold" /><div><h3 className="text-sm font-semibold text-txt-secondary">Связанные сценарии</h3><p className="text-2xs text-txt-muted">DentVision соединяет рабочие процессы между участниками экосистемы.</p></div></div>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {journeys.map(journey => <button key={journey.id} type="button" onClick={() => navigate(`/?journey=${journey.id}`)} className="group rounded-2xl border border-bdr-subtle bg-surface-1 p-3 text-left transition hover:border-dv-gold/30 hover:bg-surface-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-txt-primary">
          {journey.steps.map((id, index) => { const service = ECOSYSTEM_SERVICES.find(s => s.id === id); return <React.Fragment key={id}><span className="truncate">{service?.label || id}</span>{index < journey.steps.length - 1 && <ArrowRight size={12} className="shrink-0 text-dv-gold" />}</React.Fragment>; })}
        </div>
        <p className="mt-1.5 text-2xs leading-4 text-txt-muted">{journey.description}</p>
        <span className="mt-2 inline-flex text-[10px] font-medium text-dv-gold opacity-80 group-hover:opacity-100">Открыть рабочий контекст</span>
      </button>)}
    </div>
  </section>;
};

export default EcosystemJourneyStrip;
