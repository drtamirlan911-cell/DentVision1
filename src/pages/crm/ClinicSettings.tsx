/**
 * CRM → Настройки клиники
 * Доступ: только Руководитель (owner/director) и Администратор.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Navigate, useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Settings, Building2, Clock, Bell, Armchair, Save, Plus, Trash2,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth, canManageClinicSettings } from '@/store/auth.store'
import { useToast } from '@/components/ui/ds/Toast'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/ds/Card'
import { Button } from '@/components/ui/ds/Button'
import { Input, Select } from '@/components/ui/ds/Input'
import { Switch } from '@/components/ui/ds/Misc'
import { Badge } from '@/components/ui/ds/Badge'
import { queryKeys } from '@/queries/keys'
import * as api from '@/utils/api'
import type { Clinic, ClinicSettings, Chair, User, RoleInfo } from '@/types'

const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }

const WEEKDAYS = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 7, label: 'Вс' },
]

const DEFAULT_SETTINGS: ClinicSettings = {
  timezone: 'Asia/Almaty',
  currency: 'KZT',
  locale: 'ru-KZ',
  workStart: '08:00',
  workEnd: '20:00',
  workDays: [1, 2, 3, 4, 5, 6],
  lunchStart: '12:00',
  lunchEnd: '13:00',
  reminderHours: 24,
  reminderUrgentHours: 2,
  hygieneMonths: 6,
  bookingSlotMinutes: 30,
  overbookingAllowed: false,
  whatsappEnabled: true,
  smsEnabled: false,
  defaultAppointmentDuration: 60,
  invoicePrefix: 'DV',
  taxPercent: 0,
  notifyNoShow: true,
  requireChair: false,
}

interface OutletCtx {
  clinic?: Clinic
  user?: User
  roleInfo?: RoleInfo
}

export default function ClinicSettingsPage() {
  const outlet = useOutletContext<OutletCtx>() || {}
  const auth = useAuth()
  const clinicId = outlet.clinic?.id || auth.clinic?.id || auth.user?.clinicId || ''
  const role = auth.activeMembership?.role || auth.role
  const allowed = canManageClinicSettings(role) || !!auth.roleInfo?.canManageClinicSettings
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const [profile, setProfile] = useState({ name: '', city: '', address: '', phone: '', logo: '' })
  const [settings, setSettings] = useState<ClinicSettings>({ ...DEFAULT_SETTINGS })
  const [saving, setSaving] = useState(false)
  const [newChairName, setNewChairName] = useState('')

  const clinicQ = useQuery({
    queryKey: ['clinic-settings', clinicId],
    queryFn: () => api.getClinicSettings(clinicId),
    enabled: !!clinicId && allowed,
  })

  const chairsQ = useQuery({
    queryKey: queryKeys.chairs,
    queryFn: () => api.getChairs(clinicId),
    enabled: !!clinicId && allowed,
  })

  useEffect(() => {
    const data = clinicQ.data
    if (!data) return
    const c = data.clinic || data
    setProfile({
      name: c.name || '',
      city: c.city || '',
      address: c.address || '',
      phone: c.phone || '',
      logo: c.logo || '',
    })
    setSettings({ ...DEFAULT_SETTINGS, ...(data.settings || c.settings || {}) })
  }, [clinicQ.data])

  const chairs: Chair[] = chairsQ.data || []

  const workDaySet = useMemo(() => new Set(settings.workDays || []), [settings.workDays])

  if (!allowed) {
    return <Navigate to="/crm/schedule" replace />
  }

  if (!clinicId) {
    return <p className="text-sm text-txt-muted p-6">Выберите клинику</p>
  }

  const toggleWorkDay = (day: number) => {
    const next = new Set(workDaySet)
    if (next.has(day)) next.delete(day)
    else next.add(day)
    setSettings({ ...settings, workDays: [...next].sort() })
  }

  const saveAll = async () => {
    if (!profile.name.trim()) {
      showToast('Укажите название клиники', 'warning')
      return
    }
    setSaving(true)
    try {
      await api.updateClinic(clinicId, {
        name: profile.name.trim(),
        city: profile.city.trim(),
        address: profile.address.trim(),
        phone: profile.phone.trim(),
        logo: profile.logo.trim(),
        settings,
      })
      await queryClient.invalidateQueries({ queryKey: ['clinic-settings', clinicId] })
      showToast('Настройки клиники сохранены', 'success')
    } catch (err: any) {
      showToast(err?.message || 'Не удалось сохранить', 'error')
    } finally {
      setSaving(false)
    }
  }

  const addChair = async () => {
    const name = newChairName.trim() || `Кресло ${chairs.length + 1}`
    try {
      await api.upsertChair({ name, sortOrder: chairs.length + 1, active: true })
      setNewChairName('')
      await chairsQ.refetch()
      showToast('Кресло добавлено', 'success')
    } catch (err: any) {
      showToast(err?.message || 'Ошибка', 'error')
    }
  }

  const removeChair = async (id: string) => {
    try {
      await api.deleteChair(id)
      await chairsQ.refetch()
      showToast('Кресло скрыто', 'info')
    } catch (err: any) {
      showToast(err?.message || 'Ошибка', 'error')
    }
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="max-w-3xl mx-auto space-y-5 p-1"
    >
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader
          title="Настройки клиники"
          subtitle="Индивидуальная конфигурация этой клиники"
          icon={<Settings size={20} />}
        />
        <Button onClick={saveAll} disabled={saving} icon={<Save size={14} />}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 size={16} className="text-dv-gold" />
              Профиль клиники
            </CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            <Input label="Название" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            <Input label="Город" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} />
            <Input label="Адрес" value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} className="sm:col-span-2" />
            <Input label="Телефон" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            <Input label="Логотип (URL)" value={profile.logo} onChange={(e) => setProfile({ ...profile, logo: e.target.value })} />
            <Select
              label="Валюта"
              value={settings.currency || 'KZT'}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              options={[
                { value: 'KZT', label: '₸ KZT' },
                { value: 'USD', label: '$ USD' },
                { value: 'EUR', label: '€ EUR' },
                { value: 'RUB', label: '₽ RUB' },
              ]}
            />
            <Select
              label="Часовой пояс"
              value={settings.timezone || 'Asia/Almaty'}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              options={[
                { value: 'Asia/Almaty', label: 'Asia/Almaty' },
                { value: 'Asia/Aqtobe', label: 'Asia/Aqtobe' },
                { value: 'Asia/Oral', label: 'Asia/Oral' },
                { value: 'Europe/Moscow', label: 'Europe/Moscow' },
              ]}
            />
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock size={16} className="text-dv-gold" />
              Расписание работы
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleWorkDay(d.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    workDaySet.has(d.value)
                      ? 'bg-dv-gold/20 border-dv-gold/40 text-dv-gold'
                      : 'border-bdr-subtle text-txt-muted hover:text-txt-secondary'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Начало дня" type="time" value={settings.workStart || '08:00'} onChange={(e) => setSettings({ ...settings, workStart: e.target.value })} />
              <Input label="Конец дня" type="time" value={settings.workEnd || '20:00'} onChange={(e) => setSettings({ ...settings, workEnd: e.target.value })} />
              <Input label="Обед с" type="time" value={settings.lunchStart || '12:00'} onChange={(e) => setSettings({ ...settings, lunchStart: e.target.value })} />
              <Input label="Обед до" type="time" value={settings.lunchEnd || '13:00'} onChange={(e) => setSettings({ ...settings, lunchEnd: e.target.value })} />
              <Select
                label="Шаг слота"
                value={settings.bookingSlotMinutes || 30}
                onChange={(e) => setSettings({ ...settings, bookingSlotMinutes: Number(e.target.value) })}
                options={[
                  { value: 15, label: '15 мин' },
                  { value: 30, label: '30 мин' },
                  { value: 45, label: '45 мин' },
                  { value: 60, label: '60 мин' },
                ]}
              />
              <Select
                label="Длительность записи по умолчанию"
                value={settings.defaultAppointmentDuration || 60}
                onChange={(e) => setSettings({ ...settings, defaultAppointmentDuration: Number(e.target.value) })}
                options={[
                  { value: 30, label: '30 мин' },
                  { value: 45, label: '45 мин' },
                  { value: 60, label: '1 час' },
                  { value: 90, label: '1.5 ч' },
                ]}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-txt-primary">Овербукинг</p>
                <p className="text-2xs text-txt-muted">Разрешить конфликтные записи с подтверждением</p>
              </div>
              <Switch
                checked={!!settings.overbookingAllowed}
                onCheckedChange={(v: boolean) => setSettings({ ...settings, overbookingAllowed: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-txt-primary">Обязательное кресло</p>
                <p className="text-2xs text-txt-muted">Требовать выбор кресла при записи</p>
              </div>
              <Switch
                checked={!!settings.requireChair}
                onCheckedChange={(v: boolean) => setSettings({ ...settings, requireChair: v })}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell size={16} className="text-dv-gold" />
              Напоминания и финансы
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Напоминание за (часов)"
                type="number"
                value={settings.reminderHours ?? 24}
                onChange={(e) => setSettings({ ...settings, reminderHours: Number(e.target.value) })}
              />
              <Input
                label="Срочное окно (часов)"
                type="number"
                value={settings.reminderUrgentHours ?? 2}
                onChange={(e) => setSettings({ ...settings, reminderUrgentHours: Number(e.target.value) })}
              />
              <Input
                label="Профгигиена (мес.)"
                type="number"
                value={settings.hygieneMonths ?? 6}
                onChange={(e) => setSettings({ ...settings, hygieneMonths: Number(e.target.value) })}
              />
              <Input
                label="Префикс чека"
                value={settings.invoicePrefix || 'DV'}
                onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
              />
              <Input
                label="НДС / налог %"
                type="number"
                value={settings.taxPercent ?? 0}
                onChange={(e) => setSettings({ ...settings, taxPercent: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-txt-primary">WhatsApp-рассылка</p>
                <p className="text-2xs text-txt-muted">Серверный cron / deep-link</p>
              </div>
              <Switch
                checked={settings.whatsappEnabled !== false}
                onCheckedChange={(v: boolean) => setSettings({ ...settings, whatsappEnabled: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-txt-primary">SMS</p>
                <p className="text-2xs text-txt-muted">Требует Twilio на сервере</p>
              </div>
              <Switch
                checked={!!settings.smsEnabled}
                onCheckedChange={(v: boolean) => setSettings({ ...settings, smsEnabled: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-txt-primary">Уведомлять о неявках</p>
              </div>
              <Switch
                checked={settings.notifyNoShow !== false}
                onCheckedChange={(v: boolean) => setSettings({ ...settings, notifyNoShow: v })}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Armchair size={16} className="text-dv-gold" />
              Кресла
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newChairName}
                onChange={(e) => setNewChairName(e.target.value)}
                placeholder="Название кресла"
                className="flex-1"
              />
              <Button variant="secondary" onClick={addChair} icon={<Plus size={14} />}>
                Добавить
              </Button>
            </div>
            <div className="space-y-2">
              {chairs.length === 0 && (
                <p className="text-xs text-txt-muted">Кресла появятся автоматически или добавьте вручную</p>
              )}
              {chairs.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 p-3 rounded-xl border border-bdr-subtle bg-surface-raised">
                  <div className="flex items-center gap-2">
                    <Badge variant="gold" size="xs">{c.sortOrder ?? '—'}</Badge>
                    <span className="text-sm font-medium text-txt-primary">{c.name}</span>
                  </div>
                  <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => removeChair(c.id)}>
                    Скрыть
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
