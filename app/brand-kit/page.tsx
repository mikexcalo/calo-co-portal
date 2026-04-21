"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme";
import { DB, loadClients, loadAllBrandKits } from "@/lib/database";
import { getClientAvatarUrl } from "@/lib/clientAvatar";
import { PageShell, PageHeader } from "@/components/shared/Brand";
import BrandKitLayout from "@/components/BrandKitLayout";

const HELM_PALETTE = ["#006AFF", "#00C9A0", "#0EA8C1", "#DC2626", "#111113"];

function countVariants(c: any): number {
  const logos = c.brandKit?.logos;
  if (!logos) return 0;
  return ["color", "light", "dark", "icon"].filter((k: string) => logos[k]?.length > 0).length;
}

function computeMissing(c: any): string[] {
  const missing: string[] = [];
  const bv = c.brand_voice;
  if (!bv?.elevatorPitch && !(bv?.tones?.length > 0)) missing.push("Voice");
  const variants = countVariants(c);
  if (variants < 4) missing.push(variants === 0 ? "Logos" : `Logo variants (${variants}/4)`);
  if ((c.brandKit?.colors?.length || 0) < 2) missing.push("Colors");
  if (!c.brandKit?.fonts?.heading) missing.push("Typography");
  return missing;
}

function getSwatches(bk: any): string[] {
  if (!bk?.colors?.length) return [];
  return bk.colors.slice(0, 4).map((c: any) => typeof c === "string" ? c : c?.hex || "#ccc");
}

function getClientSubtitle(c: any) {
  const tagline = c.brand_builder_fields?.tagline;
  if (tagline) return tagline;
  const v = countVariants(c);
  if (v > 0) return `${v} of 4 variants`;
  return "Not started";
}

export default function BrandKitPage() {
  const { t, theme } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      if (DB.clientsState !== "loaded") await loadClients();
      if (!DB.clients.some((c: any) => c.brandKit?._id)) await loadAllBrandKits();
      setClients(DB.clients);
      setLoading(false);
    })();
  }, []);

  if (loading) return null;

  const agencyBk = DB.agency?.brandKit;
  const agencyColors = agencyBk?.colors?.length ? agencyBk.colors.slice(0, 5).map((c: any) => typeof c === "string" ? c : c?.hex) : HELM_PALETTE;
  const isDark = theme === "dark";

  const getStatusInfo = (c: any) => {
    const missing = computeMissing(c);
    if (missing.length === 0) return { label: "Complete", bg: isDark ? "rgba(0,201,160,0.12)" : "rgba(0,201,160,0.08)", color: isDark ? "#00C9A0" : "#047857" };
    if (missing.length >= 4) return { label: "Not started", bg: isDark ? "rgba(242,92,92,0.12)" : "#FCEBEB", color: isDark ? "#F09595" : "#A32D2D" };
    return { label: `Missing: ${missing.join(", ")}`, bg: isDark ? "rgba(239,159,39,0.12)" : "#FAEEDA", color: isDark ? "#EF9F27" : "#854F0B" };
  };

  const th: React.CSSProperties = { fontSize: 10, fontWeight: 500, color: t.text.tertiary, textTransform: "uppercase", letterSpacing: "0.5px" };

  return (
    <BrandKitLayout selectedKitId="agency">
    <PageShell>
      <PageHeader title="Brand Kit" subtitle="Your agency identity and your clients' brands." />

      {/* Agency strip */}
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: t.text.primary, marginBottom: 12, marginTop: 8 }}>Your agency</div>
      <div style={{ background: t.bg.surface, border: `0.5px solid ${t.border.default}`, borderRadius: 12, padding: "14px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: t.bg.surfaceHover, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.text.tertiary} strokeWidth="1.3"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="3.5" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="20.5"/><line x1="3.5" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="20.5" y2="12"/></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: t.text.primary }}>CALO&CO</div>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {agencyColors.map((hex: string) => (
            <div key={hex} onClick={() => navigator.clipboard.writeText(hex)} title={`Copy ${hex}`}
              style={{ width: 22, height: 22, background: hex, borderRadius: 4, cursor: "pointer", border: "0.5px solid rgba(0,0,0,0.1)" }} />
          ))}
        </div>
        <button onClick={() => router.push("/agency/brand-kit")}
          style={{ background: "transparent", border: `0.5px solid ${t.border.default}`, borderRadius: 6, padding: "6px 12px", fontSize: 12, color: t.text.primary, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, transition: "all 150ms" }}
          onMouseEnter={e => e.currentTarget.style.background = t.bg.surfaceHover}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          Edit →
        </button>
      </div>

      {/* Clients table */}
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: t.text.primary, marginBottom: 12, marginTop: 24 }}>Clients</div>
      <div style={{ background: t.bg.surface, border: `0.5px solid ${t.border.default}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.4fr) minmax(160px, auto) 40px", padding: "10px 20px", borderBottom: `0.5px solid ${t.border.default}` }}>
          <div style={th}>Client</div><div style={th}>Colors</div><div style={th}>Status</div><div />
        </div>
        {clients.map((client, idx) => {
          const avatar = getClientAvatarUrl(client);
          const colors = getSwatches(client.brandKit);
          const status = getStatusInfo(client);
          const isLast = idx === clients.length - 1;
          return (
            <div key={client.id} onClick={() => router.push(`/clients/${client.id}/brand-kit`)}
              style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.4fr) minmax(160px, auto) 40px", padding: "14px 20px", borderBottom: isLast ? "none" : `0.5px solid ${t.border.default}`, alignItems: "center", cursor: "pointer", transition: "background 150ms" }}
              onMouseEnter={e => e.currentTarget.style.background = t.bg.surfaceHover}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: avatar ? "transparent" : t.bg.surfaceHover, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", fontSize: 12, fontWeight: 500, color: t.text.secondary }}>
                  {avatar ? <img src={avatar} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} /> : (client.company || client.name || "").charAt(0)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: t.text.primary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.company || client.name}</div>
                  <div style={{ fontSize: 11, color: t.text.tertiary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{getClientSubtitle(client)}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                {[0, 1, 2, 3].map(i => colors[i] ? (
                  <div key={i} onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(colors[i]); }} title={`Copy ${colors[i]}`}
                    style={{ width: 18, height: 18, background: colors[i], borderRadius: 3, cursor: "pointer", border: "0.5px solid rgba(0,0,0,0.1)" }} />
                ) : (
                  <div key={i} style={{ width: 18, height: 18, borderRadius: 3, border: `1px dashed ${t.border.default}` }} />
                ))}
              </div>
              <div>
                <span style={{ display: "inline-block", fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 4, background: status.bg, color: status.color }}>{status.label}</span>
              </div>
              <div style={{ textAlign: "right", color: t.text.tertiary, fontSize: 14 }}>›</div>
            </div>
          );
        })}
        {clients.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", fontSize: 13, color: t.text.tertiary }}>No clients yet</div>
        )}
      </div>
    </PageShell>
    </BrandKitLayout>
  );
}
