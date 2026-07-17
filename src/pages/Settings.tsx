import React from 'react'
import { motion } from 'framer-motion'
import { Settings as SettingsIcon, User, Bell, Shield, Palette, Database, LayoutGrid } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/ds/Card'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { Button } from '@/components/ui/ds/Button'
import { Switch } from '@/components/ui/ds/Misc'
import { useAuth } from '@/store/auth.store'
import * as api from '@/utils/api'

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

interface ServiceToggle {
  key: string
  name: string
  desc: string
  locked?: boolean
}

const SERVICE_TOGGLES: ServiceToggle[] = [
  { key: 'crm', name: 'CRM', desc: 'Расписание, пациенты, лечение', locked: true },
  { key: 'shop', name: 'Магазин (Shop)', desc: 'Маркетплейс товаров' },
  { key: 'school', name: 'Школа (School)', desc: 'Образовательная платформа' },
  { key: 'ai', name: 'AI Помощник', desc: 'ИИ для диагностики' },
  { key: 'analytics', name: 'Аналитика', desc: 'Отчёты и метрики' },
  { key: 'settings', name: 'Настройки', desc: 'Управление клиникой' },
]

export default function SettingsPage() {
  const { user, clinic, roleInfo } = useAuth()
  const [notifications, setNotifications] = React.useState<boolean>(true)
  const [darkMode, setDarkMode] = React.useState<boolean>(true)
  const [autoSave, setAutoSave] = React.useState<boolean>(true)

  const canManageServices = roleInfo?.pages?.includes('settings')
  const [accessMap, setAccessMap] = React.useState<Record<string, boolean> | null>(null)
  const [saving, setSaving] = React.useState<boolean>(false)
  const [saved, setSaved] = React.useState<boolean>(false)

  React.useEffect(() => {
    if (canManageServices && clinic?.id) {
      api.getServiceAccess(clinic.id)
        .then(setAccessMap)
        .catch(() => setAccessMap(null))
    }
  }, [canManageServices, clinic?.id])

  const toggleService = (key: string, value: boolean) => {
    if (!accessMap) return
    setAccessMap({ ...accessMap, [key]: value })
    setSaved(false)
  }

  const saveServices = async () => {
    if (!accessMap || !clinic?.id) return
    setSaving(true)
    try {
      await api.setServiceAccessBulk(clinic.id, accessMap)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-3xl mx-auto space-y-6">
      <motion.div variants={item}>
        <PageHeader
          title="Настройки"
          subtitle="Управление аккаунтом и конфигурацией"
          icon={<SettingsIcon size={20} />}
        />
      </motion.div>

      {/* Services */}
      {canManageServices && (
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutGrid size={16} className="text-dv-gold" />
                Сервисы
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xs text-txt-muted mb-4">
                Включите или отключите сервисы для вашей клиники. Отключённые сервисы не будут видны сотрудникам.
              </p>
              <div className="space-y-4">
                {SERVICE_TOGGLES.map((s) => (
                  <div key={s.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-txt-primary">{s.name}</p>
                      <p className="text-2xs text-txt-muted">{s.desc}</p>
                    </div>
                    <Switch
                      checked={accessMap ? accessMap[s.key] !== false : true}
                      disabled={s.locked || !accessMap}
                      onCheckedChange={(v: boolean) => toggleService(s.key, v)}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-3">
                <Button size="sm" onClick={saveServices} disabled={saving}>
                  {saving ? 'Сохранение…' : 'Сохранить'}
                </Button>
                {saved && <span className="text-2xs text-dv-gold">Сохранено</span>}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Profile */}
      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User size={16} className="text-dv-gold" />
              Профиль
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-txt-secondary">Имя</span>
                <span className="text-sm font-medium text-txt-primary">{user?.name || user?.login}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-txt-secondary">Роль</span>
                <span className="text-sm font-medium text-txt-primary capitalize">{user?.role}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-txt-secondary">Клиника</span>
                <span className="text-sm font-medium text-txt-primary">{clinic?.name || '—'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Preferences */}
      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette size={16} className="text-dv-gold" />
              Настройки интерфейса
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-txt-primary">Тёмная тема</p>
                  <p className="text-2xs text-txt-muted">Тёмный режим отображения</p>
                </div>
                <Switch checked={darkMode} onCheckedChange={setDarkMode} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-txt-primary">Уведомления</p>
                  <p className="text-2xs text-txt-muted">Push-уведомления в браузере</p>
                </div>
                <Switch checked={notifications} onCheckedChange={setNotifications} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-txt-primary">Автосохранение</p>
                  <p className="text-2xs text-txt-muted">Автоматическое сохранение изменений</p>
                </div>
                <Switch checked={autoSave} onCheckedChange={setAutoSave} />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Security */}
      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield size={16} className="text-dv-gold" />
              Безопасность
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button variant="secondary" size="sm">Изменить пароль</Button>
              <Button variant="ghost" size="sm" className="text-error hover:bg-error/10">Выйти из всех устройств</Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
