/*
  A draft proposal from a studio to a client who has a workspace.

  Nothing in the demo was in this shape, which is why the draft leak in
  `estimates_client_read` was latent: the policy allowed it and no row
  exercised it. Northwind drafts one for Harbor Light here so the fix can be
  shown working rather than argued for.

  Draft, never sent, no public token. Demo only.
*/

insert into public.estimates (org_id, job_id, version, status, total, base_total, notes)
select '912fe1dc-5b79-4f6f-b954-761fc4111f1d',
       'bd6f5ebf-391b-41b4-a224-d65b24f32762',
       1, 'draft', 2400, 2400,
       'Draft only. Second phase, not priced up yet.'
 where not exists (
   select 1 from public.estimates
    where job_id = 'bd6f5ebf-391b-41b4-a224-d65b24f32762' and status = 'draft'
 );
