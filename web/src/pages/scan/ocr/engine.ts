/**
 * موتور OCR نرم‌افزار (بدون سرویس بیرونی و بدون هوش مصنوعی):
 *  - تصویر ← مرورگر آن را آماده می‌کند و به همین سرور می‌فرستد؛ Tesseract نصب‌شده روی سرور (فارسی+انگلیسی) متن را می‌خواند
 *  - PDF دارای متن ← خواندن مستقیم لایهٔ متنی؛ PDF اسکن‌شده ← تبدیل صفحه به تصویر (PDF.js در مرورگر) و OCR روی سرور
 * سند فقط به همین سرور خودتان می‌رود.
 */
import { callApi } from '../../../api/client';
import { BIDI } from './fields';
import type { OcrWord } from './layout';

export const OCR_BASE = '/v2/ocr/';
export const MAX_PAGES = 20;

export interface OcrPage {
  index: number;
  words: OcrWord[];
  text: string;
  /** نشانی تصویر صفحه برای پیش‌نمایش (blob) */
  imageUrl: string;
  origin: 'ocr' | 'pdf-text';
  /** ۰ تا ۱ */
  conf: number;
}
export type Progress = (p: number, msg: string) => void;

/* ---- نوع‌های حداقلی PDF.js (از /v2/ocr بارگذاری می‌شود، نه از bundle) ---- */
interface PdfPage {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }): { promise: Promise<void> };
  getTextContent(): Promise<{ items: Array<{ str?: string; transform?: number[]; width?: number; height?: number }> }>;
}
interface PdfLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(o: { data: Uint8Array }): { promise: Promise<{ numPages: number; getPage(n: number): Promise<PdfPage> }> };
}

let logger: Progress | null = null;
let pdfP: Promise<PdfLib> | null = null;

/** وجود فایل را با GET می‌سنجد (سرور برنامه به HEAD پاسخ نمی‌دهد) و بدنهٔ بزرگ را دانلود نمی‌کند */
async function exists(url: string): Promise<boolean> {
  const c = new AbortController();
  try {
    const r = await fetch(url, { signal: c.signal, cache: 'no-store' });
    const ct = r.headers.get('content-type') ?? '';
    c.abort();
    return r.ok && !ct.includes('text/html');
  } catch {
    return false;
  }
}

const NOT_INSTALLED =
  'خواندن PDF روی این سرور نصب نشده است. در پوشهٔ web یک‌بار «npm install» و سپس «npm run build» را اجرا کنید و خروجی را مطابق راهنما در app\\public\\v2 کپی کنید (فایل‌ها باید در آدرس /v2/ocr/ باشند).';

async function pdfLib(): Promise<PdfLib> {
  pdfP ??= (async () => {
    try {
      const m = (await import(/* @vite-ignore */ `${OCR_BASE}pdf.min.mjs`)) as unknown as PdfLib;
      m.GlobalWorkerOptions.workerSrc = `${OCR_BASE}pdf.worker.min.mjs`;
      return m;
    } catch {
      throw new Error(NOT_INSTALLED);
    }
  })();
  try {
    return await pdfP;
  } catch (e) {
    pdfP = null;
    throw e;
  }
}

const missingMsg = (f: string) => `${NOT_INSTALLED} (فایل پیدا نشد: ${OCR_BASE}${f})`;

interface OcrStatus { ok: boolean; error?: string; version?: string; detail?: string }

/** آیا OCR آماده است؟ (null = بله، وگرنه متن راهنمای فارسی) */
export async function ocrProblem(needPdf = false): Promise<string | null> {
  if (needPdf) for (const f of ['pdf.min.mjs', 'pdf.worker.min.mjs']) if (!(await exists(`${OCR_BASE}${f}`))) return missingMsg(f);
  let st: OcrStatus;
  try {
    st = await callApi<OcrStatus>('ocrStatus', {});
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return /unknown|نامعتبر|not found|ocrStatus/i.test(m) ? 'نسخهٔ سرور قدیمی است و OCR را ندارد. فایل app-server-and-index.zip را نصب کنید (Docker: با start.bat دوباره بسازید) و سرور را ری‌استارت کنید.' : `ارتباط با سرور برای OCR برقرار نشد: ${m}`;
  }
  if (st.ok) return null;
  if (st.error === 'lang') return 'داده‌ی زبان فارسی (fas.traineddata) برای Tesseract روی سرور پیدا نشد. پوشهٔ app\\tessdata را (همراه نصب‌کننده) کنار server.js قرار دهید.';
  return 'موتور OCR (Tesseract) روی این سرور نصب نیست. Docker: start.bat را اجرا کنید تا نسخه دوباره ساخته شود. ویندوز: فایل install-ocr.ps1 را با Run as Administrator اجرا کنید.';
}

/* ---- پیش‌پردازش تصویر: بزرگ‌نمایی، خاکستری و کشیدن کنتراست ---- */
function prep(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const scale = w < 1800 ? Math.min(3, 1800 / w) : w > 3200 ? 3200 / w : 1;
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const x = c.getContext('2d', { willReadFrequently: true });
  if (!x) throw new Error('پردازش تصویر در این مرورگر ممکن نیست.');
  x.fillStyle = '#fff';
  x.fillRect(0, 0, c.width, c.height);
  x.drawImage(src, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height);
  const px = d.data;
  let lo = 255;
  let hi = 0;
  for (let i = 0; i < px.length; i += 4) {
    const g = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
    px[i] = px[i + 1] = px[i + 2] = g;
    if (g < lo) lo = g;
    if (g > hi) hi = g;
  }
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < px.length; i += 4) {
    const g = Math.max(0, Math.min(255, ((px[i] - lo) * 255) / span));
    px[i] = px[i + 1] = px[i + 2] = g;
  }
  x.putImageData(d, 0, 0);
  return c;
}

const blobUrl = (c: HTMLCanvasElement): Promise<string> =>
  new Promise((ok) => c.toBlob((b) => ok(b ? URL.createObjectURL(b) : ''), 'image/png'));

const toBase64 = (b: Blob): Promise<string> =>
  new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] ?? '');
    r.onerror = () => no(new Error('خواندن تصویر ناموفق بود.'));
    r.readAsDataURL(b);
  });

interface ServerOcr { words: OcrWord[]; text: string }

/** تصویر آماده‌شده را به سرور می‌فرستد و کلمه‌ها (با مختصات و اطمینان) را می‌گیرد */
async function ocrCanvas(c: HTMLCanvasElement, psm: string): Promise<{ words: OcrWord[]; text: string }> {
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/png'));
  if (!blob) throw new Error('آماده‌سازی تصویر برای OCR ممکن نیست.');
  logger?.(0.3, 'ارسال به موتور OCR سرور…');
  const r = await callApi<ServerOcr>('ocrImage', { img: await toBase64(blob), psm });
  logger?.(1, 'پایان');
  const words = (r.words ?? []).map((w) => ({ ...w, text: String(w.text).replace(BIDI, '').trim() })).filter((w) => w.text);
  return { words, text: String(r.text ?? '').replace(BIDI, '') };
}

const isPdfFile = (f: File) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf';

/** psm: 6 = بلوک یکنواخت (جدول)، 4 = ستون متغیر (فیش) */
export async function recognizeFile(f: File, psm: '6' | '4', onProgress: Progress): Promise<OcrPage[]> {
  logger = onProgress;
  try {
    onProgress(0, 'آماده‌سازی موتور OCR…');
    if (!isPdfFile(f)) {
      const bmp = await createImageBitmap(f).catch(() => {
        throw new Error(`این فرمت تصویر خوانده نشد (${f.name}). آن را به JPG، PNG یا PDF تبدیل کنید.`);
      });
      const c = prep(bmp, bmp.width, bmp.height);
      const url = await blobUrl(c);
      const r = await ocrCanvas(c, psm);
      const conf = r.words.length ? r.words.reduce((s, w) => s + w.conf, 0) / r.words.length / 100 : 0;
      return [{ index: 0, words: r.words, text: r.text, imageUrl: url, origin: 'ocr', conf }];
    }
    const pdf = await pdfLib();
    const doc = await pdf.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
    const n = Math.min(doc.numPages, MAX_PAGES);
    const pages: OcrPage[] = [];
    for (let i = 1; i <= n; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent();
      const words: OcrWord[] = tc.items
        .filter((t) => (t.str ?? '').trim() && t.transform && t.width)
        .map((t) => {
          const tr = t.transform as number[];
          const h = t.height || Math.abs(tr[3]) || 10;
          const x0 = tr[4];
          const y0 = base.height - tr[5] - h;
          return { text: String(t.str), x0, y0, x1: x0 + (t.width as number), y1: y0 + h, conf: 100 };
        });
      const hasText = words.reduce((s, w) => s + w.text.replace(/\s/g, '').length, 0) >= 30;
      const vp = page.getViewport({ scale: hasText ? 1.4 : 2.6 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(vp.width);
      canvas.height = Math.round(vp.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('پردازش تصویر در این مرورگر ممکن نیست.');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const url = await blobUrl(canvas);
      if (hasText) {
        pages.push({ index: i - 1, words, text: lineText(words), imageUrl: url, origin: 'pdf-text', conf: 0.9 });
      } else {
        onProgress(0, `OCR صفحهٔ ${i} از ${n}…`);
        const r = await ocrCanvas(prep(canvas, canvas.width, canvas.height), psm);
        const conf = r.words.length ? r.words.reduce((s, w) => s + w.conf, 0) / r.words.length / 100 : 0;
        pages.push({ index: i - 1, words: r.words, text: r.text, imageUrl: url, origin: 'ocr', conf });
      }
    }
    return pages;
  } finally {
    logger = null;
  }
}

/** متن لایهٔ PDF با حفظ خط‌ها (برای الگوهای فیش) */
function lineText(words: OcrWord[]): string {
  const ws = [...words].sort((a, b) => a.y0 + a.y1 - (b.y0 + b.y1));
  const lines: OcrWord[][] = [];
  for (const w of ws) {
    const last = lines[lines.length - 1];
    const h = w.y1 - w.y0;
    if (last && Math.abs((w.y0 + w.y1) / 2 - (last[0].y0 + last[0].y1) / 2) <= 0.6 * h) last.push(w);
    else lines.push([w]);
  }
  return lines.map((l) => [...l].sort((a, b) => b.x1 - a.x1).map((w) => w.text).join(' ')).join('\n');
}
