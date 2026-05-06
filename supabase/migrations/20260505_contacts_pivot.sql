-- ============================================================================
-- Contacts Pivot — make client_id optional, expand kind enum
-- Reversible: uses ALTER TABLE only, no DROP/RECREATE
-- ============================================================================

-- 1. Drop the existing kind check constraint and replace with expanded values
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_kind_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_kind_check
  CHECK (kind IN ('lead', 'prospect', 'client_contact', 'vendor', 'talent', 'friend'));

-- 2. client_id is already nullable from Brief 1 (REFERENCES clients(id) ON DELETE SET NULL)
-- No ALTER needed — verify with: SELECT is_nullable FROM information_schema.columns
-- WHERE table_name = 'contacts' AND column_name = 'client_id';
