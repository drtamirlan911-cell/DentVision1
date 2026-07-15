import React from 'react'
import { motion } from 'framer-motion'
import { Settings as SettingsIcon, User, Bell, Shield, Palette, Database } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/ds/Card'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { Button } from '@/components/ui/ds/Button'
import { Switch } from '@/components/ui/ds/Misc'
import { useAuth } from '@/context/AuthContext'

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

export default function SettingsPage() {
  const { user, clinic } = useAuth()
  const [notifications, setNotifications] = React.useState(true)
  const [darkMode, setDarkMode] = React.useState(true)
  const [autoSave, setAutoSave] = React.useState(true)

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-3xl mx-auto space-y-6">
      <motion.div variants={item}>
        <PageHeader
          title="Настройки"
          subtitle="Управление аккаунтом и конфигурацией"
          icon={<SettingsIcon size={20} />}
        />
      </motion.div>

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
