"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "@/lib/theme";
import { SectionLabel } from "@/components/shared/Brand";
import supabase from "@/lib/supabase";

interface ToneEntry { name: string; priority: number; }

interface BrandVoiceData {
  tone?: string; // legacy single-tone
  tones?: ToneEntry[];
  industry: string;
  targetCustomer: string;
  valueProps: string[];
  keyPhrases: string[];
  avoidPhrases: string[];
  elevatorPitch: string;
  differentiator: string;
}

const empty: BrandVoiceData = {
  tones: [], industry: "", targetCustomer: "",
  valueProps: [], keyPhrases: [], avoidPhrases: [],
  elevatorPitch: "", differentiator: "",
};

function SuggestionRow({ label, value, onAccept, t }: { label: string; value: string; onAccept: () => void; t: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 0", borderBottom: `0.5px solid ${t.border.default}`, gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: t.text.tertiary, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, color: t.text.primary }}>{value}</div>
      </div>
      <button onClick={onAccept} style={{ padding: "3px 10px", fontSize: 11, fontWeight: 500, borderRadius: 4, border: `0.5px solid ${t.border.default}`, background: t.bg.surface, color: t.text.secondary, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Accept</button>
    </div>
  );
}

export default function AgencyBrandVoice() {
  const { t } = useTheme();
  const [voice, setVoice] = useState<BrandVoiceData>(empty);
  const [tones, setTones] = useState<ToneEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<any>(null);

  // AI analysis state
  const [sourceText, setSourceText] = useState("");
  const [sourceType, setSourceType] = useState<"transcript" | "website" | "copy" | "other">("transcript");
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("agency_settings").select("brand_voice").eq("id", 1).single();
        if (data?.brand_voice && typeof data.brand_voice === "object") {
          const v = { ...empty, ...data.brand_voice };
          // Migrate old single-tone to tones array
          if (v.tone && typeof v.tone === "string" && (!v.tones || v.tones.length === 0)) {
            v.tones = [{ name: v.tone, priority: 1 }];
          }
          setVoice(v);
          setTones(v.tones || []);
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const save = useCallback((updated: BrandVoiceData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await supabase.from("agency_settings").update({ brand_voice: updated }).eq("id", 1);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e) { console.error("Failed to save brand voice:", e); }
    }, 500);
  }, []);

  const update = (key: string, value: any) => {
    const updated = { ...voice, [key]: value };
    setVoice(updated);
    save(updated);
  };

  const [toneInput, setToneInput] = useState("");

  const addTone = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || tones.length >= 3) return;
    if (tones.find(t => t.name.toLowerCase() === trimmed.toLowerCase())) return;
    const updated = [...tones, { name: trimmed, priority: tones.length + 1 }];
    setTones(updated);
    const v = { ...voice, tones: updated };
    setVoice(v);
    save(v);
  };

  const removeTone = (name: string) => {
    const updated = tones.filter(t => t.name.toLowerCase() !== name.toLowerCase())
      .sort((a, b) => a.priority - b.priority)
      .map((t, i) => ({ ...t, priority: i + 1 }));
    setTones(updated);
    const v = { ...voice, tones: updated };
    setVoice(v);
    save(v);
  };

  const handleAnalyze = async () => {
    if (!sourceText.trim() || sourceText.length < 50) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: sourceText, sourceType }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      setSuggestions(await res.json());
    } catch (err) { console.error(err); }
    finally { setAnalyzing(false); }
  };

  const acceptAll = () => {
    if (!suggestions) return;
    const updates: Record<string, any> = {};
    if (suggestions.tones) { setTones(suggestions.tones); updates.tones = suggestions.tones; }
    if (suggestions.industry) updates.industry = suggestions.industry;
    if (suggestions.targetCustomer) updates.targetCustomer = suggestions.targetCustomer;
    if (suggestions.elevatorPitch) updates.elevatorPitch = suggestions.elevatorPitch;
    if (suggestions.valueProps) updates.valueProps = suggestions.valueProps;
    if (suggestions.keyPhrases) updates.keyPhrases = suggestions.keyPhrases;
    if (suggestions.avoidPhrases) updates.avoidPhrases = suggestions.avoidPhrases;
    if (suggestions.differentiator) updates.differentiator = suggestions.differentiator;
    const merged = { ...voice, ...updates };
    setVoice(merged);
    save(merged);
    setSuggestions(null);
    setSourceText("");
  };

  if (!loaded) return null;

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", fontSize: 13, borderRadius: 8,
    border: `1px solid ${t.border.default}`, background: t.bg.primary,
    color: t.text.primary, fontFamily: "inherit", outline: "none",
    boxSizing: "border-box", transition: "border-color 150ms",
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: t.text.secondary, marginBottom: 4, display: "block" };
  const focusH = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.08)"; };
  const blurH = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = t.border.default; e.currentTarget.style.boxShadow = "none"; };

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <SectionLabel>Brand Voice</SectionLabel>
        {saved && <span style={{ fontSize: 11, color: t.status.success, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="4 12 9 17 20 6"/></svg>Saved</span>}
      </div>

      <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: 24 }}>

        {/* ── AI Source Analysis ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={labelStyle}>Analyze a source</span>
            <div style={{ display: "flex", gap: 4 }}>
              {(["transcript", "website", "copy", "other"] as const).map(st => (
                <button key={st} onClick={() => setSourceType(st)} style={{
                  padding: "3px 10px", fontSize: 11, borderRadius: 4, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" as const,
                  border: sourceType === st ? "1px solid #2563eb" : `1px solid ${t.border.default}`,
                  background: sourceType === st ? "rgba(37,99,235,0.04)" : "transparent",
                  color: sourceType === st ? "#2563eb" : t.text.tertiary,
                }}>{st}</button>
              ))}
            </div>
          </div>
          <textarea value={sourceText} onChange={e => setSourceText(e.target.value)}
            placeholder={sourceType === "transcript" ? "Paste a call transcript, meeting notes, or sales conversation..." : sourceType === "website" ? "Paste website copy or about page text..." : sourceType === "copy" ? "Paste existing marketing copy, emails, or social posts..." : "Paste any content that represents this brand's voice..."}
            rows={4} style={{ ...inputStyle, resize: "vertical" as const }} onFocus={focusH as any} onBlur={blurH as any} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <span style={{ fontSize: 11, color: t.text.tertiary }}>{sourceText.length < 50 ? `${50 - sourceText.length} more characters needed` : `${sourceText.length} characters`}</span>
            <button onClick={handleAnalyze} disabled={analyzing || sourceText.length < 50} style={{
              padding: "6px 16px", fontSize: 13, fontWeight: 500, borderRadius: 6, border: "none", fontFamily: "inherit", transition: "all 150ms",
              cursor: analyzing || sourceText.length < 50 ? "default" : "pointer",
              background: analyzing || sourceText.length < 50 ? t.bg.surfaceHover : "#2563eb",
              color: analyzing || sourceText.length < 50 ? t.text.tertiary : "#fff",
            }}>{analyzing ? "Analyzing..." : "Analyze voice"}</button>
          </div>
        </div>

        {/* ── AI Suggestions ── */}
        {suggestions && (
          <div style={{ background: t.bg.surfaceHover, border: `0.5px solid ${t.border.default}`, borderRadius: 10, padding: 16, marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: t.text.primary }}>Suggestions from {sourceType}</span>
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase" as const, padding: "2px 8px", borderRadius: 4, background: suggestions.confidence === "high" ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)", color: suggestions.confidence === "high" ? t.status.success : t.status.warning }}>{suggestions.confidence} confidence</span>
            </div>
            {suggestions.reasoning && <div style={{ fontSize: 12, color: t.text.tertiary, marginBottom: 12, fontStyle: "italic" }}>{suggestions.reasoning}</div>}
            {suggestions.tones && <SuggestionRow t={t} label="Tones" value={suggestions.tones.map((tn: any) => `${tn.priority}. ${tn.name}`).join(", ")} onAccept={() => { setTones(suggestions.tones); update("tones", suggestions.tones); }} />}
            {suggestions.industry && <SuggestionRow t={t} label="Industry" value={suggestions.industry} onAccept={() => update("industry", suggestions.industry)} />}
            {suggestions.targetCustomer && <SuggestionRow t={t} label="Target customer" value={suggestions.targetCustomer} onAccept={() => update("targetCustomer", suggestions.targetCustomer)} />}
            {suggestions.elevatorPitch && <SuggestionRow t={t} label="Elevator pitch" value={suggestions.elevatorPitch} onAccept={() => update("elevatorPitch", suggestions.elevatorPitch)} />}
            {suggestions.valueProps?.length > 0 && <SuggestionRow t={t} label="Value props" value={suggestions.valueProps.join(", ")} onAccept={() => update("valueProps", suggestions.valueProps)} />}
            {suggestions.keyPhrases?.length > 0 && <SuggestionRow t={t} label="Key phrases" value={suggestions.keyPhrases.join(", ")} onAccept={() => update("keyPhrases", suggestions.keyPhrases)} />}
            {suggestions.differentiator && <SuggestionRow t={t} label="Differentiator" value={suggestions.differentiator} onAccept={() => update("differentiator", suggestions.differentiator)} />}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={acceptAll} style={{ padding: "6px 16px", fontSize: 13, fontWeight: 500, borderRadius: 6, border: "none", cursor: "pointer", background: "#2563eb", color: "#fff", fontFamily: "inherit" }}>Accept all</button>
              <button onClick={() => setSuggestions(null)} style={{ padding: "6px 16px", fontSize: 13, fontWeight: 500, borderRadius: 6, border: `1px solid ${t.border.default}`, cursor: "pointer", background: "transparent", color: t.text.secondary, fontFamily: "inherit" }}>Dismiss</button>
            </div>
          </div>
        )}

        {/* ── Tone Chips ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={labelStyle}>Tone</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {[...tones].sort((a, b) => a.priority - b.priority).map(tone => (
              <span key={tone.name} style={{
                padding: "6px 14px", fontSize: 13, borderRadius: 6, fontFamily: "inherit", position: "relative" as const,
                border: "1.5px solid #2563eb", background: "rgba(37,99,235,0.04)", color: "#2563eb",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                {tone.name}
                <span style={{ position: "absolute", top: -6, right: -6, width: 16, height: 16, borderRadius: "50%", background: "#2563eb", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{tone.priority}</span>
                <button onClick={() => removeTone(tone.name)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#2563eb", fontSize: 14, lineHeight: 1, fontFamily: "inherit", display: "flex", alignItems: "center" }}>&times;</button>
              </span>
            ))}
            {tones.length < 3 && (
              <input
                value={toneInput}
                onChange={e => setToneInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTone(toneInput); setToneInput(""); } }}
                placeholder="Add a tone..."
                style={{ ...inputStyle, width: 160 }}
                onFocus={focusH}
                onBlur={blurH}
              />
            )}
          </div>
          <div style={{ fontSize: 11, color: t.text.tertiary, marginTop: 6 }}>
            {tones.length === 0 ? "Type a tone and hit Enter (e.g. Confident, Playful)" : tones.length === 1 ? "Add up to 2 more tones in priority order" : tones.length === 2 ? "Add 1 more for an accent tone (optional)" : "3 tones set — click \u00d7 to remove"}
          </div>
        </div>

        {/* ── Manual Fields ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div><label style={labelStyle}>Industry</label><input value={voice.industry} onChange={e => update("industry", e.target.value)} placeholder="e.g. Flooring installation" style={inputStyle} onFocus={focusH} onBlur={blurH} /></div>
          <div><label style={labelStyle}>Target customer</label><input value={voice.targetCustomer} onChange={e => update("targetCustomer", e.target.value)} placeholder="e.g. Homeowners in Maine" style={inputStyle} onFocus={focusH} onBlur={blurH} /></div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Elevator pitch</label>
          <textarea value={voice.elevatorPitch} onChange={e => update("elevatorPitch", e.target.value)} placeholder="1-2 sentences describing what this company does and why customers choose them" rows={3} style={{ ...inputStyle, resize: "vertical" as const }} onFocus={focusH as any} onBlur={blurH as any} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Value propositions</label>
          <input value={(voice.valueProps || []).join(", ")} onChange={e => update("valueProps", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} placeholder="Free consultations, Fully insured, 25 years experience" style={inputStyle} onFocus={focusH} onBlur={blurH} />
          <div style={{ fontSize: 11, color: t.text.tertiary, marginTop: 4 }}>Comma-separated list</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div><label style={labelStyle}>Key phrases to use</label><input value={(voice.keyPhrases || []).join(", ")} onChange={e => update("keyPhrases", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} placeholder="quality craftsmanship, family-owned" style={inputStyle} onFocus={focusH} onBlur={blurH} /></div>
          <div><label style={labelStyle}>Phrases to avoid</label><input value={(voice.avoidPhrases || []).join(", ")} onChange={e => update("avoidPhrases", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} placeholder="cheap, discount, budget" style={inputStyle} onFocus={focusH} onBlur={blurH} /></div>
        </div>
        <div><label style={labelStyle}>Competitive differentiator</label><input value={voice.differentiator} onChange={e => update("differentiator", e.target.value)} placeholder="What makes this company different from competitors?" style={inputStyle} onFocus={focusH} onBlur={blurH} /></div>
      </div>
    </div>
  );
}
