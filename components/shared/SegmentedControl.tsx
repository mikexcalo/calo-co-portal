'use client';

import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface SegmentedControlProps {
  tabs: { key: string; label: string; icon?: React.ReactNode }[];
  activeTab: string;
  onChange: (key: string) => void;
}

function getTokens() {
  const isDark = typeof window !== 'undefined' && localStorage.getItem('calo-theme') !== 'light';
  return isDark
    ? { bgPrimary: '#111113', bgSurface: '#1a1a1d', border: 'rgba(255,255,255,0.08)', textPrimary: '#f5f5f5', textSecondary: '#8a8a8d', shadow: '0 1px 2px rgba(0,0,0,0.1)' }
    : { bgPrimary: '#f7f7f8', bgSurface: '#ffffff', border: 'rgba(0,0,0,0.08)', textPrimary: '#111113', textSecondary: '#6b6b6f', shadow: '0 1px 2px rgba(0,0,0,0.06)' };
}

export default function SegmentedControl({ tabs, activeTab, onChange }: SegmentedControlProps) {
  const [tk, setTk] = useState(getTokens);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  // Re-read tokens when theme changes
  useEffect(() => {
    const update = () => setTk(getTokens());
    window.addEventListener('storage', update);
    const observer = new MutationObserver(update);
    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
    return () => { window.removeEventListener('storage', update); observer.disconnect(); };
  }, []);

  // Measure active pill position
  useEffect(() => {
    if (!containerRef.current) return;
    const btns = containerRef.current.querySelectorAll<HTMLButtonElement>('[data-seg]');
    btns.forEach((btn) => {
      if (btn.dataset.seg === activeTab) {
        setPillStyle({ left: btn.offsetLeft, width: btn.offsetWidth });
      }
    });
  }, [activeTab, tabs]);

  return (
    <div ref={containerRef} style={{
      display: 'inline-flex', position: 'relative',
      background: tk.bgPrimary, borderRadius: 8, padding: 4,
      border: `1px solid ${tk.border}`,
    }}>
      {/* Animated pill */}
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        style={{
          position: 'absolute', top: 4, height: 'calc(100% - 8px)',
          background: tk.bgSurface, borderRadius: 6,
          boxShadow: tk.shadow,
          left: pillStyle.left, width: pillStyle.width,
        }}
      />

      {/* Segment buttons */}
      {tabs.map((tab) => (
        <button
          key={tab.key}
          data-seg={tab.key}
          onClick={() => onChange(tab.key)}
          style={{
            position: 'relative', zIndex: 1,
            padding: '6px 16px', borderRadius: 6, border: 'none',
            background: 'transparent', cursor: 'pointer',
            fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
            color: activeTab === tab.key ? tk.textPrimary : tk.textSecondary,
            transition: 'color 150ms',
          }}
          onMouseEnter={(e) => { if (activeTab !== tab.key) e.currentTarget.style.color = tk.textPrimary; }}
          onMouseLeave={(e) => { if (activeTab !== tab.key) e.currentTarget.style.color = tk.textSecondary; }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{tab.icon}<span>{tab.label}</span></span>
        </button>
      ))}
    </div>
  );
}
