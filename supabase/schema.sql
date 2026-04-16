-- ============================================================
-- ALTOS – Schéma Supabase complet avec RLS
-- Exécuter dans l'éditeur SQL de Supabase
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES – Lié aux utilisateurs Supabase Auth
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger : crée automatiquement un profil à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. BUSINESSES – L'entreprise de l'artisan
-- ============================================================
CREATE TABLE IF NOT EXISTS businesses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  logo_url    TEXT,
  activity    TEXT,               -- ex: "Électricien", "Plombier"
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  vat_number  TEXT,               -- Numéro TVA intracommunautaire
  siret       TEXT,               -- SIRET (France)
  iban        TEXT,               -- Pour les mentions sur devis
  payment_terms TEXT DEFAULT '30 jours',
  vat_regime  TEXT DEFAULT 'normal', -- normal | micro | none
  stripe_account_id TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. CLIENTS – Répertoire clients (CRM)
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  company_name  TEXT,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  city          TEXT,
  postal_code   TEXT,
  notes         TEXT,
  tags          TEXT[],
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. ESTIMATES – Devis
-- ============================================================
CREATE TABLE IF NOT EXISTS estimates (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id           UUID REFERENCES clients(id) ON DELETE SET NULL,
  number              TEXT,           -- ex: "DEV-2024-001"
  version             INTEGER DEFAULT 1,
  status              TEXT NOT NULL DEFAULT 'draft',
  -- statuts: draft | sent | viewed | accepted | declined | invoiced | paid | archived
  title               TEXT,           -- Titre du chantier
  total_amount_ht     DECIMAL(10,2) DEFAULT 0,
  vat_rate            DECIMAL(5,2) DEFAULT 20.0,
  discount            DECIMAL(10,2) DEFAULT 0,
  discount_type       TEXT DEFAULT 'amount', -- amount | percent
  notes               TEXT,           -- Notes internes
  client_notes        TEXT,           -- Notes visibles par le client
  payment_terms       TEXT,
  validity_days       INTEGER DEFAULT 30,
  -- Tracking & partage
  share_token         TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  viewed_at           TIMESTAMPTZ,
  viewed_count        INTEGER DEFAULT 0,
  -- Signature
  signed_at           TIMESTAMPTZ,
  signature_svg       TEXT,
  signed_by_name      TEXT,
  signed_by_ip        TEXT,
  -- Paiement
  stripe_payment_intent_id TEXT,
  stripe_payment_link TEXT,
  paid_at             TIMESTAMPTZ,
  -- Dates
  issued_at           TIMESTAMPTZ DEFAULT NOW(),
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. ESTIMATE_ITEMS – Lignes de devis
-- ============================================================
CREATE TABLE IF NOT EXISTS estimate_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  estimate_id   UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  quantity      DECIMAL(10,3) DEFAULT 1,
  unit          TEXT DEFAULT 'u',   -- u, h, m, m², m³, forfait
  unit_price    DECIMAL(10,2) DEFAULT 0,
  discount      DECIMAL(10,2) DEFAULT 0,
  sort_order    INTEGER DEFAULT 0,
  is_section    BOOLEAN DEFAULT FALSE,  -- Ligne de section / titre
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. LIBRARY_ITEMS – Catalogue de prestations (autocomplétion)
-- ============================================================
CREATE TABLE IF NOT EXISTS library_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  unit          TEXT DEFAULT 'u',
  unit_price    DECIMAL(10,2) DEFAULT 0,
  category      TEXT,
  usage_count   INTEGER DEFAULT 0,  -- Pour trier par popularité
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. JOBS – Chantiers
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
  estimate_id     UUID REFERENCES estimates(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'planned',
  -- statuts: planned | in_progress | completed | cancelled
  scheduled_date  TIMESTAMPTZ,
  completed_date  TIMESTAMPTZ,
  address         TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. JOB_PHOTOS – Photos avant/après chantier
-- ============================================================
CREATE TABLE IF NOT EXISTS job_photos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  storage_path TEXT,
  type        TEXT DEFAULT 'before',  -- before | after | progress
  caption     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. REMINDERS – Relances automatiques
-- ============================================================
CREATE TABLE IF NOT EXISTS reminders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  estimate_id   UUID REFERENCES estimates(id) ON DELETE CASCADE,
  client_id     UUID REFERENCES clients(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  -- types: quote_followup | unpaid | maintenance | custom
  status        TEXT DEFAULT 'pending', -- pending | sent | dismissed
  scheduled_at  TIMESTAMPTZ,
  last_sent_at  TIMESTAMPTZ,
  message       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES – Performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_businesses_owner ON businesses(owner_id);
CREATE INDEX IF NOT EXISTS idx_clients_business ON clients(business_id);
CREATE INDEX IF NOT EXISTS idx_estimates_business ON estimates(business_id);
CREATE INDEX IF NOT EXISTS idx_estimates_client ON estimates(client_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimates_share_token ON estimates(share_token);
CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate ON estimate_items(estimate_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_library_items_business ON library_items(business_id);
CREATE INDEX IF NOT EXISTS idx_library_items_search ON library_items USING gin(to_tsvector('french', description));
CREATE INDEX IF NOT EXISTS idx_jobs_business ON jobs(business_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_job_photos_job ON job_photos(job_id);
CREATE INDEX IF NOT EXISTS idx_reminders_business ON reminders(business_id);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- BUSINESSES
CREATE POLICY "businesses_own" ON businesses FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Helper function : retourne le business_id de l'utilisateur connecté
CREATE OR REPLACE FUNCTION get_user_business_id()
RETURNS UUID AS $$
  SELECT id FROM businesses WHERE owner_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- CLIENTS
CREATE POLICY "clients_own" ON clients FOR ALL
  USING (business_id = get_user_business_id())
  WITH CHECK (business_id = get_user_business_id());

-- ESTIMATES
CREATE POLICY "estimates_own" ON estimates FOR ALL
  USING (business_id = get_user_business_id())
  WITH CHECK (business_id = get_user_business_id());

-- ESTIMATE (public read via share_token – pas de RLS sur SELECT pour ce cas)
-- On gère l'accès public via une API Route sécurisée (service role)

-- ESTIMATE_ITEMS
CREATE POLICY "estimate_items_own" ON estimate_items FOR ALL
  USING (
    estimate_id IN (SELECT id FROM estimates WHERE business_id = get_user_business_id())
  )
  WITH CHECK (
    estimate_id IN (SELECT id FROM estimates WHERE business_id = get_user_business_id())
  );

-- LIBRARY_ITEMS
CREATE POLICY "library_items_own" ON library_items FOR ALL
  USING (business_id = get_user_business_id())
  WITH CHECK (business_id = get_user_business_id());

-- JOBS
CREATE POLICY "jobs_own" ON jobs FOR ALL
  USING (business_id = get_user_business_id())
  WITH CHECK (business_id = get_user_business_id());

-- JOB_PHOTOS
CREATE POLICY "job_photos_own" ON job_photos FOR ALL
  USING (
    job_id IN (SELECT id FROM jobs WHERE business_id = get_user_business_id())
  )
  WITH CHECK (
    job_id IN (SELECT id FROM jobs WHERE business_id = get_user_business_id())
  );

-- REMINDERS
CREATE POLICY "reminders_own" ON reminders FOR ALL
  USING (business_id = get_user_business_id())
  WITH CHECK (business_id = get_user_business_id());

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

-- Logos entreprise
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true) ON CONFLICT DO NOTHING;
-- Photos chantiers
INSERT INTO storage.buckets (id, name, public) VALUES ('job-photos', 'job-photos', true) ON CONFLICT DO NOTHING;

-- Storage RLS
CREATE POLICY "logos_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');
CREATE POLICY "logos_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');
CREATE POLICY "logos_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "job_photos_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'job-photos' AND auth.role() = 'authenticated');
CREATE POLICY "job_photos_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'job-photos');
CREATE POLICY "job_photos_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'job-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- FUNCTIONS UTILITAIRES
-- ============================================================

-- Génère un numéro de devis automatique (ex: DEV-2024-042)
CREATE OR REPLACE FUNCTION generate_estimate_number(p_business_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_year TEXT := TO_CHAR(NOW(), 'YYYY');
  v_count INTEGER;
  v_number TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM estimates
  WHERE business_id = p_business_id
    AND TO_CHAR(created_at, 'YYYY') = v_year;

  v_number := 'DEV-' || v_year || '-' || LPAD(v_count::TEXT, 3, '0');
  RETURN v_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Met à jour le total_amount_ht d'un devis automatiquement
CREATE OR REPLACE FUNCTION update_estimate_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE estimates
  SET
    total_amount_ht = (
      SELECT COALESCE(SUM(quantity * unit_price * (1 - discount/100)), 0)
      FROM estimate_items
      WHERE estimate_id = COALESCE(NEW.estimate_id, OLD.estimate_id)
        AND is_section = FALSE
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.estimate_id, OLD.estimate_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_estimate_total
  AFTER INSERT OR UPDATE OR DELETE ON estimate_items
  FOR EACH ROW EXECUTE FUNCTION update_estimate_total();

-- Mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_estimates_updated_at BEFORE UPDATE ON estimates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_library_items_updated_at BEFORE UPDATE ON library_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
