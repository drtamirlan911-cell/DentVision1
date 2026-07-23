-- AI Memory table for persistent agent memories
CREATE TABLE IF NOT EXISTS ai_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  clinic_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, clinic_id, key)
);

CREATE INDEX IF NOT EXISTS idx_ai_memory_user_clinic ON ai_memory(user_id, clinic_id);
CREATE INDEX IF NOT EXISTS idx_ai_memory_scope ON ai_memory(user_id, clinic_id, key);
