import { describe, expect, it } from 'vitest';
import { docFromPages, mergeGrids, periodFromText } from './pipeline';
import type { OcrWord } from './layout';

/** جدول فرضی راست‌به‌چپ با مختصات: ستون‌ها از راست: نام، ناخالص، بیمه، خالص */
const cols = [700, 520, 340, 160];
const mk = (rows: string[][], y0 = 20): OcrWord[] =>
  rows.flatMap((r, ri) => r.map((t, ci) => ({ text: t, x0: cols[ci] - 60, x1: cols[ci] + 60, y0: y0 + ri * 40, y1: y0 + ri * 40 + 22, conf: 88 })));

describe('OCR ← سند', () => {
  const page1 = mk([['نام', 'ناخالص', 'بیمه سهم کارمند', 'خالص پرداختنی'], ['علی', '42,000,000', '2,940,000', '39,060,000'], ['بهزاد', '30,000,000', '2,100,000', '27,900,000']]);
  it('جدول حقوق خوانده و اطمینان ردیف‌ها زیر ۰٫۸۵ می‌ماند', () => {
    const r = docFromPages('payroll', [{ words: page1, text: 'لیست حقوق آبان ۱۴۰۵', origin: 'ocr', conf: 0.88 }]);
    expect(r.payroll?.rows).toHaveLength(2);
    expect(r.payroll?.rows[0].gross).toBe(42_000_000);
    expect(r.payroll?.rows[0].net).toBe(39_060_000);
    expect(r.payroll?.rows.every((x) => x.conf < 0.85)).toBe(true);
    expect(r.payroll?.period).toBe('1405/08');
  });
  it('سرستون تکراری صفحهٔ دوم حذف می‌شود', () => {
    const p2 = mk([['نام', 'ناخالص', 'بیمه سهم کارمند', 'خالص پرداختنی'], ['سارا', '10,000,000', '700,000', '9,300,000']]);
    const r = docFromPages('payroll', [{ words: page1, text: '', origin: 'ocr', conf: 0.9 }, { words: p2, text: '', origin: 'ocr', conf: 0.9 }]);
    expect(r.payroll?.rows.map((x) => x.name)).toEqual(['علی', 'بهزاد', 'سارا']);
  });
  it('لایهٔ متنی PDF: سقف اطمینان ۰٫۹ و بالاتر از OCR', () => {
    const r = docFromPages('payroll', [{ words: page1, text: 'x', origin: 'pdf-text', conf: 0.9 }]);
    const c = r.payroll?.rows[0].conf ?? 0;
    const o = docFromPages('payroll', [{ words: page1, text: 'x', origin: 'ocr', conf: 0.9 }]).payroll?.rows[0].conf ?? 0;
    expect(c <= 0.9 && c >= o).toBe(true);
  });
  it('متن خالی ← هشدار', () => {
    const r = docFromPages('payment', [{ words: [], text: '', origin: 'ocr', conf: 0 }]);
    expect(r.warnings.length).toBe(1);
    expect(r.payments).toBeUndefined();
  });
  it('فیش بیمه از متن', () => {
    const r = docFromPages('insurance', [{ words: [], text: 'مبلغ پرداختی: 22,032,000 ریال\nشماره پیگیری: 700123\nجریمه دیرکرد 432,000', origin: 'ocr', conf: 0.8 }]);
    expect(r.insurance?.amount).toBe(22_032_000);
    expect(r.insurance?.trackingNo).toBe('700123');
    expect((r.insurance?.conf ?? 1) < 0.85).toBe(true);
  });
  it('دوره از متن', () => {
    expect(periodFromText('حقوق ماه آذر 1405')).toBe('1405/09');
    expect(mergeGrids([[['a']]], 'payroll')).toEqual([['a']]);
  });
});
