import * as api from '@/utils/api'

/**
 * The only thing that differs between the diagnostic-centre and laboratory
 * workspaces.
 *
 * Both screens were maintained as separate files that, once names were
 * normalised, shared 381 identical lines — the same queries, the same accept →
 * start → sign flow, the same tabs. They had already started to drift (the
 * mobile overflow guard was applied to one and not the other), and the
 * laboratory was missing a cashier and a revenue view for no reason other than
 * that nobody had built the endpoints. Everything a reader needs to tell the
 * two apart now lives in this table.
 */
export type OrgKind = 'CENTER' | 'LAB'

export interface WorkspaceConfig {
  kind: OrgKind
  /** Matches AuthUser.organizationType when the user belongs to this org. */
  organizationType: string
  title: string
  subtitle: string
  /** How this kind names the work it receives. */
  referralsLabel: string
  servicesLabel: string
  pickerLabel: string
  emptyLabel: string
  listOrganizations: () => Promise<any>
  /** Referral query takes centerId or labId — never both. */
  referralScope: (orgId: string) => Record<string, string>
  getPricing: (orgId: string) => Promise<any>
  updatePricing: (orgId: string, rows: { id: string; price: number }[]) => Promise<any>
  createService: (orgId: string, data: { name: string; category: string; price?: number }) => Promise<any>
  getPayments: (orgId: string) => Promise<any>
  getDashboard: (orgId: string) => Promise<any>
  collectPayment: (orgId: string, payload: { referralId: string; cost: number }) => Promise<any>
  /** Path to the registration page for users who are not yet partners. */
  registerPath: string
}

export const WORKSPACES: Record<OrgKind, WorkspaceConfig> = {
  CENTER: {
    kind: 'CENTER',
    organizationType: 'DIAGNOSTIC_CENTER',
    title: 'Диагностический центр',
    subtitle: 'Направления, услуги и оплаты',
    referralsLabel: 'Направления',
    servicesLabel: 'Услуги и цены',
    pickerLabel: 'Выберите диагностический центр',
    emptyLabel: 'Нет направлений',
    listOrganizations: () => api.getDiagnosticCenters(),
    referralScope: (orgId) => ({ centerId: orgId }),
    getPricing: (orgId) => api.getDiagnosticsCenterPricing(orgId),
    updatePricing: (orgId, rows) => api.updateDiagnosticsCenterPricing(orgId, rows),
    createService: (orgId, data) => api.createDiagnosticsCenterStudy(orgId, data),
    getPayments: (orgId) => api.getDiagnosticsCenterPayments(orgId),
    getDashboard: (orgId) => api.getDiagnosticsCenterDashboard(orgId),
    collectPayment: (orgId, payload) => api.collectDiagnosticsCashierPayment(orgId, payload),
    registerPath: '/register-diagnostics?type=center',
  },
  LAB: {
    kind: 'LAB',
    organizationType: 'LABORATORY',
    title: 'Лаборатория',
    subtitle: 'Заказы, анализы и оплаты',
    referralsLabel: 'Заказы',
    servicesLabel: 'Анализы и цены',
    pickerLabel: 'Выберите лабораторию',
    emptyLabel: 'Нет заказов',
    listOrganizations: () => api.getDiagnosticLaboratories(),
    referralScope: (orgId) => ({ labId: orgId }),
    getPricing: (orgId) => api.getDiagnosticsLabPricing(orgId),
    updatePricing: (orgId, rows) => api.updateDiagnosticsLabPricing(orgId, rows),
    createService: (orgId, data) => api.createDiagnosticsLabTest(orgId, data),
    getPayments: (orgId) => api.getDiagnosticsLabPayments(orgId),
    getDashboard: (orgId) => api.getDiagnosticsLabDashboard(orgId),
    collectPayment: (orgId, payload) => api.collectDiagnosticsLabCashierPayment(orgId, payload),
    registerPath: '/register-diagnostics?type=lab',
  },
}
