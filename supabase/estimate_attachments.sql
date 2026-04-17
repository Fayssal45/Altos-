-- ============================================================
-- MIGRATION : Pièces jointes devis (photos & vidéos)
-- Exécuter dans l'éditeur SQL de Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS estimate_attachments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  estimate_id   UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  file_type     TEXT NOT NULL DEFAULT 'photo', -- photo | video
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estimate_attachments_estimate
  ON estimate_attachments(estimate_id, sort_order);

ALTER TABLE estimate_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estimate_attachments_own" ON estimate_attachments FOR ALL
  USING (
    estimate_id IN (
      SELECT id FROM estimates WHERE business_id = get_user_business_id()
    )
  )
  WITH CHECK (
    estimate_id IN (
      SELECT id FROM estimates WHERE business_id = get_user_business_id()
    )
  );

-- Bucket storage
INSERT INTO storage.buckets (id, name, public)
  VALUES ('estimate-attachments', 'estimate-attachments', true)
  ON CONFLICT DO NOTHING;

-- Storage RLS
CREATE POLICY "estimate_attachments_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'estimate-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "estimate_attachments_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'estimate-attachments');

CREATE POLICY "estimate_attachments_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'estimate-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
