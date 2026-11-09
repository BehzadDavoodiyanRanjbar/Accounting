// فایل‌های PDF.js (خواندن PDF در مرورگر) را از node_modules به public/ocr کپی می‌کند. خودِ OCR با Tesseract سمت سرور انجام می‌شود. بعد از npm install و پیش از npm run build خودکار اجرا می‌شود.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const out = join(root, 'public', 'ocr');
const log = [];
const miss = [];

const put = (from, to) => {
  if (!existsSync(from)) return false;
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  log.push(to.replace(root, '.'));
  return true;
};
const walk = (dir) => (existsSync(dir) ? readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; }) : []);

if (!put(join(nm, 'pdfjs-dist', 'build', 'pdf.min.mjs'), join(out, 'pdf.min.mjs'))) miss.push('pdfjs-dist');
put(join(nm, 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'), join(out, 'pdf.worker.min.mjs'));

console.log(`[OCR] ${log.length} فایل در public/ocr کپی شد.`);
if (miss.length) console.log(`[OCR] هشدار: این بسته‌ها پیدا نشد: ${miss.join('، ')} — «npm install» را دوباره اجرا کنید. بدون آن‌ها خواندن PDF کار نمی‌کند (بقیهٔ برنامه بی‌اثر است).`);
