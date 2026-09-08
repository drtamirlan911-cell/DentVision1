import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Brain, CheckCircle2, ClipboardList, CreditCard, FileHeart, ScanLine, CalendarDays, FlaskConical, Loader2 } from 'lucide-react'
import { useWorkspaceStore } from '@/store/workspace.store'
import { useAIExecutor } from '@/utils/aiExecutor'
import { getClinicalCaseQuickActions } from '@/lib/clinicalCaseActions'

const ACTION_META: Record<string, { icon: typeof FileHeart; label: string; tone?: string }> = {
  OpenMedicalCard: { icon: FileHeart, label: 'Медицинская карта' },
  OpenDentalChart: { icon: ClipboardList, label: 'Зубная карта' },
  OpenTreatmentPlans: { icon: ClipboardList, label: 'План лечения' },
  OpenSchedule: { icon: CalendarDays, label: 'Запланировать визит' },
  OpenDiagnostics: { icon: ScanLine, label: 'Диагностика' },
  OpenLab: { icon: FlaskConical, label: 'Лаборатория' },
  OpenCashier: { icon: CreditCard, label: 'Оплата' },
  OpenPatients: { icon: FileHeart, label: 'Пациент' },
}

export function ClinicalCaseCopilot() {
  const context = useWorkspaceStore((s) => s.context)
  const { executeAction } = useAIExecutor()
  const [running, setRunning] = useState<string | null>(null)

  const clinicalCase = (context?.data as any)?.clinicalCase
  const patientId = context?.focusType === 'patient' ? context.focusId : clinicalCase?.patientId

  const actions = useMemo(() => getClinicalCaseQuickActions({
    patientId,
    planId: clinicalCase?.planId,
    visitId: clinicalCase?.visitId,
  }), [patientId, clinicalCase?.planId, clinicalCase?.visitId])

  if (!patientId || !clinicalCase) return null

  const run = async (action: any) => {
    setRunning(action.id)
    try {
      await executeAction(action, {
        onConfirm: async () => true,
      })
    } finally {
      setRunning(null)
    }
  }

  return (
    <section className="mx-3 my-3 overflow-hidden rounded-2xl border border-dv-gold/15 bg-gradient-to-br from-dv-gold/[0.07] to-transparent" aria-label="AI Clinical Copilot">
      <div className="flex items-start gap-3 border-b border-white/[0.06] p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-dv-gold/10 text-dv-gold">
          <Brain size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-txt-primary">Clinical Copilot</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300"><CheckCircle2 size={10} /> Контекст активен</span>
          </div>
          <p className="mt-1 text-[10px] leading-4 text-txt-muted">AI работает внутри случая {clinicalCase.planId ? 'и активного плана лечения' : 'пациента'}.</p>
        </div>
      </div>

      {clinicalCase.debt > 0 && (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-amber-400/10 bg-amber-400/[0.04] px-2.5 py-2 text-[10px] text-amber-200">
          <AlertTriangle size={13} className="shrink-0" /> Открытый баланс: {Number(clinicalCase.debt).toLocaleString('ru-RU')} ₸
        </div>
      )}

      <div className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-txt-ghost">Следующие действия</span>
          <span className="text-[9px] text-txt-ghost">AI-навигация</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {actions.map((action) => {
            const meta = ACTION_META[action.type] || { icon: ArrowRight, label: action.label }
            const Icon = meta.icon
            const busy = running === action.id
            return (
              <button key={action.id} type="button" disabled={Boolean(running)} onClick={() => void run(action)} className="group flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-2.5 py-2 text-left transition-colors hover:border-dv-gold/25 hover:bg-dv-gold/[0.06] disabled:cursor-wait disabled:opacity-60">
                {busy ? <Loader2 size={14} className="shrink-0 animate-spin text-dv-gold" /> : <Icon size={14} className="shrink-0 text-dv-gold" />}
                <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-txt-secondary">{meta.label}</span>
                <ArrowRight size={11} className="shrink-0 text-txt-ghost transition-transform group-hover:translate-x-0.5" />
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
