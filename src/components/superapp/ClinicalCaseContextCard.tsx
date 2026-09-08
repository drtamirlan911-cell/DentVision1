import { CalendarDays, ClipboardList, CreditCard, FileHeart, ScanLine, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePatientStore } from '@/store/patient.store'

function Action({ icon: Icon, label, onClick }: { icon: typeof UserRound; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-w-0 items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-2 text-left transition-colors hover:border-dv-gold/20 hover:bg-dv-gold/[0.06]">
      <Icon size={14} className="shrink-0 text-dv-gold" />
      <span className="truncate text-[10px] font-medium text-txt-secondary">{label}</span>
    </button>
  )
}

export function ClinicalCaseContextCard() {
  const navigate = useNavigate()
  const patient = usePatientStore((s) => s.patientData)
  const loading = usePatientStore((s) => s.loading)

  if (loading) {
    return <div className="mx-3 my-3 h-28 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.025]" aria-label="Загрузка клинического контекста" />
  }

  if (!patient) return null

  const patientQuery = `?patientId=${encodeURIComponent(patient.id)}`
  const balance = typeof patient.debt === 'number' && patient.debt !== 0
    ? `${patient.debt.toLocaleString('ru-RU')} ₸`
    : 'Нет открытого долга'

  return (
    <section className="mx-3 my-3 rounded-xl border border-dv-gold/15 bg-dv-gold/[0.035] p-3" aria-label="Клинический контекст пациента">
      <div className="mb-3 flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-dv-gold/10 text-dv-gold"><UserRound size={17} /></div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-txt-primary">{patient.name}</div>
          <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-txt-muted">
            {patient.phone && <span>{patient.phone}</span>}
            {patient.treatmentStage && <span>{patient.treatmentStage}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        <div className="rounded-lg bg-white/[0.025] px-2.5 py-2"><div className="text-txt-ghost">Следующий визит</div><div className="mt-0.5 font-medium text-txt-secondary">{patient.nextVisit ? `${patient.nextVisit}${patient.nextVisitTime ? ` · ${patient.nextVisitTime}` : ''}` : 'Не назначен'}</div></div>
        <div className="rounded-lg bg-white/[0.025] px-2.5 py-2"><div className="text-txt-ghost">Баланс</div><div className="mt-0.5 font-medium text-txt-secondary">{balance}</div></div>
      </div>

      {patient.allergies?.length ? (
        <div className="mt-2 rounded-lg border border-red-400/10 bg-red-400/[0.035] px-2.5 py-2 text-[10px] text-red-300">
          Аллергии: {patient.allergies.join(', ')}
        </div>
      ) : null}

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Action icon={FileHeart} label="Медкарта" onClick={() => navigate(`/crm/medical-card${patientQuery}`)} />
        <Action icon={ClipboardList} label="План лечения" onClick={() => navigate(`/crm/treatment-plans${patientQuery}`)} />
        <Action icon={ScanLine} label="Диагностика" onClick={() => navigate(`/diagnostics/referrals/new${patientQuery}`)} />
        <Action icon={CalendarDays} label="Назначить визит" onClick={() => navigate(`/crm/schedule?action=new&patientId=${encodeURIComponent(patient.id)}`)} />
        <Action icon={CreditCard} label="Оплата" onClick={() => navigate(`/crm/cashier${patientQuery}`)} />
      </div>
    </section>
  )
}
