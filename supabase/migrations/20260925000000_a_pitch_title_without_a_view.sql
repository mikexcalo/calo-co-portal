-- The tab on every pitch says "Pitch".
--
-- generateMetadata calls read_pitch(token) but the function is
-- read_pitch(is_mobile, token), so PostgREST cannot resolve it, the call
-- 404s, the catch swallows it and the fallback title is used. No pitch has
-- ever shown the business's name in the browser tab or in a shared link.
--
-- The obvious fix — pass is_mobile — is wrong. read_pitch inserts a row into
-- pitch_views and increments pitches.views, because its job is to record that
-- somebody read the thing. Calling it from the metadata pass as well would
-- count every open twice, and read tracking is one of the parts of this
-- product that works.
--
-- So: a second function that answers the question metadata actually has —
-- what is this called and who is it from — and records nothing.

create or replace function public.pitch_heading(token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('title', p.title, 'org', o.name)
    from public.pitches p
    join public.orgs o on o.id = p.org_id
   where p.public_token = token
     and p.published_at is not null
     and p.archived = false;
$$;

grant execute on function public.pitch_heading(text) to anon, authenticated;

comment on function public.pitch_heading(text) is
  'Title and sender for a published pitch, for page metadata. Records no '
  'view - read_pitch is what counts a read, and calling that twice per open '
  'is how view counts double.';
