import sharp from 'sharp';

/**
 * AETHER — question image renderer.
 * Renders a question card (statement + four options) to an image through sharp.
 * Seeded image-only questions show no machine-readable text in the DOM, so the
 * statement and options cannot be selected, copied, or pasted elsewhere.
 *
 * Questions carry either a statement+options or a full image — the model and the
 * no-repeat fingerprint rules already accept image-only questions.
 */

export interface RenderQuestionCard {
  statement: string;
  options: { A: string; B: string; C: string; D: string };
  header?: string;
}

// Basic line-wrapping for the SVG <text> layout.
function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderTextBlock(lines: string[], x: number, y: number, size: number, fill: string, weight = 500, family = 'Segoe UI, Arial, sans-serif'): string {
  return lines
    .map((line, i) => `<text x="${x}" y="${y + i * (size + 10)}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`)
    .join('\n      ');
}

export async function renderQuestionImage(card: RenderQuestionCard): Promise<Buffer> {
  const width = 900;
  const statementLines = wrapLines(card.statement, 78, 4);
  const statementHeight = statementLines.length * 36 + 24;

  const optionEntries = (['A', 'B', 'C', 'D'] as const).map(key => ({ key, text: card.options[key] || `Option ${key}` }));
  const optionRows = optionEntries.map(option => {
    const lines = wrapLines(option.text, 64, 2);
    return { ...option, lines, height: lines.length * 26 + 22 };
  });
  const optionsHeight = optionRows.reduce((sum, row) => sum + row.height + 10, 0);

  const height = 96 + statementHeight + optionsHeight + 28;
  const header = card.header || 'AETHER ASSESSMENT';

  const optionSvg = optionRows.map((row, index) => {
    const y = 96 + statementHeight + optionRows.slice(0, index).reduce((sum, r) => sum + r.height + 10, 0);
    return `
    <g>
      <rect x="60" y="${y}" width="${width - 120}" height="${row.height}" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5"/>
      <circle cx="94" cy="${y + row.height / 2}" r="16" fill="#EEF2FF" stroke="#2563EB" stroke-width="1.5"/>
      <text x="94" y="${y + row.height / 2 + 5}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="700" fill="#1D4ED8">${row.key}</text>
      ${renderTextBlock(row.lines, 122, y + 31, 19, '#0F172A')}
    </g>`;
  }).join('\n');

  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#F8FAFC"/>
    <rect x="24" y="20" width="${width - 48}" height="${height - 40}" rx="16" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
    <text x="60" y="62" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="700" letter-spacing="2" fill="#2563EB">${escapeXml(header)}</text>
    ${renderTextBlock(statementLines, 60, 96 + 24, 22, '#0F172A', 600)}
    ${optionSvg}
  </svg>`;

  // WebP matches the upload pipeline's normalization (quality 90) and stays small.
  return sharp(Buffer.from(svg), { limitInputPixels: 25000000 })
    .resize(width, height, { fit: 'fill' })
    .webp({ quality: 90 })
    .toBuffer();
}
