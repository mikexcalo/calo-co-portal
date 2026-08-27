'use client';

/**
 * Files — the records a business has to keep and occasionally produce.
 *
 * Deliberately separate from Documents. That one is a pipeline: a receipt
 * arrives, gets read, becomes a job cost. These are records — insurance
 * certificates, licenses, W-9s, manuals, subcontractor agreements. Putting a
 * 113-page manual through a receipt-review queue would be absurd.
 *
 * The feature that earns this screen its place is the expiry date. A
 * contractor's liability certificate and license both lapse, and finding out
 * when a GC asks for a current copy is the expensive way to learn.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import supabase from '@/lib/supabase';
import { getCurrentOrg, getDocumentUrl } from '@/lib/spine/db';
import { useOrg } from '@/lib/spine/org';
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
  radius,
  shortDate,
} from '@/components/spine/ui';

interface BusinessFile {
  id: string;
  name: string;
  description: string | null;
  category: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  expires_on: string | null;
  shared_with_client: boolean;
  created_at: string;
}

const CATEGORIES = [
  { id: 'insurance', label: 'Insurance', expires: true },
  { id: 'license', label: 'License', expires: true },
  { id: 'certification', label: 'Certification', expires: true },
  { id: 'contract', label: 'Contract', expires: false },
  { id: 'tax', label: 'Tax', expires: false },
  { id: 'manual', label: 'Manual', expires: false },
  { id: 'warranty', label: 'Warranty', expires: true },
  { id: 'safety', label: 'Safety', expires: false },
  { id: 'other', label: 'Other', expires: false },
];

const MAX_BYTES = 25 * 1024 * 1024;

const mb = (b: number | null) => (b ? `${(b / 1024 / 1024).toFixed(1)} MB` : '');

export default function FilesPage() {
  const { org } = useOrg();
  const [files, setFiles] = useState<BusinessFile[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [today, setToday] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState<File | null>(null);
  const [meta, setMeta] = useState({ name: '', category: 'other', expires_on: '', description: '' });

  useEffect(() => setToday(new Date().toISOString().slice(0, 10)), []);

  const load = useCallback(async () => {
    const o = await getCurrentOrg();
    const res = o
      ? await supabase.from('business_files').select('*').eq('org_id', o.id)
          .order('created_at', { ascending: false })
      : { data: [], error: null };
    setOrgId(o?.id ?? null);
    if (res.error) throw new Error(res.error.message);
    setFiles((res.data ?? []) as BusinessFile[]);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [load, org?.id]);

  const stage = (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError(`${f.name} is larger than 25MB.`);
      return;
    }
    setError(null);
    setPending(f);
    // Strip the extension for a sensible default name.
    setMeta((m) => ({ ...m, name: f.name.replace(/\.[^.]+$/, '') }));
  };

  const upload = async () => {
    if (!pending || !orgId) return;
    setBusy(true);
    setError(null);
    try {
      const ext = pending.name.split('.').pop()?.toLowerCase() || 'bin';
      const path = `${orgId}/${crypto.randomUUID()}.${ext}`;

      const up = await supabase.storage.from('documents').upload(path, pending, {
        contentType: pending.type || 'application/octet-stream',
      });
      if (up.error) throw new Error(up.error.message);

      const { data: auth } = await supabase.auth.getUser();
      const res = await supabase.from('business_files').insert({
        org_id: orgId,
        name: meta.name.trim() || pending.name,
        description: meta.description.trim() || null,
        category: meta.category,
        expires_on: meta.expires_on || null,
        storage_path: path,
        file_name: pending.name,
        mime_type: pending.type || null,
        size_bytes: pending.size,
        uploaded_by: auth?.user?.id ?? null,
      });
      if (res.error) {
        // Don't leave the file orphaned in storage.
        await supabase.storage.from('documents').remove([path]).catch(() => {});
        throw new Error(res.error.message);
      }

      setPending(null);
      setMeta({ name: '', category: 'other', expires_on: '', description: '' });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const view = async (f: BusinessFile) => {
    const url = await getDocumentUrl(f.storage_path);
    if (url) window.open(url, '_blank', 'noopener');
    else setError('Could not open that file.');
  };

  const remove = async (f: BusinessFile) => {
    setBusy(true);
    try {
      await supabase.storage.from('documents').remove([f.storage_path]).catch(() => {});
      await supabase.from('business_files').delete().eq('id', f.id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  // Expiry is the reason this screen exists, so it leads.
  const soon = today
    ? files.filter((f) => {
        if (!f.expires_on) return false;
        const days = (new Date(f.expires_on).getTime() - new Date(today).getTime()) / 86_400_000;
        return days <= 45;
      })
    : [];

  const grouped = files.reduce<Record<string, BusinessFile[]>>((acc, f) => {
    (acc[f.category] ??= []).push(f);
    return acc;
  }, {});

  return (
    <Page
      title="Files"
      subtitle={`Insurance, licenses, contracts and manuals for ${org?.name ?? 'this business'} — the things you have to be able to produce.`}
      action={<Button onClick={() => fileRef.current?.click()}>Add a file</Button>}
    >
      <input
        ref={fileRef}
        type="file"
        onChange={(e) => stage(e.target.files?.[0] ?? null)}
        style={{ display: 'none' }}
      />

      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 13 }}>{error}</div>
        </Card>
      )}

      {soon.length > 0 && (
        <Card style={{ marginBottom: 20, borderColor: C.amber, background: C.amberSoft }}>
          <SectionLabel>Expiring soon</SectionLabel>
          {soon.map((f) => {
            const expired = today && f.expires_on && f.expires_on < today;
            return (
              <div
                key={f.id}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '4px 0' }}
              >
                <span>{f.name}</span>
                <span style={{ color: expired ? C.red : C.amber, fontWeight: 500 }}>
                  {expired ? 'Expired ' : 'Expires '}
                  {shortDate(f.expires_on)}
                </span>
              </div>
            );
          })}
        </Card>
      )}

      {pending ? (
        <Card style={{ marginBottom: 20, maxWidth: 620, borderColor: C.accent }}>
          <SectionLabel>About this file</SectionLabel>
          <div style={{ fontSize: 12, color: C.faint, marginBottom: 14 }}>
            {pending.name} · {mb(pending.size)}
          </div>
          <Field label="What is it?">
            <input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} style={inputStyle} autoFocus />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Category">
              <select
                value={meta.category}
                onChange={(e) => setMeta({ ...meta, category: e.target.value })}
                style={inputStyle}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Expires (if it does)">
              <input
                type="date"
                value={meta.expires_on}
                onChange={(e) => setMeta({ ...meta, expires_on: e.target.value })}
                style={inputStyle}
              />
            </Field>
          </div>
          {CATEGORIES.find((c) => c.id === meta.category)?.expires && !meta.expires_on && (
            <div style={{ fontSize: 11.5, color: C.amber, margin: '-8px 0 14px' }}>
              These usually expire. Setting a date means you get warned before it lapses.
            </div>
          )}
          <Field label="Notes">
            <input value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} style={inputStyle} />
          </Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={upload} disabled={busy}>{busy ? 'Uploading…' : 'Save'}</Button>
            <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
          </div>
        </Card>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); stage(e.dataTransfer.files?.[0] ?? null); }}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `1.5px dashed ${dragging ? C.accent : C.borderStrong}`,
            background: dragging ? C.accentSoft : 'transparent',
            borderRadius: 10,
            padding: dragging ? '30px 18px' : '22px 18px',
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: 20,
            transition: 'padding .12s, background .12s',
          }}
        >
          <div style={{ fontSize: 13.5, color: dragging ? C.accent : C.text, fontWeight: 500 }}>
            {dragging ? 'Drop it' : 'Drag a file here'}
          </div>
          <div style={{ fontSize: 11.5, color: C.faint, marginTop: 5 }}>
            Insurance certificates, licenses, contracts, manuals — or click to browse.
          </div>
        </div>
      )}

      {loading ? (
        <Empty>Loading…</Empty>
      ) : files.length === 0 ? (
        <Card><Empty>Nothing filed yet.</Empty></Card>
      ) : (
        CATEGORIES.filter((c) => grouped[c.id]?.length).map((c) => (
          <div key={c.id} style={{ marginBottom: 22 }}>
            <SectionLabel>{c.label}</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {grouped[c.id].map((f) => {
                const expired = today && f.expires_on && f.expires_on < today;
                return (
                  <div
                    key={f.id}
                    style={{
                      background: C.panel,
                      border: `1px solid ${expired ? C.red : C.border}`,
                      borderRadius: radius.md,
                      padding: '13px 15px',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13.5, fontWeight: 500 }}>{f.name}</span>
                        {f.expires_on && (
                          <Pill tone={expired ? 'red' : 'amber'}>
                            {expired ? 'Expired' : `Expires ${shortDate(f.expires_on)}`}
                          </Pill>
                        )}
                        {f.shared_with_client && <Pill tone="blue">Shared</Pill>}
                      </div>
                      {f.description && (
                        <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4, lineHeight: 1.5 }}>
                          {f.description}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>
                        {f.file_name} · {mb(f.size_bytes)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 7 }}>
                      <Button variant="ghost" onClick={() => view(f)}>Open</Button>
                      <Button variant="danger" onClick={() => remove(f)} disabled={busy}>Delete</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </Page>
  );
}
