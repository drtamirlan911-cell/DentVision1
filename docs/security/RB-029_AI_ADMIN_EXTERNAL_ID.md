# RB-029 — AI Admin external contact identifier protection

## Change
- New WhatsApp/Instagram session identifiers are stored as AES-GCM ciphertext in AiAdminSession.externalUserIdCiphertext.
- Session lookup uses a deterministic HMAC-SHA256 blind index scoped by clinic and channel. Raw identifiers are not stored in the blind index.
- The legacy plaintext column remains nullable during rolling migration. First-contact conversion uses compare-and-set.
- The bounded backfill command defaults to dry-run, logs counts only, verifies ciphertext round-trips, uses keyset batches and compare-and-set updates. Writes require matching command/environment target confirmation. Production also requires backup/approval confirmation.

## Runbook
- Validate schema and apply the additive migration only in an approved environment.
- Dry run: npm run db:backfill:ai-admin-external-user-id
- Staging write requires --apply --target=staging --confirm-target=staging, AI_ADMIN_EXTERNAL_ID_BACKFILL_TARGET=staging, and AI_ADMIN_EXTERNAL_ID_BACKFILL_STAGING_DATABASE_URL set to the exact same connection string as DATABASE_URL.
- Production additionally requires --allow-production --confirm-production-write=I_HAVE_BACKUP_AND_APPROVAL, AI_ADMIN_EXTERNAL_ID_BACKFILL_TARGET=production, and AI_ADMIN_EXTERNAL_ID_BACKFILL_PRODUCTION_DATABASE_URL set to the exact same connection string as DATABASE_URL.
- The command fails closed if DATABASE_URL or the target-specific expected URL is missing or differs. URL values are never logged.
- Do not remove the legacy field/index until reconciliation proves zero plaintext rows.
- Rotating ENCRYPTION_KEY changes the blind index and requires coordinated reindex. Key versioning, old-key handling, retention/deletion and backup/restore remain open.

## Evidence boundary
Candidate source code only. No staging/production database query, migration, backfill, key rotation or backup/restore operation was run. RB-029 remains OPEN / P0.

- Legacy patientName and patientPhone session copies are now included in the same guarded backfill into dedicated ciphertext columns. The booking tool no longer duplicates these values onto AiAdminSession.

## Codex P2 follow-up — datasource binding
- The original target confirmation could be spoofed by setting the staging label while DATABASE_URL referenced production.
- The candidate now compares Prisma's DATABASE_URL with a separately configured target-specific expected URL before enabling any write.
- Regression tests cover a valid staging binding, a production URL presented as staging, and a missing expected URL. Local focused verification: 11/11 tests, backend TypeScript, changed-file ESLint and git diff --check passed.
- Candidate source only until exact-head GitHub CI and review complete; no database connection, migration or backfill was executed.
