/**
 * استخراج داده از فایل‌ها (سمت مرورگر، بدون هوش مصنوعی): Excel/CSV مستقیم، تصویر/PDF با OCR داخلی (پوشهٔ ocr)،
 * و داده‌ی نمونه برای آزمایش. خروجی همه‌جا یکی است: سند قابل‌ویرایش برای بررسی انسان.
 * هر متن استخراج‌شده «داده نامعتبر» است: فقط به‌صورت متن ساده نمایش داده می‌شود.
 */
import { callApi } from '../../api/client';
import { normName, parseAmount } from './normalize';
import type { InsuranceDoc, PayRow, PaymentsDoc, PayrollDoc, PayrollRow } from './rules';

export type DocKind = 'payroll' | 'payment' | 'insurance';
export const KIND_TITLE: Record<DocKind, string> = { payroll: 'شناسایی هزینهٔ حقوق', payment: 'پرداخت به کارکنان', insurance: 'پرداخت حق بیمه' };

export type Grid = string[][];

/* ---------- نگاشت ستون‌ها ---------- */
export type FieldKey = 'name' | 'nationalCode' | 'gross' | 'base' | 'benefits' | 'overtime' | 'grossInsurable' | 'employeeInsurance' | 'incomeTax' | 'otherDeductions' | 'net' | 'iban' | 'accountNo' | 'amount' | 'date' | 'description' | 'trackingNo';

export const FIELD_LABEL: Record<FieldKey, string> = {
  name: 'نام', nationalCode: 'کد ملی', gross: 'ناخالص (جمع حقوق و مزایا)', base: 'حقوق پایه', benefits: 'مزایا', overtime: 'اضافه‌کار', grossInsurable: 'مشمول بیمه',
  employeeInsurance: 'بیمه سهم کارمند', incomeTax: 'مالیات', otherDeductions: 'سایر کسور', net: 'خالص پرداختنی', iban: 'شبا', accountNo: 'شماره حساب', amount: 'مبلغ', date: 'تاریخ', description: 'شرح', trackingNo: 'شناسه پیگیری',
};
export const KIND_FIELDS: Record<'payroll' | 'payment', FieldKey[]> = {
  payroll: ['name', 'nationalCode', 'base', 'benefits', 'overtime', 'gross', 'grossInsurable', 'employeeInsurance', 'incomeTax', 'otherDeductions', 'net'],
  payment: ['name', 'iban', 'accountNo', 'amount', 'date', 'description', 'trackingNo'],
};

/** مترادف‌های سرستون (پس از نرمال‌سازی). ترتیب مهم است: عبارت‌های دقیق‌تر اول */
const SYN: Array<[FieldKey, string[]]> = [
  ['nationalCode', ['کد ملی', 'کدملی', 'شماره ملی', 'ش ملی']],
  ['iban', ['شماره شبا', 'شبا', 'iban', 'sheba']],
  ['accountNo', ['شماره حساب', 'حساب مقصد', 'شماره سپرده']],
  ['trackingNo', ['شناسه پیگیری', 'شماره پیگیری', 'کد پیگیری', 'پیگیری', 'شماره مرجع', 'مرجع']],
  ['grossInsurable', ['مشمول بیمه', 'حقوق مشمول', 'مشمول']],
  ['employeeInsurance', ['بیمه سهم کارمند', 'سهم بیمه کارمند', 'بیمه کارمند', 'حق بیمه کارمند', 'بیمه سهم کارگر', 'بیمه']],
  ['incomeTax', ['مالیات حقوق', 'مالیات']],
  ['otherDeductions', ['سایر کسور', 'کسورات', 'مساعده', 'وام', 'کسر']],
  ['net', ['خالص پرداختنی', 'خالص دریافتی', 'خالص پرداخت', 'قابل پرداخت', 'خالص']],
  ['gross', ['جمع ناخالص', 'ناخالص', 'جمع حقوق و مزایا', 'جمع مزایا', 'جمع کل حقوق']],
  ['base', ['حقوق پایه', 'حقوق ماهانه', 'دستمزد پایه', 'حقوق']],
  ['benefits', ['مزایا', 'مزایای']],
  ['overtime', ['اضافه کار', 'اضافه‌کار', 'اضافهکار']],
  ['amount', ['مبلغ', 'مبلغ واریز', 'مبلغ تراکنش', 'مبلغ (ریال)', 'مبلغ (تومان)']],
  ['date', ['تاریخ واریز', 'تاریخ تراکنش', 'تاریخ']],
  ['description', ['شرح', 'توضیحات', 'بابت']],
  ['name', ['نام و نام خانوادگی', 'نام صاحب حساب', 'نام دریافت کننده', 'نام دریافت‌کننده', 'نام کارمند', 'نام']],
];
const clean = (s: string) => normName(s).toLowerCase().replace(/[()‌:]/g, ' ').replace(/\s+/g, ' ').trim();

export interface Mapping {
  headerRow: number;
  cols: Partial<Record<FieldKey, number>>;
  /** ۰..۱؛ زیر ۰٫۶ یعنی کاربر باید نگاشت را اصلاح کند */
  confidence: number;
}

function scoreRow(row: string[], fields: FieldKey[]): Partial<Record<FieldKey, number>> {
  const cols: Partial<Record<FieldKey, number>> = {};
  const taken = new Set<number>();
  for (const [f, syns] of SYN) {
    if (!fields.includes(f)) continue;
    // ابتدا تطبیق دقیق، سپس شامل‌بودن
    let hit = -1;
    for (const exact of [true, false]) {
      for (let i = 0; i < row.length && hit < 0; i++) {
        if (taken.has(i)) continue;
        const c = clean(row[i] ?? '');
        if (!c) continue;
        if (syns.some((s) => (exact ? c === clean(s) : c.includes(clean(s))))) hit = i;
      }
      if (hit >= 0) break;
    }
    if (hit >= 0) {
      cols[f] = hit;
      taken.add(hit);
    }
  }
  return cols;
}

/** ردیف سرستون را پیدا و ستون‌ها را نگاشت می‌کند */
export function guessMapping(grid: Grid, kind: 'payroll' | 'payment'): Mapping {
  const fields = KIND_FIELDS[kind];
  let best: Mapping = { headerRow: 0, cols: {}, confidence: 0 };
  for (let r = 0; r < Math.min(grid.length, 12); r++) {
    const cols = scoreRow(grid[r] ?? [], fields);
    const n = Object.keys(cols).length;
    if (n > Object.keys(best.cols).length) best = { headerRow: r, cols, confidence: 0 };
  }
  const need = kind === 'payroll' ? (['name', 'gross', 'net'] as FieldKey[]) : (['name', 'amount'] as FieldKey[]);
  const have = need.filter((f) => best.cols[f] !== undefined).length;
  best.confidence = have === need.length ? Math.min(1, 0.7 + 0.3 * (Object.keys(best.cols).length / fields.length)) : have / need.length / 2;
  return best;
}

const cell = (row: string[], i: number | undefined): string => (i === undefined || i < 0 ? '' : String(row[i] ?? '').trim());
const amt = (row: string[], i: number | undefined): number => parseAmount(cell(row, i)) ?? 0;
const empty = (row: string[]) => row.every((c) => !String(c ?? '').trim());

let rid = 1;
const nextId = () => rid++;

export function payrollFromGrid(grid: Grid, m: Mapping): { doc: PayrollDoc; src: Record<number, string> } {
  const rows: PayrollRow[] = [];
  const src: Record<number, string> = {};
  for (let r = m.headerRow + 1; r < grid.length; r++) {
    const g = grid[r] ?? [];
    if (empty(g)) continue;
    const name = cell(g, m.cols.name);
    if (!name || /^(جمع|مجموع|total)/i.test(clean(name))) continue;
    const base = amt(g, m.cols.base);
    const ben = amt(g, m.cols.benefits);
    const ot = amt(g, m.cols.overtime);
    const gross = m.cols.gross !== undefined ? amt(g, m.cols.gross) : base + ben + ot;
    const id = nextId();
    rows.push({
      id, name, nationalCode: cell(g, m.cols.nationalCode), gross,
      grossInsurable: m.cols.grossInsurable !== undefined ? amt(g, m.cols.grossInsurable) : null,
      employeeInsurance: amt(g, m.cols.employeeInsurance), incomeTax: amt(g, m.cols.incomeTax), otherDeductions: amt(g, m.cols.otherDeductions), net: amt(g, m.cols.net),
      conf: m.confidence >= 0.85 ? 1 : m.confidence, confirmed: false, personKey: '',
    });
    src[id] = g.join(' | ');
  }
  return { doc: { period: '', companyName: '', unit: 'unknown', rows, printedTotals: null, printedEmployerShare: null }, src };
}

export function paymentsFromGrid(grid: Grid, m: Mapping): { doc: PaymentsDoc; src: Record<number, string> } {
  const rows: PayRow[] = [];
  const src: Record<number, string> = {};
  for (let r = m.headerRow + 1; r < grid.length; r++) {
    const g = grid[r] ?? [];
    if (empty(g)) continue;
    const name = cell(g, m.cols.name);
    const amount = amt(g, m.cols.amount);
    if (!name && !amount) continue;
    if (/^(جمع|مجموع|total)/i.test(clean(name))) continue;
    const id = nextId();
    rows.push({ id, payeeName: name, iban: cell(g, m.cols.iban), accountNo: cell(g, m.cols.accountNo), amount, date: cell(g, m.cols.date), description: cell(g, m.cols.description), trackingNo: cell(g, m.cols.trackingNo), conf: m.confidence >= 0.85 ? 1 : m.confidence, confirmed: false, personKey: '', how: null, matchConfirmed: false });
    src[id] = g.join(' | ');
  }
  return { doc: { bankName: '', sourceAccount: '', unit: 'unknown', rows, printedTotal: null }, src };
}

/* ---------- CSV ---------- */
export function parseCsv(text: string): Grid {
  const t = text.replace(/^﻿/, '');
  const first = t.split(/\r?\n/, 1)[0] ?? '';
  const delim = [',', ';', '\t'].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const out: Grid = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(cur); out.push(row); row = []; cur = '';
    } else cur += c;
  }
  if (cur || row.length) { row.push(cur); out.push(row); }
  return out;
}

/* ---------- Excel (خواندن در سرور) ---------- */
export interface Sheet { name: string; rows: Grid }
export const fileToB64 = (f: File): Promise<string> =>
  new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] ?? '');
    r.onerror = () => no(new Error(`خواندن فایل ناموفق بود: ${f.name}`));
    r.readAsDataURL(f);
  });

export async function readXlsxSheets(company: string, f: File): Promise<Sheet[]> {
  const r = await callApi<{ sheets: Array<{ name: string; rows: unknown[][] }> }>('docParseXlsx', { company, data: await fileToB64(f) });
  return r.sheets.map((s) => ({ name: s.name, rows: s.rows.map((row) => row.map((c) => (c == null ? '' : String(c)))) })).filter((s) => s.rows.some((r) => r.some((c) => c.trim())));
}

export const isSheetFile = (f: File) => /\.(xlsx|xls|csv)$/i.test(f.name);

export const emptyInsurance = (): InsuranceDoc => ({ payerName: '', amount: 0, penalty: 0, date: '', trackingNo: '', listNo: '', periodMonth: '', unit: 'unknown', conf: 1, confirmed: true, diffMode: 'payable' });
export const emptyPayroll = (): PayrollDoc => ({ period: '', companyName: '', unit: 'unknown', rows: [], printedTotals: null, printedEmployerShare: null });
export const emptyPayments = (): PaymentsDoc => ({ bankName: '', sourceAccount: '', unit: 'unknown', rows: [], printedTotal: null });
export const newPayrollRow = (): PayrollRow => ({ id: nextId(), name: '', nationalCode: '', gross: 0, grossInsurable: null, employeeInsurance: 0, incomeTax: 0, otherDeductions: 0, net: 0, conf: 1, confirmed: true, personKey: '' });
export const newPayRow = (): PayRow => ({ id: nextId(), payeeName: '', iban: '', accountNo: '', amount: 0, date: '', description: '', trackingNo: '', conf: 1, confirmed: true, personKey: '', how: null, matchConfirmed: false });

/* ---------- داده‌ی نمونه (Mock) برای آزمایش بدون فایل و بدون کلید؛ همه‌ی نام‌ها و مبالغ فرضی‌اند ---------- */
const prow = (name: string, gross: number, ins: number, tax: number, net: number, conf = 1): PayrollRow => ({ id: nextId(), name, nationalCode: '', gross, grossInsurable: null, employeeInsurance: ins, incomeTax: tax, otherDeductions: 0, net, conf, confirmed: false, personKey: '' });
export const SAMPLE_NAME: Record<DocKind, string[]> = {
  payroll: ['نمونه: لیست حقوق صحیح', 'نمونه: لیست حقوق دارای ایراد'],
  payment: ['نمونه: واریز بانکی (اضافه‌پرداخت و نام ناشناس)'],
  insurance: ['نمونه: فیش بیمه با جریمه'],
};
export function sampleDoc(kind: DocKind, variant: number): { fileName: string; doc: PayrollDoc | PaymentsDoc | InsuranceDoc } {
  const fileName = SAMPLE_NAME[kind][variant] ?? SAMPLE_NAME[kind][0];
  if (kind === 'payroll') {
    const good = variant === 0;
    return { fileName, doc: { period: '1405/08', companyName: 'شرکت نمونه', unit: 'rial', printedEmployerShare: null, printedTotals: null, rows: [prow('علی رضایی', 42_000_000, 2_940_000, 1_200_000, 37_860_000), prow('بهزاد کریمی', 30_000_000, 2_100_000, 0, good ? 27_900_000 : 28_000_000, good ? 1 : 0.55)] } };
  }
  if (kind === 'payment') {
    const mk = (name: string, amount: number, t: string, conf = 1): PayRow => ({ id: nextId(), payeeName: name, iban: '', accountNo: '', amount, date: '1405/08/20', description: 'حقوق آبان', trackingNo: t, conf, confirmed: false, personKey: '', how: null, matchConfirmed: false });
    return { fileName, doc: { bankName: 'بانک ملی', sourceAccount: '', unit: 'rial', printedTotal: null, rows: [mk('علي رضايي', 37_860_000, '900001'), mk('بهزاد کریمی', 28_000_000, '900002'), mk('ناشناس نمونه', 5_000_000, '900003', 0.7)] } };
  }
  return { fileName, doc: { payerName: 'شرکت نمونه', amount: 22_032_000, penalty: 432_000, date: '1405/08/25', trackingNo: '700123', listNo: '12', periodMonth: '1405/08', unit: 'rial', conf: 1, confirmed: false, diffMode: 'payable' } };
}
