-- ============================================================================
-- KNOWING WHICH SIGN WORKED
-- ============================================================================
-- A QR code printed on a yard sign and the same code printed on a postcard
-- are indistinguishable once they are in the world. Both send people to the
-- website, and afterwards nobody can say which one paid for itself.
--
-- The usual answer is to bolt ?utm_source=yard-sign onto the address and read
-- it out of a web analytics dashboard later. That works if you already run
-- analytics, already know what UTM means, and remember to go and look. For a
-- contractor with a stack of postcards, none of that is true.
--
-- So a code points at a short address here, which records the scan and then
-- forwards to wherever it was going. The count lives in the same app as the
-- invoices, next to the question it answers.
--
-- WHAT IS NOT COLLECTED: no IP addresses, no cookies, no device
-- fingerprinting, nothing that identifies a person. A count, a date, and
-- whether it came from a phone. Enough to answer "did the postcards work",
-- and not enough to be a privacy problem or to need a consent banner.
-- ============================================================================

create table if not exists public.qr_campaigns (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  -- The short, unguessable path segment printed inside the code.
  code         text not null unique,
  label        text not null,
  destination  text not null,
  -- Where it was printed: yard sign, postcard, van, business card.
  medium       text,
  scans        integer not null default 0,
  last_scan_at timestamptz,
  archived     boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists qr_campaigns_org_idx  on public.qr_campaigns(org_id);
create index if not exists qr_campaigns_code_idx on public.qr_campaigns(code);

alter table public.qr_campaigns enable row level security;

drop policy if exists qr_campaigns_own on public.qr_campaigns;
create policy qr_campaigns_own on public.qr_campaigns
  for all to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- ---------------------------------------------------------------------------
-- One row per scan, so "twelve scans" can become "twelve scans, mostly the
-- Saturday after the mailer landed" — which is the version that tells you
-- something.
-- ---------------------------------------------------------------------------

create table if not exists public.qr_scans (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references qr_campaigns(id) on delete cascade,
  scanned_at  timestamptz not null default now(),
  -- 'mobile' or 'desktop'. Deliberately the coarsest useful signal rather
  -- than a user-agent string, which is a fingerprint.
  device      text
);

create index if not exists qr_scans_campaign_idx on public.qr_scans(campaign_id, scanned_at desc);

alter table public.qr_scans enable row level security;

drop policy if exists qr_scans_own on public.qr_scans;
create policy qr_scans_own on public.qr_scans
  for select to authenticated
  using (exists (
    select 1 from qr_campaigns c
    where c.id = qr_scans.campaign_id and c.org_id = current_org_id()
  ));

-- ---------------------------------------------------------------------------
-- Recording a scan.
--
-- SECURITY DEFINER because the person scanning is not signed in and must not
-- be able to read anything. It takes a code, writes a scan, and returns only
-- the destination — no org, no label, no counts.
--
-- Archived campaigns still forward. A code on a sign in somebody's front yard
-- cannot be recalled, and a dead link is a worse outcome than an
-- uncounted scan.
-- ---------------------------------------------------------------------------

create or replace function public.record_qr_scan(scan_code text, is_mobile boolean)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  target record;
begin
  select id, destination into target
    from qr_campaigns
   where code = scan_code;

  if not found then
    return null;
  end if;

  insert into qr_scans (campaign_id, device)
  values (target.id, case when is_mobile then 'mobile' else 'desktop' end);

  update qr_campaigns
     set scans = scans + 1,
         last_scan_at = now()
   where id = target.id;

  return target.destination;
end;
$function$;

grant execute on function public.record_qr_scan(text, boolean) to anon, authenticated;

comment on function public.record_qr_scan is
  'Counts a scan and returns where to forward to. Runs for anonymous visitors and deliberately returns nothing but the destination.';
