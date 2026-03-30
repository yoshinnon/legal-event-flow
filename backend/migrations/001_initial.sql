-- 001_initial.sql — documents / document_versions テーブル作成
-- IF NOT EXISTS で冪等性を保証

CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        VARCHAR(50)  UNIQUE NOT NULL,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number SERIAL,
  content        TEXT NOT NULL,
  diff_summary   TEXT,
  status         VARCHAR(20) DEFAULT 'published'
                   CHECK (status IN ('draft', 'published')),
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_document_id
  ON document_versions(document_id);

CREATE INDEX IF NOT EXISTS idx_doc_versions_status_created
  ON document_versions(document_id, status, created_at DESC);
