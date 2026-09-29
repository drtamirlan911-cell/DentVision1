import { execFileSync } from 'node:child_process'
import prisma from '../src/lib/prisma.js'

const migration = '20260929130000_ai_admin_postgres_queue'

async function main(): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>>`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
    WHERE migration_name = ${migration}
    LIMIT 1
  `

  const row = rows[0]
  if (!row || row.finished_at || row.rolled_back_at) return

  console.warn(`[migration-recovery] Rolling back failed migration ${migration} before retrying deploy`)
  const prismaBin = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  execFileSync(prismaBin, ['prisma', 'migrate', 'resolve', '--rolled-back', migration], {
    stdio: 'inherit',
    env: process.env,
  })
}

main()
  .catch((error) => {
    console.error('[migration-recovery] failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
