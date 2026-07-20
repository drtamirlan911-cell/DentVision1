import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bot, Brain, Scan, Bone, AlignCenter, Syringe, FlaskConical,
  Wallet, Headset, Megaphone, ArrowRight, Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Badge } from '@/components/ui/ds/Badge';
import { PageHeader } from '@/components/ui/ds/StatCard';

/** Spec §04 agent roster — routes explicit agent intent into AI Workspace */
const AGENTS = [
  { id: 'agent.dental', name: 'Dental AI', role: 'Клинический оркестратор', Icon: Brain, prompt: 'Dental AI: помоги с клиническим кейсом' },
  { id: 'agent.radiology', name: 'Radiology AI', role: 'Снимки и red flags', Icon: Scan, prompt: 'Radiology AI: разбери снимок' },
  { id: 'agent.orthopedic', name: 'Orthopedic AI', role: 'Ортопедия и конструкции', Icon: Bone, prompt: 'Orthopedic AI: план протезирования' },
  { id: 'agent.orthodontic', name: 'Orthodontic AI', role: 'Ортодонтия', Icon: AlignCenter, prompt: 'Orthodontic AI: оценка ортодонтического случая' },
  { id: 'agent.therapy', name: 'Therapy AI', role: 'Терапия и реставрации', Icon: Syringe, prompt: 'Therapy AI: протокол лечения кариеса' },
  { id: 'agent.endodontic', name: 'Endodontic AI', role: 'Эндодонтия', Icon: Sparkles, prompt: 'Endodontic AI: эндодонтический план' },
  { id: 'agent.laboratory', name: 'Laboratory AI', role: 'Лабораторные заказы', Icon: FlaskConical, prompt: 'Laboratory AI: статус лаборатории' },
  { id: 'agent.finance', name: 'Finance AI', role: 'Финансы и долги', Icon: Wallet, prompt: 'Finance AI: покажи выручку и долги' },
  { id: 'agent.reception', name: 'Reception AI', role: 'Запись и no-show', Icon: Headset, prompt: 'Reception AI: неподтверждённые записи на сегодня' },
  { id: 'agent.marketing', name: 'Marketing AI', role: 'Акции и реактивация', Icon: Megaphone, prompt: 'Marketing AI: кого реактивировать' },
] as const;

export default function AITeam() {
  const navigate = useNavigate();
  const [active, setActive] = useState<string | null>(null);

  const openAgent = (prompt: string, id: string) => {
    setActive(id);
    navigate('/', { state: { aiQuery: prompt } });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-6 p-4 md:p-6"
    >
      <PageHeader
        title="AI Команда"
        subtitle="10 специализированных агентов · единый AI Workspace"
        icon={<Bot size={20} />}
        actions={
          <Button size="sm" onClick={() => navigate('/')}>
            Открыть Workspace
            <ArrowRight size={14} className="ml-1.5" />
          </Button>
        }
      />

      <p className="text-sm text-txt-secondary max-w-2xl">
        Агенты не живут в отдельных чатах. Вызовите специалиста — диалог продолжится в Intelligence с памятью и правами доступа.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {AGENTS.map((agent) => {
          const Icon = agent.Icon;
          const isActive = active === agent.id;
          return (
            <Card
              key={agent.id}
              className={`transition-colors hover:border-dv-gold/30 ${isActive ? 'border-dv-gold/40 bg-dv-gold/5' : ''}`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dv-gold/10 text-dv-gold">
                    <Icon size={18} />
                  </div>
                  <Badge variant="gold" size="xs">{agent.id.replace('agent.', '')}</Badge>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-txt-primary">{agent.name}</h3>
                  <p className="text-xs text-txt-muted mt-0.5">{agent.role}</p>
                </div>
                <Button size="sm" variant="secondary" className="w-full" onClick={() => openAgent(agent.prompt, agent.id)}>
                  Спросить агента
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </motion.div>
  );
}
