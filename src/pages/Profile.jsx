import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  User,
  Mail,
  Phone,
  Shield,
  Building,
  Save,
  LogOut,
  Camera,
  Key,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/ds/Card'
import { Button } from '@/components/ui/ds/Button'
import { Badge } from '@/components/ui/ds/Badge'
import { Avatar } from '@/components/ui/ds/Avatar'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { useToast } from '@/components/ui/ds/Toast'

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  director: 'Руководитель',
  admin: 'Администратор',
  doctor: 'Врач',
  assistant: 'Ассистент',
}

const ROLE_VARIANTS = {
  superadmin: 'purple',
  director: 'gold',
  admin: 'sky',
  doctor: 'emerald',
  assistant: 'teal',
}

export default function Profile() {
  const { user, clinic, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  })

  const handleSave = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname.includes('vercel.app') ? 'https://dentvision-api.onrender.com' : 'http://localhost:3001')
      const token = localStorage.getItem('dv_access_token')
      const res = await fetch(`${API_URL}/api/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        toast.success('Профиль обновлён')
        setEditing(false)
      } else {
        toast.error('Ошибка обновления')
      }
    } catch {
      toast.error('Ошибка сети')
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="fade-in space-y-6 max-w-2xl mx-auto">
      <PageHeader
        title="Мой профиль"
        subtitle="Управление аккаунтом и настройками"
        icon={<User size={24} className="text-dv-gold" />}
      />

      {/* Avatar + Name Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar name={user?.name || user?.login || '?'} size="xl" />
              <button className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-dv-gold text-surface-0 shadow-lg hover:bg-dv-gold-light transition-colors">
                <Camera size={14} />
              </button>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-txt-primary">{user?.name || user?.login}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={ROLE_VARIANTS[user?.role] || 'slate'} size="sm">
                  {ROLE_LABELS[user?.role] || 'Сотрудник'}
                </Badge>
                {clinic && (
                  <span className="text-xs text-txt-muted flex items-center gap-1">
                    <Building size={12} /> {clinic.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <User size={16} className="text-dv-gold" />
              Личные данные
            </span>
            {!editing ? (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                Редактировать
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Отмена
                </Button>
                <Button variant="primary" size="sm" icon={<Save size={14} />} onClick={handleSave}>
                  Сохранить
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">ФИО</label>
                {editing ? (
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ваше имя"
                  />
                ) : (
                  <p className="text-sm text-txt-primary flex items-center gap-2">
                    <User size={14} className="text-txt-muted" />
                    {user?.name || '—'}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Email</label>
                {editing ? (
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@example.com"
                  />
                ) : (
                  <p className="text-sm text-txt-primary flex items-center gap-2">
                    <Mail size={14} className="text-txt-muted" />
                    {user?.email || '—'}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Телефон</label>
                {editing ? (
                  <input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+7..."
                  />
                ) : (
                  <p className="text-sm text-txt-primary flex items-center gap-2">
                    <Phone size={14} className="text-txt-muted" />
                    {user?.phone || '—'}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Роль</label>
                <p className="text-sm text-txt-primary flex items-center gap-2">
                  <Shield size={14} className="text-txt-muted" />
                  {ROLE_LABELS[user?.role] || 'Сотрудник'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clinic Info */}
      {clinic && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building size={16} className="text-dv-gold" />
              Клиника
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-txt-muted">Название</p>
                <p className="text-sm text-txt-primary font-semibold">{clinic.name}</p>
              </div>
              <div>
                <p className="text-xs text-txt-muted">Тариф</p>
                <Badge variant="gold" size="sm">{clinic.plan || 'Starter'}</Badge>
              </div>
              {clinic.phone && (
                <div>
                  <p className="text-xs text-txt-muted">Телефон клиники</p>
                  <p className="text-sm text-txt-primary">{clinic.phone}</p>
                </div>
              )}
              {clinic.address && (
                <div>
                  <p className="text-xs text-txt-muted">Адрес</p>
                  <p className="text-sm text-txt-primary">{clinic.address}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key size={16} className="text-dv-gold" />
            Безопасность
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button
              variant="danger"
              icon={<LogOut size={16} />}
              onClick={handleLogout}
              className="w-full md:w-auto"
            >
              Выйти из системы
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
