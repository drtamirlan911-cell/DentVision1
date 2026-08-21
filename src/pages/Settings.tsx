import React, { Suspense, lazy, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Settings as SettingsIcon, User, Shield, Palette, LayoutGrid,
  Building2, CreditCard, ExternalLink, Store, GraduationCap, Brain,
  BarChart3, Bell, Save, LogOut, ChevronRight, Terminal,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/ds/Card'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { Button } from '@/components/ui/ds/Button'
import { Switch } from '@/components/ui/ds/Misc'
import { Skeleton } from '@/components/ui/ds/Skeleton'
import { useAuth } from '@/store/auth.store'
import { useIam } from '@/iam/useIam'
import { useUIStore } from '@/store/ui.store'
import { useToast } from '@/components/ui/ds/Toast'

const DeveloperTab = lazy(() => import('./settings/DeveloperTab'))

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

interface TabDef { id: string; label: string; icon: React.ReactNode }

const TABS: TabDef[] = [
  { id: 'clinic', label: 'Клиника', icon: <Building2 size={14} /> },
  { id: 'profile', label: 'Профиль', icon: <User size={14} /> },
  { id: 'security', label: 'Безопасность', icon: <Shield size={14} /> },
  { id: 'developer', label: 'Для разработчиков', icon: <Terminal size={14} /> },
]

export default function SettingsPage() {
  const [tab, setTab] = useState('clinic')
  const navigate = useNavigate()
  const toast = useToast()
  const { user, clinic, roleInfo, activeMembership, logout } = useAuth()
  const iam = useIam()
  const darkMode = useUIStore((s) => s.darkMode)
  const notifications = useUIStore((s) => s.notifications)
  const autoSave = useUIStore((s) => s.autoSave)
  const setDarkMode = useUIStore((s) => s.setDarkMode)
  const setNotifications = useUIStore((s) => s.setNotifications)
  const setAutoSave = useUIStore((s) => s.setAutoSave)

  const showClinicSettings =
    iam.can('canManageClinicSettings') ||
    iam.canAccessPage('clinic-settings')
  const clinicId = clinic?.id || activeMembership?.clinicId || user?.clinicId || ''
  const clinicName = clinic?.name || 'вашей клиники'

  const onDarkMode = (next: boolean) => {
    setDarkMode(next)
    toast.success(next ? 'Тёмная тема включена' : 'Светлая тема включена')
  }

  const onNotifications = async (next: boolean) => {
    setNotifications(next)
    if (!next) { toast.success('Уведомления выключены'); return }
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.info('Браузер не поддерживает push-уведомления'); return
    }
    if (Notification.permission === 'denied') {
      toast.error('Разрешение заблокировано в настройках браузера'); return
    }
    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { toast.error('Разрешение не получено'); return }
    }
    toast.success('Уведомления включены')
  }

  const onAutoSave = (next: boolean) => {
    setAutoSave(next)
    toast.success(next ? 'Автосохранение включено' : 'Автосохранение выключено')
  }

  // ── shared helpers ──

  const SettingRow = ({ label, sub, children }: { label: React.ReactNode; sub?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between min-h-11 py-2">
      <div>
        <p className="text-sm font-medium text-txt-primary">{label}</p>
        {sub && <p className="text-2xs text-txt-muted">{sub}</p>}
      </div>
      {children}
    </div>
  )

  const LinkCard = ({ icon, title, desc, btn, onClick }: { icon: React.ReactNode; title: string; desc: string; btn: string; onClick: () => void }) => (
    <Card className="hover:border-dv-gold/20 transition-colors">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="text-dv-gold">{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3 flex-wrap pt-0">
        <p className="text-xs text-txt-muted">{desc}</p>
        <Button size="sm" className="min-h-11 shrink-0" onClick={onClick}>{btn}</Button>
      </CardContent>
    </Card>
  )

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-full overflow-x-hidden mx-auto space-y-5 px-3 sm:px-4 lg:px-6">
      <motion.div variants={item}>
        <PageHeader
          title="Настройки"
          subtitle="Управление аккаунтом и конфигурацией"
          icon={<SettingsIcon size={20} />}
        />
      </motion.div>

      {/* ── Tab bar ── */}
      <motion.div variants={item} className="flex gap-1 p-1 rounded-xl bg-surface-1 border border-bdr-subtle w-fit overflow-x-auto max-w-full no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              tab === t.id
                ? 'bg-dv-gold/15 text-dv-gold'
                : 'text-txt-muted hover:text-txt-primary hover:bg-white/[0.04]'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </motion.div>

      {/* ═══ КЛИНИКА ═══ */}
      {tab === 'clinic' && (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
          {showClinicSettings && clinicId && (
            <>
              <motion.div variants={item}>
                <LinkCard
                  icon={<Building2 size={16} />}
                  title="Настройки клиники"
                  desc={`Профиль, часы работы, напоминания — «${clinicName}»`}
                  btn="Открыть"
                  onClick={() => navigate('/crm/clinic-settings')}
                />
              </motion.div>
              <motion.div variants={item}>
                <LinkCard
                  icon={<CreditCard size={16} />}
                  title="Тариф и оплата"
                  desc="Пробный период, смена тарифа, оплата по QR"
                  btn="Открыть"
                  onClick={() => navigate('/crm/billing')}
                />
              </motion.div>
              <motion.div variants={item}>
                <LinkCard
                  icon={<CreditCard size={16} />}
                  title="Kaspi кассы"
                  desc="QR на кассе идёт на ваш Kaspi/банк, не на DentVision"
                  btn="Подключить"
                  onClick={() => navigate('/crm/settings')}
                />
              </motion.div>
            </>
          )}

          <motion.div variants={item}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutGrid size={16} className="text-dv-gold" />
                  Сервисы
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {[
                  { icon: <Store size={14} />, label: 'CRM', sub: 'Расписание, пациенты, лечение', locked: true },
                  { icon: <Store size={14} />, label: 'Магазин (Shop)', sub: 'Маркетплейс товаров' },
                  { icon: <GraduationCap size={14} />, label: 'Школа (School)', sub: 'Образовательная платформа' },
                  { icon: <Brain size={14} />, label: 'AI Помощник', sub: 'ИИ для диагностики' },
                  { icon: <BarChart3 size={14} />, label: 'Аналитика', sub: 'Отчёты и метрики' },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between min-h-11 py-1.5 opacity-80">
                    <div className="flex items-center gap-2.5">
                      <span className="text-txt-muted">{s.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-txt-primary">{s.label}</p>
                        <p className="text-2xs text-txt-muted">{s.sub}</p>
                      </div>
                    </div>
                    <Switch checked disabled onCheckedChange={() => {}} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* ═══ ПРОФИЛЬ ═══ */}
      {tab === 'profile' && (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
          <motion.div variants={item}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User size={16} className="text-dv-gold" />
                  Профиль
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <SettingRow label="Имя">{user?.name || user?.login}</SettingRow>
                <SettingRow label="Роль">{roleInfo?.label || activeMembership?.role || user?.role}</SettingRow>
                <SettingRow label="Клиника">{clinic?.name || '—'}</SettingRow>
                <div className="pt-2">
                  <Button size="sm" variant="ghost" className="min-h-11" icon={<ChevronRight size={14} />} onClick={() => navigate('/profile')}>
                    Редактировать профиль
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette size={16} className="text-dv-gold" />
                  Интерфейс
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SettingRow label="Тёмная тема" sub="Сохраняется на этом устройстве">
                  <Switch checked={darkMode} onCheckedChange={onDarkMode} />
                </SettingRow>
                <SettingRow label={<span className="flex items-center gap-1.5"><Bell size={13} /> Уведомления</span>} sub="Push в браузере, когда вкладка в фоне">
                  <Switch checked={notifications} onCheckedChange={onNotifications} />
                </SettingRow>
                <SettingRow label={<span className="flex items-center gap-1.5"><Save size={13} /> Автосохранение</span>} sub="Черновики форм в CRM сохраняются локально">
                  <Switch checked={autoSave} onCheckedChange={onAutoSave} />
                </SettingRow>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* ═══ БЕЗОПАСНОСТЬ ═══ */}
      {tab === 'security' && (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
          <motion.div variants={item}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield size={16} className="text-dv-gold" />
                  Безопасность
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="secondary" size="sm" className="min-h-11 w-full justify-start" onClick={() => navigate('/forgot-password')}>
                  Изменить пароль
                </Button>
                <Button variant="secondary" size="sm" className="min-h-11 w-full justify-start" icon={<ExternalLink size={14} />} onClick={() => navigate('/security')}>
                  Security & Compliance
                </Button>
                <Button variant="ghost" size="sm" className="min-h-11 w-full justify-start text-error hover:bg-error/10" icon={<LogOut size={14} />} onClick={() => { logout(); navigate('/login') }}>
                  Выйти из аккаунта
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* ═══ ДЛЯ РАЗРАБОТЧИКОВ ═══ */}
      {tab === 'developer' && (
        <motion.div variants={container} initial="hidden" animate="show">
          <Suspense fallback={<div className="space-y-2"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>}>
            <DeveloperTab />
          </Suspense>
        </motion.div>
      )}
    </motion.div>
  )
}
