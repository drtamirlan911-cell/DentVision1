import { Activity, CalendarDays, ChevronRight, ClipboardList, CreditCard, FileHeart, ScanLine, Sparkles, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePatientStore } from '@/store/patient.store'

const items = [
  { label: 'Медкарта', icon: FileHeart, path: '/crm/medical-card' },
  { label: 'Зубная карта', icon: Activity, path: '/crm/dental-chart' },
  { label: 'План лечения', icon: ClipboardList, path: '/crm/treatment-plans' },
  { label: 'Диагностика', icon: ScanLine, path: '/diagnostics' },
  { label: 'Расписание', icon: CalendarDays, path: '/crm/schedule' },
  { label: 'Касса', icon: CreditCard, path: '/crm/cashier' },
] as const

export function PatientCommandCenter() {
  const navigate = useNavigate()
  const patient = usePatientStore((s) => s.patientData)
  const loading = usePatientStore((s) => s.loading)

  if (loading) return <div className="mx-3 my-3 h-52 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025]" />
  if (!patient) return null

  const q = `?patientId=${encodeURIComponent(patient.id)}`
  const balance = typeof patient.debt === 'number' && patient.debt !== 0
    ? `${patient.debt.toLocaleString('ru-RU')} ₸`
    : '0 ₸'

  return (
    <section className="mx-3 my-3 overflow-hidden rounded-2xl border border-dv-gold/15 bg-surface-1 shadow-lg" aria-label="Центр пациента">
      <div className="border-b border-bdr-subtle bg-dv-gold/[0.035] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-dv-gold/10 text-dv-gold"><UserRound size={20} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-txt-primary">{patient.name}</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-dv-gold/10 px-2 py-0.5 text-[9px] font-semibold text-dv-gold"><Sparkles size={10} /> AI context</span>
            </div>
            <p className="mt-1 truncate text-[10px] text-txt-muted">{patient.phone || 'Контакт не указан'}{patient.treatmentStage ? ` · ${patient.treatmentStage}` : ''}</p>
          </div>
          <button type="button" onClick={() => navigate(`/crm/patients${q}`)} className="rounded-lg p-2 text-txt-muted hover:bg-white/5 hover:text-txt-primary" aria-label="Открыть пациента"><ChevronRight size={17} /></button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <div className="rounded-xl bg-white/[0.025] px-2.5 py-2"><div className="text-[9px] text-txt-ghost">Следующий визит</div><div className="mt-1 truncate text-[10px] font-medium text-txt-secondary">{patient.nextVisit || 'Не назначен'}</div></div>
          <div className="rounded-xl bg-white/[0.025] px-2.5 py-2"><div className="text-[9px] text-txt-ghost">Баланс</div><div className="mt-1 truncate text-[10px] font-medium text-txt-secondary">{balance}</div></div>
          <div className="rounded-xl bg-white/[0.025] px-2.5 py-2"><div className="text-[9px] text-txt-ghost">Этап</div><div className="mt-1 truncate text-[10px] font-medium text-txt-secondary">{patient.treatmentStage || '—'}</div></div>
        </div>

        {patient.allergies?.length ? <div className="mt-2 rounded-xl border border-red-400/10 bg-red-400/[0.035] px-3 py-2 text-[10px] text-red-300">Аллергии: {patient.allergies.join(', ')}</div> : null}
      </div>

      <div className="grid grid-cols-2 gap-1.5 p-3">
        {items.map(({ label, icon: Icon, path }) => (
          <button key={path} type="button" onClick={() => navigate(`${path}${q}`)} className="group flex items-center gap-2.5 rounded-xl border border-bdr-subtle bg-white/[0.02] px-3 py-2.5 text-left transition-colors hover:border-dv-gold/20 hover:bg-dv-gold/[0.04]">
            <Icon size={15} className="shrink-0 text-dv-gold" />
            <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-txt-secondary">{label}</span>
            <ChevronRight size={13} className="text-txt-ghost transition-transform group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5 border-t border-bdr-subtle p-3 pt-2">
        <button type="button" onClick={() => navigate(`/crm/schedule?action=new&patientId=${encodeURIComponent(patient.id)}`)} className="rounded-xl bg-dv-gold px-3 py-2.5 text-[10px] font-semibold text-black hover:opacity-90">Новый визит</button>
        <button type="button" onClick={() => navigate(`/diagnostics/referrals/new${q}`)} className="rounded-xl border border-dv-gold/20 bg-dv-gold/[0.06] px-3 py-2.5 text-[10px] font-semibold text-dv-gold hover:bg-dv-gold/[0.1]">Новое направление</button>
      </div>
    </section>
  )
}
