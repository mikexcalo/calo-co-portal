'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCustomer, createJob, getCurrentOrg, listCustomers } from '@/lib/spine/db';
import type { BillingType, Customer, JobStatus } from '@/lib/spine/types';
import { JOB_STATUS_LABEL } from '@/lib/spine/types';
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
            </select>
          </Field>
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
