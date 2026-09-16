import React from 'react';
import { ArrowRight, Brain, BriefcaseBusiness, FlaskConical, GraduationCap, Package, WalletCards } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEcosystemContext } from '@/hooks/useEcosystemContext';
import { promptsForParticipant } from '@/config/ecosystemPrompts';

const meta: Record<string, { icon: React.ElementType; title: string; description: string }> = {
  'find-provider': { icon: FlaskConical, title: 'Найти партнёра', description: 'Диагностика или лаборатория для текущей задачи' },
  'find-material': { icon: Package, title: 'Подобрать материал', description: 'Материал или оборудование под клинический контекст' },
  'clinical-case': { icon: Brain, title: 'Разобрать клинический кейс', description: 'Выделить недостающие данные и следующий шаг' },
  'lab-order': { icon: FlaskConical, title: 'Проверить лабораторию', description: 'Открытые заказы и сроки' },
  'diagnostic-results': { icon: FlaskConical, title: 'Проверить диагностику', description: 'Готовые и ожидаемые результаты' },
  business: { icon: WalletCards, title: 'Понять бизнес', description: 'Операционные и финансовые задачи' },
  learn: { icon: GraduationCap, title: 'Продолжить обучение', description: 'Следующий материал или курс' },
  career: { icon: BriefcaseBusiness, title: 'Найти возможность', description: 'Вакансия, специалист или связь' },
  market: { icon: Package, title: 'Найти товар', description: 'Материалы и оборудование в Market' },
};

export default function EcosystemNextBestAction({ onPrompt }: { onPrompt?: (prompt: string) => void }) {
  const navigate = useNavigate();
  const { participant } = useEcosystemContext();
  const prompt = promptsForParticipant(participant)[0];
  if (!prompt) return null;
  const item = meta[prompt.id] || { icon: Brain, title: prompt.label, description: 'Действие из текущего рабочего контекста' };
  const Icon = item.icon;

  const run = () => {
    if (onPrompt) onPrompt(prompt.prompt);
    else navigate(`/ai?prompt=${encodeURIComponent(prompt.prompt)}`);
  };

  return (
    <button type="button" onClick={run} className="group flex w-full items-center gap-3 rounded-2xl border border-dv-gold/20 bg-dv-gold/[0.045] p-4 text-left transition hover:border-dv-gold/35 hover:bg-dv-gold/[0.07]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-dv-gold/10 text-dv-gold"><Icon size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-dv-gold">Следующее действие</span>
        <span className="mt-1 block text-sm font-semibold text-txt-primary">{item.title}</span>
        <span className="mt-0.5 block text-xs text-txt-muted">{item.description}</span>
      </span>
      <ArrowRight size={17} className="shrink-0 text-dv-gold transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
