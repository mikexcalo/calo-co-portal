-- A client cannot switch on their own modules.
--
-- orgs_admin_update lets any owner or admin of a workspace update that
-- workspace's row, which is right for the name, the tax rate and the review
-- link. Two columns on that row are not settings, they are the commercial
-- agreement: `modules` is what they have been sold and `plan` is what they pay.
-- The moment a client is made an owner of their own workspace, and that is the
-- point of giving them one, they can grant themselves every module in the
-- product and downgrade their plan while they are in there.
--
-- Nobody has exploited this because Mark is a member rather than an owner and
-- John has not been invited yet. That is timing, not a control.
--
-- WHY A TRIGGER AND NOT A POLICY
--
-- Row level security decides which rows you may write, never which columns. The
-- alternatives are splitting the commercial columns into their own table, which
-- rewrites every read of orgs, or refusing the write when those columns change.
-- The second is smaller and says the rule in one place.

create or replace function orgs_guard_commercial_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  agency uuid;
begin
  -- Everything except the two commercial columns is theirs to change.
  if new.modules is not distinct from old.modules
     and new.plan is not distinct from old.plan then
    return new;
  end if;

  -- No signed-in user means the service role or a migration, both of which are
  -- server side and already able to do anything. Guarding them would only break
  -- provisioning.
  if auth.uid() is null then
    return new;
  end if;

  -- Who provisioned this workspace: the agency holding a client record that
  -- points at it. Derived rather than stored, so it cannot drift out of step
  -- with the link Access already reads and writes.
  select c.org_id into agency
    from customers c
   where c.workspace_id = old.id
   limit 1;

  -- A business nobody provisioned came to this on its own and owns its own
  -- commercial terms. Only a workspace handed to somebody is constrained.
  if agency is null then
    return new;
  end if;

  if exists (
    select 1 from memberships m
     where m.user_id = auth.uid()
       and m.org_id = agency
       and m.role in ('owner', 'admin')
  ) then
    return new;
  end if;

  raise exception
    'Modules and plan are set by the agency that set this workspace up, not from inside it.'
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists orgs_commercial_columns on orgs;
create trigger orgs_commercial_columns
  before update on orgs
  for each row
  execute function orgs_guard_commercial_columns();

comment on function orgs_guard_commercial_columns() is
  'Modules and plan are the commercial agreement, not a workspace setting. Only an owner or admin of the agency that provisioned the workspace may change them.';
