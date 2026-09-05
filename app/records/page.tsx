'use client';

/**
 * Records — the documents a business has to keep and occasionally produce.
 *
 * Deliberately separate from Receipts. That one is a pipeline: a receipt
 * arrives, gets read, becomes a job cost, and is done with. These are
 * reference — insurance certificates, licenses, W-9s, manuals, subcontractor
 * agreements. Putting a 113-page manual through a receipt-review queue would
 * be absurd, which is why they were split.
 *
 * The original names, Documents and Files, were synonyms and told nobody
 * anything.
 *
 * The feature that earns this screen its place is the expiry date. A
 * contractor's liability certificate and license both lapse, and finding out
 * when a GC asks for a current copy is the expensive way to learn.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import supabase from '@/lib/supabase';
import { getCurrentOrg, getDocumentUrl } from '@/lib/spine/db';
import { useOrg } from '@/lib/spine/org';
import { Confirm } from '@/components/spine/Confirm';
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
  SETUP_TABS,
} from '@/components/spine/ui';
import { DropZone } from '@/components/spine/DropZone';

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

/** Guess from the filename so the common case needs no thought. */
function guessCategory(fileName: string): string {
  const n = fileName.toLowerCase();
  if (/insur|coi|liabilit|policy/.test(n)) return 'insurance';
  if (/licen[cs]e|permit/.test(n)) return 'license';
  if (/cert/.test(n)) return 'certification';
  if (/contract|agreement|msa|sow/.test(n)) return 'contract';
  if (/w-?9|1099|tax|irs/.test(n)) return 'tax';
  if (/manual|handbook|guide|responsib/.test(n)) return 'manual';
  if (/warrant/.test(n)) return 'warranty';
  if (/safety|osha|msds|sds/.test(n)) return 'safety';
  return 'other';
}

export default function FilesPage() {
  const { org } = useOrg();
  const [files, setFiles] = useState<BusinessFile[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<BusinessFile | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Files staged for upload, each with its own details. Dropping five at
      once and filling them in together beats five round trips. */
  const [staged, setStaged] = useState<Array<{
    file: File;
    name: string;
    category: string;
    expires_on: string;
    description: string;
  }>>([]);

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

  const stage = (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);

    const tooBig = Array.from(list).filter((f) => f.size > MAX_BYTES);
    if (tooBig.length) {
      setError(`${tooBig.map((f) => f.name).join(', ')}: larger than 25MB.`);
    }

    setStaged((prev) => [
      ...prev,
      ...Array.from(list)
        .filter((f) => f.size <= MAX_BYTES)
        .map((f) => ({
          file: f,
          // Filename minus extension, with separators turned back into spaces.
          name: f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim(),
          category: guessCategory(f.name),
          expires_on: '',
          description: '',
        })),
    ]);
  };

  const upload = async () => {
    if (!staged.length || !orgId) return;
    setBusy(true);
    setError(null);

    const { data: auth } = await supabase.auth.getUser();
    const failed: string[] = [];

    for (const item of staged) {
      const ext = item.file.name.split('.').pop()?.toLowerCase() || 'bin';
      const path = `${orgId}/${crypto.randomUUID()}.${ext}`;
      try {
        const up = await supabase.storage.from('documents').upload(path, item.file, {
          contentType: item.file.type || 'application/octet-stream',
        });
        if (up.error) throw new Error(up.error.message);

        const res = await supabase.from('business_files').insert({
          org_id: orgId,
          name: item.name.trim() || item.file.name,
          description: item.description.trim() || null,
          category: item.category,
          expires_on: item.expires_on || null,
          storage_path: path,
          file_name: item.file.name,
          mime_type: item.file.type || null,
          size_bytes: item.file.size,
          uploaded_by: auth?.user?.id ?? null,
        });
        if (res.error) {
          // Never leave a file orphaned in storage with no row pointing at it.
          await supabase.storage.from('documents').remove([path]).catch(() => {});
          throw new Error(res.error.message);
        }
      } catch (e) {
        failed.push(`${item.file.name}: ${(e as Error).message}`);
      }
    }

    if (failed.length) setError(failed.join(' · '));
    setStaged([]);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
    await load();
  };

  const view = async (f: BusinessFile) => {
    const url = await getDocumentUrl(f.storage_path);
    if (url) window.open(url, '_blank', 'noopener');
    else setError('Could not open that file.');
  };

  /**
   * Download rather than preview. A 113-page manual is something Mark hands
   * a new hire, not something he reads in a browser tab — and on a phone,
   * "open" often means a viewer he then can't get the file out of.
   */
  const download = async (f: BusinessFile) => {
    setError(null);
    try {
      const res = await supabase.storage.from('documents').download(f.storage_path);
      if (res.error) throw new Error(res.error.message);

      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(`Could not download that file: ${(e as Error).message}`);
    }
  };

  const remove = async (f: BusinessFile) => {
    setBusy(true);
    setError(null);
    try {
      await supabase.storage.from('documents').remove([f.storage_path]).catch(() => {});
      const res = await supabase.from('business_files').delete().eq('id', f.id);
      if (res.error) throw new Error(res.error.message);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setConfirming(null);
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
      tabs={SETUP_TABS}
      title="Records"
      subtitle="Insurance, licenses, contracts, manuals. The paperwork you need to find fast when somebody asks for it."
      action={<Button onClick={() => fileRef.current?.click()}>Add a file</Button>}
    >
      <input
        ref={fileRef}
        type="file"
        multiple
        onChange={(e) => stage(e.target.files)}
        style={{ display: 'none' }}
      />

      {confirming && (
        <Confirm
          title={`Delete "${confirming.name}"?`}
          body="The file is removed from storage as well as the list. This cannot be undone. If it is an insurance certificate or a license, make sure you have the original elsewhere."
          confirmLabel="Delete file"
          busy={busy}
          onConfirm={() => remove(confirming)}
          onCancel={() => setConfirming(null)}
        />
      )}

      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 14 }}>{error}</div>
        </Card>
      )}

      {soon.length > 0 && (
        <Card style={{ marginBottom: 20, borderColor: C.amber, background: C.amberSoft, maxWidth: 720 }}>
          <SectionLabel>Expiring soon</SectionLabel>
          {soon.map((f) => {
            const expired = today && f.expires_on && f.expires_on < today;
            return (
              <div
                key={f.id}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14, padding: '4px 0' }}
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

      <DropZone
        onFiles={stage}
        busy={busy}
        label="Drag files here"
        hint="Insurance, licenses, contracts, manuals. Several at once is fine, or click to browse."
      />

      {staged.length > 0 && (
        <Card style={{ marginBottom: 20, borderColor: C.accent, maxWidth: 720 }}>
          <SectionLabel>
            Ready to upload ({staged.length})
          </SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {staged.map((item, i) => {
              const cat = CATEGORIES.find((c) => c.id === item.category);
              return (
                <div
                  key={i}
                  style={{
                    borderBottom: i < staged.length - 1 ? `1px solid ${C.border}` : 'none',
                    paddingBottom: i < staged.length - 1 ? 14 : 0,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12.5, color: C.faint }}>
                      {item.file.name} · {mb(item.file.size)}
                    </span>
                    <button
                      onClick={() => setStaged((p) => p.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 17 }}
                      title="Remove"
                    >×</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) 150px 150px', gap: 8 }}>
                    <input
                      value={item.name}
                      onChange={(e) => setStaged((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                      style={inputStyle}
                      placeholder="What is it?"
                    />
                    <select
                      value={item.category}
                      onChange={(e) => setStaged((p) => p.map((x, j) => j === i ? { ...x, category: e.target.value } : x))}
                      style={inputStyle}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={item.expires_on}
                      onChange={(e) => setStaged((p) => p.map((x, j) => j === i ? { ...x, expires_on: e.target.value } : x))}
                      style={{
                        ...inputStyle,
                        borderColor: cat?.expires && !item.expires_on ? C.amber : C.border,
                      }}
                      title="Expiry date"
                    />
                  </div>
                  {cat?.expires && !item.expires_on && (
                    <div style={{ fontSize: 12, color: C.amber, marginTop: 5 }}>
                      {cat.label}s usually expire. Add a date and we&apos;ll warn you before it lapses.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Button onClick={upload} disabled={busy}>
              {busy ? 'Uploading…' : `Upload ${staged.length} file${staged.length === 1 ? '' : 's'}`}
            </Button>
            <Button variant="ghost" onClick={() => setStaged([])}>Clear</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <Empty>Loading…</Empty>
      ) : files.length === 0 ? (
        <Card><Empty>Nothing filed yet.</Empty></Card>
      ) : (
        CATEGORIES.filter((c) => grouped[c.id]?.length).map((c) => (
          <div key={c.id} style={{ marginBottom: 26, maxWidth: 720 }}>
            {/* Real heading rather than a faint uppercase label — these are
                the dividers you scan by. */}
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: C.text,
                marginBottom: 10,
                paddingBottom: 7,
                borderBottom: `1px solid ${C.border}`,
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
              }}
            >
              {c.label}
              <span style={{ fontSize: 12.5, fontWeight: 400, color: C.faint }}>
                {grouped[c.id].length}
              </span>
            </div>
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
                      maxWidth: '100%',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14.5, fontWeight: 500 }}>{f.name}</span>
                        {f.expires_on && (
                          <Pill tone={expired ? 'red' : 'amber'}>
                            {expired ? 'Expired' : `Expires ${shortDate(f.expires_on)}`}
                          </Pill>
                        )}
                        {f.shared_with_client && <Pill tone="blue">Shared</Pill>}
                      </div>
                      {f.description && (
                        <div style={{ fontSize: 12.5, color: C.faint, marginTop: 4, lineHeight: 1.5 }}>
                          {f.description}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: C.faint, marginTop: 4 }}>
                        {f.file_name} · {mb(f.size_bytes)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                      <Button onClick={() => view(f)}>Open</Button>
                      <Button variant="ghost" onClick={() => download(f)}>Download</Button>
                      {/* Small and quiet. Destroying a record should take
                          deliberate aim, not sit under your thumb. */}
                      <button
                        onClick={() => setConfirming(f)}
                        aria-label={`Delete ${f.name}`}
                        title="Delete"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 999,
                          border: `1px solid ${C.border}`,
                          background: 'transparent',
                          color: C.faint,
                          cursor: 'pointer',
                          fontSize: 14,
                          lineHeight: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
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
