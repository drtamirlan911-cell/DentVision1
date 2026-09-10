import React from 'react';

export type AIEmployeeTaskState =
  | 'queued'
  | 'observing'
  | 'proposed'
  | 'awaiting_approval'
  | 'executing'
  | 'verified'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AIEmployeeTask {
  id: string;
  title: string;
  description?: string;
  state: AIEmployeeTaskState;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  requiresApproval?: boolean;
}

const stateLabel: Record<AIEmployeeTaskState, string> = {
  queued: 'В очереди',
  observing: 'Анализ',
  proposed: 'Предложено',
  awaiting_approval: 'Нужно подтверждение',
  executing: 'Выполняется',
  verified: 'Проверено',
  completed: 'Готово',
  failed: 'Ошибка',
  cancelled: 'Отменено',
};

const priorityLabel: Record<NonNullable<AIEmployeeTask['priority']>, string> = {
  low: 'Низкий',
  normal: 'Обычный',
  high: 'Высокий',
  urgent: 'Срочно',
};

export function AIEmployeeTaskPanel({
  tasks,
  onApprove,
}: {
  tasks: AIEmployeeTask[];
  onApprove?: (task: AIEmployeeTask) => void;
}) {
  const actionable = tasks.filter((task) => task.state === 'awaiting_approval');

  return (
    <section className="space-y-3" aria-label="AI Employee tasks">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="txt-primary text-sm font-semibold">Рабочие задачи AI</h2>
          <p className="txt-muted text-xs">Наблюдение, решения, действия и контроль результата</p>
        </div>
        {actionable.length > 0 && (
          <span className="dv-gold text-xs font-medium">{actionable.length} требуют решения</span>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="border border-white/10 rounded-xl p-4 text-xs txt-muted">
          Активных задач нет. AI продолжает наблюдать за рабочими событиями.
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <article key={task.id} className="border border-white/10 rounded-xl p-3 bg-black/10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="txt-primary text-sm font-medium truncate">{task.title}</h3>
                  {task.description && <p className="txt-muted mt-1 text-xs">{task.description}</p>}
                </div>
                <span className="text-[11px] txt-muted whitespace-nowrap">{stateLabel[task.state]}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] txt-muted">
                  {task.priority ? priorityLabel[task.priority] : 'Обычный'}
                </span>
                {task.state === 'awaiting_approval' && task.requiresApproval && onApprove && (
                  <button
                    type="button"
                    onClick={() => onApprove(task)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium dv-gold border border-white/10 hover:bg-white/5 transition"
                  >
                    Подтвердить
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default AIEmployeeTaskPanel;
