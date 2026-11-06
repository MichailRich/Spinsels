-- Optioneel: semantisch zoeken met pgvector. Wordt alleen toegepast als de
-- extensie beschikbaar is (zie scripts/migrate.ts).
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS document_embeddings (
  ecli       text NOT NULL REFERENCES documents(ecli) ON DELETE CASCADE,
  chunk      text NOT NULL,                 -- 'motivering' | 'bewezenverklaring' | 'samenvatting'
  model      text NOT NULL,
  embedding  vector(1024) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ecli, chunk, model)
);
