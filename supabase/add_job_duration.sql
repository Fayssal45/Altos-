-- Migration: ajouter la durée estimée aux chantiers
-- À exécuter dans Supabase SQL Editor

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS estimated_hours numeric(5,2);

COMMENT ON COLUMN jobs.estimated_hours IS 'Durée estimée en heures (ex: 4 = demi-journée, 8 = journée, 24 = 3 jours)';
