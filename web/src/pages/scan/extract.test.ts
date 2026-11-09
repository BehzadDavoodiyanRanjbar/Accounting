import { describe, expect, it } from 'vitest';
import { guessMapping, parseCsv, paymentsFromGrid, payrollFromGrid } from './extract';

describe('نگاشت ستون‌ها', () => {
  const grid = [['فهرست حقوق آبان'], ['ردیف', 'نام و نام خانوادگی', 'کد ملی', 'ناخالص', 'بیمه سهم کارمند', 'مالیات', 'خالص پرداختنی'], ['1', 'علی رضایی', '۰۰۱۲۳۴۵۶۷۹', '۴۲٬۰۰۰٬۰۰۰', '۲٬۹۴۰٬۰۰۰', '۱٬۲۰۰٬۰۰۰', '۳۷٬۸۶۰٬۰۰۰'], ['', 'جمع', '', '42,000,000', '', '', '']];
  it('سرستون و ستون‌ها پیدا می‌شود', () => {
    const m = guessMapping(grid, 'payroll');
    expect(m.headerRow).toBe(1);
    expect(m.cols.name).toBe(1);
    expect(m.cols.gross).toBe(3);
    expect(m.cols.employeeInsurance).toBe(4);
    expect(m.cols.net).toBe(6);
    expect(m.confidence >= 0.85).toBe(true);
  });
  it('ردیف جمع نادیده گرفته می‌شود و مبالغ فارسی خوانده می‌شود', () => {
    const { doc } = payrollFromGrid(grid, guessMapping(grid, 'payroll'));
    expect(doc.rows).toHaveLength(1);
    expect(doc.rows[0].gross).toBe(42_000_000);
    expect(doc.rows[0].net).toBe(37_860_000);
    expect(doc.unit).toBe('unknown');
  });
  it('فایل بانک', () => {
    const g = [['نام دریافت‌کننده', 'شماره شبا', 'مبلغ', 'تاریخ', 'شناسه پیگیری'], ['علی رضایی', 'IR062960000000100324200001', '37,860,000', '1405/08/20', '123']];
    const { doc } = paymentsFromGrid(g, guessMapping(g, 'payment'));
    expect(doc.rows[0].amount).toBe(37_860_000);
    expect(doc.rows[0].trackingNo).toBe('123');
  });
  it('سرستون ناشناخته: اطمینان پایین', () => {
    expect(guessMapping([['الف', 'ب'], ['1', '2']], 'payroll').confidence < 0.6).toBe(true);
  });
});
describe('CSV', () => {
  it('CSV با نقطه‌ویرگول و گیومه', () => {
    expect(parseCsv('a;b\n"x;y";2\n')).toEqual([['a', 'b'], ['x;y', '2']]);
  });
});
