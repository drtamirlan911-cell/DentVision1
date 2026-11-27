-- Durable AI Employee retry idempotency.
-- Preserve all existing task rows: legacy rows receive a stable per-row key.
-- New event tasks use a deterministic tenant-bound key from the service.
ALTER TABLE ai_employee_tasks
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

UPDATE ai_employee_tasks
SET idempotency_key = 'legacy:' || id::text
WHERE idempotency_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ai_employee_tasks_idempotency_key_uidx
  ON ai_employee_tasks (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
