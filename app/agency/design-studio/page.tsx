'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { useTheme } from '@/lib/theme';
import { motion, AnimatePresence } from 'framer-motion';
import SegmentedControl from '@/components/shared/SegmentedControl';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };

type Tab = 'yard-signs' | 'business-cards' | 'email-signatures';

export default function AgencyDesignStudioPage() {
  return <Suspense fallback={<div style={{ padding: 32, opacity: 0.5, fontSize: 13 }}>Loading...</div>}><DesignStudioContent /></Suspense>;
}

function DesignStudioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTheme();

  const activeTab = (searchParams.get('tab') as Tab) || 'yard-signs';

  const setTab = (tab: Tab) => {
    router.push(`/agency/design-studio?tab=${tab}`);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'yard-signs', label: 'Yard signs' },
    { id: 'business-cards', label: 'Business cards' },
    { id: 'email-signatures', label: 'Email signatures' },
  ];

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <motion.div variants={stagger} initial="hidden" animate="show">

        {/* Header */}
        <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 400, margin: '0 0 2px', color: t.text.primary }}>Studio</h1>
          <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>Agency templates and assets</p>
        </motion.div>

        {/* Segmented control */}
        <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
          <SegmentedControl
            tabs={tabs.map((tb) => ({ key: tb.id, label: tb.label }))}
            activeTab={activeTab}
            onChange={(key) => setTab(key as Tab)}
          />
        </motion.div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

            {activeTab === 'yard-signs' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0' }}>
                <p style={{ fontSize: 14, color: t.text.secondary }}>Yard signs — coming soon</p>
              </div>
            )}

            {activeTab === 'business-cards' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0' }}>
                <p style={{ fontSize: 14, color: t.text.secondary }}>Business cards — coming soon</p>
              </div>
            )}

            {activeTab === 'email-signatures' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0' }}>
                <p style={{ fontSize: 14, color: t.text.secondary }}>Email signatures — coming soon</p>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
