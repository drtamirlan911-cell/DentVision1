import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Building2, CalendarClock, DollarSign, FileText, FlaskConical, TrendingUp, Users, Wallet } from 'lucide-react'

import { Card } from '@/components/ui/ds/Card'
import { HeroStat, PageHeader } from '@/components/ui/ds/StatCard'
import { QueryError } from '@/components/ui/ds/QueryError'
import { Badge } from '@/components/ui/ds/Badge'
import { Tabs } from '@/components/ui/ds/Misc'
import { countAwaitingAction, countByPhase, type PhaseId } from '@/lib/referralStatus'
import { selectWorkspaceContext } from '@/lib/workspaceContext'
import { resolveWorkspaceTab } from '@/lib/workspaceNavigation'
import { queryKeys } from '@/queries/keys'
import { useAuth } from '@/store/auth.store'
import { useIam } from '@/iam'
import * as api from '@/utils/api'
import { useEcosystemUrlContext } from '@/hooks/useEcosystemUrlContext'
import EcosystemCaseFlow from '@/components/ecosystem/EcosystemCaseFlow'

import { WORKSPACES, type OrgKind } from './config'
import { Pipeline } from './Pipeline'
import { ReferralsTab } from './ReferralsTab'
import { OnlineBookingsTab } from './OnlineBookingsTab'
import { ServicesTab } from './ServicesTab'
import { PaymentsTab } from './PaymentsTab'
import { CashierTab } from './CashierTab'
import DiagnosticSettlements from '@/pages/diagnostics/DiagnosticSettlements'
import { PartnerBranchSubscriptionBilling } from '@/components/billing/PartnerBranchSubscriptionBilling'
import { TeamTab } from './TeamTab'
import { WorklistTab } from './WorklistTab'
import { ModalitiesTab } from './ModalitiesTab'
import { OrganizationOnboarding } from '@/components/OrganizationOnboarding'
import { WorkspaceRoleStart } from '@/components/workspaces/WorkspaceRoleStart'

/**
 * One workspace for diagnostic centres and laboratories.
 *
 * `CenterDashboard` and `LabDashboard` were the same screen twice — see
 * `config.ts` for what actually differs. Both entry routes still exist and both
 * sidebar items still work; only the implementation is shared.
 */
export function DiagnosticWorkspace({ kind: pinnedKind }: { kind?: OrgKind }) {
  const { user, activeWorkspace, workspaceContexts } = useAuth()
  const iam = useIam()
  const ecosystem = useEcosystemUrlContext()
  const isSuperadmin = user?.role === 'superadmin'
  const activeScopeType = String(activeWorkspace?.scopeType || user?.organizationType || '').toUpperCase()
  const roleKey = String(activeWorkspace?.roleKey || activeWorkspace?.role || user?.effectiveRole || user?.role || '').toLowerCase()
  const isFinanceRole = /(finance|cashier|accountant)/.test(roleKey)
  const isRadiologyRole = /(radiologist|radiology_technician)/.test(roleKey)
  const isReceptionRole = /(reception|operator)/.test(roleKey)

  const claimedKind: OrgKind | undefined =
    activeScopeType === 'LABORATORY' ? 'LAB'
      : activeScopeType === 'DIAGNOSTIC_CENTER' ? 'CENTER'
        : undefined

  const [orgId, setOrgId] = useState<string>('')
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const [activeTab, setActiveTabState] = useState(requestedTab || 'referrals')
  const setActiveTab = (nextTab: string) => {
    setActiveTabState(nextTab)
    const next = new URLSearchParams(searchParams)
    next.set('tab', nextTab)
    setSearchParams(next, { replace: true })
  }
  const [phaseFilter, setPhaseFilter] = useState<PhaseId | null>(null)

  const contextsQuery = useQuery({
    queryKey: ['iam', 'me', 'contexts'],
    queryFn: () => api.getMyContexts(),
    enabled: !claimedKind,
  })
  const { data: contextsData, isLoading: contextsLoading, isError: contextsError } = contextsQuery

  const diagnosticContexts = useMemo(
    () => (contextsData?.contexts || workspaceContexts || []).filter(
      (c: any) => c.scopeType === 'DIAGNOSTIC_CENTER' || c.scopeType === 'LABORATORY',
    ),
    [contextsData, workspaceContexts],
  )

  const selectedDiagnosticContext = useMemo(
    () => selectWorkspaceContext(diagnosticContexts, {
      scopeId: activeWorkspace?.scopeId || user?.organizationOriginalId,
      organizationId: activeWorkspace?.organizationId || user?.organizationId,
    }),
    [diagnosticContexts, activeWorkspace, user?.organizationOriginalId, user?.organizationId],
  )
  const inferredKind: OrgKind | undefined = selectedDiagnosticContext?.scopeType === 'LABORATORY'
    ? 'LAB'
    : selectedDiagnosticContext?.scopeType === 'DIAGNOSTIC_CENTER' ? 'CENTER' : undefined
  const kind: OrgKind = pinnedKind ?? claimedKind ?? inferredKind ?? 'CENTER'
  const requiresWorkspaceSelection = !pinnedKind && !claimedKind && !selectedDiagnosticContext
    && (diagnosticContexts.length > 0 || Boolean(activeWorkspace))

  const config = WORKSPACES[kind]
  const canReadOperations = isSuperadmin || iam.hasPermission(kind === 'CENTER' ? 'diagnostics.read' : 'lab.read')
  const canReadFinance = isSuperadmin || iam.hasPermission('billing.read')
  const canManageBilling = isSuperadmin || iam.hasPermission('billing.manage')
  const canReadPartnerBilling = isSuperadmin || canReadFinance || iam.hasPermission('billing.manage') || iam.hasPermission('finance.manage')
  const canManagePartnerBilling = isSuperadmin || iam.hasPermission('billing.manage') || iam.hasPermission('finance.manage')
  const canManageCatalog = isSuperadmin || iam.hasPermission(kind === 'CENTER' ? 'diagnostics.manage' : 'lab.manage')
  const canReadTeam = isSuperadmin || iam.hasPermission('staff.read')
  const isOwnOrg = activeScopeType === config.organizationType
  const ownOrgId = activeWorkspace?.scopeType === config.organizationType
    ? activeWorkspace.scopeId
    : user?.organizationOriginalId || user?.organizationId || ''
  const partnerBillingOrganizationId = activeScopeType === config.organizationType
    ? String(activeWorkspace?.organizationId || user?.organizationId || '')
    : ''

  const myOrgs = useMemo(
    () => diagnosticContexts.filter((c: any) => c.scopeType === config.organizationType),
    [diagnosticContexts, config.organizationType],
  )

  const { data: catalogueData } = useQuery({
    queryKey: ['diagnostics', 'orgs', kind],
    queryFn: () => config.listOrganizations(),
    enabled: !isOwnOrg && isSuperadmin,
  })
  const catalogue = catalogueData?.data || catalogueData || []

  const pickable = isSuperadmin
    ? catalogue.map((org: any) => ({ id: org.id, name: org.name, city: org.city }))
    : myOrgs.map((ctx: any) => ({ id: ctx.scopeId, name: ctx.name, city: undefined }))

  const contextualOrgId = ecosystem.organizationId
  const contextualOrgAuthorized =
    isSuperadmin
    || (isOwnOrg && (contextualOrgId === ownOrgId || contextualOrgId === activeWorkspace?.organizationId))

  useEffect(() => {
    if (contextualOrgId) {
      if (contextualOrgAuthorized) {
        if (orgId !== contextualOrgId) setOrgId(contextualOrgId)
      } else if (orgId && !isOwnOrg && !isSuperadmin) {
        setOrgId('')
      }
      return
    }
    if (isOwnOrg && ownOrgId) { setOrgId(ownOrgId); return }
    if (!orgId && !isSuperadmin && myOrgs.length === 1) setOrgId(myOrgs[0].scopeId)
  }, [contextualOrgId, contextualOrgAuthorized, isOwnOrg, ownOrgId, orgId, isSuperadmin, myOrgs])

  // Membership in another organization does not activate that context.
  // Diagnostic API access is available only in the active authorized context;
  // an ecosystem URL organizationId is context, not authorization proof.
  const hasDiagnosticAccess = !requiresWorkspaceSelection && (isSuperadmin || (isOwnOrg && orgId === ownOrgId && (canReadOperations || canReadPartnerBilling)))
  const needsOnboarding = !pinnedKind && !claimedKind && !requiresWorkspaceSelection && !isOwnOrg && !isSuperadmin
    && !contextsLoading && !contextsError && diagnosticContexts.length === 0

  const scope = config.referralScope(orgId)
  const { data: referralsData } = useQuery({
    queryKey: queryKeys.diagnostics.referrals({ ...scope, limit: '100' }),
    queryFn: () => api.getDiagnosticReferrals({ ...scope, limit: '100' }),
    enabled: !!orgId && hasDiagnosticAccess && canReadOperations,
  })
  const referrals = useMemo(
    () => referralsData?.items || referralsData?.data || referralsData?.referrals || [],
    [referralsData],
  )

  const counts = useMemo(() => countByPhase(referrals), [referrals])
  const awaiting = useMemo(() => countAwaitingAction(referrals), [referrals])

  const roleGuide = isFinanceRole
    ? { role: roleKey.includes('cashier') ? 'Кассир' : 'Финансовый специалист', heading: 'Принимайте оплату и следите за расчётами', description: 'Ваш рабочий раздел — касса и финансовые операции. Клинические и организационные настройки не нужны для ежедневной работы.', steps: ['Откройте кассу или расчёты', 'Найдите нужное направление и проверьте сумму', 'Зафиксируйте оплату и проверьте статус расчёта'] }
    : isRadiologyRole
      ? { role: roleKey.includes('technician') ? 'Рентген-лаборант' : 'Рентгенолог', heading: 'Выполняйте исследования и проверяйте результаты', description: 'Начинайте с рабочей очереди. В карточке направления проверяйте клинический контекст, выполняйте свой этап и передавайте результат следующему специалисту.', steps: ['Откройте рабочую очередь или направления', 'Проверьте данные и статус исследования', 'Завершите свой этап и передайте результат'] }
      : isReceptionRole
        ? { role: roleKey.includes('reception') ? 'Регистратор' : 'Оператор', heading: 'Принимайте новые направления и организуйте запись', description: 'Сначала обработайте новые входящие направления. Проверяйте, кто направил пациента, какие данные уже заполнены и какой следующий шаг требуется.', steps: ['Откройте входящие направления', 'Проверьте данные и назначьте следующий шаг', 'Передайте направление ответственному специалисту'] }
        : roleKey.includes('quality')
          ? { role: 'Специалист контроля качества', heading: 'Проверяйте полноту и корректность результата', description: 'Работайте с результатами, ожидающими проверки. Не изменяйте исходные данные без зафиксированной причины.', steps: ['Откройте очередь результатов', 'Проверьте обязательные данные и вложения', 'Зафиксируйте проверку или замечание'] }
          : { role: roleKey.includes('owner') ? 'Владелец центра' : roleKey.includes('admin') || roleKey.includes('manager') ? 'Руководитель' : 'Сотрудник диагностики', heading: 'Сначала обработайте задачи, ожидающие действия', description: 'Рабочая очередь показывает незавершённые направления. Команда, оборудование, услуги и финансы находятся в отдельных разделах и открываются только при наличии соответствующих прав.', steps: ['Проверьте количество задач в очереди', 'Откройте направление и выполните доступное действие', 'Передайте работу следующему ответственному'] }
  const roleStartTab = isFinanceRole
    ? (canManageBilling ? 'cashier' : canReadPartnerBilling ? 'finance' : kind === 'CENTER' ? 'worklist' : 'referrals')
    : kind === 'CENTER' && canReadOperations ? 'worklist'
      : canReadOperations ? 'referrals' : canManageBilling ? 'cashier' : 'finance'

  const tabs = [
    ...(kind === 'CENTER' && canReadOperations ? [
      { id: 'worklist', label: 'Рабочая очередь', icon: <FileText size={14} /> },
      { id: 'online-bookings', label: 'Онлайн-запись', icon: <CalendarClock size={14} /> },
    ] : []),
    ...(kind === 'CENTER' && canManageCatalog ? [
      { id: 'modalities', label: 'Оборудование', icon: <FlaskConical size={14} /> },
    ] : []),
    ...(canManageBilling ? [
      { id: 'cashier', label: 'Касса', icon: <Wallet size={14} /> },
    ] : []),
    ...(canReadOperations ? [
      { id: 'referrals', label: config.referralsLabel, icon: <FileText size={14} /> },
    ] : []),
    ...(canReadPartnerBilling ? [
      { id: 'finance', label: 'Финансы', icon: <TrendingUp size={14} /> },
    ] : []),
    ...(canReadFinance && canReadOperations ? [
      { id: 'payments', label: 'Оплаты', icon: <DollarSign size={14} /> },
    ] : []),
    ...(canManageCatalog ? [
      { id: 'services', label: config.servicesLabel, icon: <FlaskConical size={14} /> },
    ] : []),
    ...(canReadTeam ? [
      { id: 'team', label: 'Сотрудники', icon: <Users size={14} /> },
    ] : []),
  ]

  const availableTabIds = tabs.map((tab) => tab.id)
  const fallbackTab = availableTabIds.includes(roleStartTab)
    ? roleStartTab
    : availableTabIds[0] || ''
  const availableTabSignature = availableTabIds.join('|')

  // The route is the source of truth for sidebar deep-links and browser
  // back/forward. Invalid or unauthorized tab requests fall back to the
  // first role-allowed workspace section instead of showing an empty panel.
  useEffect(() => {
    const nextTab = resolveWorkspaceTab(requestedTab, availableTabIds, fallbackTab)
    setActiveTabState(nextTab)
    if (requestedTab !== nextTab) {
      const next = new URLSearchParams(searchParams)
      if (nextTab) next.set('tab', nextTab)
      else next.delete('tab')
      setSearchParams(next, { replace: true })
    }
  }, [requestedTab, availableTabSignature, fallbackTab, searchParams, setSearchParams])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-full space-y-6 overflow-x-hidden p-4 pb-[calc(var(--dv-bottomnav-height,3.5rem)+var(--dv-safe-bottom)+1rem)] sm:p-6 sm:pb-6"
    >
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        icon={<FlaskConical size={22} />}
        actions={<Badge variant="outline">{kind === 'CENTER' ? 'Центр' : 'Лаборатория'}</Badge>}
      />

      {orgId && hasDiagnosticAccess && (canReadOperations || canReadPartnerBilling || canManageBilling) && (
        <WorkspaceRoleStart
          roleLabel={roleGuide.role}
          heading={roleGuide.heading}
          description={roleGuide.description}
          steps={roleGuide.steps}
          actionLabel="Открыть мой рабочий раздел"
          onAction={() => setActiveTab(roleStartTab)}
        />
      )}

      {(ecosystem.patientId || ecosystem.caseId) && (
        <EcosystemCaseFlow context={ecosystem} compact />
      )}

      {contextsError && !isOwnOrg && !isSuperadmin && (
        <QueryError what="список ваших организаций" onRetry={() => contextsQuery.refetch()} />
      )}

      {needsOnboarding && (
        <OrganizationOnboarding kind={kind} onComplete={() => window.location.reload()} />
      )}

      {requiresWorkspaceSelection && (
        <Card padding="lg">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-txt-primary">Выберите рабочее пространство</h2>
            <p className="text-sm text-txt-secondary">
              В верхнем переключателе выберите нужный диагностический центр или лабораторию. Кабинет не будет открывать первую попавшуюся организацию из списка.
            </p>
          </div>
        </Card>
      )}

      {!contextsLoading && !contextsError && !hasDiagnosticAccess && !requiresWorkspaceSelection && (
        <Card padding="lg">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-txt-primary">Нет доступа к рабочему пространству</h2>
            <p className="text-sm text-txt-secondary">
              Это рабочее пространство доступно только владельцам и сотрудникам соответствующего диагностического центра или лаборатории.
            </p>
          </div>
        </Card>
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

      {orgId && hasDiagnosticAccess && (
        <>
          {canReadOperations && (
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
          )}

          <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
            <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} wrap />
          </div>

          {activeTab === 'worklist' && kind === 'CENTER' && <WorklistTab config={config} orgId={orgId} />}
          {activeTab === 'modalities' && kind === 'CENTER' && <ModalitiesTab config={config} orgId={orgId} />}
          {activeTab === 'online-bookings' && kind === 'CENTER' && <OnlineBookingsTab centerId={orgId} />}
          {activeTab === 'cashier' && <CashierTab config={config} orgId={orgId} />}
          {activeTab === 'referrals' && (
            <ReferralsTab config={config} orgId={orgId} phaseFilter={phaseFilter} onClearPhase={() => setPhaseFilter(null)} />
          )}
          {activeTab === 'finance' && <div className="space-y-4">
            <DiagnosticSettlements />
            {partnerBillingOrganizationId && <PartnerBranchSubscriptionBilling organizationId={partnerBillingOrganizationId} canReadBilling={canReadPartnerBilling} canManageBilling={canManagePartnerBilling} />}
          </div>}
          {activeTab === 'services' && <ServicesTab config={config} orgId={orgId} />}
          {activeTab === 'payments' && <PaymentsTab config={config} orgId={orgId} />}
          {activeTab === 'team' && <TeamTab config={config} orgId={orgId} />}
        </>
      )}
    </motion.div>
  )
}

export default DiagnosticWorkspace
