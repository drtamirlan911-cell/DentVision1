-- Knowledge Base articles table for RAG
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  source TEXT,
  embedding FLOAT8[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ka_category ON knowledge_articles(category);
CREATE INDEX IF NOT EXISTS idx_ka_tags ON knowledge_articles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_ka_created ON knowledge_articles(created_at DESC);
