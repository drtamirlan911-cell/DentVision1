/**
 * Business Intelligence Engine — unified financial analytics.
 *
 * Calculates MRR/ARR, Churn, LTV, CAC, Unit Economics, Cash Flow,
 * 12-month scenarios, and Partner ROI from CRM/Shop/Academy/Billing data.
 */

import prisma from '../../lib/prisma.js';

// ─── Types ───

export interface MRRMetrics {
  mrr: number;
  arr: number;
  activeClinics: number;
  activeDoctors: number;
  payingUsers: number;
  freeUsers: number;
  conversionRate: number;
  mrrGrowthPct: number;
  previousMrr: number;
  currency: string;
}

export interface ChurnMetrics {
  churnRate: number;
  churnedClinics: number;
  totalClinics: number;
  newClinics: number;
  netGrowth: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface LTVMetrics {
  ltv: number;
  avgRevenuePerClinic: number;
  avgLifetimeMonths: number;
  cac: number;
  ltvCacRatio: number;
}

export interface CACMetrics {
  cac: number;
  totalAcquisitionSpend: number;
  newCustomers: number;
  paybackPeriodMonths: number;
}

export interface UnitEconomics {
  revenuePerClinic: number;
  revenuePerDoctor: number;
  revenuePerPatient: number;
  revenuePerAiRequest: number;
  grossProfit: number;
  grossMargin: number;
  operatingCosts: number;
  netProfit: number;
  netMargin: number;
}

export interface CashFlowEntry {
  month: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  operating: number;
  netProfit: number;
  cumulative: number;
}

export interface CashFlow {
  entries: CashFlowEntry[];
  breakEvenMonth: string | null;
  totalRevenue: number;
  totalCosts: number;
  totalProfit: number;
}

export interface ScenarioForecast {
  optimistic: CashFlowEntry[];
  base: CashFlowEntry[];
  worst: CashFlowEntry[];
  breakEven: { optimistic: string | null; base: string | null; worst: string | null };
}

export interface PartnerROI {
  partnerId: string;
  partnerName: string;
  partnerType: string;
  sales: number;
  turnover: number;
  profit: number;
  customers: number;
  adSpend: number;
  conversion: number;
  repeatPurchases: number;
  avgCheck: number;
  roi: number;
}

// ─── Subscription pricing (KZT) ───

const PLAN_PRICE: Record<string, number> = {
  free: 0,
  starter: 0,
  professional: 49900,
  enterprise: 149900,
};

// ─── MRR / ARR ───

export async function getMRR(): Promise<MRRMetrics> {
  const now = new Date();
  const prevMonth = new Date(now);
  prevMonth.setMonth(prevMonth.getMonth() - 1);

  const [activeSubs, allClinics, doctors, users, prevSubs] = await Promise.all([
    prisma.subscription.findMany({
      where: { ownerType: 'CLINIC', status: 'active' },
      select: { plan: true, createdAt: true },
    }),
    prisma.clinic.findMany({ select: { id: true, active: true } }),
    prisma.user.findMany({ where: { role: 'DOCTOR' }, select: { id: true } }),
    prisma.user.findMany({ select: { id: true } }),
    prisma.subscription.findMany({
      where: {
        ownerType: 'CLINIC',
        status: 'active',
        createdAt: { lt: now },
      },
      select: { plan: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    }),
  ]);

  const mrr = activeSubs.reduce((s, x) => s + (PLAN_PRICE[x.plan] || 0), 0);
  const previousMrr = prevSubs.reduce((s, x) => s + (PLAN_PRICE[x.plan] || 0), 0);
  const mrrGrowthPct = previousMrr > 0 ? ((mrr - previousMrr) / previousMrr) * 100 : 0;

  const activeClinics = allClinics.filter((c) => c.active).length;
  const payingUsers = activeSubs.length;
  const freeUsers = users.length - payingUsers;

  return {
    mrr,
    arr: mrr * 12,
    activeClinics,
    activeDoctors: doctors.length,
    payingUsers,
    freeUsers: Math.max(0, freeUsers),
    conversionRate: users.length > 0 ? (payingUsers / users.length) * 100 : 0,
    mrrGrowthPct,
    previousMrr,
    currency: 'KZT',
  };
}

// ─── Churn ───

export async function getChurn(months = 1): Promise<ChurnMetrics> {
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setMonth(periodStart.getMonth() - months);

  const [churnedSubs, totalClinics, newClinics] = await Promise.all([
    prisma.subscription.findMany({
      where: {
        ownerType: 'CLINIC',
        status: 'suspended',
        updatedAt: { gte: periodStart, lte: now },
      },
      select: { ownerId: true },
    }),
    prisma.clinic.count(),
    prisma.clinic.count({ where: { createdAt: { gte: periodStart, lte: now } } }),
  ]);

  const uniqueChurned = new Set(churnedSubs.map((s) => s.ownerId)).size;
  const churnRate = totalClinics > 0 ? (uniqueChurned / totalClinics) * 100 : 0;

  return {
    churnRate,
    churnedClinics: uniqueChurned,
    totalClinics,
    newClinics,
    netGrowth: newClinics - uniqueChurned,
    periodStart,
    periodEnd: now,
  };
}

// ─── LTV ───

export async function getLTV(): Promise<LTVMetrics> {
  const mrrData = await getMRR();
  const cacData = await getCAC();

  const avgRevenuePerClinic = mrrData.activeClinics > 0
    ? mrrData.mrr / mrrData.activeClinics
    : 0;

  // Average lifetime: estimate from churn
  const churnData = await getChurn(3);
  const monthlyChurnRate = churnData.churnRate / 3;
  const avgLifetimeMonths = monthlyChurnRate > 0 ? 100 / monthlyChurnRate : 24;

  const ltv = avgRevenuePerClinic * avgLifetimeMonths;

  return {
    ltv: Math.round(ltv),
    avgRevenuePerClinic: Math.round(avgRevenuePerClinic),
    avgLifetimeMonths: Math.round(avgLifetimeMonths),
    cac: cacData.cac,
    ltvCacRatio: cacData.cac > 0 ? ltv / cacData.cac : 0,
  };
}

// ─── CAC ───

export async function getCAC(): Promise<CACMetrics> {
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const [marketingSpend, newCustomers] = await Promise.all([
    prisma.marketingCampaign.aggregate({
      where: { createdAt: { gte: threeMonthsAgo, lte: now } },
      _sum: { budget: true },
    }),
    prisma.clinic.count({ where: { createdAt: { gte: threeMonthsAgo, lte: now } } }),
  ]);

  const totalSpend = Number(marketingSpend._sum.budget ?? 0n);
  const cac = newCustomers > 0 ? totalSpend / newCustomers : 0;

  // Payback: months to recover CAC from avg monthly revenue
  const mrrData = await getMRR();
  const avgMonthlyRevenue = mrrData.activeClinics > 0 ? mrrData.mrr / mrrData.activeClinics : 0;
  const paybackPeriodMonths = avgMonthlyRevenue > 0 ? cac / avgMonthlyRevenue : 0;

  return {
    cac: Math.round(cac),
    totalAcquisitionSpend: totalSpend,
    newCustomers,
    paybackPeriodMonths: Math.round(paybackPeriodMonths * 10) / 10,
  };
}

// ─── Unit Economics ───

export async function getUnitEconomics(): Promise<UnitEconomics> {
  const mrrData = await getMRR();

  // Revenue from invoices (paid, last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [invoiceAgg, patientCount, aiEventCount, expenseAgg] = await Promise.all([
    prisma.payment.aggregate({
      where: {
        status: 'created',
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.patient.count(),
    prisma.aIEvent.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
    // Approximate operating costs from expenses if available
    prisma.payment.aggregate({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        domain: 'expense',
      },
      _sum: { amount: true },
    }),
  ]);

  const totalRevenue = Number(invoiceAgg._sum.amount ?? 0n);
  const monthlyRevenue = totalRevenue; // Already 30-day window

  // COGS estimate: ~40% of revenue for dental (supplies, lab costs)
  const cogs = monthlyRevenue * 0.4;
  const grossProfit = monthlyRevenue - cogs;
  const grossMargin = monthlyRevenue > 0 ? (grossProfit / monthlyRevenue) * 100 : 0;

  const operatingCosts = Number(expenseAgg._sum.amount ?? 0n) || monthlyRevenue * 0.3;
  const netProfit = grossProfit - operatingCosts;
  const netMargin = monthlyRevenue > 0 ? (netProfit / monthlyRevenue) * 100 : 0;

  const aiRequests = aiEventCount || 1;

  return {
    revenuePerClinic: mrrData.activeClinics > 0
      ? Math.round(monthlyRevenue / mrrData.activeClinics)
      : 0,
    revenuePerDoctor: mrrData.activeDoctors > 0
      ? Math.round(monthlyRevenue / mrrData.activeDoctors)
      : 0,
    revenuePerPatient: patientCount > 0
      ? Math.round(monthlyRevenue / patientCount)
      : 0,
    revenuePerAiRequest: Math.round(monthlyRevenue / aiRequests),
    grossProfit: Math.round(grossProfit),
    grossMargin: Math.round(grossMargin * 10) / 10,
    operatingCosts: Math.round(operatingCosts),
    netProfit: Math.round(netProfit),
    netMargin: Math.round(netMargin * 10) / 10,
  };
}

// ─── Cash Flow (12-month) ───

export async function getCashFlow(): Promise<CashFlow> {
  const now = new Date();
  const months = 12;
  const entries: CashFlowEntry[] = [];
  let cumulative = 0;
  let breakEvenMonth: string | null = null;

  // Get current MRR as baseline
  const mrrData = await getMRR();
  const baseMRR = mrrData.mrr;

  for (let i = 0; i < months; i++) {
    const date = new Date(now);
    date.setMonth(date.getMonth() + i);
    const monthLabel = date.toISOString().slice(0, 7);

    // Growth: 5% monthly (base scenario)
    const growthFactor = Math.pow(1.05, i);
    const revenue = Math.round(baseMRR * growthFactor);

    // COGS: 40% of revenue
    const cogs = Math.round(revenue * 0.4);
    const grossProfit = revenue - cogs;

    // Operating costs: fixed + variable
    const operating = Math.round(revenue * 0.25 + 500000);
    const netProfit = grossProfit - operating;

    cumulative += netProfit;

    entries.push({
      month: monthLabel,
      revenue,
      cogs,
      grossProfit,
      operating,
      netProfit,
      cumulative,
    });

    if (!breakEvenMonth && cumulative >= 0 && i > 0) {
      breakEvenMonth = monthLabel;
    }
  }

  return {
    entries,
    breakEvenMonth,
    totalRevenue: entries.reduce((s, e) => s + e.revenue, 0),
    totalCosts: entries.reduce((s, e) => s + e.cogs + e.operating, 0),
    totalProfit: entries.reduce((s, e) => s + e.netProfit, 0),
  };
}

// ─── Scenarios ───

export async function getScenarios(): Promise<ScenarioForecast> {
  const now = new Date();
  const months = 12;
  const mrrData = await getMRR();
  const baseMRR = mrrData.mrr;

  function buildScenario(growthRate: number, cogsPct: number, opexPct: number, fixedCost: number): CashFlowEntry[] {
    const entries: CashFlowEntry[] = [];
    let cumulative = 0;

    for (let i = 0; i < months; i++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() + i);
      const monthLabel = date.toISOString().slice(0, 7);

      const growthFactor = Math.pow(1 + growthRate, i);
      const revenue = Math.round(baseMRR * growthFactor);
      const cogs = Math.round(revenue * cogsPct);
      const grossProfit = revenue - cogs;
      const operating = Math.round(revenue * opexPct + fixedCost);
      const netProfit = grossProfit - operating;
      cumulative += netProfit;

      entries.push({
        month: monthLabel,
        revenue,
        cogs,
        grossProfit,
        operating,
        netProfit,
        cumulative,
      });
    }
    return entries;
  }

  const optimistic = buildScenario(0.08, 0.35, 0.20, 400000);
  const base = buildScenario(0.05, 0.40, 0.25, 500000);
  const worst = buildScenario(0.02, 0.45, 0.30, 600000);

  function findBreakEven(entries: CashFlowEntry[]): string | null {
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].cumulative >= 0 && entries[i - 1].cumulative < 0) {
        return entries[i].month;
      }
    }
    return null;
  }

  return {
    optimistic,
    base,
    worst,
    breakEven: {
      optimistic: findBreakEven(optimistic),
      base: findBreakEven(base),
      worst: findBreakEven(worst),
    },
  };
}

// ─── Partner ROI ───

export async function getPartnerROI(): Promise<PartnerROI[]> {
  const partners = await prisma.partner.findMany({
    where: { status: 'active' },
    include: {
      kpis: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  const results: PartnerROI[] = [];

  for (const partner of partners) {
    // Get transactions linked to this partner's refType/refId
    const transactions = await prisma.transaction.findMany({
      where: {
        refType: partner.refType,
        refId: partner.refId,
        type: 'sale',
        status: 'COMPLETED',
      },
    });

    const sales = transactions.length;
    const turnover = transactions.reduce((s, t) => s + Number(t.amount), 0);

    // Get marketing spend
    const campaigns = await prisma.marketingCampaign.findMany({
      where: { partnerId: partner.id },
    });
    const adSpend = campaigns.reduce((s, c) => s + Number(c.budget), 0);

    // Use KPI data if available
    const kpi = partner.kpis[0];
    const kpiMetrics = (kpi?.metricsJson as Record<string, number>) || {};

    const customers = kpiMetrics.customers || sales;
    const repeatPurchases = kpiMetrics.repeatPurchases || 0;
    const avgCheck = sales > 0 ? turnover / sales : 0;
    const conversion = kpiMetrics.conversion || (sales > 0 ? (sales / Math.max(customers, 1)) * 100 : 0);

    const profit = turnover - adSpend;
    const roi = adSpend > 0 ? ((profit - adSpend) / adSpend) * 100 : 0;

    results.push({
      partnerId: partner.id,
      partnerName: `${partner.refType} ${partner.refId}`.slice(0, 50),
      partnerType: partner.type,
      sales,
      turnover,
      profit,
      customers,
      adSpend,
      conversion: Math.round(conversion * 10) / 10,
      repeatPurchases,
      avgCheck: Math.round(avgCheck),
      roi: Math.round(roi * 10) / 10,
    });
  }

  return results;
}

// ─── Full BI Dashboard ───

export async function getBIDashboard() {
  const [mrr, churn, ltv, cac, unitEconomics, cashFlow, scenarios, partnerROI] = await Promise.all([
    getMRR(),
    getChurn(),
    getLTV(),
    getCAC(),
    getUnitEconomics(),
    getCashFlow(),
    getScenarios(),
    getPartnerROI(),
  ]);

  return {
    mrr,
    churn,
    ltv,
    cac,
    unitEconomics,
    cashFlow,
    scenarios,
    partnerROI,
    generatedAt: new Date().toISOString(),
  };
}
