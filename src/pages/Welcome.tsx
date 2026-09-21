import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Building2, GraduationCap, HeartPulse, Search, ShoppingBag, Stethoscope, BriefcaseBusiness, FlaskConical, Sparkles, Users, CheckCircle2, ScanLine, Truck, Mic2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth.store'

const intents = [
  { id: 'patient', title: 'Записаться к врачу', subtitle: 'Найти клинику и свободное время', icon: HeartPulse, path: '/book/discover' },
  { id: 'diagnostics', title: 'Найти диагностику', subtitle: 'Исследования и диагностические центры', icon: Search, path: '/diagnostics/discover' },
  { id: 'lab', title: 'Работать с лабораторией', subtitle: 'Заказы, производство и сроки', icon: FlaskConical, path: '/login?role=lab' },
  { id: 'shop', title: 'Купить', subtitle: 'Материалы, оборудование и расходники', icon: ShoppingBag, path: '/shop' },
  { id: 'academy', title: 'Учиться', subtitle: 'Курсы и профессиональное развитие', icon: GraduationCap, path: '/school' },
  { id: 'jobs', title: 'Найти работу', subtitle: 'Вакансии в стоматологии', icon: BriefcaseBusiness, path: '/jobs' },
] as const

const workRoles = [
  { id: 'doctor', title: 'Я врач', subtitle: 'AI, пациенты и лечение', icon: Stethoscope, path: '/login?role=doctor' },
  { id: 'owner', title: 'Я владелец клиники', subtitle: 'Команда, пациенты, финансы и операции', icon: Building2, path: '/login?role=owner&returnUrl=%2Fmy-clinics%3Fcreate%3Dclinic' },
  { id: 'dental_lab', title: 'Я зуботехническая лаборатория', subtitle: 'Заказы, производство и сроки', icon: FlaskConical, path: '/login?role=owner&returnUrl=%2Fregister-diagnostics%3Ftype%3Ddental_laboratory' },
  { id: 'medical_lab', title: 'Я медицинская лаборатория', subtitle: 'Исследования, результаты и клиники', icon: FlaskConical, path: '/login?role=owner&returnUrl=%2Fregister-diagnostics%3Ftype%3Dlaboratory' },
  { id: 'diagnostic_center', title: 'Я диагностический центр', subtitle: 'Направления, исследования и результаты', icon: ScanLine, path: '/login?role=owner&returnUrl=%2Fregister-diagnostics%3Ftype%3Dcenter' },
  { id: 'supplier', title: 'Я поставщик', subtitle: 'Товары, остатки, заказы и Marketplace', icon: Truck, path: '/login?role=supplier' },
  { id: 'academy', title: 'Я академия', subtitle: 'Курсы, преподаватели и слушатели', icon: GraduationCap, path: '/login?role=academy' },
  { id: 'lecturer', title: 'Я лектор', subtitle: 'Экспертный профиль, курсы и вебинары', icon: Mic2, path: '/login?role=lecturer' },
  { id: 'team', title: 'Я сотрудник клиники', subtitle: 'Администратор, ассистент, кассир или менеджер', icon: Users, path: '/login?role=admin' },
] as const

const principles = [
  'Начните без регистрации и изучите продукт.',
  'При защищённом действии система сама предложит регистрацию.',
  'Тариф, цена и доступные возможности должны быть понятны до оплаты.',
]

export default function Welcome() {
  const navigate = useNavigate()
  const { isAuthenticated, loading } = useAuth()
  React.useEffect(() => { if (!loading && isAuthenticated) navigate('/ai', { replace: true }) }, [isAuthenticated, loading, navigate])

  return (
    <main className="dv-welcome min-h-[100dvh] overflow-x-hidden bg-surface-0 px-4 py-6 text-left text-txt-primary md:flex md:justify-center">
      <div className="flex min-h-[calc(100dvh-3rem)] w-full max-w-[390px] flex-col pb-20 md:max-w-5xl md:pb-0">
        <header className="flex items-start justify-between">
          <button type="button" onClick={() => navigate('/')} className="min-h-11 text-left" aria-label="DentVision"><span className="block text-[20px] font-normal leading-6 tracking-[-0.02em]">DentVision</span><span className="block text-[10px] leading-3 text-dv-gold">by Dr.Tamirlan</span></button>
          <button type="button" onClick={() => navigate('/login')} className="min-h-11 rounded-xl border border-bdr px-4 text-xs font-semibold">Войти</button>
        </header>
        <section className="flex flex-1 flex-col pt-[28px] md:justify-center md:pt-0">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32 }}>
            <div className="flex h-8 w-full items-center rounded-2xl border border-bdr bg-dv-gold-muted px-3.5"><Sparkles size={13} className="mr-2 text-dv-gold" /><span className="text-[9px] uppercase leading-3 text-dv-gold">AI Operating System for Dentistry</span></div>
            <h1 className="mt-6 max-w-[760px] text-4xl font-normal leading-[1.12] tracking-[-0.03em] md:text-6xl">Вся стоматология.<br />В одном пространстве.</h1>
            <p className="mt-3 max-w-[720px] text-[13px] leading-[1.5] text-txt-secondary md:text-sm">DentVision связывает пациента, врача, клинику, диагностику, лаборатории, поставщиков, обучение и работу одним контекстом. AI помогает найти следующий шаг и выполнить его в рамках ваших прав.</p>
            <div className="mt-5 grid max-w-[720px] gap-2 sm:grid-cols-3">{principles.map(text => <div key={text} className="flex gap-2 rounded-xl border border-bdr-subtle bg-surface-1 px-3 py-2.5"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-dv-gold" /><span className="text-[10px] leading-4 text-txt-secondary">{text}</span></div>)}</div>
            <div className="mt-6 flex max-w-[720px] flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => navigate('/ai')} className="flex h-14 flex-1 items-center justify-between rounded-2xl bg-dv-gold px-[18px] text-sm font-medium text-dv-gold-on transition-transform active:scale-[0.99]"><span>Попробовать DentVision AI</span><ArrowRight size={19} strokeWidth={1.8} /></button>
              <button type="button" onClick={() => navigate('/pricing')} className="h-14 rounded-2xl border border-bdr bg-surface-1 px-5 text-sm font-medium text-txt-primary hover:bg-surface-raised">Посмотреть тарифы</button>
            </div>
            <p className="mt-2 max-w-[720px] text-center text-[10px] text-txt-muted sm:text-left">Можно начать без регистрации. Регистрация нужна, когда вы сохраняете данные, создаёте рабочее пространство или выполняете защищённое действие.</p>
            <div className="mt-7 max-w-5xl"><div className="mb-3 flex items-end justify-between gap-3 px-1"><div><p className="text-[11px] font-semibold text-txt-primary">Что вы хотите сделать?</p><p className="mt-0.5 text-[10px] text-txt-muted">Начните с задачи — DentVision подскажет следующий шаг.</p></div></div><div className="grid grid-cols-2 gap-2.5 md:grid-cols-6">{intents.map((intent, index) => { const Icon = intent.icon; return <motion.button key={intent.id} type="button" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: index * 0.035 }} onClick={() => navigate(intent.path)} className="group min-h-[88px] rounded-2xl border border-bdr bg-surface-1 px-3 py-2.5 text-left transition-colors hover:border-dv-gold/40 hover:bg-surface-raised"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-dv-gold/10 text-dv-gold"><Icon size={15} strokeWidth={1.7} /></span><span className="mt-2 block truncate text-[11px] font-medium leading-[13px] text-txt-primary">{intent.title}</span><span className="mt-0.5 block line-clamp-2 text-[9px] leading-3 text-txt-secondary">{intent.subtitle}</span></motion.button> })}</div></div>
            <div className="mt-5 max-w-[720px] border-t border-bdr-subtle pt-4"><div className="mb-3 px-1"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-txt-muted">Кем вы будете в DentVision?</p><p className="mt-1 text-[10px] leading-4 text-txt-secondary">После регистрации DentVision предложит создать или подключить рабочую организацию. Для сотрудников используется приглашение владельца. Сотрудники подключаются к существующей организации по приглашению.</p></div><div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">{workRoles.map(role => { const Icon = role.icon; return <button key={role.id} type="button" onClick={() => navigate(role.path)} className="flex min-h-[64px] items-center gap-3 rounded-xl border border-bdr bg-surface-1 px-3.5 text-left transition-colors hover:border-dv-gold/35 hover:bg-surface-raised"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-dv-gold"><Icon size={17} strokeWidth={1.7} /></span><span className="min-w-0 flex-1"><span className="block text-[11px] font-medium text-txt-primary">{role.title}</span><span className="mt-0.5 block text-[9px] leading-3.5 text-txt-muted">{role.subtitle}</span></span><ArrowRight size={15} className="shrink-0 text-txt-muted" /></button> })}</div></div>
            <div className="mt-6 grid max-w-[720px] grid-cols-1 gap-2 border-t border-bdr-subtle pt-4 sm:grid-cols-3"><div className="px-1"><p className="text-[10px] font-semibold text-txt-primary">1. Выбор</p><p className="mt-1 text-[9px] leading-3.5 text-txt-muted">Задача или роль</p></div><div className="px-1"><p className="text-[10px] font-semibold text-txt-primary">2. Регистрация</p><p className="mt-1 text-[9px] leading-3.5 text-txt-muted">Аккаунт и рабочий контур создаются самостоятельно</p></div><div className="px-1"><p className="text-[10px] font-semibold text-txt-primary">3. Первый результат</p><p className="mt-1 text-[9px] leading-3.5 text-txt-muted">Система открывает нужное пространство</p></div></div>
          </motion.div>
        </section>
        <p className="mt-5 pb-1 text-[9px] leading-3 text-txt-secondary md:pb-0">Один контекст для пациента, врача, клиники, лаборатории, диагностики, поставщиков и образования.</p>
      </div>
    </main>
  )
}
