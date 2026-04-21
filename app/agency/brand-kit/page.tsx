'use client';

import { useState } from 'react';
import { useTheme } from '@/lib/theme';
import { motion } from 'framer-motion';
import BrandKit from '@/components/shared/BrandKit';
import AgencyBrandIdentity from '@/components/AgencyBrandIdentity';
import SegmentedControl from '@/components/shared/SegmentedControl';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };

export default function AgencyBrandKitPage() {
  const { t } = useTheme();
  const [activeTab, setActiveTab] = useState<'verbal' | 'visual'>('verbal');

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <motion.div variants={stagger} initial="hidden" animate="show">
        <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 400, margin: '0 0 2px', color: t.text.primary }}>Brand Kit</h1>
          <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>Brand assets and guidelines</p>
        </motion.div>

        <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
          <SegmentedControl
            tabs={[
              {
                key: 'verbal',
                label: 'Verbal',
                icon: (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 3.5h11a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H6l-3 2.5v-2.5H2.5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z"/>
                  </svg>
                ),
              },
              {
                key: 'visual',
                label: 'Visual',
                icon: (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2.5" width="12" height="11" rx="1"/>
                    <circle cx="6" cy="6.5" r="1.3"/>
                    <path d="M14 10.5l-3.5-3.5L3 13.5"/>
                  </svg>
                ),
              },
            ]}
            activeTab={activeTab}
            onChange={(key) => setActiveTab(key as 'verbal' | 'visual')}
          />
        </motion.div>

        {activeTab === 'verbal' && (
          <motion.div variants={fadeUp}>
            <AgencyBrandIdentity />
          </motion.div>
        )}

        {activeTab === 'visual' && (
          <motion.div variants={fadeUp}>
            <BrandKit context={{ type: 'agency' }} />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
