import { useState } from 'react'
import { Workflow as WorkflowIcon, Plus, Play, Trash2, GripVertical, Sparkles } from 'lucide-react'
import {
  Card, CardHeader, CardTitle, CardContent, Button, Badge, Modal, Input, Select,
  DataTable, EmptyState, Drawer, Skeleton,
} from '@/components/ui/ds'
import { useToast } from '@/components/ui/ds/Toast'
import type { Column } from '@/components/ui/ds/DataTable'
import { WORKFLOW_NOTIFICATION_ROLES, type Workflow, type WorkflowNode, type WorkflowTriggerEvent } from '@/utils/api'
import { useWorkflows, useCreateWorkflow, useUpdateWorkflow, useRunWorkflow, useWorkflowRuns } from '@/queries/workflow.query'
import { WORKFLOW_TEMPLATES, type WorkflowTemplate } from './workflowTemplates'

const TRIGGER_OPTIONS: { value: WorkflowTriggerEvent; label: string }[] = [
  { value: 'patient.created', label: 'Пациент создан' },
  { value: 'patient.deleted', label: 'Пациент удалён' },
  { value: 'appointment.created', label: 'Запись создана' },
  { value: 'referral.created', label: 'Направление создано' },
  { value: 'referral.accepted', label: 'Направление принято' },
  { value: 'referral.completed', label: 'Направление завершено' },
  { value: 'diagnostics.result_ready', label: 'Результат диагностики готов' },
]

const NODE_TYPE_OPTIONS = [
  { value: 'condition', label: 'Условие' },
  { value: 'audit', label: 'Запись в журнал аудита' },
  { value: 'notification', label: 'Уведомление' },
  { value: 'log', label: 'Отметка (лог)' },
]

const CONDITION_OP_OPTIONS = [
  { value: 'eq', label: '= равно' },
  { value: 'neq', label: '≠ не равно' },
  { value: 'exists', label: 'существует' },
  { value: 'contains', label: 'содержит' },
]

function fd(d: string | null | undefined) {
  if (!d) return '—'
  try { return new Date(d).toLocaleString('ru-RU') } catch { return d }
}

function triggerLabel(event: string) {
  return TRIGGER_OPTIONS.find((t) => t.value === event)?.label || event
}

function nodeSummary(node: WorkflowNode): string {
  switch (node.type) {
    case 'condition': return `если ${node.field} ${node.op} ${node.value}`
    case 'audit': return `аудит: ${node.action}`
    case 'notification': {
      const roleLabels = (node.roles || []).map((r) => WORKFLOW_NOTIFICATION_ROLES.find((o) => o.value === r)?.label || r)
      return `уведомление (${roleLabels.length ? roleLabels.join(', ') : 'получатель не выбран'}): ${node.title}`
    }
    case 'log': return 'лог'
    default: return String((node as any).type)
  }
}

function emptyNode(type: WorkflowNode['type']): WorkflowNode {
  switch (type) {
    case 'condition': return { type: 'condition', field: '', op: 'eq', value: '' }
    case 'audit': return { type: 'audit', action: '' }
    case 'notification': return { type: 'notification', title: '', message: '', roles: ['OWNER', 'ADMIN'] }
    case 'log': return { type: 'log' }
  }
}

function StepEditor({ node, onChange }: { node: WorkflowNode; onChange: (n: WorkflowNode) => void }) {
  if (node.type === 'condition') {
    return (
      <div className="grid grid-cols-3 gap-2">
        <Input size="sm" placeholder="поле" value={node.field} onChange={(e) => onChange({ ...node, field: e.target.value })} />
        <Select size="sm" options={CONDITION_OP_OPTIONS} value={node.op} onChange={(e) => onChange({ ...node, op: e.target.value as any })} />
        <Input size="sm" placeholder="значение" value={node.value} onChange={(e) => onChange({ ...node, value: e.target.value })} />
      </div>
    )
  }
  if (node.type === 'audit') {
    return <Input size="sm" placeholder="действие (например, patient.flagged)" value={node.action} onChange={(e) => onChange({ ...node, action: e.target.value })} />
  }
  if (node.type === 'notification') {
    const roles = node.roles || []
    const toggleRole = (role: string) => {
      const next = roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role]
      onChange({ ...node, roles: next })
    }
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Input size="sm" placeholder="заголовок" value={node.title} onChange={(e) => onChange({ ...node, title: e.target.value })} />
          <Input size="sm" placeholder="сообщение" value={node.message} onChange={(e) => onChange({ ...node, message: e.target.value })} />
        </div>
        <div>
          <p className="text-2xs text-txt-muted mb-1">Кому (по роли в клинике)</p>
          <div className="flex flex-wrap gap-1">
            {WORKFLOW_NOTIFICATION_ROLES.map((r) => (
              <Button
                key={r.value} type="button" size="xs"
                variant={roles.includes(r.value) ? 'primary' : 'ghost'}
                onClick={() => toggleRole(r.value)}
              >
                {r.label}
              </Button>
            ))}
          </div>
          {roles.length === 0 && <p className="text-2xs text-error mt-1">Выберите хотя бы одну роль — иначе уведомление никому не отправится.</p>}
        </div>
      </div>
    )
  }
  return <p className="text-xs text-txt-muted">Без параметров — фиксирует, что шаг выполнился.</p>
}

function WorkflowFormModal({
  open, onClose, initial, onSubmit, submitting,
}: {
  open: boolean
  onClose: () => void
  initial?: Workflow | null
  onSubmit: (data: { name: string; trigger: { event: WorkflowTriggerEvent }; graph: { nodes: WorkflowNode[] }; status: 'draft' | 'active' }) => void
  submitting: boolean
}) {
  const [name, setName] = useState(initial?.name || '')
  const [event, setEvent] = useState<WorkflowTriggerEvent>(initial?.trigger?.event || 'patient.created')
  const [status, setStatus] = useState<'draft' | 'active'>(initial?.status || 'draft')
  const [nodes, setNodes] = useState<WorkflowNode[]>(initial?.graph?.nodes || [])

  const addNode = (type: WorkflowNode['type']) => setNodes((n) => [...n, emptyNode(type)])
  const updateNode = (idx: number, next: WorkflowNode) => setNodes((n) => n.map((x, i) => (i === idx ? next : x)))
  const removeNode = (idx: number) => setNodes((n) => n.filter((_, i) => i !== idx))

  const submit = () => {
    if (!name.trim()) return
    onSubmit({ name, trigger: { event }, graph: { nodes }, status })
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Изменить автоматизацию' : 'Новая автоматизация'} size="lg">
      <div className="space-y-4">
        <Input label="Название" placeholder="Уведомить при новом пациенте" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Событие-триггер" options={TRIGGER_OPTIONS}
            value={event} onChange={(e) => setEvent(e.target.value as WorkflowTriggerEvent)}
          />
          <Select
            label="Статус"
            options={[{ value: 'draft', label: 'Черновик' }, { value: 'active', label: 'Активна' }]}
            value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'active')}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-txt-secondary">Шаги</p>
            <div className="flex gap-1">
              {NODE_TYPE_OPTIONS.map((opt) => (
                <Button key={opt.value} size="xs" variant="ghost" onClick={() => addNode(opt.value as WorkflowNode['type'])}>
                  + {opt.label}
                </Button>
              ))}
            </div>
          </div>
          {nodes.length === 0 ? (
            <p className="text-xs text-txt-muted">Шагов пока нет — добавьте хотя бы один.</p>
          ) : (
            <div className="space-y-2">
              {nodes.map((node, idx) => (
                <div key={idx} className="flex items-start gap-2 rounded-lg border border-bdr-subtle p-2.5">
                  <GripVertical size={14} className="text-txt-ghost mt-1.5 shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Badge variant="outline" size="xs">{NODE_TYPE_OPTIONS.find((o) => o.value === node.type)?.label}</Badge>
                    <StepEditor node={node} onChange={(n) => updateNode(idx, n)} />
                  </div>
                  <Button size="icon-sm" variant="ghost" aria-label="Удалить шаг" onClick={() => removeNode(idx)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button loading={submitting} onClick={submit}>{initial ? 'Сохранить' : 'Создать'}</Button>
        </div>
      </div>
    </Modal>
  )
}

function WorkflowDetail({ workflow, onClose, onRun, running }: { workflow: Workflow; onClose: () => void; onRun: () => void; running: boolean }) {
  const { data: runs, isLoading } = useWorkflowRuns(workflow.id)

  return (
    <Drawer open onClose={onClose} title={workflow.name} width={440}>
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Badge variant={workflow.status === 'active' ? 'success' : 'default'}>{workflow.status === 'active' ? 'активна' : 'черновик'}</Badge>
          <span className="text-xs text-txt-muted">{triggerLabel(workflow.trigger?.event)}</span>
        </div>

        <div>
          <p className="text-xs font-medium text-txt-secondary mb-1.5">Шаги</p>
          <div className="space-y-1">
            {(workflow.graph?.nodes || []).map((n, i) => (
              <p key={i} className="text-xs text-txt-primary">{i + 1}. {nodeSummary(n)}</p>
            ))}
          </div>
        </div>

        <Button size="sm" icon={<Play size={14} />} loading={running} onClick={onRun}>
          Запустить сейчас (тест)
        </Button>

        <div>
          <p className="text-xs font-medium text-txt-secondary mb-2">История запусков</p>
          {isLoading ? (
            <Skeleton className="h-16" />
          ) : !runs?.length ? (
            <p className="text-xs text-txt-muted">Запусков ещё не было.</p>
          ) : (
            <div className="space-y-1.5">
              {runs.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-bdr-subtle px-2.5 py-2">
                  <Badge variant={r.status === 'success' ? 'success' : r.status === 'failed' ? 'error' : 'warning'} size="xs">{r.status}</Badge>
                  <span className="text-2xs text-txt-muted">{fd(r.startedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  )
}

function WorkflowTemplates({ existingNames, onAdd, addingId }: { existingNames: Set<string>; onAdd: (t: WorkflowTemplate) => void; addingId: string | null }) {
  const [open, setOpen] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles size={16} className="text-dv-gold" />
          Шаблоны автоматизаций
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
          {open ? 'Скрыть' : `Показать все (${WORKFLOW_TEMPLATES.length})`}
        </Button>
      </CardHeader>
      {open && (
        <CardContent>
          <p className="text-xs text-txt-muted mb-3">
            Готовые правила — нажмите «Добавить», чтобы создать автоматизацию как черновик, затем откройте её и активируйте.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {WORKFLOW_TEMPLATES.map((t) => {
              const already = existingNames.has(t.name)
              return (
                <div key={t.id} className="flex flex-col gap-2 rounded-lg border border-bdr-subtle p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-txt-primary">{t.name}</p>
                    <Badge variant="outline" size="xs" className="shrink-0">{triggerLabel(t.trigger)}</Badge>
                  </div>
                  <p className="text-xs text-txt-muted flex-1">{t.description}</p>
                  <Button
                    size="xs"
                    variant={already ? 'secondary' : 'primary'}
                    disabled={already}
                    loading={addingId === t.id}
                    onClick={() => onAdd(t)}
                  >
                    {already ? 'Уже добавлено' : 'Добавить'}
                  </Button>
                </div>
              )
            })}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export default function Workflows() {
  const toast = useToast()
  const { data: workflows, isLoading } = useWorkflows()
  const createWorkflow = useCreateWorkflow()
  const updateWorkflow = useUpdateWorkflow()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Workflow | null>(null)
  const [selected, setSelected] = useState<Workflow | null>(null)
  const [addingTemplateId, setAddingTemplateId] = useState<string | null>(null)

  const runWorkflow = useRunWorkflow(selected?.id)

  const submitForm = async (data: { name: string; trigger: { event: WorkflowTriggerEvent }; graph: { nodes: WorkflowNode[] }; status: 'draft' | 'active' }) => {
    try {
      if (editing) {
        await updateWorkflow.mutateAsync({ id: editing.id, ...data })
        toast.success('Автоматизация обновлена')
      } else {
        await createWorkflow.mutateAsync(data)
        toast.success('Автоматизация создана')
      }
      setFormOpen(false)
      setEditing(null)
    } catch (e: any) {
      toast.error(e.message || 'Не удалось сохранить')
    }
  }

  const addTemplate = async (t: WorkflowTemplate) => {
    setAddingTemplateId(t.id)
    try {
      await createWorkflow.mutateAsync({ name: t.name, trigger: { event: t.trigger }, graph: { nodes: t.nodes }, status: 'draft' })
      toast.success('Автоматизация добавлена как черновик — откройте её, чтобы активировать')
    } catch (e: any) {
      toast.error(e.message || 'Не удалось добавить шаблон')
    } finally {
      setAddingTemplateId(null)
    }
  }

  const runNow = async () => {
    try {
      await runWorkflow.mutateAsync()
      toast.success('Автоматизация запущена')
    } catch (e: any) {
      toast.error(e.message || 'Не удалось запустить')
    }
  }

  const columns: Column<Workflow>[] = [
    { key: 'name', header: 'Название' },
    { key: 'trigger', header: 'Триггер', render: (row) => triggerLabel(row.trigger?.event) },
    {
      key: 'status', header: 'Статус',
      render: (row) => <Badge variant={row.status === 'active' ? 'success' : 'default'} size="xs">{row.status === 'active' ? 'активна' : 'черновик'}</Badge>,
    },
    { key: 'steps', header: 'Шагов', render: (row) => row.graph?.nodes?.length ?? 0 },
    { key: 'createdAt', header: 'Создано', render: (row) => fd(row.createdAt) },
  ]

  return (
    <div className="dv-page max-w-full overflow-x-hidden space-y-4 py-4 md:py-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WorkflowIcon size={16} className="text-dv-gold" />
            Автоматизация
          </CardTitle>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => { setEditing(null); setFormOpen(true) }}>
            Создать автоматизацию
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
          ) : !workflows?.length ? (
            <EmptyState
              icon={<WorkflowIcon size={24} />}
              title="Автоматизаций пока нет"
              description="Настройте правило: событие в клинике запускает уведомление, запись в аудит или проверку условия."
              action={<Button size="sm" icon={<Plus size={14} />} onClick={() => setFormOpen(true)}>Создать автоматизацию</Button>}
            />
          ) : (
            <DataTable columns={columns} data={workflows} rowKey={(r) => r.id} onRowClick={(r) => setSelected(r)} />
          )}
        </CardContent>
      </Card>

      <WorkflowTemplates
        existingNames={new Set((workflows || []).map((w) => w.name))}
        onAdd={addTemplate}
        addingId={addingTemplateId}
      />

      <WorkflowFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        initial={editing}
        onSubmit={submitForm}
        submitting={createWorkflow.isPending || updateWorkflow.isPending}
      />

      {selected && (
        <WorkflowDetail
          workflow={selected}
          onClose={() => setSelected(null)}
          onRun={runNow}
          running={runWorkflow.isPending}
        />
      )}
    </div>
  )
}
