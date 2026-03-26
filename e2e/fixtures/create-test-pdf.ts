// Run with: npx tsx e2e/fixtures/create-test-pdf.ts
// Generates a minimal but valid PDF with correct XRef byte offsets.
import fs from 'fs';
import path from 'path';

function buildPdf(): Buffer {
  const parts: string[] = [];
  const offsets: number[] = [];
  let pos = 0;

  function emit(s: string) {
    parts.push(s);
    pos += Buffer.byteLength(s, 'ascii');
  }

  // Header
  emit('%PDF-1.4\n');

  // Object 1 — Catalog
  offsets[1] = pos;
  emit('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Object 2 — Pages
  offsets[2] = pos;
  emit('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // Object 3 — Page
  offsets[3] = pos;
  emit('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n');

  // Object 4 — Content stream
  const stream =
    'BT\n' +
    '/F1 14 Tf\n' +
    '50 750 Td\n' +
    '(John Doe) Tj\n' +
    '0 -20 Td\n' +
    '(Software Engineer) Tj\n' +
    '0 -20 Td\n' +
    '(Experience: Senior Developer at TechCorp 2020-2024) Tj\n' +
    '0 -20 Td\n' +
    '(Education: BSc Computer Science MIT 2016-2020) Tj\n' +
    '0 -20 Td\n' +
    '(Skills: TypeScript React Node.js PostgreSQL AWS) Tj\n' +
    'ET\n';
  offsets[4] = pos;
  emit(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`);

  // Object 5 — Font
  offsets[5] = pos;
  emit('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  // XRef table
  const xrefPos = pos;
  emit('xref\n');
  emit(`0 6\n`);
  emit('0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) {
    emit(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }

  // Trailer
  emit('trailer\n<< /Size 6 /Root 1 0 R >>\n');
  emit(`startxref\n${xrefPos}\n%%EOF\n`);

  return Buffer.from(parts.join(''), 'ascii');
}

const pdfBuffer = buildPdf();
const outPath = path.resolve(__dirname, 'test-resume.pdf');
fs.writeFileSync(outPath, pdfBuffer);
console.log(`Created ${outPath} (${pdfBuffer.length} bytes)`);
