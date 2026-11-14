# RB-029 — AI Admin external contact identifier protection

## Compatibility-first change
- WhatsApp/Instagram external identifiers are encrypted into AiAdminSession.externalUserIdCiphertext and indexed with a clinic/channel-scoped HMAC-SHA256 blind index.
- The default rollout mode is deliberately **dual-write**: new/updated rows keep externalUserId populated alongside ciphertext and blind index. This preserves lookup compatibility for pre-upgrade webhook workers during a rolling deployment and prevents the old worker from creating a second session. The compatibility phase does not yet close the plaintext-at-rest blocker.
- Ciphertext-only writes are a separate strict cutover. Every webhook/queue worker must run the compatibility-aware release, all legacy workers must be stopped and drained, and the operator must set AI_ADMIN_EXTERNAL_ID_STRICT_WRITE=true plus AI_ADMIN_EXTERNAL_ID_LEGACY_WORKERS_DRAINED=I_HAVE_DRAINED_ALL_LEGACY_WORKERS. Strict mode refuses to run without the acknowledgement and writes externalUserId=null.
- A legacy row is adopted with compare-and-set. Compatibility mode preserves its plaintext lookup value; strict mode clears it after the worker-drain acknowledgement.

## Versioned AI Admin keyrings
- New AI Admin encrypted values use the tagged format ENC:v2:<key-id>:<iv>:<tag>:<ciphertext> with AES-256-GCM, a random 96-bit IV, authenticated key-id metadata and a 128-bit authentication tag. Readers fail closed for an unknown key ID or authentication failure.
- Configure AI_ADMIN_PHI_KEYRING_JSON as a JSON object mapping key IDs to independent secrets of at least 32 characters, and AI_ADMIN_PHI_ACTIVE_KEY_ID to the key ID used for new AI Admin ciphertext. Example shape: {"legacy":"<old-key>","2026-11":"<new-ai-admin-phi-key>"}. The legacy entry must retain the previous ENCRYPTION_KEY for unversioned ENC rows and older ciphertexts.
- Configure the blind-index key separately with AI_ADMIN_EXTERNAL_ID_INDEX_KEYRING_JSON and AI_ADMIN_EXTERNAL_ID_ACTIVE_INDEX_KEY_ID. Use a distinct secret from the encryption key. Keep the legacy entry until every stored v1 index has been rotated. Readers search all configured key versions; a session read upgrades its index to the active v2 key ID.
- If dedicated ring settings are absent, the current ENCRYPTION_KEY is used under key ID legacy. Do not remove or rotate that old secret while any unversioned ENC values or v1 indexes remain.
- The guarded backfill dry-run now inspects already-encrypted sessions, verifies the stored identifier against its blind index, re-encrypts ciphertext under the active key ID and recalculates indexes. Apply remains gated by strict mode, worker-drain acknowledgement, exact datasource binding and backup/approval.
- This AI Admin keyring is separate from the shared ENCRYPTION_KEY lifecycle used by Patient history and other modules; those other stores still require independent migration and rotation evidence.

## Runbook
1. Deploy the compatibility-aware release with strict mode disabled. Verify that old and new workers can resolve the same sessions.
2. Verify every webhook/queue worker is on this release. Stop and drain all prior versions. Do not enable strict mode during a rolling deployment.
3. Enable AI_ADMIN_EXTERNAL_ID_STRICT_WRITE=true and AI_ADMIN_EXTERNAL_ID_LEGACY_WORKERS_DRAINED=I_HAVE_DRAINED_ALL_LEGACY_WORKERS consistently on every worker, only after the drain is verified.
4. Validate schema and backup/restore in an approved environment. Dry run: npm run db:backfill:ai-admin-external-user-id.
5. Staging apply additionally requires --apply --target=staging --confirm-target=staging, AI_ADMIN_EXTERNAL_ID_BACKFILL_TARGET=staging, and AI_ADMIN_EXTERNAL_ID_BACKFILL_STAGING_DATABASE_URL exactly matching DATABASE_URL.
6. Production apply additionally requires --allow-production --confirm-production-write=I_HAVE_BACKUP_AND_APPROVAL, AI_ADMIN_EXTERNAL_ID_BACKFILL_TARGET=production, and AI_ADMIN_EXTERNAL_ID_BACKFILL_PRODUCTION_DATABASE_URL exactly matching DATABASE_URL.
7. Backfill writes refuse to run unless strict mode and the legacy-worker drain acknowledgement are both present; the target-specific DATABASE_URL binding must also match. Connection URLs are never logged.
8. Reconcile row counts and exception records. Do not remove the legacy column/index until zero plaintext rows and approved rollback/restore evidence are verified.

## Remaining risks
- Rotating ENCRYPTION_KEY changes the blind index and requires a coordinated reindex. Key versioning, old-key support, retention/deletion/export, verified backup/restore and approved staging evidence remain open.
- Compatibility mode intentionally retains plaintext identifiers until strict cutover and historical backfill. RB-029 remains OPEN / P0.

## Evidence boundary
Candidate source code only. No staging/production database query, migration, backfill, worker drain, key rotation, provider operation or backup/restore operation was run.
