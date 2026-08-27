'use client';

/**
 * CRM — the people you bill.
 *
 * Customers for a contractor, Clients for the agency. Same table, and the
 * value of each one is computed from their jobs rather than typed in, so it
 * can't be stale.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCustomer, getCurrentOrg, listCustomers, listJobLedger, listJobs } from '@/lib/spine/db';
import { useOrg } from '@/lib/spine/org';
import type { Customer, JobLedger, JobWithCustomer } from '@/lib/spine/types';
import {
  Button,
  C,
  Card,
  Empty,
  Field,
  Page,
  Pill,
  Row,
  SERIF,
  Table,
  inputStyle,
  money,
  money0,
} from '@/components/spine/ui';

export default function CustomersPage() {
  const router = useRouter();
  const { vocab } = useOrg();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobs, setJobs] = useState<JobWithCustomer[]>([]);
  const [ledger, setLedger] = useState<JobLedger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const load = useCallback(async () => {
    const [org, c, j, l] = await Promise.all([
      getCurrentOrg(),
      listCustomers(),
      listJobs(),
      listJobLedger(),
    ]);
    setOrgId(org?.id ?? null);
    setCustomers(c);
    setJobs(j);
    setLedger(l);
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

  /** Value per customer, derived from their jobs. Never typed, never stale. */
  const rollup = useMemo(() => {
    const byJob = Object.fromEntries(ledger.map((l) => [l.job_id, l]));
    const out: Record<string, { jobs: number; invoiced: number; open: number; unbilled: number }> = {};

    for (const job of jobs) {
      if (!job.customer_id) continue;
      const l = byJob[job.id];
      const entry = (out[job.customer_id] ??= { jobs: 0, invoiced: 0, open: 0, unbilled: 0 });
      entry.jobs += 1;
      if (l) {
        entry.invoiced += l.invoiced_total;
        entry.open += l.invoiced_total - l.collected;
        entry.unbilled += l.unbilled_labor + l.unbilled_cost;
      }
    }
    return out;
  }, [jobs, ledger]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((c) =>
      [c.name, c.email, c.phone, c.address].some((v) => v?.toLowerCase().includes(term))
    );
  }, [customers, q]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!orgId) throw new Error('No business selected.');
      await createCustomer(orgId, {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
      });
      setName(''); setEmail(''); setPhone(''); setAddress('');
      setAdding(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const totalOpen = Object.values(rollup).reduce((s, r) => s + r.open, 0);

  return (
    <Page
      title={vocab.customerPlural}
      subtitle={`Everyone you bill. Their value is calculated from their ${vocab.jobPlural.toLowerCase()}, not typed in.`}
      action={
        <Button onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancel' : `New ${vocab.customer.toLowerCase()}`}
        </Button>
      }
    >
      {error && (
        <Card style={{ borderColor: C.red, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 13 }}>{error}</div>
        </Card>
      )}

      {adding && (
        <Card style={{ marginBottom: 18, maxWidth: 620 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
            <Field label="Name">
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} autoFocus />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                placeholder="Needed to send invoices"
              />
            </Field>
            <Field label="Phone">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Address">
              <input value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} />
            </Field>
          </div>
          <Button onClick={submit} disabled={busy || !name.trim()}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </Card>
      )}

      {customers.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${vocab.customerPlural.toLowerCase()}…`}
            style={{ ...inputStyle, maxWidth: 280, background: C.panel }}
          />
          {totalOpen > 0 && (
            <span style={{ fontSize: 12.5, color: C.dim }}>
              <strong style={{ color: C.amber }}>{money0(totalOpen)}</strong> owed across all{' '}
              {vocab.customerPlural.toLowerCase()}
            </span>
          )}
        </div>
      )}

      {loading ? (
        <Empty>Loading…</Empty>
      ) : filtered.length === 0 ? (
        <Card>
          <Empty>
            {customers.length === 0
              ? `No ${vocab.customerPlural.toLowerCase()} yet.`
              : 'Nothing matches that search.'}
          </Empty>
        </Card>
      ) : (
        <Table>
          <Row cols="1fr 190px 90px 110px 110px" header>
            <div>{vocab.customer}</div>
            <div>Contact</div>
            <div>{vocab.jobPlural}</div>
            <div>Invoiced</div>
            <div>Owed</div>
          </Row>
          {filtered.map((c) => {
            const r = rollup[c.id] ?? { jobs: 0, invoiced: 0, open: 0, unbilled: 0 };
            return (
              <Row key={c.id} cols="1fr 190px 90px 110px 110px">
                <div>
                  <div style={{ fontFamily: SERIF, fontSize: 15.5 }}>{c.name}</div>
                  {c.address && (
                    <div style={{ fontSize: 11.5, color: C.faint, marginTop: 2 }}>{c.address}</div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: C.dim }}>
                  {c.email || <span style={{ color: C.amber }}>No email — can&apos;t invoice</span>}
                  {c.phone && <div style={{ color: C.faint }}>{c.phone}</div>}
                </div>
                <div>
                  {r.jobs > 0 ? r.jobs : <span style={{ color: C.faint }}>—</span>}
                  {r.unbilled > 0 && (
                    <div style={{ marginTop: 3 }}>
                      <Pill tone="amber">{money0(r.unbilled)} unbilled</Pill>
                    </div>
                  )}
                </div>
                <div>{r.invoiced > 0 ? money(r.invoiced) : <span style={{ color: C.faint }}>—</span>}</div>
                <div style={{ color: r.open > 0 ? C.amber : C.faint }}>
                  {r.open > 0 ? money(r.open) : '—'}
                </div>
              </Row>
            );
          })}
        </Table>
      )}
    </Page>
  );
}
