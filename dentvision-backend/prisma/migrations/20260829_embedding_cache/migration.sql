-- Content-addressed cache of text embeddings. float8[] rather than a pgvector
-- column: no extension is required, and the corpus here is clinic-sized, so
-- ranking happens in application code over a narrowed candidate set.
CREATE TABLE IF NOT EXISTS "embedding_cache" (
  "id"        TEXT NOT NULL,
  "hash"      TEXT NOT NULL,
  "model"     TEXT NOT NULL,
  "vector"    DOUBLE PRECISION[] NOT NULL,
  "dimension" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "embedding_cache_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "embedding_cache_hash_key" ON "embedding_cache"("hash");
CREATE INDEX IF NOT EXISTS "embedding_cache_model_idx" ON "embedding_cache"("model");
