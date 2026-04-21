"use client";

import { useState } from "react";
import { useTheme } from "@/lib/theme";
import { PageShell, PageHeader } from "@/components/shared/Brand";

export default function RewriterPage() {
  const { t } = useTheme();
  const [rewriteInput, setRewriteInput] = useState("");
  const [rewriteOutput, setRewriteOutput] = useState("");
  const [rewriting, setRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleRewrite = async () => {
    if (!rewriteInput.trim() || rewriting) return;
    setRewriting(true);
    setRewriteError("");
    setRewriteOutput("");
    try {
      const res = await fetch("/api/rewrite-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rewriteInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRewriteError(data.error || "Rewrite failed");
      } else {
        setRewriteOutput(data.rewritten || "");
      }
    } catch (err: any) {
      setRewriteError(err.message || "Rewrite failed");
    } finally {
      setRewriting(false);
    }
  };

  const handleCopy = async () => {
    if (!rewriteOutput) return;
    try {
      await navigator.clipboard.writeText(rewriteOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", fontSize: 13, borderRadius: 8,
    border: `1px solid ${t.border.default}`, background: t.bg.primary,
    color: t.text.primary, fontFamily: "inherit", outline: "none",
    boxSizing: "border-box", transition: "border-color 150ms",
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: t.text.secondary, marginBottom: 4, display: "block" };
  const focusH = (e: React.FocusEvent<HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.08)"; };
  const blurH = (e: React.FocusEvent<HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = t.border.default; e.currentTarget.style.boxShadow = "none"; };

  return (
    <PageShell>
      <PageHeader title="Rewriter" subtitle="Rewrite any text in your brand voice" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Input</label>
          <textarea value={rewriteInput} onChange={e => setRewriteInput(e.target.value)} placeholder="Paste an email draft, a tagline, a paragraph..." rows={12} style={{ ...inputStyle, resize: "vertical" as const, minHeight: 280 }} onFocus={focusH} onBlur={blurH} />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <label style={labelStyle}>In your voice</label>
            {rewriteOutput && <button onClick={handleCopy} style={{ fontSize: 11, color: copied ? t.status.success : t.text.tertiary, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>{copied ? "Copied" : "Copy"}</button>}
          </div>
          <textarea value={rewriteOutput} readOnly placeholder={rewriting ? "Rewriting..." : "Rewritten text appears here..."} rows={12} style={{ ...inputStyle, resize: "vertical" as const, minHeight: 280, background: t.bg.surfaceHover || t.bg.surface, color: rewriteOutput ? t.text.primary : t.text.tertiary }} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={handleRewrite} disabled={!rewriteInput.trim() || rewriting} style={{ padding: "10px 20px", fontSize: 13, fontWeight: 500, borderRadius: 6, border: "none", fontFamily: "inherit", cursor: (!rewriteInput.trim() || rewriting) ? "default" : "pointer", background: (!rewriteInput.trim() || rewriting) ? t.bg.surfaceHover : "#2563eb", color: (!rewriteInput.trim() || rewriting) ? t.text.tertiary : "#fff", transition: "all 150ms" }}>{rewriting ? "Rewriting..." : "Rewrite in voice"}</button>
        {rewriteError && <span style={{ fontSize: 12, color: "#dc2626" }}>{rewriteError}</span>}
      </div>
    </PageShell>
  );
}
