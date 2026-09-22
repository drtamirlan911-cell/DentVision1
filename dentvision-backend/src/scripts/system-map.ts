import { readFileSync, readdirSync, writeFileSync, type Dirent } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROLE_PERMISSIONS } from '../lib/permissions.js';

const BACKEND_SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(BACKEND_SRC, '../..');
const FRONTEND_SRC = join(REPO_ROOT, 'src');
const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

function read(path: string): string {
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
}

function walk(dir: string, filter: (p: string) => boolean): string[] {
  const out: string[] = [];
  let entries: Dirent[] = [];
  try { entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)); } catch { return out; }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      out.push(...walk(path, filter));
    } else if (filter(path)) out.push(path);
  }
  return out;
}

type Route = { file: string; routerVar: string; method: string; path: string };
type Mount = { prefix: string; router: string };

function readMounts(): Mount[] {
  const source = read(join(BACKEND_SRC, 'app.ts'));
  const mounts: Mount[] = [];
  for (const match of source.matchAll(/app\.use\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)\s*\)/g)) {
    const [, prefix, router] = match;
    if (/Router$/.test(router)) mounts.push({ prefix, router });
  }
  return mounts;
}

function readRoutes(): Route[] {
  const files = walk(join(BACKEND_SRC, 'modules'), (p) => p.endsWith('.routes.ts') && !p.endsWith('.test.ts'));
  const routes: Route[] = [];
  const pattern = new RegExp(`(\\w+)\\.(${METHODS.join('|')})\\(\\s*['"]([^'"]*)`, 'g');
  for (const file of files) {
    const source = read(file);
    const routerVars = new Set([...source.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*(?:Router|express\.Router)\s*\(/g)].map((m) => m[1]));
    for (const match of source.matchAll(pattern)) {
      const [, routerVar, method, path] = match;
      if (routerVars.has(routerVar)) routes.push({ file: relative(REPO_ROOT, file), routerVar, method: method.toUpperCase(), path });
    }
  }
  const appFile = join(BACKEND_SRC, 'app.ts');
  const appSource = read(appFile);
  const inline = new RegExp(`app\\.(${METHODS.join('|')})\\(\\s*['"]([^'"]*)`, 'g');
  for (const match of appSource.matchAll(inline)) {
    const [, method, path] = match;
    routes.push({ file: relative(REPO_ROOT, appFile), routerVar: 'app', method: method.toUpperCase(), path });
  }
  return routes;
}

function readClientPaths(): Set<string> {
  const roots = [FRONTEND_SRC, join(REPO_ROOT, 'android', 'app', 'src')];
  const paths = new Set<string>();
  for (const file of roots.flatMap((root) => walk(root, (p) => /\.(ts|tsx|kt|java)$/.test(p)))) {
    if (file.includes('.test.') || file.includes('/android/app/src/test/') || file.includes('/android/app/src/androidTest/')) continue;
    const source = read(file);
    for (const match of source.matchAll(/['"`](\/api\/[^'"`\s]*)['"`]/g)) paths.add(match[1]);
    for (const match of source.matchAll(/['"`](\/api\/[^'"`\s]*?)(?:\$\{|['"`])/g)) paths.add(match[1]);
  }
  return paths;
}

function routeShape(prefix: string, path: string): string {
  const joined = `${prefix.replace(/\/$/, '')}${path === '/' ? '' : path}`;
  return joined || '/';
}

function hasConsumer(routeUrl: string, clientPaths: Set<string>): boolean {
  const routeParts = routeUrl.split('/').filter(Boolean);
  for (const client of clientPaths) {
    const clientParts = client.split('?')[0].split('/').filter(Boolean);
    if (clientParts.length !== routeParts.length) continue;
    if (routeParts.every((part, i) => part.startsWith(':') || clientParts[i].includes('${') || part === clientParts[i])) return true;
  }
  return false;
}

function main(): void {
  const mounts = readMounts();
  const routes = readRoutes();
  const clients = readClientPaths();
  const mountRows = mounts.map((mount) => {
    const own = routes.filter((route) => route.routerVar === mount.router || basename(route.file).replace('.routes.ts', 'Router') === mount.router);
    const urls = own.map((route) => routeShape(mount.prefix, route.path));
    const orphan = urls.filter((url) => !hasConsumer(url, clients));
    return { ...mount, total: own.length, orphan: orphan.length };
  });
  const duplicateMounts = [...new Set(mounts.map((mount) => mount.router))]
    .map((router) => ({ router, count: mounts.filter((mount) => mount.router === router).length }))
    .filter((item) => item.count > 1);
  const models = [...read(join(BACKEND_SRC, '../prisma/schema.prisma')).matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);
  // Keep the callback explicit: Array.map passes the numeric index as its second argument,
  // which must never be forwarded to path.basename as the optional suffix parameter.
  const jobs = walk(join(BACKEND_SRC, 'jobs'), (p) => p.endsWith('.ts') && !p.endsWith('.test.ts')).map((file) => basename(file));
  const lines: string[] = [];
  lines.push('# DentVision System Map', '', `> Generated from repository state`, '');
  lines.push('## Summary', '', `- Mounted routers: **${mounts.length}**`, `- Unique route handlers: **${routes.length}**`, `- Registered HTTP routes after mount: **${mountRows.reduce((sum, row) => sum + row.total, 0)}**`, `- Routes without detected web/mobile consumer: **${mountRows.reduce((sum, row) => sum + row.orphan, 0)}**`, `- Prisma models: **${models.length}**`, `- Background jobs: **${jobs.length}**`, `- Permission roles: **${Object.keys(ROLE_PERMISSIONS).length}**`, '');
  lines.push('## Canonical request context', '', '```text', 'Identity -> Active Workspace -> Organization -> Branch -> Role -> Permission -> Data Scope -> AI Context -> AI Session -> Tool -> Audit -> E2E -> Visual Evidence -> Release', '```', '');
  lines.push('## Mounted routers', '', '| Prefix | Router | Handlers | No detected consumer |', '|---|---|---:|---:|');
  for (const row of mountRows) lines.push(`| ${row.prefix} | ${row.router} | ${row.total} | ${row.orphan} |`);
  if (duplicateMounts.length) {
    lines.push('', '### Repeated mounts', '');
    for (const item of duplicateMounts) {
      const prefixes = mounts.filter((mount) => mount.router === item.router).map((mount) => mount.prefix).join(', ');
      lines.push(`- ${item.router} — ${item.count} mounts: ${prefixes}`);
    }
  }
  lines.push('', '## Background jobs', '', ...jobs.map((job) => `- ${job}`), '');
  lines.push('> **Generated** `npm run system-map` from source code.', '> Do not edit manually — rerun the generator.', '> Judgments belong in `SYSTEM_AUDIT.md`; this file contains only facts derivable from code.', '');
  writeFileSync(join(REPO_ROOT, 'docs', 'SYSTEM_MAP.md'), lines.join('\n'));
}

main();
