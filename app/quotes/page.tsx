'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { DB, loadClients } from '@/lib/database';
import { currency } from '@/lib/utils';
import { motion } from 'framer-motion';
import supabase from '@/lib/supabase';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };
const spring = { type: 'spring' as const, stiffness: 400, damping: 25 };

export default function QuotesPage() {
  const router = useRouter();
  const { t } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const loadQuotes = async () => {
    const { data } = await supabase.from('quotes').select('*').order('created_at', { ascending: false });
    setQuotes(data || []);
  };

  useEffect(() => {
    const init = async () => {
      try {
        if (DB.clientsState !== 'loaded') await loadClients();
        await loadQuotes();
      } catch (e) { console.error('Failed to load quotes:', e); }
      finally { setIsLoading(false); }
    };
    init();
  }, []);

  const handleStatusChange = async (q: any, newStatus: string) => {
    await supabase.from('quotes').update({ status: newStatus }).eq('id', q.id);
    await loadQuotes();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('quotes').delete().eq('id', id);
    setDeleteTarget(null);
    setExpandedId(null);
    await loadQuotes();
  };

  if (isLoading) return null;

  const sumByStatus = (status: string) => quotes.filter(q => q.status === status).reduce((s, q) => s + (q.total || 0), 0);
  const countByStatus = (status: string) => quotes.filter(q => q.status === status).length;
  const shortDate = (d: string) => { if (!d) return '—'; const dt = new Date(d); return isNaN(dt.getTime()) ? d : `${dt.getMonth() + 1}/${dt.getDate()}/${String(dt.getFullYear()).slice(2)}`; };

  const th: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.3px' };
  const cols = '40px 160px 1fr 1fr 90px 90px 80px';

  const ActionBtn = ({ icon, label, onClick, color }: { icon: React.ReactNode; label: string; onClick: (e: React.MouseEvent) => void; color?: string }) => (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 6,
      border: `1px solid ${t.border.default}`, background: t.bg.surface,
      color: color || t.text.primary, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = t.bg.surfaceHover; e.currentTarget.style.borderColor = t.border.hover; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = t.bg.surface; e.currentTarget.style.borderColor = t.border.default; }}
    >{icon}{label}</button>
  );

  const statusBadge = (status: string) => {
    const base: React.CSSProperties = { fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 };
    const colors: Record<string, { bg: string; fg: string }> = {
      draft: { bg: t.bg.surfaceHover, fg: t.text.secondary },
      sent: { bg: 'rgba(245,158,11,0.08)', fg: '#b45309' },
      accepted: { bg: 'rgba(0,201,160,0.08)', fg: '#054D3D' },
      declined: { bg: 'rgba(239,68,68,0.08)', fg: '#dc2626' },
      expired: { bg: t.bg.surfaceHover, fg: t.text.tertiary },
    };
    const c = colors[status] || colors.draft;
    return <span style={{ ...base, background: c.bg, color: c.fg }}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
  };

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <motion.div variants={stagger} initial="hidden" animate="show">
        <motion.div variants={fadeUp} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 400, margin: '0 0 2px', color: t.text.primary }}>Quotes</h1>
            <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>Create and manage client quotes</p>
          </div>
          <button onClick={() => router.push('/quotes/new')} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: t.accent.primary, color: '#fff', border: 'none', borderRadius: 8,
            padding: '6px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 150ms',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = t.accent.primaryHover}
          onMouseLeave={(e) => e.currentTarget.style.background = t.accent.primary}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Quote
          </button>
        </motion.div>

        {/* Tiles */}
        <motion.div variants={fadeUp} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Drafts', value: currency(sumByStatus('draft')), sub: `${countByStatus('draft')} draft${countByStatus('draft') !== 1 ? 's' : ''}` },
            { label: 'Sent', value: currency(sumByStatus('sent')), sub: `${countByStatus('sent')} sent` },
            { label: 'Accepted', value: currency(sumByStatus('accepted')), sub: `${countByStatus('accepted')} accepted`, color: countByStatus('accepted') > 0 ? t.status.success : undefined },
            { label: 'Declined', value: currency(sumByStatus('declined')), sub: `${countByStatus('declined')} declined`, color: countByStatus('declined') > 0 ? t.status.danger : undefined },
          ].map((m) => (
            <motion.div key={m.label} whileHover={{ y: -1 }} transition={spring} style={{
              background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg, padding: 16, transition: 'border-color 150ms',
            }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = t.border.hover}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = t.border.default}
            >
              <div style={{ fontSize: 11, fontWeight: 500, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 28, fontWeight: 500, color: (m as any).color || t.text.primary }}>{m.value}</div>
              <div style={{ fontSize: 11, color: t.text.tertiary, marginTop: 2 }}>{m.sub}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Table */}
        <motion.div variants={fadeUp}>
          <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, overflow: 'hidden' }}>
            {quotes.length > 0 ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '10px 16px', borderBottom: `1px solid ${t.border.default}`, alignItems: 'center' }}>
                  <span /><span style={th}>Quote #</span><span style={th}>Client</span><span style={th}>Project</span>
                  <span style={{ ...th, textAlign: 'right' }}>Amount</span><span style={{ ...th, textAlign: 'center' }}>Status</span><span style={{ ...th, textAlign: 'right' }}>Date</span>
                </div>
                {quotes.map((q) => {
                  const cl = DB.clients.find(c => c.id === q.client_id);
                  const isExpanded = expandedId === q.id;
                  return (
                    <div key={q.id}>
                      <div onClick={() => setExpandedId(isExpanded ? null : q.id)} style={{
                        display: 'grid', gridTemplateColumns: cols, padding: '12px 16px', borderBottom: `1px solid ${t.border.default}`,
                        alignItems: 'center', cursor: 'pointer', transition: 'background 150ms',
                      }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = t.bg.surfaceHover}
                      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.text.tertiary} strokeWidth="2" style={{ transition: 'transform 150ms', transform: isExpanded ? 'rotate(180deg)' : 'none' }}><polyline points="6 9 12 15 18 9"/></svg>
                        <span style={{ fontSize: 13, fontWeight: 500, color: t.text.primary, whiteSpace: 'nowrap' }}>{q.quote_number || '—'}</span>
                        <span style={{ fontSize: 13, color: t.text.secondary }}>{cl?.company || cl?.name || '—'}</span>
                        <span style={{ fontSize: 13, color: t.text.secondary }}>{q.project_name || '—'}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: t.text.primary, textAlign: 'right' }}>{currency(q.total || 0)}</span>
                        <span style={{ textAlign: 'center' }}>{statusBadge(q.status)}</span>
                        <span style={{ fontSize: 13, color: t.text.secondary, textAlign: 'right' }}>{shortDate(q.issued_date)}</span>
                      </div>
                      {isExpanded && (
                        <div style={{ padding: '16px 16px 16px 56px', background: t.bg.surfaceHover, borderBottom: `1px solid ${t.border.default}` }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
                            <div>
                              <p style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.3px', margin: '0 0 8px' }}>Line items</p>
                              {Array.isArray(q.line_items) && q.line_items.length ? q.line_items.map((item: any, idx: number) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `0.5px solid ${t.border.default}`, fontSize: 12 }}>
                                  <span style={{ color: t.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, marginRight: 12 }} title={item.description}>{item.description || '—'}</span>
                                  <span style={{ color: t.text.secondary, whiteSpace: 'nowrap' }}>{item.qty > 1 ? `${item.qty} × ${currency(item.price)} = ${currency(item.qty * item.price)}` : currency(item.price)}</span>
                                </div>
                              )) : <p style={{ fontSize: 12, color: t.text.tertiary }}>No line items</p>}
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 4px', marginTop: 4, borderTop: `1px solid ${t.border.default}`, fontSize: 11, color: t.text.tertiary }}>
                                <span>{q.tax > 0 ? `Tax: ${currency(q.tax)}` : ''}</span>
                                <span style={{ fontWeight: 600, color: t.text.primary, fontSize: 13 }}>Total: {currency(q.total || 0)}</span>
                              </div>
                              {q.expires_date && <div style={{ fontSize: 11, color: t.text.tertiary, marginTop: 6 }}>Valid until {new Date(q.expires_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>}
                            </div>
                            <div>
                              {q.notes && (<><p style={{ fontSize: 10, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.3px', margin: '0 0 8px' }}>Notes</p><p style={{ fontSize: 12, color: t.text.secondary, lineHeight: 1.4, margin: 0 }}>{q.notes}</p></>)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: `1px solid ${t.border.default}` }}>
                            <ActionBtn icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>} label="Edit" onClick={(e) => { e.stopPropagation(); router.push(`/quotes/new?edit=${q.id}`); }} />
                            {q.status === 'draft' && (
                              <ActionBtn icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 12 9 17 20 6"/></svg>} label="Mark as Sent" color={t.status.success} onClick={(e) => { e.stopPropagation(); handleStatusChange(q, 'sent'); }} />
                            )}
                            {q.status === 'sent' && (
                              <>
                                <ActionBtn icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 12 9 17 20 6"/></svg>} label="Accept" color={t.status.success} onClick={(e) => { e.stopPropagation(); handleStatusChange(q, 'accepted'); }} />
                                <ActionBtn icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>} label="Decline" color={t.status.danger} onClick={(e) => { e.stopPropagation(); handleStatusChange(q, 'declined'); }} />
                              </>
                            )}
                            {q.status === 'accepted' && (
                              <ActionBtn icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="1" width="12" height="14" rx="1.5"/><line x1="5" y1="5" x2="11" y2="5"/><line x1="5" y1="8" x2="11" y2="8"/></svg>} label="Create Invoice" color={t.accent.primary} onClick={(e) => { e.stopPropagation(); router.push(`/invoices/new?from_quote=${q.id}`); }} />
                            )}
                            <div style={{ marginLeft: 'auto' }}>
                              <ActionBtn icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>} label="Delete" color={t.status.danger} onClick={(e) => { e.stopPropagation(); handleDelete(q.id); }} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: t.text.tertiary, marginBottom: 4 }}>No quotes yet</div>
                <div style={{ fontSize: 12, color: t.text.tertiary, opacity: 0.6 }}>Create your first quote to get started</div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
