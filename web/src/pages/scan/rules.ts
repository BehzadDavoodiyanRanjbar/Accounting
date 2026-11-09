/**
 * قواعد حسابداری سه جریان «ثبت از روی اسکن» — توابع خالص.
 * رابط کاربری فقط این توابع را صدا می‌زند و نتیجه را نشان می‌دهد؛ هیچ محاسبهٔ مالی در رابط انجام نمی‌شود.
 * همهٔ ردیف‌های سند به ریال صحیح و گرد «نیم به بالا» هستند. هیچ سندی «قطعی» ساخته نمی‌شود؛ فقط پیش‌نویس.
 */
import { isValidIban, isValidNationalCode, matchPerson, parseJalaliDate, roundHalfUp, toRial } from './normalize';
import type { MatchHow, Person, Unit } from './normalize';

export type AccRole = 'wageExp' | 'erExp' | 'wagePay' | 'insPay' | 'taxPay' | 'advance' | 'bank' | 'penalty';

export const ROLE_LABEL: Record<AccRole, string> = {
  wageExp: 'هزینه حقوق و دستمزد',
  erExp: 'هزینه بیمه سهم کارفرما',
  wagePay: 'حقوق و دستمزد پرداختنی',
  insPay: 'بیمه پرداختنی',
  taxPay: 'مالیات حقوق پرداختنی',
  advance: 'مساعده و وام کارکنان',
  bank: 'بانک',
  penalty: 'هزینه جریمه دیرکرد بیمه',
};

export interface Rates {
  employee: number;
  employer: number;
  unemployment: number;
}
/** فقط پیش‌فرض‌های قابل‌ویرایش؛ با حسابدار تأیید شوند */
export const DEFAULT_RATES: Rates = { employee: 7, employer: 20, unemployment: 3 };

export interface Line {
  role: AccRole;
  debit: number;
  credit: number;
  description: string;
  person?: { key: string; name: string };
}
export interface Draft {
  lines: Line[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}
export interface Issue {
  code: 'unit' | 'diff' | 'total' | 'conf' | 'empty' | 'date' | 'invalid' | 'match' | 'unmatched' | 'balance' | 'dup' | 'bank';
  severity: 'block' | 'warn';
  message: string;
  rowId?: number;
  amount?: number;
}

export const CONF_WARN = 0.85;
export const CONF_BAD = 0.6;

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

export function makeDraft(lines: Line[]): Draft {
  const ls = lines.filter((l) => l.debit > 0 || l.credit > 0);
  const totalDebit = sum(ls.map((l) => l.debit));
  const totalCredit = sum(ls.map((l) => l.credit));
  return { lines: ls, totalDebit, totalCredit, balanced: ls.length >= 2 && totalDebit === totalCredit && totalDebit > 0 };
}

/* ======================= ۱) شناسایی هزینهٔ حقوق ======================= */
export interface PayrollRow {
  id: number;
  name: string;
  nationalCode: string;
  gross: number;
  grossInsurable: number | null;
  employeeInsurance: number;
  incomeTax: number;
  otherDeductions: number;
  net: number;
  conf: number;
  confirmed: boolean;
  /** کارمند تطبیق‌خورده (کلید) یا خالی = کارمند جدید ساخته می‌شود */
  personKey: string;
}
export interface PayrollTotals {
  gross: number;
  employeeInsurance: number;
  incomeTax: number;
  otherDeductions: number;
  net: number;
}
export interface PayrollDoc {
  period: string;
  companyName: string;
  unit: Unit;
  rows: PayrollRow[];
  printedTotals: PayrollTotals | null;
  printedEmployerShare: number | null;
}

/** ناخالص − بیمه − مالیات − سایر کسور − خالص (باید صفر باشد) */
export const rowDiff = (r: PayrollRow): number => r.gross - r.employeeInsurance - r.incomeTax - r.otherDeductions - r.net;

export const payrollTotals = (rows: PayrollRow[]): PayrollTotals => ({
  gross: sum(rows.map((r) => r.gross)),
  employeeInsurance: sum(rows.map((r) => r.employeeInsurance)),
  incomeTax: sum(rows.map((r) => r.incomeTax)),
  otherDeductions: sum(rows.map((r) => r.otherDeductions)),
  net: sum(rows.map((r) => r.net)),
});

/** سهم کارفرما = (نرخ کارفرما + بیکاری) × حقوق مشمول بیمه؛ اگر سند خودش چاپ کرده باشد مقدار سند مقدم است */
export function employerShare(doc: PayrollDoc, rates: Rates): { value: number; fromDocument: boolean; computed: number } {
  const base = sum(doc.rows.map((r) => (r.grossInsurable ?? r.gross)));
  const computed = roundHalfUp((base * (rates.employer + rates.unemployment)) / 100);
  if (doc.printedEmployerShare != null) return { value: doc.printedEmployerShare, fromDocument: true, computed };
  return { value: computed, fromDocument: false, computed };
}

export function payrollIssues(doc: PayrollDoc, rates: Rates): Issue[] {
  const out: Issue[] = [];
  if (!doc.rows.length) out.push({ code: 'empty', severity: 'block', message: 'هیچ ردیفی برای ثبت وجود ندارد.' });
  if (doc.unit === 'unknown') out.push({ code: 'unit', severity: 'block', message: 'واحد مبلغ (ریال یا تومان) را انتخاب کنید.' });
  doc.rows.forEach((r, i) => {
    const d = rowDiff(r);
    if (d !== 0) out.push({ code: 'diff', severity: 'block', rowId: r.id, amount: d, message: `ردیف ${i + 1} (${r.name || 'بدون نام'}): ناخالص − کسور ≠ خالص (اختلاف ${d.toLocaleString('en-US')}).` });
    if (!r.name.trim()) out.push({ code: 'empty', severity: 'block', rowId: r.id, message: `ردیف ${i + 1}: نام کارمند خالی است.` });
    if (r.nationalCode && !isValidNationalCode(r.nationalCode)) out.push({ code: 'invalid', severity: 'warn', rowId: r.id, message: `ردیف ${i + 1}: کد ملی نامعتبر است.` });
    if ([r.gross, r.employeeInsurance, r.incomeTax, r.otherDeductions, r.net].some((x) => x < 0)) out.push({ code: 'invalid', severity: 'block', rowId: r.id, message: `ردیف ${i + 1}: مبلغ منفی مجاز نیست.` });
    if (r.conf < CONF_WARN && !r.confirmed) out.push({ code: 'conf', severity: 'block', rowId: r.id, message: `ردیف ${i + 1}: اطمینان استخراج پایین است؛ پس از بررسی، تیک «بررسی شد» را بزنید.` });
  });
  if (doc.printedTotals) {
    const t = payrollTotals(doc.rows);
    (['gross', 'employeeInsurance', 'incomeTax', 'otherDeductions', 'net'] as const).forEach((k) => {
      const d = t[k] - doc.printedTotals![k];
      if (d !== 0) out.push({ code: 'total', severity: 'block', amount: d, message: `جمع ردیف‌ها با جمع چاپ‌شده در سند یکی نیست (${TOT_LABEL[k]}: اختلاف ${d.toLocaleString('en-US')}).` });
    });
  }
  const es = employerShare(doc, rates);
  if (es.fromDocument && es.value !== es.computed) out.push({ code: 'diff', severity: 'warn', amount: es.value - es.computed, message: `سهم کارفرمای چاپ‌شده در سند با محاسبه (${es.computed.toLocaleString('en-US')}) فرق دارد؛ مقدار سند اعمال می‌شود.` });
  return out;
}
const TOT_LABEL: Record<keyof PayrollTotals, string> = { gross: 'ناخالص', employeeInsurance: 'بیمه سهم کارمند', incomeTax: 'مالیات', otherDeductions: 'سایر کسور', net: 'خالص پرداختنی' };

export function buildPayrollVoucher(doc: PayrollDoc, rates: Rates): Draft {
  if (doc.unit === 'unknown') return makeDraft([]);
  const R = (x: number) => toRial(x, doc.unit);
  const t = payrollTotals(doc.rows);
  const share = R(employerShare(doc, rates).value);
  const lines: Line[] = [];
  const per = `حقوق ${doc.period}`;
  lines.push({ role: 'wageExp', debit: R(t.gross), credit: 0, description: `هزینه ${per}` });
  lines.push({ role: 'erExp', debit: share, credit: 0, description: `سهم کارفرما از بیمه ${doc.period}` });
  doc.rows.forEach((r) => lines.push({ role: 'wagePay', debit: 0, credit: R(r.net), description: `حقوق پرداختنی ${doc.period} - ${r.name}`, person: { key: r.personKey || `new:${r.id}`, name: r.name } }));
  lines.push({ role: 'insPay', debit: 0, credit: R(t.employeeInsurance) + share, description: `بیمه پرداختنی ${doc.period} (سهم کارمند و کارفرما)` });
  lines.push({ role: 'taxPay', debit: 0, credit: R(t.incomeTax), description: `مالیات حقوق پرداختنی ${doc.period}` });
  doc.rows.forEach((r) => {
    if (r.otherDeductions > 0) lines.push({ role: 'advance', debit: 0, credit: R(r.otherDeductions), description: `کسر مساعده/وام ${doc.period} - ${r.name}`, person: { key: r.personKey || `new:${r.id}`, name: r.name } });
  });
  return makeDraft(lines);
}

/** مانده بدهی هر کارمند و بیمهٔ دوره که این سند ایجاد می‌کند (به ریال) — برای ذخیره در پرونده */
export function payrollPayables(doc: PayrollDoc, rates: Rates): { employees: Array<{ key: string; name: string; nationalCode: string; net: number }>; insurance: number } {
  if (doc.unit === 'unknown') return { employees: [], insurance: 0 };
  const R = (x: number) => toRial(x, doc.unit);
  const share = R(employerShare(doc, rates).value);
  return {
    employees: doc.rows.map((r) => ({ key: r.personKey || `new:${r.id}`, name: r.name, nationalCode: r.nationalCode, net: R(r.net) })),
    insurance: R(payrollTotals(doc.rows).employeeInsurance) + share,
  };
}

/* ======================= ۲) پرداخت به کارکنان ======================= */
export interface PayRow {
  id: number;
  payeeName: string;
  iban: string;
  accountNo: string;
  amount: number;
  date: string;
  description: string;
  trackingNo: string;
  conf: number;
  confirmed: boolean;
  personKey: string;
  how: MatchHow | 'manual' | null;
  /** تطبیق تقریبی تا تأیید انسان معتبر نیست */
  matchConfirmed: boolean;
}
export interface PaymentsDoc {
  bankName: string;
  sourceAccount: string;
  unit: Unit;
  rows: PayRow[];
  printedTotal: number | null;
}
export interface Payable {
  key: string;
  name: string;
  nationalCode: string;
  /** مانده بدهی باز حقوق (ریال) */
  open: number;
}

/** تطبیق خودکار ردیف‌های بانک با کارکنان دارای بدهی؛ ردیف‌های دستی/تأییدشده دست نمی‌خورند */
export function matchPayRows(rows: PayRow[], people: Person[]): PayRow[] {
  return rows.map((r) => {
    if (r.how === 'manual' || (r.personKey && r.matchConfirmed)) return r;
    const m = matchPerson({ name: r.payeeName, iban: r.iban }, people);
    if (!m) return { ...r, personKey: '', how: null, matchConfirmed: false };
    return { ...r, personKey: m.person.key, how: m.how, matchConfirmed: m.auto };
  });
}

export interface PayItem {
  rowId: number;
  personKey: string;
  name: string;
  amount: number;
  applied: number;
  excess: number;
  overpaid: boolean;
}
export interface PaymentsResult {
  draft: Draft;
  items: PayItem[];
  /** ردیف‌های «نیازمند تطبیق دستی»؛ در سند نیستند */
  unmatched: number[];
}

export function buildPaymentsVoucher(doc: PaymentsDoc, payables: Payable[]): PaymentsResult {
  if (doc.unit === 'unknown') return { draft: makeDraft([]), items: [], unmatched: [] };
  const open: Record<string, number> = {};
  payables.forEach((p) => (open[p.key] = p.open));
  const nameOf: Record<string, string> = {};
  payables.forEach((p) => (nameOf[p.key] = p.name));
  const lines: Line[] = [];
  const items: PayItem[] = [];
  const unmatched: number[] = [];
  let paidTotal = 0;
  doc.rows.forEach((r) => {
    if (!r.personKey || !(r.matchConfirmed || r.how === 'exact' || r.how === 'nationalCode' || r.how === 'iban' || r.how === 'manual')) {
      unmatched.push(r.id);
      return;
    }
    const amt = toRial(r.amount, doc.unit);
    const have = Math.max(0, open[r.personKey] ?? 0);
    const applied = Math.min(amt, have);
    const excess = amt - applied;
    open[r.personKey] = have - applied;
    const nm = nameOf[r.personKey] || r.payeeName;
    const person = { key: r.personKey, name: nm };
    if (applied > 0) lines.push({ role: 'wagePay', debit: applied, credit: 0, description: `پرداخت حقوق - ${nm}${r.trackingNo ? ` (پیگیری ${r.trackingNo})` : ''}`, person });
    if (excess > 0) lines.push({ role: 'advance', debit: excess, credit: 0, description: `پرداخت اضافه بر حقوق (مساعده) - ${nm}${r.trackingNo ? ` (پیگیری ${r.trackingNo})` : ''}`, person });
    paidTotal += amt;
    items.push({ rowId: r.id, personKey: r.personKey, name: nm, amount: amt, applied, excess, overpaid: excess > 0 });
  });
  lines.push({ role: 'bank', debit: 0, credit: paidTotal, description: `پرداخت حقوق کارکنان از ${doc.bankName || 'بانک'}${doc.sourceAccount ? ` (${doc.sourceAccount})` : ''}` });
  return { draft: makeDraft(lines), items, unmatched };
}

export function paymentsIssues(doc: PaymentsDoc, result: PaymentsResult): Issue[] {
  const out: Issue[] = [];
  if (!doc.rows.length) out.push({ code: 'empty', severity: 'block', message: 'هیچ ردیفی برای ثبت وجود ندارد.' });
  if (doc.unit === 'unknown') out.push({ code: 'unit', severity: 'block', message: 'واحد مبلغ (ریال یا تومان) را انتخاب کنید.' });
  doc.rows.forEach((r, i) => {
    const w = `ردیف ${i + 1} (${r.payeeName || 'بدون نام'})`;
    if (!(r.amount > 0)) out.push({ code: 'empty', severity: 'block', rowId: r.id, message: `${w}: مبلغ نامعتبر است.` });
    if (r.iban && !isValidIban(r.iban)) out.push({ code: 'invalid', severity: 'warn', rowId: r.id, message: `${w}: شمارهٔ شبا نامعتبر است.` });
    if (r.date && !parseJalaliDate(r.date)) out.push({ code: 'date', severity: 'warn', rowId: r.id, message: `${w}: تاریخ نامعتبر است.` });
    if (r.how === 'fuzzy' && !r.matchConfirmed) out.push({ code: 'match', severity: 'block', rowId: r.id, message: `${w}: تطبیق تقریبی نام است و باید تأیید شود.` });
    if (r.conf < CONF_WARN && !r.confirmed) out.push({ code: 'conf', severity: 'block', rowId: r.id, message: `${w}: اطمینان استخراج پایین است؛ پس از بررسی، تیک «بررسی شد» را بزنید.` });
  });
  result.items.forEach((it) => {
    if (it.overpaid) out.push({ code: 'diff', severity: 'warn', rowId: it.rowId, amount: it.excess, message: `پرداخت اضافه: ${it.name} (${it.excess.toLocaleString('en-US')} ریال بیش از بدهی باز؛ به «مساعده و وام کارکنان» می‌رود).` });
  });
  if (result.unmatched.length) out.push({ code: 'unmatched', severity: 'warn', message: `${result.unmatched.length} ردیف نیازمند تطبیق دستی است و در سند نمی‌آید.` });
  if (doc.printedTotal != null && doc.unit !== 'unknown') {
    const t = doc.rows.reduce((a, r) => a + r.amount, 0);
    if (t !== doc.printedTotal) out.push({ code: 'total', severity: 'block', amount: t - doc.printedTotal, message: `جمع ردیف‌ها با جمع کل چاپ‌شده یکی نیست (اختلاف ${(t - doc.printedTotal).toLocaleString('en-US')}).` });
  }
  if (!result.items.length && doc.rows.length) out.push({ code: 'empty', severity: 'block', message: 'هیچ ردیفی به کارمند تطبیق داده نشده است.' });
  return out;
}

/* ======================= ۳) پرداخت حق بیمه ======================= */
export interface InsuranceDoc {
  payerName: string;
  amount: number;
  penalty: number;
  date: string;
  trackingNo: string;
  listNo: string;
  periodMonth: string;
  unit: Unit;
  conf: number;
  confirmed: boolean;
  /** وقتی مبلغ با بدهی باز دوره فرق دارد: payable = همه در بیمه پرداختنی، penalty = مازاد در هزینه جریمه */
  diffMode: 'payable' | 'penalty';
}
export interface InsuranceResult {
  draft: Draft;
  principal: number;
  penalty: number;
  /** اصل پرداختی − بدهی باز دوره (null اگر بدهی باز دوره معلوم نیست) */
  diff: number | null;
}

export function buildInsuranceVoucher(doc: InsuranceDoc, open: number | null): InsuranceResult {
  if (doc.unit === 'unknown') return { draft: makeDraft([]), principal: 0, penalty: 0, diff: null };
  const paid = toRial(doc.amount, doc.unit);
  const pen = Math.min(Math.max(0, toRial(doc.penalty || 0, doc.unit)), paid);
  const principal = paid - pen;
  const diff = open == null ? null : principal - open;
  let toPayable = principal;
  let toPenalty = pen;
  if (doc.diffMode === 'penalty' && diff != null && diff > 0) {
    toPayable = open as number;
    toPenalty = pen + diff;
  }
  const per = doc.periodMonth ? ` ${doc.periodMonth}` : '';
  const ref = doc.trackingNo ? ` (پیگیری ${doc.trackingNo})` : '';
  const lines: Line[] = [
    { role: 'insPay', debit: toPayable, credit: 0, description: `پرداخت حق بیمه${per}${ref}` },
    { role: 'penalty', debit: toPenalty, credit: 0, description: `جریمه دیرکرد بیمه${per}${ref}` },
    { role: 'bank', debit: 0, credit: paid, description: `پرداخت حق بیمه${per}${ref}` },
  ];
  return { draft: makeDraft(lines), principal, penalty: pen, diff };
}

export function insuranceIssues(doc: InsuranceDoc, res: InsuranceResult): Issue[] {
  const out: Issue[] = [];
  if (doc.unit === 'unknown') out.push({ code: 'unit', severity: 'block', message: 'واحد مبلغ (ریال یا تومان) را انتخاب کنید.' });
  if (!(doc.amount > 0)) out.push({ code: 'empty', severity: 'block', message: 'مبلغ پرداختی نامعتبر است.' });
  if (doc.penalty > doc.amount) out.push({ code: 'invalid', severity: 'block', message: 'جریمه از کل مبلغ بیشتر است.' });
  if (!doc.trackingNo.trim()) out.push({ code: 'empty', severity: 'block', message: 'شمارهٔ پیگیری وارد نشده است.' });
  if (doc.date && !parseJalaliDate(doc.date)) out.push({ code: 'date', severity: 'block', message: 'تاریخ نامعتبر است.' });
  if (doc.conf < CONF_WARN && !doc.confirmed) out.push({ code: 'conf', severity: 'block', message: 'اطمینان استخراج پایین است؛ پس از بررسی، تیک «بررسی شد» را بزنید.' });
  if (res.diff != null && res.diff !== 0) out.push({ code: 'diff', severity: 'warn', amount: res.diff, message: res.diff > 0 ? `اصل پرداختی ${res.diff.toLocaleString('en-US')} ریال بیشتر از بدهی باز دوره است؛ نحوهٔ ثبت مازاد را انتخاب کنید.` : `اصل پرداختی ${(-res.diff).toLocaleString('en-US')} ریال کمتر از بدهی باز دوره است (پرداخت جزئی).` });
  return out;
}

/** سند باید متوازن باشد و برای ثبت هیچ خطای مسدودکننده‌ای نداشته باشد */
export const canCreate = (draft: Draft, issues: Issue[]): boolean => draft.balanced && !issues.some((i) => i.severity === 'block');
