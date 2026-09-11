import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Building2, GraduationCap, HeartPulse, ShoppingBag, Stethoscope } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth.store'

const intents = [
  { id: 'doctor', title: 'Я врач', subtitle: 'AI и работа с пациентами', icon: Stethoscope, path: '/login?role=doctor' },
  { id: 'clinic', title: 'Моя клиника', subtitle: 'Управление и команда', icon: Building2, path: '/login?role=owner' },
  { id: 'patient', title: 'Я пациент', subtitle: 'Запись и личный кабинет', icon: HeartPulse, path: '/login?role=patient' },
  { id: 'academy', title: 'Хочу учиться', subtitle: 'Курсы и Academy', icon: GraduationCap, path: '/school' },
  { id: 'shop', title: 'Хочу купить', subtitle: 'Товары и оборудование', icon: ShoppingBag, path: '/shop' },
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
          <button type="button" onClick={() => navigate('/login')} className="min-h-11 rounded-xl border border-bdr px-4 text-xs font-semibold">
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
            <p className="mt-1.5 max-w-[310px] text-[12px] leading-[1.35] text-txt-secondary">
              AI, клиника, пациенты, диагностика, обучение и Shop — в одном рабочем пространстве.
            </p>

            <button type="button" onClick={() => navigate('/ai')} className="mt-9 flex h-14 w-full items-center justify-between rounded-2xl bg-dv-gold px-[18px] text-sm font-medium text-dv-gold-on transition-transform active:scale-[0.99]">
              <span>Попробовать DentVision AI</span>
              <ArrowRight size={19} strokeWidth={1.8} />
            </button>
            <p className="mt-2 text-center text-[10px] text-txt-muted">Без регистрации. Войдите только для работы с личными данными.</p>

            <div className="mt-6">
              <p className="mb-3 px-1 text-[11px] font-medium text-txt-secondary">Что вы хотите сделать?</p>
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
                {intents.map((intent, index) => {
                  const Icon = intent.icon
                  return (
                    <motion.button key={intent.id} type="button" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: index * 0.035 }} onClick={() => navigate(intent.path)} className="group min-h-[76px] rounded-2xl border border-bdr bg-surface-1 px-3 py-2.5 text-left transition-colors hover:border-dv-gold/40">
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-dv-gold/10 text-dv-gold"><Icon size={15} strokeWidth={1.7} /></span>
                      </span>
                      <span className="mt-2 block truncate text-[11px] font-medium leading-[13px] text-txt-primary">{intent.title}</span>
                      <span className="mt-0.5 block line-clamp-1 text-[9px] leading-3 text-txt-secondary">{intent.subtitle}</span>
                    </motion.button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        </section>

        <p className="mt-5 pb-1 text-[9px] leading-3 text-txt-secondary md:pb-0">DentVision объединяет клинику, AI, диагностику, обучение и покупки, сохраняя единый контекст.</p>
      </div>
    </main>
  )
}
