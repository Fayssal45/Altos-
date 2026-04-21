-- ============================================================
-- ALTOS — Module Commercial
-- Run once in Supabase SQL editor
-- ============================================================

-- ── Extend businesses with commercial config ─────────────────────────────────
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS google_review_url      text,
  ADD COLUMN IF NOT EXISTS review_auto_trigger    text DEFAULT 'none',   -- none | job_close | invoice_paid | both
  ADD COLUMN IF NOT EXISTS visibility_checklist   jsonb DEFAULT '{}';    -- { "hours": true, "zone": false, ... }

-- ── Project showcases (before / after gallery) ───────────────────────────────
CREATE TABLE IF NOT EXISTS project_showcases (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_id       uuid REFERENCES jobs(id) ON DELETE SET NULL,
  title        text NOT NULL DEFAULT '',
  description  text,
  before_url   text,
  after_url    text,
  tags         text[] DEFAULT '{}',
  is_published boolean DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_showcases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "showcase_owner_all" ON project_showcases
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- ── Review requests tracking ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id    uuid REFERENCES clients(id) ON DELETE SET NULL,
  estimate_id  uuid REFERENCES estimates(id) ON DELETE SET NULL,
  channel      text NOT NULL DEFAULT 'whatsapp',  -- whatsapp | sms | email
  sent_at      timestamptz NOT NULL DEFAULT now(),
  clicked_at   timestamptz,
  obtained_at  timestamptz
);

ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_owner_all" ON review_requests
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- ── Supabase Storage bucket (create manually in dashboard if not via SQL) ────
-- INSERT INTO storage.buckets (id, name, public) VALUES ('showcase-photos', 'showcase-photos', true)
-- ON CONFLICT DO NOTHING;
