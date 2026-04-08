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
        selection: false,
        preserveObjectStacking: true,
        enableRetinaScaling: false,
        devicePixelRatio: window.devicePixelRatio || 2,
      });

      fabricRef.current = fc;

      // Selection styling
      fc.selectionColor = 'rgba(37,99,235,0.08)';
      fc.selectionBorderColor = '#2563eb';
      fc.selectionLineWidth = 1;

      // ── Calculate bleed & safe zone in pixels ──
      const phys = SIGN_PHYSICAL_SIZES[signSize] || SIGN_PHYSICAL_SIZES['18x24'];
      const pxPerInch = template.width / phys.w;
      const bleedPx = Math.round(0.125 * pxPerInch);
      bleedPxRef.current = bleedPx;
      const safePx = Math.round(0.375 * pxPerInch); // 0.125 bleed + 0.25 safe

      await loadTemplate(fc, fabric, template);

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
        fill: 'transparent', stroke: 'rgba(200,200,200,0.15)', strokeWidth: 1,
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
                selectable: true, evented: true, hasControls: true, hasBorders: true, lockRotation: true,
                borderColor: '#2563eb', cornerColor: '#2563eb', cornerSize: 8, cornerStyle: 'circle', transparentCorners: false,
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

      // Save initial state for undo — delay to ensure all async images are rendered
      setTimeout(() => {
        const initialState = JSON.stringify(fc.toJSON());
        historyRef.current = [initialState];
        historyIndexRef.current = 0;
        forceRender((n) => n + 1);
      }, 300);

      // Helper: get bounding box edges regardless of originX/originY
      const getBounds = (o: any) => {
        const w = o.getScaledWidth();
        const h = o.getScaledHeight();
        let l = o.left, t2 = o.top;
        if (o.originX === 'center') l -= w / 2;
        if (o.originY === 'center') t2 -= h / 2;
        return { l, t: t2, r: l + w, b: t2 + h, cx: l + w / 2, cy: t2 + h / 2, w, h };
      };
      const setLeft = (o: any, left: number) => {
        if (o.originX === 'center') o.set('left', left + o.getScaledWidth() / 2);
        else o.set('left', left);
      };
      const setTop = (o: any, top: number) => {
        if (o.originY === 'center') o.set('top', top + o.getScaledHeight() / 2);
        else o.set('top', top);
      };

      // ── Snap-to-center + edge + object alignment guides ──
      fc.on('object:moving', (e: any) => {
        const obj = e.target;
        if (!obj || obj.data?.isGuide) return;
        const snap = 8;
        const W = template.width;
        const H = template.height;
        const cx = W / 2;
        const cy = H / 2;
        const b = getBounds(obj);
        const objL = b.l, objT = b.t, objR = b.r, objB = b.b;
        const objCx = b.cx, objCy = b.cy;
        const objW = b.w, objH = b.h;
        let showH = false, showV = false;

        // Snap to canvas center X
        if (Math.abs(objCx - cx) < snap) {
          setLeft(obj, cx - objW / 2);
          guideV.set({ x1: cx, y1: 0, x2: cx, y2: H, visible: true } as any);
          showV = true;
        }
        // Snap to canvas center Y
        if (Math.abs(objCy - cy) < snap) {
          setTop(obj, cy - objH / 2);
          guideH.set({ x1: 0, y1: cy, x2: W, y2: cy, visible: true } as any);
          showH = true;
        }

        // Snap to safe zone edges
        if (!showV) {
          if (Math.abs(objL - safePx) < snap) { setLeft(obj, safePx); guideV.set({ x1: safePx, y1: 0, x2: safePx, y2: H, visible: true } as any); showV = true; }
          else if (Math.abs(objR - (W - safePx)) < snap) { setLeft(obj, W - safePx - objW); guideV.set({ x1: W - safePx, y1: 0, x2: W - safePx, y2: H, visible: true } as any); showV = true; }
        }
        if (!showH) {
          if (Math.abs(objT - safePx) < snap) { setTop(obj, safePx); guideH.set({ x1: 0, y1: safePx, x2: W, y2: safePx, visible: true } as any); showH = true; }
          else if (Math.abs(objB - (H - safePx)) < snap) { setTop(obj, H - safePx - objH); guideH.set({ x1: 0, y1: H - safePx, x2: W, y2: H - safePx, visible: true } as any); showH = true; }
        }

        // Snap to other objects' edges and centers
        fc.getObjects().forEach((other: any) => {
          if (other === obj || !other.visible || other.data?.isGuide) return;
          const ob = getBounds(other);

          if (!showV) {
            if (Math.abs(objCx - ob.cx) < snap) {
              setLeft(obj, ob.cx - objW / 2);
              guideV.set({ x1: ob.cx, y1: 0, x2: ob.cx, y2: H, visible: true } as any); showV = true;
            } else if (Math.abs(objL - ob.l) < snap) {
              setLeft(obj, ob.l);
              guideV.set({ x1: ob.l, y1: 0, x2: ob.l, y2: H, visible: true } as any); showV = true;
            } else if (Math.abs(objR - ob.r) < snap) {
              setLeft(obj, ob.r - objW);
              guideV.set({ x1: ob.r, y1: 0, x2: ob.r, y2: H, visible: true } as any); showV = true;
            }
          }
          if (!showH) {
            if (Math.abs(objCy - ob.cy) < snap) {
              setTop(obj, ob.cy - objH / 2);
              guideH.set({ x1: 0, y1: ob.cy, x2: W, y2: ob.cy, visible: true } as any); showH = true;
            } else if (Math.abs(objT - ob.t) < snap) {
              setTop(obj, ob.t);
              guideH.set({ x1: 0, y1: ob.t, x2: W, y2: ob.t, visible: true } as any); showH = true;
            } else if (Math.abs(objB - ob.b) < snap) {
              setTop(obj, ob.b - objH);
              guideH.set({ x1: 0, y1: ob.b, x2: W, y2: ob.b, visible: true } as any); showH = true;
            }
          }
        });

        if (!showH) guideH.set('visible', false);
        if (!showV) guideV.set('visible', false);

        // Bleed zone check (use bounds, not raw left/top)
        const bb = getBounds(obj);
        const inBleed = bb.l < bleedPx || bb.t < bleedPx ||
          bb.r > (W - bleedPx) || bb.b > (H - bleedPx);
        setBleedWarning(inBleed);

        fc.renderAll();
      });

      fc.on('object:scaling', (e: any) => {
        const obj = e.target;
        if (!obj || obj.data?.isGuide) return;
        const W = template.width; const H = template.height;
        const sb = getBounds(obj);
        const inBleed = sb.l < bleedPx || sb.t < bleedPx || sb.r > (W - bleedPx) || sb.b > (H - bleedPx);
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
          // if (onSave) onSave(json);  // disabled: don't save canvas state until rendering is stable
        }
      });
    };

    initCanvas();
    return () => { if (fc) fc.dispose(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTemplate = async (fc: any, fabric: any, tmpl: CanvasTemplate) => {
    for (const obj of tmpl.objects) {
      try {
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
          selectable: false, evented: false, hasControls: false, hasBorders: false,
          name: obj.name || '',
        });
      } else if (obj.type === 'text') {
        fabricObj = new fabric.FabricText(obj.text || '', {
          left: obj.left, top: obj.top,
          originX: obj.originX || 'left',
          originY: 'top',
          fontSize: obj.fontSize || 24,
          fontWeight: obj.fontWeight || 400,
          fontStyle: obj.fontStyle || 'normal',
          fontFamily: obj.fontFamily || 'Inter, Helvetica, Arial, sans-serif',
          fill: obj.fill || '#ffffff',
          textAlign: obj.textAlign || 'center',
          name: obj.name || '',
        });
      } else if (obj.type === 'textbox') {
        fabricObj = new fabric.FabricText(obj.text || '', {
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
          name: obj.name || '',
        });
      } else if (obj.type === 'image' && obj.src) {
        try {
          const isSvg = /\.svg($|\?)/i.test(obj.src) || obj.src.startsWith('data:image/svg');
          const isLogo = obj.name === 'logo';

          if (isSvg && isLogo) {
            // ── SVG LOGO: vector paths via loadSVGFromString ──
            let svgString = '';
            try {
              if (obj.src.startsWith('data:')) {
                const base64Match = obj.src.match(/base64,(.+)/);
                if (base64Match) {
                  svgString = atob(base64Match[1]);
                } else {
                  svgString = decodeURIComponent(obj.src.split(',')[1] || '');
                }
              } else {
                const resp = await fetch(obj.src);
                svgString = await resp.text();
              }
            } catch (fetchErr) {
              console.warn('[DesignCanvas] Failed to get SVG string:', fetchErr);
            }

            let svgLoaded = false;
            if (svgString && svgString.includes('<svg')) {
              try {
                const { objects: svgObjs } = await fabric.loadSVGFromString(svgString);
                if (svgObjs && svgObjs.filter(Boolean).length > 0) {
                  const logoGroup = new fabric.Group(svgObjs.filter(Boolean) as any[]);
                  const maxW = obj.maxWidth || tmpl.width * 0.35;
                  const maxH = obj.maxHeight || tmpl.height * 0.18;
                  const gw = logoGroup.width || 200;
                  const gh = logoGroup.height || 200;
                  const s = Math.min(maxW / gw, maxH / gh);
                  // Position: convert center-origin to left-origin
                  let leftPos = obj.left || 0;
                  if (obj.originX === 'center') leftPos = leftPos - (gw * s) / 2;
                  logoGroup.set({
                    scaleX: s, scaleY: s,
                    left: leftPos, top: obj.top || 0,
                    originX: 'left', originY: 'top',
                    selectable: true, evented: true, hasControls: true, hasBorders: true, lockRotation: true,
                    borderColor: '#2563eb', cornerColor: '#2563eb', cornerSize: 8, cornerStyle: 'circle', transparentCorners: false,
                    name: 'logo',
                  });
                  // White fills for dark background (default brand mode)
                  logoGroup.getObjects().forEach((p: any) => {
                    if (p.fill && p.fill !== 'none' && p.fill !== 'transparent') p.set('fill', '#ffffff');
                    if (p.stroke && p.stroke !== 'none' && p.stroke !== 'transparent') p.set('stroke', '#ffffff');
                  });
                  fc.add(logoGroup);
                  svgLoaded = true;
                  console.log('[DesignCanvas] SVG logo loaded as vector, scale:', s.toFixed(3));
                }
              } catch (parseErr) {
                console.warn('[DesignCanvas] SVG parse failed:', parseErr);
              }
            }

            // Raster fallback
            if (!svgLoaded) {
              const imgOptions: any = { crossOrigin: 'anonymous' };
              const img = await fabric.FabricImage.fromURL(obj.src, imgOptions);
              if (img && img.width) {
                const maxW = obj.maxWidth || 200; const maxH = obj.maxHeight || 200;
                const s = Math.min(maxW / (img.width || 200), maxH / (img.height || 200));
                img.set({ left: obj.left, top: obj.top, originX: obj.originX || 'left', originY: 'top', scaleX: s, scaleY: s, name: 'logo', selectable: true, evented: true, hasControls: true, hasBorders: true, lockRotation: true, borderColor: '#2563eb', cornerColor: '#2563eb', cornerSize: 8, cornerStyle: 'circle', transparentCorners: false, objectCaching: false });
                fc.add(img);
                console.log('[DesignCanvas] Logo loaded as raster fallback');
              }
            }
          } else {
            // ── RASTER IMAGE (PNG/JPG or non-logo) ──
            const imgOptions: any = { crossOrigin: 'anonymous' };
            const img = await fabric.FabricImage.fromURL(obj.src, imgOptions);
            if (!img || !img.width) continue;
            img.set({
              left: obj.left, top: obj.top,
              originX: obj.originX || 'left', originY: 'top',
              name: obj.name || '', objectCaching: false,
            });
            if (obj.maxWidth) {
              const s = Math.min((obj.maxWidth) / (img.width || 200), (obj.maxHeight || obj.maxWidth) / (img.height || 200));
              img.set({ scaleX: s, scaleY: s });
            } else if (obj.scaleX || obj.scaleY) {
              img.set({ scaleX: obj.scaleX || 1, scaleY: obj.scaleY || 1 });
            }
            fc.add(img);
          }
        } catch (e) {
          console.error('Failed to load image:', obj.src?.slice(0, 80), e);
        }
        continue;
      }

      if (fabricObj) fc.add(fabricObj);
      } catch (err) {
        console.warn('[DesignCanvas] Failed to create object:', obj.name, obj.type, err);
      }
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
      brand: { 'brand-bg': brandColor, 'white-strip': '#ffffff', 'headline-text': '#ffffff', 'phone-text': '#ffffff', 'company-text': brandColor, 'tagline-text': '#ffffff', 'info-text': '#666666' },
      dark: { 'brand-bg': darkColor, 'white-strip': '#ffffff', 'headline-text': '#ffffff', 'phone-text': '#ffffff', 'company-text': darkColor, 'tagline-text': '#ffffff', 'info-text': '#666666' },
      light: { 'brand-bg': '#ffffff', 'white-strip': brandColor, 'headline-text': brandColor, 'phone-text': brandColor, 'company-text': '#ffffff', 'tagline-text': brandColor, 'info-text': '#999999' },
    };
    const bcMap: Record<string, Record<string, string>> = {
      brand: { 'card-bg': brandColor, 'company-text': '#ffffff', 'contact-name-text': '#ffffff', 'title-text': 'rgba(255,255,255,0.7)', 'contact-info-text': 'rgba(255,255,255,0.85)', 'tagline-text': 'rgba(255,255,255,0.5)', 'accent-line': 'rgba(255,255,255,0.3)' },
      dark: { 'card-bg': '#111827', 'company-text': '#ffffff', 'contact-name-text': '#ffffff', 'title-text': 'rgba(255,255,255,0.7)', 'contact-info-text': 'rgba(255,255,255,0.85)', 'tagline-text': 'rgba(255,255,255,0.5)', 'accent-line': 'rgba(255,255,255,0.3)' },
      light: { 'card-bg': '#ffffff', 'company-text': brandColor, 'contact-name-text': '#111827', 'title-text': '#6b7280', 'contact-info-text': '#374151', 'tagline-text': '#9ca3af', 'accent-line': brandColor },
    };
    const hasCardBg = fc.getObjects().some((o: any) => o.name === 'card-bg');
    const fills = hasCardBg ? bcMap[mode] : colorMap[mode];

    const isDarkBg = mode !== 'light';
    const logoFill = isDarkBg ? '#ffffff' : null; // white on dark, restore on light

    fc.getObjects().forEach((obj: any) => {
      if (fills[obj.name]) obj.set('fill', fills[obj.name]);

      // SVG logo group — recolor all paths
      if (obj.name === 'logo' && typeof obj.getObjects === 'function') {
        obj.getObjects().forEach((p: any) => {
          if (logoFill) {
            if (p.fill && p.fill !== 'none' && p.fill !== 'transparent') p.set('fill', logoFill);
            if (p.stroke && p.stroke !== 'none' && p.stroke !== 'transparent') p.set('stroke', logoFill);
          } else {
            // Light mode: use dark fills for visibility
            if (p.fill && p.fill !== 'none' && p.fill !== 'transparent') p.set('fill', '#1a1a1a');
            if (p.stroke && p.stroke !== 'none' && p.stroke !== 'transparent') p.set('stroke', '#1a1a1a');
          }
        });
        obj.dirty = true;
      }
      // Raster logo — swap elements (legacy path)
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
      originX: 'left', originY: 'top',
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
          background: 'transparent', color: '#666', border: '1px solid #e2e2e5',
          borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms',
        }}>Download PNG</button>
      </div>
    </div>
  );
}
