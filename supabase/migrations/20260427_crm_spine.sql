-- ============================================================================
-- CRM Spine Migration
-- Adds lifecycle_stage to clients, plus contacts, notes, tasks, events tables.
-- All tables use polymorphic FKs (client_id OR contact_id) where applicable
-- to avoid duplicate UI components for the activity timeline.
-- ============================================================================

-- 1. Lifecycle stage on existing clients table
ALTER TABLE clients
  ADD COLUMN lifecycle_stage text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_stage IN ('lead', 'active', 'paused', 'churned'));

-- 2. Contacts table (people — clients-attached or standalone)
CREATE TABLE contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- identity
  name        text NOT NULL,
  email       text,
  phone       text,
  avatar_url  text,

  -- categorization
  kind        text NOT NULL DEFAULT 'network'
    CHECK (kind IN ('client_contact', 'prospect', 'vendor', 'network', 'other')),
  tags        text[] NOT NULL DEFAULT '{}',

  -- optional client link (null = standalone)
  client_id           uuid REFERENCES clients(id) ON DELETE SET NULL,
  role                text,
  is_primary_contact  boolean NOT NULL DEFAULT false,
  is_billing_contact  boolean NOT NULL DEFAULT false,

  -- context fields (mostly for non-client contacts)
  context         text,
  met_at_date     date,
  met_at_location text,

  -- links: array of {label, url} objects
  links           jsonb NOT NULL DEFAULT '[]',

  -- forward-compat extension, mirrors clients.brand_builder_fields pattern
  custom_fields   jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX contacts_client_id_idx ON contacts(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX contacts_kind_idx      ON contacts(kind);
CREATE INDEX contacts_tags_idx      ON contacts USING GIN(tags);

-- 3. Events table (polymorphic: client OR contact)
CREATE TABLE events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  client_id   uuid REFERENCES clients(id)  ON DELETE CASCADE,
  contact_id  uuid REFERENCES contacts(id) ON DELETE CASCADE,

  title       text NOT NULL,
  event_date  date NOT NULL,
  location    text,
  description text,

  source_note_id uuid,  -- FK added after notes table exists, see below

  CONSTRAINT events_has_entity CHECK (client_id IS NOT NULL OR contact_id IS NOT NULL)
);

CREATE INDEX events_client_id_idx  ON events(client_id)  WHERE client_id  IS NOT NULL;
CREATE INDEX events_contact_id_idx ON events(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX events_event_date_idx ON events(event_date);

-- 4. Notes table (polymorphic: client OR contact)
CREATE TABLE notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  client_id   uuid REFERENCES clients(id)  ON DELETE CASCADE,
  contact_id  uuid REFERENCES contacts(id) ON DELETE CASCADE,

  content     text NOT NULL,
  kind        text NOT NULL DEFAULT 'note'
    CHECK (kind IN ('note', 'call', 'meeting', 'email', 'transcript', 'other')),
  pinned      boolean NOT NULL DEFAULT false,

  -- For AI-extracted notes, stores the raw input (transcript text, image OCR, etc.)
  source_raw  text,
  source_kind text
    CHECK (source_kind IN ('manual', 'transcript', 'image', 'voice', 'link', 'other') OR source_kind IS NULL),

  CONSTRAINT notes_has_entity CHECK (client_id IS NOT NULL OR contact_id IS NOT NULL)
);

CREATE INDEX notes_client_id_idx   ON notes(client_id)  WHERE client_id  IS NOT NULL;
CREATE INDEX notes_contact_id_idx  ON notes(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX notes_created_at_idx  ON notes(created_at DESC);

-- 5. Tasks table (polymorphic: client OR contact, optionally anchored to event)
CREATE TABLE tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  client_id     uuid REFERENCES clients(id)  ON DELETE CASCADE,
  contact_id    uuid REFERENCES contacts(id) ON DELETE CASCADE,
  event_id      uuid REFERENCES events(id)   ON DELETE SET NULL,

  title         text NOT NULL,
  due_date      date,
  lead_days     integer,  -- if set with event_id, effective due = event_date - lead_days
  completed_at  timestamptz,

  source_note_id uuid REFERENCES notes(id) ON DELETE SET NULL,

  CONSTRAINT tasks_has_entity CHECK (client_id IS NOT NULL OR contact_id IS NOT NULL)
);

CREATE INDEX tasks_client_open_idx  ON tasks(client_id, due_date)  WHERE completed_at IS NULL AND client_id IS NOT NULL;
CREATE INDEX tasks_contact_open_idx ON tasks(contact_id, due_date) WHERE completed_at IS NULL AND contact_id IS NOT NULL;
CREATE INDEX tasks_event_id_idx     ON tasks(event_id) WHERE event_id IS NOT NULL;

-- 6. Add deferred FK from events.source_note_id to notes(id)
ALTER TABLE events
  ADD CONSTRAINT events_source_note_id_fkey
  FOREIGN KEY (source_note_id) REFERENCES notes(id) ON DELETE SET NULL;

CREATE INDEX events_source_note_id_idx ON events(source_note_id) WHERE source_note_id IS NOT NULL;

-- 7. updated_at triggers (matches existing clients table convention)
-- Reuses moddatetime extension if already enabled; otherwise creates inline trigger function.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_set_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER events_set_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER notes_set_updated_at BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tasks_set_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
