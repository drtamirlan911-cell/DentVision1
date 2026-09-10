import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const indexDir = path.join(root, '.dentvision');
const ignored = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.gradle']);

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function textFiles(): string[] {
  return walk(root).filter((file) => /\.(ts|tsx|js|jsx|kt|java|json|md|yml|yaml|prisma)$/.test(file));
}

function rel(file: string): string {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

function read(file: string): string {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function extractRoutes(files: string[]) {
  const web: { path: string; source: string }[] = [];
  const backend: { method: string; path: string; source: string }[] = [];
  for (const file of files) {
    const source = read(file);
    const name = rel(file);
    if (/\.(tsx|jsx)$/.test(file)) {
      const re = /(?:path|to)\s*=\s*["'`]([^"'`]+)["'`]/g;
      for (const m of source.matchAll(re)) {
        if (m[1].startsWith('/')) web.push({ path: m[1], source: name });
      }
    }
    if (name.includes('dentvision-backend/')) {
      const re = /\.(get|post|put|patch|delete|options|head)\s*\(\s*["'`]([^"'`]+)["'`]/g;
      for (const m of source.matchAll(re)) backend.push({ method: m[1].toUpperCase(), path: m[2], source: name });
    }
  }
  return { web, backend };
}

function extractRoles(files: string[]) {
  const hits: string[] = [];
  for (const file of files) {
    const source = read(file);
    if (!/(role|Role|ROLE)/.test(source)) continue;
    for (const m of source.matchAll(/\b(OWNER|SUPERADMIN|ADMIN|DOCTOR|ASSISTANT|CASHIER|LAB|MANAGER|STUDENT|LECTURER|BUYER|SUPPLIER|PATIENT|RECEPTION)\b/g)) hits.push(m[1]);
  }
  return unique(hits);
}

function extractTests(files: string[]) {
  return files.filter((f) => /(test|spec|e2e)/i.test(f)).map(rel);
}

function extractWorkspaces(files: string[]) {
  const hits: string[] = [];
  for (const file of files) {
    const source = read(file);
    if (!/(workspace|clinic|organization)/i.test(source)) continue;
    for (const m of source.matchAll(/\b([A-Za-z][A-Za-z0-9]*(?:Workspace|workspace|Clinic|Organization))\b/g)) hits.push(m[1]);
  }
  return unique(hits);
}

function extractAndroidScreens(files: string[]) {
  return files.filter((f) => f.includes('/android/') && /(?:Screen|Activity|Fragment)\.(kt|java)$/.test(f)).map(rel);
}

function extractSecurity(files: string[]) {
  const groups = {
    authMiddlewareReferences: ['auth', 'authenticate', 'requireAuth'],
    rbacReferences: ['rbac', 'requireRole', 'roleAccess', 'permission'],
    auditReferences: ['audit', 'AuditLog'],
    idempotencyReferences: ['idempotency', 'Idempotency'],
  } as const;
  const result: Record<string, string[]> = {};
  for (const [key, needles] of Object.entries(groups)) {
    result[key] = files.filter((f) => {
      const source = read(f);
      return needles.some((needle) => source.includes(needle));
    }).map(rel);
  }
  return result;
}

function writeJson(name: string, value: unknown) {
  fs.mkdirSync(indexDir, { recursive: true });
  fs.writeFileSync(path.join(indexDir, name), JSON.stringify(value, null, 2) + '\n');
}

const files = textFiles();
const { web, backend } = extractRoutes(files);
const roles = extractRoles(files);
const tests = extractTests(files);
const workspaces = extractWorkspaces(files);
const androidScreens = extractAndroidScreens(files);
const security = extractSecurity(files);
const gitHead = process.env.GITHUB_SHA ?? 'local';

writeJson('routes.json', { generated: true, generator: 'quality-scripts/project-index.ts', webRoutes: web, backendRoutes: backend });
writeJson('api.json', { generated: true, generator: 'quality-scripts/project-index.ts', backendRoutes: backend, frontendApiFiles: files.filter((f) => /src\/(lib|api|services)/.test(rel(f))).map(rel) });
writeJson('roles.json', { generated: true, generator: 'quality-scripts/project-index.ts', roles, accessControlFiles: files.filter((f) => /(roleAccess|rbac|permission)/i.test(rel(f))).map(rel) });
writeJson('workspaces.json', { generated: true, generator: 'quality-scripts/project-index.ts', workspaces, workspaceFiles: files.filter((f) => /(workspace|orgContext)/i.test(rel(f))).map(rel), isolationRequired: true });
writeJson('tests.json', { generated: true, generator: 'quality-scripts/project-index.ts', testFiles: tests, commands: { lint: 'npm run lint', typecheck: 'npm run typecheck', unit: 'npm test', e2e: 'npm run test:e2e', quality: 'npm run quality:ci' } });
writeJson('security.json', { generated: true, generator: 'quality-scripts/project-index.ts', requirements: ['authentication', 'RBAC', 'workspace/tenant isolation', 'ownership checks', 'idempotency', 'audit trail', 'authenticated realtime notifications', 'no secrets in source'], ...security });
writeJson('parity.json', { generated: true, generator: 'quality-scripts/project-index.ts', webRoutes: web.map((x) => x.path), androidScreens, paritySourceFiles: files.filter((f) => f.includes('/android/') || f.startsWith(path.join(root, 'src'))).map(rel) });
writeJson('current-state.json', { schemaVersion: 1, generated: true, generator: 'quality-scripts/project-index.ts', indexedAt: new Date().toISOString(), commit: gitHead, currentPhase: 0, phaseName: 'CI stabilization', releaseStatus: 'NOT_RELEASED', protectedItems: ['Do not merge PR #247 before release gates pass', 'Do not invent routes or permissions', 'Do not treat model context as durable source of truth'], indexStats: { files: files.length, webRoutes: web.length, backendRoutes: backend.length, roles: roles.length, tests: tests.length, androidScreens: androidScreens.length } });

console.log(`DentVision index generated: ${files.length} files, ${web.length} web routes, ${backend.length} backend routes, ${roles.length} roles, ${tests.length} test files, ${androidScreens.length} Android screens.`);
