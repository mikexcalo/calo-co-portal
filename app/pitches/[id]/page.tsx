'use client';

/**
 * Writing a pitch.
 *
 * Plain fields rather than a rich text editor. A rich editor invites fussing
 * with type sizes and produces a document that looks different from every
 * other page you send; the brand is already decided, and the writing is the
 * part that needs the attention.
 *
 * Publishing is a separate, explicit act. Until then there is no address at
 * all, which is a stronger promise than a page that checks a flag before
 * rendering.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { useOrg } from '@/lib/spine/org';
import {
  Button,
  C,
  Card,
  Field,
  Page,
  Pill,
  SectionLabel,
  inputStyle,
  shortDate,
} from '@/components/spine/ui';
import { Confirm } from '@/components/spine/Confirm';

interface Section { heading: string; body: string }

interface Pitch {
  id: string;
  title: string;
  recipient: string | null;
  sections: Section[];
  public_token: string | null;
  published_at: string | null;
  views: number;
  last_viewed_at: string | null;
}

function makeToken(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export default function PitchEditorPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { org } = useOrg();

  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

  const load = useCallback(async () => {
    const res = await supabase.from('pitches').select('*').eq('id', params.id).maybeSingle();
    if (res.error) setError(res.error.message);
    else if (res.data) {
      setPitch({
        ...(res.data as unknown as Pitch),
        sections: Array.isArray(res.data.sections) ? (res.data.sections as Section[]) : [],
      });
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  const save = async (patch?: Partial<Pitch>) => {
    if (!pitch) return;
    setBusy(true);
    setError(null);
    const next = { ...pitch, ...patch };
    const res = await supabase
      .from('pitches')
      .update({
        title: next.title,
        recipient: next.recipient,
        sections: next.sections,
        public_token: next.public_token,
        published_at: next.published_at,
      })
      .eq('id', pitch.id);
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    setPitch(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const publish = async () => {
    if (!pitch) return;
    // Reuse the existing address if there is one. Republishing with a new
    // token would silently break every link already sent.
    const token = pitch.public_token ?? makeToken();
    await save({ public_token: token, published_at: new Date().toISOString() });
  };

  const unpublish = async () => {
    setConfirmUnpublish(false);
    await save({ published_at: null });
  };

  const setSection = (i: number, field: keyof Section, value: string) => {
    if (!pitch) return;
    setPitch({
      ...pitch,
      sections: pitch.sections.map((s, j) => (j === i ? { ...s, [field]: value } : s)),
    });
  };

  const addSection = () => {
    if (!pitch) return;
    setPitch({ ...pitch, sections: [...pitch.sections, { heading: '', body: '' }] });
  };

  const removeSection = (i: number) => {
    if (!pitch) return;
    setPitch({ ...pitch, sections: pitch.sections.filter((_, j) => j !== i) });
  };

  const move = (i: number, dir: -1 | 1) => {
    if (!pitch) return;
    const next = [...pitch.sections];
    const target = i + dir;
    if (target < 0 || target >= next.length) return;
    [next[i], next[target]] = [next[target], next[i]];
    setPitch({ ...pitch, sections: next });
  };

  if (loading) return <Page title="Pitch"><Card>Loading…</Card></Page>;
  if (!pitch) return <Page title="Pitch"><Card>That pitch could not be found.</Card></Page>;

  const url = pitch.public_token ? `${origin}/p/${pitch.public_token}` : null;
  const isLive = !!pitch.published_at;

  return (
    <Page
      title={pitch.title || 'Untitled pitch'}
      subtitle={org?.name ? `From ${org.name}` : undefined}
      action={
        <>
          <Button variant="ghost" onClick={() => router.push('/pitches')}>Back</Button>
          <Button onClick={() => save()} disabled={busy}>
            {busy ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </Button>
        </>
      }
    >
      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16, maxWidth: 720 }}>
          <div style={{ color: C.red, fontSize: 13 }}>{error}</div>
        </Card>
      )}

      <Card style={{ maxWidth: 720, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>
                {isLive ? 'Live' : 'Draft'}
              </span>
              {isLive &&
                (pitch.views > 0 ? (
                  <Pill tone="green">Read {pitch.views}×</Pill>
                ) : (
                  <Pill tone="amber">Not opened yet</Pill>
                ))}
            </div>
            <div style={{ fontSize: 12.5, color: C.dim, marginTop: 4, lineHeight: 1.6 }}>
              {isLive
                ? pitch.views > 0
                  ? `Last read ${shortDate(pitch.last_viewed_at)}. Edits you save appear immediately for anyone holding the link.`
                  : 'Anyone with the link can read it. Edits you save appear immediately.'
                : 'Only you can see this. Publish to get a link you can send.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isLive ? (
              <Button variant="danger" onClick={() => setConfirmUnpublish(true)}>Unpublish</Button>
            ) : (
              <Button onClick={publish} disabled={busy}>Publish</Button>
            )}
          </div>
        </div>

        {isLive && url && (
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
            />
            <Button
              variant="ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(url).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="ghost" onClick={() => window.open(url, '_blank', 'noopener')}>
              Preview
            </Button>
          </div>
        )}
      </Card>

      <Card style={{ maxWidth: 720, marginBottom: 14 }}>
        <Field label="Title">
          <input
            value={pitch.title}
            onChange={(e) => setPitch({ ...pitch, title: e.target.value })}
            style={{ ...inputStyle, fontSize: 15, fontWeight: 600 }}
          />
        </Field>
        <Field label="Who it's for · optional">
          <input
            value={pitch.recipient ?? ''}
            onChange={(e) => setPitch({ ...pitch, recipient: e.target.value })}
            placeholder="Mark at Mammoth Construction"
            style={inputStyle}
          />
        </Field>
        <div style={{ fontSize: 11.5, color: C.faint, marginTop: -6, lineHeight: 1.55 }}>
          Shown at the top of the page, so it doesn&apos;t read like a form letter.
        </div>
      </Card>

      <SectionLabel>Sections</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
        {pitch.sections.map((s, i) => (
          <Card key={i}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <input
                  value={s.heading}
                  onChange={(e) => setSection(i, 'heading', e.target.value)}
                  placeholder="Heading"
                  style={{ ...inputStyle, fontWeight: 600, marginBottom: 8 }}
                />
                <textarea
                  value={s.body}
                  onChange={(e) => setSection(i, 'body', e.target.value)}
                  rows={4}
                  placeholder="Write it the way you'd say it out loud."
                  style={{ ...inputStyle, lineHeight: 1.65, resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Move up"
                  style={arrowStyle(i === 0)}
                >
                  ↑
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === pitch.sections.length - 1}
                  aria-label="Move down"
                  style={arrowStyle(i === pitch.sections.length - 1)}
                >
                  ↓
                </button>
                <button
                  onClick={() => removeSection(i)}
                  aria-label="Remove section"
                  style={{ ...arrowStyle(false), color: C.red }}
                >
                  ×
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <Button variant="ghost" onClick={addSection}>Add a section</Button>
        <Button onClick={() => save()} disabled={busy}>
          {busy ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </Button>
      </div>

      {confirmUnpublish && (
        <Confirm
          title="Unpublish this pitch?"
          body="Anyone who already has the link will get a page saying it's no longer available. Publishing again reuses the same link."
          confirmLabel="Unpublish"
          busy={busy}
          onConfirm={unpublish}
          onCancel={() => setConfirmUnpublish(false)}
        />
      )}
    </Page>
  );
}

const arrowStyle = (disabled: boolean): React.CSSProperties => ({
  width: 28,
  height: 28,
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  background: 'transparent',
  color: disabled ? C.border : C.dim,
  fontSize: 13,
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'inherit',
  lineHeight: 1,
});
