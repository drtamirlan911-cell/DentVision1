import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Mail, UserPlus } from 'lucide-react'

import { Card } from '@/components/ui/ds/Card'
import { Button } from '@/components/ui/ds/Button'
import { Input } from '@/components/ui/ds/Input'
import { Badge } from '@/components/ui/ds/Badge'
import { Skeleton } from '@/components/ui/ds/Skeleton'
import { useToast } from '@/components/ui/ds/Toast'
import * as api from '@/utils/api'

import type { TabProps } from './types'

/**
 * Invite codes for the organisation.
 *
 * Without this tab the join-by-code flow would still be dead: a centre or
 * laboratory had no way to produce a code, because member rows were only ever
 * written when a superadmin approved the founding registration request. An
 * invite nobody can issue is the same dead end as an endpoint that does not
 * exist.
 */

/** The diagnostics member vocabulary. `owner` is deliberately not invitable. */
const ROLES = [
  { value: 'operator', label: 'Оператор' },
  { value: 'radiologist', label: 'Рентгенолог' },
  { value: 'manager', label: 'Менеджер' },
  { value: 'admin', label: 'Администратор' },
]

const ROLE_LABELS: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.value, r.label]))

export function TeamTab({ orgId }: TabProps) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [role, setRole] = useState('operator')
  const [email, setEmail] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['iam', 'invitations', orgId],
    queryFn: () => api.getOrganizationInvitations(orgId),
    enabled: !!orgId,
    retry: false,
  })
  const invitations = data?.data || data || []

  const createMutation = useMutation({
    mutationFn: () =>
      api.createOrganizationInvitation({
        organizationId: orgId,
        role,
        email: email.trim() || undefined,
      }),
    onSuccess: () => {
      setEmail('')
      queryClient.invalidateQueries({ queryKey: ['iam', 'invitations', orgId] })
      toast.success('Код создан')
    },
    onError: (e: any) => toast.error(e?.message || 'Не удалось создать код'),
  })

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(code)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast.error('Не удалось скопировать')
    }
  }

  // The list endpoint answers 403 for anyone below admin, which is the honest
  // answer to "may I manage the team" — show that rather than an empty table.
  if (error) {
    return (
      <Card padding="lg">
        <p className="text-sm text-txt-muted text-center py-6">
          Приглашать сотрудников может владелец или администратор организации.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card padding="md">
        <h3 className="text-sm font-semibold text-txt-primary mb-1">Пригласить сотрудника</h3>
        <p className="text-sm text-txt-muted mb-4">
          Код действует 7 дней и срабатывает один раз. Если указать почту, кодом сможет
          воспользоваться только её владелец.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className="mb-1.5 block text-sm text-txt-secondary">Роль</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>
          <Input
            label="Email (необязательно)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="radiolog@example.kz"
          />
          <Button
            variant="primary"
            className="min-h-11"
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            <UserPlus size={16} /> Создать код
          </Button>
        </div>
      </Card>

      <Card padding="md">
        <h3 className="text-sm font-semibold text-txt-primary mb-3">Активные приглашения</h3>
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : invitations.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-sm text-txt-muted">
            Пока нет неиспользованных кодов
          </div>
        ) : (
          <ul className="divide-y divide-bdr-subtle">
            {invitations.map((inv: any) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 py-3">
                <code className="rounded-lg bg-surface-2 px-3 py-1.5 font-mono text-sm tracking-wider text-txt-primary">
                  {inv.code}
                </code>
                <Badge variant="outline">{ROLE_LABELS[inv.role] || inv.role}</Badge>
                {inv.email && (
                  <span className="inline-flex items-center gap-1 text-sm text-txt-muted">
                    <Mail size={13} /> {inv.email}
                  </span>
                )}
                {inv.expiresAt && (
                  <span className="text-sm text-txt-muted">
                    до {new Date(inv.expiresAt).toLocaleDateString()}
                  </span>
                )}
                <Button
                  size="xs"
                  variant="secondary"
                  className="ml-auto min-h-11"
                  onClick={() => copy(inv.code)}
                >
                  {copied === inv.code ? <><Check size={14} /> Скопировано</> : <><Copy size={14} /> Копировать</>}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
