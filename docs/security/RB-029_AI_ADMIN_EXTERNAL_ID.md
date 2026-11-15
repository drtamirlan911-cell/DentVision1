# RB-029 — AI Admin external contact identifier protection

## Compatibility-first change
- WhatsApp/Instagram external identifiers are encrypted into AiAdminSession.externalUserIdCiphertext and indexed with a clinic/channel-scoped HMAC-SHA256 blind index.
- The default rollout mode is deliberately **dual-write**: new/updated rows keep externalUserId populated alongside ciphertext and blind index. This preserves lookup compatibility for pre-upgrade webhook workers during a rolling deployment and prevents the old worker from creating a second session. The compatibility phase does not yet close the plaintext-at-rest blocker.
- Ciphertext-only writes are a separate strict cutover. Every webhook/queue worker must run the compatibility-aware release, all legacy workers must be stopped and drained, and the operator must set AI_ADMIN_EXTERNAL_ID_STRICT_WRITE=true plus AI_ADMIN_EXTERNAL_ID_LEGACY_WORKERS_DRAINED=I_HAVE_DRAINED_ALL_LEGACY_WORKERS. Strict mode refuses to run without the acknowledgement and writes externalUserId=null.
- A legacy row is adopted with compare-and-set. Compatibility mode preserves its plaintext lookup value; strict mode clears it after the worker-drain acknowledgement.

## Versioned AI Admin keyrings
- Readers accept both legacy ENC:<iv>:<tag>:<ciphertext> and versioned ENC:v2:<key-id>:<iv>:<tag>:<ciphertext> envelopes. Writes remain in the legacy format until AI_ADMIN_PHI_V2_WRITE_ENABLED=true and AI_ADMIN_PHI_V2_READERS_DEPLOYED=I_HAVE_DEPLOYED_ALL_V2_READERS are explicitly configured across the fully upgraded fleet. After that gate, new writes use AES-256-GCM v2 with a random 96-bit IV, authenticated key-ID metadata and a 128-bit authentication tag. Unknown key IDs and authentication failures fail closed.
- Configure AI_ADMIN_PHI_KEYRING_JSON as a JSON object mapping key IDs to independent secrets of at least 32 characters, and AI_ADMIN_PHI_ACTIVE_KEY_ID to the key ID used for new AI Admin ciphertext. Example shape: {"legacy":"<old-key>","2026-11":"<new-ai-admin-phi-key>"}. The legacy entry must retain the previous ENCRYPTION_KEY for unversioned ENC rows and older ciphertexts.
- Configure the blind-index key separately with AI_ADMIN_EXTERNAL_ID_INDEX_KEYRING_JSON and AI_ADMIN_EXTERNAL_ID_ACTIVE_INDEX_KEY_ID. Use a distinct secret from the encryption key. Keep the legacy entry until every stored v1 index has been rotated. Readers search all configured key versions; a session read upgrades its index to the active v2 key ID.
- If dedicated ring settings are absent, the current ENCRYPTION_KEY is used under key ID legacy. Do not remove or rotate that old secret while any unversioned ENC values or v1 indexes remain.
- The guarded backfill dry-run inspects sessions, historical AiAdminMessage content/tool results, AiAdminEscalation reason/last-message fields, and every retained ai_admin_queue_messages payload/error, including completed and failed rows. It validates legacy object-shaped JSONB queue payloads, encrypts the normalized message and error, re-encrypts historical ciphertext under the active key ID and recalculates blind indexes. Apply requires strict identifier mode, v2-reader acknowledgement, encrypted-queue enablement, webhook and queue worker drain acknowledgements, exact datasource binding and backup/approval.
- This AI Admin keyring is separate from the shared ENCRYPTION_KEY lifecycle used by Patient history and other modules; those other stores still require independent migration and rotation evidence.

## Runbook
1. Deploy the reader-first release with AI_ADMIN_PHI_V2_WRITE_ENABLED and AI_ADMIN_QUEUE_PHI_ENCRYPTION_ENABLED disabled. The new version reads legacy and v2 ciphertext, while all legacy queue workers continue to receive object-shaped JSONB payloads.
2. Verify every API, webhook, queue, escalation and history reader runs the reader-first release. Drain all prior versions and every legacy queue worker. Then set AI_ADMIN_PHI_V2_READERS_DEPLOYED=I_HAVE_DEPLOYED_ALL_V2_READERS, AI_ADMIN_PHI_V2_WRITE_ENABLED=true, AI_ADMIN_QUEUE_LEGACY_WORKERS_DRAINED=I_HAVE_DRAINED_ALL_LEGACY_WORKERS and AI_ADMIN_QUEUE_PHI_ENCRYPTION_ENABLED=true consistently across the fleet. Do not enable these flags during rolling deployment.
3. Only after every legacy webhook worker is drained, enable AI_ADMIN_EXTERNAL_ID_STRICT_WRITE=true and AI_ADMIN_EXTERNAL_ID_LEGACY_WORKERS_DRAINED=I_HAVE_DRAINED_ALL_LEGACY_WORKERS consistently. This is a separate acknowledgement from the queue-worker drain.
4. Validate schema and backup/restore in an approved environment. Dry run: npm run db:backfill:ai-admin-external-user-id.
5. Staging apply additionally requires --apply --target=staging --confirm-target=staging, AI_ADMIN_EXTERNAL_ID_BACKFILL_TARGET=staging, and AI_ADMIN_EXTERNAL_ID_BACKFILL_STAGING_DATABASE_URL exactly matching DATABASE_URL.
6. Production apply additionally requires --allow-production --confirm-production-write=I_HAVE_BACKUP_AND_APPROVAL, AI_ADMIN_EXTERNAL_ID_BACKFILL_TARGET=production, and AI_ADMIN_EXTERNAL_ID_BACKFILL_PRODUCTION_DATABASE_URL exactly matching DATABASE_URL.
7. Backfill writes refuse to run unless strict identifier mode, v2-reader acknowledgement, encrypted-queue enablement, webhook and queue worker drain acknowledgements, and the exact target-specific DATABASE_URL binding are all present. Connection URLs are never logged.
8. Reconcile row counts and exception records. Do not remove the legacy column/index until zero plaintext rows and approved rollback/restore evidence are verified.

## Remaining risks
- Versioned-key readers and an explicit reader-first write gate are implemented. Actual key rotation, full re-encryption/reindex, retention/deletion/export, verified backup/restore and approved staging evidence remain open.
- Compatibility mode intentionally retains plaintext identifiers until strict cutover and historical backfill. RB-029 remains OPEN / P0.

## Evidence boundary
Candidate source code only. No staging/production database query, migration, backfill, worker drain, key rotation, provider operation or backup/restore operation was run.
