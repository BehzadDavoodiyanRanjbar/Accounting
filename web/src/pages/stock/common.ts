import type { Row } from '../../kit/types';

/** نوع فروش/سند در ریز موجودی */
export const SALE_INS: Record<string, string> = { '1': 'فروش', '2': 'اصلاحی', '3': 'ابطالی', '4': 'برگشت از فروش' };

export const insName = (v: unknown): string => SALE_INS[String(v)] ?? String(v ?? '');

/** جمع ستون‌های عددی یک فهرست با گرد کردن */
export function sumCols(rows: Row[], keys: string[], digits = 6): Record<string, number> {
  const t: Record<string, number> = {};
  keys.forEach((k) => (t[k] = 0));
  rows.forEach((r) => keys.forEach((k) => (t[k] += Number(r[k]) || 0)));
  const m = Math.pow(10, digits);
  keys.forEach((k) => (t[k] = Math.round(t[k] * m) / m));
  return t;
}

/** نمایش یک مقدار برای جستجو: حروف عربی/فارسی یکسان و بدون فاصله‌ی اضافه */
export const nk = (s: unknown): string =>
  String(s ?? '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌\s]+/g, ' ')
    .trim()
    .toLowerCase();
