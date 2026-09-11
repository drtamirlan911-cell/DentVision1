import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Building2, GraduationCap, HeartPulse, Search, ShoppingBag, Stethoscope, BriefcaseBusiness, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth.store'

const intents = [
  { id: 'patient', title: 'Записаться к врачу', subtitle: 'Найти помощь и запись', icon: HeartPulse, path: '/book/discover' },
  { id: 'diagnostics', title: 'Найти диагностику', subtitle: 'Центры и результаты', icon: Search, path: '/diagnostics' },
  { id: 'academy', title: 'Учиться', subtitle: 'Курсы и Academy', icon: GraduationCap, path: '/school' },
  { id: 'shop', title: 'Купить', subtitle: 'Материалы и оборудование', icon: ShoppingBag, path: '/shop' },
  { id: 'jobs', title: 'Найти работу', subtitle: 'Вакансии в стоматологии', icon: BriefcaseBusiness, path: '/jobs' },
] as const

const workRoles = [
  { id: 'doctor', title: 'Врач', subtitle: 'AI и пациенты', icon: Stethoscope, path: '/login?role=doctor' },
  { id: 'clinic', title: 'Клиника', subtitle: 'Команда и управление', icon: Building2, path: '/login?role=owner' },
] as const

export default function Welcome() {
  const navigate = useNavigate()
  const { isAuthenticated, loading } = useAuth()
  React.useEffect(() => { if (!loading && isAuthenticated) navigate('/ai', { replace: true }) }, [isAuthenticated, loading, navigate])

  return (
    <main className="dv-welcome min-h-[100dvh] overflow-x-hidden bg-surface-0 px-4 py-6 text-left text-txt-primary md:flex md:justify-center">
      <div className="flex min-h-[calc(100dvh-3rem)] w-full max-w-[390px] flex-col md:min-h-[calc(100dvh-3rem)] md:max-w-5xl">
        <header className="flex items-start justify-between">
          <button type="button" onClick={() => navigate('/')} className="min-h-11 text-left" aria-label="DentVision"><span className="block text-[20px] font-normal leading-6 tracking-[-0.02em]">DentVision</span><span className="block text-[10px] leading-3 text-dv-gold">by Dr.Tamirlan</span></button>
          <button type="button" onClick={() => navigate('/login')} className="min-h-11 rounded-xl border border-bdr px-4 text-xs font-semibold">Войти</button>
        </header>
        <section className="flex flex-1 flex-col pt-[28px] md:justify-center md:pt-0">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32 }}>
            <div className="flex h-8 w-full items-center rounded-2xl border border-bdr bg-dv-gold-muted px-3.5"><Sparkles size={13} className="mr-2 text-dv-gold" /><span className="text-[9px] uppercase leading-3 text-dv-gold">AI Operating System for Dentistry</span></div>
            <h1 className="mt-6 max-w-[720px] text-4xl font-normal leading-[1.12] tracking-[-0.03em] md:text-6xl">Ваша стоматология.<br />В одной системе.</h1>
            <p className="mt-3 max-w-[620px] text-[13px] leading-[1.5] text-txt-secondary md:text-sm">AI, клиника, пациенты, диагностика, обучение и Shop — в одном рабочем пространстве.</p>
            <button type="button" onClick={() => navigate('/ai')} className="mt-8 flex h-14 w-full max-w-[620px] items-center justify-between rounded-2xl bg-dv-gold px-[18px] text-sm font-medium text-dv-gold-on transition-transform active:scale-[0.99]"><span>Попробовать DentVision AI</span><ArrowRight size={19} strokeWidth={1.8} /></button>
            <p className="mt-2 text-center max-w-[620px] text-[10px] text-txt-muted">Без регистрации. Войдите только для работы с личными данными.</p>
            <div className="mt-7 max-w-5xl"><div className="mb-3 flex items-end justify-between gap-3 px-1"><div><p className="text-[11px] font-semibold text-txt-primary">Что вы хотите сделать?</p><p className="mt-0.5 text-[10px] text-txt-muted">Начните с задачи — роль можно выбрать позже.</p></div></div><div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">{intents.map((intent, index) => { const Icon = intent.icon; return <motion.button key={intent.id} type="button" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: index * 0.035 }} onClick={() => navigate(intent.path)} className="group min-h-[82px] rounded-2xl border border-bdr bg-surface-1 px-3 py-2.5 text-left transition-colors hover:border-dv-gold/40 hover:bg-surface-raised"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-dv-gold/10 text-dv-gold"><Icon size={15} strokeWidth={1.7} /></span><span className="mt-2 block truncate text-[11px] font-medium leading-[13px] text-txt-primary">{intent.title}</span><span className="mt-0.5 block line-clamp-1 text-[9px] leading-3 text-txt-secondary">{intent.subtitle}</span></motion.button> })}</div></div>
            <div className="mt-5 max-w-[620px] border-t border-bdr-subtle pt-4"><p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-txt-muted">Для работы в DentVision</p><div className="grid grid-cols-2 gap-2.5">{workRoles.map(role => { const Icon = role.icon; return <button key={role.id} type="button" onClick={() => navigate(role.path)} className="flex min-h-12 items-center gap-2.5 rounded-xl border border-bdr bg-surface-1 px-3 text-left transition-colors hover:border-dv-gold/35 hover:bg-surface-raised"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-dv-gold"><Icon size={16} strokeWidth={1.7} /></span><span className="min-w-0"><span className="block text-[11px] font-medium text-txt-primary">{role.title}</span><span className="block text-[9px] text-txt-muted">{role.subtitle}</span></span></button> })}</div></div>
          </motion.div>
        </section>
        <p className="mt-5 pb-1 text-[9px] leading-3 text-txt-secondary md:pb-0">DentVision объединяет клинику, AI, диагностику, обучение и покупки, сохраняя единый контекст.</p>
      </div>
    </main>
  )
}