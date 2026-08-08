import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/store/auth.store'
import { apiRequest } from '@/utils/api'
import { MessageCircle, Camera, RefreshCw, ExternalLink, AlertCircle, CheckCircle2, XCircle, Trash2 } from 'lucide-react'

interface ChannelStatus {
  id: string
  channel: string
  phoneNumber?: string
  instagramAccountId?: string
  businessId?: string
  webhookSubscribed: boolean
  expiresAt?: string
  connectedAt?: string
}

interface StatusData {
  whatsapp: ChannelStatus | null
  instagram: ChannelStatus | null
  messagesToday: Record<string, number>
}

export default function IntegrationsMessaging() {
  const { activeClinic } = useAuth()
  const clinicId = activeClinic?.id || ''
  const [status, setStatus] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    if (!clinicId) return
    try {
      const res = await apiRequest(`/api/meta/status?clinicId=${clinicId}`)
      if (res.ok) setStatus(res.data)
    } catch {
      setError('Failed to load status')
    }
  }, [clinicId])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const handleConnect = (channel: string) => {
    if (!clinicId) return
    setLoading(true)
    setError(null)
    apiRequest(`/api/meta/connect?clinicId=${clinicId}&channel=${channel}`)
      .then((res) => {
        if (res.ok && res.data?.url) {
          window.open(res.data.url, 'meta-connect', 'width=700,height=700')
        } else {
          setError(res.error || 'Failed to start connection')
        }
      })
      .catch(() => setError('Connection failed'))
      .finally(() => setLoading(false))
  }

  const handleDisconnect = async (channel: string) => {
    if (!clinicId || !confirm('Отключить интеграцию? История сообщений будет сохранена.')) return
    try {
      await apiRequest(`/api/meta/disconnect/${channel}?clinicId=${clinicId}`, { method: 'DELETE' })
      await loadStatus()
    } catch {
      setError('Failed to disconnect')
    }
  }

  const renderCard = (channel: 'WHATSAPP' | 'INSTAGRAM') => {
    const cfg: ChannelStatus | null = channel === 'WHATSAPP' ? status?.whatsapp ?? null : status?.instagram ?? null
    const connected = Boolean(cfg?.id)
    const label = channel === 'WHATSAPP' ? 'WhatsApp Business' : 'Instagram Direct'
    const Icon = channel === 'WHATSAPP' ? MessageCircle : Camera
    const color = channel === 'WHATSAPP' ? '#25D366' : '#E4405F'
    const msgCount = status?.messagesToday?.[channel] ?? 0

    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: `${color}15` }}>
              <Icon size={20} color={color} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{label}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {connected ? (
                  <>
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-sm text-emerald-600">Подключено</span>
                  </>
                ) : (
                  <>
                    <span className="flex h-2 w-2 rounded-full bg-gray-300" />
                    <span className="text-sm text-gray-500">Не подключено</span>
                  </>
                )}
              </div>
            </div>
          </div>
          {connected && (
            <button
              onClick={() => handleDisconnect(channel)}
              className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              title="Отключить"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {connected && cfg && (
          <div className="space-y-3 text-sm">
            {cfg.phoneNumber && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Номер</span>
                <span className="font-medium">{cfg.phoneNumber}</span>
              </div>
            )}
            {cfg.instagramAccountId && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Instagram ID</span>
                <span className="font-medium text-xs">{cfg.instagramAccountId}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Webhook</span>
              <span className={`flex items-center gap-1 ${cfg.webhookSubscribed ? 'text-emerald-600' : 'text-amber-600'}`}>
                {cfg.webhookSubscribed ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {cfg.webhookSubscribed ? 'Работает' : 'Не подписан'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Сообщений сегодня</span>
              <span className="font-medium">{msgCount}</span>
            </div>
            {cfg.expiresAt && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Токен истекает</span>
                <span className="font-medium text-xs">
                  {new Date(cfg.expiresAt).toLocaleDateString('ru-RU')}
                </span>
              </div>
            )}
            {cfg.connectedAt && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Подключено</span>
                <span className="font-medium text-xs">
                  {new Date(cfg.connectedAt).toLocaleDateString('ru-RU')}
                </span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => handleConnect(channel)}
          disabled={loading}
          className={`mt-4 w-full min-h-11 rounded-lg py-2.5 text-sm font-medium transition-all ${
            connected
              ? 'border border-gray-200 text-gray-700 hover:bg-gray-50'
              : 'text-white hover:opacity-90'
          }`}
          style={connected ? {} : { backgroundColor: color }}
        >
          {connected ? (
            <span className="flex items-center justify-center gap-2">
              <RefreshCw size={14} />
              Переподключить
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <ExternalLink size={14} />
              Подключить через Facebook
            </span>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-full overflow-x-hidden p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Интеграции</h1>
        <p className="mt-1 text-gray-500">
          Подключите WhatsApp и Instagram для автоматического приёма сообщений от пациентов
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          <XCircle size={16} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {renderCard('WHATSAPP')}
        {renderCard('INSTAGRAM')}
      </div>

      <div className="rounded-xl border bg-gray-50 p-6 text-sm text-gray-500">
        <p className="font-medium text-gray-700 mb-1">Как это работает</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Нажмите «Подключить через Facebook»</li>
          <li>Авторизуйтесь в Facebook и выберите Business Manager</li>
          <li>Выберите страницу и WhatsApp/Instagram аккаунт</li>
          <li>Подтвердите разрешения — всё остальное автоматически</li>
        </ol>
      </div>
    </div>
  )
}
