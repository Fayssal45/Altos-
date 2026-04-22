-- ── Catalogue types migration ────────────────────────────────────────────────
-- Adds: type + pack_items to library_items
--       item_type to estimate_items

ALTER TABLE library_items
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'service'
    CHECK (type IN ('service', 'product', 'pack'));

ALTER TABLE library_items
  ADD COLUMN IF NOT EXISTS pack_items JSONB DEFAULT '[]';

-- Back-fill existing records:
-- items with labour categories → service (already the default)
-- items with material categories → product
UPDATE library_items
SET type = 'product'
WHERE category IN ('Matériaux', 'Fournitures')
  AND type = 'service';

-- item_type per estimate line (null = unclassified / manual)
ALTER TABLE estimate_items
  ADD COLUMN IF NOT EXISTS item_type TEXT
    CHECK (item_type IS NULL OR item_type IN ('service', 'product'));
