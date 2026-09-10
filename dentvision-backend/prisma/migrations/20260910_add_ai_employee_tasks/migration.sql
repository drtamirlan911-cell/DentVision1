-- Durable AI Employee work queue.
-- Intentionally no foreign keys: task history must survive deletion/retention of
-- the source user/event and can be deployed independently of the legacy schema.
CREATE TABLE IF NOT EXISTS ai_employee_tasks (
  id UUID PRIMARY KEY,
  clinic_id TEXT NOT NULL,
  user_id TEXT,
  role VARCHAR(32) NOT NULL,
  employee_title VARCHAR(120) NOT NULL,
  title VARCHAR(240) NOT NULL,
  description TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  risk VARCHAR(16) NOT NULL DEFAULT 'low',
  autonomy VARCHAR(32) NOT NULL,
  source_event_id TEXT,
  source_event_type VARCHAR(80),
  action VARCHAR(120),
  action_payload JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  error TEXT,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ai_employee_tasks_clinic_status_idx
  ON ai_employee_tasks (clinic_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_employee_tasks_clinic_role_idx
  ON ai_employee_tasks (clinic_id, role, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_employee_tasks_source_event_idx
  ON ai_employee_tasks (source_event_id);
