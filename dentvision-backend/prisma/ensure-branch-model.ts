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
console.log('[prisma] canonical organization-scoped branch schema verified');
