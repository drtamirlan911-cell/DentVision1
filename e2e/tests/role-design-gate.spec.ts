import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_UI_URL || 'http://localhost:3000';
const PASSWORD = 'Test1234!';

const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password', '/booking', '/demo', '/pricing', '/terms', '/privacy'];
const AUTH_COMMON_ROUTES = ['/', '/help', '/notifications', '/profile'];
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

const CLINIC_OWNER_PAGES = ['dashboard','schedule','patients','medical-card','visits','icd10','documents','finance','cashier','pricelist','lab','reminders','promotions','inventory','staff','audit','agent-activity','ai-approvals','backup','shop','school','analytics','settings','clinic-settings','billing','treatment-plans','dental-chart','diagnostics','diagnostics-referrals','diagnostics-centers','diagnostics-labs','diagnostics-results','profile','bi','patient-inbox','workflow'];
const CLINIC_ADMIN_PAGES = ['schedule','patients','medical-card','visits','icd10','documents','finance','cashier','pricelist','lab','reminders','promotions','inventory','staff','shop','school','analytics','settings','clinic-settings','billing','treatment-plans','dental-chart','diagnostics','diagnostics-referrals','diagnostics-results','profile','patient-inbox','workflow','ai-approvals'];
const CLINIC_DOCTOR_PAGES = ['schedule','patients','medical-card','visits','icd10','documents','lab','reminders','school','treatment-plans','dental-chart','diagnostics-referrals','diagnostics-results','profile','ai-approvals'];
const CLINIC_ASSISTANT_PAGES = ['schedule','patients','visits','documents','reminders','shop','school','diagnostics-referrals','diagnostics-results','profile'];
const CLINIC_MANAGER_PAGES = ['dashboard','schedule','patients','analytics','staff','promotions','shop','profile'];
const PLATFORM_SUPERADMIN_PAGES = ['admin','audit','agent-activity','ai-approvals','backup','analytics','settings','security','quality','diagnostics','diagnostics-centers','diagnostics-labs','platform-finance','ai-governance','support','profile','bi','supplier'];

const ROLES: readonly Role[] = [
  { id:'owner', email:'owner-a@test.com', label:'Руководитель', family:'clinic', pages:CLINIC_OWNER_PAGES, mustNotContain:[/Владелец диагностического центра/i,/Владелец медицинской лаборатории/i,/Владелец зуботехнической лаборатории/i], entry:/\\/ai(?:$|[?#])/ },
  { id:'admin', email:'admin-a@test.com', label:'Администратор', family:'clinic', pages:CLINIC_ADMIN_PAGES, mustNotContain:[], entry:/\\/ai|\\/crm/ },
  { id:'doctor', email:'doctor-a@test.com', label:'Врач', family:'clinic', pages:CLINIC_DOCTOR_PAGES, mustNotContain:[/Super Admin/i], entry:/\\/ai|\\/crm/ },
  { id:'assistant', email:'assistant-a@test.com', label:'Ассистент', family:'clinic', pages:CLINIC_ASSISTANT_PAGES, mustNotContain:[/Super Admin/i], entry:/\\/ai|\\/crm/ },
  { id:'manager', email:'manager-a@test.com', label:'Менеджер', family:'clinic', pages:CLINIC_MANAGER_PAGES, mustNotContain:[/Super Admin/i], entry:/\\/ai|\\/crm/ },
  { id:'regular', email:'regular@test.com', label:'Студент', family:'platform', pages:['school','profile'], mustNotContain:[/CRM|Клиника|Super Admin/i], entry:/\\/school|\\/profile/ },
  { id:'patient', email:'patient@dentvision.kz', label:'Пациент', family:'patient', pages:['profile','shop','school'], mustNotContain:[/CRM|Клиника|Super Admin|Диагностический центр|Медицинская лаборатория|зуботехническая/i], entry:/\\/patient-portal/ },
  { id:'diagnostic-owner', email:'diagnostic-owner@test.com', label:'Владелец диагностического центра', family:'diagnostic', pages:['diagnostics','diagnostics-referrals','diagnostics-centers','diagnostics-results','diagnostics-calendar','diagnostics-statistics','diagnostics-settings','profile'], mustNotContain:[/Врач|Стоматологическая клиника|Зуботехническая лаборатория/i], entry:/\\/diagnostics\\/center/ },
  { id:'diagnostic-operator', email:'diagnostic-operator@test.com', label:'Оператор диагностического центра', family:'diagnostic', pages:['diagnostics','diagnostics-referrals','diagnostics-centers','diagnostics-results','diagnostics-calendar','profile'], mustNotContain:[/Настройки диагностического центра/i], entry:/\\/diagnostics\\/center/ },
  { id:'medical-lab-owner', email:'medical-lab-owner@test.com', label:'Владелец медицинской лаборатории', family:'medical-lab', pages:['diagnostics','diagnostics-laboratories','diagnostics-results','diagnostics-calendar','diagnostics-statistics','diagnostics-settings','profile'], mustNotContain:[/Врач|Зуботехническая лаборатория/i], entry:/\\/diagnostics\\/lab/ },
  { id:'medical-lab-tech', email:'medical-lab-tech@test.com', label:'Лаборант', family:'medical-lab', pages:['diagnostics','diagnostics-laboratories','diagnostics-results','profile'], mustNotContain:[/Настройки диагностического центра/i], entry:/\\/diagnostics\\/lab/ },
  { id:'dental-lab-owner', email:'dental-lab-owner@test.com', label:'Владелец зуботехнической лаборатории', family:'dental-lab', pages:['diagnostics','diagnostics-laboratories','diagnostics-results','diagnostics-settings','profile'], mustNotContain:[/Медицинская лаборатория|Диагностический центр/i], entry:/\\/diagnostics\\/lab/ },
  { id:'dental-technician', email:'dental-technician@test.com', label:'Зубной техник', family:'dental-lab', pages:['diagnostics','diagnostics-laboratories','diagnostics-results','profile'], mustNotContain:[/Настройки диагностического центра/i], entry:/\\/diagnostics\\/lab/ },
  { id:'superadmin', email:'superadmin@test.com', label:'Super Admin', family:'platform', pages:PLATFORM_SUPERADMIN_PAGES, mustNotContain:[/Пациент|Зубной техник/i], entry:/\\/admin|\\/ai/ },
  { id:'support', email:'support@test.com', label:'Поддержка', family:'platform', pages:['admin','analytics','settings','profile'], mustNotContain:[/Врач|Пациент/i], entry:/\\/admin|\\/analytics|\\/profile/ },
  { id:'laboratory', email:'lab-a@test.com', label:'Лаборатория', family:'clinic', pages:['lab','shop','diagnostics','diagnostics-referrals','diagnostics-laboratories','diagnostics-results','profile'], mustNotContain:[/Super Admin/i], entry:/\\/ai|\\/crm|\\/diagnostics/ },
] as const;

function pageId(route: string): string | null {
  const p = new URL(route, BASE_URL).pathname.replace(/\\/$/,'') || '/';
  const map: Record<string,string> = {
    '/ai':'dashboard','/crm/schedule':'schedule','/crm/patients':'patients','/crm/medical-card':'medical-card','/crm/finance':'finance','/crm/cashier':'cashier',
    '/crm/clinic-settings':'clinic-settings','/crm/billing':'billing','/crm/patient-inbox':'patient-inbox','/crm/visits':'visits','/crm/dental-chart':'dental-chart','/crm/treatment-plans':'treatment-plans',
    '/crm/pricelist':'pricelist','/crm/lab':'lab','/crm/inventory':'inventory','/crm/documents':'documents','/crm/staff':'staff','/crm/reminders':'reminders','/crm/promotions':'promotions','/crm/marketing':'promotions','/crm/icd10':'icd10','/crm/workflow':'workflow','/crm/integrations/messaging':'clinic-settings',
    '/analytics':'analytics','/admin':'admin','/audit':'audit','/agent-activity':'agent-activity','/ai-approvals':'ai-approvals','/backup':'backup','/shop':'shop','/school':'school','/settings':'settings','/bi':'bi','/security':'security','/quality':'quality','/platform-finance':'platform-finance','/ai-governance':'ai-governance','/support':'support','/diagnostics':'diagnostics','/supplier':'supplier',
    '/diagnostics/referrals':'diagnostics-referrals','/diagnostics/centers':'diagnostics-centers','/diagnostics/labs':'diagnostics-labs','/diagnostics/laboratories':'diagnostics-labs','/diagnostics/results':'diagnostics-results','/diagnostics/calendar':'diagnostics-calendar','/diagnostics/statistics':'diagnostics-statistics','/diagnostics/settings':'diagnostics-settings',
    '/diagnostics/center':'diagnostics','/diagnostics/lab':'diagnostics','/diagnostics/workspace':'diagnostics','/diagnostics/center-dashboard':'diagnostics','/diagnostics/lab-dashboard':'diagnostics','/diagnostics/registrations':'admin','/diagnostics/registration-requests':'admin',
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

async function login(page: Page, email: string) {
  await page.goto(BASE_URL + '/login?role=owner', {waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('input[autocomplete="username"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button',{name:'Войти в DentVision'}).click();
  await page.waitForURL(/\\/(?:ai|patient-portal|diagnostics|school|admin|profile)(?:$|[?#])/i,{timeout:30000});
  await page.waitForTimeout(600);
}

function collectors(page: Page) {
  const problems={console:[] as string[],page:[] as string[],requests:[] as string[],server:[] as string[]};
  page.on('console',m=>{if(m.type()==='error') problems.console.push(m.text())});
  page.on('pageerror',e=>problems.page.push(e.message));
  page.on('requestfailed',r=>problems.requests.push(r.method()+' '+r.url()+' :: '+(r.failure()?.errorText||'failed')));
  page.on('response',r=>{if(r.status()>=500) problems.server.push(r.status()+' '+r.request().method()+' '+r.url())});
  return problems;
}

async function shellAudit(page: Page, role: Role, route: string) {
  const result=await page.evaluate(()=>{
    const visible=(el:Element)=>{const h=el as HTMLElement,r=h.getBoundingClientRect(),s=getComputedStyle(h);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
    const controls=Array.from(document.querySelectorAll('button,a,input,select,textarea,[role="button"],[role="tab"],[role="menuitem"]')).filter(visible).map(el=>{const h=el as HTMLElement,r=h.getBoundingClientRect();return{name:(h.getAttribute('aria-label')||h.getAttribute('title')||h.getAttribute('placeholder')||h.innerText||'').replace(/\\s+/g,' ').trim(),w:r.width,h:r.height,disabled:(h as HTMLButtonElement).disabled}});
    const clipped=Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,button,a,[role="button"],[role="tab"]')).filter(visible).map(el=>{const h=el as HTMLElement;return{name:(h.innerText||'').trim(),sw:h.scrollWidth,cw:h.clientWidth}}).filter(x=>x.name&&x.sw>x.cw+2);
    return{text:document.body.innerText,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,bodyWidth:document.body.scrollWidth,controls,clipped,headings:Array.from(document.querySelectorAll('h1,h2')).filter(visible).map(x=>(x.textContent||'').trim()).filter(Boolean)};
  });
  expect(/Application error|ChunkLoadError|Failed to fetch dynamically imported module|Something went wrong/i.test(result.text),role.id+' '+route+': application error').toBeFalsy();
  expect(result.scrollWidth,role.id+' '+route+': document overflow').toBeLessThanOrEqual(result.clientWidth+2);
  expect(result.bodyWidth,role.id+' '+route+': body overflow').toBeLessThanOrEqual(result.clientWidth+2);
  expect(result.clipped,role.id+' '+route+': clipped text').toEqual([]);
  expect(result.controls.filter(x=>x.w<36||x.h<36),role.id+' '+route+': undersized controls').toEqual([]);
  expect(result.controls.filter(x=>!x.name),role.id+' '+route+': unnamed controls').toEqual([]);
  for(const forbidden of role.mustNotContain) expect(result.text,role.id+' '+route+': forbidden context visible').not.toMatch(forbidden);
}

async function inspectVisualSemantics(page: Page, role: Role, route: string) {
  const result = await page.evaluate(() => {
    const visible = (el: Element) => {
      const h = el as HTMLElement, r = h.getBoundingClientRect(), s = getComputedStyle(h);
      return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
    };
    const text = (el: Element) => (el.textContent || '').replace(/\\s+/g, ' ').trim();
    const interactive = Array.from(document.querySelectorAll('button,a,[role="button"],[role="tab"],[role="menuitem"],input,select,textarea')).filter(visible);
    const headings = Array.from(document.querySelectorAll('h1,h2,h3')).filter(visible).map(text).filter(Boolean);
    const iconOnly = interactive.filter(el => {
      const h = el as HTMLElement;
      const label = h.getAttribute('aria-label') || h.getAttribute('title') || '';
      return !text(el) && !label;
    });
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
        unnamed: interactive.filter(x => {
          const e=x as HTMLElement;
          return !(e.getAttribute('aria-label') || e.getAttribute('title') || e.getAttribute('placeholder') || e.innerText || '').trim();
        }).length,
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
    await page.waitForTimeout(100);
    const after = await page.locator('[role="dialog"]:visible,[aria-modal="true"]:visible,[role="menu"]:visible,[role="listbox"]:visible').count();
    expect(after, role.id + ' ' + route + ': Escape did not close overlay').toBe(0);
    expect(page.url(), role.id + ' ' + route + ': Escape unexpectedly navigated').toBe(before);
  }
}

async function inspectForms(page: Page, role: Role, route: string) {
  const issues=await page.locator('form:visible').evaluateAll(forms=>forms.flatMap(form=>Array.from(form.querySelectorAll('input,select,textarea')).map(el=>{const h=el as HTMLInputElement,id=h.id,label=id?document.querySelector('label[for="'+id+'"]')?.textContent:null;return{type:h.type,name:h.name,aria:h.getAttribute('aria-label'),placeholder:h.getAttribute('placeholder'),required:h.required,label:(label||'').trim()}})).filter(x=>!x.name&&!x.aria&&!x.placeholder&&!x.label&&x.type!=='hidden'));
  expect(issues,role.id+' '+route+': form controls without identification').toEqual([]);
}

async function discoverRoutes(page: Page): Promise<string[]> {
  const hrefs=await page.locator('a[href]').evaluateAll(as=>as.map(a=>(a as HTMLAnchorElement).href).filter(h=>h.startsWith(location.origin)));
  return [...new Set(hrefs.map(h=>{const u=new URL(h);return u.pathname+u.search}))].filter(r=>!/\\/sign\\/|\\/plan\\/|\\/book\\//.test(r));
}

async function auditRoute(page: Page, role: Role, route: string, shouldBeAllowed: boolean) {
  await page.goto(BASE_URL+route,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForTimeout(300);
  const current=new URL(page.url());
  if(!shouldBeAllowed){
    expect(current.pathname+current.search,role.id+' '+route+': forbidden route stayed open').not.toBe(route);
    return;
  }
  expect(current.pathname,role.id+' '+route+': allowed route redirected unexpectedly').not.toBe('/login');
  await shellAudit(page,role,route);
  await inspectForms(page,role,route);
  await inspectDialogsAndMenus(page,role,route);
  await inspectVisualSemantics(page,role,route);
  await page.reload({waitUntil:'domcontentloaded',timeout:30000});
  await shellAudit(page,role,route);
  await page.goBack({waitUntil:'domcontentloaded',timeout:30000}).catch(()=>{});
  await page.goForward({waitUntil:'domcontentloaded',timeout:30000}).catch(()=>{});
  await shellAudit(page,role,route);
}

test.describe('DentVision exhaustive role/context/browser gate',()=>{
  test.describe.configure({mode:'serial',timeout:120000});
  for(const role of ROLES){
    test(role.id+': every declared and discovered screen plus security boundary',async({page},info)=>{
      const problems=collectors(page);
      await login(page,role.email);
      await expect(page.locator('body')).toContainText('DentVision');
      expect(role.entry.test(page.url()),role.id+': incorrect post-login workspace '+page.url()).toBeTruthy();
      await expect(page.locator('body'),role.id+': role identity is missing on workspace entry').toContainText(role.label);

      const discovered=new Set<string>();
      for(const route of ROUTES){
        const allowed=PUBLIC_ROUTES.includes(route)||AUTH_COMMON_ROUTES.includes(route)||!!pageId(route)&&role.pages.includes(pageId(route)!);
        await auditRoute(page,role,route,allowed);
        if(allowed) for(const discoveredRoute of await discoverRoutes(page)) discovered.add(discoveredRoute);
      }
      for(const route of [...discovered].filter(r=>!ROUTES.includes(r as any))){
        const allowed=PUBLIC_ROUTES.includes(route)||AUTH_COMMON_ROUTES.includes(route)||!!pageId(route)&&role.pages.includes(pageId(route)!);
        await auditRoute(page,role,route,allowed);
      }

      await page.goto(BASE_URL+'/',{waitUntil:'domcontentloaded',timeout:30000});
      const storage=await page.evaluate(()=>({localStorage:Object.keys(localStorage),sessionStorage:Object.keys(sessionStorage)}));
      expect(JSON.stringify(storage)).not.toMatch(/password/i);
      const token=await page.evaluate(()=>Object.entries(localStorage).filter(([k])=>/token|auth/i.test(k)).map(([,v])=>String(v)).join(' '));
      expect(token).not.toMatch(/Test1234!/i);
      expect(problems.console,role.id+': console errors').toEqual([]);
      expect(problems.page,role.id+': page errors').toEqual([]);
      expect(problems.requests,role.id+': failed requests').toEqual([]);
      expect(problems.server,role.id+': HTTP 5xx responses').toEqual([]);
      await page.screenshot({path:'e2e/test-results/design-gate/roles/'+role.id+'-'+info.project.name+'.png',fullPage:true});
    });
  }

  test('cross-tenant: Clinic A never exposes Clinic B identity',async({page})=>{
    const problems=collectors(page);
    await login(page,'owner-a@test.com');
    expect(await page.locator('body').innerText()).toContain('E2E Clinic A');
    for(const route of ['/crm/patients','/crm/schedule','/crm/finance','/crm/inventory']){
      await page.goto(BASE_URL+route,{waitUntil:'domcontentloaded',timeout:30000});
      expect(await page.locator('body').innerText()).not.toContain('E2E Clinic B');
    }
    expect(problems.console).toEqual([]);
    expect(problems.page).toEqual([]);
    expect(problems.requests).toEqual([]);
  });

  test('anonymous: every protected route redirects before protected content renders',async({page})=>{
    for(const route of ROUTES.filter(r=>!PUBLIC_ROUTES.includes(r))){
      await page.context().clearCookies();
      await page.goto(BASE_URL+route,{waitUntil:'domcontentloaded',timeout:30000});
      expect(new URL(page.url()).pathname,'anonymous '+route+': protected screen exposed').toBe('/login');
    }
  });
});
