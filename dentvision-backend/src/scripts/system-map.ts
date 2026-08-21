/**
 * Generates `docs/SYSTEM_MAP.md` — what this system actually contains, derived
 * from the source rather than described by hand.
 *
 * The repository already has half a dozen hand-written audit reports, and the
 * core ones are weeks out of date: `MODULE_STATUS.md`, `TECH_DEBT.md` and
 * `AUDIT_REPORT.md` were last touched well before the commits they describe.
 * That is not neglect, it is what happens to any inventory a person has to
 * retype. So this map is generated: `npm run system-map` re-derives it, and a
 * stale map becomes a diff rather than a lie.
 *
 * It answers the questions an audit keeps needing:
 *   - which mounted routers exist, and what does each expose;
 *   - which endpoints no frontend client calls (candidates for BACKEND_ONLY /
 *     HIDDEN capabilities, or for deletion);
 *   - which Prisma models nothing reads or nothing writes;
 *   - which permission each role holds;
 *   - what runs in the background, and what tools the AI layer can invoke.
 *
 * **It reports, it never judges.** "No client calls this" is a fact; whether
 * that endpoint is a hidden feature, a webhook or dead code is a human call,
 * and belongs in `docs/SYSTEM_AUDIT.md` next to it.
 *
 * Deliberately a text scan, not a typed AST pass — it must never fail the
 * build regardless of what the source looks like. If a pattern stops
 * matching, the count drops visibly rather than the script throwing.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, type Dirent } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Imported, not re-parsed. A regex over the matrix silently folded OWNER into
// SUPERADMIN when this was first written — the module has no imports and no
// side effects, so reading the real values is both safer and simpler than
// pretending to be a TypeScript parser.
import { ROLE_PERMISSIONS } from '../lib/permissions.js';

// The backend compiles to ESM, so `__dirname` does not exist here.
const BACKEND_SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(BACKEND_SRC, '../..');
const FRONTEND_SRC = join(REPO_ROOT, 'src');

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

function read(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

/**
 * A missing directory is a normal answer here, not a failure — the map is
 * generated over a tree that legitimately varies. Extracted so the return type
 * is inferred as `Dirent[]` rather than widening at the assignment.
 */
function safeReadDir(dir: string): Dirent[] {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function walk(dir: string, filter: (p: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of safeReadDir(dir)) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      out.push(...walk(path, filter));
    } else if (filter(path)) {
      out.push(path);
    }
  }
  return out;
}

// ── Mounted routers ────────────────────────────────────────────────────────

interface Mount {
  prefix: string;
  router: string;
}

function readMounts(): Mount[] {
  const app = read(join(BACKEND_SRC, 'app.ts'));
  const mounts: Mount[] = [];
  for (const match of app.matchAll(/app\.use\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/g)) {
    const [, prefix, router] = match;
    // Rate limiters and other middleware are mounted the same way; only
    // things named like a router are routers.
    if (!/Router$/.test(router)) continue;
    mounts.push({ prefix, router });
  }
  return mounts;
}

// ── Route handlers ─────────────────────────────────────────────────────────

interface RouteDef {
  file: string;
  routerVar: string;
  method: string;
  path: string;
}

function readRoutes(): RouteDef[] {
  const files = walk(join(BACKEND_SRC, 'modules'), (p) => p.endsWith('.routes.ts') && !p.endsWith('.test.ts'));
  const routes: RouteDef[] = [];
  const pattern = new RegExp(`(\\w+)\\.(${HTTP_METHODS.join('|')})\\(\\s*'([^']*)'`, 'g');

  for (const file of files) {
    const source = read(file);
    for (const match of source.matchAll(pattern)) {
      const [, routerVar, method, path] = match;
      if (!/Router$/.test(routerVar)) continue;
      routes.push({ file: relative(REPO_ROOT, file), routerVar, method: method.toUpperCase(), path });
    }
  }
  return routes;
}

/** Turn `/:clinicId/treatment-plans` into something a URL string would match. */
function routeShape(prefix: string, path: string): string {
  const joined = `${prefix.replace(/\/$/, '')}${path === '/' ? '' : path}`;
  return joined || '/';
}

// ── Frontend consumers ─────────────────────────────────────────────────────

/**
 * Every API path the browser can build, read out of the client rather than
 * guessed. Template literals are reduced to their static prefix, because that
 * is the part a route can be matched on.
 */
function readClientPaths(): Set<string> {
  const files = walk(FRONTEND_SRC, (p) => p.endsWith('.ts') || p.endsWith('.tsx'));
  const paths = new Set<string>();
  for (const file of files) {
    if (file.includes('.test.')) continue;
    const source = read(file);
    for (const match of source.matchAll(/['"`](\/api\/[^'"`\s]*)['"`]/g)) {
      paths.add(match[1]);
    }
  }
  return paths;
}

/**
 * Does any client path plausibly hit this route?
 *
 * Segment-wise, with `:param` matching anything and a client `${...}` matching
 * anything — the client writes `/api/crm/${clinicId}/treatment-plans` where the
 * route says `/:clinicId/treatment-plans`.
 */
function hasConsumer(routeUrl: string, clientPaths: Set<string>): boolean {
  const routeParts = routeUrl.split('/').filter(Boolean);
  for (const client of clientPaths) {
    const clientParts = client.split('?')[0].split('/').filter(Boolean);
    if (clientParts.length !== routeParts.length) continue;
    let ok = true;
    for (let i = 0; i < routeParts.length; i += 1) {
      const r = routeParts[i];
      const c = clientParts[i];
      if (r.startsWith(':')) continue;
      if (c.includes('${')) continue;
      if (r !== c) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

// ── Prisma models ──────────────────────────────────────────────────────────

interface ModelUse {
  name: string;
  reads: number;
  writes: number;
}

const WRITE_OPS = ['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany'];
const READ_OPS = ['findUnique', 'findFirst', 'findMany', 'count', 'aggregate', 'groupBy'];

/**
 * Relation field names that point at each model, e.g. `personRoles` → PersonRole.
 *
 * Needed because a model is very often reached only through its parent's
 * `include`/`select`, never by a top-level client call. Counting only
 * `prisma.x.findMany` said Permission, RolePermission and PersonRole were
 * untouched, when all three are read through relations in `middleware/rbac.ts`.
 * Three wrong answers on one axis is enough to fix the measurement.
 */
function relationFieldsByModel(schema: string): Map<string, string[]> {
  const byModel = new Map<string, string[]>();
  // Deliberately not anchored at the end of the line: an earlier version
  // required `@relation`, end-of-line or whitespace after the type and matched
  // nothing at all, which quietly disabled the whole relation count.
  for (const match of schema.matchAll(/^ {2}(\w+)\s+(\w+)(\[\])?/gm)) {
    const [, field, type] = match;
    // Scalars and enums share this shape; only names that are models matter,
    // and the caller filters against the real model list.
    const list = byModel.get(type) ?? [];
    if (!list.includes(field)) list.push(field);
    byModel.set(type, list);
  }
  return byModel;
}

function readModels(): ModelUse[] {
  const schema = read(join(BACKEND_SRC, '../prisma/schema.prisma'));
  const names = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);
  const relations = relationFieldsByModel(schema);

  // Seeds and migration helpers live outside `src` but are still real writers —
  // `seed-permissions.ts` is the only thing that populates Permission/Role.
  const sources = [
    ...walk(BACKEND_SRC, (p) => p.endsWith('.ts') && !p.endsWith('.test.ts')),
    ...walk(join(BACKEND_SRC, '../prisma'), (p) => p.endsWith('.ts') && !p.endsWith('.test.ts')),
  ]
    .map((p) => read(p))
    .join('\n');

  return names.map((name) => {
    // Prisma's client property is the model name with a lowercase first letter.
    const prop = name.charAt(0).toLowerCase() + name.slice(1);
    const count = (ops: string[]) =>
      ops.reduce((sum, op) => {
        const re = new RegExp(`\\.${prop}\\.${op}\\b`, 'g');
        return sum + (sources.match(re)?.length ?? 0);
      }, 0);

    // A parent's `include: { personRoles: ... }` reads this model just as
    // surely as a direct call would.
    const viaRelation = (relations.get(name) ?? []).reduce((sum, field) => {
      const re = new RegExp(`\\b${field}\\s*:\\s*(true|\\{)`, 'g');
      return sum + (sources.match(re)?.length ?? 0);
    }, 0);

    return { name, reads: count(READ_OPS) + viaRelation, writes: count(WRITE_OPS) };
  });
}

// ── Roles and permissions ──────────────────────────────────────────────────

function readRoleMatrix(): { roles: string[]; rows: Record<string, string[]> } {
  const rows: Record<string, string[]> = {};
  for (const [role, keys] of Object.entries(ROLE_PERMISSIONS)) {
    rows[role] = [...keys];
  }
  return { roles: Object.keys(rows), rows };
}

// ── Background work and the AI surface ─────────────────────────────────────

function readJobs(): string[] {
  return walk(join(BACKEND_SRC, 'jobs'), (p) => p.endsWith('.ts') && !p.endsWith('.test.ts')).map((p) =>
    basename(p),
  );
}

function readAiTools(): string[] {
  const files = walk(join(BACKEND_SRC, 'modules'), (p) => /ai/i.test(p) && p.endsWith('.ts') && !p.endsWith('.test.ts'));
  const tools = new Set<string>();
  for (const file of files) {
    const source = read(file);
    for (const match of source.matchAll(/(?:PATIENT_TOOLS|TOOLS|registry)\.(\w+)\s*=/g)) tools.add(match[1]);
    for (const match of source.matchAll(/name:\s*'(\w+)',\s*\n\s*description:/g)) tools.add(match[1]);
  }
  return [...tools].sort();
}

// ── Report ─────────────────────────────────────────────────────────────────

function table(header: string[], rows: string[][]): string {
  const head = `| ${header.join(' | ')} |`;
  const rule = `|${header.map(() => '---').join('|')}|`;
  return [head, rule, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

function main(): void {
  const mounts = readMounts();
  const routes = readRoutes();
  const clientPaths = readClientPaths();
  const models = readModels();
  const { rows: roleRows } = readRoleMatrix();
  const jobs = readJobs();
  const aiTools = readAiTools();

  const byRouter = new Map<string, RouteDef[]>();
  for (const route of routes) {
    const list = byRouter.get(route.routerVar) ?? [];
    list.push(route);
    byRouter.set(route.routerVar, list);
  }

  const orphanRoutes: Array<{ url: string; method: string; file: string }> = [];
  const mountRows: string[][] = [];

  for (const mount of mounts) {
    const own = byRouter.get(mount.router) ?? [];
    let unconsumed = 0;
    for (const route of own) {
      const url = routeShape(mount.prefix, route.path);
      if (!hasConsumer(url, clientPaths)) {
        unconsumed += 1;
        orphanRoutes.push({ url, method: route.method, file: route.file });
      }
    }
    mountRows.push([
      `\`${mount.prefix}\``,
      mount.router,
      String(own.length),
      unconsumed > 0 ? `**${unconsumed}**` : '0',
    ]);
  }

  const appSource = read(join(BACKEND_SRC, 'app.ts'));
  const unmounted = [...byRouter.keys()].filter((r) => !mounts.some((m) => m.router === r));
  const unusedModels = models.filter((m) => m.reads === 0 && m.writes === 0);
  const writeOnly = models.filter((m) => m.writes > 0 && m.reads === 0);
  const readOnly = models.filter((m) => m.reads > 0 && m.writes === 0);

  const out: string[] = [];
  out.push('# SYSTEM_MAP — что система содержит на самом деле');
  out.push('');
  out.push('> **Сгенерировано** `npm run system-map` из исходников.');
  out.push('> Не редактируйте руками — перезапустите генератор.');
  out.push('> Суждения («это скрытая функция», «это мёртвый код») живут в `SYSTEM_AUDIT.md`;');
  out.push('> здесь только факты, которые можно вывести из кода.');
  out.push('');
  out.push(`Собрано: ${new Date().toISOString().slice(0, 10)}`);
  out.push('');

  out.push('## Сводка');
  out.push('');
  out.push(
    table(
      ['Измерение', 'Значение'],
      [
        ['Смонтированных роутеров', String(mounts.length)],
        ['Обработчиков маршрутов', String(routes.length)],
        ['Маршрутов без потребителя на фронте', `**${orphanRoutes.length}**`],
        ['Роутеров, объявленных но не смонтированных', String(unmounted.length)],
        ['Prisma-моделей', String(models.length)],
        ['— без прямых вызовов Prisma-клиента', `**${unusedModels.length}**`],
        ['— только пишутся, никогда не читаются', `**${writeOnly.length}**`],
        ['— только читаются, никогда не пишутся', String(readOnly.length)],
        ['Ролей в матрице прав', String(Object.keys(roleRows).length)],
        ['Фоновых задач', String(jobs.length)],
        ['Инструментов AI', String(aiTools.length)],
      ],
    ),
  );
  out.push('');

  out.push('## Роутеры');
  out.push('');
  out.push('«Без потребителя» = ни один строковый литерал `/api/...` во фронтенде');
  out.push('не совпадает с маршрутом посегментно. Это **не** значит «мёртвый»:');
  out.push('так же выглядят вебхуки, серверные интеграции и внутренние вызовы.');
  out.push('');
  out.push(table(['Префикс', 'Роутер', 'Маршрутов', 'Без потребителя'], mountRows));
  out.push('');

  if (unmounted.length > 0) {
    out.push('### Объявлены и импортированы, но не смонтированы');
    out.push('');
    for (const router of unmounted) {
      const imported = appSource.includes(router) ? 'импортирован в `app.ts`, но нет `app.use`' : 'не импортирован';
      out.push(`- \`${router}\` — ${(byRouter.get(router) ?? []).length} маршрутов недостижимы по HTTP (${imported})`);
    }
    out.push('');
  }

  out.push('## Маршруты, которые фронтенд не зовёт');
  out.push('');
  out.push('<details><summary>Развернуть список</summary>');
  out.push('');
  for (const route of orphanRoutes) {
    out.push(`- \`${route.method} ${route.url}\` — ${route.file}`);
  }
  out.push('');
  out.push('</details>');
  out.push('');

  out.push('## Модели данных');
  out.push('');
  if (unusedModels.length > 0) {
    out.push('### Нет ни одного прямого вызова Prisma-клиента');
    out.push('');
    out.push('Учитываются и прямые вызовы клиента, и чтение через `include`/`select`');
    out.push('родителя — без второго счёт врал: `Permission`, `RolePermission` и');
    out.push('`PersonRole` читаются именно так, в `middleware/rbac.ts`.');
    out.push('Всё равно повод посмотреть, а не приговор.');
    out.push('');
    out.push(unusedModels.map((m) => `\`${m.name}\``).join(', '));
    out.push('');
  }
  if (writeOnly.length > 0) {
    out.push('### Пишутся, но никогда не читаются');
    out.push('');
    out.push('Данные копятся и никому не показываются — либо незаконченный workflow,');
    out.push('либо запись «на будущее».');
    out.push('');
    out.push(table(['Модель', 'Записей'], writeOnly.map((m) => [`\`${m.name}\``, String(m.writes)])));
    out.push('');
  }
  if (readOnly.length > 0) {
    out.push('### Читаются, но никогда не пишутся из приложения');
    out.push('');
    out.push('Заполняются миграцией, сидом или вручную.');
    out.push('');
    out.push(readOnly.map((m) => `\`${m.name}\``).join(', '));
    out.push('');
  }

  out.push('## Права по ролям');
  out.push('');
  out.push('`SUPERADMIN` здесь намеренно отсутствует: он не хранится в карте,');
  out.push('а обрабатывается в `roleHasPermission`. `DIRECTOR` — алиас OWNER,');
  out.push('`CASHIER` — алиас ADMIN; оба задокументированы в `lib/permissions.ts`.');
  out.push('');
  out.push(
    table(
      ['Роль', 'Прав', 'Ключи'],
      Object.entries(roleRows).map(([role, keys]) => [
        `**${role}**`,
        keys.includes('*') ? 'всё' : String(keys.length),
        keys.includes('*') ? '`*`' : keys.map((k) => `\`${k}\``).join(' '),
      ]),
    ),
  );
  out.push('');

  out.push('## Фоновые задачи');
  out.push('');
  out.push(jobs.map((j) => `- \`${j}\``).join('\n') || '_нет_');
  out.push('');

  out.push('## Инструменты AI');
  out.push('');
  out.push(aiTools.map((t) => `\`${t}\``).join(', ') || '_нет_');
  out.push('');

  const target = join(REPO_ROOT, 'docs/SYSTEM_MAP.md');
  writeFileSync(target, out.join('\n'));

  // Printed rather than silent: this runs in a terminal and the numbers are
  // the point of running it.
  console.warn(`SYSTEM_MAP → ${relative(REPO_ROOT, target)}`);
  console.warn(
    `  ${mounts.length} routers · ${routes.length} routes (${orphanRoutes.length} unconsumed) · ` +
      `${models.length} models (${unusedModels.length} untouched, ${writeOnly.length} write-only)`,
  );
}

if (!existsSync(join(REPO_ROOT, 'docs'))) {
  console.error('docs/ not found — run from the repository');
  process.exit(1);
}

main();
