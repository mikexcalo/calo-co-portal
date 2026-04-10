interface LogoVariant {
  name: string;
  label: string;
  description: string;
  svgString: string;
  bgColor: string;
}

export function generateLogoVariants(
  originalSvg: string,
  primaryColor: string,
  secondaryColor?: string
): LogoVariant[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(originalSvg, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  if (!svgEl) return [];

  const remapColors = (targetColor: string): string => {
    const clone = svgEl.cloneNode(true) as SVGElement;
    clone.querySelectorAll('*').forEach(el => {
      const fill = el.getAttribute('fill');
      const stroke = el.getAttribute('stroke');
      const style = el.getAttribute('style');
      if (fill && fill !== 'none' && fill !== 'transparent' && !fill.startsWith('url(')) {
        el.setAttribute('fill', targetColor);
      }
      if (stroke && stroke !== 'none' && stroke !== 'transparent' && !stroke.startsWith('url(')) {
        el.setAttribute('stroke', targetColor);
      }
      if (style) {
        let s = style;
        s = s.replace(/fill:\s*(?!none|transparent|url)[^;]+/gi, `fill: ${targetColor}`);
        s = s.replace(/stroke:\s*(?!none|transparent|url)[^;]+/gi, `stroke: ${targetColor}`);
        el.setAttribute('style', s);
      }
    });
    clone.querySelectorAll('stop').forEach(stop => {
      const sc = stop.getAttribute('stop-color');
      if (sc && sc !== 'none') stop.setAttribute('stop-color', targetColor);
      const style = stop.getAttribute('style');
      if (style) stop.setAttribute('style', style.replace(/stop-color:\s*[^;]+/gi, `stop-color: ${targetColor}`));
    });
    return new XMLSerializer().serializeToString(clone);
  };

  const addBackground = (svgStr: string, bgColor: string): string => {
    const clone = new DOMParser().parseFromString(svgStr, 'image/svg+xml').querySelector('svg');
    if (!clone) return svgStr;
    const viewBox = clone.getAttribute('viewBox');
    const vb = viewBox?.split(/\s+/).map(Number) || [0, 0, 100, 100];
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', String(vb[0]));
    bgRect.setAttribute('y', String(vb[1]));
    bgRect.setAttribute('width', String(vb[2]));
    bgRect.setAttribute('height', String(vb[3]));
    bgRect.setAttribute('fill', bgColor);
    clone.insertBefore(bgRect, clone.firstChild);
    return new XMLSerializer().serializeToString(clone);
  };

  const sec = secondaryColor || '#919191';
  const origStr = new XMLSerializer().serializeToString(svgEl);

  return [
    { name: 'original', label: 'Original', description: 'As uploaded', svgString: origStr, bgColor: '#ffffff' },
    { name: 'solid-primary', label: 'Solid Primary', description: `All elements in ${primaryColor}`, svgString: remapColors(primaryColor), bgColor: '#ffffff' },
    { name: 'solid-dark', label: 'Solid Dark', description: 'All elements in dark', svgString: remapColors('#1a1a1a'), bgColor: '#ffffff' },
    { name: 'white-knockout', label: 'White Knockout', description: 'For dark backgrounds', svgString: remapColors('#ffffff'), bgColor: '#1a1a1a' },
    { name: 'reverse', label: 'Reverse', description: 'Original on dark background', svgString: addBackground(origStr, '#1a1a1a'), bgColor: '#1a1a1a' },
    { name: 'solid-secondary', label: 'Solid Secondary', description: 'All elements in secondary', svgString: remapColors(sec), bgColor: '#ffffff' },
  ];
}

export function svgToPng(svgString: string, width: number = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const ar = img.naturalHeight / img.naturalWidth;
      const h = Math.round(width * ar);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No canvas context')); return; }
      ctx.drawImage(img, 0, 0, width, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load SVG')); };
    img.src = url;
  });
}
