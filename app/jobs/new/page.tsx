'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCustomer, createJob, getCurrentOrg, listCustomers } from '@/lib/spine/db';
import type { BillingType, Consideration, Customer, JobStatus } from '@/lib/spine/types';
import { CONSIDERATION_LABEL, JOB_STATUS_LABEL } from '@/lib/spine/types';
import { Button, C, Card, Field, Page, inputStyle, useIsPhone } from '@/components/spine/ui';

export default function NewJobPage() {
  const phone = useIsPhone();
  const router = useRouter();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [newCustomer, setNewCustomer] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<JobStatus>('lead');
  const [billingType, setBillingType] = useState<BillingType>('tm');
  const [consideration, setConsideration] = useState<Consideration>('cash');
  const [considerationNote, setConsiderationNote] = useState('');
  const [retainerAmount, setRetainerAmount] = useState('');
  const [retainerHours, setRetainerHours] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [org, c] = await Promise.all([getCurrentOrg(), listCustomers()]);
        setOrgId(org?.id ?? null);
        setCustomers(c);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!orgId) throw new Error('No business is attached to your profile yet. Get in touch and we\'ll fix it.');

      let cid = customerId || null;
      if (!cid && newCustomer.trim()) {
        const created = await createCustomer(orgId, { name: newCustomer.trim() });
        cid = created.id;
      }

      const job = await createJob(orgId, {
        name: name.trim(),
        customer_id: cid,
        address: address.trim() || null,
        description: description.trim() || null,
        status,
        billing_type: billingType,
        consideration,
        consideration_note: consideration === 'cash' ? null : considerationNote.trim() || null,
        retainer_amount: billingType === 'retainer' ? Number(retainerAmount) || null : null,
        retainer_hours: billingType === 'retainer' ? Number(retainerHours) || null : null,
      });

      router.push(`/jobs/${job.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Page title="New job" subtitle="A lead and a job are the same record. Start it wherever it is.">
      {error && (
        <Card style={{ borderColor: `${C.red}55`, marginBottom: 16 }}>
          <div style={{ color: C.red, fontSize: 14 }}>{error}</div>
        </Card>
      )}

      <Card style={{ maxWidth: 620 }}>
        <Field label="Job name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
            placeholder="Gorshteyn bathroom remodel"
            autoFocus
          />
        </Field>

        <Field label="Customer">
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            style={inputStyle}
          >
            <option value="">— New customer —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        {!customerId && (
          <Field label="New customer name">
            <input
              value={newCustomer}
              onChange={(e) => setNewCustomer(e.target.value)}
              style={inputStyle}
              placeholder="Grigoriy Gorshteyn"
            />
          </Field>
        )}

        <Field label="Address">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={inputStyle}
            placeholder="12 Elm St, Portland ME"
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : '1fr 1fr', gap: 12 }}>
          <Field label="Stage">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as JobStatus)}
              style={inputStyle}
            >
              {(['lead', 'estimating', 'won', 'active'] as JobStatus[]).map((s) => (
                <option key={s} value={s}>{JOB_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </Field>

          <Field label="Billing">
            <select
              value={billingType}
              onChange={(e) => setBillingType(e.target.value as BillingType)}
              style={inputStyle}
            >
              <option value="tm">Time &amp; materials</option>
              <option value="fixed">Fixed price</option>
              <option value="retainer">Monthly retainer</option>
            </select>
          </Field>
        </div>

        {billingType === 'retainer' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            <Field label="Monthly fee">
              <input
                value={retainerAmount}
                onChange={(e) => setRetainerAmount(e.target.value)}
                inputMode="decimal"
                placeholder="5000"
                style={inputStyle}
              />
            </Field>
            {/* The reason a flat fee needs software at all. The invoice is the
                same every month by definition; whether you went over is not. */}
            <Field label="Hours the fee assumes">
              <input
                value={retainerHours}
                onChange={(e) => setRetainerHours(e.target.value)}
                inputMode="decimal"
                placeholder="20"
                style={inputStyle}
              />
            </Field>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          <Field label="Paid in">
            <select
              value={consideration}
              onChange={(e) => setConsideration(e.target.value as Consideration)}
              style={inputStyle}
            >
              {(Object.keys(CONSIDERATION_LABEL) as Consideration[]).map((k) => (
                <option key={k} value={k}>{CONSIDERATION_LABEL[k]}</option>
              ))}
            </select>
          </Field>
          {consideration !== 'cash' && (
            <Field label="On what terms">
              <input
                value={considerationNote}
                onChange={(e) => setConsiderationNote(e.target.value)}
                placeholder="0.5% on a 4 year vest, 1 year cliff"
                style={inputStyle}
              />
            </Field>
          )}
        </div>

        <Field label="Notes">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
            placeholder="Full gut, tile shower, relocate vanity."
          />
        </Field>

        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <Button onClick={submit} disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create job'}
          </Button>
          <Button variant="ghost" onClick={() => router.push('/jobs')}>Cancel</Button>
        </div>
      </Card>
    </Page>
  );
}
