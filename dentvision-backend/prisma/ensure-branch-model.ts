import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Canonical branch schema is committed. This command is a compatibility gate
// for existing build/deploy scripts; it must never mutate schema.prisma.
const schemaPath = resolve(process.cwd(), 'prisma/schema.prisma');
const schema = readFileSync(schemaPath, 'utf8');
const required = [
  'model Branch {',
  '@@map("branches")',
  'model BranchMember {',
  '@@map("branch_members")',
  '@map("branch_id")',
];
for (const marker of required) {
  if (!schema.includes(marker)) throw new Error(`[prisma] canonical branch schema marker missing: ${marker}`);
}

const failedMigration = '20260929130000_ai_admin_postgres_queue';
try {
  const prismaBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  execFileSync(prismaBin, ['prisma', 'migrate', 'resolve', '--rolled-back', failedMigration], {
    stdio: 'inherit',
    env: process.env,
  });
} catch {
  // Normal when the migration is already applied, absent, or there is no
  // database connection during a local dependency install. The actual deploy
  // step remains authoritative for migration execution.
}

console.log('[prisma] canonical organization-scoped branch schema verified');
