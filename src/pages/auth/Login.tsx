import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { motion, type Variants } from 'framer-motion'
import { useAuth } from '@/store/auth.store'
import { Button, Input } from '@/components/ui/ds'
import { cn } from '@/lib/utils'
import {
  Stethoscope,
  Eye,
  EyeOff,
  AlertTriangle,
  Check,
  LogIn,
} from 'lucide-react'
import Register from './Register'

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.15 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 40, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1 },
}

interface FormErrors {
  login?: string
  password?: string
}

const easing = { duration: 0.5, ease: 'easeOut' } as const
const cardEasing = { duration: 0.7, ease: 'easeOut' } as const

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user, login, loading, error, clinic, activeMembership } = useAuth()
  const [loginStr, setLoginStr] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [localError, setLocalError] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [showRegister, setShowRegister] = useState(false)

  useEffect(() => {
    if (searchParams.get('guest')) {
      navigate('/', { replace: true });
    }
  }, [searchParams, navigate]);

  const returnUrl = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get('returnUrl');
    if (returnUrl) return returnUrl;
    if (location.pathname !== '/login') {
      return location.pathname + location.search + location.hash;
    }
    return '/';
  }, [location]);

  useEffect(() => {
    if (user) {
      const target = returnUrl.includes('/login') ? '/' : returnUrl;
      // If user has no clinic, force redirect to my-clinics to create/join one
      const hasClinic = clinic || activeMembership;
      navigate(hasClinic ? target : '/my-clinics', { replace: true });
    }
  }, [user, clinic, activeMembership, navigate, returnUrl]);

  if (showRegister) return <Register onBack={() => setShowRegister(false)} />

  const validate = (): boolean => {
    const newErrors: FormErrors = {}
    if (!loginStr.trim()) newErrors.login = 'Введите логин'
    else if (loginStr.trim().length < 3) newErrors.login = 'Логин должен содержать минимум 3 символа'
    if (!password.trim()) newErrors.password = 'Введите пароль'
    else if (password.length < 4) newErrors.password = 'Пароль должен содержать минимум 4 символа'
    setErrors(newErrors)
    setTouched({ login: true, password: true })
    return Object.keys(newErrors).length === 0
  }

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    if (field === 'login' && !loginStr.trim()) {
      setErrors((prev) => ({ ...prev, login: 'Введите логин' }))
    }
    if (field === 'password' && !password.trim()) {
      setErrors((prev) => ({ ...prev, password: 'Введите пароль' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')
    if (!validate()) return
    await login(loginStr.trim(), password)
  }

  const displayError = error || localError

  return (
    <div className="relative min-h-screen min-h-[100dvh] bg-surface-0 flex items-center justify-center p-4 sm:p-5 overflow-hidden" style={{ paddingTop: 'max(1rem, var(--dv-safe-top, 0px))', paddingBottom: 'max(1rem, var(--dv-safe-bottom, 0px))' }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-48 -right-48 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(201,169,110,0.12) 0%, transparent 70%)' }}
          animate={{ x: [0, 40, -20, 60, 0], y: [0, -30, 50, -10, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(41,128,185,0.08) 0%, transparent 70%)' }}
          animate={{ x: [0, -50, 30, -20, 0], y: [0, 40, -30, 20, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(201,169,110,0.06) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.15, 0.95, 1.1, 1], opacity: [0.4, 0.7, 0.3, 0.6, 0.4] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={cardEasing}
        className={cn(
          'relative z-10 w-full max-w-[420px]',
          'bg-white/[0.03] backdrop-blur-2xl',
          'border border-dv-gold/20',
          'rounded-2xl py-9 px-6 sm:px-8',
          'shadow-[0_40px_80px_rgba(0,0,0,0.5)]',
        )}
      >
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-5"
        >
          <motion.div variants={itemVariants} transition={easing} className="text-center">
            <div className="mb-3 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-dv-gold/20 blur-2xl rounded-full" />
                <Stethoscope size={44} className="relative text-dv-gold drop-shadow-[0_4px_12px_rgba(201,169,110,0.4)]" />
              </div>
            </div>
            <h1 className="font-serif text-[28px] font-bold text-txt-primary tracking-tight">
              DentVision
            </h1>
            <p className="text-xs text-txt-muted mt-1.5 max-w-[240px] mx-auto leading-relaxed">
              CRM-система для стоматологических клиник
            </p>
          </motion.div>

          {displayError && (
            <motion.div
              variants={itemVariants}
              transition={easing}
              className="flex items-start gap-2.5 bg-error/10 border border-error/25 rounded-xl px-4 py-3"
            >
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-error" />
              <span className="text-xs text-error font-medium leading-relaxed">{displayError}</span>
            </motion.div>
          )}

          <motion.form variants={itemVariants} transition={easing} onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Логин"
              type="text"
              value={loginStr}
              onChange={(e) => { setLoginStr(e.target.value); if (touched.login) setErrors((prev) => ({ ...prev, login: '' })) }}
              onBlur={() => handleBlur('login')}
              placeholder="admin_c1"
              autoComplete="username"
              error={touched.login ? errors.login : undefined}
            />

            <div className="space-y-1">
              <Input
                label="Пароль"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (touched.password) setErrors((prev) => ({ ...prev, password: '' })) }}
                onBlur={() => handleBlur('password')}
                placeholder="••••••••"
                autoComplete="current-password"
                error={touched.password ? errors.password : undefined}
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="text-txt-muted hover:text-txt-primary transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div
                    className={cn(
                      'w-4 h-4 rounded border transition-all duration-200 flex items-center justify-center shrink-0',
                      rememberMe
                        ? 'bg-dv-gold border-dv-gold shadow-[0_0_6px_rgba(201,169,110,0.3)]'
                        : 'border-bdr-subtle bg-white/[0.03] group-hover:border-dv-gold/40',
                    )}
                    onClick={() => setRememberMe((r) => !r)}
                  >
                    {rememberMe && <Check size={10} className="text-surface-0" strokeWidth={3} />}
                  </div>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only"
                  />
                  <span className="text-[11px] text-txt-muted group-hover:text-txt-secondary transition-colors select-none">
                    Запомнить меня
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="bg-transparent border-none text-dv-gold text-[11px] cursor-pointer p-0 hover:text-dv-gold-light transition-colors"
                >
                  Забыли пароль?
                </button>
              </div>
            </div>

            <Button
              type="submit"
              loading={loading}
              disabled={loading}
              variant="primary"
              size="lg"
              className="w-full h-10 text-sm font-bold"
            >
              {loading ? 'Вход…' : 'Войти в систему'}
            </Button>
          </motion.form>

          <motion.div
            variants={itemVariants}
            transition={easing}
            className="flex items-center justify-between gap-3 bg-success/5 border border-success/15 rounded-xl px-4 py-3"
          >
            <div>
              <div className="text-xs text-success font-bold">Новая клиника?</div>
              <div className="text-[11px] text-txt-muted">14 дней бесплатно</div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowRegister(true)}
              className="shrink-0 border-success/30 text-success hover:bg-success/10 hover:border-success/50 hover:text-success"
            >
              Зарегистрироваться →
            </Button>
          </motion.div>

          <motion.div
            variants={itemVariants}
            transition={easing}
            className="bg-dv-gold/[0.04] border border-dv-gold/10 rounded-xl px-4 py-3.5"
          >
            <div className="text-[10px] text-dv-gold font-bold mb-2.5 uppercase tracking-[0.08em] flex items-center gap-1.5">
              <LogIn size={12} />
              Demo-доступ
            </div>
            <div className="space-y-1">
              {[
                { login: 'owner@dentvision.kz', pass: 'Demo1234!', role: 'Владелец (демо-клиника)' },
                { login: 'doctor@dentvision.kz', pass: 'Demo1234!', role: 'Врач' },
                { login: 'super@dentvision.kz', pass: 'Demo1234!', role: 'Super Admin' },
              ].map((d, i) => (
                <motion.button
                  key={i}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.99 }}
                  type="button"
                  onClick={() => { setLoginStr(d.login); setPassword(d.pass); setErrors({}); setTouched({}) }}
                  className={cn(
                    'w-full text-left bg-transparent border-none py-1.5 px-2 rounded-lg cursor-pointer',
                    'transition-colors duration-150',
                    'hover:bg-dv-gold/[0.06]',
                  )}
                >
                  <span className="text-xs text-dv-gold font-semibold">{d.login}</span>
                  <span className="text-[11px] text-txt-muted"> / {d.pass}</span>
                  <span className="text-[11px] text-txt-ghost italic"> — {d.role}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  )
}
