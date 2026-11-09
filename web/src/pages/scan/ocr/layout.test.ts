import { describe, expect, it } from 'vitest';
import { isRtl, textToGrid, wordsToGrid } from './layout';
import type { OcrWord } from './layout';
import { insuranceFromText } from './fields';

/** ساخت کلمه در مختصات صفحه (عرض ۱۰۰۰). ردیف r، مرکز افقی cx */
const w = (text: string, r: number, cx: number, wd = 60): OcrWord => ({ text, x0: cx - wd / 2, x1: cx + wd / 2, y0: 100 + r * 40, y1: 125 + r * 40, conf: 90 });

describe('کلمه‌ها ← جدول (راست‌به‌چپ)', () => {
  // ستون‌ها (از راست): نام در x=900، ناخالص x=600، خالص x=300
  const words = [
    w('نام', 0, 900), w('ناخالص', 0, 600), w('خالص', 0, 300),
    w('علی', 1, 920, 40), w('رضایی', 1, 860, 50), w('42,000,000', 1, 600, 120), w('37,860,000', 1, 300, 120),
    w('بهزاد', 2, 910, 50), w('کریمی', 2, 850, 50), w('30,000,000', 2, 600, 120), w('27,900,000', 2, 300, 120),
  ];
  it('ستون اول = راست‌ترین ستون و نام دوکلمه‌ای در یک سلول می‌ماند', () => {
    expect(isRtl(words)).toBe(true);
    const { grid, conf } = wordsToGrid(words);
    expect(grid).toEqual([
      ['نام', 'ناخالص', 'خالص'],
      ['علی رضایی', '42,000,000', '37,860,000'],
      ['بهزاد کریمی', '30,000,000', '27,900,000'],
    ]);
    expect(conf).toBe(0.9);
  });
  it('سلول خالی در ستون وسط حفظ می‌شود', () => {
    const g = wordsToGrid([...words.filter((x) => !(x.text === '30,000,000'))]).grid;
    expect(g[2]).toEqual(['بهزاد کریمی', '', '27,900,000']);
  });
  it('ورودی خالی', () => {
    expect(wordsToGrid([]).grid).toEqual([]);
    expect(textToGrid('الف   ۱۰۰\n\nب\t۲۰۰')).toEqual([['الف', '۱۰۰'], ['ب', '۲۰۰']]);
  });
});

describe('فیش بیمه از متن', () => {
  const t = `سازمان تأمین اجتماعی
نام کارگاه: شرکت نمونه
شماره لیست: ۱۲
دوره: آبان ۱۴۰۵
مبلغ واریزی: ۲۲٬۰۳۲٬۰۰۰ ریال
جریمه دیرکرد: ۴۳۲٬۰۰۰
شماره پیگیری: ۷۰۰۱۲۳۴
تاریخ پرداخت: ۱۴۰۵/۰۸/۲۵`;
  it('فیلدها پیدا می‌شود و اطمینان برای تأیید انسان پایین می‌ماند', () => {
    const { doc, found } = insuranceFromText(t);
    expect(doc.amount).toBe(22_032_000);
    expect(doc.penalty).toBe(432_000);
    expect(doc.trackingNo).toBe('7001234');
    expect(doc.listNo).toBe('12');
    expect(doc.date).toBe('1405/08/25');
    expect(doc.periodMonth).toBe('1405/08');
    expect(doc.unit).toBe('rial');
    expect(found.amount && found.trackingNo).toBe(true);
    expect(doc.conf < 0.85).toBe(true);
  });
  it('متن بی‌ربط: اطمینان خیلی پایین و واحد نامشخص', () => {
    const { doc, found } = insuranceFromText('سلام دنیا');
    expect(found.amount).toBe(false);
    expect(doc.conf).toBe(0.3);
    expect(doc.unit).toBe('unknown');
  });
});
