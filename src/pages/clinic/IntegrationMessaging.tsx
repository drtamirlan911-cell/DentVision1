import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/store/auth.store'
import { apiRequest } from '@/utils/api'
import { MessageCircle, Camera, RefreshCw, ExternalLink, AlertCircle, CheckCircle2, XCircle, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/ds/Card'
import { PageHeader } from '@/components/ui/ds/StatCard'

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

    const rows: Array<[string, React.ReactNode]> = []
    if (cfg?.phoneNumber) rows.push(['Номер', cfg.phoneNumber])
    if (cfg?.instagramAccountId) rows.push(['Instagram ID', <span className="text-xs">{cfg.instagramAccountId}</span>])
    if (cfg) {
      rows.push(['Webhook', (
        <span className={`flex items-center gap-1 ${cfg.webhookSubscribed ? 'text-success' : 'text-warning'}`}>
          {cfg.webhookSubscribed ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {cfg.webhookSubscribed ? 'Работает' : 'Не подписан'}
        </span>
      )])
      rows.push(['Сообщений сегодня', msgCount])
      if (cfg.expiresAt) rows.push(['Токен истекает', <span className="text-xs">{new Date(cfg.expiresAt).toLocaleDateString('ru-RU')}</span>])
      if (cfg.connectedAt) rows.push(['Подключено', <span className="text-xs">{new Date(cfg.connectedAt).toLocaleDateString('ru-RU')}</span>])
    }

    return (
      <Card padding="lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* The two literal hexes here are the third-party brand marks —
                WhatsApp green and Instagram pink. Those are the one thing on
                this page that must NOT follow our theme. */}
            <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: `${color}22` }}>
              <Icon size={20} color={color} />
            </div>
            <div>
              <h3 className="font-semibold text-txt-primary">{label}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`flex h-2 w-2 rounded-full ${connected ? 'bg-success' : 'bg-txt-ghost'}`} />
                <span className={`text-sm ${connected ? 'text-success' : 'text-txt-muted'}`}>
                  {connected ? 'Подключено' : 'Не подключено'}
                </span>
              </div>
            </div>
          </div>
          {connected && (
            <button
              onClick={() => handleDisconnect(channel)}
              className="rounded-lg p-2 min-h-11 min-w-11 text-txt-muted hover:bg-error/10 hover:text-error transition-colors"
              title="Отключить"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {rows.length > 0 && (
          <div className="space-y-3 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <span className="text-txt-muted">{label}</span>
                <span className="font-medium text-txt-primary">{value}</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => handleConnect(channel)}
          disabled={loading}
          className={`mt-4 w-full min-h-11 rounded-lg py-2.5 text-sm font-medium transition-all ${
            connected
              ? 'border border-bdr-subtle text-txt-secondary hover:bg-surface-2'
              : 'text-surface-0 hover:opacity-90'
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
      </Card>
    )
  }

  return (
    <div className="mx-auto w-full max-w-full overflow-x-hidden p-4 md:p-6 space-y-6">
      <PageHeader
        title="Интеграции"
        subtitle="Подключите WhatsApp и Instagram для автоматического приёма сообщений от пациентов"
        icon={<MessageCircle size={22} />}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-error/10 p-3 text-sm text-error">
          <XCircle size={16} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {renderCard('WHATSAPP')}
        {renderCard('INSTAGRAM')}
      </div>

      <Card padding="lg" className="text-sm text-txt-muted">
        <p className="font-medium text-txt-secondary mb-1">Как это работает</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Нажмите «Подключить через Facebook»</li>
          <li>Авторизуйтесь в Facebook и выберите Business Manager</li>
          <li>Выберите страницу и WhatsApp/Instagram аккаунт</li>
          <li>Подтвердите разрешения — всё остальное автоматически</li>
        </ol>
      </Card>
    </div>
  )
}
