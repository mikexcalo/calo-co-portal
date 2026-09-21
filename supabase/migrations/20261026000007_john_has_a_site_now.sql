-- The "Your site" button in the top bar reads client_sites, so a business with
-- no row there has no button — which is why Mammoth had one and Global Seafood
-- did not. John's domain is live now, so the row exists.

insert into public.client_sites (org_id, name, url, vercel_project)
select '11acc27d-54bc-40a1-a759-83eb04f486c6',
       'Global Seafood Partners',
       'https://globalseafood.partners',
       'global-seafood-site'
where not exists (
  select 1 from public.client_sites
   where org_id = '11acc27d-54bc-40a1-a759-83eb04f486c6'
);

insert into public.notifications (org_id, kind, title, body)
values (
  '11acc27d-54bc-40a1-a759-83eb04f486c6',
  'system',
  'Your site is live',
  'The two records you added worked. globalseafood.partners is up, and www goes to the same place.

There is a "Your site" button at the top of this screen that opens it.

What is there now is a holding page — your name, what you do, and an email address. It is deliberately plain so there is something real at the address while we build the proper one. Nothing on it is final, so tell us what is wrong with it.

One thing worth deciding soon: whether you want email on this domain, so you can be john@globalseafood.partners rather than a gmail address. That is a separate setup and we can do it whenever you are ready.'
)
on conflict do nothing;
