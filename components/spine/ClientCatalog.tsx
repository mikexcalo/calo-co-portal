'use client';

/**
 * What this client sells, priced.
 *
 * John wrote the schema himself, in an email, without being asked: item, form
 * or cut, count, pack, price, FOB point. When somebody specifies six columns
 * unprompted, the table is real and the only mistake left is adding a seventh
 * nobody wanted.
 *
 * WHY IT HANGS OFF THE CLIENT
 *
 * Pacific Empress raw P&D tail-off 21/25 and Mardex raw P&D tail-off 21/25 are
 * the same string and different objects, because the price and the FOB point
 * differ, and that difference is the whole point of a price sheet. A top-level
 * product screen would have to open by asking which client you meant.
 *
 * WHY ROWS CAN HAVE NO PRICE
 *
 * The ten priority SKUs exist as a decision before they exist as a quote. John
 * chose them from market share; the numbers come back from the principal weeks
 * later. A catalog that refuses a row without a price would have nowhere to put
 * the decision, which is the part that took judgment.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import supabase from '@/lib/supabase';
import { Button, C, Card, Empty, SectionLabel, inputStyle, money0, today } from './ui';
import { human } from '@/lib/spine/errors';
import { save as saveOrFail } from '@/lib/spine/save';

interface Product {
  id: string;
  item: string;
  form: string | null;
  size: string | null;
  pack: string | null;
  price: number | null;
  unit: string | null;
  fob: string | null;
  origin: string | null;
  species: string | null;
  sells_to: string | null;
  note: string | null;
  sort: number;
  /* What this line earns him, what is actually there, and when it was true. */
  commission_per_unit: number | null;
  cases_available: number | null;
  lbs_available: number | null;
  quoted_on: string | null;
}

const blank = { item: '', form: '', size: '', pack: '', price: '', fob: '', origin: '', species: '', sells_to: '' };

interface Terms {
  commission_per_unit: number | null;
  commission_note: string | null;
}

/**
 * What a sheet is worth to the person selling it.
 *
 * A rep's revenue is cents a pound on what moves, and until now nothing in
 * here knew that. The sheet showed the principal's prices — which are what the
 * BUYER pays — with no indication of what any of it earns the person holding
 * the sheet. Wide Foods pays five cents a pound, twenty-five on crab meat, so
 * one line of Emperor fillets at 786 cases of ten pounds is $393.
 *
 * Lifetime of the stock, not a forecast: it is what the whole line is worth if
 * all of it sells, which is the number a rep uses to decide what to push.
 */
function earns(p: Product, standing: number | null): number | null {
  const rate = p.commission_per_unit ?? standing;
  if (rate == null) return null;
  const lbs = p.lbs_available;
  if (lbs == null) return null;
  return rate * lbs;
}

/** Old enough to check before quoting from. */
function staleness(iso: string | null, todayIso: string | null): number | null {
  if (!iso || !todayIso) return null;
  return Math.round((Date.parse(todayIso) - Date.parse(iso)) / 86400000);
}

/** Cents matter on a per-pound commission: 5c and 25c are both real rates. */
const money2 = (n: number) => `$${n.toFixed(n < 1 ? 2 : 2)}`;

const money = (n: number | null, unit: string | null) =>
  n === null ? null : `$${n.toFixed(2)}${unit ? ` / ${unit}` : ''}`;

export function ClientCatalog({
  customerId,
  orgId,
  clientName,
}: {
  customerId: string;
  orgId: string;
  clientName: string;
}) {
  const [rows, setRows] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<typeof blank | null>(null);
  const [busy, setBusy] = useState(false);
  /** Which row is being priced, and what has been typed into it. */
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState({ price: '', fob: '', pack: '' });
  const [terms, setTerms] = useState<Terms | null>(null);
  /* Rendered on the client, so today cannot come from the server clock. */
  const [todayIso, setTodayIso] = useState<string | null>(null);
  useEffect(() => { setTodayIso(today()); }, []);

  const load = useCallback(async () => {
    const res = await supabase
      .from('client_products')
      .select('id, item, form, size, pack, price, unit, fob, origin, species, sells_to, note, sort, commission_per_unit, cases_available, lbs_available, quoted_on')
      .eq('customer_id', customerId)
      .order('sort');
    if (res.error) setError(human(res.error.message));
    else setRows((res.data ?? []) as Product[]);

    /* The standing deal, so a line with no rate of its own still shows what
       it earns rather than showing nothing. */
    const t = await supabase
      .from('customer_terms')
      .select('commission_per_unit, commission_note')
      .eq('customer_id', customerId)
      .maybeSingle();
    setTerms((t.data as Terms) ?? null);
    setLoaded(true);
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const priced = rows.filter((r) => r.price !== null).length;

  /** Grouped by item, because a price sheet reads by product not by cut. */
  const groups = useMemo(() => {
    const out = new Map<string, Product[]>();
    rows.forEach((r) => out.set(r.item, [...(out.get(r.item) ?? []), r]));
    return Array.from(out.entries());
  }, [rows]);

  const add = async () => {
    if (!draft?.item.trim()) return;
    setBusy(true);
    const res = await saveOrFail(supabase.from('client_products').insert({
      org_id: orgId,
      customer_id: customerId,
      item: draft.item.trim(),
      form: draft.form.trim() || null,
      size: draft.size.trim() || null,
      pack: draft.pack.trim() || null,
      price: draft.price.trim() ? Number(draft.price) : null,
      fob: draft.fob.trim() || null,
      origin: draft.origin.trim() || null,
      species: draft.species.trim() || null,
      sells_to: draft.sells_to.trim() || null,
      sort: rows.length + 1,
    }));
    setBusy(false);
    if (res.error) { setError(human(res.error.message)); return; }
    setDraft(null);
    load();
  };

  const savePrice = async (id: string) => {
    setBusy(true);
    const patch: Record<string, unknown> = {
      price: edit.price.trim() ? Number(edit.price) : null,
      fob: edit.fob.trim() || null,
      pack: edit.pack.trim() || null,
    };
    const res = await saveOrFail(supabase.from('client_products').update(patch).eq('id', id));
    setBusy(false);
    if (res.error) { setError(human(res.error.message)); return; }
    setEditing(null);
    load();
  };

  if (!loaded) return null;

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <SectionLabel>
          What {clientName} sells ({rows.length})
        </SectionLabel>
        {!draft && <Button onClick={() => setDraft({ ...blank })}>Add an item</Button>}
      </div>

      {/* The honest state of the sheet, up front. Ten decided SKUs with no
          numbers is not an empty catalog and should not read as one. */}
      {rows.length > 0 && priced < rows.length && (
        <div
          style={{
            fontSize: 12.5, color: C.amber, marginBottom: 12, lineHeight: 1.6,
            padding: '8px 12px', borderRadius: 7,
            background: C.amberSoft, border: `1px solid ${C.amber}44`,
          }}
        >
          {priced === 0
            ? `Every line is decided and none is priced. These are the items chosen to lead with; the numbers come back from the principal.`
            : `${rows.length - priced} of ${rows.length} still have no price.`}
        </div>
      )}

      {/*
        What the sheet is worth, and whether it is still true.

        A price sheet shows what the BUYER pays. The person holding it is paid
        cents a pound on whatever moves, and that number appeared nowhere — so
        the screen told him everything except the only figure that is his.

        The age sits beside it because these are live inventories. Wide Foods
        says so in the email: they sell every day. A three week old sheet is
        not a reference, it is something to check before you quote from it, and
        it should say which one it is.
      */}
      {(() => {
        const worth = rows.reduce((sum, r) => sum + (earns(r, terms?.commission_per_unit ?? null) ?? 0), 0);
        const dates = rows.map((r) => r.quoted_on).filter(Boolean).sort() as string[];
        const age = staleness(dates[dates.length - 1] ?? null, todayIso);
        if (!worth && age === null) return null;
        return (
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'baseline', marginBottom: 12 }}>
            {worth > 0 && (
              <div style={{ fontSize: 13, color: C.dim }}>
                Yours if it all sells{' '}
                <span style={{ color: C.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {money0(worth)}
                </span>
                {terms?.commission_per_unit != null && (
                  <span style={{ color: C.faint }}> · {money2(terms.commission_per_unit)} a unit unless the line says otherwise</span>
                )}
              </div>
            )}
            {age !== null && (
              <div style={{ fontSize: 12.5, color: age > 7 ? C.amber : C.faint }}>
                {age === 0 ? 'Priced today' : age === 1 ? 'Priced yesterday' : `Priced ${age} days ago`}
                {age > 7 ? ', worth checking before you quote it' : ''}
              </div>
            )}
          </div>
        );
      })()}

      {error && <div style={{ fontSize: 13, color: C.red, marginBottom: 10 }}>{error}</div>}

      {draft && (
        <Card>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 9 }}>
            <input value={draft.item} onChange={(e) => setDraft({ ...draft, item: e.target.value })}
              placeholder="Item" style={{ ...inputStyle, flex: '2 1 180px' }} />
            <input value={draft.form} onChange={(e) => setDraft({ ...draft, form: e.target.value })}
              placeholder="Form or cut" style={{ ...inputStyle, flex: '1 1 130px' }} />
            <input value={draft.size} onChange={(e) => setDraft({ ...draft, size: e.target.value })}
              placeholder="Count or size" style={{ ...inputStyle, flex: '0 1 110px' }} />
            <input value={draft.pack} onChange={(e) => setDraft({ ...draft, pack: e.target.value })}
              placeholder="Pack" style={{ ...inputStyle, flex: '0 1 110px' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 9 }}>
            <input value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              placeholder="Price" inputMode="decimal" style={{ ...inputStyle, flex: '0 1 100px' }} />
            <input value={draft.fob} onChange={(e) => setDraft({ ...draft, fob: e.target.value })}
              placeholder="FOB point" style={{ ...inputStyle, flex: '1 1 140px' }} />
            <input value={draft.origin} onChange={(e) => setDraft({ ...draft, origin: e.target.value })}
              placeholder="Origin" style={{ ...inputStyle, flex: '0 1 120px' }} />
            <input value={draft.species} onChange={(e) => setDraft({ ...draft, species: e.target.value })}
              placeholder="Species" style={{ ...inputStyle, flex: '1 1 150px' }} />
          </div>
          <input value={draft.sells_to} onChange={(e) => setDraft({ ...draft, sells_to: e.target.value })}
            placeholder="Who it sells to. Steakhouse, Italian, Mexican." style={{ ...inputStyle, marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={add} disabled={busy || !draft.item.trim()}>
              {busy ? 'Adding…' : 'Add it'}
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card>
          <Empty>Nothing listed yet. This is what they sell, and what it costs.</Empty>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {groups.map(([item, items]) => (
            <Card key={item}>
              <div style={{ fontSize: 12, color: C.faint, marginBottom: 7 }}>
                {item} ({items.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {items.map((p, i) => {
                  const isEditing = editing === p.id;
                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: '9px 0',
                        borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13.5, color: C.text, fontWeight: 500, minWidth: 110 }}>
                          {p.form ?? '–'}
                        </span>
                        {/* Counts line up or they cannot be compared, which is
                            the only reason anybody scans a price sheet. */}
                        <span
                          style={{
                            fontSize: 13, color: C.dim, minWidth: 56,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {p.size ?? ''}
                        </span>
                        <span style={{ fontSize: 12.5, color: C.faint, flex: 1, minWidth: 140 }}>
                          {[p.species, p.origin, p.sells_to].filter(Boolean).join(' · ')}
                        </span>
                        <span style={{ fontSize: 12.5, color: C.faint, minWidth: 80 }}>{p.pack ?? ''}</span>
                        <span
                          style={{
                            fontSize: 13.5, minWidth: 92, textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            color: p.price === null ? C.amber : C.text,
                          }}
                        >
                          {money(p.price, p.unit) ?? 'no price'}
                        </span>
                        <span style={{ fontSize: 12.5, color: C.faint, minWidth: 90 }}>{p.fob ?? ''}</span>
                        {/*
                          What is there, and what it earns him.

                          Quoting from a sheet with no stock on it is how you
                          sell something that went yesterday and hear about it
                          from the buyer. And the commission is the only figure
                          on this row that belongs to the person reading it.
                        */}
                        <span
                          style={{
                            fontSize: 12.5, color: C.faint, minWidth: 92, textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {p.cases_available != null
                            ? `${p.cases_available.toLocaleString('en-US')} cases`
                            : ''}
                        </span>
                        {(() => {
                          const e = earns(p, terms?.commission_per_unit ?? null);
                          return (
                            <span
                              style={{
                                fontSize: 12.5, minWidth: 74, textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums',
                                color: e ? C.green : C.faint,
                              }}
                              title={e ? 'What this line earns you if it all sells' : undefined}
                            >
                              {e ? money0(e) : ''}
                            </span>
                          );
                        })()}
                        <button
                          onClick={() => {
                            setEditing(isEditing ? null : p.id);
                            setEdit({
                              price: p.price === null ? '' : String(p.price),
                              fob: p.fob ?? '',
                              pack: p.pack ?? '',
                            });
                          }}
                          style={{
                            background: 'transparent', border: 'none', padding: 0,
                            color: C.blue, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          {isEditing ? 'Close' : p.price === null ? 'Price it' : 'Edit'}
                        </button>
                      </div>

                      {isEditing && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
                          <input value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })}
                            placeholder="Price" inputMode="decimal" style={{ ...inputStyle, flex: '0 1 110px' }} />
                          <input value={edit.pack} onChange={(e) => setEdit({ ...edit, pack: e.target.value })}
                            placeholder="Pack" style={{ ...inputStyle, flex: '0 1 130px' }} />
                          <input value={edit.fob} onChange={(e) => setEdit({ ...edit, fob: e.target.value })}
                            placeholder="FOB point" style={{ ...inputStyle, flex: '1 1 160px' }} />
                          <Button onClick={() => savePrice(p.id)} disabled={busy}>Save</Button>
                        </div>
                      )}

                      {p.note && !isEditing && (
                        <div style={{ fontSize: 12, color: C.faint, marginTop: 3, lineHeight: 1.5 }}>
                          {p.note}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
