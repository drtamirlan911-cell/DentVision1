import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Building2, DollarSign, FileText, FlaskConical, TrendingUp, Users, Wallet } from 'lucide-react'

import { Card } from '@/components/ui/ds/Card'
import { HeroStat, PageHeader } from '@/components/ui/ds/StatCard'
import { Badge } from '@/components/ui/ds/Badge'
import { Tabs } from '@/components/ui/ds/Misc'
import { countAwaitingAction, countByPhase, type PhaseId } from '@/lib/referralStatus'
import { queryKeys } from '@/queries/keys'
import { useAuth } from '@/store/auth.store'
import * as api from '@/utils/api'

import { WORKSPACES, type OrgKind } from './config'
import { Pipeline } from './Pipeline'
import { ReferralsTab } from './ReferralsTab'
import { ServicesTab } from './ServicesTab'
import { PaymentsTab } from './PaymentsTab'
import { CashierTab } from './CashierTab'
import { FinanceTab } from './FinanceTab'
import { TeamTab } from './TeamTab'
import { OrganizationOnboarding } from '@/components/OrganizationOnboarding'

/**
 * One workspace for diagnostic centres and laboratories.
 *
 * `CenterDashboard` and `LabDashboard` were the same screen twice — see
 * `config.ts` for what actually differs. Both entry routes still exist and both
 * sidebar items still work; only the implementation is shared.
 */
export function DiagnosticWorkspace({ kind: pinnedKind }: { kind?: OrgKind }) {
  const { user } = useAuth()
  // The frontend role vocabulary is lower-case (`src/types.ts`), unlike the
  // backend enum.
  const isSuperadmin = user?.role === 'superadmin'

  // The sidebar has one entry for both, so the route no longer says which of
  // the two this is — membership does. `/center-workspace` and
  // `/diagnostics/lab-dashboard` still pin it explicitly, so deep links and
  // the superadmin's own navigation keep working.
  const claimedKind: OrgKind | undefined =
    user?.organizationType === 'LABORATORY' ? 'LAB'
      : user?.organizationType === 'DIAGNOSTIC_CENTER' ? 'CENTER'
        : undefined

  // Left empty on purpose: `organizationId` may be a clinic when the user is
  // working elsewhere. The effect below fills it once the workspace knows which
  // organisation this actually is.
  const [orgId, setOrgId] = useState<string>('')
  const [activeTab, setActiveTab] = useState('referrals')
  const [phaseFilter, setPhaseFilter] = useState<PhaseId | null>(null)

  // Which organisations does the *caller* belong to?
  //
  // This used to ask `config.listOrganizations()` — the public catalogue of
  // every centre on the platform — and treat an empty answer as "you are not a
  // partner". So with a single centre registered anywhere, the onboarding never
  // appeared and every user was instead handed a dropdown of organisations they
  // have no access to; the server answers 403 for all of them.
  // `/me/contexts` is the membership question, already deduplicated, and it
  // covers staff who exist only in the unified model.
  const { data: contextsData, isLoading: contextsLoading } = useQuery({
    queryKey: ['iam', 'me', 'contexts'],
    queryFn: () => api.getMyContexts(),
    enabled: !claimedKind,
  })

  const diagnosticContexts = useMemo(
    () => (contextsData?.contexts || []).filter(
      (c: any) => c.scopeType === 'DIAGNOSTIC_CENTER' || c.scopeType === 'LABORATORY',
    ),
    [contextsData],
  )

  // Precedence: what the route pinned, else the active context, else the first
  // membership, else a centre — the shape the onboarding screen defaults to.
  const kind: OrgKind =
    pinnedKind
    ?? claimedKind
    ?? (diagnosticContexts[0]?.scopeType === 'LABORATORY' ? 'LAB' : 'CENTER')

  const config = WORKSPACES[kind]
  const isOwnOrg = user?.organizationType === config.organizationType
  const ownOrgId = user?.organizationId || ''

  const myOrgs = useMemo(
    () => diagnosticContexts.filter((c: any) => c.scopeType === config.organizationType),
    [diagnosticContexts, config.organizationType],
  )

  // The platform team legitimately inspects any organisation, so they keep the
  // catalogue picker. Nobody else is offered work the server will refuse.
  const { data: catalogueData } = useQuery({
    queryKey: ['diagnostics', 'orgs', kind],
    queryFn: () => config.listOrganizations(),
    enabled: !isOwnOrg && isSuperadmin,
  })
  const catalogue = catalogueData?.data || catalogueData || []

  const pickable = isSuperadmin
    ? catalogue.map((org: any) => ({ id: org.id, name: org.name, city: org.city }))
    : myOrgs.map((ctx: any) => ({ id: ctx.scopeId, name: ctx.name, city: undefined }))

  // One membership is not a choice — open it.
  useEffect(() => {
    if (isOwnOrg && ownOrgId) { setOrgId(ownOrgId); return }
    if (!orgId && !isSuperadmin && myOrgs.length === 1) setOrgId(myOrgs[0].scopeId)
  }, [isOwnOrg, ownOrgId, orgId, isSuperadmin, myOrgs])

  const needsOnboarding = !isOwnOrg && !isSuperadmin && !contextsLoading && myOrgs.length === 0

  // The header summary reads the same list the referrals tab does, so the hero
  // figure and the table can never disagree.
  const scope = config.referralScope(orgId)
  const { data: referralsData } = useQuery({
    queryKey: queryKeys.diagnostics.referrals({ ...scope, limit: '100' }),
    queryFn: () => api.getDiagnosticReferrals({ ...scope, limit: '100' }),
    enabled: !!orgId,
  })
  const referrals = useMemo(
    () => referralsData?.items || referralsData?.data || referralsData?.referrals || [],
    [referralsData],
  )

  const counts = useMemo(() => countByPhase(referrals), [referrals])
  const awaiting = useMemo(() => countAwaitingAction(referrals), [referrals])

  const tabs = [
    { id: 'cashier', label: 'Касса', icon: <Wallet size={14} /> },
    { id: 'referrals', label: config.referralsLabel, icon: <FileText size={14} /> },
    { id: 'finance', label: 'Финансы', icon: <TrendingUp size={14} /> },
    { id: 'services', label: config.servicesLabel, icon: <FlaskConical size={14} /> },
    { id: 'payments', label: 'Оплаты', icon: <DollarSign size={14} /> },
    { id: 'team', label: 'Сотрудники', icon: <Users size={14} /> },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-full space-y-6 overflow-x-hidden p-4 sm:p-6"
    >
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        icon={<FlaskConical size={22} />}
        actions={<Badge variant="outline">{kind === 'CENTER' ? 'Центр' : 'Лаборатория'}</Badge>}
      />

      {needsOnboarding && (
        <OrganizationOnboarding kind={kind} onComplete={() => window.location.reload()} />
      )}

      {!isOwnOrg && pickable.length > 1 && (
        <Card padding="md">
          <div className="flex flex-wrap items-center gap-3">
            <Building2 size={18} className="shrink-0 text-dv-gold" />
            <select
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="min-h-11 flex-1 rounded-lg border border-bdr-subtle bg-surface-1 px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold"
            >
              <option value="">{config.pickerLabel}</option>
              {pickable.map((org: { id: string; name: string; city?: string }) => (
                <option key={org.id} value={org.id}>{org.name}{org.city ? ` — ${org.city}` : ''}</option>
              ))}
            </select>
          </div>
        </Card>
      )}

      {orgId && (
        <>
          {/* The one number the screen leads with: what needs a human today.
              Not the total — that is dominated by finished work. */}
          <Card padding="lg">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <HeroStat
                value={awaiting}
                label="Ждут вашего действия"
                hint={`${counts.inProgress} в работе · ${counts.done} завершено`}
                icon={<FileText size={26} />}
                tone={awaiting > 0 ? 'gold' : 'success'}
              />
              <Pipeline
                counts={counts}
                activePhase={phaseFilter}
                onSelect={(phase) => { setPhaseFilter(phase); setActiveTab('referrals') }}
                className="lg:max-w-2xl lg:flex-1"
              />
            </div>
          </Card>

          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
          </div>

          {activeTab === 'cashier' && <CashierTab config={config} orgId={orgId} />}
          {activeTab === 'referrals' && (
            <ReferralsTab config={config} orgId={orgId} phaseFilter={phaseFilter} onClearPhase={() => setPhaseFilter(null)} />
          )}
          {activeTab === 'finance' && <FinanceTab config={config} orgId={orgId} />}
          {activeTab === 'services' && <ServicesTab config={config} orgId={orgId} />}
          {activeTab === 'payments' && <PaymentsTab config={config} orgId={orgId} />}
          {activeTab === 'team' && <TeamTab config={config} orgId={orgId} />}
        </>
      )}
    </motion.div>
  )
}

export default DiagnosticWorkspace
