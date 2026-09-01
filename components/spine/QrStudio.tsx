'use client';

/**
 * QR codes in the brand's own colors.
 *
 * The reason this lives in the Brand Kit rather than being a generic utility:
 * a QR code on a yard sign or a truck door is a brand asset, and the two
 * colors it needs are already sitting right there.
 *
 * Contrast is enforced rather than suggested. A QR code in two mid-tone brand
 * colors looks lovely and doesn't scan, and the person who finds that out is
 * a customer standing in a driveway. So the picker warns, loudly, below the
 * threshold that actually works.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Button, C, Card, Field, SectionLabel, inputStyle, radius } from './ui';
import { QrCampaigns, type Campaign } from './QrCampaigns';

interface BrandColor {
  name: string;
  hex: string;
}

/** Relative luminance, per WCAG. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const SIZES = [
  { label: 'Web, 512px', px: 512 },
  { label: 'Print, 1024px', px: 1024 },
  { label: 'Large print, 2048px', px: 2048 },
];

export function QrStudio({
  colors,
  defaultUrl,
  company,
  orgId,
}: {
  colors: BrandColor[];
  defaultUrl: string;
  company: string;
  orgId?: string;
}) {
  const [url, setUrl] = useState(defaultUrl);
  const [dark, setDark] = useState(colors[0]?.hex ?? '#000000');
  const [light, setLight] = useState('#FFFFFF');
  const [size, setSize] = useState(1024);
  const [transparent, setTransparent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  const ratio = contrastRatio(dark, light);
  // Scanners need roughly 3:1 to be reliable in the wild; below that it may
  // read on a clean phone screen and fail on a printed sign in low light.
  const scannable = ratio >= 3;
  const comfortable = ratio >= 7;

  const render = useCallback(async () => {
    if (!canvasRef.current) return;
    setError(null);
    try {
      await QRCode.toCanvas(canvasRef.current, url || defaultUrl, {
        width: 320,
        margin: 2,
        // High correction so a logo overlay or a scuffed sign still reads.
        errorCorrectionLevel: 'H',
        color: {
          dark,
          light: transparent ? '#00000000' : light,
        },
      });

      /**
       * The library writes its own width and height straight onto the
       * element's style attribute, and it does that after React has rendered.
       * Whatever React set therefore loses, which is why the code kept
       * escaping its box no matter how the box was described.
       *
       * Handing the sizing back to CSS here is the actual fix. The two
       * previous attempts changed the container, which was never the thing
       * overriding anything.
       */
      const el = canvasRef.current;
      el.style.width = '100%';
      el.style.height = '100%';
    } catch (e) {
      setError((e as Error).message);
    }
  }, [url, dark, light, transparent, defaultUrl]);

  useEffect(() => {
    render();
  }, [render]);

  const download = async () => {
    setError(null);
    try {
      const dataUrl = await QRCode.toDataURL(url || defaultUrl, {
        width: size,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark, light: transparent ? '#00000000' : light },
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${company.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-qr-${size}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const swatches = [...colors, { name: 'White', hex: '#FFFFFF' }, { name: 'Black', hex: '#000000' }];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 18 }}>
      <div>
        <Card style={{ marginBottom: 16 }}>
          <Field label="Where should it go?">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={inputStyle}
              placeholder="https://www.mammothconstructiontx.com"
            />
          </Field>
          <div style={{ fontSize: 12.5, color: C.faint, marginTop: -8 }}>
            Anything a phone can open: a page, a phone number as{' '}
            <code>tel:512...</code>, an email as <code>mailto:...</code>.
          </div>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <SectionLabel>Code color</SectionLabel>
          <SwatchRow colors={swatches} value={dark} onPick={setDark} />

          <div style={{ marginTop: 18 }}>
            <SectionLabel>Background</SectionLabel>
            <SwatchRow colors={swatches} value={light} onPick={setLight} disabled={transparent} />
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 16,
              fontSize: 13.5,
              color: C.dim,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={transparent}
              onChange={(e) => setTransparent(e.target.checked)}
            />
            Transparent background
          </label>
        </Card>

        <Card>
          <SectionLabel>Size</SectionLabel>
          <select
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            style={inputStyle}
          >
            {SIZES.map((s) => (
              <option key={s.px} value={s.px}>{s.label}</option>
            ))}
          </select>
          <div style={{ fontSize: 12.5, color: C.faint, marginTop: 10, lineHeight: 1.55 }}>
            For a yard sign or truck door, use the largest. A QR code has to be about
            1cm wide for every 10cm of scanning distance.
          </div>
        </Card>

        {orgId && (
          <QrCampaigns
            orgId={orgId}
            defaultDestination={defaultUrl}
            selectedCode={campaign?.code ?? null}
            onSelect={(u, c) => {
              setUrl(u);
              setCampaign(c);
            }}
          />
        )}
      </div>

      <div>
        <Card style={{ position: 'sticky', top: 16 }}>
          <SectionLabel>Preview</SectionLabel>
          {campaign && (
            <div
              style={{
                fontSize: 13,
                color: C.dim,
                lineHeight: 1.55,
                margin: '4px 0 12px',
                padding: '9px 11px',
                background: C.blueSoft,
                border: `1px solid ${C.blue}33`,
                borderRadius: radius.md,
              }}
            >
              Tracking <strong style={{ color: C.text }}>{campaign.label}</strong>. Scans forward
              to {campaign.destination.replace(/^https?:\/\//, '')} and are counted here.
            </div>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              // Without this the flex default of `stretch` pulls the canvas
              // vertically and the QR renders as a rectangle — which does not
              // scan.
              alignItems: 'center',
              padding: 18,
              borderRadius: radius.md,
              // Checkerboard so a transparent background reads as transparent.
              background: transparent
                ? 'repeating-conic-gradient(#e8e8e4 0% 25%, #ffffff 0% 50%) 50% / 16px 16px'
                : C.panelAlt,
              border: `1px solid ${C.border}`,
            }}
          >
            {/*
              The square is enforced by the wrapper, not by the canvas.
              Relying on the canvas's own aspect-ratio kept producing a
              rectangle, because a canvas has intrinsic pixel dimensions that
              argue with CSS sizing and one of them wins unpredictably.

              A wrapper with a fixed aspect ratio and a canvas told to fill it
              completely removes the argument. There is no combination of
              widths that makes this anything but square.
            */}
            <div
              style={{
                width: '100%',
                maxWidth: 280,
                aspectRatio: '1 / 1',
                position: 'relative',
              }}
            >
              <canvas
                ref={canvasRef}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'block',
                  width: '100%',
                  height: '100%',
                }}
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              padding: 11,
              borderRadius: radius.md,
              background: scannable ? (comfortable ? C.greenSoft : C.amberSoft) : C.redSoft,
              border: `1px solid ${scannable ? (comfortable ? C.green : C.amber) : C.red}44`,
              fontSize: 13,
              color: scannable ? (comfortable ? C.green : C.amber) : C.red,
              lineHeight: 1.55,
            }}
          >
            <strong style={{ fontWeight: 600 }}>
              Contrast {ratio.toFixed(1)}:1 —{' '}
              {!scannable ? 'will not scan reliably' : comfortable ? 'scans well' : 'marginal'}
            </strong>
            <div style={{ marginTop: 4 }}>
              {!scannable
                ? 'Pick a darker code color or a lighter background. This may read on a phone screen and fail on a printed sign.'
                : comfortable
                ? 'Safe for print and signage.'
                : 'Fine on screen. For a yard sign or truck, push the contrast higher.'}
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 12, fontSize: 13, color: C.red }}>{error}</div>
          )}

          <div style={{ marginTop: 14 }}>
            <Button onClick={download} disabled={!scannable}>
              {scannable ? 'Download PNG' : 'Fix contrast first'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SwatchRow({
  colors,
  value,
  onPick,
  disabled,
}: {
  colors: BrandColor[];
  value: string;
  onPick: (hex: string) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', opacity: disabled ? 0.4 : 1 }}>
      {colors.map((c) => {
        const active = value.toUpperCase() === c.hex.toUpperCase();
        return (
          <button
            key={c.hex}
            onClick={() => !disabled && onPick(c.hex)}
            title={`${c.name} ${c.hex}`}
            disabled={disabled}
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: c.hex,
              border: active ? `2px solid ${C.accent}` : `1px solid ${C.borderStrong}`,
              boxShadow: active ? `0 0 0 2px ${C.accentSoft}` : 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          />
        );
      })}
    </div>
  );
}
