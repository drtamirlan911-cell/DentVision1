import React, { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { CheckCircle2, Clock, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { Card } from '@/components/ui/ds/Card'
import { Button } from '@/components/ui/ds/Button'
import { Badge } from '@/components/ui/ds/Badge'
import { EmptyState } from '@/components/ui/ds/EmptyState'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { Skeleton } from '@/components/ui/ds/Skeleton'
import { useToast } from '@/components/ui/ds/Toast'
import { useAiApprovals, useApproveAiApproval, useRejectAiApproval } from '@/queries/ai.query'
import type { AiApproval } from '@/utils/api'
import type { Clinic, User, RoleInfo } from '@/types'

/**
 * The other half of the kernel's human-in-the-loop step.
 *
 * The backend has been parking rows in `AiApproval` since the governance core
 * shipped — from `HIGH_RISK_TOOLS` calls and from the nightly `recallAgent`,
 * which proposes rather than acts. Nothing in the client ever read them, so
 * every proposal sat until the sweeper expired it. This screen is where they
 * get decided.
 */

/** Tool name → what a person calling it is actually about to do. */
const TOOL_LABEL: Record<string, string> = {
  createInvoice: 'Выставить счёт пациенту',
  createTreatmentPlan: 'Создать план лечения',
  cancelAppointment: 'Отменить приём',
  createAppointment: 'Записать на приём',
  rescheduleAppointment: 'Перенести приём',
  updateAppointmentStatus: 'Изменить статус приёма',
  createDiagnosticReferral: 'Создать направление на диагностику',
  createLabOrder: 'Создать заказ в лабораторию',
  updateLabOrderStatus: 'Изменить статус заказа лаборатории',
  getRecallList: 'Обзвонить пациентов, которые давно не приходили',
}

/** Param key → column name a clinic would recognise. */
const PARAM_LABEL: Record<string, string> = {
  patientId: 'Пациент',
  doctorId: 'Врач',
  appointmentId: 'Приём',
  amount: 'Сумма',
  title: 'Название',
  date: 'Дата',
  time: 'Время',
  reason: 'Причина',
  status: 'Статус',
  description: 'Описание',
  inactiveDays: 'Дней без визита',
  clinicId: 'Клиника',
}

const STATUS_META: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'default' }> = {
  pending: { label: 'Ожидает решения', variant: 'warning' },
  approved: { label: 'Подтверждено', variant: 'success' },
  rejected: { label: 'Отклонено', variant: 'default' },
  expired: { label: 'Истекло', variant: 'default' },
  failed: { label: 'Ошибка выполнения', variant: 'error' },
}

function toolLabel(tool: string) {
  return TOOL_LABEL[tool] || tool
}

function formatTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** "через 3 ч" / "истекло" — an approval nobody decides quietly expires. */
function expiryHint(expiresAt: string | null): { text: string; urgent: boolean } | null {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  if (ms <= 0) return { text: 'срок истёк', urgent: true }
  const hours = Math.floor(ms / 3_600_000)
  if (hours < 1) return { text: `истекает через ${Math.max(1, Math.round(ms / 60_000))} мин`, urgent: true }
  if (hours < 24) return { text: `истекает через ${hours} ч`, urgent: hours < 4 }
  return { text: `истекает через ${Math.floor(hours / 24)} дн`, urgent: false }
}

/** Money keys, so an approval about 145000 reads as a sum and not as an id. */
const MONEY_KEYS = new Set(['amount', 'price', 'total', 'sum'])

function formatParam(key: string, value: unknown): string {
  if (MONEY_KEYS.has(key) && typeof value === 'number' && Number.isFinite(value)) {
    return `${value.toLocaleString('ru-RU')} ₸`
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

/** Render params as readable rows; anything nested falls back to compact JSON. */
function paramRows(params: Record<string, unknown>): Array<[string, string]> {
  return Object.entries(params || {})
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => [PARAM_LABEL[k] || k, formatParam(k, v)])
}

function ApprovalCard({
  approval,
  currentUserId,
  onApprove,
  onReject,
  busy,
}: {
  approval: AiApproval
  currentUserId: string | undefined
  onApprove: () => void
  onReject: () => void
  busy: boolean
}) {
  const status = STATUS_META[approval.status] || { label: approval.status, variant: 'default' as const }
  const isPending = approval.status === 'pending'
  const highRisk = approval.riskLevel === 'high'
  // Mirrors the server rule (`approvals.routes.ts`): a high-risk action cannot
  // be waved through by the person who asked for it. Saying so up front beats
  // letting them press the button and read a 403.
  const selfBlocked = highRisk && approval.requestedByUserId === currentUserId
  const expiry = isPending ? expiryHint(approval.expiresAt) : null
  const rows = paramRows(approval.params)

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-txt-primary">{toolLabel(approval.tool)}</h3>
            {highRisk && <Badge variant="error" size="xs">Высокий риск</Badge>}
            <Badge variant={status.variant} size="xs">{status.label}</Badge>
            {approval.agentId && <Badge variant="outline" size="xs">агент</Badge>}
          </div>
          <p className="mt-1.5 text-sm text-txt-secondary">{approval.summary}</p>
        </div>
        {isPending && (
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="success"
              icon={<CheckCircle2 size={14} />}
              disabled={busy || selfBlocked}
              onClick={onApprove}
            >
              Подтвердить
            </Button>
            <Button size="sm" variant="danger" icon={<X size={14} />} disabled={busy} onClick={onReject}>
              Отклонить
            </Button>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 border-t border-bdr-subtle pt-3 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-2 text-xs">
              <dt className="shrink-0 text-txt-muted">{label}:</dt>
              <dd className="min-w-0 truncate text-txt-secondary" title={value}>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-txt-ghost">
        <span className="inline-flex items-center gap-1">
          <Clock size={10} />
          Запрошено {formatTime(approval.createdAt)}
        </span>
        {approval.requiredPermission && <span>требует права: {approval.requiredPermission}</span>}
        {expiry && <span className={expiry.urgent ? 'text-warning' : undefined}>{expiry.text}</span>}
        {approval.decidedAt && <span>решено {formatTime(approval.decidedAt)}</span>}
      </div>

      {selfBlocked && (
        <p className="mt-2 text-2xs text-txt-muted">
          Это ваш собственный запрос с высоким риском — подтвердить его должен другой сотрудник с нужными правами.
        </p>
      )}
      {approval.decisionNote && (
        <p className="mt-2 text-xs text-txt-secondary">Комментарий: {approval.decisionNote}</p>
      )}
    </Card>
  )
}

export default function AiApprovals() {
  const { user } = useOutletContext<{ clinic: Clinic; user: User; roleInfo: RoleInfo }>()
  const toast = useToast()
  const [statusFilter, setStatusFilter] = useState<string>('pending')

  const approvals = useAiApprovals(statusFilter === 'all' ? undefined : statusFilter)
  const approve = useApproveAiApproval()
  const reject = useRejectAiApproval()
  const [busyId, setBusyId] = useState<string | null>(null)

  const rows: AiApproval[] = useMemo(() => approvals.data || [], [approvals.data])
  const pendingCount = useMemo(
    () => (statusFilter === 'pending' ? rows.length : rows.filter((r) => r.status === 'pending').length),
    [rows, statusFilter],
  )

  async function decide(kind: 'approve' | 'reject', approval: AiApproval) {
    setBusyId(approval.id)
    try {
      if (kind === 'approve') {
        await approve.mutateAsync({ id: approval.id })
        toast.success('Действие подтверждено и выполнено')
      } else {
        await reject.mutateAsync({ id: approval.id })
        toast.success('Заявка отклонена')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось обработать заявку')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="fade-in max-w-full overflow-x-hidden space-y-6">
      <PageHeader
        title="Центр подтверждений ИИ"
        subtitle="Действия, которые ассистент и агенты не выполняют без решения человека"
        icon={<ShieldCheck size={24} className="text-dv-gold" />}
        actions={
          <Button
            className="min-h-11"
            variant="secondary"
            icon={<RefreshCw size={14} />}
            onClick={() => approvals.refetch()}
          >
            Обновить
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="dv-select min-h-11 w-full sm:w-64"
        >
          <option value="pending">Ожидают решения</option>
          <option value="approved">Подтверждённые</option>
          <option value="rejected">Отклонённые</option>
          <option value="expired">Истёкшие</option>
          <option value="all">Все</option>
        </select>
        {pendingCount > 0 && (
          <Badge variant="warning" size="sm">
            {pendingCount} ждут решения
          </Badge>
        )}
      </div>

      {approvals.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={48} />}
          title="Нечего подтверждать"
          description="Здесь появятся действия ассистента с высоким риском — счёт, план лечения, отмена приёма — и предложения ночных агентов."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((a) => (
            <ApprovalCard
              key={a.id}
              approval={a}
              currentUserId={user?.id}
              busy={busyId === a.id}
              onApprove={() => decide('approve', a)}
              onReject={() => decide('reject', a)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
