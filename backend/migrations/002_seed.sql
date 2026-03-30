-- 002_seed.sql — 動作確認用初期データ（冪等: ON CONFLICT でスキップ）

INSERT INTO documents (id, slug, title, description)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'terms-of-service',
  '利用規約',
  'サービス利用に関する規約'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO document_versions (document_id, content, diff_summary, status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  E'# 利用規約\n\n本サービスをご利用の前に、以下の利用規約をお読みください。',
  '初版作成',
  'published'
)
ON CONFLICT (document_id, version_number) DO NOTHING;
