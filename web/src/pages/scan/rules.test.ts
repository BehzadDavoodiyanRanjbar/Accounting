import { describe, expect, it } from 'vitest';
import { DEFAULT_RATES, buildInsuranceVoucher, buildPaymentsVoucher, buildPayrollVoucher, canCreate, employerShare, insuranceIssues, matchPayRows, payrollIssues, payrollPayables, paymentsIssues, rowDiff } from './rules';
import type { AccRole, Draft, InsuranceDoc, Payable, PayRow, PayrollDoc, PayrollRow, PaymentsDoc } from './rules';

const M = 1_000_000;
const pr = (id: number, name: string, gross: number, ins: number, tax: number, net: number): PayrollRow => ({ id, name, nationalCode: '', gross, grossInsurable: null, employeeInsurance: ins, incomeTax: tax, otherDeductions: 0, net, conf: 1, confirmed: true, personKey: '' });
const payroll = (over: Partial<PayrollDoc> = {}): PayrollDoc => ({
  period: '1405/08',
  companyName: 'شرکت نمونه',
  unit: 'rial',
  rows: [pr(1, 'علی رضایی', 42 * M, 2.94 * M, 1.2 * M, 37.86 * M), pr(2, 'بهزاد کریمی', 30 * M, 2.1 * M, 0, 27.9 * M)],
  printedTotals: null,
  printedEmployerShare: null,
  ...over,
});
const byRole = (d: Draft) => {
  const o: Partial<Record<AccRole, { d: number; c: number }>> = {};
  d.lines.forEach((l) => {
    const x = (o[l.role] ??= { d: 0, c: 0 });
    x.d += l.debit;
    x.c += l.credit;
  });
  return o;
};

describe('آزمون ۲: شناسایی هزینهٔ حقوق', () => {
  const doc = payroll();
  const d = buildPayrollVoucher(doc, DEFAULT_RATES);
  const r = byRole(d);
  it('سهم کارفرما = ۲۰٪ + ۳٪ از ۷۲٬۰۰۰٬۰۰۰ = ۱۶٬۵۶۰٬۰۰۰', () => {
    expect(employerShare(doc, DEFAULT_RATES).value).toBe(16_560_000);
  });
  it('سند: بدهکار و بستانکار هرکدام ۸۸٬۵۶۰٬۰۰۰', () => {
    expect(r.wageExp?.d).toBe(72_000_000);
    expect(r.erExp?.d).toBe(16_560_000);
    expect(r.wagePay?.c).toBe(65_760_000);
    expect(r.insPay?.c).toBe(21_600_000);
    expect(r.taxPay?.c).toBe(1_200_000);
    expect(d.totalDebit).toBe(88_560_000);
    expect(d.totalCredit).toBe(88_560_000);
    expect(d.balanced).toBe(true);
  });
  it('بدون ایراد مسدودکننده', () => {
    expect(canCreate(d, payrollIssues(doc, DEFAULT_RATES))).toBe(true);
  });
  it('ردیف ناهماهنگ: خطای اختلاف با مقدار دقیق', () => {
    const bad = payroll({ rows: [pr(1, 'الف', 42 * M, 2.94 * M, 1.2 * M, 38 * M)] });
    expect(rowDiff(bad.rows[0])).toBe(-140_000);
    const is = payrollIssues(bad, DEFAULT_RATES).find((i) => i.code === 'diff');
    expect(is?.severity).toBe('block');
    expect(is?.amount).toBe(-140_000);
    expect(canCreate(buildPayrollVoucher(bad, DEFAULT_RATES), payrollIssues(bad, DEFAULT_RATES))).toBe(false);
  });
  it('جمع چاپ‌شده ناهماهنگ', () => {
    const bad = payroll({ printedTotals: { gross: 73 * M, employeeInsurance: 5.04 * M, incomeTax: 1.2 * M, otherDeductions: 0, net: 65.76 * M } });
    expect(payrollIssues(bad, DEFAULT_RATES).some((i) => i.code === 'total' && i.amount === -1_000_000)).toBe(true);
  });
  it('واحد نامشخص: ساخت سند مسدود', () => {
    const u = payroll({ unit: 'unknown' });
    expect(payrollIssues(u, DEFAULT_RATES).some((i) => i.code === 'unit' && i.severity === 'block')).toBe(true);
    expect(buildPayrollVoucher(u, DEFAULT_RATES).lines).toHaveLength(0);
  });
  it('تومان صریح ×۱۰ می‌شود', () => {
    const t = payroll({ unit: 'toman' });
    expect(buildPayrollVoucher(t, DEFAULT_RATES).totalDebit).toBe(885_600_000);
  });
  it('سهم کارفرمای چاپ‌شده در سند مقدم است', () => {
    const p = payroll({ printedEmployerShare: 16_000_000 });
    expect(employerShare(p, DEFAULT_RATES).value).toBe(16_000_000);
    expect(payrollIssues(p, DEFAULT_RATES).some((i) => i.code === 'diff' && i.severity === 'warn')).toBe(true);
  });
  it('ردیف با اطمینان پایین تا تأیید انسان مسدود است', () => {
    const p = payroll();
    p.rows[0] = { ...p.rows[0], conf: 0.5, confirmed: false };
    expect(payrollIssues(p, DEFAULT_RATES).some((i) => i.code === 'conf' && i.severity === 'block')).toBe(true);
  });
  it('بدهی ایجادشده برای مراحل بعد', () => {
    const pp = payrollPayables(doc, DEFAULT_RATES);
    expect(pp.insurance).toBe(21_600_000);
    expect(pp.employees.map((e) => e.net)).toEqual([37_860_000, 27_900_000]);
  });
});

describe('آزمون ۳: پرداخت به کارکنان', () => {
  const people = [
    { key: 'A', name: 'علی رضایی' },
    { key: 'B', name: 'بهزاد کریمی' },
  ];
  const payables: Payable[] = [
    { key: 'A', name: 'علی رضایی', nationalCode: '', open: 37_860_000 },
    { key: 'B', name: 'بهزاد کریمی', nationalCode: '', open: 27_900_000 },
  ];
  const row = (id: number, name: string, amount: number): PayRow => ({ id, payeeName: name, iban: '', accountNo: '', amount, date: '1405/08/16', description: '', trackingNo: `T${id}`, conf: 1, confirmed: true, personKey: '', how: null, matchConfirmed: false });
  const doc = (rows: PayRow[]): PaymentsDoc => ({ bankName: 'ملی', sourceAccount: '', unit: 'rial', rows: matchPayRows(rows, people), printedTotal: null });

  it('پرداخت کامل: بدهکار حقوق پرداختنی / بستانکار بانک ۶۵٬۷۶۰٬۰۰۰', () => {
    const d = doc([row(1, 'علي رضايي', 37_860_000), row(2, 'بهزاد کریمی', 27_900_000)]);
    const res = buildPaymentsVoucher(d, payables);
    const r = byRole(res.draft);
    expect(r.wagePay?.d).toBe(65_760_000);
    expect(r.bank?.c).toBe(65_760_000);
    expect(r.advance).toBeUndefined();
    expect(res.draft.balanced).toBe(true);
  });
  it('پرداخت اضافه: مساعده ۱۰۰٬۰۰۰ و بانک ۶۵٬۸۶۰٬۰۰۰ و پرچم «پرداخت اضافه»', () => {
    const d = doc([row(1, 'علی رضایی', 37_860_000), row(2, 'بهزاد کریمی', 28_000_000)]);
    const res = buildPaymentsVoucher(d, payables);
    const r = byRole(res.draft);
    expect(r.wagePay?.d).toBe(65_760_000);
    expect(r.advance?.d).toBe(100_000);
    expect(r.bank?.c).toBe(65_860_000);
    expect(res.items.find((i) => i.overpaid)?.excess).toBe(100_000);
    expect(paymentsIssues(d, res).some((i) => i.code === 'diff' && i.message.includes('پرداخت اضافه'))).toBe(true);
    expect(res.draft.balanced).toBe(true);
  });
  it('نام ناشناس: نیازمند تطبیق دستی و خارج از سند', () => {
    const d = doc([row(1, 'علی رضایی', 37_860_000), row(2, 'ناشناس کاملاً متفاوت', 5_000_000)]);
    const res = buildPaymentsVoucher(d, payables);
    expect(res.unmatched).toEqual([2]);
    expect(byRole(res.draft).bank?.c).toBe(37_860_000);
  });
  it('تطبیق تقریبی تا تأیید انسان در سند نیست و ایجاد را مسدود می‌کند', () => {
    const fuzzy: PayRow = { ...row(1, 'علی رضائی', 37_860_000), how: 'fuzzy', personKey: 'A', matchConfirmed: false };
    const d: PaymentsDoc = { bankName: '', sourceAccount: '', unit: 'rial', rows: [fuzzy], printedTotal: null };
    const res = buildPaymentsVoucher(d, payables);
    expect(res.items).toHaveLength(0);
    expect(paymentsIssues(d, res).some((i) => i.code === 'match' && i.severity === 'block')).toBe(true);
  });
  it('دو ردیف برای یک کارمند: بدهی باز بین ردیف‌ها کم می‌شود', () => {
    const d = doc([row(1, 'بهزاد کریمی', 20_000_000), row(2, 'بهزاد کریمی', 10_000_000)]);
    const res = buildPaymentsVoucher(d, payables);
    expect(byRole(res.draft).wagePay?.d).toBe(27_900_000);
    expect(byRole(res.draft).advance?.d).toBe(2_100_000);
  });
  it('جمع چاپ‌شدهٔ بانک با جمع ردیف‌ها نمی‌خواند', () => {
    const d = { ...doc([row(1, 'علی رضایی', 37_860_000)]), printedTotal: 40_000_000 };
    expect(paymentsIssues(d, buildPaymentsVoucher(d, payables)).some((i) => i.code === 'total')).toBe(true);
  });
});

describe('آزمون ۴: پرداخت حق بیمه', () => {
  const ins = (amount: number, penalty: number, over: Partial<InsuranceDoc> = {}): InsuranceDoc => ({ payerName: '', amount, penalty, date: '1405/08/16', trackingNo: 'R1', listNo: '', periodMonth: '1405/08', unit: 'rial', conf: 1, confirmed: true, diffMode: 'payable', ...over });
  it('بدون جریمه', () => {
    const res = buildInsuranceVoucher(ins(21_600_000, 0), 21_600_000);
    const r = byRole(res.draft);
    expect(r.insPay?.d).toBe(21_600_000);
    expect(r.bank?.c).toBe(21_600_000);
    expect(r.penalty).toBeUndefined();
    expect(res.diff).toBe(0);
    expect(res.draft.balanced).toBe(true);
  });
  it('با جریمه: ۲۲٬۰۳۲٬۰۰۰ = ۲۱٬۶۰۰٬۰۰۰ + ۴۳۲٬۰۰۰', () => {
    const res = buildInsuranceVoucher(ins(22_032_000, 432_000), 21_600_000);
    const r = byRole(res.draft);
    expect(r.insPay?.d).toBe(21_600_000);
    expect(r.penalty?.d).toBe(432_000);
    expect(r.bank?.c).toBe(22_032_000);
    expect(res.draft.balanced).toBe(true);
    expect(insuranceIssues(ins(22_032_000, 432_000), res).filter((i) => i.severity === 'block')).toHaveLength(0);
  });
  it('اختلاف با بدهی باز: گزارش و انتخاب نحوهٔ ثبت', () => {
    const a = buildInsuranceVoucher(ins(21_700_000, 0), 21_600_000);
    expect(a.diff).toBe(100_000);
    expect(byRole(a.draft).insPay?.d).toBe(21_700_000);
    const b = buildInsuranceVoucher(ins(21_700_000, 0, { diffMode: 'penalty' }), 21_600_000);
    expect(byRole(b.draft).insPay?.d).toBe(21_600_000);
    expect(byRole(b.draft).penalty?.d).toBe(100_000);
    expect(b.draft.balanced).toBe(true);
  });
  it('واحد نامشخص مسدود می‌کند', () => {
    const d = ins(21_600_000, 0, { unit: 'unknown' });
    expect(insuranceIssues(d, buildInsuranceVoucher(d, null)).some((i) => i.code === 'unit')).toBe(true);
  });
});
