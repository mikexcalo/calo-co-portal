"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme";
import { DB, loadClients, loadAllBrandKits } from "@/lib/database";
import { getClientAvatarUrl } from "@/lib/clientAvatar";
import { PageShell, PageHeader, SectionLabel } from "@/components/shared/Brand";

const HELM_PALETTE = ["#006AFF", "#00C9A0", "#0EA8C1", "#DC2626", "#111113"];

function getStatusLine(client: any) {
  const bk = client.brandKit;
  const hasLogos = bk?.logos && ["color", "light", "dark", "icon"].some((s: string) => bk.logos[s]?.length > 0);
  const hasColors = bk?.colors?.length >= 2;
  const hasVoice = !!(client.brand_voice || client.brand_builder_fields?.brandVoice);
  const tagline = client.brand_builder_fields?.tagline || "";
  const complete = [hasLogos, hasColors, hasVoice, !!tagline].filter(Boolean).length;
  if (complete === 4) return tagline || "Complete";
  if (complete === 0) return "Needs everything";
  const missing: string[] = [];
  if (!hasLogos) missing.push("logos");
  if (!hasColors) missing.push("colors");
  if (!hasVoice) missing.push("voice");
  if (!tagline) missing.push("tagline");
  if (missing.length === 1) return `Needs ${missing[0]}`;
  if (missing.length === 2) return `Needs ${missing[0]} and ${missing[1]}`;
  return `Needs ${missing.length} items`;
}

function getSwatches(bk: any): string[] {
  if (!bk?.colors?.length) return [];
  return bk.colors.slice(0, 4).map((c: any) => typeof c === "string" ? c : c?.hex || "#ccc");
}

function getLogoFiles(bk: any): { url: string; name: string }[] {
  if (!bk?.logos) return [];
  const files: any[] = [];
  for (const slot of ["color", "light", "dark", "icon"]) {
    for (const f of (bk.logos[slot] || [])) {
      if (f.data) files.push({ url: f.data, name: f.name || slot });
    }
  }
  return files.slice(0, 4);
}

export default function BrandKitPage() {
  const { t } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [preview, setPreview] = useState<any>(null);

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
  const agencyColors = agencyBk?.colors?.length ? agencyBk.colors.slice(0, 6).map((c: any) => typeof c === "string" ? c : c?.hex) : HELM_PALETTE;

  return (
    <PageShell>
      <PageHeader title="Brand Kit" subtitle="Visual identity and brand voice for your agency and clients" />

      {/* ── HERO AGENCY CARD ── */}
      <SectionLabel>Your Agency</SectionLabel>
      <div style={{ background: t.bg.surface, border: `0.5px solid ${t.border.default}`, borderRadius: 12, padding: 32, marginBottom: 40 }}>
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          <div style={{ width: 64, height: 64, borderRadius: 12, background: t.bg.surfaceHover, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={t.text.tertiary} strokeWidth="1.3"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="3.5" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="20.5"/><line x1="3.5" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="20.5" y2="12"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {agencyColors.map((hex: string) => (
                <div key={hex} style={{ textAlign: "center" }}>
                  <div onClick={() => navigator.clipboard.writeText(hex)} style={{ width: 32, height: 32, background: hex, borderRadius: 6, cursor: "pointer", border: "0.5px solid rgba(0,0,0,0.1)" }} title={`Click to copy ${hex}`} />
                  <div style={{ fontSize: 10, color: t.text.tertiary, marginTop: 4, fontFamily: "monospace" }}>{hex}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 18, fontWeight: 500, color: t.text.primary }}>CALO&CO</div>
            <div style={{ fontSize: 14, color: t.text.secondary, marginTop: 2 }}>Your trusted GTM partner</div>
          </div>
          <button onClick={() => router.push("/agency/brand-kit")} style={{ background: "transparent", border: `0.5px solid ${t.border.default}`, borderRadius: 6, padding: "8px 14px", fontSize: 13, color: t.text.primary, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, transition: "all 150ms" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = t.bg.surfaceHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
            Open Full Brand Kit →
          </button>
        </div>
      </div>

      {/* ── CLIENT GRID ── */}
      <SectionLabel>Clients</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {clients.map((client) => {
          const avatar = getClientAvatarUrl(client);
          const swatches = getSwatches(client.brandKit);
          const statusLine = getStatusLine(client);
          return (
            <div key={client.id} onClick={() => setPreview(client)}
              style={{ background: t.bg.surface, border: `0.5px solid ${t.border.default}`, borderRadius: 12, padding: 20, cursor: "pointer", transition: "border-color 150ms" }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = t.border.hover}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = t.border.default}>
              <div style={{ width: 48, height: 48, borderRadius: 10, overflow: "hidden", background: avatar ? "transparent" : t.bg.surfaceHover, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, fontSize: 16, fontWeight: 700, color: t.text.secondary }}>
                {avatar ? <img src={avatar} alt="" style={{ width: 48, height: 48, objectFit: "contain" }} /> : (client.company || client.name || "").charAt(0)}
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                {[0, 1, 2, 3].map(i => swatches[i] ? (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(swatches[i]); }}
                      style={{ width: 28, height: 28, background: swatches[i], borderRadius: 5, cursor: "pointer", border: "0.5px solid rgba(0,0,0,0.1)" }} title={`Copy ${swatches[i]}`} />
                    <div style={{ fontSize: 10, color: t.text.secondary, fontFamily: "monospace", letterSpacing: "-0.2px", fontWeight: 500 }}>{swatches[i].toUpperCase()}</div>
                  </div>
                ) : (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 5, border: `1px dashed ${t.border.default}` }} />
                    <div style={{ fontSize: 9, color: "transparent" }}>······</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: t.text.primary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.company || client.name}</div>
                  <div style={{ fontSize: 12, color: t.text.tertiary, marginTop: 2 }}>{statusLine}</div>
                </div>
                <div onClick={(e) => { e.stopPropagation(); router.push(`/clients/${client.id}/brand-kit`); }}
                  style={{ color: t.text.tertiary, fontSize: 16, flexShrink: 0, padding: 8, cursor: "pointer" }}>→</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── QUICK-PREVIEW MODAL ── */}
      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: t.bg.surface, borderRadius: 12, padding: 32, maxWidth: 520, width: "90%", maxHeight: "80vh", overflowY: "auto", position: "relative" }}>
            <button onClick={() => setPreview(null)} style={{ position: "absolute", top: 16, right: 16, background: "transparent", border: "none", cursor: "pointer", color: t.text.tertiary, fontSize: 20, fontFamily: "inherit" }}>×</button>
            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 24 }}>
              <div style={{ width: 56, height: 56, borderRadius: 12, overflow: "hidden", background: getClientAvatarUrl(preview) ? "transparent" : t.bg.surfaceHover, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: t.text.secondary }}>
                {getClientAvatarUrl(preview) ? <img src={getClientAvatarUrl(preview)!} alt="" style={{ width: 56, height: 56, objectFit: "contain" }} /> : (preview.company || "").charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 500, color: t.text.primary }}>{preview.company || preview.name}</div>
                <div style={{ fontSize: 13, color: t.text.secondary }}>{preview.brand_builder_fields?.tagline || "No tagline yet"}</div>
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: t.text.tertiary, textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: 10 }}>Colors</div>
              {getSwatches(preview.brandKit).length ? (
                <div style={{ display: "flex", gap: 12 }}>
                  {getSwatches(preview.brandKit).map((hex: string) => (
                    <div key={hex} style={{ textAlign: "center", cursor: "pointer" }} onClick={() => navigator.clipboard.writeText(hex)}>
                      <div style={{ width: 48, height: 48, background: hex, borderRadius: 8, marginBottom: 6, border: "0.5px solid rgba(0,0,0,0.1)" }} />
                      <div style={{ fontSize: 11, fontFamily: "monospace", color: t.text.secondary }}>{hex}</div>
                    </div>
                  ))}
                </div>
              ) : <div style={{ fontSize: 13, color: t.text.tertiary }}>No colors set</div>}
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: t.text.tertiary, textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: 10 }}>Logos</div>
              {getLogoFiles(preview.brandKit).length ? (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {getLogoFiles(preview.brandKit).map((logo, i) => (
                    <div key={i} style={{ width: 72, height: 72, background: t.bg.primary, borderRadius: 8, border: `0.5px solid ${t.border.default}`, display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}>
                      <img src={logo.url} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                    </div>
                  ))}
                </div>
              ) : <div style={{ fontSize: 13, color: t.text.tertiary }}>No logos uploaded</div>}
            </div>
            <button onClick={() => { setPreview(null); router.push(`/clients/${preview.id}/brand-kit`); }}
              style={{ width: "100%", background: t.accent.primary, color: "#fff", border: "none", borderRadius: 8, padding: "12px 16px", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "background 150ms" }}
              onMouseEnter={(e) => e.currentTarget.style.background = t.accent.primaryHover}
              onMouseLeave={(e) => e.currentTarget.style.background = t.accent.primary}>
              Open full Brand Kit →
            </button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
