import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Bot, BriefcaseBusiness, GraduationCap, HeartPulse, Search, ShoppingBag, Stethoscope, Users, Building2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth.store'
import { useGuestStore } from '@/store/guest.store'

const roles = [
  { id: 'doctor', title: 'Я врач', subtitle: 'AI, CRM, пациенты и клинический рабочий процесс', icon: Stethoscope, path: '/login?role=doctor' },
  { id: 'patient', title: 'Я пациент / покупатель', subtitle: 'Врачи, клиники, диагностика и покупки', icon: HeartPulse, path: '/login?role=patient' },
  { id: 'owner', title: 'Я владелец клиники', subtitle: 'Команда, финансы, аналитика и управление', icon: Building2, path: '/login?role=owner' },
  { id: 'admin', title: 'Я администратор', subtitle: 'Записи, коммуникации и операционные задачи', icon: Users, path: '/login?role=admin' },
  { id: 'student', title: 'Я хочу учиться', subtitle: 'Academy, курсы и профессиональное развитие', icon: GraduationCap, path: '/school' },
  { id: 'buyer', title: 'Я хочу купить', subtitle: 'Dental Shop и профессиональные товары', icon: ShoppingBag, path: '/shop' },
  { id: 'dentist', title: 'Я ищу стоматолога', subtitle: 'Найти врача или клинику и посмотреть возможности', icon: Search, path: '/community' },
] as const

export default function Welcome() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { isGuest } = useGuestStore()

  React.useEffect(() => {
    if (isAuthenticated) navigate('/ai', { replace: true })
  }, [isAuthenticated, navigate])

  const enterGuest = () => {
    if (isGuest) navigate('/ai')
    else navigate('/ai')
  }

  return (
    <main className="min-h-screen overflow-y-auto bg-surface-0 text-txt-primary">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-3 text-left" aria-label="DentVision">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-dv-gold/25 bg-dv-gold/10 text-dv-gold"><Stethoscope size={19} /></span>
            <span><span className="block text-base font-semibold tracking-tight">DentVision</span><span className="block text-[10px] text-txt-muted">by Dr.Tamirlan</span></span>
          </button>
          <button type="button" onClick={() => navigate('/login')} className="min-h-11 rounded-xl border border-bdr-subtle px-4 text-xs font-semibold text-txt-secondary hover:bg-surface-2">Войти</button>
        </header>

        <section className="flex flex-1 flex-col justify-center py-12 sm:py-16">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45 }} className="mx-auto w-full max-w-4xl text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-dv-gold/25 bg-dv-gold/10 text-dv-gold"><Bot size={26} /></div>
            <p className="text-[11px] font-semibold uppercase tracking-[.24em] text-dv-gold">AI Operating System for Dentistry</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">DentVision</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-txt-secondary sm:text-base">Единая экосистема для врачей, клиник, пациентов, обучения, диагностики и профессиональных покупок.</p>

            <div className="mx-auto mt-9 max-w-3xl rounded-3xl border border-dv-gold/20 bg-surface-1 p-4 text-left shadow-sm sm:p-5">
              <div className="mb-4 flex items-center gap-2"><Bot size={16} className="text-dv-gold" /><span className="text-sm font-semibold">Что вы хотите сделать?</span></div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {roles.map((role) => { const Icon = role.icon; return <motion.button key={role.id} type="button" whileTap={{ scale: .985 }} onClick={() => navigate(role.path)} className="group flex min-h-[82px] items-center gap-3 rounded-2xl border border-bdr-subtle bg-surface-0 p-3 text-left transition-colors hover:border-dv-gold/30 hover:bg-surface-2"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dv-gold/10 text-dv-gold"><Icon size={18} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{role.title}</span><span className="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-txt-muted">{role.subtitle}</span></span><ArrowRight size={15} className="shrink-0 text-txt-ghost transition-transform group-hover:translate-x-0.5 group-hover:text-dv-gold" /></motion.button> })}
              </div>
            </div>

            <button type="button" onClick={enterGuest} className="mx-auto mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-dv-gold px-5 text-sm font-semibold text-surface-0 hover:opacity-90">Попробовать DentVision без регистрации <ArrowRight size={16} /></button>
            <p className="mt-3 text-[11px] text-txt-muted">Гостевой режим: AI Demo, Academy, Shop, врачи и клиники. Аккаунт потребуется только для действий, где нужно сохранить или изменить данные.</p>
          </motion.div>
        </section>

        <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-bdr-subtle pt-5 text-[10px] text-txt-muted">
          <button type="button" onClick={() => navigate('/ai')}>DentVision AI</button>
          <button type="button" onClick={() => navigate('/school')}>Academy</button>
          <button type="button" onClick={() => navigate('/shop')}>Marketplace</button>
          <button type="button" onClick={() => navigate('/jobs')}>Jobs</button>
          <button type="button" onClick={() => navigate('/terms')}>Условия</button>
          <button type="button" onClick={() => navigate('/privacy')}>Privacy</button>
        </footer>
      </div>
    </main>
  )
}
