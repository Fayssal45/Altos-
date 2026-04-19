-- ============================================================
-- Migration: accounting_config
-- Adds billing mode, Peppol config, accounting email,
-- accounting provider selection, and the integrations table.
--
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- ── 1. Extend businesses table ─────────────────────────────────────────────

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS billing_mode          TEXT NOT NULL DEFAULT 'pdf'
    CHECK (billing_mode IN ('pdf', 'peppol', 'both')),

  ADD COLUMN IF NOT EXISTS accounting_email      TEXT,            -- CC to accountant on every invoice

  ADD COLUMN IF NOT EXISTS peppol_address        TEXT,            -- e.g. "0208:0636123456" (BE format)
  ADD COLUMN IF NOT EXISTS peppol_enabled        BOOLEAN NOT NULL DEFAULT false,

  -- Which tool the user has selected (1 primary at a time).
  -- The full connection config lives in business_integrations.
  ADD COLUMN IF NOT EXISTS accounting_provider   TEXT
    CHECK (accounting_provider IN ('odoo','exact','yuki','accountable','billit','other'));


-- ── 2. Create business_integrations table ──────────────────────────────────
--
-- Stores per-provider pre-configuration even before a real
-- API connection is implemented.  When a connector is built,
-- it reads provider + config and writes connected_at / last_sync_at.

CREATE TABLE IF NOT EXISTS business_integrations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider         TEXT        NOT NULL
    CHECK (provider IN ('odoo','exact','yuki','accountable','billit','other')),

  -- Lifecycle: pending → configured → active   (or error at any step)
  status           TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','configured','active','error')),

  -- Arbitrary key/value pre-config (instance URL, company code, GLN, …).
  -- Sensitive secrets (API keys, OAuth tokens) must NEVER be stored here
  -- in plaintext — they will be handled via Supabase Vault once connectors
  -- are implemented.
  config           JSONB       NOT NULL DEFAULT '{}',

  display_name     TEXT,        -- for provider = 'other': user-provided tool name
  notes            TEXT,        -- free notes

  connected_at     TIMESTAMPTZ, -- set by the connector when OAuth / API key is validated
  last_sync_at     TIMESTAMPTZ, -- set by the connector on each successful sync

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One record per provider per business
  UNIQUE(business_id, provider)
);


-- ── 3. Row-Level Security ──────────────────────────────────────────────────

ALTER TABLE business_integrations ENABLE ROW LEVEL SECURITY;

-- Owners can read and write their own integration records
CREATE POLICY "owner_select" ON business_integrations
  FOR SELECT USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "owner_insert" ON business_integrations
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "owner_update" ON business_integrations
  FOR UPDATE USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "owner_delete" ON business_integrations
  FOR DELETE USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );


-- ── 4. Auto-update updated_at ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER business_integrations_updated_at
  BEFORE UPDATE ON business_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
