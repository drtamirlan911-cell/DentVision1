import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '@/utils/api';

export type AIEmployeeTaskState =
  | 'queued' | 'observing' | 'proposed' | 'awaiting_approval' | 'executing'
  | 'verified' | 'completed' | 'failed' | 'cancelled';

export interface AIEmployeeTask {
  id: string;
  title: string;
  description?: string | null;
  state: AIEmployeeTaskState;
  status?: AIEmployeeTaskState;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  risk?: 'low' | 'medium' | 'high' | 'critical';
  employeeTitle?: string;
  sourceEventType?: string | null;
  action?: string | null;
  dueAt?: string | null;
  result?: unknown;
  error?: string | null;
}

const stateLabel: Record<AIEmployeeTaskState, string> = {
  queued: 'В очереди', observing: 'Анализ', proposed: 'Предложено',
  awaiting_approval: 'Нужно подтверждение', executing: 'Выполняется',
  verified: 'Проверено', completed: 'Готово', failed: 'Ошибка', cancelled: 'Отменено',
};

const priorityLabel: Record<NonNullable<AIEmployeeTask['priority']>, string> = {
  low: 'Низкий', normal: 'Обычный', high: 'Высокий', urgent: 'Срочно',
};

const riskLabel: Record<NonNullable<AIEmployeeTask['risk']>, string> = {
  low: 'Низкий риск', medium: 'Средний риск', high: 'Высокий риск', critical: 'Критический риск',
};

function normalizeTask(task: any): AIEmployeeTask {
  return { ...task, state: task.state || task.status || 'queued' };
}

export function AIEmployeeTaskPanel({
  tasks: providedTasks,
  onApprove,
}: {
  tasks?: AIEmployeeTask[];
  onApprove?: (task: AIEmployeeTask) => void;
}) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<AIEmployeeTask[]>(providedTasks || []);
  const [loading, setLoading] = useState(!providedTasks);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (providedTasks) return;
    try {
      setError(null);
      const response = await apiRequest('/api/ai/approvals/tasks?limit=12');
      // apiRequest unwraps the standard { ok, data } envelope and returns data directly.
      const data = Array.isArray(response) ? response : [];
      setTasks(data.map(normalizeTask));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить задачи AI');
    } finally {
      setLoading(false);
    }
  }, [providedTasks]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (providedTasks) setTasks(providedTasks.map(normalizeTask));
  }, [providedTasks]);

  const actionable = tasks.filter((task) => task.state === 'awaiting_approval');
  const active = tasks.filter((task) => !['completed', 'cancelled'].includes(task.state));

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pt-3 sm:px-6" aria-label="AI Employee tasks">
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-dv-gold" />
              <h2 className="txt-primary text-sm font-semibold">Рабочий контур AI</h2>
              {active.length > 0 && <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] txt-muted">{active.length}</span>}
            </div>
            <p className="txt-muted mt-0.5 text-[10px]">AI наблюдает, предлагает и выполняет разрешённые задачи с контролем результата.</p>
          </div>
          <button type="button" onClick={() => navigate('/ai-approvals')} className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] txt-muted hover:bg-white/5">
            Все задачи <ExternalLink size={11} className="ml-1 inline" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-5 text-xs txt-muted"><Loader2 size={14} className="animate-spin" /> Загрузка рабочего контура…</div>
        ) : error ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-400/10 bg-red-400/5 p-3 text-xs text-red-300"><AlertTriangle size={14} /> {error}</div>
        ) : tasks.length === 0 ? (
          <div className="mt-3 rounded-xl border border-white/10 p-3 text-xs txt-muted">Активных задач нет. AI продолжает наблюдать за рабочими событиями.</div>
        ) : (
          <div className="mt-3 space-y-2">
            {tasks.map((task) => (
              <article key={task.id} className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">{task.state === 'completed' || task.state === 'verified' ? <CheckCircle2 size={15} className="text-emerald-400" /> : <Clock3 size={15} className="txt-muted" />}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="txt-primary text-xs font-medium">{task.title}</h3>
                      <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] txt-muted">{stateLabel[task.state]}</span>
                    </div>
                    {task.description && <p className="txt-muted mt-1 text-[10px] leading-relaxed">{task.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[9px] txt-muted">
                      {task.employeeTitle && <span>{task.employeeTitle}</span>}
                      {task.sourceEventType && <span>· {task.sourceEventType}</span>}
                      <span>· {task.priority ? priorityLabel[task.priority] : 'Обычный'}</span>
                      {task.risk && <span>· {riskLabel[task.risk]}</span>}
                    </div>
                    {task.error && <p className="mt-2 text-[10px] text-red-300">{task.error}</p>}
                  </div>
                  {task.state === 'awaiting_approval' && (
                    <button type="button" onClick={() => onApprove ? onApprove(task) : navigate('/ai-approvals')} className="shrink-0 rounded-lg border border-dv-gold/30 px-2.5 py-1.5 text-[10px] font-medium text-dv-gold hover:bg-dv-gold/10">
                      Решить
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {actionable.length > 0 && (
          <div className="mt-2 text-[9px] txt-muted">{actionable.length} задач требуют решения человека. Клинические и критические действия не выполняются автоматически.</div>
        )}
      </div>
    </section>
  );
}

export default AIEmployeeTaskPanel;
