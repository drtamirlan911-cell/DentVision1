import React, { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, Lock, RefreshCw } from 'lucide-react'
import { useAuth } from '@/store/auth.store'
import { Button } from '@/components/ui/ds/Button'
import { Input } from '@/components/ui/ds/Input'
import { Card, CardContent } from '@/components/ui/ds/Card'
import { Badge } from '@/components/ui/ds/Badge'
import { useToast } from '@/components/ui/ds/Toast'
import * as api from '@/utils/api'

const OPS_KEY_SESSION = 'dv_ops_key'
const STATUS_FLOW: Record<string, string[]> = {
  PENDING: ['DOCUMENTS_REVIEW', 'SUSPENDED'],
  DOCUMENTS_REVIEW: ['VERIFIED', 'PENDING', 'SUSPENDED'],
  VERIFIED: ['OFFICIAL_PARTNER', 'SUSPENDED'],
  OFFICIAL_PARTNER: ['SUSPENDED'],
  SUSPENDED: ['VERIFIED', 'PENDING'],
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Ожидает',
  DOCUMENTS_REVIEW: 'Документы',
  VERIFIED: 'Подтверждён',
  OFFICIAL_PARTNER: 'Партнёр',
  SUSPENDED: 'Стоп',
}

/**
 * Hidden supplier governance console.
 * - Not linked from sidebar / sitemap
 * - URL is intentionally obscure: /x-ops/sg
 * - Requires SUPERADMIN + PLATFORM_OPS_SECRET (session only)
 * - Unauthorized users see a blank not-found style page (no hint)
 */
export default function HiddenSupplierOps() {
  const role = useAuth((s) => String(s.user?.role || s.user?.platformRole || '').toUpperCase())
  const toast = useToast()
  const isSuper = role === 'SUPERADMIN'

  const [gateKey, setGateKey] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [memberEmail, setMemberEmail] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  // Stealth: do not reveal this page exists to non-superadmins.
  if (!isSuper) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <p className="text-sm text-txt-muted">Страница не найдена</p>
      </div>
    )
  }

  const unlock = () => {
    const key = gateKey.trim()
    if (key.length < 24) {
      toast.error('Неверный ключ')
      return
    }
    try { sessionStorage.setItem(OPS_KEY_SESSION, key) } catch { /* ignore */ }
    setUnlocked(true)
  }

  const lock = () => {
    try { sessionStorage.removeItem(OPS_KEY_SESSION) } catch { /* ignore */ }
    setUnlocked(false)
    setRows([])
    setGateKey('')
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.opsListSuppliers()
      // Envelope unwrap → { data: Supplier[], pagination }
      const list = Array.isArray(data) ? data : (data?.data || [])
      setRows(Array.isArray(list) ? list : [])
    } catch {
      // Wrong key / misconfigured → look like 404
      toast.error('Нет доступа')
      lock()
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    try {
      const existing = sessionStorage.getItem(OPS_KEY_SESSION)
      if (existing) {
        setUnlocked(true)
        setGateKey(existing)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (unlocked) void load()
  }, [unlocked, load])

  const setStatus = async (id: string, status: string) => {
    setBusyId(id)
    try {
      await api.opsSetSupplierStatus(id, status)
      toast.success(`Статус → ${STATUS_LABEL[status] || status}`)
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка')
    } finally {
      setBusyId(null)
    }
  }

  const linkMember = async (id: string) => {
    const email = (memberEmail[id] || '').trim()
    if (!email) { toast.error('Email обязателен'); return }
    setBusyId(id)
    try {
      await api.opsAddSupplierMember(id, { email, role: 'owner' })
      toast.success('Пользователь привязан')
      setMemberEmail((m) => ({ ...m, [id]: '' }))
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка привязки')
    } finally {
      setBusyId(null)
    }
  }

  if (!unlocked) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-txt-primary">
              <Lock size={18} className="text-dv-gold" />
              <h1 className="text-sm font-semibold">Restricted</h1>
            </div>
            <Input
              type="password"
              autoComplete="off"
              spellCheck={false}
              label="Access key"
              value={gateKey}
              onChange={(e) => setGateKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && unlock()}
            />
            <Button className="w-full" onClick={unlock}>Continue</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-dv-gold" />
          <div>
            <h1 className="text-sm font-semibold text-txt-primary">Supplier governance</h1>
            <p className="text-xs text-txt-muted">Hidden ops · session key · SUPERADMIN only</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} onClick={load} disabled={loading}>
            Refresh
          </Button>
          <Button size="sm" variant="danger" onClick={lock}>Lock</Button>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <p className="text-sm text-txt-muted py-10 text-center">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-txt-muted py-10 text-center">No suppliers</p>
      ) : (
        <div className="space-y-3">
          {rows.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-txt-primary truncate">{s.name}</p>
                    <p className="text-xs text-txt-muted mt-0.5">
                      {s.email || '—'} · {s.phone || '—'} · members {s._count?.members ?? s.members?.length ?? 0}
                    </p>
                  </div>
                  <Badge variant={s.status === 'VERIFIED' || s.status === 'OFFICIAL_PARTNER' ? 'success' : 'gold'}>
                    {STATUS_LABEL[s.status] || s.status}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(STATUS_FLOW[s.status] || []).map((next) => (
                    <Button
                      key={next}
                      size="sm"
                      variant={next === 'VERIFIED' || next === 'OFFICIAL_PARTNER' ? 'primary' : 'secondary'}
                      disabled={busyId === s.id}
                      onClick={() => setStatus(s.id, next)}
                    >
                      → {STATUS_LABEL[next] || next}
                    </Button>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 items-end">
                  <div className="flex-1 w-full">
                    <Input
                      label="Привязать пользователя (email)"
                      value={memberEmail[s.id] || ''}
                      onChange={(e) => setMemberEmail((m) => ({ ...m, [s.id]: e.target.value }))}
                      placeholder="seller@example.com"
                    />
                  </div>
                  <Button size="sm" disabled={busyId === s.id} onClick={() => linkMember(s.id)}>
                    Привязать
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
