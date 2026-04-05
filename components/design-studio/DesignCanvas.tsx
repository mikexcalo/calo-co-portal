'use client';

import React, { useRef, useEffect, useState } from 'react';
import { SIGN_PHYSICAL_SIZES } from '@/lib/templates/yard-sign';

interface CanvasTemplate {
  width: number;
  height: number;
  objects: any[];
  qrCodeUrl?: string;
}

interface DesignCanvasProps {
  template: CanvasTemplate;
  onSave?: (json: string) => void;
  savedState?: string | null;
  brandColor?: string;
  darkColor?: string;
  signSize?: string;
}

export default function DesignCanvas({ template, onSave, savedState, brandColor = '#28502e', darkColor = '#1a1a1a', signSize = '18x24' }: DesignCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<any>(null);
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [colorMode, setColorMode] = useState<'brand' | 'dark' | 'light'>('brand');
  const [canvasReady, setCanvasReady] = useState(false);
  const [bleedWarning, setBleedWarning] = useState(false);
  const bleedPxRef = useRef(0);

  // Undo/redo state
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);
  const [, forceRender] = useState(0);

  useEffect(() => {
    let fc: any = null;

    const initCanvas = async () => {
      const fabric = await import('fabric');
      if (!canvasRef.current) return;

      fc = new fabric.Canvas(canvasRef.current, {
        width: template.width,
        height: template.height,
        backgroundColor: '#f4f5f7',
        selection: true,
        preserveObjectStacking: true,
        enableRetinaScaling: false,
        devicePixelRatio: 1,
      });

      fabricRef.current = fc;

      // ── Calculate bleed & safe zone in pixels ──
      const phys = SIGN_PHYSICAL_SIZES[signSize] || SIGN_PHYSICAL_SIZES['18x24'];
      const pxPerInch = template.width / phys.w;
      const bleedPx = Math.round(0.125 * pxPerInch);
      bleedPxRef.current = bleedPx;
      const safePx = Math.round(0.375 * pxPerInch); // 0.125 bleed + 0.25 safe

      if (savedState) {
        fc.loadFromJSON(savedState, () => { fc.renderAll(); });
      } else {
        await loadTemplate(fc, fabric, template);
      }

      // ── Bleed zone overlays (translucent pink, non-interactive) ──
      const bleedProps = {
        fill: 'rgba(255,0,0,0.08)', selectable: false, evented: false,
        originX: 'left' as const, originY: 'top' as const,
        data: { isGuide: true, excludeFromExport: true },
      };
      fc.add(new fabric.Rect({ left: 0, top: 0, width: template.width, height: bleedPx, ...bleedProps }));                   // top
      fc.add(new fabric.Rect({ left: 0, top: template.height - bleedPx, width: template.width, height: bleedPx, ...bleedProps })); // bottom
      fc.add(new fabric.Rect({ left: 0, top: bleedPx, width: bleedPx, height: template.height - bleedPx * 2, ...bleedProps }));    // left
      fc.add(new fabric.Rect({ left: template.width - bleedPx, top: bleedPx, width: bleedPx, height: template.height - bleedPx * 2, ...bleedProps })); // right

      // ── Safe zone dashed rectangle ──
      const safeRect = new fabric.Rect({
        left: safePx, top: safePx,
        width: template.width - safePx * 2, height: template.height - safePx * 2,
        fill: 'transparent', stroke: '#cccccc', strokeWidth: 1,
        strokeDashArray: [4, 4],
        selectable: false, evented: false,
        originX: 'left', originY: 'top',
        data: { isGuide: true, excludeFromExport: true },
      } as any);
      fc.add(safeRect);

      // Replace QR placeholder with real QR code
      if (template.qrCodeUrl) {
        const qrPlaceholder = fc.getObjects().find((o: any) => o.name === 'qr-placeholder');
        if (qrPlaceholder) {
          try {
            const QRCode = (await import('qrcode')).default;
            const qrDataUrl = await QRCode.toDataURL(template.qrCodeUrl, {
              width: (qrPlaceholder.width || 80) * 2,
              margin: 1,
              errorCorrectionLevel: 'M',
            });
            const qrImg = await fabric.FabricImage.fromURL(qrDataUrl);
            if (qrImg && qrImg.width) {
              qrImg.set({
                left: qrPlaceholder.left, top: qrPlaceholder.top,
                originX: 'left', originY: 'top',
                scaleX: (qrPlaceholder.width || 80) / qrImg.width,
                scaleY: (qrPlaceholder.height || 80) / qrImg.height,
                name: 'qr-code',
                selectable: true, evented: true,
                hasControls: true, hasBorders: true,
              });
              fc.remove(qrPlaceholder);
              fc.add(qrImg);
              fc.bringObjectToFront(qrImg);
            }
          } catch (e) {
            console.warn('QR code generation failed:', e);
          }
        }
      }

      // ── Snap guide lines (hidden by default, solid blue, non-exportable) ──
      const guideProps = {
        stroke: '#2563eb', strokeWidth: 1, opacity: 0.8,
        selectable: false, evented: false, visible: false,
        originX: 'left' as const, originY: 'top' as const,
        data: { isGuide: true, excludeFromExport: true },
      };
      const guideH = new fabric.Line([0, 0, template.width, 0], { ...guideProps } as any);
      const guideV = new fabric.Line([0, 0, 0, template.height], { ...guideProps } as any);
      fc.add(guideH);
      fc.add(guideV);

      fc.renderAll();
      setCanvasReady(true);

      // Save initial state for undo (exclude guide objects)
      const initialState = JSON.stringify(fc.toJSON());
      historyRef.current = [initialState];
      historyIndexRef.current = 0;

      // ── Snap-to-center + edge + object alignment guides ──
      fc.on('object:moving', (e: any) => {
        const obj = e.target;
        if (!obj || obj.data?.isGuide) return;
        const snap = 8;
        const W = template.width;
        const H = template.height;
        const cx = W / 2;
        const cy = H / 2;
        const objW = obj.getScaledWidth();
        const objH = obj.getScaledHeight();
        const objL = obj.left;
        const objT = obj.top;
        const objR = objL + objW;
        const objB = objT + objH;
        const objCx = objL + objW / 2;
        const objCy = objT + objH / 2;
        let showH = false, showV = false;

        // Snap to canvas center X
        if (Math.abs(objCx - cx) < snap) {
          obj.set('left', cx - objW / 2);
          guideV.set({ x1: cx, y1: 0, x2: cx, y2: H, visible: true } as any);
          showV = true;
        }
        // Snap to canvas center Y
        if (Math.abs(objCy - cy) < snap) {
          obj.set('top', cy - objH / 2);
          guideH.set({ x1: 0, y1: cy, x2: W, y2: cy, visible: true } as any);
          showH = true;
        }

        // Snap to safe zone edges
        if (!showV) {
          if (Math.abs(objL - safePx) < snap) { obj.set('left', safePx); guideV.set({ x1: safePx, y1: 0, x2: safePx, y2: H, visible: true } as any); showV = true; }
          else if (Math.abs(objR - (W - safePx)) < snap) { obj.set('left', W - safePx - objW); guideV.set({ x1: W - safePx, y1: 0, x2: W - safePx, y2: H, visible: true } as any); showV = true; }
        }
        if (!showH) {
          if (Math.abs(objT - safePx) < snap) { obj.set('top', safePx); guideH.set({ x1: 0, y1: safePx, x2: W, y2: safePx, visible: true } as any); showH = true; }
          else if (Math.abs(objB - (H - safePx)) < snap) { obj.set('top', H - safePx - objH); guideH.set({ x1: 0, y1: H - safePx, x2: W, y2: H - safePx, visible: true } as any); showH = true; }
        }

        // Snap to other objects' edges and centers
        fc.getObjects().forEach((other: any) => {
          if (other === obj || !other.visible || other.data?.isGuide) return;
          const oW = other.getScaledWidth();
          const oH = other.getScaledHeight();
          const oL = other.left;
          const oT = other.top;
          const oR = oL + oW;
          const oB = oT + oH;
          const oCx = oL + oW / 2;
          const oCy = oT + oH / 2;

          if (!showV) {
            // Center-to-center X
            if (Math.abs(objCx - oCx) < snap) {
              obj.set('left', oCx - objW / 2);
              guideV.set({ x1: oCx, y1: 0, x2: oCx, y2: H, visible: true } as any); showV = true;
            }
            // Left edge to left edge
            else if (Math.abs(objL - oL) < snap) {
              obj.set('left', oL);
              guideV.set({ x1: oL, y1: 0, x2: oL, y2: H, visible: true } as any); showV = true;
            }
            // Right edge to right edge
            else if (Math.abs(objR - oR) < snap) {
              obj.set('left', oR - objW);
              guideV.set({ x1: oR, y1: 0, x2: oR, y2: H, visible: true } as any); showV = true;
            }
          }
          if (!showH) {
            // Center-to-center Y
            if (Math.abs(objCy - oCy) < snap) {
              obj.set('top', oCy - objH / 2);
              guideH.set({ x1: 0, y1: oCy, x2: W, y2: oCy, visible: true } as any); showH = true;
            }
            // Top edge to top edge
            else if (Math.abs(objT - oT) < snap) {
              obj.set('top', oT);
              guideH.set({ x1: 0, y1: oT, x2: W, y2: oT, visible: true } as any); showH = true;
            }
            // Bottom edge to bottom edge
            else if (Math.abs(objB - oB) < snap) {
              obj.set('top', oB - objH);
              guideH.set({ x1: 0, y1: oB, x2: W, y2: oB, visible: true } as any); showH = true;
            }
          }
        });

        if (!showH) guideH.set('visible', false);
        if (!showV) guideV.set('visible', false);

        // Bleed zone check
        const inBleed = obj.left < bleedPx || obj.top < bleedPx ||
          (obj.left + obj.getScaledWidth()) > (W - bleedPx) ||
          (obj.top + obj.getScaledHeight()) > (H - bleedPx);
        setBleedWarning(inBleed);

        fc.renderAll();
      });

      fc.on('object:scaling', (e: any) => {
        const obj = e.target;
        if (!obj || obj.data?.isGuide) return;
        const W = template.width; const H = template.height;
        const inBleed = obj.left < bleedPx || obj.top < bleedPx ||
          (obj.left + obj.getScaledWidth()) > (W - bleedPx) ||
          (obj.top + obj.getScaledHeight()) > (H - bleedPx);
        setBleedWarning(inBleed);
      });

      fc.on('selection:created', (e: any) => setSelectedObject(e.selected?.[0] || null));
      fc.on('selection:updated', (e: any) => setSelectedObject(e.selected?.[0] || null));
      fc.on('selection:cleared', () => { setSelectedObject(null); setBleedWarning(false); });

      fc.on('object:modified', () => {
        // Hide guides on mouse up
        guideH.set('visible', false);
        guideV.set('visible', false);
        fc.renderAll();
        if (!isUndoRedoRef.current) {
          const json = JSON.stringify(fc.toJSON());
          historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
          historyRef.current.push(json);
          historyIndexRef.current = historyRef.current.length - 1;
          forceRender((n) => n + 1);
          if (onSave) onSave(json);
        }
      });
    };

    initCanvas();
    return () => { if (fc) fc.dispose(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTemplate = async (fc: any, fabric: any, tmpl: CanvasTemplate) => {
    for (const obj of tmpl.objects) {
      let fabricObj: any;

      if (obj.type === 'rect') {
        fabricObj = new fabric.Rect({
          left: obj.left, top: obj.top,
          width: obj.width, height: obj.height,
          fill: obj.fill, opacity: obj.opacity ?? 1,
          stroke: obj.stroke || null,
          strokeWidth: obj.strokeWidth ?? 0,
          rx: obj.rx || 0, ry: obj.ry || 0,
          originX: 'left', originY: 'top',
          selectable: obj.selectable !== false,
          evented: obj.evented !== false,
          lockMovementX: obj.lockMovement || false,
          lockMovementY: obj.lockMovement || false,
          lockScalingX: obj.lockScaling || false,
          lockScalingY: obj.lockScaling || false,
          name: obj.name || '',
        });
      } else if (obj.type === 'textbox') {
        fabricObj = new fabric.Textbox(obj.text, {
          left: obj.left, top: obj.top,
          width: obj.width,
          originX: obj.originX || 'left',
          originY: 'top',
          fontSize: obj.fontSize || 24,
          fontWeight: obj.fontWeight || 400,
          fontStyle: obj.fontStyle || 'normal',
          fontFamily: obj.fontFamily || 'Inter, Helvetica, Arial, sans-serif',
          fill: obj.fill || '#ffffff',
          textAlign: obj.textAlign || 'center',
          editable: true,
          name: obj.name || '',
        });
      } else if (obj.type === 'image' && obj.src) {
        try {
          const imgOptions: any = { crossOrigin: 'anonymous' };
          const img = await fabric.FabricImage.fromURL(obj.src, imgOptions);
          if (!img || !img.width) continue;
          img.set({
            left: obj.left, top: obj.top,
            originX: obj.originX || 'left',
            originY: 'top',
            name: obj.name || '',
            objectCaching: false, // Preserve full resolution
          });

          // Scale to desired display size using scaleToWidth/scaleToHeight
          if (obj.maxWidth && img.width) {
            const targetW = obj.maxWidth;
            const targetH = obj.maxHeight || obj.maxWidth;
            const s = Math.min(targetW / img.width, targetH / img.height);
            img.scaleX = s;
            img.scaleY = s;
          } else {
            img.set({ scaleX: obj.scaleX || 1, scaleY: obj.scaleY || 1 });
          }

          // Logo: create white version for dark backgrounds
          if (obj.name === 'logo') {
            try {
              const el = (img as any)._element || (img as any).getElement?.();
              if (el) {
                const tc = document.createElement('canvas');
                tc.width = el.naturalWidth || el.width;
                tc.height = el.naturalHeight || el.height;
                const tctx = tc.getContext('2d');
                if (tctx) {
                  tctx.drawImage(el, 0, 0);
                  const imgData = tctx.getImageData(0, 0, tc.width, tc.height);
                  for (let i = 0; i < imgData.data.length; i += 4) {
                    if (imgData.data[i + 3] > 10) {
                      imgData.data[i] = 255;
                      imgData.data[i + 1] = 255;
                      imgData.data[i + 2] = 255;
                      imgData.data[i + 3] = Math.min(255, imgData.data[i + 3] * 2);
                    }
                  }
                  tctx.putImageData(imgData, 0, 0);
                  const whiteImg = new Image();
                  whiteImg.src = tc.toDataURL('image/png');
                  await new Promise<void>((resolve) => { whiteImg.onload = () => resolve(); setTimeout(resolve, 500); });
                  (img as any).__originalElement = el;
                  (img as any).__whiteElement = whiteImg;
                  // Default to white version (brand mode = dark bg)
                  (img as any)._element = whiteImg;
                  (img as any)._originalElement = whiteImg;
                }
              }
            } catch (e) {
              console.warn('Logo white version failed:', e);
            }
          }

          fc.add(img);
        } catch (e) {
          console.error('Failed to load image:', obj.src?.slice(0, 80), e);
        }
        continue;
      }

      if (fabricObj) fc.add(fabricObj);
    }
  };

  // Helper: hide guide/bleed objects for clean export
  const exportDataURL = (fc: any) => {
    fc.discardActiveObject();
    const guideObjs = fc.getObjects().filter((o: any) => o.data?.excludeFromExport || o.data?.isGuide);
    guideObjs.forEach((o: any) => o.set('visible', false));
    fc.renderAll();
    const url = fc.toDataURL({ format: 'png', multiplier: 3, quality: 1 });
    guideObjs.forEach((o: any) => {
      // Restore visibility for non-guide overlays (bleed/safe are always visible during editing)
      if (!o.data?.excludeFromExport) return;
      o.set('visible', true);
    });
    fc.renderAll();
    return url;
  };

  const handleExportPNG = () => {
    if (!fabricRef.current) return;
    const dataURL = exportDataURL(fabricRef.current);
    const link = document.createElement('a');
    link.download = 'yard-sign.png';
    link.href = dataURL;
    link.click();
  };

  const handleExportPDF = async () => {
    if (!fabricRef.current) return;
    const dataURL = exportDataURL(fabricRef.current);
    const phys = SIGN_PHYSICAL_SIZES[signSize] || SIGN_PHYSICAL_SIZES['18x24'];
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({
      orientation: phys.w > phys.h ? 'landscape' : 'portrait',
      unit: 'in', format: [phys.w, phys.h],
    });
    pdf.addImage(dataURL, 'PNG', 0, 0, phys.w, phys.h);
    pdf.save('yard-sign.pdf');
  };

  const handleColorMode = (mode: 'brand' | 'dark' | 'light') => {
    if (!fabricRef.current) return;
    const fc = fabricRef.current;
    setColorMode(mode);

    const colorMap: Record<string, Record<string, string>> = {
      brand: { 'brand-bg': brandColor, 'white-strip': '#ffffff', 'headline-text': '#ffffff', 'phone-text': '#ffffff', 'company-text': brandColor },
      dark: { 'brand-bg': darkColor, 'white-strip': '#ffffff', 'headline-text': '#ffffff', 'phone-text': '#ffffff', 'company-text': darkColor },
      light: { 'brand-bg': '#ffffff', 'white-strip': brandColor, 'headline-text': brandColor, 'phone-text': brandColor, 'company-text': '#ffffff' },
    };
    const bcMap: Record<string, Record<string, string>> = {
      brand: { 'card-bg': brandColor, 'company-text': '#ffffff', 'contact-name-text': '#ffffff', 'title-text': 'rgba(255,255,255,0.7)', 'contact-info-text': 'rgba(255,255,255,0.85)', 'tagline-text': 'rgba(255,255,255,0.5)', 'accent-line': 'rgba(255,255,255,0.3)' },
      dark: { 'card-bg': '#111827', 'company-text': '#ffffff', 'contact-name-text': '#ffffff', 'title-text': 'rgba(255,255,255,0.7)', 'contact-info-text': 'rgba(255,255,255,0.85)', 'tagline-text': 'rgba(255,255,255,0.5)', 'accent-line': 'rgba(255,255,255,0.3)' },
      light: { 'card-bg': '#ffffff', 'company-text': brandColor, 'contact-name-text': '#111827', 'title-text': '#6b7280', 'contact-info-text': '#374151', 'tagline-text': '#9ca3af', 'accent-line': brandColor },
    };
    const hasCardBg = fc.getObjects().some((o: any) => o.name === 'card-bg');
    const fills = hasCardBg ? bcMap[mode] : colorMap[mode];

    fc.getObjects().forEach((obj: any) => {
      if (fills[obj.name]) obj.set('fill', fills[obj.name]);
      if (obj.name === 'logo' && obj.__originalElement && obj.__whiteElement) {
        if (mode === 'light') {
          obj._element = obj.__originalElement;
          obj._originalElement = obj.__originalElement;
        } else {
          obj._element = obj.__whiteElement;
          obj._originalElement = obj.__whiteElement;
        }
        obj.dirty = true;
      }
    });
    fc.renderAll();
  };

  const handleDelete = () => {
    if (!fabricRef.current || !selectedObject) return;
    if (selectedObject.name === 'brand-bg' || selectedObject.name === 'white-strip') return;
    fabricRef.current.remove(selectedObject);
    setSelectedObject(null);
  };

  const handleAddText = async () => {
    if (!fabricRef.current) return;
    const fabric = await import('fabric');
    const text = new fabric.Textbox('New text', {
      left: template.width / 2 - 60, top: template.height / 2 - 15,
      width: 120, fontSize: 18,
      fontFamily: 'Inter, Helvetica, Arial, sans-serif',
      fill: '#ffffff', textAlign: 'center',
    });
    fabricRef.current.add(text);
    fabricRef.current.setActiveObject(text);
    fabricRef.current.renderAll();
  };

  const undo = () => {
    if (historyIndexRef.current <= 0 || !fabricRef.current) return;
    isUndoRedoRef.current = true;
    historyIndexRef.current--;
    forceRender((n) => n + 1);
    fabricRef.current.loadFromJSON(historyRef.current[historyIndexRef.current], () => {
      fabricRef.current.renderAll();
      isUndoRedoRef.current = false;
    });
  };

  const redo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1 || !fabricRef.current) return;
    isUndoRedoRef.current = true;
    historyIndexRef.current++;
    forceRender((n) => n + 1);
    fabricRef.current.loadFromJSON(historyRef.current[historyIndexRef.current], () => {
      fabricRef.current.renderAll();
      isUndoRedoRef.current = false;
    });
  };

  const handleClickAway = (e: React.MouseEvent) => {
    if (fabricRef.current && !(e.target as HTMLElement).closest('.canvas-container')) {
      fabricRef.current.discardActiveObject();
      fabricRef.current.renderAll();
    }
  };

  const btnStyle: React.CSSProperties = {
    padding: '6px 12px', fontSize: 12, border: '1px solid #e2e2e5',
    borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#6e6e76',
    fontFamily: 'inherit', transition: 'background 150ms',
  };

  return (
    <div onClick={handleClickAway}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap', maxWidth: template.width }}>
        <button onClick={undo} disabled={historyIndexRef.current <= 0}
          style={{ ...btnStyle, opacity: historyIndexRef.current <= 0 ? 0.4 : 1 }}>↩ Undo</button>
        <button onClick={redo} disabled={historyIndexRef.current >= historyRef.current.length - 1}
          style={{ ...btnStyle, opacity: historyIndexRef.current >= historyRef.current.length - 1 ? 0.4 : 1 }}>↪ Redo</button>
        <button onClick={handleAddText} style={btnStyle}>+ Text</button>
        {selectedObject && selectedObject.name !== 'brand-bg' && selectedObject.name !== 'white-strip' && (
          <button onClick={handleDelete} style={{ ...btnStyle, color: '#991b1b' }}>Delete</button>
        )}
        <div style={{ flex: 1 }} />
        {([
          { mode: 'brand' as const, color: brandColor },
          { mode: 'dark' as const, color: darkColor },
          { mode: 'light' as const, color: '#ffffff' },
        ]).map(({ mode, color }) => (
          <div key={mode} onClick={(e) => { e.stopPropagation(); handleColorMode(mode); }} style={{
            width: 28, height: 28, borderRadius: '50%', backgroundColor: color,
            border: colorMode === mode ? '2px solid #2563eb' : '2px solid #e2e2e5',
            boxShadow: colorMode === mode ? '0 0 0 2px rgba(37,99,235,0.15)' : 'none',
            cursor: 'pointer', transition: 'border-color 150ms, box-shadow 150ms',
          }} />
        ))}
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        {bleedWarning && (
          <div style={{ position: 'absolute', top: -28, left: 0, zIndex: 10, fontSize: 11, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap' }}>
            ⚠ Object in bleed zone
          </div>
        )}
        <div style={{ borderRadius: 8, border: '1px solid #e2e2e5', overflow: 'hidden' }}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      {/* Export buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={handleExportPDF} style={{
          padding: '8px 20px', fontSize: 14, fontWeight: 500,
          background: '#2563eb', color: '#fff', border: 'none',
          borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
        }}>Download PDF</button>
        <button onClick={handleExportPNG} style={{
          padding: '8px 20px', fontSize: 14, fontWeight: 500,
          background: 'transparent', color: '#2563eb', border: '1px solid #2563eb',
          borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
        }}>Download PNG</button>
      </div>
    </div>
  );
}
