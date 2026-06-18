-- Step 2 of 2: Enable RLS on clients, contacts, notes, tasks. (v2 — WITH CHECK added)
-- Admin sees all. Client sees only their own client_id rows.
-- No client writes yet — SELECT only for client role.

-- ═══════════════════════════════════════════════════════════════
-- Helper: returns the logged-in user's role from profiles
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    'client'
  );
$$;

-- Helper: returns the logged-in user's client_id from profiles
CREATE OR REPLACE FUNCTION public.user_client_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ═══════════════════════════════════════════════════════════════
-- CLIENTS table
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "admin_all_clients" ON public.clients
  FOR ALL USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- Client: read own row only (clients.id = their client_id)
CREATE POLICY "client_read_own" ON public.clients
  FOR SELECT USING (
    public.user_role() = 'client'
    AND id = public.user_client_id()
  );

-- ═══════════════════════════════════════════════════════════════
-- CONTACTS table
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "admin_all_contacts" ON public.contacts
  FOR ALL USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- Client: read contacts belonging to their client
CREATE POLICY "client_read_own_contacts" ON public.contacts
  FOR SELECT USING (
    public.user_role() = 'client'
    AND client_id = public.user_client_id()
  );

-- ═══════════════════════════════════════════════════════════════
-- NOTES table
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "admin_all_notes" ON public.notes
  FOR ALL USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- Client: read notes belonging to their client
CREATE POLICY "client_read_own_notes" ON public.notes
  FOR SELECT USING (
    public.user_role() = 'client'
    AND client_id = public.user_client_id()
  );

-- ═══════════════════════════════════════════════════════════════
-- TASKS table
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "admin_all_tasks" ON public.tasks
  FOR ALL USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- Client: read tasks belonging to their client
CREATE POLICY "client_read_own_tasks" ON public.tasks
  FOR SELECT USING (
    public.user_role() = 'client'
    AND client_id = public.user_client_id()
  );
