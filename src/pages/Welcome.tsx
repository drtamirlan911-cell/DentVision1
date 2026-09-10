import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Building2, GraduationCap, HeartPulse, ShoppingBag, Stethoscope, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth.store'

const roles = [
  { id: 'doctor', title: 'Я врач', subtitle: 'AI + CRM', icon: Stethoscope, path: '/login?role=doctor' },
  { id: 'patient', title: 'Я пациент / покупатель', subtitle: 'Личный кабинет', icon: HeartPulse, path: '/login?role=patient' },
  { id: 'owner', title: 'Я владелец клиники', subtitle: 'Управление', icon: Building2, path: '/login?role=owner' },
  { id: 'admin', title: 'Я администратор', subtitle: 'Операции', icon: Users, path: '/login?role=admin' },
  { id: 'student', title: 'Я хочу учиться', subtitle: 'Academy', icon: GraduationCap, path: '/school' },
  { id: 'buyer', title: 'Я хочу купить', subtitle: 'Marketplace', icon: ShoppingBag, path: '/shop' },
] as const

export default function Welcome() {
  const navigate = useNavigate()
  const { isAuthenticated, loading } = useAuth()

  React.useEffect(() => {
    if (!loading && isAuthenticated) navigate('/ai', { replace: true })
  }, [isAuthenticated, loading, navigate])

  return (
    <main className="dv-welcome min-h-[100dvh] overflow-x-hidden bg-surface-0 px-4 py-6 text-left text-txt-primary md:flex md:justify-center">
      <div className="flex min-h-[calc(100dvh-3rem)] w-full max-w-[390px] flex-col md:min-h-[calc(100dvh-3rem)] md:max-w-5xl">
        <header className="flex items-start justify-between">
          <button type="button" onClick={() => navigate('/')} className="min-h-11 text-left" aria-label="DentVision">
            <span className="block text-[20px] font-normal leading-6 tracking-[-0.02em]">DentVision</span>
            <span className="block text-[10px] leading-3 text-dv-gold">by Dr.Tamirlan</span>
          </button>
          <button type="button" onClick={() => navigate('/login')} className="hidden min-h-11 rounded-xl border border-bdr px-4 text-xs font-semibold md:block">
            Войти
          </button>
        </header>

        <section className="flex flex-1 flex-col pt-[28px] md:justify-center md:pt-0">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32 }}>
            <div className="flex h-8 w-full items-center rounded-2xl border border-bdr bg-dv-gold-muted px-3.5">
              <span className="text-[9px] uppercase leading-3 text-dv-gold">AI Operating System for Dentistry</span>
            </div>

            <h1 className="mt-6 max-w-[320px] text-4xl font-normal leading-[1.2] tracking-[-0.025em] md:text-5xl">
              Ваша стоматология.<br />В одной системе.
            </h1>
            <p className="mt-1.5 max-w-[300px] text-[12px] leading-[1.25] text-txt-secondary">
              AI, клиника, пациенты, обучение, диагностика<br className="hidden md:block" /> и Shop — без лишней сложности.
            </p>

            <button type="button" onClick={() => navigate('/ai')} className="mt-9 flex h-14 w-full items-center justify-between rounded-2xl bg-dv-gold px-[18px] text-sm font-medium text-dv-gold-on transition-transform active:scale-[0.99]">
              <span>Спросить DentVision AI</span>
              <ArrowRight size={19} strokeWidth={1.8} />
            </button>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
              {roles.map((role, index) => {
                const Icon = role.icon
                return (
                  <motion.button key={role.id} type="button" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: index * 0.035 }} onClick={() => navigate(role.path)} className="group min-h-[58px] rounded-2xl border border-bdr bg-surface-1 px-3 py-2.5 text-left transition-colors hover:border-dv-gold/40 md:min-h-[82px]">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-[11px] leading-[13px] text-txt-primary">{role.title}</span>
                        <span className="mt-2 block text-[9px] leading-3 text-txt-secondary">{role.subtitle}</span>
                      </span>
                      <Icon size={15} strokeWidth={1.6} className="hidden shrink-0 text-dv-gold md:block" />
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        </section>

        <p className="mt-5 pb-1 text-[9px] leading-3 text-txt-secondary md:pb-0">Начните без аккаунта. Вход нужен только для действий с вашими данными.</p>
      </div>
    </main>
  )
}
