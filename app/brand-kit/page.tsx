"use client";

import { useState } from "react";
import { useTheme } from "@/lib/theme";
import { motion } from "framer-motion";
import BrandKit from "@/components/shared/BrandKit";
import HelmBrandPalette from "@/components/brand/HelmBrandPalette";
import AgencyBrandVoice from "@/components/AgencyBrandVoice";
import SegmentedControl from "@/components/shared/SegmentedControl";
import BrandKitLayout from "@/components/BrandKitLayout";

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } } };

export default function BrandKitPage() {
  const { t } = useTheme();
  const [activeTab, setActiveTab] = useState<"verbal" | "visual">("verbal");

  return (
    <BrandKitLayout selectedKitId="agency">
      <div style={{ padding: 32, maxWidth: 960 }}>
        <motion.div variants={stagger} initial="hidden" animate="show">

          {/* Snapshot ribbon */}
          <motion.div variants={fadeUp} style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "8px 0 20px",
            borderBottom: `0.5px solid ${t.border.default}`,
            marginBottom: 24,
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: t.bg.surfaceHover,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={t.text.secondary} strokeWidth="1.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="8.5"/>
                <circle cx="12" cy="12" r="3"/>
                <line x1="12" y1="3.5" x2="12" y2="9"/>
                <line x1="12" y1="15" x2="12" y2="20.5"/>
                <line x1="3.5" y1="12" x2="9" y2="12"/>
                <line x1="15" y1="12" x2="20.5" y2="12"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 500, color: t.text.primary, marginBottom: 4, letterSpacing: "-0.2px", lineHeight: 1.2 }}>
                CALO&CO
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: t.text.tertiary }}>
                <span style={{ display: "inline-flex", gap: 3 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: "#006AFF" }}/>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: "#00C9A0" }}/>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: "#0EA8C1" }}/>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: "#DC2626" }}/>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: "#111113" }}/>
                </span>
                <span>&middot;</span>
                <span>4 of 4 logo variants</span>
                <span>&middot;</span>
                <span>Geist Sans</span>
              </div>
            </div>
          </motion.div>

          {/* Verbal / Visual tabs */}
          <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
            <SegmentedControl
              tabs={[
                {
                  key: "verbal",
                  label: "Verbal",
                  icon: (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2.5 3.5h11a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H6l-3 2.5v-2.5H2.5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z"/>
                    </svg>
                  ),
                },
                {
                  key: "visual",
                  label: "Visual",
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
              onChange={(key) => setActiveTab(key as "verbal" | "visual")}
            />
          </motion.div>

          {activeTab === "verbal" && (
            <motion.div variants={fadeUp}>
              <AgencyBrandVoice />
            </motion.div>
          )}

          {activeTab === "visual" && (
            <motion.div variants={fadeUp}>
              <HelmBrandPalette />
              <BrandKit context={{ type: "agency" }} />
            </motion.div>
          )}
        </motion.div>
      </div>
    </BrandKitLayout>
  );
}
