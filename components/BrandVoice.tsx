"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "@/lib/theme";
import { SectionLabel } from "@/components/shared/Brand";
import supabase from "@/lib/supabase";

const TONE_OPTIONS = ["Warm", "Editorial", "Professional", "Friendly", "Authoritative", "Casual", "Technical", "Playful", "Bold", "Minimal"];
const EMOTION_OPTIONS = ["Confident", "Inviting", "Trustworthy", "Bold", "Curious", "Calm", "Energetic", "Sophisticated", "Approachable"];
const CHARACTER_OPTIONS = ["Sophisticated friend", "Knowledgeable guide", "Trusted advisor", "Straight shooter", "Creative partner", "Trusted curator", "Industry insider"];

interface BrandVoiceData {
  purpose: string;
  audience: string;
  tone: string[];
  emotion: string[];
  character: string[];
  styleNotes: string;
}

const empty: BrandVoiceData = { purpose: "", audience: "", tone: [], emotion: [], character: [], styleNotes: "" };

function TagPicker({ options, selected, onChange, label }: { options: string[]; selected: string[]; onChange: (v: string[]) => void; label: string }) {
  const { t } = useTheme();
  const [custom, setCustom] = useState("");

  const toggle = (tag: string) => {
    onChange(selected.includes(tag) ? selected.filter((s) => s !== tag) : [...selected, tag]);
  };

  const addCustom = () => {
    if (custom.trim() && !selected.includes(custom.trim())) {
      onChange([...selected, custom.trim()]);
      setCustom("");
    }
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: t.text.secondary, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt} onClick={() => toggle(opt)}
              style={{
                padding: "5px 12px", fontSize: 12, fontWeight: 500, borderRadius: 6,
                border: `1px solid ${active ? "#6366f1" : t.border.default}`,
                background: active ? "rgba(99,102,241,0.08)" : "transparent",
                color: active ? "#6366f1" : t.text.secondary,
                cursor: "pointer", fontFamily: "inherit", transition: "all 150ms",
              }}
            >
              {opt}
            </button>
          );
        })}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            value={custom} onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
            placeholder="+ Add"
            style={{
              width: 72, padding: "5px 8px", fontSize: 12, borderRadius: 6,
              border: `1px dashed ${t.border.default}`, background: "transparent",
              color: t.text.primary, fontFamily: "inherit", outline: "none",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function BrandVoice({ clientId }: { clientId: string }) {
  const { t } = useTheme();
  const [voice, setVoice] = useState<BrandVoiceData>(empty);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<any>(null);

  // Load
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("clients").select("brand_builder_fields").eq("id", clientId).single();
        if (data?.brand_builder_fields?.brandVoice) {
          setVoice({ ...empty, ...data.brand_builder_fields.brandVoice });
        }
      } catch (e) {}
      setLoaded(true);
    })();
  }, [clientId]);

  // Auto-save with debounce
  const save = useCallback((updated: BrandVoiceData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const { data } = await supabase.from("clients").select("brand_builder_fields").eq("id", clientId).single();
        const existing = data?.brand_builder_fields || {};
        await supabase.from("clients").update({
          brand_builder_fields: { ...existing, brandVoice: updated }
        }).eq("id", clientId);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e) {}
    }, 800);
  }, [clientId]);

  const update = (field: keyof BrandVoiceData, value: any) => {
    const updated = { ...voice, [field]: value };
    setVoice(updated);
    save(updated);
  };

  if (!loaded) return null;

  const textareaStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", fontSize: 13, borderRadius: 8,
    border: `1px solid ${t.border.default}`, background: t.bg.primary,
    color: t.text.primary, fontFamily: "inherit", outline: "none", resize: "vertical",
    boxSizing: "border-box", transition: "border-color 150ms",
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
        {/* Purpose */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: t.text.secondary, marginBottom: 4 }}>Purpose</div>
          <div style={{ fontSize: 11, color: t.text.tertiary, marginBottom: 6 }}>Why does this brand communicate? What&apos;s the goal?</div>
          <textarea
            value={voice.purpose} onChange={(e) => update("purpose", e.target.value)}
            placeholder="Connect with homeowners who need reliable, high-quality flooring installation..."
            rows={2}
            style={textareaStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#2563eb"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = t.border.default; }}
          />
        </div>

        {/* Audience */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: t.text.secondary, marginBottom: 4 }}>Audience</div>
          <div style={{ fontSize: 11, color: t.text.tertiary, marginBottom: 6 }}>Who are they talking to?</div>
          <textarea
            value={voice.audience} onChange={(e) => update("audience", e.target.value)}
            placeholder="Homeowners in the Portland metro area looking for professional flooring services..."
            rows={2}
            style={textareaStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#2563eb"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = t.border.default; }}
          />
        </div>

        {/* Tone */}
        <TagPicker label="Tone" options={TONE_OPTIONS} selected={voice.tone} onChange={(v) => update("tone", v)} />

        {/* Emotion */}
        <TagPicker label="Emotion" options={EMOTION_OPTIONS} selected={voice.emotion} onChange={(v) => update("emotion", v)} />

        {/* Character */}
        <TagPicker label="Character" options={CHARACTER_OPTIONS} selected={voice.character} onChange={(v) => update("character", v)} />

        {/* Style Notes */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: t.text.secondary, marginBottom: 4 }}>Style Notes</div>
          <div style={{ fontSize: 11, color: t.text.tertiary, marginBottom: 6 }}>Specific do&apos;s and don&apos;ts for this brand&apos;s copy.</div>
          <textarea
            value={voice.styleNotes} onChange={(e) => update("styleNotes", e.target.value)}
            placeholder="Always lead with the benefit. Never use exclamation marks. Use 'we' not 'I'..."
            rows={3}
            style={textareaStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#2563eb"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = t.border.default; }}
          />
        </div>
      </div>
    </div>
  );
}
