/*
  A licence number, and a deposit that is a decision rather than a constant.

  LICENCE

  Lives in settings alongside phone and address, which is where the business's
  own facts already live. No column, because it is one optional string and
  orgs.settings is already the place for those. Shown on a document only when
  somebody filled it in - the approved mock has "[LICENSE NO.]" in the header
  and that bracketed text must never reach a customer.

  DEPOSIT

  Two levels, on purpose. The workspace holds what this business usually asks
  for; the estimate holds what THIS proposal asks for, copied from the
  workspace when the proposal is built and free to differ afterwards. Same
  shape as terms: the default is a starting point, and the record is what was
  actually offered.

  Stored as kind + value rather than a resolved amount, because a percentage
  has to survive the total changing while somebody is still editing. The
  amount is worked out where it is shown.
*/

alter table public.estimates
  add column if not exists deposit_kind text not null default 'none',
  add column if not exists deposit_value numeric not null default 0;

alter table public.estimates
  drop constraint if exists estimates_deposit_kind_check;

alter table public.estimates
  add constraint estimates_deposit_kind_check
  check (deposit_kind = any (array['none'::text, 'percent'::text, 'fixed'::text]));

alter table public.estimates
  drop constraint if exists estimates_deposit_value_check;

alter table public.estimates
  add constraint estimates_deposit_value_check
  check (
    deposit_value >= 0
    and (deposit_kind <> 'percent' or deposit_value <= 100)
    and (deposit_kind = 'none' or deposit_value > 0)
  );

comment on column public.estimates.deposit_kind is
  'none, percent or fixed. Copied from the workspace default when the proposal is built, and the proposal''s own from then on.';

comment on column public.estimates.deposit_value is
  'A percentage when kind is percent, an amount when kind is fixed, and 0 when none. The money is worked out where it is shown, so a percentage survives the total changing.';

/*
  Which invoice came out of accepting.

  Without it, a second accept - or a retry after a timeout - would draft a
  second deposit invoice for the same money, and the business would find two
  in the list with no way to tell which was real.
*/
alter table public.estimates
  add column if not exists deposit_invoice_id uuid references public.job_invoices(id) on delete set null;

comment on column public.estimates.deposit_invoice_id is
  'The draft invoice created when this was accepted. Present means it has already been drafted; accepting again must not draft another.';

/* ── Harbor Light: a licence and a 30% deposit. Demo only. ─────────────── */
update public.orgs set settings = settings
  || jsonb_build_object(
       'license_no', 'TX RCL-114862',
       'deposit', jsonb_build_object('kind', 'percent', 'value', 30)
     )
  where name = 'Harbor Light Roofing' and is_demo;

/* The proposal already out there asks for it too, as if it had been built
   after the setting existed. */
update public.estimates e
set deposit_kind = 'percent', deposit_value = 30
from public.orgs o
where o.id = e.org_id
  and o.name = 'Harbor Light Roofing' and o.is_demo
  and e.status = 'sent'
  and e.total = 24680
  and e.deposit_kind = 'none';

/*
  Tideline gets neither, deliberately. Two demo businesses, two states, and
  the one that matters more is the one where the page has to show nothing at
  all.
*/
