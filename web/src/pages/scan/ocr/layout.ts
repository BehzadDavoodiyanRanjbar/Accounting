/**
 * تبدیل خروجی OCR (کلمه‌ها با مختصات) یا لایهٔ متنی PDF به «جدول» (Grid) — توابع خالص و آزمون‌شده.
 * جدول بعد از این مرحله دقیقاً مثل فایل Excel بررسی و نگاشت می‌شود.
 * جهت جدول فارسی راست‌به‌چپ است؛ ستون اول = راست‌ترین ستون.
 */
export interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** ۰ تا ۱۰۰ */
  conf: number;
}
export type Grid = string[][];

const median = (a: number[]): number => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

/** اگر بیشتر حرف‌ها عربی/فارسی باشند ← راست‌به‌چپ */
export function isRtl(words: OcrWord[]): boolean {
  let ar = 0;
  let la = 0;
  for (const w of words) {
    for (const ch of w.text) {
      if (/[؀-ۿ]/.test(ch) && !/[۰-۹٠-٩]/.test(ch)) ar++;
      else if (/[A-Za-z]/.test(ch)) la++;
    }
  }
  return ar >= la;
}

interface Cell {
  text: string;
  cx: number;
}

/** کلمه‌ها ← ردیف‌ها ← سلول‌ها ← ستون‌ها */
export function wordsToGrid(input: OcrWord[], rtlOpt?: boolean): { grid: Grid; conf: number } {
  const words = input.filter((w) => w.text.trim() && w.x1 > w.x0 && w.y1 > w.y0).map((w) => ({ ...w, text: w.text.trim() }));
  if (!words.length) return { grid: [], conf: 0 };
  const rtl = rtlOpt ?? isRtl(words);
  const mh = median(words.map((w) => w.y1 - w.y0)) || 10;

  /* ۱) ردیف‌ها: کلمه‌هایی که مرکز عمودی نزدیک دارند */
  const sorted = [...words].sort((a, b) => a.y0 + a.y1 - (b.y0 + b.y1));
  const lines: Array<{ cy: number; ws: OcrWord[] }> = [];
  for (const w of sorted) {
    const cy = (w.y0 + w.y1) / 2;
    const last = lines[lines.length - 1];
    if (last && Math.abs(cy - last.cy) <= 0.6 * mh) {
      last.ws.push(w);
      last.cy = last.ws.reduce((s, x) => s + (x.y0 + x.y1) / 2, 0) / last.ws.length;
    } else lines.push({ cy, ws: [w] });
  }

  /* ۲) سلول‌ها: فاصلهٔ افقی بزرگ = سلول جدید */
  const cellsByLine: Cell[][] = lines.map((ln) => {
    const ws = [...ln.ws].sort((a, b) => (rtl ? b.x1 - a.x1 : a.x0 - b.x0));
    const cells: Array<{ ws: OcrWord[] }> = [];
    for (const w of ws) {
      const cur = cells[cells.length - 1];
      if (cur) {
        const p = cur.ws[cur.ws.length - 1];
        const gap = rtl ? p.x0 - w.x1 : w.x0 - p.x1;
        if (gap <= 1.6 * mh) {
          cur.ws.push(w);
          continue;
        }
      }
      cells.push({ ws: [w] });
    }
    return cells.map((c) => ({ text: c.ws.map((w) => w.text).join(' '), cx: (Math.min(...c.ws.map((w) => w.x0)) + Math.max(...c.ws.map((w) => w.x1))) / 2 }));
  });

  /* ۳) ستون‌ها: خوشه‌بندی مرکز سلول‌ها در همهٔ ردیف‌ها */
  const all = cellsByLine.flat().map((c) => c.cx).sort((a, b) => a - b);
  const span = all[all.length - 1] - all[0];
  const T = Math.max(2 * mh, span * 0.03);
  const clusters: number[][] = [];
  for (const x of all) {
    const c = clusters[clusters.length - 1];
    if (c && x - c[c.length - 1] <= T) c.push(x);
    else clusters.push([x]);
  }
  const need = Math.max(2, Math.ceil(lines.length * 0.2));
  let kept = clusters.filter((c) => c.length >= need);
  if (!kept.length) kept = clusters;
  const centers = kept.map((c) => c.reduce((s, x) => s + x, 0) / c.length).sort((a, b) => (rtl ? b - a : a - b));
  const nearest = (cx: number) => centers.reduce((b, c, i) => (Math.abs(c - cx) < Math.abs(centers[b] - cx) ? i : b), 0);

  const grid: Grid = cellsByLine.map((cells) => {
    const row: string[] = centers.map(() => '');
    for (const c of cells) {
      const i = nearest(c.cx);
      row[i] = row[i] ? `${row[i]} ${c.text}` : c.text;
    }
    return row;
  });
  const conf = words.reduce((s, w) => s + w.conf, 0) / words.length / 100;
  return { grid: grid.filter((r) => r.some((c) => c.trim())), conf: Math.max(0, Math.min(1, conf)) };
}

/** وقتی مختصات نداریم: هر خط متن، یک ردیف؛ سلول‌ها با دو فاصله یا Tab جدا می‌شوند */
export function textToGrid(text: string): Grid {
  return text
    .split(/\r?\n/)
    .map((l) => l.split(/\t|\s{2,}/).map((c) => c.trim()))
    .filter((r) => r.some(Boolean));
}
