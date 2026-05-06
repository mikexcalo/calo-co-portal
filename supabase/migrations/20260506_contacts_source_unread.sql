-- ============================================================================
-- Add source and unread columns to contacts
-- source: tracks where the contact came from (e.g. 'calo-co-site-contact-form')
-- unread: true for new leads, false once viewed in Helm
-- ============================================================================

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS unread boolean NOT NULL DEFAULT true;

-- Set all existing contacts to read so they don't flood the dashboard
UPDATE contacts SET unread = false WHERE unread = true;
