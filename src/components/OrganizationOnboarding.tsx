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

type Mode = 'choice' | 'register' | 'join'

export function OrganizationOnboarding({ kind, onComplete }: OnboardingProps) {
  const toast = useToast()
  const [mode, setMode] = useState<Mode>('choice')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', city: '', address: '', phone: '', description: '' })
  const [inviteCode, setInviteCode] = useState('')

  const isCenter = kind === 'CENTER'
  const title = isCenter ? 'диагностический центр' : 'лабораторию'

  const handleRegister = async () => {
    if (!form.name.trim()) { toast.error('Укажите название'); return }
    if (!form.city.trim()) { toast.error('Укажите город'); return }
    setLoading(true)
    try {
      const fn = isCenter ? api.createDiagnosticCenter : api.createDiagnosticLaboratory
      await fn({ name: form.name.trim(), city: form.city.trim(), address: form.address.trim() || undefined, phone: form.phone.trim() || undefined, description: form.description.trim() || undefined })
      toast.success(`${isCenter ? 'Центр' : 'Лаборатория'} зарегистрирован`)
      onComplete()
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!inviteCode.trim()) { toast.error('Введите код приглашения'); return }
    setLoading(true)
    try {
      await api.joinOrganizationByInvite(inviteCode.trim())
      toast.success('Вы присоединились к организации')
      onComplete()
    } catch (e: any) {
      toast.error(e?.message || 'Неверный код приглашения')
    } finally {
      setLoading(false)
    }
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
              <h2 className="text-lg font-semibold text-txt-primary">Зарегистрировать {title}</h2>
              <p className="text-sm text-txt-muted mt-1">Заполните данные организации</p>
            </div>
            <div className="space-y-3">
              <Input label="Название *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={isCenter ? 'ТомоДент' : 'ЛабЭкспресс'} />
              <Input label="Город *" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Алматы" />
              <Input label="Адрес" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="ул. Примерная 1" />
              <Input label="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+7 7XX XXX XX XX" />
              <Input label="Описание" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Услуги и специализация" />
            </div>
            <Button className="w-full min-h-11" loading={loading} onClick={handleRegister}>
              Зарегистрировать
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
            <Input label="Код приглашения" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="Введите код..." />
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
            Зарегистрируйте {title} на платформе и получайте направления от клиник
          </p>
          <span className="inline-flex items-center gap-1 text-sm text-dv-gold group-hover:gap-2 transition-all">
            Зарегистрировать <ArrowRight size={14} />
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
