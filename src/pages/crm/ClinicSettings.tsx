/**
 * CRM → Настройки клиники
 * Доступ: только Руководитель (owner/director) и Администратор.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Settings, Building2, Clock, Bell, Armchair, Save, Plus, Trash2,
  DollarSign, Users, Link2, Copy, Check, QrCode, BookOpen, ExternalLink,
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
import { ALL_SERVICES } from '@/utils/constants'
import * as api from '@/utils/api'
import type { Clinic, ClinicSettings, Chair, User, RoleInfo } from '@/types'

const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }

const SERVICE_CATS = [
  ...[...new Set(ALL_SERVICES.map(s => s.cat))].map(c => ({ value: c, label: c })),
  { value: 'Свои услуги', label: 'Свои услуги' },
]

const INVITE_ROLES = [
  { value: 'doctor', label: 'Врач' },
  { value: 'assistant', label: 'Ассистент' },
  { value: 'admin', label: 'Администратор' },
  { value: 'director', label: 'Руководитель' },
]

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
  autoDeductItems: '',
  bookingLink: '',
  onlineBookingEnabled: true,
  payments: {
    mode: 'unconfigured',
    merchantName: '',
    kaspiPhone: '',
    staticQrUrl: '',
    apiBaseUrl: '',
    configured: false,
    apiKeySet: false,
    webhookSecretSet: false,
  },
}

interface OutletCtx {
  clinic?: Clinic
  user?: User
  roleInfo?: RoleInfo
}

export default function ClinicSettingsPage() {
  const outlet = useOutletContext<OutletCtx>() || {}
  const navigate = useNavigate()
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
  const [serviceForm, setServiceForm] = useState({ name: '', cat: SERVICE_CATS[0]?.value || 'Свои услуги', price: 0 })
  const [serviceSaving, setServiceSaving] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'doctor', expiresInDays: 7 })
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteSaving, setInviteSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedWebhook, setCopiedWebhook] = useState(false)
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [webhookSecretDraft, setWebhookSecretDraft] = useState('')
  const [showPayHelp, setShowPayHelp] = useState(true)

  const bookingUrl = useMemo(() => {
    if (!clinicId || typeof window === 'undefined') return ''
    return `${window.location.origin}/book/${clinicId}`
  }, [clinicId])

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
    setApiKeyDraft('')
    setWebhookSecretDraft('')
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
      const payments = {
        ...(settings.payments || {}),
        mode: settings.payments?.mode || 'unconfigured',
        merchantName: settings.payments?.merchantName || '',
        kaspiPhone: settings.payments?.kaspiPhone || '',
        staticQrUrl: settings.payments?.staticQrUrl || '',
        apiBaseUrl: settings.payments?.apiBaseUrl || '',
        ...(apiKeyDraft.trim() ? { apiKey: apiKeyDraft.trim() } : {}),
        ...(webhookSecretDraft.trim() ? { webhookSecret: webhookSecretDraft.trim() } : {}),
      }
      await api.updateClinic(clinicId, {
        name: profile.name.trim(),
        city: profile.city.trim(),
        address: profile.address.trim(),
        phone: profile.phone.trim(),
        logo: profile.logo.trim(),
        settings: { ...settings, payments },
      })
      await queryClient.invalidateQueries({ queryKey: ['clinic-settings', clinicId] })
      setApiKeyDraft('')
      setWebhookSecretDraft('')
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

  const addService = async () => {
    if (!serviceForm.name.trim()) {
      showToast('Укажите название услуги', 'warning')
      return
    }
    if (!serviceForm.price || serviceForm.price <= 0) {
      showToast('Укажите цену', 'warning')
      return
    }
    setServiceSaving(true)
    try {
      await api.addPriceListService({
        name: serviceForm.name.trim(),
        price: Number(serviceForm.price),
        category: serviceForm.cat,
      })
      showToast(`Услуга «${serviceForm.name.trim()}» добавлена в прайс`, 'success')
      setServiceForm({ name: '', cat: SERVICE_CATS[0]?.value || 'Свои услуги', price: 0 })
    } catch (err: any) {
      showToast(err?.message || 'Не удалось добавить услугу', 'error')
    } finally {
      setServiceSaving(false)
    }
  }

  const createInvite = async () => {
    if (!clinicId) return
    setInviteSaving(true)
    try {
      const inv = await api.createInvitation({
        clinicId,
        email: inviteForm.email.trim() || undefined,
        role: inviteForm.role,
        expiresInDays: Number(inviteForm.expiresInDays) || 7,
      })
      if (!inv?.code) throw new Error('Сервер не вернул код')
      setInviteCode(inv.code)
      showToast('Приглашение создано', 'success')
    } catch (err: any) {
      showToast(err?.message || 'Не удалось создать приглашение', 'error')
    } finally {
      setInviteSaving(false)
    }
  }

  const copyCode = async () => {
    if (!inviteCode) return
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      showToast('Код скопирован', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('Не удалось скопировать', 'warning')
    }
  }

  const copyBookingLink = async () => {
    if (!bookingUrl) return
    try {
      await navigator.clipboard.writeText(bookingUrl)
      setCopiedLink(true)
      showToast('Ссылка скопирована', 'success')
      setTimeout(() => setCopiedLink(false), 2000)
    } catch {
      showToast('Не удалось скопировать', 'warning')
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
            <Input
              label="Авто-списание со склада"
              value={settings.autoDeductItems || ''}
              onChange={(e) => setSettings({ ...settings, autoDeductItems: e.target.value })}
              placeholder="Перчатки:1, Маска:1, Слюноотсос:1"
            />
            <p className="text-2xs text-txt-muted -mt-2">
              При закрытии приёма эти позиции спишутся со склада (имя должно совпадать со складом).
            </p>
            <Input
              label="Ссылка онлайн-записи"
              value={settings.bookingLink || ''}
              onChange={(e) => setSettings({ ...settings, bookingLink: e.target.value })}
              placeholder="https://instagram.com/… или 2GIS"
            />
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card className="border-[#C9A96E]/25">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-2">
                <QrCode size={16} className="text-dv-gold" />
                Оплата на кассе (Kaspi клиники)
              </span>
              <Badge variant={settings.payments?.configured || settings.payments?.mode === 'static' || settings.payments?.mode === 'api' ? 'success' : 'outline'} size="xs">
                {settings.payments?.configured
                  ? 'Подключено'
                  : settings.payments?.mode && settings.payments.mode !== 'unconfigured'
                    ? 'Заполните и сохраните'
                    : 'Не подключено'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-dv-gold/20 bg-dv-gold/5 p-3 space-y-2">
              <p className="text-sm text-txt-primary m-0 font-medium">
                Деньги с кассы, расписания и карточки пациента идут на <span className="text-dv-gold">счёт вашей клиники</span>, не на DentVision.
              </p>
              <p className="text-xs text-txt-muted m-0">
                Academy, Магазин и тариф SaaS оплачиваются отдельно через Kaspi платформы.
              </p>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-xs text-dv-gold hover:underline bg-transparent border-none cursor-pointer p-0 font-inherit"
                onClick={() => setShowPayHelp((v) => !v)}
              >
                <BookOpen size={13} />
                {showPayHelp ? 'Скрыть инструкцию' : 'Показать инструкцию'}
              </button>
              {showPayHelp && (
                <ol className="m-0 pl-4 space-y-1.5 text-xs text-txt-secondary list-decimal">
                  <li>
                    <b>Вариант A (быстро):</b> режим «Телефон / ссылка Kaspi» → укажите телефон Kaspi клиники или готовую ссылку оплаты → Сохранить.
                  </li>
                  <li>
                    В <b>Кассе</b> или <b>Расписании</b> выберите «QR-оплата» → «Создать QR» → пациент сканирует → перевод на ваш Kaspi → «Проверить оплату».
                  </li>
                  <li>
                    <b>Вариант B (API):</b> режим «API-шлюз» → Base URL + API Key + Webhook secret из кабинета шлюза → скопируйте Webhook URL ниже в кабинет шлюза.
                  </li>
                  <li>
                    Полная инструкция: файл <code className="text-dv-gold">docs/KASPI_CLINIC_SETUP.md</code> в репозитории.
                  </li>
                </ol>
              )}
            </div>

            <Select
              label="Режим приёма QR"
              value={settings.payments?.mode || 'unconfigured'}
              onChange={(e) => setSettings({
                ...settings,
                payments: { ...(settings.payments || {}), mode: e.target.value as any },
              })}
              options={[
                { value: 'unconfigured', label: 'Не подключено' },
                { value: 'static', label: 'Телефон / ссылка Kaspi (рекомендуется для старта)' },
                { value: 'api', label: 'API-шлюз (ApiPay / PayBot / свой)' },
              ]}
            />

            <Input
              label="Название мерчанта (для пациента)"
              value={settings.payments?.merchantName || ''}
              onChange={(e) => setSettings({
                ...settings,
                payments: { ...(settings.payments || {}), merchantName: e.target.value },
              })}
              placeholder={profile.name || 'Стоматология …'}
            />

            {(settings.payments?.mode === 'static' || settings.payments?.mode === 'unconfigured') && (
              <div className="grid sm:grid-cols-2 gap-3">
                <Input
                  label="Телефон Kaspi клиники"
                  value={settings.payments?.kaspiPhone || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    payments: { ...(settings.payments || {}), kaspiPhone: e.target.value },
                  })}
                  placeholder="+7 7XX XXX XX XX"
                />
                <Input
                  label="Или ссылка / QR-пейлоад Kaspi"
                  value={settings.payments?.staticQrUrl || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    payments: { ...(settings.payments || {}), staticQrUrl: e.target.value },
                  })}
                  placeholder="https://…"
                />
              </div>
            )}

            {settings.payments?.mode === 'api' && (
              <div className="space-y-3">
                <Input
                  label="API Base URL"
                  value={settings.payments?.apiBaseUrl || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    payments: { ...(settings.payments || {}), apiBaseUrl: e.target.value },
                  })}
                  placeholder="https://api.apipay.kz/api/v1"
                />
                <div className="grid sm:grid-cols-2 gap-3">
                  <Input
                    label={settings.payments?.apiKeySet ? 'API Key (оставлен прежний, введите новый чтобы заменить)' : 'API Key'}
                    type="password"
                    value={apiKeyDraft}
                    onChange={(e) => setApiKeyDraft(e.target.value)}
                    placeholder={settings.payments?.apiKeySet ? '••••••••' : 'sk_live_…'}
                    autoComplete="new-password"
                  />
                  <Input
                    label={settings.payments?.webhookSecretSet ? 'Webhook secret (оставьте пустым = без изменений)' : 'Webhook secret'}
                    type="password"
                    value={webhookSecretDraft}
                    onChange={(e) => setWebhookSecretDraft(e.target.value)}
                    placeholder={settings.payments?.webhookSecretSet ? '••••••••' : 'мин. 16 символов'}
                    autoComplete="new-password"
                  />
                </div>
                {settings.payments?.webhookUrl && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      label="Webhook URL (вставить в кабинет шлюза)"
                      value={settings.payments.webhookUrl}
                      readOnly
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="mt-5"
                      icon={copiedWebhook ? <Check size={14} /> : <Copy size={14} />}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(settings.payments?.webhookUrl || '')
                          setCopiedWebhook(true)
                          window.setTimeout(() => setCopiedWebhook(false), 1600)
                        } catch { /* ignore */ }
                      }}
                    >
                      {copiedWebhook ? 'Скопировано' : 'Копировать'}
                    </Button>
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] text-txt-muted m-0 flex items-start gap-1.5">
              <ExternalLink size={12} className="mt-0.5 shrink-0" />
              После сохранения проверьте: Касса → QR-оплата → Создать QR. Деньги должны прийти на Kaspi клиники.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-2">
                <DollarSign size={16} className="text-dv-gold" />
                Прайс — добавить услугу
              </span>
              <Button size="sm" variant="ghost" onClick={() => navigate('/crm/pricelist')}>
                Весь прайс
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Название"
                value={serviceForm.name}
                onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                placeholder="Профгигиена AirFlow"
              />
              <Select
                label="Категория"
                value={serviceForm.cat}
                onChange={(e) => setServiceForm({ ...serviceForm, cat: e.target.value })}
                options={SERVICE_CATS}
              />
              <Input
                label="Цена (₸)"
                type="number"
                value={serviceForm.price || ''}
                onChange={(e) => setServiceForm({ ...serviceForm, price: Number(e.target.value) })}
                placeholder="15000"
              />
            </div>
            <Button onClick={addService} disabled={serviceSaving} icon={<Plus size={14} />}>
              {serviceSaving ? 'Сохранение…' : 'Добавить в прайс'}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-2">
                <Users size={16} className="text-dv-gold" />
                Сотрудники — приглашение
              </span>
              <Button size="sm" variant="ghost" onClick={() => navigate('/crm/staff')}>
                Список сотрудников
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {inviteCode ? (
              <div className="space-y-3">
                <p className="text-sm text-txt-secondary">
                  Отправьте код сотруднику. Вход → «Мои клиники» → «Вступить по коду».
                </p>
                <div className="p-4 rounded-xl border border-dv-gold/30 bg-dv-gold/5 text-center">
                  <p className="text-2xs uppercase tracking-wider text-txt-muted mb-1">Код</p>
                  <p className="text-xl font-bold tracking-[0.2em] text-dv-gold font-mono">{inviteCode}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={copyCode}>
                    {copied ? 'Скопировано' : 'Скопировать'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setInviteCode(null)
                      setInviteForm({ email: '', role: 'doctor', expiresInDays: 7 })
                    }}
                  >
                    Новое приглашение
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Input
                    label="Email (необязательно)"
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="doctor@example.com"
                  />
                  <Select
                    label="Роль"
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                    options={INVITE_ROLES}
                  />
                  <Input
                    label="Срок (дней)"
                    type="number"
                    value={inviteForm.expiresInDays}
                    onChange={(e) => setInviteForm({ ...inviteForm, expiresInDays: Number(e.target.value) || 7 })}
                  />
                </div>
                <Button onClick={createInvite} disabled={inviteSaving} icon={<Link2 size={14} />}>
                  {inviteSaving ? 'Создание…' : 'Создать приглашение'}
                </Button>
              </>
            )}
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
