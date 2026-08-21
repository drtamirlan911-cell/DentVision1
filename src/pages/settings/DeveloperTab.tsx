import { useState } from 'react'
import { Terminal, Plus, Key, Webhook, Copy, Check, Send } from 'lucide-react'
import {
  Card, CardHeader, CardTitle, CardContent, Button, Badge, Modal, Input, Select,
  DataTable, EmptyState, Drawer, Skeleton,
} from '@/components/ui/ds'
import { useToast } from '@/components/ui/ds/Toast'
import type { Column } from '@/components/ui/ds/DataTable'
import type { DeveloperApp } from '@/utils/api'
import {
  useDeveloperApps, useDeveloperApp, useCreateDeveloperApp,
  useCreateDeveloperApiKey, useCreateDeveloperWebhook, useWebhookDeliveries,
} from '@/queries/developer.query'

const ENV_OPTIONS = [
  { value: 'sandbox', label: 'Sandbox' },
  { value: 'production', label: 'Production' },
]

const EVENT_OPTIONS = [
  'patient.created', 'appointment.created', 'order.paid', 'payment.settled',
]

function fd(d: string) {
  try { return new Date(d).toLocaleString('ru-RU') } catch { return d }
}

/** Shown exactly once — the API never returns a plaintext secret again. */
function SecretRevealModal({ open, onClose, label, secret }: { open: boolean; onClose: () => void; label: string; secret: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <Modal open={open} onClose={onClose} title={label} size="md">
      <p className="text-sm text-txt-secondary mb-3">
        Сохраните значение сейчас — оно показывается только один раз и не может быть восстановлено позже.
      </p>
      <div className="flex items-center gap-2 rounded-lg border border-bdr-subtle bg-white/[0.03] p-3">
        <code className="flex-1 text-xs text-txt-primary break-all">{secret}</code>
        <Button size="icon-sm" variant="ghost" aria-label="Скопировать" onClick={copy}>
          {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
        </Button>
      </div>
      <div className="flex justify-end mt-4">
        <Button onClick={onClose}>Готово</Button>
      </div>
    </Modal>
  )
}

function WebhookDeliveries({ webhookId }: { webhookId: string }) {
  const { data, isLoading } = useWebhookDeliveries(webhookId)
  if (isLoading) return <Skeleton className="h-16" />
  const rows = data || []
  if (!rows.length) {
    return <p className="text-xs text-txt-muted py-3">Доставок ещё не было.</p>
  }
  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'event', header: 'Событие' },
    {
      key: 'status', header: 'Статус',
      render: (row) => (
        <Badge variant={row.status === 'delivered' ? 'success' : row.status === 'failed' ? 'error' : 'warning'} size="xs">
          {row.status}
        </Badge>
      ),
    },
    { key: 'createdAt', header: 'Время', render: (row) => fd(row.createdAt) },
  ]
  return <DataTable columns={columns} data={rows} rowKey={(r) => r.id} compact />
}

function AppDetail({ appId, onClose }: { appId: string; onClose: () => void }) {
  const toast = useToast()
  const { data: app, isLoading } = useDeveloperApp(appId)
  const createKey = useCreateDeveloperApiKey(appId)
  const createWebhook = useCreateDeveloperWebhook(appId)

  const [revealed, setRevealed] = useState<{ label: string; secret: string } | null>(null)
  const [webhookOpen, setWebhookOpen] = useState(false)
  const [webhookForm, setWebhookForm] = useState({ url: '', events: [] as string[] })
  const [openDeliveries, setOpenDeliveries] = useState<string | null>(null)

  const issueKey = async () => {
    try {
      const res = await createKey.mutateAsync()
      setRevealed({ label: 'Новый API-ключ', secret: res.key })
    } catch (e: any) {
      toast.error(e.message || 'Не удалось выпустить ключ')
    }
  }

  const submitWebhook = async () => {
    if (!webhookForm.url || webhookForm.events.length === 0) {
      toast.error('Укажите URL и хотя бы одно событие')
      return
    }
    try {
      const res = await createWebhook.mutateAsync(webhookForm)
      setWebhookOpen(false)
      setWebhookForm({ url: '', events: [] })
      setRevealed({ label: 'Секрет вебхука (HMAC)', secret: res.secret })
    } catch (e: any) {
      toast.error(e.message || 'Не удалось создать вебхук')
    }
  }

  const toggleEvent = (ev: string) => {
    setWebhookForm((f) => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter((e) => e !== ev) : [...f.events, ev],
    }))
  }

  return (
    <Drawer open onClose={onClose} title={app?.name || '...'} width={480}>
      {isLoading || !app ? (
        <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Badge variant={app.environment === 'production' ? 'gold' : 'default'}>{app.environment}</Badge>
            <span className="text-xs text-txt-muted">создано {fd(app.createdAt)}</span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-txt-primary flex items-center gap-1.5">
                <Key size={14} /> API-ключи
              </h3>
              <Button size="sm" variant="secondary" icon={<Plus size={14} />} loading={createKey.isPending} onClick={issueKey}>
                Выпустить ключ
              </Button>
            </div>
            {app.apiKeys.length === 0 ? (
              <p className="text-xs text-txt-muted">Ключей пока нет.</p>
            ) : (
              <div className="space-y-2">
                {app.apiKeys.map((k) => (
                  <div key={k.id} className="flex items-center justify-between rounded-lg border border-bdr-subtle p-2.5">
                    <div>
                      <code className="text-xs text-txt-primary">{k.prefix}…</code>
                      <p className="text-2xs text-txt-muted mt-0.5">{fd(k.createdAt)}</p>
                    </div>
                    {k.revokedAt ? <Badge variant="error" size="xs">отозван</Badge> : <Badge variant="success" size="xs">активен</Badge>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-txt-primary flex items-center gap-1.5">
                <Webhook size={14} /> Вебхуки
              </h3>
              <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setWebhookOpen(true)}>
                Добавить
              </Button>
            </div>
            {app.webhooks.length === 0 ? (
              <p className="text-xs text-txt-muted">Вебхуков пока нет.</p>
            ) : (
              <div className="space-y-2">
                {app.webhooks.map((w) => (
                  <div key={w.id} className="rounded-lg border border-bdr-subtle p-2.5">
                    <div className="flex items-center justify-between">
                      <code className="text-xs text-txt-primary break-all">{w.url}</code>
                      <Button
                        size="icon-sm" variant="ghost" aria-label="Доставки"
                        onClick={() => setOpenDeliveries(openDeliveries === w.id ? null : w.id)}
                      >
                        <Send size={13} />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {w.events.map((e) => <Badge key={e} variant="outline" size="xs">{e}</Badge>)}
                    </div>
                    {openDeliveries === w.id && (
                      <div className="mt-2 pt-2 border-t border-bdr-subtle">
                        <WebhookDeliveries webhookId={w.id} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal open={webhookOpen} onClose={() => setWebhookOpen(false)} title="Новый вебхук" size="sm">
        <div className="space-y-3">
          <Input
            label="URL" placeholder="https://example.com/webhooks/dentvision"
            value={webhookForm.url}
            onChange={(e) => setWebhookForm((f) => ({ ...f, url: e.target.value }))}
          />
          <div>
            <p className="text-xs font-medium text-txt-secondary mb-1.5">События</p>
            <div className="flex flex-wrap gap-1.5">
              {EVENT_OPTIONS.map((ev) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => toggleEvent(ev)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    webhookForm.events.includes(ev)
                      ? 'bg-dv-gold/15 border-dv-gold/30 text-dv-gold'
                      : 'border-bdr-subtle text-txt-muted hover:text-txt-primary'
                  }`}
                >
                  {ev}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setWebhookOpen(false)}>Отмена</Button>
            <Button loading={createWebhook.isPending} onClick={submitWebhook}>Создать</Button>
          </div>
        </div>
      </Modal>

      {revealed && (
        <SecretRevealModal
          open
          onClose={() => setRevealed(null)}
          label={revealed.label}
          secret={revealed.secret}
        />
      )}
    </Drawer>
  )
}

export default function DeveloperTab() {
  const toast = useToast()
  const { data: apps, isLoading } = useDeveloperApps()
  const createApp = useCreateDeveloperApp()

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<{ name: string; environment: 'sandbox' | 'production' }>({ name: '', environment: 'sandbox' })
  const [selectedApp, setSelectedApp] = useState<string | null>(null)

  const submitCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Укажите название приложения')
      return
    }
    try {
      await createApp.mutateAsync(form)
      setCreateOpen(false)
      setForm({ name: '', environment: 'sandbox' })
      toast.success('Приложение создано')
    } catch (e: any) {
      toast.error(e.message || 'Не удалось создать приложение')
    }
  }

  const columns: Column<DeveloperApp>[] = [
    { key: 'name', header: 'Название' },
    {
      key: 'environment', header: 'Среда',
      render: (row) => <Badge variant={row.environment === 'production' ? 'gold' : 'default'} size="xs">{row.environment}</Badge>,
    },
    { key: 'keys', header: 'Ключи', render: (row) => row._count?.apiKeys ?? 0 },
    { key: 'webhooks', header: 'Вебхуки', render: (row) => row._count?.webhooks ?? 0 },
    { key: 'createdAt', header: 'Создано', render: (row) => fd(row.createdAt) },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal size={16} className="text-dv-gold" />
            Приложения
          </CardTitle>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
            Создать приложение
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
          ) : !apps?.length ? (
            <EmptyState
              icon={<Terminal size={24} />}
              title="Приложений пока нет"
              description="Создайте приложение, чтобы получить API-ключ и настроить вебхуки для интеграции с DentVision."
              action={<Button size="sm" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>Создать приложение</Button>}
            />
          ) : (
            <DataTable columns={columns} data={apps} rowKey={(r) => r.id} onRowClick={(r) => setSelectedApp(r.id)} />
          )}
        </CardContent>
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Новое приложение" size="sm">
        <div className="space-y-3">
          <Input
            label="Название" placeholder="Моя интеграция"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Select
            label="Среда" options={ENV_OPTIONS}
            value={form.environment}
            onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value as 'sandbox' | 'production' }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Отмена</Button>
            <Button loading={createApp.isPending} onClick={submitCreate}>Создать</Button>
          </div>
        </div>
      </Modal>

      {selectedApp && <AppDetail appId={selectedApp} onClose={() => setSelectedApp(null)} />}
    </div>
  )
}
