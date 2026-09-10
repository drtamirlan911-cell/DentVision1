import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowLeft, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react'
import { useAuth } from '@/store/auth.store'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { Button, Input } from '@/components/ui/ds'
import { Logo } from '@/components/brand'
import { cn } from '@/lib/utils'
import Register from './Register'

const CONTEXTS: Record<string, { title: string; description: string; register: string }> = {
  doctor: { title: 'Продолжить как врач', description: 'AI Workspace, пациенты, CRM и клинический рабочий процесс.', register: 'Создать аккаунт врача' },
  patient: { title: 'Продолжить как пациент / покупатель', description: 'Врачи, клиники, диагностика, покупки и личный кабинет.', register: 'Создать аккаунт пациента' },
  owner: { title: 'Войти в клинику как владелец', description: 'Команда, финансы, аналитика и управление клиникой.', register: 'Создать аккаунт владельца' },
  admin: { title: 'Продолжить как администратор', description: 'Записи, коммуникации и операционные задачи клиники.', register: 'Создать аккаунт администратора' },
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const { user, login, loginWithGoogle, loading, error, clinic, activeMembership } = useAuth()
  const role = params.get('role') || ''
  const context = CONTEXTS[role] || { title: 'Добро пожаловать в DentVision', description: 'Войдите, чтобы продолжить в своей рабочей среде.', register: 'Создать аккаунт' }
  const [loginStr, setLoginStr] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showRegister, setShowRegister] = useState(params.get('register') === '1')
  const [localError, setLocalError] = useState('')

  const returnUrl = useMemo(() => params.get('returnUrl') || ((location.state as any)?.from?.pathname ? `${(location.state as any).from.pathname}${(location.state as any).from.search || ''}` : '/'), [params, location.state])

  useEffect(() => {
    if (params.get('guest')) navigate('/', { replace: true })
  }, [params, navigate])

  useEffect(() => {
    if (!user) return
    if (params.get('portal') === 'patient') { navigate('/patient-portal', { replace: true }); return }
    const target = returnUrl.includes('/login') ? '/' : returnUrl
    const hasClinic = Boolean(clinic || activeMembership)
    navigate(hasClinic ? target : (user.platformRole === 'superadmin' ? '/admin' : '/my-clinics'), { replace: true })
  }, [user, clinic, activeMembership, navigate, params, returnUrl])

  if (showRegister) return <Register onBack={() => setShowRegister(false)} />

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLocalError('')
    if (!loginStr.trim() || loginStr.trim().length < 3) { setLocalError('Введите логин (минимум 3 символа)'); return }
    if (!password || password.length < 4) { setLocalError('Введите пароль (минимум 4 символа)'); return }
    await login(loginStr.trim(), password)
  }

  const displayError = error || localError

  return (
    <main className="relative min-h-screen min-h-[100dvh] bg-surface-0 text-txt-primary flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-dv-gold/8 via-transparent to-transparent" />
      <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full max-w-md rounded-3xl border border-dv-gold/20 bg-surface-1/95 p-6 sm:p-8 shadow-[0_40px_100px_rgba(0,0,0,.45)]">
        <button type="button" onClick={() => navigate('/')} className="mb-5 flex items-center gap-2 text-xs text-txt-muted hover:text-txt-primary"><ArrowLeft size={14} /> Вернуться в DentVision</button>
        <div className="text-center">
          <Logo variant="full" height={50} responsive={false} title="DentVision" />
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-dv-gold/20 bg-dv-gold/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-dv-gold"><LogIn size={12} /> {role ? `Режим: ${role}` : 'Авторизация'}</div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">{context.title}</h1>
          <p className="mt-2 text-xs leading-5 text-txt-muted">{context.description}</p>
        </div>

        {displayError && <div className="mt-5 flex gap-2 rounded-xl border border-error/25 bg-error/10 px-3 py-2.5 text-xs text-error"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{displayError}</div>}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Input label="Логин" value={loginStr} onChange={e => setLoginStr(e.target.value)} placeholder={role === 'doctor' ? 'doctor_ivan' : 'Введите логин'} autoComplete="username" className="min-h-11" />
          <Input label="Пароль" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Введите пароль" autoComplete="current-password" className="min-h-11" suffix={<button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>} />
          <Button type="submit" loading={loading} disabled={loading} variant="primary" size="lg" className="w-full min-h-11">{loading ? 'Входим…' : 'Войти в DentVision'}</Button>
        </form>

        <div className="mt-4"><GoogleSignInButton text="signin_with" onCredential={idToken => void loginWithGoogle(idToken)} /></div>
        <button type="button" onClick={() => navigate('/forgot-password')} className="mt-3 w-full text-center text-[11px] text-txt-muted hover:text-dv-gold">Забыли пароль?</button>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-bdr-subtle bg-surface-0 p-3">
          <div><div className="text-xs font-semibold">Новый пользователь?</div><div className="mt-0.5 text-[10px] text-txt-muted">Регистрация откроет доступ к экосистеме.</div></div>
          <button type="button" onClick={() => setShowRegister(true)} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-dv-gold/30 px-3 text-[11px] font-semibold text-dv-gold hover:bg-dv-gold/10"><UserPlus size={14} /> {context.register}</button>
        </div>
      </motion.section>
    </main>
  )
}
