import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Building2, DollarSign, FileText, FlaskConical, TrendingUp, Wallet } from 'lucide-react'

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

/**
 * One workspace for diagnostic centres and laboratories.
 *
 * `CenterDashboard` and `LabDashboard` were the same screen twice — see
 * `config.ts` for what actually differs. Both entry routes still exist and both
 * sidebar items still work; only the implementation is shared.
 */
export function DiagnosticWorkspace({ kind }: { kind: OrgKind }) {
  const config = WORKSPACES[kind]
  const { user } = useAuth()
  const isOwnOrg = user?.organizationType === config.organizationType
  const ownOrgId = user?.organizationId || ''
  const [orgId, setOrgId] = useState<string>(isOwnOrg ? ownOrgId : '')
  const [activeTab, setActiveTab] = useState('referrals')
  const [phaseFilter, setPhaseFilter] = useState<PhaseId | null>(null)

  const { data: orgsData } = useQuery({
    queryKey: ['diagnostics', 'orgs', kind],
    queryFn: () => config.listOrganizations(),
    enabled: !isOwnOrg,
  })
  const organizations = orgsData?.data || orgsData || []

  useEffect(() => {
    if (isOwnOrg && ownOrgId) setOrgId(ownOrgId)
  }, [isOwnOrg, ownOrgId])

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

      {!isOwnOrg && (
        <Card padding="md">
          <div className="flex flex-wrap items-center gap-3">
            <Building2 size={18} className="shrink-0 text-dv-gold" />
            <select
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="min-h-11 flex-1 rounded-lg border border-bdr-subtle bg-surface-1 px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold"
            >
              <option value="">{config.pickerLabel}</option>
              {organizations.map((org: any) => (
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
        </>
      )}
    </motion.div>
  )
}

export default DiagnosticWorkspace
