import React from 'react'
import { ShieldCheck, Sparkles } from 'lucide-react'

interface Props {
  role?: string | null
  roleLabel?: string | null
}

type EmployeeProfile = {
  name: string
  mission: string
  autonomy: 'routine' | 'assisted' | 'supervised'
}

const PROFILES: Record<string, EmployeeProfile> = {
  DOCTOR: { name: 'AI Doctor Assistant', mission: 'Клинический контекст, планы и рабочие задачи', autonomy: 'supervised' },
  OWNER: { name: 'AI Business Manager', mission: 'Клиника, финансы, загрузка и рост', autonomy: 'assisted' },
  ADMIN: { name: 'AI Reception Assistant', mission: 'Запись, пациенты и операционные задачи', autonomy: 'routine' },
  ASSISTANT: { name: 'AI Clinical Assistant', mission: 'Подготовка визитов и клинических задач', autonomy: 'assisted' },
  MANAGER: { name: 'AI Operations Assistant', mission: 'Загрузка, процессы и контроль исполнения', autonomy: 'assisted' },
  CASHIER: { name: 'AI Finance Assistant', mission: 'Платежи, счета и финансовые задачи', autonomy: 'routine' },
  LAB: { name: 'AI Lab Assistant', mission: 'Заказы, сроки и лабораторные статусы', autonomy: 'routine' },
  STUDENT: { name: 'AI Learning Assistant', mission: 'Обучение, практика и персональный прогресс', autonomy: 'assisted' },
  SELLER: { name: 'AI Shop Assistant', mission: 'Товары, продажи и кабинет продавца', autonomy: 'routine' },
  SUPERADMIN: { name: 'AI Control Assistant', mission: 'Платформа, безопасность и контроль', autonomy: 'supervised' },
}

const AUTONOMY_LABEL: Record<EmployeeProfile['autonomy'], string> = {
  routine: 'Рутинные задачи',
  assisted: 'С подтверждением',
  supervised: 'Под контролем врача',
}

function resolveProfile(role?: string | null): EmployeeProfile {
  const key = String(role || '').toUpperCase().replace(/^ROLE_/, '')
  return PROFILES[key] || { name: 'DentVision AI Employee', mission: 'Рабочий помощник вашей области', autonomy: 'assisted' }
}

export function AIEmployeeStatus({ role, roleLabel }: Props) {
  const profile = resolveProfile(role || roleLabel)

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-3 sm:px-6">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-dv-gold/20 bg-dv-gold/10">
            <Sparkles size={15} className="text-dv-gold" />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-xs font-semibold text-txt-primary">{profile.name}</span>
              <span className="hidden shrink-0 rounded-full border border-white/[0.07] px-1.5 py-0.5 text-[9px] text-txt-muted sm:inline-flex">AI EMPLOYEE</span>
            </div>
            <p className="truncate text-[10px] text-txt-muted">{profile.mission}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-[9px] text-txt-muted">
          <ShieldCheck size={13} className="text-emerald-400" />
          <span className="hidden sm:inline">{AUTONOMY_LABEL[profile.autonomy]}</span>
        </div>
      </div>
    </div>
  )
}
