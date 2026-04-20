'use client';

import { useTheme } from '@/lib/theme';
import { motion } from 'framer-motion';
import BrandKit from '@/components/shared/BrandKit';
import HelmBrandPalette from '@/components/brand/HelmBrandPalette';
import AgencyBrandVoice from '@/components/AgencyBrandVoice';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } } };

export default function AgencyBrandKitPage() {
  const { t } = useTheme();

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <motion.div variants={stagger} initial="hidden" animate="show">
        <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 400, margin: '0 0 2px', color: t.text.primary }}>Brand Kit</h1>
          <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>Brand assets and guidelines</p>
        </motion.div>

        <motion.div variants={fadeUp}>
          <HelmBrandPalette />
          <BrandKit context={{ type: 'agency' }} />
        </motion.div>

        <motion.div variants={fadeUp} style={{ marginTop: 24 }}>
          <AgencyBrandVoice />
        </motion.div>
      </motion.div>
    </div>
  );
}
