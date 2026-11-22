import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Mail, UserPlus, Users } from 'lucide-react'

import { Card } from '@/components/ui/ds/Card'
import { Button } from '@/components/ui/ds/Button'
import { Input } from '@/components/ui/ds/Input'
import { Badge } from '@/components/ui/ds/Badge'
import { Skeleton } from '@/components/ui/ds/Skeleton'
import { useToast } from '@/components/ui/ds/Toast'
import { useIam } from '@/iam'
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

const MEDICAL_LAB_ROLES = [
  { value: 'medical_lab_admin', label: 'Администратор' },
  { value: 'medical_lab_manager', label: 'Управляющий' },
  { value: 'medical_lab_reception', label: 'Регистратура' },
  { value: 'medical_lab_technician', label: 'Лаборант' },
  { value: 'medical_lab_validator', label: 'Валидатор результатов' },
  { value: 'medical_lab_doctor', label: 'Врач лаборатории' },
  { value: 'medical_lab_finance', label: 'Финансы' },
  { value: 'medical_lab_quality', label: 'Контроль качества' },
] as const

const DENTAL_LAB_ROLES = [
  { value: 'dental_lab_admin', label: 'Администратор' },
  { value: 'dental_lab_manager', label: 'Управляющий' },
  { value: 'lab_coordinator', label: 'Координатор' },
  { value: 'dental_technician', label: 'Зубной техник' },
  { value: 'cad_designer', label: 'CAD-дизайнер' },
  { value: 'ceramist', label: 'Керамист' },
  { value: 'orthodontic_technician', label: 'Ортодонтический техник' },
  { value: 'qc_specialist', label: 'Контроль качества' },
  { value: 'lab_finance', label: 'Финансы' },
] as const

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  [...ROLES, ...MEDICAL_LAB_ROLES, ...DENTAL_LAB_ROLES].map((r) => [r.value, r.label]),
)

export function TeamTab({ config, orgId }: TabProps) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const iam = useIam()
  const canManageBranches = iam.hasPermission('staff.write') || iam.hasPermission('staff.manage')
  const [role, setRole] = useState('operator')
  const [email, setEmail] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [branchChoiceByUser, setBranchChoiceByUser] = useState<Record<string, string>>({})

  const { data, isLoading, error } = useQuery({
    queryKey: ['iam', 'invitations', orgId],
    queryFn: () => api.getOrganizationInvitations(orgId),
    enabled: !!orgId,
    retry: false,
  })
  const invitations = data?.data || data || []
  const isDiagnosticCenter = config.kind === 'CENTER'
  const organizationQuery = useQuery({
    queryKey: ['organizations', 'me', 'team-invite-role-family', orgId],
    queryFn: api.getMyOrganization,
    enabled: Boolean(orgId && !isDiagnosticCenter),
    retry: false,
  })
  const laboratoryType = String(organizationQuery.data?.organization?.settings?.laboratoryType || '').toUpperCase()
  const inviteRoleOptions = isDiagnosticCenter
    ? ROLES
    : laboratoryType === 'DENTAL_LAB' ? DENTAL_LAB_ROLES : MEDICAL_LAB_ROLES
  const isDentalLab = !isDiagnosticCenter && laboratoryType === 'DENTAL_LAB'
  const isMedicalLab = !isDiagnosticCenter && laboratoryType === 'MEDICAL_LAB'
  const defaultInviteRole = isDiagnosticCenter
    ? 'operator'
    : isDentalLab ? 'dental_technician' : 'medical_lab_technician'

  useEffect(() => {
    if (!inviteRoleOptions.some((option) => option.value === role)) setRole(defaultInviteRole)
  }, [inviteRoleOptions, defaultInviteRole, role])

  const centerStaffQuery = useQuery({
    queryKey: ['diagnostics', 'center-worklist-staff', orgId],
    queryFn: () => api.getDiagnosticCenterWorklistStaff(orgId),
    enabled: Boolean(orgId && isDiagnosticCenter && iam.hasPermission('staff.read')),
    retry: false,
  })
  const dentalLabTeamQuery = useQuery({
    queryKey: ['dental-lab', 'team', orgId],
    queryFn: api.getDentalLabTeam,
    enabled: Boolean(orgId && isDentalLab && iam.hasPermission('staff.read')),
    retry: false,
  })
  const medicalLabTeamQuery = useQuery({
    queryKey: ['medical-lab', 'team', orgId],
    queryFn: api.getMedicalLabTeam,
    enabled: Boolean(orgId && isMedicalLab && iam.hasPermission('staff.read')),
    retry: false,
  })
  const activeStaffQuery = isDiagnosticCenter ? centerStaffQuery : isDentalLab ? dentalLabTeamQuery : medicalLabTeamQuery
  const staffData = activeStaffQuery.data || []
  const staff = staffData.map((member: any) => {
    const nameParts = String(member.name || '').trim().split(/\\s+/).filter(Boolean)
    return {
      ...member,
      userId: member.userId || member.id,
      firstName: member.firstName || nameParts[0] || '',
      lastName: member.lastName || nameParts.slice(1).join(' '),
    }
  }).filter((member: any) => Boolean(member.userId))
  const staffLoading = activeStaffQuery.isLoading
  const staffError = activeStaffQuery.error
  const teamLabel = isDiagnosticCenter ? 'Сотрудники центра' : 'Сотрудники лаборатории'
  const branchesQuery = useQuery({
    queryKey: ['branches', 'partner-team', orgId],
    queryFn: () => api.listBranches({ organizationId: orgId }),
    enabled: Boolean(orgId && canManageBranches),
    retry: false,
  })
  const activeBranches = (branchesQuery.data || []).filter((branch: any) => branch.active !== false)
  const branchMembershipsQuery = useQuery({
    queryKey: ['branches', 'diagnostic-center-memberships', orgId, activeBranches.map((branch: any) => branch.id).join(',')],
    queryFn: async () => {
      const rows = await Promise.all(activeBranches.map(async (branch: any) => ({
        branchId: branch.id as string,
        members: await api.getBranchMembers(branch.id),
      })))
      return Object.fromEntries(rows.map((row) => [
        row.branchId,
        row.members.map((member: any) => member.userId).filter(Boolean) as string[],
      ]))
    },
    enabled: Boolean(orgId && canManageBranches && activeBranches.length),
    retry: false,
  })

  const assignBranchMutation = useMutation({
    mutationFn: ({ userId, branchId }: { userId: string; branchId: string }) =>
      api.assignBranchMember(branchId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches', 'diagnostic-center-memberships', orgId] })
      toast.success('Сотрудник закреплён за филиалом')
    },
    onError: (e: any) => toast.error(e?.message || 'Не удалось закрепить сотрудника за филиалом'),
  })

  const unassignBranchMutation = useMutation({
    mutationFn: ({ userId, branchId }: { userId: string; branchId: string }) =>
      api.unassignBranchMember(branchId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches', 'diagnostic-center-memberships', orgId] })
      toast.success('Доступ к филиалу снят')
    },
    onError: (e: any) => toast.error(e?.message || 'Не удалось снять доступ к филиалу'),
  })

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
              disabled={!isDiagnosticCenter && (!organizationQuery.data || organizationQuery.isError)}
              className="min-h-11 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold disabled:opacity-60"
            >
              {inviteRoleOptions.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            {!isDiagnosticCenter && organizationQuery.isLoading && (
              <span className="mt-1 block text-xs text-txt-muted">Определяем специализацию лаборатории…</span>
            )}
            {!isDiagnosticCenter && organizationQuery.isError && (
              <span className="mt-1 block text-xs text-error">Не удалось определить тип лаборатории. Приглашения временно недоступны.</span>
            )}
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
            disabled={!isDiagnosticCenter && (!organizationQuery.data || organizationQuery.isError)}
            onClick={() => createMutation.mutate()}
          >
            <UserPlus size={16} /> Создать код
          </Button>
        </div>
      </Card>

      {iam.hasPermission('staff.read') && (
        <Card padding="md">
          <div className="mb-3 flex items-center gap-2">
            <Users size={16} className="text-txt-muted" />
            <h3 className="text-sm font-semibold text-txt-primary">{teamLabel}</h3>
          </div>
          {staffLoading ? <Skeleton className="h-24" /> : staffError ? (
            <p className="py-4 text-center text-sm text-txt-muted">Состав команды доступен сотрудникам с правом staff.read.</p>
          ) : staff.length === 0 ? (
            <p className="py-4 text-center text-sm text-txt-muted">Сотрудники появятся после принятия приглашений.</p>
          ) : (
            <ul className="divide-y divide-bdr-subtle">
              {staff.map((member: any) => (
                <li key={member.userId} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-txt-primary">{member.firstName} {member.lastName}</p>
                    <p className="text-xs text-txt-muted">{member.email}</p>
                  </div>
                  <Badge variant="outline">{ROLE_LABELS[member.role] || member.role}</Badge>
                  {canManageBranches && (
                    <div className="w-full space-y-2 rounded-lg bg-surface-1 p-3 sm:max-w-[420px]">
                      <p className="text-xs font-medium text-txt-secondary">Доступ к филиалам</p>
                      {branchesQuery.isPending || (activeBranches.length > 0 && branchMembershipsQuery.isPending) ? (
                        <Skeleton className="h-8" />
                      ) : branchesQuery.isError || (activeBranches.length > 0 && branchMembershipsQuery.isError) ? (
                        <p className="text-xs text-txt-muted">Не удалось загрузить закрепления филиалов.</p>
                      ) : activeBranches.length === 0 ? (
                        <p className="text-xs text-txt-muted">У организации пока нет активных филиалов.</p>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-1.5">
                            {activeBranches.filter((branch: any) => (branchMembershipsQuery.data?.[branch.id] || []).includes(member.userId)).map((branch: any) => (
                              <span key={branch.id} className="inline-flex items-center gap-1 rounded-full border border-bdr-subtle px-2 py-1 text-xs text-txt-secondary">
                                {branch.name}
                                <button
                                  type="button"
                                  aria-label={`Снять доступ к филиалу ${branch.name} у ${member.firstName} ${member.lastName}`}
                                  className="rounded-full px-1 text-txt-muted hover:bg-surface-2 hover:text-txt-primary"
                                  disabled={unassignBranchMutation.isPending}
                                  onClick={() => unassignBranchMutation.mutate({ userId: member.userId, branchId: branch.id })}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                            {activeBranches.every((branch: any) => !(branchMembershipsQuery.data?.[branch.id] || []).includes(member.userId)) && (
                              <span className="text-xs text-txt-muted">Филиалы не назначены</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <select
                              aria-label={`Выбрать филиал для ${member.firstName} ${member.lastName}`}
                              value={branchChoiceByUser[member.userId] || ''}
                              onChange={(event) => setBranchChoiceByUser((current) => ({ ...current, [member.userId]: event.target.value }))}
                              className="min-h-10 min-w-0 flex-1 rounded-lg border border-bdr-subtle bg-surface-0 px-3 py-2 text-xs text-txt-primary"
                            >
                              <option value="">Выбрать филиал</option>
                              {activeBranches.filter((branch: any) => !(branchMembershipsQuery.data?.[branch.id] || []).includes(member.userId)).map((branch: any) => (
                                <option key={branch.id} value={branch.id}>{branch.name}</option>
                              ))}
                            </select>
                            <Button
                              size="xs"
                              variant="secondary"
                              disabled={!branchChoiceByUser[member.userId] || assignBranchMutation.isPending}
                              loading={assignBranchMutation.isPending}
                              onClick={() => {
                                const branchId = branchChoiceByUser[member.userId]
                                if (branchId) assignBranchMutation.mutate({ userId: member.userId, branchId })
                                setBranchChoiceByUser((current) => ({ ...current, [member.userId]: '' }))
                              }}
                            >
                              Добавить
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

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
