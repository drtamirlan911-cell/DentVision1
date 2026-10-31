import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';

const BASE_URL = process.env.PLAYWRIGHT_UI_URL || 'http://127.0.0.1:3000';
const API_BASE_URL = process.env.VITE_API_URL || 'http://127.0.0.1:3001';
const VISUAL_EVIDENCE_ROOT = process.env.VISUAL_EVIDENCE_DIR || 'e2e/visual-evidence';
const PASSWORD = 'Test1234!';

type PendingRequest = { epoch: number; label: string }
type RequestLedger = {
  epoch: number
  sequence: number
  pending: Map<number, PendingRequest>
  requestIds: WeakMap<object, number>
  requestEpochs: WeakMap<object, number>
  byIdentity: Map<string, number[]>
}

// Keep request drains scoped to the active main document. Late lifecycle events
// from a previous page must not be attributed to the route loaded after goto().
const pendingCriticalRequestsByPage = new WeakMap<Page, RequestLedger>();

const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password', '/booking', '/demo', '/pricing', '/terms', '/privacy', '/jobs', '/help', '/community', '/shop'];
const AUTH_COMMON_ROUTES = ['/', '/ai', '/help', '/notifications', '/profile'];
const AUTHENTICATED_BASE_PAGES = ['shop','school','profile','settings','diagnostics','diagnostics-centers','diagnostics-labs','diagnostics-laboratories'] as const;
const ROUTES = [
  '/ai','/analytics','/settings','/help','/notifications','/admin','/bi','/security','/audit','/agent-activity','/ai-approvals','/backup','/profile',
  '/supplier','/jobs','/community','/quality','/platform-finance','/ai-governance','/support',
  '/crm/schedule','/crm/patients','/crm/cashier','/crm/pricelist','/crm/lab','/crm/inventory','/crm/stock-rules','/crm/marketing','/crm/promotions','/crm/staff',
  '/crm/medical-card','/crm/icd10','/crm/visits','/crm/documents','/crm/reminders','/crm/workflow','/crm/dental-chart','/crm/treatment-plans','/crm/clinic-settings','/crm/billing','/crm/patient-inbox','/crm/integrations/messaging','/crm/finance',
  '/shop','/shop/checkout','/shop/orders','/shop/favorites','/shop/suppliers',
  '/diagnostics','/diagnostics/referrals','/diagnostics/referrals/new','/diagnostics/centers','/diagnostics/labs','/diagnostics/laboratories','/diagnostics/patients','/diagnostics/results','/diagnostics/calendar','/diagnostics/statistics','/diagnostics/settings','/diagnostics/center','/diagnostics/lab','/diagnostics/workspace','/diagnostics/center-dashboard','/diagnostics/lab-dashboard','/diagnostics/registrations','/diagnostics/registration-requests',
  '/school','/school/workspace','/school/course/e2e','/school/courses','/patient-portal',
] as const;

type Role = {
  id: string; email: string; label: string;
  family: 'clinic' | 'patient' | 'diagnostic' | 'medical-lab' | 'dental-lab' | 'platform';
  pages: string[]; mustNotContain: RegExp[]; entry: RegExp;
};

const CLINIC_OWNER_PAGES = ['community','dashboard','schedule','patients','medical-card','visits','icd10','documents','finance','cashier','pricelist','lab','reminders','promotions','inventory','staff','audit','agent-activity','ai-approvals','backup','shop','school','analytics','settings','clinic-settings','billing','treatment-plans','dental-chart','diagnostics','diagnostics-referrals','diagnostics-referral-create','diagnostics-centers','diagnostics-labs','diagnostics-results','profile','bi','patient-inbox','workflow'];
const CLINIC_ADMIN_PAGES = ['community','schedule','patients','medical-card','visits','icd10','documents','finance','cashier','pricelist','lab','reminders','promotions','inventory','staff','shop','school','analytics','settings','clinic-settings','billing','treatment-plans','dental-chart','diagnostics','diagnostics-referrals','diagnostics-referral-create','diagnostics-results','profile','patient-inbox','workflow','ai-approvals'];
const CLINIC_DOCTOR_PAGES = ['community','schedule','patients','medical-card','visits','icd10','pricelist','documents','lab','reminders','school','treatment-plans','dental-chart','diagnostics-referrals','diagnostics-referral-create','diagnostics-results','profile','ai-approvals'];
const CLINIC_ASSISTANT_PAGES = ['community','schedule','patients','visits','documents','reminders','lab','shop','school','diagnostics-referrals','diagnostics-referral-create','diagnostics-results','profile'];
const CLINIC_MANAGER_PAGES = ['dashboard','schedule','patients','analytics','inventory','staff','shop','pricelist','profile'];
const PLATFORM_SUPERADMIN_PAGES = ['admin','audit','agent-activity','ai-approvals','backup','analytics','settings','security','quality','diagnostics','diagnostics-centers','diagnostics-labs','platform-finance','ai-governance','support','profile','bi'];

const ROLES: readonly Role[] = [
  { id:'owner', email:'owner-a@test.com', label:'Владелец', family:'clinic', pages:[...AUTHENTICATED_BASE_PAGES,...CLINIC_OWNER_PAGES], mustNotContain:[/Владелец диагностического центра/i,/Владелец медицинской лаборатории/i,/Владелец зуботехнической лаборатории/i], entry:/\/ai(?:$|[?#])/ },
  { id:'admin', email:'admin-a@test.com', label:'Администратор', family:'clinic', pages:[...AUTHENTICATED_BASE_PAGES,...CLINIC_ADMIN_PAGES], mustNotContain:[], entry:/\/ai|\/crm/ },
  { id:'doctor', email:'doctor-a@test.com', label:'Врач', family:'clinic', pages:[...AUTHENTICATED_BASE_PAGES,...CLINIC_DOCTOR_PAGES], mustNotContain:[/Super Admin/i], entry:/\/ai|\/crm/ },
  { id:'assistant', email:'assistant-a@test.com', label:'Ассистент', family:'clinic', pages:[...AUTHENTICATED_BASE_PAGES,...CLINIC_ASSISTANT_PAGES], mustNotContain:[/Super Admin/i], entry:/\/ai|\/crm/ },
  { id:'manager', email:'manager-a@test.com', label:'Менеджер', family:'clinic', pages:[...AUTHENTICATED_BASE_PAGES,...CLINIC_MANAGER_PAGES], mustNotContain:[/Super Admin/i], entry:/\/ai|\/crm/ },
  { id:'regular', email:'regular@test.com', label:'Студент', family:'platform', pages:['shop','school','profile'], mustNotContain:[/CRM|Клиника|Super Admin/i], entry:/\/school|\/profile/ },
  { id:'patient', email:'patient@dentvision.kz', label:'Пациент', family:'patient', pages:['patient-portal','profile','shop','school'], mustNotContain:[/CRM|Клиника|Super Admin|Диагностический центр|Медицинская лаборатория|зуботехническая/i], entry:/\/patient-portal/ },
  { id:'diagnostic-owner', email:'diagnostic-owner@test.com', label:'Владелец диагностического центра', family:'diagnostic', pages:[...AUTHENTICATED_BASE_PAGES,'diagnostics','diagnostics-referrals','diagnostics-centers','diagnostics-results','diagnostics-calendar','diagnostics-statistics','diagnostics-settings','profile'], mustNotContain:[/Врач|Стоматологическая клиника|Зуботехническая лаборатория/i], entry:/\/diagnostics\/center/ },
  { id:'diagnostic-operator', email:'diagnostic-operator@test.com', label:'Оператор диагностического центра', family:'diagnostic', pages:[...AUTHENTICATED_BASE_PAGES,'diagnostics','diagnostics-referrals','diagnostics-centers','diagnostics-results','diagnostics-calendar','profile'], mustNotContain:[/Настройки диагностического центра/i], entry:/\/diagnostics\/center/ },
  { id:'medical-lab-owner', email:'medical-lab-owner@test.com', label:'Владелец медицинской лаборатории', family:'medical-lab', pages:[...AUTHENTICATED_BASE_PAGES,'diagnostics','diagnostics-referrals','diagnostics-laboratories','diagnostics-results','diagnostics-calendar','diagnostics-statistics','diagnostics-settings','profile'], mustNotContain:[/Врач|Зуботехническая лаборатория/i], entry:/\/diagnostics\/lab/ },
  { id:'medical-lab-tech', email:'medical-lab-tech@test.com', label:'Лаборант', family:'medical-lab', pages:[...AUTHENTICATED_BASE_PAGES,'diagnostics','diagnostics-referrals','diagnostics-laboratories','diagnostics-results','profile'], mustNotContain:[/Настройки диагностического центра/i], entry:/\/diagnostics\/lab/ },
  { id:'dental-lab-owner', email:'dental-lab-owner@test.com', label:'Владелец зуботехнической лаборатории', family:'dental-lab', pages:[...AUTHENTICATED_BASE_PAGES,'diagnostics','diagnostics-referrals','diagnostics-laboratories','diagnostics-results','diagnostics-settings','profile'], mustNotContain:[/Медицинская лаборатория|Диагностический центр/i], entry:/\/diagnostics\/lab/ },
  { id:'dental-technician', email:'dental-technician@test.com', label:'Зубной техник', family:'dental-lab', pages:[...AUTHENTICATED_BASE_PAGES,'diagnostics','diagnostics-referrals','diagnostics-laboratories','diagnostics-results','profile'], mustNotContain:[/Настройки диагностического центра/i], entry:/\/diagnostics\/lab/ },
  { id:'superadmin', email:'superadmin@test.com', label:'Super Admin', family:'platform', pages:[...AUTHENTICATED_BASE_PAGES,...PLATFORM_SUPERADMIN_PAGES], mustNotContain:[/Пациент|Зубной техник/i], entry:/\/admin|\/ai/ },
  { id:'support', email:'support@test.com', label:'Поддержка', family:'platform', pages:[...AUTHENTICATED_BASE_PAGES,'admin','analytics'], mustNotContain:[/Врач|Пациент/i], entry:/\/admin|\/analytics|\/help|\/profile/ },
  { id:'laboratory', email:'lab-a@test.com', label:'Лаборатория', family:'clinic', pages:[...AUTHENTICATED_BASE_PAGES,'lab','diagnostics-referrals','diagnostics-laboratories','diagnostics-results'], mustNotContain:[/Super Admin/i], entry:/\/ai|\/crm|\/diagnostics/ },
] as const;


const RESPONSIVE_ROUTES_BY_ROLE: Record<string, string[]> = {
  owner: ['/ai','/crm/schedule','/crm/patients','/crm/dental-chart','/crm/treatment-plans','/crm/cashier','/crm/finance','/diagnostics/referrals','/shop','/school'],
  admin: ['/crm/schedule','/crm/patients','/crm/dental-chart','/crm/treatment-plans','/crm/cashier','/diagnostics/referrals','/shop','/school'],
  doctor: ['/crm/schedule','/crm/patients','/crm/visits','/crm/dental-chart','/crm/treatment-plans','/diagnostics/referrals'],
  assistant: ['/crm/schedule','/crm/patients','/crm/visits','/crm/documents','/crm/reminders','/diagnostics/referrals'],
  manager: ['/crm/schedule','/crm/patients','/analytics','/crm/inventory','/crm/staff','/shop'],
  regular: ['/school','/profile'],
  patient: ['/patient-portal','/profile','/shop','/school'],
  'diagnostic-owner': ['/diagnostics/center','/diagnostics/referrals','/diagnostics/results','/diagnostics/calendar','/diagnostics/statistics'],
  'diagnostic-operator': ['/diagnostics/center','/diagnostics/referrals','/diagnostics/results'],
  'medical-lab-owner': ['/diagnostics/lab?workspace=medical-lab','/diagnostics/laboratories','/diagnostics/results','/diagnostics/calendar'],
  'medical-lab-tech': ['/diagnostics/lab?workspace=medical-lab','/diagnostics/laboratories','/diagnostics/results'],
  'dental-lab-owner': ['/diagnostics/lab','/diagnostics/laboratories','/diagnostics/results'],
  'dental-technician': ['/diagnostics/lab','/diagnostics/laboratories','/diagnostics/results'],
  superadmin: ['/admin','/quality','/platform-finance','/diagnostics','/ai-governance'],
  support: ['/help','/analytics','/settings','/profile'],
  laboratory: ['/crm/lab','/shop','/diagnostics/referrals','/diagnostics/laboratories','/diagnostics/results'],
};

function pageId(route: string, role?: Role): string | null {
  const p = new URL(route, BASE_URL).pathname.replace(/\/$/,'') || '/';
  // Partner labs use their canonical IAM page key, distinct from the clinic labs route.
  if (p === '/diagnostics/laboratories' && role?.pages.includes('diagnostics-laboratories') && !role.pages.includes('diagnostics-labs')) return 'diagnostics-laboratories';
  const map: Record<string,string> = {
    '/ai':'ai','/crm/schedule':'schedule','/crm/patients':'patients','/crm/medical-card':'medical-card','/crm/finance':'finance','/crm/cashier':'cashier',
    '/crm/clinic-settings':'clinic-settings','/crm/billing':'billing','/crm/patient-inbox':'patient-inbox','/crm/visits':'visits','/crm/dental-chart':'dental-chart','/crm/treatment-plans':'treatment-plans',
    '/crm/pricelist':'pricelist','/crm/lab':'lab','/crm/inventory':'inventory','/crm/stock-rules':'inventory','/crm/documents':'documents','/crm/staff':'staff','/crm/reminders':'reminders','/crm/promotions':'promotions','/crm/marketing':'promotions','/crm/icd10':'icd10','/crm/workflow':'workflow','/crm/integrations/messaging':'clinic-settings',
    '/analytics':'analytics','/admin':'admin','/audit':'audit','/agent-activity':'agent-activity','/ai-approvals':'ai-approvals','/backup':'backup','/shop':'shop','/school':'school','/settings':'settings','/bi':'bi','/security':'security','/quality':'quality','/platform-finance':'platform-finance','/ai-governance':'ai-governance','/support':'support','/diagnostics':'diagnostics','/supplier':'supplier',
    '/diagnostics/referrals':'diagnostics-referrals','/diagnostics/referrals/new':'diagnostics-referral-create','/diagnostics/patients':'diagnostics-referrals','/diagnostics/centers':'diagnostics-centers','/diagnostics/labs':'diagnostics-labs','/diagnostics/laboratories':'diagnostics-labs','/diagnostics/results':'diagnostics-results','/diagnostics/calendar':'diagnostics-calendar','/diagnostics/statistics':'diagnostics-statistics','/diagnostics/settings':'diagnostics-settings',
    '/diagnostics/center':'diagnostics','/diagnostics/lab':'diagnostics','/community':'community','/patient-portal':'patient-portal','/diagnostics/workspace':'diagnostics','/diagnostics/center-dashboard':'diagnostics','/diagnostics/lab-dashboard':'diagnostics','/diagnostics/registrations':'admin','/diagnostics/registration-requests':'admin',
  };
  if (map[p]) return map[p];
  if (p.startsWith('/shop')) return 'shop';
  if (p.startsWith('/school')) return 'school';
  if (p.startsWith('/crm/')) return p.slice('/crm/'.length).split('/')[0] || null;
  if (p.startsWith('/diagnostics/results')) return 'diagnostics-results';
  if (p.startsWith('/diagnostics/referrals')) return 'diagnostics-referrals';
  if (p.startsWith('/diagnostics/centers')) return 'diagnostics-centers';
  if (p.startsWith('/diagnostics/labs') || p.startsWith('/diagnostics/laboratories')) return 'diagnostics-labs';
  if (p.startsWith('/diagnostics/calendar')) return 'diagnostics-calendar';
  if (p.startsWith('/diagnostics/statistics')) return 'diagnostics-statistics';
  if (p.startsWith('/diagnostics/settings')) return 'diagnostics-settings';
  if (p === '/profile' || p.startsWith('/profile/')) return 'profile';
  if (p.startsWith('/settings')) return 'settings';
  return null;
}

async function waitForRouteActivity(page: Page, roleId: string, route: string) {
  const ledger = pendingCriticalRequestsByPage.get(page);
  if (ledger) {
    const currentPending = () => [...ledger.pending.values()].filter((entry) => entry.epoch === ledger.epoch);
    try {
      await expect.poll(() => currentPending().length, {
        timeout: 20000,
        intervals: [50, 100, 250, 500, 1000],
        message: roleId + ' ' + route + ': current-document API/lazy-module requests did not settle',
      }).toBe(0);
    } catch (error) {
      const active = currentPending().map((entry) => entry.label);
      throw new Error(roleId + ' ' + route + ': pending current-document requests: ' + active.join('; ') + '. ' + String(error));
    }
  }
  // Font rendering is useful for snapshots, but an external font CDN must not
  // hold the security matrix indefinitely. App scripts and APIs still drain.
  try {
    await Promise.race([
      page.evaluate(async () => { await document.fonts.ready; }),
      page.waitForTimeout(3000),
    ]);
  } catch (error) {
    throw new Error(roleId + ' ' + route + ': document readiness failed: ' + String(error));
  }
}

async function login(page: Page, email: string) {
  // Clear persisted identity before the React auth initializer runs. Clearing
  // after goto previously allowed stale tokens to emit /auth/me 401 responses.
  await page.context().clearCookies();
  await page.addInitScript(() => {
    if (window.location.pathname === '/login') {
      localStorage.clear();
      sessionStorage.clear();
    }
  });
  const guestSessionRequests: string[] = [];
  const captureGuestSession = (request: any) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/guest/session') guestSessionRequests.push(request.method() + ' ' + url.pathname);
  };
  page.on('request', captureGuestSession);
  await page.goto(BASE_URL + '/login?role=owner', {waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('input[autocomplete="username"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button',{name:'Войти в DentVision'}).click();
  // SPA navigation can reach the correct URL without producing a fresh
  // domcontentloaded event (especially WebKit). Poll the URL instead of
  // waiting on a navigation lifecycle event that may never fire.
  await expect.poll(() => new URL(page.url()).pathname, {
    timeout: 30000,
    message: email + ': login did not reach an authenticated workspace',
  }).toMatch(/^\/(?:ai|patient-portal|diagnostics|school|admin|profile|help|analytics|settings)(?:$|\/)/i);
  await expect.poll(() => page.locator('body').innerText().catch(() => ''), {
    timeout: 10000,
    message: email + ': authenticated workspace did not render',
  }).toMatch(/.{20,}/s);
  await waitForRouteActivity(page, email, 'post-login');
  page.off('request', captureGuestSession);
  expect(guestSessionRequests, email + ': guest session must not race authenticated login').toEqual([]);
}

async function activatePartnerWorkspace(page: Page, role: Role) {
  const expectedScope = role.family === 'diagnostic'
    ? 'DIAGNOSTIC_CENTER'
    : role.family === 'medical-lab' || role.family === 'dental-lab'
      ? 'LABORATORY'
      : null;
  if (!expectedScope) return;

  // Partner-only test users have a base STUDENT account and a separate scoped
  // organization role. Merely displaying the first available workspace is not
  // authorization: activate it through the real switcher so the API issues a
  // context-bound token before auditing role access.
  const trigger = page.getByTestId('workspace-switcher-trigger');
  await expect(trigger, role.id + ': workspace switcher missing').toBeVisible({ timeout: 15000 });
  await trigger.click();
  const menu = page.getByTestId('workspace-switcher-menu');
  await expect(menu).toBeVisible({ timeout: 10000 });
  const option = menu.getByRole('button').filter({ hasText: role.label });
  await expect(option, role.id + ': scoped organization role not offered in workspace menu').toHaveCount(1);
  await option.click();
  await expect(menu).toBeHidden({ timeout: 15000 });

  await expect.poll(() => page.evaluate(() => {
    try {
      const stored = sessionStorage.getItem('dv_tokens');
      const access = stored ? JSON.parse(stored)?.access : null;
      const payload = access?.split('.')[1];
      if (!payload) return { role: null, organizationType: null };
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
      const claims = JSON.parse(atob(normalized));
      return { role: claims.role || null, organizationType: claims.organizationType || null };
    } catch {
      return { role: null, organizationType: null };
    }
  }), {
    timeout: 15000,
    message: role.id + ': workspace switch did not persist a scoped token',
  }).toMatchObject({ organizationType: expectedScope });

  await expect.poll(() => page.locator('body').innerText().catch(() => ''), {
    timeout: 15000,
    message: role.id + ': scoped workspace did not render',
  }).toContain(role.label);
  await waitForRouteActivity(page, role.id, 'partner-context');
}

async function acceptPatientPortalConsents(page: Page) {
  const consentHeading = page.getByRole('heading', { name: 'Прежде чем продолжить' });
  if (await consentHeading.count() === 0) return;

  // This is a synthetic E2E patient account. Exercise the real consent UI and
  // API; never bypass the legal/clinical consent gate in application code.
  const acceptButtons = page.getByRole('button', { name: 'Принимаю', exact: true });
  for (let accepted = 0; accepted < 8; accepted += 1) {
    const before = await acceptButtons.count();
    if (before === 0) break;
    await acceptButtons.first().click();
    await expect(acceptButtons, 'patient consent acceptance did not persist').toHaveCount(before - 1, { timeout: 15000 });
  }
  await expect(consentHeading, 'patient portal must leave the consent gate only after all mandatory agreements are accepted').toHaveCount(0, { timeout: 15000 });
}

function collectors(page: Page) {
  const problems = {
    console: [] as string[],
    page: [] as string[],
    requests: [] as string[],
    navigationCancellations: [] as string[],
    http: [] as string[],
    server: [] as string[],
  };
  const uiOrigin = new URL(BASE_URL).origin;
  const ledger: RequestLedger = {
    epoch: 0,
    sequence: 0,
    pending: new Map(),
    requestIds: new WeakMap(),
    requestEpochs: new WeakMap(),
    byIdentity: new Map(),
  };
  pendingCriticalRequestsByPage.set(page, ledger);
  const identity = (request: any) => request.method() + ' ' + request.url();

  const finishPending = (request: any) => {
    const key = identity(request);
    let id: number | undefined;
    let requestEpoch: number | undefined;
    try {
      id = ledger.requestIds.get(request);
      requestEpoch = ledger.requestEpochs.get(request);
    } catch { /* request wrapper unavailable */ }
    // A previous-document completion must never decrement a same-URL request
    // started by the current document.
    if (id === undefined && requestEpoch !== undefined && requestEpoch < ledger.epoch) return;
    if (id === undefined) id = ledger.byIdentity.get(key)?.find(candidate => ledger.pending.has(candidate));
    if (id === undefined) return;

    ledger.pending.delete(id);
    const queue = ledger.byIdentity.get(key);
    if (queue) {
      const index = queue.indexOf(id);
      if (index >= 0) queue.splice(index, 1);
      if (queue.length === 0) ledger.byIdentity.delete(key);
    }
  };

  page.on('request', request => {
    let mainDocumentNavigation = false;
    try {
      const requestFrame = request.frame();
      // Compare frame hierarchy rather than wrapper object identity. Playwright
      // may expose different Frame wrappers for the request and Page accessors;
      // the top-level document is reliably identified by having no parent frame.
      mainDocumentNavigation = request.isNavigationRequest()
        && request.resourceType() === 'document'
        && requestFrame.parentFrame() === null;
    } catch { /* detached-frame and service-worker requests are not main navigation */ }

    if (mainDocumentNavigation) {
      ledger.epoch += 1;
      const staleIds = new Set<number>();
      for (const [id, entry] of ledger.pending) {
        if (entry.epoch < ledger.epoch) {
          ledger.pending.delete(id);
          staleIds.add(id);
        }
      }
      for (const [key, queue] of ledger.byIdentity) {
        const remaining = queue.filter(id => !staleIds.has(id));
        if (remaining.length) ledger.byIdentity.set(key, remaining);
        else ledger.byIdentity.delete(key);
      }
    }

    try { ledger.requestEpochs.set(request, ledger.epoch); } catch { /* request wrapper unavailable */ }

    try {
      const url = new URL(request.url());
      const accept = String(request.headers()?.accept || '').toLowerCase();
      if (request.resourceType() === 'eventsource'
        || accept.includes('text/event-stream')
        || url.pathname === '/api/ai/query/stream') return;

      const finiteApi = url.pathname.startsWith('/api/');
      const lazyModule = request.resourceType() === 'script' && url.origin === uiOrigin;
      if (!finiteApi && !lazyModule) return;

      const id = ++ledger.sequence;
      const key = identity(request);
      ledger.pending.set(id, {
        epoch: ledger.epoch,
        label: request.method() + ' ' + url.origin + url.pathname,
      });
      ledger.requestIds.set(request, id);
      const queue = ledger.byIdentity.get(key) || [];
      queue.push(id);
      ledger.byIdentity.set(key, queue);
    } catch { /* non-URL browser requests are outside this gate */ }
  });

  page.on('requestfinished', finishPending);
  page.on('console', m => { if (m.type() === 'error') problems.console.push(m.text()); });
  page.on('pageerror', e => problems.page.push(e.message));
  page.on('requestfailed', request => {
    finishPending(request);
    const errorText = request.failure()?.errorText || 'failed';
    let requestEpoch: number | undefined;
    try { requestEpoch = ledger.requestEpochs.get(request); } catch { /* request wrapper unavailable */ }
    const expectedNavigationAbort = requestEpoch !== undefined
      && requestEpoch < ledger.epoch
      && /ERR_ABORTED|Load request cancelled/i.test(errorText);

    if (expectedNavigationAbort) {
      problems.navigationCancellations.push(request.method() + ' ' + request.url() + ' :: ' + errorText);
      return;
    }
    problems.requests.push(request.method() + ' ' + request.url() + ' :: ' + errorText);
  });
  page.on('response', response => {
    const status = response.status();
    if (status >= 400) {
      try {
        const url = new URL(response.url());
        if (url.pathname.startsWith('/api/')) {
          problems.http.push(status + ' ' + response.request().method() + ' ' + url.pathname);
        }
      } catch { /* non-URL browser responses are outside this gate */ }
    }
    if (status >= 500) problems.server.push(status + ' ' + response.request().method() + ' ' + response.url());
  });
  return problems;
}

async function shellAudit(page: Page, role: Role, route: string) {
  const result=await page.evaluate(()=>{
    const visible=(el:Element)=>{const h=el as HTMLElement,r=h.getBoundingClientRect(),s=getComputedStyle(h);return r.width>0&&r.height>0&&r.right>0&&r.left<innerWidth&&s.display!=='none'&&s.visibility!=='hidden'};
    const accessibleName=(el:Element)=>{
      const h=el as HTMLElement;
      const labelledBy=(h.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean).map(id=>document.getElementById(id)?.textContent||'').join(' ');
      const labels='labels' in h?Array.from((h as HTMLInputElement).labels||[]).map(label=>label.textContent||'').join(' '):'';
      return (h.getAttribute('aria-label')||labelledBy||labels||h.getAttribute('title')||h.getAttribute('placeholder')||h.innerText||'').replace(/\s+/g,' ').trim();
    };
    const controls=Array.from(document.querySelectorAll('button,a,input,select,textarea,[role="button"],[role="tab"],[role="menuitem"]')).filter(visible).map(el=>{
      const h=el as HTMLElement,r=h.getBoundingClientRect(),input=h as HTMLInputElement;
      const labelRects=input instanceof HTMLInputElement&&['checkbox','radio'].includes(input.type)?Array.from(input.labels||[]).map(label=>label.getBoundingClientRect()):[];
      const target=labelRects.find(rect=>rect.width>=36&&rect.height>=36)||r;
      return{name:accessibleName(el),w:target.width,h:target.height,disabled:(h as HTMLButtonElement).disabled};
    });
    const clipped=Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,button,a,[role="button"],[role="tab"]')).filter(visible).map(el=>{const h=el as HTMLElement;return{name:(h.innerText||'').trim(),sw:h.scrollWidth,cw:h.clientWidth}}).filter(x=>x.name&&x.sw>x.cw+2);
    const shellText=Array.from(document.querySelectorAll('header,aside,nav,[role="banner"],[role="navigation"],[role="complementary"],[data-testid="workspace-switcher-trigger"],[data-testid="workspace-switcher-menu"]')).filter(visible).map(el=>((el as HTMLElement).innerText||el.textContent||'').replace(/\\s+/g,' ').trim()).filter(Boolean).join(' ');
    return{text:document.body.innerText,shellText,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,bodyWidth:document.body.scrollWidth,controls,clipped,headings:Array.from(document.querySelectorAll('h1,h2')).filter(visible).map(x=>(x.textContent||'').trim()).filter(Boolean)};
  });
  expect(/Application error|ChunkLoadError|Failed to fetch dynamically imported module|Something went wrong/i.test(result.text),role.id+' '+route+': application error').toBeFalsy();
  expect(result.scrollWidth,role.id+' '+route+': document overflow').toBeLessThanOrEqual(result.clientWidth+2);
  expect(result.bodyWidth,role.id+' '+route+': body overflow').toBeLessThanOrEqual(result.clientWidth+2);
  expect(result.clipped,role.id+' '+route+': clipped text').toEqual([]);
  expect(result.controls.filter(x=>x.w<36||x.h<36),role.id+' '+route+': undersized controls '+JSON.stringify(result.controls.filter(x=>x.w<36||x.h<36))).toEqual([]);
  expect(result.controls.filter(x=>!x.name),role.id+' '+route+': unnamed controls').toEqual([]);
  for(const forbidden of role.mustNotContain) expect(result.shellText,role.id+' '+route+': forbidden role/workspace context visible').not.toMatch(forbidden);
}

async function inspectVisualSemantics(page: Page, role: Role, route: string) {
  const result = await page.evaluate(() => {
    const visible = (el: Element) => {
      const h = el as HTMLElement, r = h.getBoundingClientRect(), s = getComputedStyle(h);
      return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
    };
    const text = (el: Element) => (el.textContent || '').replace(/\\s+/g, ' ').trim();
    const accessibleName = (el: Element) => {
      const h = el as HTMLElement;
      const labelledBy = (h.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean).map(id => document.getElementById(id)?.textContent || '').join(' ');
      const labels = 'labels' in h ? Array.from((h as HTMLInputElement).labels || []).map(label => label.textContent || '').join(' ') : '';
      return (h.getAttribute('aria-label') || labelledBy || labels || h.getAttribute('title') || h.getAttribute('placeholder') || text(el)).trim();
    };
    const interactive = Array.from(document.querySelectorAll('button,a,[role="button"],[role="tab"],[role="menuitem"],input,select,textarea')).filter(visible);
    const headings = Array.from(document.querySelectorAll('h1,h2,h3')).filter(visible).map(text).filter(Boolean);
    const iconOnly = interactive.filter(el => !text(el) && !accessibleName(el));
    const suspicious = Array.from(document.querySelectorAll('[class*="truncate"],[class*="line-clamp"],[class*="ellipsis"]')).filter(visible)
      .map(el => ({text:text(el), rect:(el as HTMLElement).getBoundingClientRect().toJSON()}))
      .filter(x => x.text.length > 0);
    const duplicateLabels = Array.from(document.querySelectorAll('button,a,[role="button"],label')).filter(visible).map(text).filter(Boolean);
    const duplicates = duplicateLabels.filter((v,i,a)=>a.indexOf(v)!==i).slice(0,20);
    return {
      headings,
      iconOnly: iconOnly.length,
      suspicious,
      viewport: {w:innerWidth,h:innerHeight},
      visibleTextLength: text(document.body).length,
      fixedOverlays: Array.from(document.querySelectorAll('[class*="fixed"],[class*="sticky"]')).filter(visible).length,
      duplicates,
      semanticRegions: Array.from(document.querySelectorAll('main,nav,section,[role="main"],[role="navigation"],[role="region"],[role="heading"]')).filter(visible).length
    };
  });
  expect(result.visibleTextLength, role.id + ' ' + route + ': screen is effectively empty').toBeGreaterThan(20);
  expect(result.iconOnly, role.id + ' ' + route + ': unexplained icon-only controls').toBe(0);
  const hasSemanticHierarchy = result.headings.length > 0 || result.semanticRegions > 0;
  expect(hasSemanticHierarchy, role.id + ' ' + route + ': no visible semantic information hierarchy').toBeTruthy();
}

async function inspectDialogsAndMenus(page: Page, role: Role, route: string) {
  const dialogCount = await page.locator('[role="dialog"]:visible, [aria-modal="true"]:visible').count();
  const menuCount = await page.locator('[role="menu"]:visible, [role="listbox"]:visible').count();
  const issues = await page.evaluate(() => {
    const visible = (el: Element) => {
      const h = el as HTMLElement, r = h.getBoundingClientRect(), s = getComputedStyle(h);
      return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
    };
    const isNamed = (el: Element) => {
      const h = el as HTMLElement;
      const labelledBy = (h.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean).map(id => document.getElementById(id)?.textContent || '').join(' ');
      const labels = 'labels' in h ? Array.from((h as HTMLInputElement).labels || []).map(label => label.textContent || '').join(' ') : '';
      return Boolean((h.getAttribute('aria-label') || labelledBy || labels || h.getAttribute('title') || h.getAttribute('placeholder') || h.innerText || '').trim());
    };
    const overlays = Array.from(document.querySelectorAll('[role="dialog"],[aria-modal="true"],[role="menu"],[role="listbox"]')).filter(visible);
    return overlays.map(el => {
      const h = el as HTMLElement, r = h.getBoundingClientRect();
      const text = (h.innerText || '').trim();
      const close = h.querySelector('button[aria-label*="закры" i],button[aria-label*="close" i],button[title*="закры" i],button[title*="close" i]');
      const interactive = Array.from(h.querySelectorAll('button,a,input,select,textarea,[role="button"],[role="option"],[role="menuitem"]')).filter(visible);
      return {
        role: h.getAttribute('role'),
        width: r.width, height: r.height, text,
        hasHeading: !!h.querySelector('h1,h2,h3,h4,h5,h6,[role="heading"]'),
        hasClose: !!close,
        interactive: interactive.length,
        unnamed: interactive.filter(x => !isNamed(x)).length,
        overflow: h.scrollWidth > h.clientWidth + 2 || h.scrollHeight > h.clientHeight + 2
      };
    });
  });
  for (const overlay of issues) {
    expect(overlay.text, role.id + ' ' + route + ': empty overlay').not.toBe('');
    expect(overlay.hasHeading || overlay.role === 'listbox' || overlay.role === 'menu', role.id + ' ' + route + ': modal/menu has no semantic heading').toBeTruthy();
    expect(overlay.unnamed, role.id + ' ' + route + ': unnamed overlay controls').toBe(0);
    expect(overlay.overflow, role.id + ' ' + route + ': modal/menu overflow').toBeFalsy();
    if (overlay.role === 'dialog') expect(overlay.hasClose, role.id + ' ' + route + ': dialog has no close control').toBeTruthy();
  }
  // Verify Escape closes an actually open overlay without navigating away.
  if (dialogCount || menuCount) {
    const before = page.url();
    await page.keyboard.press('Escape');
    await expect(
      page.locator('[role="dialog"]:visible,[aria-modal="true"]:visible,[role="menu"]:visible,[role="listbox"]:visible'),
      role.id + ' ' + route + ': Escape did not close overlay',
    ).toHaveCount(0, { timeout: 5000 });
    expect(page.url(), role.id + ' ' + route + ': Escape unexpectedly navigated').toBe(before);
  }
}

async function inspectForms(page: Page, role: Role, route: string) {
  const issues=await page.locator('form:visible').evaluateAll(forms=>forms.flatMap(form=>Array.from(form.querySelectorAll('input,select,textarea')).map(el=>{
    const h=el as HTMLInputElement;
    const explicitLabel=h.id?document.querySelector('label[for="'+h.id+'"]')?.textContent||'':'';
    const associatedLabels='labels' in h?Array.from(h.labels||[]).map(label=>label.textContent||'').join(' '):'';
    const label=(explicitLabel||associatedLabels).trim();
    return {type:h.type,name:h.name,aria:h.getAttribute('aria-label'),placeholder:h.getAttribute('placeholder'),required:h.required,label};
  })).filter(x=>!x.name&&!x.aria&&!x.placeholder&&!x.label&&x.type!=='hidden'));
  expect(issues,role.id+' '+route+': form controls without identification').toEqual([]);
}

async function discoverRoutes(page: Page): Promise<string[]> {
  // Read immediately on stable screens. A fixed pre-read wait on every route
  // multiplied the exhaustive role matrix even when the first read worked.
  // Delay only after an SPA transition invalidates the current execution context.
  for (const delay of [0, 100, 250, 500]) {
    if (delay > 0) await page.waitForTimeout(delay);
    try {
      const hrefs = await page.locator('a[href]').evaluateAll(as =>
        as.map(a => (a as HTMLAnchorElement).href).filter(h => h.startsWith(location.origin)),
      );
      return [...new Set(hrefs.map(h => {
        const u = new URL(h);
        return u.pathname + u.search;
      }))].filter(r => !/\/sign\/|\/plan\/|\/book\//.test(r));
    } catch (error) {
      if (!/Execution context was destroyed|Target page, context or browser has been closed/i.test(String(error))) throw error;
    }
  }
  return [];
}

async function waitForRouteReady(page: Page, role: Role, route: string) {
  try {
    // Wait for meaningful rendered content and for the full-screen auth/loading
    // skeleton to disappear. A fixed 300ms sleep per route cost several minutes
    // across the exhaustive role matrix without proving that the route was ready.
    await page.waitForFunction(() => {
      const root = document.getElementById('root');
      if (!root) return false;
      const text = (root.innerText || '').trim();
      if (text.length < 20) return false;
      const hasFullscreenSpinner = Array.from(root.children).some((child) => {
        const element = child as HTMLElement;
        const rect = element.getBoundingClientRect();
        const spinner = element.querySelector('.animate-spin');
        return Boolean(spinner)
          && rect.width >= window.innerWidth * 0.85
          && rect.height >= window.innerHeight * 0.75
          && element.innerText.trim().length < 20;
      });
      return !hasFullscreenSpinner;
    }, undefined, { timeout: 10000 });
  } catch (error) {
    throw new Error(role.id + ' ' + route + ': page did not reach stable rendered content: ' + String(error));
  }
}

async function auditRoute(page: Page, role: Role, route: string, shouldBeAllowed: boolean) {
  const expectedPath = new URL(BASE_URL + route).pathname;
  const routeUrl = new URL(route, BASE_URL);
  const restrictedPatientDeepLink = shouldBeAllowed
    && routeUrl.pathname === '/crm/patients'
    && routeUrl.searchParams.has('patient')
    && !role.pages.includes('medical-card');
  const restrictedPatientReads: string[] = [];
  const captureRestrictedPatientRead = (request: any) => {
    const segments = new URL(request.url()).pathname.split('/').filter(Boolean);
    const patientDetail = segments[0] === 'api' && segments[1] === 'patients'
      && segments.length === 3 && segments[2] !== 'lookup';
    const patientSubresource = segments[0] === 'api' && segments[1] === 'patients'
      && segments.length === 4 && ['summary', 'history', 'images', 'treatment-plan', 'audit'].includes(segments[3]);
    const medicalSubresource = segments[0] === 'api' && segments[1] === 'medical'
      && ['cards', 'images'].includes(segments[2]) && segments.length === 4;
    if (patientDetail || patientSubresource || medicalSubresource) {
      restrictedPatientReads.push(request.method() + ' /' + segments.join('/'));
    }
  };
  if (restrictedPatientDeepLink) page.on('request', captureRestrictedPatientRead);
  await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
  let current = new URL(page.url());

  if (!shouldBeAllowed) {
    // Do not guess at auth-hydration timing. Wait until the protected path actually
    // changes; a route that remains open fails with a bounded, explicit diagnostic.
    await expect.poll(() => new URL(page.url()).pathname, {
      timeout: 5000,
      intervals: [50, 100, 250, 500],
      message: role.id + ' ' + route + ': forbidden route did not redirect away from protected path',
    }).not.toBe(expectedPath);
    current = new URL(page.url());
    expect(current.pathname, role.id + ' ' + route + ': forbidden route stayed open').not.toBe(expectedPath);
    // No protected page rendered. Do not drain background requests from the
    // old shell after a successful authorization redirect.
    return;
  }

  // Only inspect DOM after access policy has confirmed the route is allowed.
  await waitForRouteReady(page, role, route);
  // Finance is a lazy-loaded route alias into the Admin shell; wait for its
  // redirect/chunks to settle before the next full-document navigation.
  if (role.id === 'superadmin' && route === '/platform-finance') {
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  }
  current = new URL(page.url());

  if (current.pathname === '/login') {
    await login(page, role.email);
    await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForRouteReady(page, role, route);
    current = new URL(page.url());
  }
  await waitForRouteActivity(page, role.id, route);

  // DOM content, route policy and visual semantics are asserted live in-browser. Do not
  // persist full HTML/text for every passing route: this checkpoint uploads role evidence
  // even on success, and duplicate snapshots add volume without increasing test coverage.
  // Failed retries retain the browser DOM in Playwright traces, which are uploaded on failure.
  expect(current.pathname, role.id + ' ' + route + ': allowed route redirected unexpectedly').not.toBe('/login');
  await shellAudit(page, role, route);
  await inspectForms(page, role, route);
  await inspectDialogsAndMenus(page, role, route);
  await inspectVisualSemantics(page, role, route);
  if (restrictedPatientDeepLink) {
    page.off('request', captureRestrictedPatientRead);
    expect(restrictedPatientReads, role.id + ' must not fetch clinical/financial data from a patient-list deep link').toEqual([]);
  }
}

test('partner context switch applies the scoped application role to the session token', async ({ page }, info) => {
  test.skip(info.project.name !== 'role-1280', 'IAM token/context contract is viewport-independent; execute once per CI run');
  const cases = [
    { email: 'diagnostic-operator@test.com', roleKey: 'diagnostic_operator', expectedRole: 'ASSISTANT' },
    { email: 'medical-lab-tech@test.com', roleKey: 'medical_lab_technician', expectedRole: 'LAB' },
    { email: 'dental-technician@test.com', roleKey: 'dental_technician', expectedRole: 'LAB' },
  ] as const;

  for (const item of cases) {
    await login(page, item.email);
    const contextsResponse = await page.evaluate(async (apiBase) => {
      const stored = sessionStorage.getItem('dv_tokens');
      const token = stored ? JSON.parse(stored)?.access : null;
      const response = await fetch(apiBase + '/api/iam/me/contexts', {
        credentials: 'include',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      return { status: response.status, body: await response.json().catch(() => ({})) };
    }, API_BASE_URL);
    expect(contextsResponse.status, item.email + ': contexts endpoint failed').toBe(200);

    let target: { scopeType?: string; scopeId?: string; roleKey?: string } | undefined;
    await expect.poll(async () => {
      const response = await page.evaluate(async (apiBase) => {
        const stored = sessionStorage.getItem('dv_tokens');
        const token = stored ? JSON.parse(stored)?.access : null;
        const current = await fetch(apiBase + '/api/iam/me/contexts', {
          credentials: 'include',
          headers: token ? { Authorization: 'Bearer ' + token } : {},
        });
        return { status: current.status, body: await current.json().catch(() => ({})) };
      }, API_BASE_URL);
      if (response.status !== 200) return false;
      const contexts = response.body?.data?.contexts || [];
      target = contexts.find((context: { roleKey?: string }) =>
        String(context.roleKey || '').toLowerCase().split(',').includes(item.roleKey),
      );
      return Boolean(target);
    }, {
      timeout: 5000,
      intervals: [100, 250, 500, 1000],
      message: item.email + ': scoped partner context was not exposed by /api/iam/me/contexts',
    }).toBeTruthy();

    const switchResponse = await page.evaluate(async ({ apiBase, context }) => {
      const stored = sessionStorage.getItem('dv_tokens');
      const token = stored ? JSON.parse(stored)?.access : null;
      const response = await fetch(apiBase + '/api/iam/switch-context', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: JSON.stringify({ scopeType: context.scopeType, scopeId: context.scopeId }),
      });
      return { status: response.status, body: await response.json().catch(() => ({})) };
    }, { apiBase: API_BASE_URL, context: target });

    expect(switchResponse.status, item.email + ': context switch failed').toBe(200);
    const accessToken = switchResponse.body?.data?.accessToken;
    expect(accessToken, item.email + ': switch response has no access token').toEqual(expect.any(String));

    const payload = JSON.parse(Buffer.from(String(accessToken).split('.')[1], 'base64url').toString('utf8')) as { role?: string };
    expect(payload.role, item.email + ': switched token kept the wrong global role').toBe(item.expectedRole);
  }
});

test.describe('DentVision exhaustive role/context/browser gate',()=>{
  test.describe.configure({mode:'default',timeout:120000});

  test.afterEach(async ({ page }, info) => {
    if (!info.title.includes('every declared and discovered screen plus security boundary')) return;
    const roleId = info.title.split(':')[0];
    const dir = `${VISUAL_EVIDENCE_ROOT}/roles/${roleId}`;
    const screenshotPath = `${dir}/${info.project.name}.png`;
    const runtimePath = `${dir}/${info.project.name}-runtime.json`;
    await fs.mkdir(dir, { recursive: true });
    if (info.status !== 'passed') {
      // Replace earlier retry evidence: never leave a stale passing/failed screenshot behind.
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      await fs.writeFile(runtimePath, JSON.stringify({ testStatus: info.status, testError: info.error?.message || null }, null, 2), 'utf8');
      return;
    }
    try { await fs.access(screenshotPath); } catch { await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {}); }
    try { await fs.access(runtimePath); } catch { await fs.writeFile(runtimePath, JSON.stringify({ testStatus: info.status, testError: info.error?.message || null }, null, 2), 'utf8'); }
  });

  for(const role of ROLES){
    test(role.id+': every declared and discovered screen plus security boundary',async({page},info)=>{
      const problems=collectors(page);
      await login(page,role.email);
      await activatePartnerWorkspace(page, role);
      if (role.id === 'patient') await acceptPatientPortalConsents(page);
      await expect.poll(() => page.locator('body').innerText().catch(() => ''), {
        timeout: 10000,
        message: role.id + ': authenticated entry screen did not render',
      }).toMatch(/.{20,}/s);
      expect(new URL(page.url()).pathname, role.id + ': entry route unexpectedly returned to login').not.toBe('/login');
      expect(role.entry.test(page.url()),role.id+': incorrect post-login workspace '+page.url()).toBeTruthy();
      // Workspace context is fetched asynchronously. Wait for the visible role identity
      // rather than snapshotting the header before WorkspaceSwitcher has hydrated.
      await expect.poll(() => page.evaluate(() => {
        const switcher = document.querySelector('[data-testid="workspace-switcher-trigger"]');
        const fallback = document.querySelector('[data-testid="workspace-role-indicator"]');
        return (document.body?.innerText || '') + ' '
          + (switcher?.getAttribute('aria-label') || '')
          + ' ' + (fallback?.textContent || '');
      }), {
        timeout: 12000,
        intervals: [100, 250, 500, 1000],
        message: role.id + ': role identity was not rendered after workspace context resolution',
      }).toContain(role.label);
      const identitySurface = await page.evaluate(() => {
        const body = document.body?.innerText || '';
        const accessible = Array.from(document.querySelectorAll('[title],[aria-label]'))
          .filter(el => {
            const h = el as HTMLElement;
            const r = h.getBoundingClientRect();
            const s = getComputedStyle(h);
            return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
          })
          .map(el => el.getAttribute('title') || el.getAttribute('aria-label') || '')
          .join(' ');
        return body + ' ' + accessible;
      });
      expect(identitySurface,role.id+': role identity is missing on workspace entry').toContain(role.label);

      if (info.project.name !== 'role-1280') {
        // Authorization over every declared/discovered route runs once at role-1280.
        // Other projects retain role-specific responsive audits over critical journeys
        // and still emit the per-role/per-viewport PNG required by the release manifest.
        for (const route of RESPONSIVE_ROUTES_BY_ROLE[role.id] || []) {
          const routePageId = pageId(route, role);
          const explicitlyPublicPortal = role.id === 'patient' && new URL(route, BASE_URL).pathname === '/patient-portal';
          if (!routePageId && !explicitlyPublicPortal) continue;
          if (routePageId && !role.pages.includes(routePageId)) continue;

          await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await expect.poll(() => page.locator('body').innerText().catch(() => ''), {
            timeout: 10000,
            message: role.id + ' ' + route + ': responsive critical screen did not render',
          }).toMatch(/.{20,}/s);
          // Await the exact API and web-font requests started by this route.
          // A timeout is a hard failure with the still-pending request paths.
          await waitForRouteActivity(page, role.id, route);
          expect(new URL(page.url()).pathname, role.id + ' ' + route + ': responsive allowed screen redirected to login').not.toBe('/login');
          await shellAudit(page, role, route);
          await inspectForms(page, role, route);
          await inspectDialogsAndMenus(page, role, route);
          await inspectVisualSemantics(page, role, route);

          // Shared route-level DOM/text snapshots are written by the exhaustive role-1280 matrix.
          // Viewport projects retain their independent screenshot and runtime evidence.
        }

        await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await waitForRouteActivity(page, role.id, '/');
        const storage = await page.evaluate(() => ({ localStorage: Object.keys(localStorage), sessionStorage: Object.keys(sessionStorage) }));
        expect(JSON.stringify(storage)).not.toMatch(/password/i);
        const token = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => /token|auth/i.test(k)).map(([,v]) => String(v)).join(' '));
        expect(token).not.toMatch(/Test1234!/i);
        expect(problems.console, role.id + ': console errors in responsive journeys\nHTTP responses: ' + problems.http.slice(-20).join('\n')).toEqual([]);
        expect(problems.page, role.id + ': page errors in responsive journeys').toEqual([]);
        expect(problems.requests, role.id + ': failed requests in responsive journeys').toEqual([]);
        expect(problems.server, role.id + ': HTTP 5xx in responsive journeys').toEqual([]);
        await page.screenshot({ path: `${VISUAL_EVIDENCE_ROOT}/roles/${role.id}/${info.project.name}.png`, fullPage: true });
        await fs.writeFile(`${VISUAL_EVIDENCE_ROOT}/roles/${role.id}/${info.project.name}-runtime.json`, JSON.stringify({ console: problems.console, page: problems.page, requests: problems.requests, navigationCancellations: problems.navigationCancellations, http: problems.http, server: problems.server }, null, 2), 'utf8');
        return;
      }

      const discovered=new Set<string>();
      for(const route of ROUTES){
        const routePage = pageId(route, role);
        const allowed=PUBLIC_ROUTES.includes(route)||AUTH_COMMON_ROUTES.includes(route)||!!routePage&&role.pages.includes(routePage);
        await auditRoute(page,role,route,allowed);
        if(allowed) for(const discoveredRoute of await discoverRoutes(page)) discovered.add(discoveredRoute);
      }
      for(const route of [...discovered].filter(r=>!ROUTES.includes(r as any))){
        const routePage = pageId(route, role);
        const allowed=PUBLIC_ROUTES.includes(route)||AUTH_COMMON_ROUTES.includes(route)||!!routePage&&role.pages.includes(routePage);
        await auditRoute(page,role,route,allowed);
      }

      // Full route authorization/DOM audits remain exhaustive; history integrity is viewport-independent.
      const historyRoute = '/profile';
      await page.goto(BASE_URL + historyRoute, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForRouteActivity(page, role.id, historyRoute);
      await expect.poll(() => page.locator('body').innerText().catch(() => ''), {
        timeout: 10000, message: role.id + ': profile did not render for browser-history check',
      }).toMatch(/.{20,}/s);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForRouteActivity(page, role.id, historyRoute + ' reload');
      await expect.poll(() => page.locator('body').innerText().catch(() => ''), {
        timeout: 10000, message: role.id + ': profile did not render after reload',
      }).toMatch(/.{20,}/s);
      await shellAudit(page, role, historyRoute);
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await page.goForward({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      expect(new URL(page.url()).pathname, role.id + ': browser forward did not restore target route').toBe(historyRoute);
      await waitForRouteActivity(page, role.id, historyRoute + ' history-forward');
      await shellAudit(page, role, historyRoute);

      await page.goto(BASE_URL+'/',{waitUntil:'domcontentloaded',timeout:30000});
      await waitForRouteActivity(page, role.id, '/');
      const storage=await page.evaluate(()=>({localStorage:Object.keys(localStorage),sessionStorage:Object.keys(sessionStorage)}));
      expect(JSON.stringify(storage)).not.toMatch(/password/i);
      const token=await page.evaluate(()=>Object.entries(localStorage).filter(([k])=>/token|auth/i.test(k)).map(([,v])=>String(v)).join(' '));
      expect(token).not.toMatch(/Test1234!/i);
      expect(problems.console,role.id+': console errors\nHTTP responses: '+problems.http.slice(-20).join('\n')).toEqual([]);
      expect(problems.page,role.id+': page errors').toEqual([]);
      expect(problems.requests,role.id+': failed requests').toEqual([]);
      expect(problems.server,role.id+': HTTP 5xx responses').toEqual([]);
      await page.screenshot({path:`${VISUAL_EVIDENCE_ROOT}/roles/${role.id}/${info.project.name}.png`,fullPage:true});
      await fs.writeFile(`${VISUAL_EVIDENCE_ROOT}/roles/${role.id}/${info.project.name}-runtime.json`, JSON.stringify({console:problems.console,page:problems.page,requests:problems.requests,navigationCancellations:problems.navigationCancellations,http:problems.http,server:problems.server}, null, 2), 'utf8');
    });
  }

  test('cross-tenant: Clinic A never exposes Clinic B identity',async({page},info)=>{
    test.skip(info.project.name !== 'role-1280', 'Tenant isolation is a data-scope contract; execute once per CI run');
    const problems=collectors(page);
    await login(page,'owner-a@test.com');
    // Route changes can settle before the workspace context label is hydrated.
    // Wait for the active tenant identity before starting the isolation assertions.
    await expect.poll(() => page.locator('body').innerText().catch(() => ''), {
      timeout: 10000,
      message: 'Clinic A workspace identity did not hydrate after login',
    }).toContain('E2E Clinic A');
    for(const route of ['/crm/patients','/crm/schedule','/crm/finance','/crm/inventory']){
      await page.goto(BASE_URL+route,{waitUntil:'domcontentloaded',timeout:30000});
      expect(await page.locator('body').innerText()).not.toContain('E2E Clinic B');
    }
    expect(problems.console).toEqual([]);
    expect(problems.page).toEqual([]);
    expect(problems.requests).toEqual([]);
  });

  test('anonymous can browse public Community feed', async ({ page }, info) => {
    test.skip(info.project.name !== 'role-1280', 'Public route policy is verified once per CI run');
    await page.goto(BASE_URL + '/community', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect.poll(() => page.locator('body').innerText().catch(() => ''), {
      timeout: 10000, message: 'Public Community feed did not render for a guest',
    }).toMatch(/.{20,}/s);
    expect(new URL(page.url()).pathname, 'Public Community feed unexpectedly redirected to login').toBe('/community');
  });

  test('anonymous guest AI landing keeps clinical APIs protected', async ({ page }) => {
    await page.context().clearCookies();
    const protectedResponse = await page.request.get(API_BASE_URL + '/api/patients');
    expect([401, 403], 'guest context must not access clinical patient records').toContain(protectedResponse.status());
    await page.goto(BASE_URL + '/ai', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect.poll(() => page.locator('body').innerText().catch(() => ''), { timeout: 10000 }).toMatch(/.{20,}/s);
    expect(new URL(page.url()).pathname, 'anonymous guest AI landing should remain available').toBe('/ai');
  });

  test('anonymous: every protected route redirects before protected content renders', async ({ page }, info) => {
    test.skip(
      info.project.name !== 'role-1280',
      'Anonymous authorization matrix is viewport-independent; execute once per CI run',
    );

    // Playwright starts each test at about:blank (an opaque origin), where
    // WebKit throws when localStorage/sessionStorage are accessed. Clear defensively
    // on every app navigation, then clear once on the real app origin before the matrix.
    await page.addInitScript(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // about:blank has no storage origin; the app-origin cleanup below is authoritative.
      }
    });
    await page.context().clearCookies();
    await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    for (const route of ROUTES.filter((r) => !PUBLIC_ROUTES.includes(r) && r !== '/ai')) {
      await page.context().clearCookies();
      await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // The patient portal has a deliberate public entry: unauthenticated
      // visitors can sign in/register, but must not receive patient data.
      // Verify the real hand-off rather than misclassifying it as a protected
      // route that must redirect before the visitor can choose to authenticate.
      if (route === '/patient-portal') {
        await expect.poll(() => page.locator('body').innerText().catch(() => ''), {
          timeout: 10000,
          message: 'anonymous patient portal authentication entry did not render',
        }).toMatch(/.{20,}/s);
        expect(new URL(page.url()).pathname, 'patient portal public entry unexpectedly redirected').toBe('/patient-portal');

        const loginAction = page.getByRole('button').first();
        await expect(loginAction, 'patient portal must expose a login action to anonymous visitors').toBeVisible({ timeout: 10000 });
        await loginAction.click();
        await expect.poll(() => new URL(page.url()).pathname, {
          timeout: 15000,
          message: 'patient portal login action did not reach login',
        }).toBe('/login');

        const loginLocation = new URL(page.url());
        expect(loginLocation.searchParams.get('portal')).toBe('patient');
        expect(loginLocation.searchParams.get('returnUrl')).toContain('/patient-portal');
        await expect(page.locator('input[autocomplete="username"]')).toBeVisible({ timeout: 10000 });
        continue;
      }

      // The auth store hydrates asynchronously after DOMContentLoaded. The guard
      // renders a skeleton during hydration; assert the eventual redirect rather
      // than treating that transient URL as protected-content exposure.
      await expect.poll(() => new URL(page.url()).pathname, {
        timeout: 15000,
        message: 'anonymous ' + route + ': protected route did not redirect after auth hydration',
      }).toBe('/login');
    }
  });
});
