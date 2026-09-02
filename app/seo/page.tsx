'use client';

/**
 * Search, as a thing you work through rather than read about.
 *
 * Everything on this screen is either state, a generated artifact, or a reason
 * something matters. No advice for its own sake, and nothing that costs a
 * model call: the address block, the schema markup and the title tags are all
 * mechanical, which is exactly why hand-copying them is where the mistakes
 * come from.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import {
  DEFAULT_CITATIONS, SEO_TASKS, SETUP_ORDER, gbpDescription, napBlock, schemaMarkup, titleTags,
  type Profile,
} from '@/lib/spine/seo';
import {
  Button, C, Card, Empty, Field, Metric, Page, Pill, SectionLabel, inputStyle,
} from '@/components/spine/ui';

interface TaskRow { key: string; status: 'todo' | 'doing' | 'done' | 'skipped' }
interface Citation { id: string; name: string; url: string | null; status: string; note: string | null }

const csv = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);

export default function SeoPage() {
  const { org } = useOrg();
  /**
   * Whose search this is.
   *
   * Absent means your own. Reached from a client record with ?client=, which
   * keeps one screen rather than building a second copy of it that would then
   * have to be kept in step.
   */
  const clientId = useSearchParams().get('client');
  const [clientName, setClientName] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>({});
  const [tasks, setTasks] = useState<Record<string, TaskRow['status']>>({});
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<string | null>(null);

  /**
   * Null and "no client" are different filters.
   *
   * eq('customer_id', null) matches nothing in PostgREST, so your own profile
   * would silently never load. is() is the one that means null.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scope = useCallback((q: any) => (clientId ? q.eq('customer_id', clientId) : q.is('customer_id', null)), [clientId]);

  const load = useCallback(async () => {
    const o = await supabase.rpc('current_org_id');
    if (!o.data) { setLoading(false); return; }

    if (clientId) {
      const c = await supabase.from('customers').select('name').eq('id', clientId).maybeSingle();
      setClientName(c.data?.name ?? null);
    }

    const [p, t, c] = await Promise.all([
      scope(supabase.from('seo_profile').select('*').eq('org_id', o.data)).maybeSingle(),
      scope(supabase.from('seo_tasks').select('key, status').eq('org_id', o.data)),
      scope(supabase.from('seo_citations').select('*').eq('org_id', o.data)).order('created_at'),
    ]);

    if (p.data) setProfile(p.data as Profile);
    else setEditing(true);   // nothing yet, so open on the form rather than an empty page

    setTasks(Object.fromEntries(((t.data ?? []) as TaskRow[]).map((r) => [r.key, r.status])) as Record<string, TaskRow['status']>);

    // Seeded on first visit so the list is never empty and nobody has to think
    // of the directories themselves.
    if ((c.data ?? []).length === 0) {
      await supabase.from('seo_citations').insert(
        DEFAULT_CITATIONS.map((d) => ({ org_id: o.data, customer_id: clientId, name: d.name, url: d.url, note: d.note }))
      );
      const again = await scope(supabase.from('seo_citations').select('*').eq('org_id', o.data)).order('created_at');
      setCitations((again.data ?? []) as Citation[]);
    } else {
      setCitations((c.data ?? []) as Citation[]);
    }

    setLoading(false);
  }, [clientId, scope]);

  useEffect(() => { load(); }, [load]);

  const saveProfile = async () => {
    const o = await supabase.rpc('current_org_id');
    if (!o.data) return;
    setBusy(true);
    const res = await supabase
      .from('seo_profile')
      .upsert(
        { ...profile, org_id: o.data, customer_id: clientId, updated_at: new Date().toISOString() },
        { onConflict: 'org_id,customer_id' }
      );
    setBusy(false);
    if (!res.error) setEditing(false);
  };

  const setTask = async (key: string, status: TaskRow['status']) => {
    const o = await supabase.rpc('current_org_id');
    if (!o.data) return;
    setTasks((t) => ({ ...t, [key]: status }));
    await supabase.from('seo_tasks').upsert({ org_id: o.data, customer_id: clientId, key, status }, { onConflict: 'org_id,customer_id,key' });
  };

  const setCitation = async (c: Citation, status: string) => {
    setCitations((rows) => rows.map((r) => (r.id === c.id ? { ...r, status } : r)));
    await supabase.from('seo_citations').update({ status }).eq('id', c.id);
  };

  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1600);
  };

  /**
   * Local-only items are hidden for a business that does not serve a place.
   *
   * Service areas and map listings are noise for a software company, and a
   * checklist with irrelevant items on it stops being a checklist.
   */
  const isLocal = org?.kind !== 'agency' || (profile.service_areas ?? []).length > 0;
  const visible = useMemo(
    () => SEO_TASKS.filter((t) => t.applies === 'all' || isLocal),
    [isLocal]
  );

  const done = visible.filter((t) => tasks[t.key] === 'done').length;
  const claimed = citations.filter((c) => c.status === 'claimed' || c.status === 'verified').length;

  if (loading) return <Page title="Search"><Card><Empty>Loading…</Empty></Card></Page>;

  const hasProfile = Boolean(profile.legal_name);

  return (
    <Page
      back={clientId ? { label: clientName ?? 'Client', href: `/customers/${clientId}` } : undefined}
      title={clientName ? `Search for ${clientName}` : 'Search'}
      subtitle="Four levers, three of them admin. This holds the state so it does not get abandoned halfway."
      action={<Button variant="ghost" onClick={() => setEditing((v) => !v)}>{editing ? 'Done' : 'Edit details'}</Button>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 24 }}>
        <Metric label="Checklist" value={`${done} / ${visible.length}`} tone={done === visible.length ? 'green' : undefined} />
        <Metric label="Directories claimed" value={`${claimed} / ${citations.length}`} />
      </div>

      {/* The order, which is not the order the checklist is written in.
          Verification is a postcard, so it starts first and the rest happens
          while it is in the mail. */}
      <div style={{ marginBottom: 26 }}>
        <SectionLabel>Do it in this order</SectionLabel>
        <Card>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SETUP_ORDER.map((s2) => (
              <li key={s2.step} style={{ fontSize: 14.5, color: C.text, lineHeight: 1.5 }}>
                {s2.step}
                <div style={{ fontSize: 13, color: C.faint, marginTop: 3, lineHeight: 1.6 }}>{s2.note}</div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {editing && (
        <Card style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 13.5, color: C.dim, margin: '0 0 14px', maxWidth: 620, lineHeight: 1.65 }}>
            Written once here, then copied everywhere else. Never retyped, because retyping is how
            the same business ends up listed three slightly different ways.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Field label="Business name, exactly"><input value={profile.legal_name ?? ''} onChange={(e) => setProfile({ ...profile, legal_name: e.target.value })} style={inputStyle} /></Field>
            <Field label="Phone, one number"><input value={profile.phone ?? ''} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} style={inputStyle} /></Field>
            <Field label="Street"><input value={profile.street ?? ''} onChange={(e) => setProfile({ ...profile, street: e.target.value })} style={inputStyle} /></Field>
            <Field label="City"><input value={profile.city ?? ''} onChange={(e) => setProfile({ ...profile, city: e.target.value })} style={inputStyle} /></Field>
            <Field label="State"><input value={profile.region ?? ''} onChange={(e) => setProfile({ ...profile, region: e.target.value })} style={inputStyle} /></Field>
            <Field label="ZIP"><input value={profile.postcode ?? ''} onChange={(e) => setProfile({ ...profile, postcode: e.target.value })} style={inputStyle} /></Field>
            <Field label="Website"><input value={profile.site_url ?? ''} onChange={(e) => setProfile({ ...profile, site_url: e.target.value })} placeholder="https://" style={inputStyle} /></Field>
            <Field label="Primary category, narrowest true one"><input value={profile.primary_category ?? ''} onChange={(e) => setProfile({ ...profile, primary_category: e.target.value })} placeholder="Bathroom Remodeler" style={inputStyle} /></Field>
          </div>
          <Field label="Services, as a customer would say them. Comma separated">
            <input value={(profile.services ?? []).join(', ')} onChange={(e) => setProfile({ ...profile, services: csv(e.target.value) })} placeholder="Bathroom remodel, kitchen remodel, tile work" style={inputStyle} />
          </Field>
          <Field label="Towns served. Comma separated">
            <input value={(profile.service_areas ?? []).join(', ')} onChange={(e) => setProfile({ ...profile, service_areas: csv(e.target.value) })} placeholder="Fort Worth, Arlington, Grapevine" style={inputStyle} />
          </Field>
          <Button onClick={saveProfile} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </Card>
      )}

      {hasProfile && (
        <div style={{ marginBottom: 26 }}>
          <SectionLabel>Copy these</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { k: 'nap', label: 'Name, address, phone', body: napBlock(profile), note: 'Paste this into every directory, unchanged.' },
              { k: 'schema', label: 'Structured data for the website', body: schemaMarkup(profile), note: 'Goes in the head tag, once per site.' },
              { k: 'desc', label: 'Profile description', body: gbpDescription(profile), note: 'A starting point. Edit it into your own voice before using it.' },
            ].map((x) => (
              <Card key={x.k}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>{x.label}</span>
                  <Button variant="ghost" onClick={() => copy(x.k, x.body)}>{copied === x.k ? 'Copied' : 'Copy'}</Button>
                </div>
                <pre style={{ fontSize: 12.5, lineHeight: 1.6, color: C.dim, background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 13px', margin: 0, overflowX: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, monospace', maxHeight: 200 }}>
                  {x.body || 'Fill in the details above.'}
                </pre>
                <div style={{ fontSize: 12.5, color: C.faint, marginTop: 8 }}>{x.note}</div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {hasProfile && titleTags(profile).length > 1 && (
        <div style={{ marginBottom: 26 }}>
          <SectionLabel>Page titles</SectionLabel>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {titleTags(profile).map((t) => (
                <div key={t.page} style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, color: C.faint, minWidth: 120 }}>{t.page}</span>
                  <span style={{ fontSize: 14, color: C.text, flex: 1, minWidth: 200 }}>{t.title}</span>
                  {t.over && <Pill tone="amber">too long</Pill>}
                  <span style={{ fontSize: 12, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>{t.title.length}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12.5, color: C.faint, marginTop: 12, lineHeight: 1.6 }}>
              Past sixty characters the end gets cut off in results, so anything after that is
              wasted rather than harmful.
            </p>
          </Card>
        </div>
      )}

      <SectionLabel>The checklist ({done} of {visible.length})</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 26 }}>
        {visible.map((t) => {
          const status = tasks[t.key] ?? 'todo';
          const open = openTask === t.key;
          return (
            <Card key={t.key}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="checkbox"
                  checked={status === 'done'}
                  onChange={(e) => setTask(t.key, e.target.checked ? 'done' : 'todo')}
                  style={{ width: 17, height: 17, cursor: 'pointer', accentColor: C.accent }}
                />
                <span
                  onClick={() => setOpenTask(open ? null : t.key)}
                  style={{
                    fontSize: 14.5, cursor: 'pointer', flex: 1, minWidth: 180,
                    color: status === 'done' ? C.faint : C.text,
                    textDecoration: status === 'done' ? 'line-through' : 'none',
                  }}
                >
                  {t.title}
                </span>
                <span style={{ fontSize: 12, color: C.faint }}>{t.effort}</span>
              </div>

              {open && (
                <div style={{ marginTop: 12, paddingLeft: 29 }}>
                  <p style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.7, margin: '0 0 12px', maxWidth: 640 }}>
                    {t.why}
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: C.dim, lineHeight: 1.7 }}>
                    {t.how.map((h, i) => <li key={i}>{h}</li>)}
                  </ul>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {isLocal && (
        <>
          <SectionLabel>Directories ({claimed} of {citations.length})</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {citations.map((c) => (
              <Card key={c.id}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <a href={c.url ?? '#'} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14.5, color: C.blue, textDecoration: 'none' }}>
                      {c.name}
                    </a>
                    {c.note && <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2 }}>{c.note}</div>}
                  </div>
                  <select
                    value={c.status}
                    onChange={(e) => setCitation(c, e.target.value)}
                    style={{ ...inputStyle, width: 130, fontSize: 13, padding: '5px 8px' }}
                  >
                    <option value="todo">Not yet</option>
                    <option value="claimed">Claimed</option>
                    <option value="verified">Verified</option>
                    <option value="skipped">Skipping</option>
                  </select>
                </div>
              </Card>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: C.faint, marginTop: 10, lineHeight: 1.6, maxWidth: 640 }}>
            These send almost no traffic on their own. Their value is corroboration, and their risk
            is contradicting each other, which is why the block above exists.
          </p>
        </>
      )}
    </Page>
  );
}
