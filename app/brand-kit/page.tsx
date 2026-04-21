"use client";

import { useState } from "react";
import { useTheme } from "@/lib/theme";
import { motion } from "framer-motion";
import BrandKit from "@/components/shared/BrandKit";
import HelmBrandPalette from "@/components/brand/HelmBrandPalette";
import AgencyBrandIdentity from "@/components/AgencyBrandIdentity";
import SegmentedControl from "@/components/shared/SegmentedControl";
import BrandKitLayout from "@/components/BrandKitLayout";

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } } };

export default function BrandKitPage() {
  const { t } = useTheme();
  const [activeTab, setActiveTab] = useState<"identity" | "visual" | "messaging">("identity");

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
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: t.text.tertiary }}>
                <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
                  <span title="Square Blue #006AFF" style={{ width: 12, height: 12, borderRadius: 3, background: "#006AFF" }}/>
                  <span title="Helm Teal #00C9A0" style={{ width: 12, height: 12, borderRadius: 3, background: "#00C9A0" }}/>
                  <span title="Deep Water #0EA8C1" style={{ width: 12, height: 12, borderRadius: 3, background: "#0EA8C1" }}/>
                  <span title="Overdue Red #DC2626" style={{ width: 12, height: 12, borderRadius: 3, background: "#DC2626" }}/>
                  <span title="Bronze #8B6F47" style={{ width: 12, height: 12, borderRadius: 3, background: "#8B6F47" }}/>
                  <span title="Charcoal #1A1A1A" style={{ width: 12, height: 12, borderRadius: 3, background: "#1A1A1A" }}/>
                  <span title="Ivory #F5F5F5" style={{ width: 12, height: 12, borderRadius: 3, background: "#F5F5F5", border: `0.5px solid ${t.border.default}` }}/>
                </span>
                <span style={{ color: t.text.tertiary, fontSize: 12 }}>&middot;</span>
                <span>4 of 4 logo variants</span>
                <span style={{ color: t.text.tertiary, fontSize: 12 }}>&middot;</span>
                <span>Geist Sans</span>
              </div>
              <div style={{ fontSize: 12, color: t.text.tertiary, marginTop: 8, lineHeight: 1.5, maxWidth: 600 }}>
                Identity feeds Quote PDFs, email signatures, and the Rewriter. Visual powers logos and design templates. Messaging stores reusable copy.
              </div>
            </div>
          </motion.div>

          {/* Identity / Visual / Messaging tabs */}
          <motion.div variants={fadeUp} style={{ marginBottom: 20 }}>
            <SegmentedControl
              tabs={[
                {
                  key: "identity",
                  label: "Identity",
                  icon: (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="8" cy="5.5" r="2.5"/>
                      <path d="M3 13.5c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5"/>
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
                {
                  key: "messaging",
                  label: "Messaging",
                  icon: (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2.5 3.5h11a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H6l-3 2.5v-2.5H2.5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z"/>
                      <line x1="5" y1="6.5" x2="11" y2="6.5"/>
                      <line x1="5" y1="9" x2="9" y2="9"/>
                    </svg>
                  ),
                },
              ]}
              activeTab={activeTab}
              onChange={(key) => setActiveTab(key as "identity" | "visual" | "messaging")}
            />
          </motion.div>

          {activeTab === "identity" && (
            <motion.div variants={fadeUp}>
              <AgencyBrandIdentity />
            </motion.div>
          )}

          {activeTab === "visual" && (
            <motion.div variants={fadeUp}>
              <HelmBrandPalette />
              <BrandKit context={{ type: "agency" }} />
            </motion.div>
          )}

          {activeTab === "messaging" && (
            <motion.div variants={fadeUp}>
              <div style={{ padding: "48px 0", textAlign: "center" }}>
                <div style={{ fontSize: 14, color: t.text.secondary, marginBottom: 8 }}>Messaging library coming soon</div>
                <div style={{ fontSize: 12, color: t.text.tertiary, maxWidth: 400, margin: "0 auto", lineHeight: 1.5 }}>
                  Reusable copy chunks — taglines, boilerplate, social bios — that feed your quotes, invoices, and Rewriter.
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </BrandKitLayout>
  );
}
