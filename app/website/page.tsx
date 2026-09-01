'use client';

/**
 * Client-facing: ask your agency for a website change.
 *
 * This is the side Mammoth sees. They don't triage requests, they raise them —
 * and they can see exactly where each one stands, which is the thing that
 * actually stops the "any update on that?" email.
 *
 * Anything editable without a build lives here too, so most requests never
 * need to be requests.
 */

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { getCurrentOrg } from '@/lib/spine/db';
import { useOrg } from '@/lib/spine/org';
import { modulesFor } from '@/lib/spine/modules';
import {
  Button,
  C,
  Card,
  Empty,
  Field,
  Page,
  Pill,
  SectionLabel,
  inputStyle,
  shortDate,
  useIsPhone,
} from '@/components/spine/ui';

interface Site {
  id: string;
  name: string;
  url: string | null;
  managed_by_org_id: string | null;
}

interface Content {
  id: string;
  key: string;
  label: string;
  value: string | null;
  kind: string;
  help: string | null;
}

interface Request {
  id: string;
  title: string;
  body: string;
  kind: string;
  urgency: string;
  status: string;
  note_to_client: string | null;
  submitted_at: string;
}

const STATUS_COPY: Record<string, { label: string; tone: 'neutral' | 'amber' | 'blue' | 'green' }> = {
  submitted: { label: 'Sent, waiting on review', tone: 'amber' },
  needs_info: { label: 'They asked a question', tone: 'amber' },
  approved: { label: 'Approved', tone: 'blue' },
  building: { label: 'Being built', tone: 'blue' },
  shipped: { label: 'Live', tone: 'green' },
  declined: { label: 'Not doing this one', tone: 'neutral' },
};

export default function WebsitePage() {
  const phone = useIsPhone();
  const { org } = useOrg();
  const mods = modulesFor(org);
  const [site, setSite] = useState<Site | null>(null);
  const [content, setContent] = useState<Content[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState('change');
  const [urgency, setUrgency] = useState('normal');

  const load = useCallback(async () => {
    const [s, r] = await Promise.all([
      supabase.from('client_sites').select('*').limit(1).maybeSingle(),
      supabase.from('site_requests').select('*').order('submitted_at', { ascending: false }),
    ]);
    if (s.error) throw new Error(s.error.message);
    if (r.error) throw new Error(r.error.message);

    setSite((s.data as Site) ?? null);
    setRequests((r.data ?? []) as Request[]);

    if (s.data) {
      const c = await supabase
        .from('site_content')
        .select('*')
        .eq('site_id', (s.data as Site).id)
        .order('position');
      if (!c.error) setContent((c.data ?? []) as Content[]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await getCurrentOrg();
        await load();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const saveContent = async (c: Content, value: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await supabase.from('site_content').update({ value }).eq('id', c.id);
      if (res.error) throw new Error(res.error.message);
      setContent((prev) => prev.map((x) => (x.id === c.id ? { ...x, value } : x)));
      setNotice(`${c.label} updated. It's live on the site now.`);
      setTimeout(() => setNotice(null), 4000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!org) throw new Error('No business selected.');
      const { data: auth } = await supabase.auth.getUser();

      const res = await supabase.from('site_requests').insert({
        org_id: org.id,
        site_id: site?.id ?? null,
        title: title.trim(),
        body: body.trim(),
        kind,
        urgency,
        requested_by: auth?.user?.id ?? null,
        requester_email: auth?.user?.email ?? null,
      });
      if (res.error) throw new Error(res.error.message);

      // Tell the agency that manages this site. Best-effort — the request is
      // already saved, and a failed announcement must not lose it.
      if (site?.managed_by_org_id) {
        await supabase.from('notifications').insert({
          org_id: site.managed_by_org_id,
          kind: 'site_request',
          title: `${org.name}: ${title.trim()}`,
          body: body.trim().slice(0, 120),
          href: '/requests',
        });
      }

      setTitle(''); setBody(''); setKind('change'); setUrgency('normal');
      setAsking(false);
      setNotice('Sent. You can track it below.');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title="Your website"
      subtitle={
        site
          ? `${site.name}${site.url ? ` — ${site.url}` : ''}`
          : 'Edit what you can yourself, and ask for anything else.'
      }
      action={
        <Button onClick={() => setAsking((v) => !v)}>
          {asking ? 'Cancel' : 'Request a change'}
        </Button>
      }
    >
      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 14 }}>{error}</div>
        </Card>
      )}
      {notice && (
        <Card style={{ borderColor: C.green, marginBottom: 16 }}>
          <div style={{ color: C.green, fontSize: 14 }}>{notice}</div>
        </Card>
      )}

      {asking && (
        <Card style={{ marginBottom: 22, maxWidth: 640 }}>
          <Field label="What needs changing?">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
              placeholder="Add a photo gallery to the Projects page"
              autoFocus
            />
          </Field>
          <Field label="Tell them everything they need to know">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{ ...inputStyle, minHeight: 120, resize: 'vertical', lineHeight: 1.55 }}
              placeholder="Which page, what it should say, and anything you'd send along: photos, wording, a link to an example you like."
            />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : '1fr 1fr', gap: 12 }}>
            <Field label="Type">
              <select value={kind} onChange={(e) => setKind(e.target.value)} style={inputStyle}>
                <option value="copy">Wording</option>
                <option value="image">Photos</option>
                <option value="change">Change something</option>
                <option value="new_feature">Something new</option>
                <option value="bug">Something's broken</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="How soon">
              <select value={urgency} onChange={(e) => setUrgency(e.target.value)} style={inputStyle}>
                <option value="whenever">Whenever</option>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </Field>
          </div>
          <Button onClick={submit} disabled={busy || !title.trim() || !body.trim()}>
            {busy ? 'Sending…' : 'Send request'}
          </Button>
        </Card>
      )}

      {/* Self-serve first — every field here is a request nobody has to work. */}
      {content.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <SectionLabel>Change these yourself</SectionLabel>
          <Card>
            <div style={{ fontSize: 13.5, color: C.dim, marginBottom: 16 }}>
              These go live immediately. No approval, no waiting.
            </div>
            {content.map((c) => (
              <ContentField key={c.id} item={c} busy={busy} onSave={saveContent} />
            ))}
          </Card>
        </div>
      )}

      <SectionLabel>Your requests</SectionLabel>
      {loading ? (
        <Empty>Loading…</Empty>
      ) : requests.length === 0 ? (
        <Card>
          <Empty>
            Nothing requested yet. Anything you can&apos;t change above, ask for it.
          </Empty>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {requests.map((r) => {
            const s = STATUS_COPY[r.status] ?? { label: r.status, tone: 'neutral' as const };
            return (
              <Card key={r.id}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 500, flex: 1, minWidth: 200 }}>
                    {r.title}
                  </span>
                  <Pill tone={s.tone}>{s.label}</Pill>
                </div>
                <div style={{ fontSize: 13.5, color: C.dim, marginTop: 8, whiteSpace: 'pre-wrap' }}>
                  {r.body}
                </div>
                <div style={{ fontSize: 12, color: C.faint, marginTop: 8 }}>
                  Sent {shortDate(r.submitted_at)}
                </div>
                {r.note_to_client && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 11,
                      borderRadius: 7,
                      background: C.accentSoft,
                      fontSize: 13.5,
                      color: C.text,
                    }}
                  >
                    <strong style={{ fontWeight: 600 }}>Reply:</strong> {r.note_to_client}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {!loading && !site && (
        <Card style={{ marginTop: 20, borderColor: C.amber }}>
          <div style={{ fontSize: 14, color: C.amber }}>
            No website is linked to this business yet, so requests won&apos;t reach anyone.
            Whoever manages your site needs to add it.
          </div>
        </Card>
      )}
    </Page>
  );
}

function ContentField({
  item,
  busy,
  onSave,
}: {
  item: Content;
  busy: boolean;
  onSave: (c: Content, value: string) => void;
}) {
  const [value, setValue] = useState(item.value ?? '');
  const dirty = value !== (item.value ?? '');

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: C.dim, marginBottom: 5, fontWeight: 500 }}>
        {item.label}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        {item.kind === 'longtext' ? (
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
          />
        ) : (
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={inputStyle}
            type={item.kind === 'email' ? 'email' : item.kind === 'phone' ? 'tel' : 'text'}
          />
        )}
        <Button onClick={() => onSave(item, value)} disabled={busy || !dirty}>
          Save
        </Button>
      </div>
      {item.help && (
        <div style={{ fontSize: 12.5, color: C.faint, marginTop: 4 }}>{item.help}</div>
      )}
    </div>
  );
}
