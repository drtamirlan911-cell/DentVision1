import React from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Settings as SettingsIcon, User, Bell, Shield, Palette, Database, LayoutGrid, Building2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/ds/Card'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { Button } from '@/components/ui/ds/Button'
import { Switch } from '@/components/ui/ds/Misc'
import { useAuth, canManageClinicSettings } from '@/store/auth.store'

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
  const navigate = useNavigate()
  const { user, clinic, roleInfo, role, activeMembership, logout } = useAuth()
  const [notifications, setNotifications] = React.useState<boolean>(true)
  const [darkMode, setDarkMode] = React.useState<boolean>(true)
  const [autoSave, setAutoSave] = React.useState<boolean>(true)

  const canManageServices = roleInfo?.pages?.includes('settings')
  const showClinicSettings =
    canManageClinicSettings(role) ||
    canManageClinicSettings(activeMembership?.role) ||
    !!roleInfo?.canManageClinicSettings ||
    !!roleInfo?.pages?.includes('clinic-settings')
  const clinicId = clinic?.id || activeMembership?.clinicId || user?.clinicId || ''
  const clinicName = clinic?.name || 'вашей клиники'

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-3xl mx-auto space-y-6">
      <motion.div variants={item}>
        <PageHeader
          title="Настройки"
          subtitle="Управление аккаунтом и конфигурацией"
          icon={<SettingsIcon size={20} />}
        />
      </motion.div>

      {showClinicSettings && clinicId && (
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 size={16} className="text-dv-gold" />
                Настройки клиники
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-txt-muted">
                Профиль клиники, часы работы, напоминания и кресла — индивидуально для «{clinicName}».
              </p>
              <Button size="sm" onClick={() => navigate('/crm/clinic-settings')}>
                Открыть
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

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
                Управление доступом к сервисам появится в следующем обновлении. Сейчас все модули включены для вашего тарифа.
              </p>
              <div className="space-y-4">
                {SERVICE_TOGGLES.map((s) => (
                  <div key={s.key} className="flex items-center justify-between opacity-80">
                    <div>
                      <p className="text-sm font-medium text-txt-primary">{s.name}</p>
                      <p className="text-2xs text-txt-muted">{s.desc}</p>
                    </div>
                    <Switch
                      checked
                      disabled
                    />
                  </div>
                ))}
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
              <Button variant="secondary" size="sm" onClick={() => navigate('/forgot-password')}>
                Изменить пароль
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-error hover:bg-error/10"
                onClick={() => { logout(); navigate('/login') }}
              >
                Выйти из аккаунта
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
