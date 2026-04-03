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

      if (savedState) {
        fc.loadFromJSON(savedState, () => { fc.renderAll(); });
      } else {
        await loadTemplate(fc, fabric, template);
      }

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
                selectable: false, evented: false,
              });
              fc.remove(qrPlaceholder);
              fc.add(qrImg);
            }
          } catch (e) {
            console.warn('QR code generation failed:', e);
          }
        }
      }

      // Create snap guide lines (hidden by default)
      const guideH = new fabric.Line([0, 0, template.width, 0], {
        stroke: '#2563eb', strokeWidth: 1, opacity: 0.7, strokeDashArray: [4, 4],
        selectable: false, evented: false, visible: false,
        originX: 'left', originY: 'top',
        data: { isGuide: true },
      } as any);
      const guideV = new fabric.Line([0, 0, 0, template.height], {
        stroke: '#2563eb', strokeWidth: 1, opacity: 0.7, strokeDashArray: [4, 4],
        selectable: false, evented: false, visible: false,
        originX: 'left', originY: 'top',
        data: { isGuide: true },
      } as any);
      fc.add(guideH);
      fc.add(guideV);

      fc.renderAll();
      setCanvasReady(true);

      // Save initial state for undo
      const initialState = JSON.stringify(fc.toJSON());
      historyRef.current = [initialState];
      historyIndexRef.current = 0;

      // Snap-to-grid alignment guides
      fc.on('object:moving', (e: any) => {
        const obj = e.target;
        if (!obj || (obj as any).data?.isGuide) return;
        const snap = 8;
        const cx = template.width / 2;
        const cy = template.height / 2;
        const objCx = obj.left + obj.getScaledWidth() / 2;
        const objCy = obj.top + obj.getScaledHeight() / 2;
        let showH = false, showV = false;

        // Snap to canvas center X
        if (Math.abs(objCx - cx) < snap) {
          obj.set('left', cx - obj.getScaledWidth() / 2);
          guideV.set({ x1: cx, y1: 0, x2: cx, y2: template.height, visible: true } as any);
          showV = true;
        }
        // Snap to canvas center Y
        if (Math.abs(objCy - cy) < snap) {
          obj.set('top', cy - obj.getScaledHeight() / 2);
          guideH.set({ x1: 0, y1: cy, x2: template.width, y2: cy, visible: true } as any);
          showH = true;
        }

        // Snap to other objects
        fc.getObjects().forEach((other: any) => {
          if (other === obj || !other.visible || other.data?.isGuide) return;
          const otherCx = other.left + other.getScaledWidth() / 2;
          const otherCy = other.top + other.getScaledHeight() / 2;
          if (!showV && Math.abs(objCx - otherCx) < snap) {
            obj.set('left', otherCx - obj.getScaledWidth() / 2);
            guideV.set({ x1: otherCx, y1: 0, x2: otherCx, y2: template.height, visible: true } as any);
            showV = true;
          }
          if (!showH && Math.abs(objCy - otherCy) < snap) {
            obj.set('top', otherCy - obj.getScaledHeight() / 2);
            guideH.set({ x1: 0, y1: otherCy, x2: template.width, y2: otherCy, visible: true } as any);
            showH = true;
          }
        });

        if (!showH) guideH.set('visible', false);
        if (!showV) guideV.set('visible', false);
        fc.renderAll();
      });

      fc.on('selection:created', (e: any) => setSelectedObject(e.selected?.[0] || null));
      fc.on('selection:updated', (e: any) => setSelectedObject(e.selected?.[0] || null));
      fc.on('selection:cleared', () => setSelectedObject(null));

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
          fill: obj.fill,
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
          fontFamily: obj.fontFamily || 'Inter, Helvetica, Arial, sans-serif',
          fill: obj.fill || '#ffffff',
          textAlign: obj.textAlign || 'center',
          editable: true,
          name: obj.name || '',
        });
      } else if (obj.type === 'image' && obj.src) {
        try {
          const imgOptions: any = {};
          if (obj.src.startsWith('http')) imgOptions.crossOrigin = 'anonymous';
          const img = await fabric.FabricImage.fromURL(obj.src, imgOptions);
          if (!img || !img.width) continue;
          img.set({
            left: obj.left, top: obj.top,
            originX: obj.originX || 'left',
            originY: 'top',
            scaleX: obj.scaleX || 1, scaleY: obj.scaleY || 1,
            name: obj.name || '',
          });
          if (obj.maxWidth && img.width) {
            const s = Math.min(obj.maxWidth / img.width, (obj.maxHeight || obj.maxWidth) / (img.height || img.width));
            img.scaleX = s;
            img.scaleY = s;
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

  // Helper: hide guide lines for clean export
  const exportDataURL = (fc: any) => {
    fc.discardActiveObject();
    fc.getObjects().forEach((o: any) => { if (o.data?.isGuide) o.set('visible', false); });
    fc.renderAll();
    const url = fc.toDataURL({ format: 'png', multiplier: 3, quality: 1 });
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
    const fills = colorMap[mode];

    fc.getObjects().forEach((obj: any) => {
      if (fills[obj.name]) obj.set('fill', fills[obj.name]);

      // Logo: swap between original and white version
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
    padding: '6px 12px', fontSize: 12, border: '1px solid #e5e7eb',
    borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#374151',
    fontFamily: 'Inter, sans-serif',
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
          <button onClick={handleDelete} style={{ ...btnStyle, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b' }}>Delete</button>
        )}
        <div style={{ flex: 1 }} />
        {([
          { mode: 'brand' as const, color: brandColor },
          { mode: 'dark' as const, color: darkColor },
          { mode: 'light' as const, color: '#ffffff' },
        ]).map(({ mode, color }) => (
          <div key={mode} onClick={(e) => { e.stopPropagation(); handleColorMode(mode); }} style={{
            width: 28, height: 28, borderRadius: '50%', backgroundColor: color,
            border: colorMode === mode ? '2px solid #2563eb' : '1px solid #d1d5db',
            cursor: 'pointer',
          }} />
        ))}
      </div>

      {/* Canvas */}
      <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', display: 'inline-block' }}>
        <canvas ref={canvasRef} />
      </div>

      {/* Export buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={handleExportPDF} style={{
          padding: '8px 20px', fontSize: 13, fontWeight: 500,
          background: '#2563eb', color: '#fff', border: 'none',
          borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}>Download PDF</button>
        <button onClick={handleExportPNG} style={{
          padding: '8px 20px', fontSize: 13, fontWeight: 500,
          background: '#fff', color: '#2563eb', border: '1px solid #2563eb',
          borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}>Download PNG</button>
      </div>
    </div>
  );
}
