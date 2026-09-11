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
    <main className="dv-welcome min-h-[100dvh] overflow-x-hidden bg-surface-0 px-4 py-5 text-left text-txt-primary sm:px-5 sm:py-6 md:flex md:justify-center">
      <div className="flex min-h-[calc(100dvh-2.5rem)] w-full max-w-[390px] flex-col md:min-h-[calc(100dvh-3rem)] md:max-w-5xl">
        <header className="flex items-start justify-between">
          <button type="button" onClick={() => navigate('/')} className="min-h-11 text-left" aria-label="DentVision">
            <span className="block text-[20px] font-normal leading-6 tracking-[-0.02em]">DentVision</span>
            <span className="block text-[10px] leading-3 text-dv-gold">by Dr.Tamirlan</span>
          </button>
          <button type="button" onClick={() => navigate('/login')} className="min-h-11 rounded-xl border border-bdr px-3.5 text-[11px] font-semibold text-txt-primary transition-colors hover:border-dv-gold/40 hover:text-dv-gold md:px-4 md:text-xs">
            Войти
          </button>
        </header>

        <section className="flex flex-1 flex-col pt-6 md:justify-center md:pt-0">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32 }}>
            <div className="flex h-8 w-full items-center rounded-2xl border border-bdr bg-dv-gold-muted px-3.5">
              <span className="text-[9px] uppercase leading-3 text-dv-gold">AI Operating System for Dentistry</span>
            </div>

            <h1 className="mt-5 max-w-[320px] text-[36px] font-normal leading-[1.17] tracking-[-0.025em] md:mt-6 md:text-5xl">
              Ваша стоматология.<br />В одной системе.
            </h1>
            <p className="mt-2 max-w-[310px] text-[12px] leading-[1.35] text-txt-secondary">
              AI, клиника, пациенты, обучение, диагностика<br className="hidden md:block" /> и Shop — без лишней сложности.
            </p>

            <button type="button" onClick={() => navigate('/ai')} className="mt-7 flex h-14 w-full items-center justify-between rounded-2xl bg-dv-gold px-[18px] text-sm font-medium text-dv-gold-on transition-transform active:scale-[0.99]">
              <span>Спросить DentVision AI</span>
              <ArrowRight size={19} strokeWidth={1.8} />
            </button>

            <div className="mt-4 grid grid-cols-2 gap-2.5 md:mt-5 md:grid-cols-3 md:gap-3">
              {roles.map((role, index) => {
                const Icon = role.icon
                return (
                  <motion.button key={role.id} type="button" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: index * 0.035 }} onClick={() => navigate(role.path)} className="group min-h-[64px] rounded-2xl border border-bdr bg-surface-1 px-3 py-2.5 text-left transition-colors hover:border-dv-gold/40 active:scale-[0.99] md:min-h-[82px]">
                    <span className="flex h-full items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block text-[11px] leading-[13px] text-txt-primary">{role.title}</span>
                        <span className="mt-1.5 block text-[9px] leading-3 text-txt-secondary">{role.subtitle}</span>
                      </span>
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-dv-gold-muted text-dv-gold transition-colors group-hover:bg-dv-gold/15">
                        <Icon size={14} strokeWidth={1.6} aria-hidden="true" />
                      </span>
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        </section>

        <p className="mt-4 pb-1 text-[9px] leading-3 text-txt-secondary md:pb-0">Начните без аккаунта. Вход нужен только для действий с вашими данными.</p>
      </div>
    </main>
  )
}
