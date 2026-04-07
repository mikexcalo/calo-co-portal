"use client";
import { ReactNode } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/lib/theme";

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } } };
const spring = { type: "spring" as const, stiffness: 400, damping: 25 };

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" style={{ padding: 32, maxWidth: 960 }}>
      {children}
    </motion.div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  const { t } = useTheme();
  return (
    <motion.div variants={fadeUp} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 400, margin: "0 0 2px", color: t.text.primary }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13, color: t.text.tertiary, margin: 0 }}>{subtitle}</p>}
      </div>
      {action}
    </motion.div>
  );
}

export function StatRow({ stats }: { stats: { label: string; value: string; color?: string }[] }) {
  const { t } = useTheme();
  return (
    <motion.div variants={fadeUp} style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)`, gap: 10, marginBottom: 24 }}>
      {stats.map((s) => (
        <motion.div
          key={s.label}
          whileHover={{ y: -1 }}
          transition={spring}
          style={{
            background: t.bg.surface, border: `1px solid ${t.border.default}`,
            borderRadius: t.radius.lg, padding: 16, transition: "border-color 150ms",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.border.hover; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border.default; }}
        >
          <div style={{ fontSize: 11, fontWeight: 500, color: t.text.tertiary, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{s.label}</div>
          <div style={{ fontSize: 28, fontWeight: 500, color: s.color || t.text.primary }}>{s.value}</div>
        </motion.div>
      ))}
    </motion.div>
  );
}

export function DataCard({ children, noPadding }: { children: ReactNode; noPadding?: boolean }) {
  const { t } = useTheme();
  return (
    <motion.div variants={fadeUp} style={{
      background: t.bg.surface, border: `1px solid ${t.border.default}`,
      borderRadius: 12, overflow: "hidden", ...(noPadding ? {} : { padding: 20 }),
    }}>
      {children}
    </motion.div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  const { t } = useTheme();
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 12 }}>
      {children}
    </div>
  );
}

export function TableHeader({ columns }: { columns: { label: string; align?: "left" | "right" | "center"; flex?: number }[] }) {
  const { t } = useTheme();
  return (
    <div style={{ display: "flex", padding: "10px 16px", borderBottom: `1px solid ${t.border.default}`, alignItems: "center" }}>
      {columns.map((col) => (
        <span key={col.label} style={{
          flex: col.flex || 1, fontSize: 11, fontWeight: 600, color: t.text.tertiary,
          textTransform: "uppercase", letterSpacing: "0.3px", textAlign: col.align || "left",
        }}>{col.label}</span>
      ))}
    </div>
  );
}

export function TableRow({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  const { t } = useTheme();
  return (
    <div
      onClick={onClick}
      style={{ display: "flex", padding: "12px 16px", borderBottom: `1px solid ${t.border.default}`, alignItems: "center", cursor: onClick ? "pointer" : "default", transition: "background 150ms" }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.background = t.bg.surfaceHover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </div>
  );
}

export function TableCell({ children, flex, align, primary }: { children: ReactNode; flex?: number; align?: "left" | "right" | "center"; primary?: boolean }) {
  const { t } = useTheme();
  return (
    <span style={{ flex: flex || 1, fontSize: 13, fontWeight: primary ? 500 : 400, color: primary ? t.text.primary : t.text.secondary, textAlign: align || "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export function CtaButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  const { t } = useTheme();
  return (
    <button
      onClick={onClick}
      style={{ background: t.accent.primary, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "background 150ms" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = t.accent.primaryHover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = t.accent.primary; }}
    >
      {children}
    </button>
  );
}

export function FormSection({ label, children }: { label: string; children: ReactNode }) {
  const { t } = useTheme();
  return (
    <motion.div variants={fadeUp} style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 12 }}>{label}</div>
      <div style={{ background: t.bg.surface, border: `1px solid ${t.border.default}`, borderRadius: 12, padding: 20 }}>
        {children}
      </div>
    </motion.div>
  );
}

export function FormRow({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(${Array.isArray(children) ? (children as any[]).filter(Boolean).length : 1}, 1fr)`, gap: 16, marginBottom: 16 }}>{children}</div>;
}

export function FormField({ label, value, onChange, placeholder, type }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  const { t } = useTheme();
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 500, color: t.text.secondary, marginBottom: 4 }}>{label}</div>
      <input
        type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", background: t.bg.primary, border: `1px solid ${t.border.default}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: t.text.primary, fontFamily: "inherit", outline: "none", boxSizing: "border-box", transition: "border-color 150ms" }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.08)"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = t.border.default; e.currentTarget.style.boxShadow = "none"; }}
      />
    </div>
  );
}

export function GhostButton({ children, onClick, icon }: { children: ReactNode; onClick: () => void; icon?: ReactNode }) {
  const { t } = useTheme();
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: "transparent", color: t.accent.primary,
        border: `1.5px solid ${t.accent.primary}`, borderRadius: 8,
        padding: "8px 16px", fontSize: 13, fontWeight: 500,
        cursor: "pointer", fontFamily: "inherit", transition: "all 150ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = t.accent.primary;
        e.currentTarget.style.color = "#fff";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = t.accent.primary;
      }}
    >
      {icon}{children}
    </button>
  );
}
