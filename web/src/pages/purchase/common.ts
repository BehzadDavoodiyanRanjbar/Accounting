import { str } from '../../kit/format';
import type { Row } from '../../kit/types';

export const PAY_METHODS = ['نقد', 'کارت‌به‌کارت', 'انتقال بانکی', 'چک', 'کارتخوان (POS)', 'تهاتر / تسویه حساب', 'سایر'];
export const CHEQUE_STATUS = ['در جریان وصول', 'پاس شده', 'برگشتی'];
export const COST_TYPES = ['باربری', 'کرایه حمل', 'بارگیری و تخلیه', 'بیمه', 'گمرک و عوارض', 'بسته‌بندی', 'نصب و راه‌اندازی', 'سایر'];

export const r2 = (n: number) => Math.round(n * 100) / 100;
export const toNum = (v: unknown) => Number(str(v).replace(/,/g, '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))) || 0;

export interface InvLine {
  k: number;
  ProductID: string;
  Unit: string;
  Quantity: string;
  UnitPrice: string;
  Discount: string;
  VAT: string;
  Serials: string;
}
export interface InvCost {
  k: number;
  CostType: string;
  Payee: string;
  Description: string;
  Amount: string;
  VAT: string;
}
export interface InvPay {
  k: number;
  DateJalali: string;
  Method: string;
  Amount: string;
  FromAccount: string;
  TrackingNo: string;
  DestAccount: string;
  CardLast4: string;
  ChequeNo: string;
  SayadNo: string;
  ChequeBank: string;
  ChequeDueJalali: string;
  ChequeStatus: string;
  Description: string;
  AccountID: string;
}

let uid = 1;
export const newLine = (): InvLine => ({ k: uid++, ProductID: '', Unit: '', Quantity: '', UnitPrice: '', Discount: '', VAT: '', Serials: '' });
export const newCost = (): InvCost => ({ k: uid++, CostType: '', Payee: '', Description: '', Amount: '', VAT: '' });
export const newPay = (date: string, amount: string): InvPay => ({
  k: uid++, DateJalali: date, Method: 'نقد', Amount: amount, FromAccount: '', TrackingNo: '', DestAccount: '', CardLast4: '', ChequeNo: '', SayadNo: '', ChequeBank: '', ChequeDueJalali: '', ChequeStatus: '', Description: '', AccountID: '',
});

export const lineCalc = (l: InvLine) => {
  const g = r2(toNum(l.Quantity) * toNum(l.UnitPrice));
  const n = r2(g - toNum(l.Discount));
  return { g, n, t: r2(n + toNum(l.VAT)) };
};

export function invTotals(items: InvLine[], costs: InvCost[], pays: InvPay[]) {
  let g = 0;
  let d = 0;
  let n = 0;
  let v = 0;
  let t = 0;
  items.forEach((l) => {
    const c = lineCalc(l);
    g += c.g;
    d += toNum(l.Discount);
    n += c.n;
    v += toNum(l.VAT);
    t += c.t;
  });
  const cost = r2(costs.reduce((s, c) => s + toNum(c.Amount) + toNum(c.VAT), 0));
  const paid = r2(pays.reduce((s, p) => s + (p.Method === 'چک' && p.ChequeStatus === 'برگشتی' ? 0 : toNum(p.Amount)), 0));
  t = r2(t);
  const pay = r2(t + cost);
  return { g: r2(g), d: r2(d), n: r2(n), v: r2(v), t, c: cost, pay, paid, rem: r2(pay - paid) };
}

export const payStatus = (pay: number, paid: number) =>
  pay <= 0.005 || paid >= pay - 0.005 ? (paid > pay + 0.005 ? 'بیش از مبلغ قابل پرداخت' : 'تسویه') : paid > 0.005 ? 'بخشی پرداخت' : 'پرداخت‌نشده';

export const payDetail = (p: Row): string => {
  const a: string[] = [];
  if (p.FromAccount) a.push(`از: ${str(p.FromAccount)}`);
  if (p.TrackingNo) a.push(`پیگیری: ${str(p.TrackingNo)}`);
  if (p.DestAccount) a.push(`مقصد: ${str(p.DestAccount)}`);
  if (p.CardLast4) a.push(`کارت: ****${str(p.CardLast4)}`);
  if (p.Method === 'چک') {
    if (p.ChequeNo) a.push(`چک: ${str(p.ChequeNo)}`);
    if (p.SayadNo) a.push(`صیادی: ${str(p.SayadNo)}`);
    if (p.ChequeBank) a.push(`بانک: ${str(p.ChequeBank)}`);
    a.push(`سررسید: ${str(p.ChequeDueJalali)}`);
    a.push(`وضعیت: ${str(p.ChequeStatus)}`);
  }
  if (p.Description) a.push(str(p.Description));
  return a.join(' | ');
};
