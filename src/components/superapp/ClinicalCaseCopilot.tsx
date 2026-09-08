import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Brain, CheckCircle2, ClipboardList, CreditCard, FileHeart, ScanLine, CalendarDays, FlaskConical, Loader2, Lock } from 'lucide-react'
import { useWorkspaceStore } from '@/store/workspace.store'
import { useAIExecutor } from '@/utils/aiExecutor'
import { buildClinicalTreatmentWorkflow, workflowStepToAction, type ClinicalTreatmentStep } from '@/lib/clinicalTreatmentOrchestrator'

const ACTION_META: Record<string, { icon: typeof FileHeart; label: string }> = {
  OpenMedicalCard: { icon: FileHeart, label: 'Медицинская карта' },
  OpenDentalChart: { icon: ClipboardList, label: 'Зубная карта' },
  OpenTreatmentPlans: { icon: ClipboardList, label: 'План лечения' },
  OpenSchedule: { icon: CalendarDays, label: 'Расписание' },
  OpenDiagnostics: { icon: ScanLine, label: 'Диагностика' },
  OpenLab: { icon: FlaskConical, label: 'Лаборатория' },
  OpenCashier: { icon: CreditCard, label: 'Касса' },
}

export function ClinicalCaseCopilot() {
  const context = useWorkspaceStore((s) => s.context)
  const { executeAction } = useAIExecutor()
  const [running, setRunning] = useState<string | null>(null)
  const clinicalCase = (context?.data as any)?.clinicalCase
  const patientId = context?.focusType === 'patient' ? context.focusId : clinicalCase?.patientId

  const workflow = useMemo(() => clinicalCase ? buildClinicalTreatmentWorkflow(clinicalCase) : [], [clinicalCase])
  const actionableSteps = useMemo(() => workflow.filter((step) => step.actionType), [workflow])
  const nextStep = actionableSteps.find((step) => step.status === 'available') || actionableSteps.find((step) => step.status === 'ready')

  if (!patientId || !clinicalCase) return null

  const runStep = async (step: ClinicalTreatmentStep) => {
    const action = workflowStepToAction(step, {
      patientId,
      planId: clinicalCase.planId,
      visitId: clinicalCase.visitId,
    })
    if (!action) return
    setRunning(step.id)
    try {
      // Navigation actions are read-only and never auto-confirm mutations.
      await executeAction(action)
    } finally {
      setRunning(null)
    }
  }

  return (
    <section className="mx-3 my-3 overflow-hidden rounded-2xl border border-dv-gold/15 bg-surface-1" aria-label="AI Clinical Copilot">
      <div className="flex items-start gap-3 border-b border-bdr-subtle p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-dv-gold/10 text-dv-gold"><Brain size={18} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-txt-primary">Clinical Copilot</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300"><CheckCircle2 size={10} /> Контекст активен</span>
          </div>
          <p className="mt-1 text-[10px] leading-4 text-txt-muted">Единый workflow пациента: диагностика → план → визит → лаборатория → оплата → контроль.</p>
        </div>
      </div>

      {Number(clinicalCase.debt || 0) > 0 && (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-amber-400/10 bg-amber-400/[0.04] px-2.5 py-2 text-[10px] text-amber-200">
          <AlertTriangle size={13} className="shrink-0" /> Открытый баланс: {Number(clinicalCase.debt).toLocaleString('ru-RU')} ₸
        </div>
      )}

      {nextStep && (
        <div className="m-3 rounded-xl border border-dv-gold/20 bg-dv-gold/[0.05] p-3">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-dv-gold">Следующий шаг</div>
          <div className="mt-1 text-sm font-semibold text-txt-primary">{nextStep.title}</div>
          <p className="mt-1 text-[10px] leading-4 text-txt-muted">{nextStep.description}</p>
          <button type="button" disabled={Boolean(running)} onClick={() => void runStep(nextStep)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-dv-gold px-3 py-2 text-[11px] font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60">
            {running === nextStep.id ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
            Открыть следующий этап
          </button>
        </div>
      )}

      <div className="px-3 pb-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-txt-ghost">Workflow</span>
          <span className="text-[9px] text-txt-ghost">AI-навигация</span>
        </div>
        <div className="space-y-1">
          {workflow.map((step) => {
            const meta = ACTION_META[step.actionType || '']
            const Icon = meta?.icon || ClipboardList
            const busy = running === step.id
            const ready = Boolean(step.actionType)
            return (
              <button key={step.id} type="button" disabled={!ready || Boolean(running)} onClick={() => void runStep(step)} className="group flex w-full items-center gap-2 rounded-lg border border-white/[0.05] px-2.5 py-2 text-left transition-colors hover:border-dv-gold/20 hover:bg-white/[0.025] disabled:cursor-default disabled:opacity-60">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.03] text-txt-muted"><Icon size={13} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10px] font-medium text-txt-secondary">{meta?.label || step.title}</span>
                  <span className="block truncate text-[9px] text-txt-ghost">{step.status === 'ready' ? 'Готово' : 'Доступно'}</span>
                </span>
                {step.requiresConfirmation && <Lock size={11} className="shrink-0 text-amber-400" />}
                {busy ? <Loader2 size={12} className="animate-spin text-dv-gold" /> : <ArrowRight size={11} className="shrink-0 text-txt-ghost transition-transform group-hover:translate-x-0.5" />}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
