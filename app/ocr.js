'use strict';
/**
 * OCR سمت سرور با Tesseract نصب‌شده روی همین سرور (بدون اینترنت، بدون سرویس بیرونی، بدون هوش مصنوعی).
 * مرورگر تصویر صفحه را (PNG/JPG) می‌فرستد؛ اینجا tesseract اجرا می‌شود و کلمه‌ها با مختصات و اطمینان برمی‌گردند.
 * داده‌ی زبان فارسی/انگلیسی در پوشهٔ app/tessdata همراه برنامه است (نیازی به نصب بستهٔ زبان نیست).
 * فقط باینری tesseract لازم است: Docker ← در Dockerfile نصب می‌شود؛ ویندوز ← install-ocr.ps1.
 */
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');

const BIDI = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\u061c\ufeff]/g;
const TD_LOCAL = process.env.TESSDATA_DIR || path.join(__dirname, 'tessdata');
const hasLocal = () => fs.existsSync(path.join(TD_LOCAL, 'fas.traineddata'));

function candidates() {
  const c = [];
  if (process.env.TESSERACT_PATH) c.push(process.env.TESSERACT_PATH);
  c.push(path.join(__dirname, 'tesseract', process.platform === 'win32' ? 'tesseract.exe' : 'tesseract'));
  if (process.platform === 'win32') {
    for (const b of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs'), 'C:\\Program Files', 'C:\\Program Files (x86)'])
      if (b) c.push(path.join(b, 'Tesseract-OCR', 'tesseract.exe'));
  }
  c.push('tesseract');
  return [...new Set(c)];
}

function run(bin, args, opt) {
  return new Promise((ok, no) => {
    cp.execFile(bin, args, Object.assign({ windowsHide: true, maxBuffer: 16e6 }, opt || {}), (err, so, se) => (err ? no(Object.assign(err, { stderr: String(se || '') })) : ok({ out: String(so || ''), err: String(se || '') })));
  });
}

let found = null, lastTry = 0, lastErr = '';
async function locate(force) {
  if (found) return found;
  if (!force && Date.now() - lastTry < 5000) return null;
  lastTry = Date.now();
  for (const b of candidates()) {
    if (b !== 'tesseract' && path.isAbsolute(b) && !fs.existsSync(b)) continue;
    try {
      const r = await run(b, ['--version'], { timeout: 15000 });
      const m = /tesseract\s+v?([\d.]+)/i.exec(r.out + r.err);
      found = { bin: b, version: m ? m[1] : '?' };
      return found;
    } catch (e) { lastErr = String(e && e.message || e).split('\n')[0]; }
  }
  return null;
}

async function status() {
  const t = await locate(true);
  if (!t) return { ok: false, error: 'tesseract', detail: lastErr };
  let langs = [];
  if (hasLocal()) langs = ['fas', 'eng'].filter(l => fs.existsSync(path.join(TD_LOCAL, l + '.traineddata')));
  else { try { const r = await run(t.bin, ['--list-langs'], { timeout: 15000 }); langs = (r.out + r.err).split(/\r?\n/).map(s => s.trim()).filter(s => /^[a-z_]{3,}$/.test(s)); } catch (e) { /* ignore */ } }
  if (langs.indexOf('fas') < 0) return { ok: false, error: 'lang', version: t.version, detail: 'fas' };
  return { ok: true, version: t.version, langs };
}

/* حداکثر ۲ پردازش هم‌زمان؛ بقیه در صف می‌مانند */
let active = 0; const waiting = [];
const slot = () => new Promise(ok => { const go = () => { active++; ok(() => { active--; const n = waiting.shift(); if (n) n(); }); }; if (active < 2) go(); else waiting.push(go); });

function parseTsv(tsv) {
  const words = [];
  for (const ln of tsv.split(/\r?\n/).slice(1)) {
    const f = ln.split('\t'); if (f.length < 12 || f[0] !== '5') continue;
    const text = f.slice(11).join('\t').replace(BIDI, '').trim(); const conf = Number(f[10]);
    if (!text || !(conf >= 0)) continue;
    const x0 = +f[6], y0 = +f[7];
    words.push({ text, x0, y0, x1: x0 + +f[8], y1: y0 + +f[9], conf });
  }
  return words;
}

/** buf: بایت‌های PNG یا JPG؛ psm: '6' جدول، '4' فیش */
async function recognize(buf, psm) {
  if (!Buffer.isBuffer(buf) || buf.length < 100) throw new Error('تصویر خالی یا ناقص است.');
  const png = buf[0] === 0x89 && buf[1] === 0x50, jpg = buf[0] === 0xff && buf[1] === 0xd8;
  if (!png && !jpg) throw new Error('فقط تصویر PNG یا JPG پذیرفته می‌شود.');
  const ps = ['3', '4', '6', '11'].includes(String(psm)) ? String(psm) : '6';
  const t = await locate();
  if (!t) throw new Error('موتور OCR (Tesseract) روی این سرور نصب نیست. ' + (process.platform === 'win32' ? 'فایل install-ocr.ps1 را (Run as Administrator) اجرا کنید.' : 'نسخهٔ Docker را با start.bat دوباره بسازید (docker compose up -d --build).'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtocr-')), inp = path.join(dir, png ? 'in.png' : 'in.jpg'), base = path.join(dir, 'out');
  const rel = await slot();
  try {
    fs.writeFileSync(inp, buf);
    const langs = hasLocal() ? (fs.existsSync(path.join(TD_LOCAL, 'eng.traineddata')) ? 'fas+eng' : 'fas') : 'fas+eng';
    const args = [inp, base, '-l', langs, '--psm', ps, '-c', 'preserve_interword_spaces=1', '-c', 'tessedit_create_tsv=1', '-c', 'tessedit_create_txt=1'];
    if (hasLocal()) args.push('--tessdata-dir', TD_LOCAL);
    try { await run(t.bin, args, { timeout: 180000, env: Object.assign({}, process.env, { OMP_THREAD_LIMIT: process.env.OMP_THREAD_LIMIT || '2' }) }); }
    catch (e) {
      if (e && e.killed) throw new Error('خواندن OCR بیش از ۳ دقیقه طول کشید و متوقف شد.');
      throw new Error('اجرای Tesseract ناموفق بود: ' + String(e.stderr || e.message || e).trim().split('\n').slice(0, 3).join(' | '));
    }
    const tsv = fs.existsSync(base + '.tsv') ? fs.readFileSync(base + '.tsv', 'utf8') : '';
    const text = (fs.existsSync(base + '.txt') ? fs.readFileSync(base + '.txt', 'utf8') : '').replace(BIDI, '').replace(/\f/g, '').replace(/\s+$/, '');
    return { words: parseTsv(tsv), text, version: t.version };
  } finally {
    rel();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }
}

module.exports = { status, recognize, parseTsv };
