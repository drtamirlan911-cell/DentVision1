CREATE TABLE IF NOT EXISTS ai_admin_messages (
  id UUID PRIMARY KEY,
  channel VARCHAR(32) NOT NULL,
  channel_account_id TEXT NOT NULL,
  external_message_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (channel, external_message_id)
);

CREATE INDEX IF NOT EXISTS ai_admin_messages_pending_idx
  ON ai_admin_messages (created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS ai_admin_messages_processing_idx
  ON ai_admin_messages (updated_at)
  WHERE status = 'processing';
