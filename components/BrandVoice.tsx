"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "@/lib/theme";
import { SectionLabel } from "@/components/shared/Brand";
import supabase from "@/lib/supabase";

const TONE_OPTIONS = ["Professional", "Casual", "Friendly", "Authoritative", "Playful", "Warm", "Editorial", "Technical", "Bold", "Minimal"];

interface BrandVoiceData {
  tone: string;
  industry: string;
  targetCustomer: string;
  valueProps: string[];
  keyPhrases: string[];
  avoidPhrases: string[];
  elevatorPitch: string;
  differentiator: string;
}

const empty: BrandVoiceData = {
  tone: "", industry: "", targetCustomer: "",
  valueProps: [], keyPhrases: [], avoidPhrases: [],
  elevatorPitch: "", differentiator: "",
};

export default function BrandVoice({ clientId }: { clientId: string }) {
  const { t } = useTheme();
  const [voice, setVoice] = useState<BrandVoiceData>(empty);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("clients").select("brand_voice").eq("id", clientId).single();
        if (data?.brand_voice && typeof data.brand_voice === "object") {
          setVoice({ ...empty, ...data.brand_voice });
        }
      } catch {}
      setLoaded(true);
    })();
  }, [clientId]);

  const save = useCallback((updated: BrandVoiceData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await supabase.from("clients").update({ brand_voice: updated }).eq("id", clientId);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e) { console.error("Failed to save brand voice:", e); }
    }, 500);
  }, [clientId]);

  const update = (key: keyof BrandVoiceData, value: any) => {
    const updated = { ...voice, [key]: value };
    setVoice(updated);
    save(updated);
  };

  if (!loaded) return null;

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", fontSize: 13, borderRadius: 8,
    border: `1px solid ${t.border.default}`, background: t.bg.primary,
    color: t.text.primary, fontFamily: "inherit", outline: "none",
    boxSizing: "border-box", transition: "border-color 150ms",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: t.text.secondary, marginBottom: 4, display: "block",
  };

  const focusHandler = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "#2563eb";
    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.08)";
  };
  const blurHandler = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = t.border.default;
    e.currentTarget.style.boxShadow = "none";
  };

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <SectionLabel>Brand Voice</SectionLabel>
        {saved && (
          <span style={{ fontSize: 11, color: t.status.success, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="4 12 9 17 20 6"/></svg>
            Saved
          </span>
        )}
      </div>

      <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: 24 }}>
        {/* Tone selector */}
        <div style={{ marginBottom: 20 }}>
          <div style={labelStyle}>Tone</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TONE_OPTIONS.map(tone => (
              <button
                key={tone} onClick={() => update("tone", tone)}
                style={{
                  padding: "6px 14px", fontSize: 13, borderRadius: 6, cursor: "pointer",
                  fontFamily: "inherit", textTransform: "capitalize" as const,
                  border: voice.tone === tone ? "1px solid #2563eb" : `1px solid ${t.border.default}`,
                  background: voice.tone === tone ? "rgba(37,99,235,0.06)" : "transparent",
                  color: voice.tone === tone ? "#2563eb" : t.text.secondary,
                  transition: "all 150ms",
                }}
              >
                {tone}
              </button>
            ))}
          </div>
        </div>

        {/* Industry + Target customer */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Industry</label>
            <input value={voice.industry} onChange={e => update("industry", e.target.value)}
              placeholder="e.g. Flooring installation" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
          </div>
          <div>
            <label style={labelStyle}>Target customer</label>
            <input value={voice.targetCustomer} onChange={e => update("targetCustomer", e.target.value)}
              placeholder="e.g. Homeowners in Maine" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
          </div>
        </div>

        {/* Elevator pitch */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Elevator pitch</label>
          <textarea
            value={voice.elevatorPitch} onChange={e => update("elevatorPitch", e.target.value)}
            placeholder="1-2 sentences describing what this company does and why customers choose them"
            rows={3}
            style={{ ...inputStyle, resize: "vertical" as const }}
            onFocus={focusHandler as any} onBlur={blurHandler as any}
          />
        </div>

        {/* Value propositions */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Value propositions</label>
          <input
            value={(voice.valueProps || []).join(", ")}
            onChange={e => update("valueProps", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
            placeholder="Free consultations, Fully insured, 25 years experience"
            style={inputStyle} onFocus={focusHandler} onBlur={blurHandler}
          />
          <div style={{ fontSize: 11, color: t.text.tertiary, marginTop: 4 }}>Comma-separated list</div>
        </div>

        {/* Key phrases + Avoid phrases */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Key phrases to use</label>
            <input
              value={(voice.keyPhrases || []).join(", ")}
              onChange={e => update("keyPhrases", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
              placeholder="quality craftsmanship, family-owned"
              style={inputStyle} onFocus={focusHandler} onBlur={blurHandler}
            />
          </div>
          <div>
            <label style={labelStyle}>Phrases to avoid</label>
            <input
              value={(voice.avoidPhrases || []).join(", ")}
              onChange={e => update("avoidPhrases", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
              placeholder="cheap, discount, budget"
              style={inputStyle} onFocus={focusHandler} onBlur={blurHandler}
            />
          </div>
        </div>

        {/* Differentiator */}
        <div>
          <label style={labelStyle}>Competitive differentiator</label>
          <input value={voice.differentiator} onChange={e => update("differentiator", e.target.value)}
            placeholder="What makes this company different from competitors?"
            style={inputStyle} onFocus={focusHandler} onBlur={blurHandler}
          />
        </div>
      </div>
    </div>
  );
}
