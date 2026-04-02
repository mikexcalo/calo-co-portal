'use client';

import React, { useRef, useEffect, useState } from 'react';

interface CanvasTemplate {
  width: number;
  height: number;
  objects: any[];
}

interface DesignCanvasProps {
  template: CanvasTemplate;
  onSave?: (json: string) => void;
  savedState?: string | null;
  brandColor?: string;
  darkColor?: string;
}

export default function DesignCanvas({ template, onSave, savedState, brandColor = '#28502e', darkColor = '#1a1a1a' }: DesignCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<any>(null);
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [colorMode, setColorMode] = useState<'brand' | 'dark' | 'light'>('brand');
  const [canvasReady, setCanvasReady] = useState(false);

  // Initialize canvas
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
      });

      fabricRef.current = fc;

      // Load saved state or template
      if (savedState) {
        fc.loadFromJSON(savedState, () => {
          fc.renderAll();
          setCanvasReady(true);
        });
      } else {
        loadTemplate(fc, fabric, template);
        setCanvasReady(true);
      }

      // Selection events
      fc.on('selection:created', (e: any) => setSelectedObject(e.selected?.[0] || null));
      fc.on('selection:updated', (e: any) => setSelectedObject(e.selected?.[0] || null));
      fc.on('selection:cleared', () => setSelectedObject(null));

      // Auto-save on modification
      fc.on('object:modified', () => {
        if (onSave) {
          onSave(JSON.stringify(fc.toJSON()));
        }
      });
    };

    initCanvas();

    return () => {
      if (fc) fc.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTemplate = async (fc: any, fabric: any, tmpl: CanvasTemplate) => {
    for (const obj of tmpl.objects) {
      let fabricObj: any;

      if (obj.type === 'rect') {
        fabricObj = new fabric.Rect({
          left: obj.left,
          top: obj.top,
          width: obj.width,
          height: obj.height,
          fill: obj.fill,
          rx: obj.rx || 0,
          ry: obj.ry || 0,
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
          left: obj.left,
          top: obj.top,
          width: obj.width,
          originX: obj.originX || 'left',
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
          // Handle both URLs and base64 data URIs
          const imgOptions: any = {};
          if (obj.src.startsWith('http')) {
            imgOptions.crossOrigin = 'anonymous';
          }
          const img = await fabric.FabricImage.fromURL(obj.src, imgOptions);
          if (!img || !img.width) {
            console.warn('Image loaded but has no dimensions:', obj.src.slice(0, 50));
            continue;
          }
          img.set({
            left: obj.left,
            top: obj.top,
            originX: obj.originX || 'left',
            scaleX: obj.scaleX || 1,
            scaleY: obj.scaleY || 1,
            name: obj.name || '',
          });
          if (obj.maxWidth && img.width) {
            const s = Math.min(obj.maxWidth / img.width, (obj.maxHeight || obj.maxWidth) / (img.height || img.width));
            img.scaleX = s;
            img.scaleY = s;
          }
          fc.add(img);
        } catch (e) {
          console.error('Failed to load image:', obj.src?.slice(0, 80), e);
        }
        continue;
      }

      if (fabricObj) fc.add(fabricObj);
    }
    fc.renderAll();
  };

  // Export PNG
  const handleExportPNG = () => {
    if (!fabricRef.current) return;
    const fc = fabricRef.current;
    fc.discardActiveObject();
    fc.renderAll();
    const dataURL = fc.toDataURL({ format: 'png', multiplier: 3, quality: 1 });
    const link = document.createElement('a');
    link.download = 'design.png';
    link.href = dataURL;
    link.click();
  };

  // Export PDF
  const handleExportPDF = async () => {
    if (!fabricRef.current) return;
    const fc = fabricRef.current;
    fc.discardActiveObject();
    fc.renderAll();

    const { jsPDF } = await import('jspdf');
    const dataURL = fc.toDataURL({ format: 'png', multiplier: 3, quality: 1 });

    const isLandscape = template.width > template.height;
    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'px',
      format: [template.width, template.height],
    });
    pdf.addImage(dataURL, 'PNG', 0, 0, template.width, template.height);
    pdf.save('design.pdf');
  };

  // Color mode switching
  const handleColorMode = (mode: 'brand' | 'dark' | 'light') => {
    if (!fabricRef.current) return;
    const fc = fabricRef.current;
    setColorMode(mode);

    const bgColors = { brand: brandColor, dark: darkColor, light: '#ffffff' };
    const textColors = { brand: '#ffffff', dark: '#ffffff', light: '#111827' };
    const stripBg = { brand: '#ffffff', dark: '#ffffff', light: brandColor };
    const stripText = { brand: brandColor, dark: darkColor, light: '#ffffff' };

    fc.getObjects().forEach((obj: any) => {
      if (obj.name === 'brand-bg') obj.set('fill', bgColors[mode]);
      if (obj.name === 'white-strip') obj.set('fill', stripBg[mode]);
      if (obj.name === 'headline-text' || obj.name === 'phone-text') obj.set('fill', textColors[mode]);
      if (obj.name === 'company-text') obj.set('fill', stripText[mode]);
      if (obj.name === 'detail-text') {
        obj.set('fill', mode === 'light' ? 'rgba(255,255,255,0.7)' : '#6b7280');
      }
    });
    fc.renderAll();
  };

  // Delete selected object
  const handleDelete = () => {
    if (!fabricRef.current || !selectedObject) return;
    if (selectedObject.name === 'brand-bg' || selectedObject.name === 'white-strip') return;
    fabricRef.current.remove(selectedObject);
    setSelectedObject(null);
  };

  // Add text
  const handleAddText = async () => {
    if (!fabricRef.current) return;
    const fabric = await import('fabric');
    const text = new fabric.Textbox('New text', {
      left: template.width / 2 - 60,
      top: template.height / 2 - 15,
      width: 120,
      fontSize: 18,
      fontFamily: 'Inter, Helvetica, Arial, sans-serif',
      fill: '#ffffff',
      textAlign: 'center',
    });
    fabricRef.current.add(text);
    fabricRef.current.setActiveObject(text);
    fabricRef.current.renderAll();
  };

  // Scale canvas to fit container
  const containerWidth = 520;
  const scale = containerWidth / template.width;
  const displayHeight = template.height * scale;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={handleAddText} style={{
          padding: '6px 12px', fontSize: 12, border: '1px solid #e5e7eb',
          borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#374151',
          fontFamily: 'Inter, sans-serif',
        }}>
          + Text
        </button>
        {selectedObject && selectedObject.name !== 'brand-bg' && selectedObject.name !== 'white-strip' && (
          <button onClick={handleDelete} style={{
            padding: '6px 12px', fontSize: 12, border: '1px solid #fecaca',
            borderRadius: 6, background: '#fef2f2', cursor: 'pointer', color: '#991b1b',
            fontFamily: 'Inter, sans-serif',
          }}>
            Delete
          </button>
        )}
        <div style={{ flex: 1 }} />
        {/* Color dots */}
        {([
          { mode: 'brand' as const, color: brandColor },
          { mode: 'dark' as const, color: darkColor },
          { mode: 'light' as const, color: '#ffffff' },
        ]).map(({ mode, color }) => (
          <div
            key={mode}
            onClick={() => handleColorMode(mode)}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              backgroundColor: color,
              border: colorMode === mode ? '2px solid #2563eb' : '1px solid #d1d5db',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>

      {/* Canvas container — scaled to fit */}
      <div style={{
        width: containerWidth, height: displayHeight,
        overflow: 'hidden', borderRadius: 4, border: '1px solid #e5e7eb',
      }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      {/* Export buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={handleExportPDF} style={{
          padding: '8px 20px', fontSize: 13, fontWeight: 500,
          background: '#2563eb', color: '#fff', border: 'none',
          borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}>
          Download PDF
        </button>
        <button onClick={handleExportPNG} style={{
          padding: '8px 20px', fontSize: 13, fontWeight: 500,
          background: '#fff', color: '#2563eb', border: '1px solid #2563eb',
          borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}>
          Download PNG
        </button>
      </div>
    </div>
  );
}
