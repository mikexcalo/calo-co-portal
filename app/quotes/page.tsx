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

  useEffect(() => {
    const init = async () => {
      try {
        if (DB.clientsState !== 'loaded') await loadClients();
        const { data } = await supabase.from('quotes').select('*').order('created_at', { ascending: false });
        setQuotes(data || []);
      } catch (e) {
        console.error('Failed to load quotes:', e);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  if (isLoading) return null;

  const countByStatus = (status: string) => quotes.filter(q => q.status === status).length;

  const th: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.3px' };

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <motion.div variants={stagger} initial="hidden" animate="show">

        {/* Header */}
        <motion.div variants={fadeUp} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 400, margin: '0 0 2px', color: t.text.primary }}>Quotes</h1>
            <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>Create and manage client quotes</p>
          </div>
          <button onClick={() => router.push('/quotes/new')} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: t.accent.primary, color: '#fff', border: 'none', borderRadius: 8,
            padding: '6px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            transition: 'background 150ms',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = t.accent.primaryHover}
          onMouseLeave={(e) => e.currentTarget.style.background = t.accent.primary}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Quote
          </button>
        </motion.div>

        {/* Metric tiles */}
        <motion.div variants={fadeUp} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Drafts', value: String(countByStatus('draft')) },
            { label: 'Sent', value: String(countByStatus('sent')) },
            { label: 'Accepted', value: String(countByStatus('accepted')), color: countByStatus('accepted') > 0 ? t.status.success : undefined },
            { label: 'Declined', value: String(countByStatus('declined')), color: countByStatus('declined') > 0 ? t.status.danger : undefined },
          ].map((m) => (
            <motion.div key={m.label} whileHover={{ y: -1 }} transition={spring} style={{
              background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: t.radius.lg,
              padding: 16, transition: 'border-color 150ms',
            }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = t.border.hover}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = t.border.default}
            >
              <div style={{ fontSize: 11, fontWeight: 500, color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 28, fontWeight: 500, color: m.color || t.text.primary }}>{m.value}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Quotes list or empty state */}
        <motion.div variants={fadeUp}>
          <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, overflow: 'hidden' }}>
            {quotes.length > 0 ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr 90px 90px 80px', padding: '10px 16px', borderBottom: `1px solid ${t.border.default}`, alignItems: 'center' }}>
                  <span style={th}>Quote #</span>
                  <span style={th}>Client</span>
                  <span style={th}>Project</span>
                  <span style={{ ...th, textAlign: 'right' }}>Amount</span>
                  <span style={{ ...th, textAlign: 'center' }}>Status</span>
                  <span style={{ ...th, textAlign: 'right' }}>Date</span>
                </div>
                {quotes.map((q) => {
                  const cl = DB.clients.find(c => c.id === q.client_id);
                  return (
                    <div key={q.id} style={{
                      display: 'grid', gridTemplateColumns: '160px 1fr 1fr 90px 90px 80px',
                      padding: '12px 16px', borderBottom: `1px solid ${t.border.default}`,
                      alignItems: 'center', cursor: 'pointer', transition: 'background 150ms',
                    }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = t.bg.surfaceHover}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <span style={{ fontSize: 13, fontWeight: 500, color: t.text.primary, whiteSpace: 'nowrap' }}>{q.quote_number || '—'}</span>
                      <span style={{ fontSize: 13, color: t.text.secondary }}>{cl?.company || cl?.name || '—'}</span>
                      <span style={{ fontSize: 13, color: t.text.secondary }}>{q.project_name || '—'}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: t.text.primary, textAlign: 'right' }}>{currency(q.total || 0)}</span>
                      <span style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: q.status === 'accepted' ? 'rgba(16,185,129,0.08)' : q.status === 'declined' ? 'rgba(239,68,68,0.08)' : q.status === 'sent' ? 'rgba(245,158,11,0.08)' : t.bg.surfaceHover,
                          color: q.status === 'accepted' ? '#047857' : q.status === 'declined' ? '#dc2626' : q.status === 'sent' ? '#b45309' : t.text.secondary,
                        }}>{q.status?.charAt(0).toUpperCase() + q.status?.slice(1)}</span>
                      </span>
                      <span style={{ fontSize: 13, color: t.text.secondary, textAlign: 'right' }}>{q.issued_date ? new Date(q.issued_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</span>
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
