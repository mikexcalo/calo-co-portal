'use client';

/**
 * Documents — the shoebox.
 *
 * Drop in scattered paperwork. Each file is read ONCE, structured data is
 * stored, and the result becomes a job cost with one click. The running
 * extraction cost is shown on the page on purpose: this is a one-time cost
 * per document, and seeing the real number beats guessing at it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createCost,
  deleteDocument,
  getCurrentOrg,
  getDocumentUrl,
  getExtractionSpend,
  listDocuments,
  listJobs,
  updateDocument,
  uploadDocument,
} from '@/lib/spine/db';
import { useOrg } from '@/lib/spine/org';
import { DOC_STATUS_LABEL } from '@/lib/spine/types';
import type {
  CostKind,
  DocumentKind,
  DocumentRecord,
  ExtractedReceipt,
  JobWithCustomer,
} from '@/lib/spine/types';
import { ExtractionReview, type ReviewResult } from '@/components/spine/ExtractionReview';
import { Confirm } from '@/components/spine/Confirm';
import { DropZone } from '@/components/spine/DropZone';
import {
  Button,
  C,
  Card,
  Empty,
  MobileAction,
  Page,
  Pill,
  SectionLabel,
  inputStyle,
  money,
  shortDate,
  useIsPhone,
} from '@/components/spine/ui';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

export default function DocumentsPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [jobs, setJobs] = useState<JobWithCustomer[]>([]);
  const [spend, setSpend] = useState({ cents: 0, documents: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<DocumentRecord | null>(null);
  /**
   * Documents waiting on human sign-off. Nothing is written to the document
   * row until the owner approves what was read.
   */
  const [pending, setPending] = useState<Array<{
    doc: DocumentRecord;
    fileName: string;
    previewUrl: string | null;
    extracted: (ExtractedReceipt & { kind?: DocumentKind }) | null;
    costCents?: number;
  }>>([]);

  const load = useCallback(async () => {
    const [org, d, j, s] = await Promise.all([
      getCurrentOrg(),
      listDocuments(),
      listJobs(),
      getExtractionSpend(),
    ]);
    setOrgId(org?.id ?? null);
    setDocs(d);
    setJobs(j);
    setSpend(s);
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
  }, [load]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!orgId) {
      setError('No organization on your profile.');
      return;
    }
    setError(null);

    for (const file of Array.from(files)) {
      if (!ACCEPTED.includes(file.type)) {
        setError(`${file.name}: unsupported type. Use PDF or an image.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name}: larger than 10MB.`);
        continue;
      }

      let doc: DocumentRecord;
      try {
        // Store the real file FIRST. The photo is the record that matters for
        // taxes and disputes — extraction is just a convenience on top of it.
        doc = await uploadDocument(orgId, file);
        setDocs((prev) => [doc, ...prev]);
      } catch (e) {
        setError(`${file.name}: ${(e as Error).message}`);
        continue;
      }

      setWorking((w) => [...w, doc.id]);
      try {
        await updateDocument(doc.id, { status: 'processing' });
        const base64 = await toBase64(file);

        const res = await fetch('/api/documents/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileBase64: base64,
            mediaType: file.type,
            fileName: file.name,
          }),
        });

        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || 'Extraction failed');

        const ex = payload.extracted as ExtractedReceipt & { kind?: DocumentKind };

        // Record what it cost and that it was read, but hold the DATA until a
        // human confirms it. An unreviewed wrong amount becomes a wrong job
        // cost, then a wrong invoice, then a conversation with a customer.
        await updateDocument(doc.id, {
          status: 'needs_review',
          extraction_model: payload.meta.model,
          extraction_cost_cents: payload.meta.cost_cents,
          extracted_at: new Date().toISOString(),
        });

        setPending((q) => [
          ...q,
          {
            doc,
            fileName: file.name,
            previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
            extracted: ex,
            costCents: payload.meta.cost_cents,
          },
        ]);
      } catch (e) {
        await updateDocument(doc.id, {
          status: 'failed',
          extraction_error: (e as Error).message,
        }).catch(() => {});
        setError(`${file.name}: ${(e as Error).message}`);
      } finally {
        setWorking((w) => w.filter((id) => id !== doc.id));
      }
    }

    await load();
    if (fileRef.current) fileRef.current.value = '';
  };

  /** Receipt → job cost. The step the whole pipeline exists for. */
  const fileToJob = async (doc: DocumentRecord, jobId: string) => {
    if (!orgId || !jobId) return;
    setError(null);
    try {
      const ex = doc.extracted;
      if (!ex?.amount) throw new Error('No amount was read. Fix it before filing.');

      await createCost(orgId, jobId, {
        amount: ex.amount,
        purchased_on: ex.purchased_on || new Date().toISOString().slice(0, 10),
        kind: (ex.category as CostKind) || 'material',
        vendor: ex.vendor || undefined,
        description: ex.summary || undefined,
        document_id: doc.id,
      });

      await updateDocument(doc.id, { job_id: jobId, status: 'filed' });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  /** Signed link — the bucket is private, so there's no permanent URL. */
  const viewDoc = async (doc: DocumentRecord) => {
    setError(null);
    const url = await getDocumentUrl(doc.storage_path);
    if (!url) {
      setError('That file was uploaded before file storage existed, so the original is gone.');
      return;
    }
    window.open(url, '_blank', 'noopener');
  };

  const removeDoc = async (doc: DocumentRecord) => {
    setError(null);
    try {
      await deleteDocument(doc);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConfirmingDelete(null);
    }
  };

  /** The human said yes — now the extraction becomes data. */
  const approveExtraction = async (result: ReviewResult) => {
    const entry = pending[0];
    if (!entry) return;
    setError(null);
    try {
      await updateDocument(entry.doc.id, {
        status: 'extracted',
        kind: result.kind,
        extracted: {
          vendor: result.vendor,
          purchased_on: result.purchased_on,
          amount: result.amount,
          category: result.category,
          summary: result.summary,
          needs_review: false,
        },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      setPending((q) => q.slice(1));
      await load();
    }
  };

  /** Discarding removes the file too — an unapproved document is not a record. */
  const rejectExtraction = async () => {
    const entry = pending[0];
    if (!entry) return;
    try {
      await deleteDocument(entry.doc);
    } catch {
      /* the row may already be gone */
    } finally {
      if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      setPending((q) => q.slice(1));
      await load();
    }
  };

  const inbox = docs.filter((d) => d.status !== 'filed');
  const filed = docs.filter((d) => d.status === 'filed');

  return (
    <Page
      title="Receipts"
      subtitle="Photograph a receipt and it becomes a job cost. Each one is read once, and you approve what it read before anything is saved."
      action={
        <Button onClick={() => fileRef.current?.click()}>Add documents</Button>
      }
    >
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={ACCEPTED.join(',')}
        onChange={(e) => handleFiles(e.target.files)}
        style={{ display: 'none' }}
      />

      {/* Phone: opens the camera directly. The whole point is photographing a
          receipt in the truck before it goes through the wash. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFiles(e.target.files)}
        style={{ display: 'none' }}
      />
      <MobileAction label="📷  Photograph a receipt" onClick={() => cameraRef.current?.click()} />

      <DropZone
        onFiles={handleFiles}
        accept={ACCEPTED.join(',')}
        busy={working.length > 0}
        busyLabel={`Reading ${working.length} file${working.length === 1 ? '' : 's'}…`}
        label="Drag receipts here"
        hint="Photos or PDFs — several at once is fine. Or click to browse. You approve what was read before anything is saved."
      />

      {confirmingDelete && (
        <Confirm
          title="Delete this document?"
          body="The original file is removed too. If it has already become a job cost, that cost stays but loses its receipt — which is what you would need if the charge is ever questioned."
          confirmLabel="Delete document"
          onConfirm={() => removeDoc(confirmingDelete)}
          onCancel={() => setConfirmingDelete(null)}
        />
      )}

      {/* One at a time, in arrival order — a stack of modals is worse than a
          queue you work through. */}
      {pending.length > 0 && (
        <ExtractionReview
          key={pending[0].doc.id}
          fileName={
            pending.length > 1
              ? `${pending[0].fileName}  ·  ${pending.length - 1} more waiting`
              : pending[0].fileName
          }
          previewUrl={pending[0].previewUrl}
          extracted={pending[0].extracted}
          costCents={pending[0].costCents}
          onApprove={approveExtraction}
          onReject={rejectExtraction}
        />
      )}

      {error && (
        <Card style={{ borderColor: `${C.red}55`, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 13 }}>{error}</div>
        </Card>
      )}

      {/* Cost transparency — deliberately visible */}
      <Card style={{ marginBottom: 22, display: 'flex', gap: 28, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: C.faint, fontWeight: 600 }}>
            Documents read
          </div>
          <div style={{ fontSize: 20, marginTop: 6 }}>{spend.documents}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: C.faint, fontWeight: 600 }}>
            Total spent reading them
          </div>
          <div style={{ fontSize: 20, marginTop: 6, color: C.green }}>
            ${(spend.cents / 100).toFixed(2)}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 220, fontSize: 11.5, color: C.faint, alignSelf: 'center' }}>
          One charge per document. Reading a file again never costs anything.
          There is no search or chat billing on top of this.
        </div>
      </Card>

      <SectionLabel>Inbox ({inbox.length})</SectionLabel>
      {loading ? (
        <Empty>Loading…</Empty>
      ) : inbox.length === 0 ? (
        <Card><Empty>Inbox is clear. Everything has been filed to a job.</Empty></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 26 }}>
          {inbox.map((doc) => (
            <DocCard
              key={doc.id}
              doc={doc}
              jobs={jobs}
              busy={working.includes(doc.id)}
              onFile={(jobId) => fileToJob(doc, jobId)}
              onView={() => viewDoc(doc)}
              onDelete={() => setConfirmingDelete(doc)}
            />
          ))}
        </div>
      )}

      {filed.length > 0 && (
        <>
          <SectionLabel>Filed ({filed.length})</SectionLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {filed.map((d) => (
              <div
                key={d.id}
                style={{
                  background: C.panelAlt,
                  border: `1px solid ${C.border}`,
                  borderRadius: 7,
                  padding: '7px 12px',
                  fontSize: 12,
                  color: C.dim,
                }}
              >
                {d.extracted?.summary || d.file_name}
                {d.extracted?.amount != null && (
                  <span style={{ color: C.text, marginLeft: 8 }}>{money(d.extracted.amount)}</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Page>
  );
}

function DocCard({
  doc,
  jobs,
  busy,
  onFile,
  onView,
  onDelete,
}: {
  doc: DocumentRecord;
  jobs: JobWithCustomer[];
  busy: boolean;
  onFile: (jobId: string) => void;
  onView: () => void;
  onDelete: () => void;
}) {
  const [jobId, setJobId] = useState('');
  const ex = doc.extracted;

  const tone =
    doc.status === 'failed' ? 'red'
    : doc.status === 'needs_review' ? 'amber'
    : doc.status === 'extracted' ? 'green'
    : 'neutral';

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              {ex?.summary || doc.file_name}
            </span>
            <Pill tone={tone}>{busy ? 'Reading…' : DOC_STATUS_LABEL[doc.status]}</Pill>
          </div>

          {ex ? (
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12.5 }}>
              <span style={{ color: C.faint }}>
                Vendor <span style={{ color: C.text }}>{ex.vendor || '—'}</span>
              </span>
              <span style={{ color: C.faint }}>
                Date <span style={{ color: C.text }}>{shortDate(ex.purchased_on)}</span>
              </span>
              <span style={{ color: C.faint }}>
                Amount{' '}
                <span style={{ color: ex.amount != null ? C.text : C.amber }}>
                  {ex.amount != null ? money(ex.amount) : 'not read'}
                </span>
              </span>
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: C.faint }}>
              {doc.extraction_error || (busy ? 'Reading the document…' : 'Not read yet.')}
            </div>
          )}

          {ex?.needs_review && ex.review_reason && (
            <div style={{ fontSize: 12, color: C.amber, marginTop: 8 }}>
              {ex.review_reason}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Button variant="ghost" onClick={onView}>View</Button>
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            style={{ ...inputStyle, width: 180, padding: '7px 10px' }}
          >
            <option value="">File to…</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.name}</option>
            ))}
          </select>
          <Button
            onClick={() => onFile(jobId)}
            disabled={!jobId || busy || ex?.amount == null}
          >
            File
          </Button>
          <Button variant="danger" onClick={onDelete} disabled={busy}>Delete</Button>
        </div>
      </div>
    </Card>
  );
}

/** Strips the data: URL prefix — the API wants raw base64. */
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}
