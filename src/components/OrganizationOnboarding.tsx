import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Building2, UserPlus, ArrowRight, Check, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/ds/Card'
import { Button } from '@/components/ui/ds/Button'
import { Input } from '@/components/ui/ds/Input'
import { useToast } from '@/components/ui/ds/Toast'
import * as api from '@/utils/api'

interface OnboardingProps {
  kind: 'CENTER' | 'LAB'
  onComplete: () => void
}

type Mode = 'choice' | 'register' | 'join' | 'submitted'

/** The diagnostics member vocabulary, in the words a person recognises. */
const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  radiologist: 'Рентгенолог',
  operator: 'Оператор',
}

/**
 * The two ways into a diagnostic centre or laboratory workspace.
 *
 * Both used to be dead ends. "Become a partner" posted to
 * `POST /diagnostics/centers`, which is superadmin-only — a 403 for exactly the
 * user this screen exists for. It now files a registration request, which is
 * the path that has always worked end to end: a request the platform reviews,
 * and on approval the organisation is created and the applicant is made its
 * owner. Moderation is deliberate — a centre receives referrals carrying
 * patient names and diagnoses.
 *
 * "Join an organisation" called `POST /iam/join-by-invite`, which did not
 * exist. It does now, along with the invite codes it consumes.
 */
export function OrganizationOnboarding({ kind, onComplete }: OnboardingProps) {
  const toast = useToast()
  const [mode, setMode] = useState<Mode>('choice')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', city: '', address: '', phone: '', email: '', comment: '' })
  const [inviteCode, setInviteCode] = useState('')
  const [preview, setPreview] = useState<{ name: string; role: string } | null>(null)

  const isCenter = kind === 'CENTER'
  const title = isCenter ? 'диагностический центр' : 'лабораторию'

  const handleRegister = async () => {
    if (!form.name.trim()) { toast.error('Укажите название'); return }
    if (!form.city.trim()) { toast.error('Укажите город'); return }
    setLoading(true)
    try {
      await api.submitDiagnosticsRegistration({
        type: isCenter ? 'center' : 'laboratory',
        name: form.name.trim(),
        city: form.city.trim(),
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        comment: form.comment.trim() || undefined,
      })
      setMode('submitted')
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось отправить заявку')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    const code = inviteCode.trim()
    if (!code) { toast.error('Введите код приглашения'); return }
    setLoading(true)
    try {
      const result = await api.joinOrganizationByInvite(code)
      toast.success(`Вы присоединились: ${result?.organizationName || 'организация'}`)
      onComplete()
    } catch (e: any) {
      // The server distinguishes not-found, spent, expired and wrong-recipient;
      // showing its message is more useful than one generic line.
      toast.error(e?.message || 'Неверный код приглашения')
    } finally {
      setLoading(false)
    }
  }

  // Look the code up before committing, so the invitee sees which organisation
  // and which role they are about to accept.
  const handleLookup = async () => {
    const code = inviteCode.trim()
    if (!code) return
    setPreview(null)
    try {
      const data = await api.lookupOrganizationInvite(code)
      setPreview({ name: data?.organization?.name || 'Организация', role: data?.role || '' })
    } catch (e: any) {
      toast.error(e?.message || 'Приглашение не найдено')
    }
  }

  if (mode === 'submitted') {
    // Say what actually happened. The previous copy claimed the organisation
    // was registered; nothing had been created, and the user was left waiting
    // for a workspace that would never appear.
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto p-4 sm:p-6">
        <Card padding="lg">
          <div className="space-y-4 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-success/10 flex items-center justify-center">
              <Check size={26} className="text-success" />
            </div>
            <h2 className="text-lg font-semibold text-txt-primary">Заявка отправлена</h2>
            <p className="text-sm text-txt-muted">
              Мы проверим данные и активируем {title}. После одобрения кабинет откроется
              автоматически — вы станете его владельцем.
            </p>
            <Button variant="secondary" className="min-h-11" onClick={() => setMode('choice')}>
              Вернуться
            </Button>
          </div>
        </Card>
      </motion.div>
    )
  }

  if (mode === 'register') {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto p-4 sm:p-6">
        <Card padding="lg">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setMode('choice')} className="text-txt-muted hover:text-txt-primary">← Назад</button>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-txt-primary">Заявка на регистрацию</h2>
              <p className="text-sm text-txt-muted mt-1">
                Заполните данные — мы проверим их и активируем {title}
              </p>
            </div>
            <div className="space-y-3">
              <Input label="Название *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={isCenter ? 'ТомоДент' : 'ЛабЭкспресс'} />
              <Input label="Город *" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Алматы" />
              <Input label="Адрес" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="ул. Примерная 1" />
              <Input label="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+7 7XX XXX XX XX" />
              <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="info@example.kz" />
              <Input label="Комментарий" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="Услуги и специализация" />
            </div>
            <Button className="w-full min-h-11" loading={loading} onClick={handleRegister}>
              Отправить заявку
            </Button>
          </div>
        </Card>
      </motion.div>
    )
  }

  if (mode === 'join') {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto p-4 sm:p-6">
        <Card padding="lg">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setMode('choice')} className="text-txt-muted hover:text-txt-primary">← Назад</button>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-txt-primary">Войти в организацию</h2>
              <p className="text-sm text-txt-muted mt-1">Введите код приглашения от вашей организации</p>
            </div>
            <Input
              label="Код приглашения"
              value={inviteCode}
              onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setPreview(null) }}
              onBlur={handleLookup}
              placeholder="Например, 4F2A9C1B"
            />
            {preview && (
              <div className="rounded-xl border border-bdr-subtle bg-surface-1 p-4">
                <p className="text-sm text-txt-primary font-medium">{preview.name}</p>
                {preview.role && <p className="text-sm text-txt-muted mt-1">Роль: {ROLE_LABELS[preview.role] || preview.role}</p>}
              </div>
            )}
            <Button className="w-full min-h-11" loading={loading} onClick={handleJoin}>
              Присоединиться
            </Button>
          </div>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto p-4 sm:p-6">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-txt-primary">{isCenter ? 'Диагностический центр' : 'Лаборатория'}</h1>
        <p className="text-sm text-txt-muted mt-2">Выберите как вы хотите начать работу</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => setMode('register')}
          className="group text-left rounded-2xl border border-bdr-subtle bg-surface-raised p-6 transition-all hover:border-dv-gold/30 hover:bg-dv-gold/[0.03]"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-xl bg-dv-gold/10 flex items-center justify-center">
              <Building2 size={22} className="text-dv-gold" />
            </div>
            <h3 className="text-base font-semibold text-txt-primary">Стать партнёром</h3>
          </div>
          <p className="text-sm text-txt-muted mb-4">
            Подайте заявку на {isCenter ? 'диагностический центр' : 'лабораторию'}. После проверки
            вы получите кабинет и направления от клиник
          </p>
          <span className="inline-flex items-center gap-1 text-sm text-dv-gold group-hover:gap-2 transition-all">
            Подать заявку <ArrowRight size={14} />
          </span>
        </button>
        <button
          onClick={() => setMode('join')}
          className="group text-left rounded-2xl border border-bdr-subtle bg-surface-raised p-6 transition-all hover:border-dv-gold/30 hover:bg-dv-gold/[0.03]"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-xl bg-dv-gold/10 flex items-center justify-center">
              <UserPlus size={22} className="text-dv-gold" />
            </div>
            <h3 className="text-base font-semibold text-txt-primary">Войти в организацию</h3>
          </div>
          <p className="text-sm text-txt-muted mb-4">
            Присоединитесь к существующей организации по коду приглашения
          </p>
          <span className="inline-flex items-center gap-1 text-sm text-dv-gold group-hover:gap-2 transition-all">
            Войти <ArrowRight size={14} />
          </span>
        </button>
      </div>
    </motion.div>
  )
}
