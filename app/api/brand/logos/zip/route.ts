/**
 * The whole logo set, in one file.
 *
 * WHY A ZIP AND NOT A LIST OF LINKS
 *
 * "Send me your logo" is a request nobody can answer in one file, because the
 * asker does not know what they need: a printer wants vector, a slide deck
 * wants a big transparent PNG, a signature wants a small one. Handing over
 * every version in every format, foldered so the names explain themselves, is
 * the answer to the question actually being asked.
 *
 * WHY IT IS BUILT HERE AND NOT IN THE BROWSER
 *
 * The masters are private, the PNG sizes come from sharp and the PDFs from a
 * real vector converter. None of that exists on the client, and signing
 * eighteen URLs so a browser can re-download and re-encode them would be
 * slower and would put the kit's storage paths in front of the page.
 *
 * WHY THERE IS NO EPS
 *
 * Producing a genuine EPS needs Ghostscript or Illustrator. Neither is on a
 * serverless function, and a PDF renamed .eps fails at the printer rather
 * than here, which is the worse place to find out. The PDF is vector and is
 * what a printer should be sent.
 */

import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';
import { whoIsCalling, serviceClient } from '@/lib/spine/api-caller';
import { brandForOrg } from '@/lib/spine/brand-for-org';
import { setFromKit, approvedColors, type SetEntry } from '@/lib/spine/logo-set';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/* Eighteen masters, four derived files each, plus a sheet. Comfortably inside
   this, and the alternative is a timeout with no explanation. */
export const maxDuration = 60;

const PNG_SIZES = [
  { px: 2048, label: 'large' },
  { px: 1024, label: 'medium' },
  { px: 512, label: 'small' },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * A vector PDF from an SVG master.
 *
 * The masters declare width and height at a tenth of their viewBox, which is
 * the coordinate space the paths are actually in, so the attributes are
 * dropped and the viewBox is trusted. Left in, the artwork draws at a tenth
 * scale in the corner of the page.
 */
async function svgToPdf(svg: string): Promise<Buffer> {
  const vb = (svg.match(/viewBox="([^"]*)"/) ?? [])[1]?.split(/[\s,]+/).map(Number);
  const ratio = vb && vb[2] && vb[3] ? vb[3] / vb[2] : 1;
  const clean = svg.replace(/\s(width|height)="[^"]*"/g, '');
  const W = 600, H = Math.max(1, Math.round(W * ratio));

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [W, H], margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      SVGtoPDF(doc, clean, 0, 0, { width: W, height: H });
      doc.end();
    } catch (e) { reject(e); }
  });
}

/** The one-page sheet: what the colors are, what the type is, what not to do. */
async function brandSheet(
  business: string,
  kit: Record<string, unknown> | null
): Promise<Buffer> {
  const colors = ((kit?.colors ?? []) as Array<{ name?: string; hex?: string; role?: string; rgb?: string }>);
  const fonts = ((kit?.fonts ?? []) as Array<{ family?: string; role?: string; weight?: string }>);
  const rules = (kit?.logo_rules ?? {}) as { donts?: string[]; color_versions?: Array<{ name?: string; rule?: string }> };
  const guard = (kit?.guardrails ?? {}) as { never?: string[] };

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).fillColor('#111111').text(business, { continued: false });
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#666666').text('Brand sheet. Colors, type, and what not to do.');
    doc.moveDown(1);

    doc.fontSize(12).fillColor('#111111').text('Colors');
    doc.moveDown(0.4);
    for (const c of colors) {
      const y = doc.y;
      const hex = String(c.hex ?? '');
      if (/^#[0-9a-fA-F]{6}$/.test(hex)) doc.rect(48, y, 22, 14).fill(hex);
      doc.fillColor('#111111').fontSize(10)
        .text(`${c.name ?? ''}   ${hex.toUpperCase()}${c.rgb ? `   rgb(${c.rgb})` : ''}`, 78, y + 2);
      if (c.role) doc.fillColor('#777777').fontSize(9).text(String(c.role), 78, doc.y);
      doc.moveDown(0.5);
    }

    doc.moveDown(0.6).fillColor('#111111').fontSize(12).text('Type');
    doc.moveDown(0.4);
    for (const f of fonts) {
      doc.fontSize(10).fillColor('#111111')
        .text(`${f.family ?? ''}${f.weight ? `   ${f.weight}` : ''}`, { continued: true })
        .fillColor('#777777').text(`   ${f.role ?? ''}`);
    }
    if (!fonts.length) doc.fontSize(10).fillColor('#777777').text('Not recorded in the kit.');

    if (rules.color_versions?.length) {
      doc.moveDown(0.8).fillColor('#111111').fontSize(12).text('Approved color versions');
      doc.moveDown(0.4);
      for (const v of rules.color_versions) {
        doc.fontSize(10).fillColor('#111111').text(`${v.name ?? ''}`, { continued: true })
          .fillColor('#777777').text(`   ${v.rule ?? ''}`);
      }
    }

    const donts = [...(rules.donts ?? []), ...(guard.never ?? [])];
    if (donts.length) {
      doc.moveDown(0.8).fillColor('#111111').fontSize(12).text("Don'ts");
      doc.moveDown(0.4);
      for (const d of donts) doc.fontSize(9.5).fillColor('#444444').text(`•  ${d}`, { paragraphGap: 3 });
    }

    doc.end();
  });
}

export async function GET() {
  const caller = await whoIsCalling();
  if (!caller?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const db = serviceClient();
  if (!db) return NextResponse.json({ error: 'Server is not configured.' }, { status: 500 });

  const { data: profile } = await db
    .from('profiles').select('active_org_id').eq('id', caller.userId).maybeSingle();
  const orgId = (profile as { active_org_id?: string } | null)?.active_org_id;
  if (!orgId) return NextResponse.json({ error: 'No workspace open.' }, { status: 400 });

  const facts = await brandForOrg(db, orgId);
  const entries = setFromKit(facts.kit);
  if (!entries.length || !facts.assetPrefix) {
    return NextResponse.json({ error: 'There are no logo files in this kit yet.' }, { status: 404 });
  }

  const zip = new JSZip();
  const root = zip.folder(`${slug(facts.name)}-logos`)!;
  const failed: string[] = [];

  /* One folder per version, then per color, then the formats inside. The
     path is the description, so a file pulled out of the zip and emailed on
     still says what it is. */
  const grouped = new Map<string, SetEntry[]>();
  for (const e of entries) {
    const k = e.versionLabel;
    grouped.set(k, [...(grouped.get(k) ?? []), e]);
  }

  for (const [versionLabel, list] of grouped) {
    const vf = root.folder(slug(versionLabel))!;
    for (const e of list) {
      const cf = vf.folder(slug(e.color))!;
      const stem = e.fileStem;

      let svg: string | null = null;
      if (e.svgPath) {
        const { data } = await db.storage.from('client-assets').download(`${facts.assetPrefix}/${e.svgPath}`);
        if (data) svg = await data.text();
      }
      if (svg) cf.file(`${stem}.svg`, svg);

      /* Raster from the SVG where there is one, because it is the master and
         scales cleanly; from the stored PNG only where there is no SVG. */
      let rasterSource: Buffer | null = null;
      if (svg) rasterSource = Buffer.from(svg, 'utf8');
      else if (e.rasterPath) {
        const { data } = await db.storage.from('client-assets').download(`${facts.assetPrefix}/${e.rasterPath}`);
        if (data) rasterSource = Buffer.from(await data.arrayBuffer());
      }

      if (rasterSource) {
        for (const s of PNG_SIZES) {
          try {
            const png = await sharp(rasterSource, { density: 600 })
              .resize({ width: s.px, withoutEnlargement: false, fit: 'inside' })
              .png({ compressionLevel: 9 })
              .toBuffer();
            cf.file(`${stem}-${s.label}-${s.px}px.png`, png);
          } catch { failed.push(`${stem} ${s.label} PNG`); }
        }
      }

      if (svg) {
        try { cf.file(`${stem}.pdf`, await svgToPdf(svg)); }
        catch { failed.push(`${stem} PDF`); }
      }
    }
  }

  try {
    root.file(`${slug(facts.name)}-brand-sheet.pdf`, await brandSheet(facts.name, facts.kit));
  } catch { failed.push('brand sheet'); }

  /*
    A note in the zip about what is not in it.

    Silence about a missing EPS reads as "there isn't one", which is true, but
    not as "here is why and here is what to send the printer instead".
  */
  const approved = approvedColors(facts.kit).join(', ');
  root.file(
    'README.txt',
    [
      `${facts.name} logo files`,
      '',
      'Folders are version, then color. Inside each:',
      '  .svg                 the master. Scales to anything.',
      '  -large-2048px.png    transparent, for print-ish and big screens',
      '  -medium-1024px.png   transparent, for slides and documents',
      '  -small-512px.png     transparent, for web, email and avatars',
      '  .pdf                 vector, for print. Send this to a printer.',
      '',
      `Approved color versions: ${approved}.`,
      'Anything not listed there is not an approved version of this logo.',
      '',
      'There is no EPS. Making a real one needs Ghostscript or Illustrator,',
      'which this does not have, and a PDF renamed .eps fails at the printer',
      'rather than here. The PDF is vector and is what a printer wants.',
      '',
      failed.length ? `Could not build: ${failed.join(', ')}.` : '',
    ].filter(Boolean).join('\n')
  );

  const body = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return new NextResponse(new Uint8Array(body), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${slug(facts.name)}-logos.zip"`,
      'cache-control': 'no-store',
    },
  });
}
