/**
 * BI snapshot cron — once a day, persist the current SaaSMetrics,
 * per-clinic CustomerMetrics, and a full-platform BISnapshot. See
 * modules/bi/snapshot.service.ts for why: these tables existed, unused,
 * because bi.service.ts's numbers were only ever computed live.
 */
import { runDailyBiSnapshots } from '../modules/bi/snapshot.service.js';

let timer: ReturnType<typeof setInterval> | null = null;

export function startBiSnapshotCronInterval(ms = 24 * 60 * 60 * 1000): void {
  if (timer) clearInterval(timer);
  console.log(`[biSnapshotCron] started, interval=${ms}ms`);
  // Boot run shortly after start (staggered after the other cron boot runs),
  // then once a day. Snapshots are additive, not idempotency-guarded — a
  // second run same-day makes a second row, which is intended for anything
  // triggered more than once (a restart), not a defect to guard against.
  setTimeout(() => {
    runDailyBiSnapshots().catch((e) => console.error('[biSnapshotCron] boot run failed', e));
  }, 45_000);
  timer = setInterval(() => {
    runDailyBiSnapshots().catch((e) => console.error('[biSnapshotCron] interval failed', e));
  }, ms);
}
