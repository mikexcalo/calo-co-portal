"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "@/lib/theme";
import supabase from "@/lib/supabase";

interface ToneEntry { name: string; priority: number; }

interface BrandVoiceData {
  tone?: string;
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

export default function AgencyBrandIdentity() {
  const { t } = useTheme();
  const [voice, setVoice] = useState<BrandVoiceData>(empty);
  const [tones, setTones] = useState<ToneEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("agency_settings").select("brand_voice").eq("id", 1).single();
        if (data?.brand_voice && typeof data.brand_voice === "object") {
          const v = { ...empty, ...data.brand_voice };
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
  const [keyPhraseInput, setKeyPhraseInput] = useState("");
  const [avoidPhraseInput, setAvoidPhraseInput] = useState("");

  const addTone = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
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

  const addKeyPhrase = (phrase: string) => {
    const trimmed = phrase.trim();
    if (!trimmed) return;
    const current = voice.keyPhrases || [];
    if (current.find(p => p.toLowerCase() === trimmed.toLowerCase())) return;
    update("keyPhrases", [...current, trimmed]);
  };

  const removeKeyPhrase = (phrase: string) => {
    update("keyPhrases", (voice.keyPhrases || []).filter(p => p !== phrase));
  };

  const addAvoidPhrase = (phrase: string) => {
    const trimmed = phrase.trim();
    if (!trimmed) return;
    const current = voice.avoidPhrases || [];
    if (current.find(p => p.toLowerCase() === trimmed.toLowerCase())) return;
    update("avoidPhrases", [...current, trimmed]);
  };

  const removeAvoidPhrase = (phrase: string) => {
    update("avoidPhrases", (voice.avoidPhrases || []).filter(p => p !== phrase));
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
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 16 }}>
        {saved && <span style={{ fontSize: 11, color: t.status.success, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="4 12 9 17 20 6"/></svg>Saved</span>}
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0, color: t.text.primary, marginBottom: 12 }}>Identity</div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Elevator pitch</label>
        <textarea value={voice.elevatorPitch} onChange={e => update("elevatorPitch", e.target.value)} placeholder="One sentence: who you serve and what changes" rows={3} style={{ ...inputStyle, resize: "vertical" as const }} onFocus={focusH as any} onBlur={blurH as any} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Value propositions</label>
        <input value={(voice.valueProps || []).join(", ")} onChange={e => update("valueProps", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} placeholder="Fast, strategic, no-BS" style={inputStyle} onFocus={focusH} onBlur={blurH} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Competitive differentiator</label>
        <input value={voice.differentiator} onChange={e => update("differentiator", e.target.value)} placeholder="What others can't say about themselves" style={inputStyle} onFocus={focusH} onBlur={blurH} />
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0, color: t.text.primary, marginTop: 24, marginBottom: 12 }}>Audience</div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Target customer</label>
        <input value={voice.targetCustomer} onChange={e => update("targetCustomer", e.target.value)} placeholder="The person writing the check" style={inputStyle} onFocus={focusH} onBlur={blurH} />
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0, color: t.text.primary, marginTop: 24, marginBottom: 12 }}>Tone</div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Tone</label>
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
          <input
            value={toneInput}
            onChange={e => setToneInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTone(toneInput); setToneInput(""); } }}
            placeholder="Add a tone..."
            style={{ ...inputStyle, width: 160 }}
            onFocus={focusH}
            onBlur={blurH}
          />
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: t.text.primary, marginTop: 32, marginBottom: 12, letterSpacing: 0 }}>Language</div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Key phrases to use</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {(voice.keyPhrases || []).map(phrase => (
            <span key={phrase} style={{
              padding: "6px 14px", fontSize: 13, borderRadius: 6, fontFamily: "inherit",
              border: `1px solid ${t.border.default}`, background: t.bg.surface, color: t.text.primary,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              {phrase}
              <button onClick={() => removeKeyPhrase(phrase)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: t.text.tertiary, fontSize: 14, lineHeight: 1, fontFamily: "inherit", display: "flex", alignItems: "center" }}>&times;</button>
            </span>
          ))}
          <input
            value={keyPhraseInput}
            onChange={e => setKeyPhraseInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addKeyPhrase(keyPhraseInput); setKeyPhraseInput(""); } }}
            placeholder="e.g. spine, ship, scale"
            style={{ ...inputStyle, width: 180 }}
            onFocus={focusH}
            onBlur={blurH}
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Phrases to avoid</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {(voice.avoidPhrases || []).map(phrase => (
            <span key={phrase} style={{
              padding: "6px 14px", fontSize: 13, borderRadius: 6, fontFamily: "inherit",
              border: "1px solid rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.04)", color: "#dc2626",
              display: "inline-flex", alignItems: "center", gap: 6,
              textDecoration: "line-through", textDecorationColor: "rgba(220,38,38,0.4)",
            }}>
              {phrase}
              <button onClick={() => removeAvoidPhrase(phrase)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#dc2626", fontSize: 14, lineHeight: 1, fontFamily: "inherit", display: "flex", alignItems: "center", textDecoration: "none" }}>&times;</button>
            </span>
          ))}
          <input
            value={avoidPhraseInput}
            onChange={e => setAvoidPhraseInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAvoidPhrase(avoidPhraseInput); setAvoidPhraseInput(""); } }}
            placeholder="e.g. synergy, leverage, cutting-edge"
            style={{ ...inputStyle, width: 180 }}
            onFocus={focusH}
            onBlur={blurH}
          />
        </div>
      </div>
    </div>
  );
}
