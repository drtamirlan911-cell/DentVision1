import { withJobLock } from '../lib/jobLock.js';
import { reconcilePartnerEconomics } from '../modules/finance/partner-economics.service.js';

export interface PartnerEconomicsReconciliationCronResult {
  from: Date;
  to: Date;
  checked: number;
  discrepancies: number;
}

export async function runPartnerEconomicsReconciliationCron(): Promise<PartnerEconomicsReconciliationCronResult> {
  const to = new Date();
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  const result = await reconcilePartnerEconomics({ from, to });
  return {
    from,
    to,
    checked: result.rows.length,
    discrepancies: result.discrepancies,
  };
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startPartnerEconomicsReconciliationCronInterval(ms = 24 * 60 * 60 * 1000): void {
  if (timer) return;

  const tick = async () => {
    try {
      const result = await withJobLock('partner_economics_reconciliation_cron', runPartnerEconomicsReconciliationCron);
      if (!result) return;
      if (result.discrepancies > 0) {
        console.error(
          `[PartnerEconomicsReconciliation] discrepancies=${result.discrepancies} checked=${result.checked} window=${result.from.toISOString()}..${result.to.toISOString()}`,
        );
      } else {
        console.log(
          `[PartnerEconomicsReconciliation] ok checked=${result.checked} window=${result.from.toISOString()}..${result.to.toISOString()}`,
        );
      }
    } catch (error) {
      console.error('[PartnerEconomicsReconciliation] tick failed', error);
    }
  };

  setTimeout(tick, 30_000);
  timer = setInterval(tick, ms);
  console.log(`[PartnerEconomicsReconciliation] interval started (${ms / 3600000}h)`);
}
