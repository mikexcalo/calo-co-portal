"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme";
import { DB, loadClients, loadAllBrandKits } from "@/lib/database";
import { getClientAvatarUrl } from "@/lib/clientAvatar";
import { PageShell, PageHeader, DataCard, SectionLabel, GhostButton } from "@/components/shared/Brand";

export default function BrandKitPage() {
  const { t } = useTheme();
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

  const getLogoCount = (bk: any) => {
    if (!bk?.logos) return 0;
    return ["color", "light", "dark", "icon", "favicon", "secondary"]
      .reduce((n, slot) => n + (bk.logos[slot]?.length || 0), 0);
  };

  const getColorSwatches = (bk: any) => {
    if (!bk?.colors?.length) return [];
    return bk.colors.slice(0, 5).map((c: any) => typeof c === "string" ? c : c?.hex || "#ccc");
  };

  const getVoiceStatus = (client: any) => {
    const v = client.brand_builder_fields?.brandVoice;
    if (!v) return null;
    const filled = [v.purpose, v.audience, v.tone?.length, v.emotion?.length, v.character?.length].filter(Boolean).length;
    return filled;
  };

  const getCompleteness = (client: any) => {
    const bk = client.brandKit;
    let score = 0;
    if (getLogoCount(bk) > 0) score++;
    if (bk?.colors?.length > 0) score++;
    if (bk?.fonts?.heading || bk?.fonts?.body) score++;
    if (getVoiceStatus(client)) score++;
    return score;
  };

  return (
    <PageShell>
      <PageHeader
        title="Brand Kit"
        subtitle="Visual identity and brand voice for your agency and clients"
      />

      {/* ── AGENCY BRAND KIT ── */}
      <SectionLabel>Your Agency</SectionLabel>
      <DataCard>
        <div
          onClick={() => router.push("/agency/brand-kit")}
          style={{ display: "flex", alignItems: "center", gap: 16, cursor: "pointer", padding: "4px 0" }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 10, background: t.bg.surfaceHover,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={t.text.tertiary} strokeWidth="1.3">
              <circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/>
              <line x1="12" y1="3.5" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="20.5"/>
              <line x1="3.5" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="20.5" y2="12"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: t.text.primary }}>CALO&CO</div>
            <div style={{ fontSize: 12, color: t.text.tertiary, marginTop: 1 }}>Agency brand assets and identity</div>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <GhostButton onClick={() => router.push("/agency/brand-kit")}>
              Edit Brand Kit
            </GhostButton>
          </div>
        </div>
      </DataCard>

      {/* ── CLIENT BRAND KITS ── */}
      <div style={{ marginTop: 32 }}>
        <SectionLabel>Clients</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {clients.map((client) => {
            const avatar = getClientAvatarUrl(client);
            const bk = client.brandKit;
            const logoCount = getLogoCount(bk);
            const swatches = getColorSwatches(bk);
            const voiceFields = getVoiceStatus(client);
            const completeness = getCompleteness(client);

            return (
              <DataCard key={client.id}>
                <div
                  onClick={() => router.push(`/clients/${client.id}/brand-kit`)}
                  style={{ display: "flex", alignItems: "center", gap: 16, cursor: "pointer", padding: "4px 0" }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 48, height: 48, borderRadius: 10, overflow: "hidden", flexShrink: 0,
                    background: avatar ? "transparent" : t.bg.surfaceHover,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, fontWeight: 700, color: t.text.secondary,
                  }}>
                    {avatar
                      ? <img src={avatar} alt="" style={{ width: 48, height: 48, objectFit: "contain" }} />
                      : (client.company || client.name || "").charAt(0)
                    }
                  </div>

                  {/* Name + status row */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: t.text.primary, marginBottom: 4 }}>
                      {client.company || client.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      {/* Logo count */}
                      <span style={{ fontSize: 11, color: logoCount > 0 ? t.text.secondary : t.text.tertiary }}>
                        {logoCount > 0 ? `${logoCount} logo${logoCount > 1 ? "s" : ""}` : "No logos"}
                      </span>

                      {/* Color swatches */}
                      {swatches.length > 0 && (
                        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                          {swatches.map((hex: string, i: number) => (
                            <div key={i} style={{ width: 12, height: 12, borderRadius: 3, background: hex, border: `0.5px solid ${t.border.default}` }} />
                          ))}
                          {(bk?.colors?.length || 0) > 5 && (
                            <span style={{ fontSize: 10, color: t.text.tertiary, marginLeft: 2 }}>+{bk.colors.length - 5}</span>
                          )}
                        </div>
                      )}

                      {/* Voice status */}
                      <span style={{ fontSize: 11, color: voiceFields ? t.status.success : t.text.tertiary }}>
                        {voiceFields ? `Voice: ${voiceFields}/5` : "No voice profile"}
                      </span>
                    </div>
                  </div>

                  {/* Completeness indicator */}
                  <div style={{ display: "flex", gap: 3, flexShrink: 0, marginRight: 8 }}>
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: i < completeness ? t.status.success : t.border.default,
                        transition: "background 150ms",
                      }} />
                    ))}
                  </div>

                  {/* Chevron */}
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={t.text.tertiary} strokeWidth="1.5" style={{ flexShrink: 0 }}>
                    <path d="M6 4l4 4-4 4"/>
                  </svg>
                </div>
              </DataCard>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
