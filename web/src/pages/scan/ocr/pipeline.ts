/**
 * خروجی OCR (صفحه‌ها) ← سند قابل‌بررسی. توابع خالص (بدون DOM) و آزمون‌شده.
 * جدول حقوق/پرداخت از همان مسیر Excel (نگاشت ستون + بررسی ردیف‌به‌ردیف) می‌گذرد؛
 * فیش بیمه با الگوهای کلیدواژه‌ای. هیچ مقداری بدون بازبینی انسان نهایی نمی‌شود.
 */
import { guessMapping, paymentsFromGrid, payrollFromGrid } from '../extract';
import type { DocKind, Grid, Mapping } from '../extract';
import { parsePeriod } from '../normalize';
import type { InsuranceDoc, PaymentsDoc, PayrollDoc } from '../rules';
import { insuranceFromText } from './fields';
import { wordsToGrid } from './layout';
import type { OcrWord } from './layout';

export interface PageIn {
  words: OcrWord[];
  text: string;
  origin: 'ocr' | 'pdf-text';
  /** ۰ تا ۱ */
  conf: number;
}
export interface OcrResult {
  grid: Grid;
  mapping?: Mapping;
  payroll?: PayrollDoc;
  payments?: PaymentsDoc;
  insurance?: InsuranceDoc;
  src: Record<number, string>;
  /** متن خام خوانده‌شده (برای نمایش به کاربر) */
  text: string;
  /** میانگین اطمینان خواندن ۰..۱ */
  conf: number;
  warnings: string[];
}

const MONTHS = 'فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند';
const cleanCell = (s: string) => s.replace(/\s+/g, ' ').trim();

/** جدول چندصفحه‌ای: سرستونِ تکراری صفحه‌های بعد حذف می‌شود */
export function mergeGrids(grids: Grid[], kind: 'payroll' | 'payment'): Grid {
  const out: Grid = [];
  let header: string[] | null = null;
  grids.forEach((g, gi) => {
    if (gi === 0) {
      out.push(...g);
      const m = guessMapping(g, kind);
      header = (g[m.headerRow] ?? []).map(cleanCell);
      return;
    }
    for (const r of g) {
      const same = header && header.filter((h, i) => h && cleanCell(r[i] ?? '') === h).length >= Math.max(2, Math.ceil(header.filter(Boolean).length / 2));
      if (!same) out.push(r);
    }
  });
  return out;
}

/** دورهٔ مالی از متن (مثل «آبان ۱۴۰۵» یا «۱۴۰۵/۰۸») */
export function periodFromText(text: string): string {
  const t = text.replace(/ي/g, 'ی').replace(/ك/g, 'ک');
  const a = t.match(new RegExp(`(${MONTHS})\\s*(?:ماه)?\\s*([۰-۹0-9]{4})`));
  if (a) return parsePeriod(`${a[1]} ${a[2]}`) ?? '';
  const b = t.match(/([۰-۹0-9]{4})\s*[/\-]\s*([۰-۹0-9]{1,2})(?![۰-۹0-9/])/);
  return b ? (parsePeriod(`${b[1]}/${b[2]}`) ?? '') : '';
}

export function docFromPages(kind: DocKind, pages: PageIn[]): OcrResult {
  const text = pages.map((p) => p.text).join('\n');
  const conf = pages.length ? pages.reduce((s, p) => s + p.conf, 0) / pages.length : 0;
  const allPdfText = pages.length > 0 && pages.every((p) => p.origin === 'pdf-text');
  const cap = allPdfText ? 0.9 : Math.min(0.8, conf);
  const warnings: string[] = [];
  if (!text.trim()) warnings.push('هیچ متنی از فایل خوانده نشد. کیفیت اسکن را بالا ببرید (حداقل ۳۰۰ dpi، بدون سایه و کج‌شدگی) یا «ورود دستی» را بزنید.');
  else if (conf < 0.6) warnings.push('کیفیت خواندن پایین است؛ همهٔ مقادیر را با تصویر مقایسه کنید.');

  if (kind === 'insurance') {
    const r = insuranceFromText(text);
    const insurance: InsuranceDoc = { ...r.doc, conf: Math.min(r.doc.conf, cap), confirmed: false };
    if (!r.found.amount) warnings.push('مبلغ در متن پیدا نشد؛ آن را دستی وارد کنید.');
    return { grid: [], insurance, src: {}, text, conf, warnings };
  }

  const k: 'payroll' | 'payment' = kind;
  const grid = mergeGrids(pages.map((p) => wordsToGrid(p.words).grid), k);
  if (!grid.length) return { grid, src: {}, text, conf, warnings };
  const mapping = guessMapping(grid, k);
  if (mapping.confidence < 0.6) warnings.push('سرستون‌های جدول با اطمینان تشخیص داده نشد؛ ستون‌ها را در بخش «نگاشت ستون‌ها» اصلاح کنید.');
  if (k === 'payroll') {
    const r = payrollFromGrid(grid, mapping);
    r.doc.period = periodFromText(text);
    r.doc.rows = r.doc.rows.map((x) => ({ ...x, conf: Math.min(x.conf, cap) }));
    return { grid, mapping, payroll: r.doc, src: r.src, text, conf, warnings };
  }
  const r = paymentsFromGrid(grid, mapping);
  r.doc.rows = r.doc.rows.map((x) => ({ ...x, conf: Math.min(x.conf, cap) }));
  return { grid, mapping, payments: r.doc, src: r.src, text, conf, warnings };
}
