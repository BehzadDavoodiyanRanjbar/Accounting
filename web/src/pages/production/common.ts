import type { Row } from '../../kit/types';

export const PSTC: Record<string, string> = { 'پیش‌نویس': 'draft', 'در حال تولید': 'run', 'تکمیل‌شده': 'done', 'لغو': 'cancel' };
export const PST_COLOR: Record<string, string> = { draft: 'default', run: 'processing', done: 'success', cancel: 'error' };
export const STST = ['در انتظار', 'در حال انجام', 'انجام شد'];

/** ارقام فارسی/عربی ← لاتین */
export const fa2en = (s: unknown): string =>
  String(s ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

export const n0 = (v: unknown): number => {
  const n = Number(fa2en(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export type CkState = 'ok' | 'fail' | 'missing' | 'empty';

/** وضعیت یک کنترل کیفی طبق مقدار واردشده */
export function ckState(c: Row): CkState {
  const v = c.value == null ? '' : String(c.value).trim();
  if (v === '') return c.required ? 'missing' : 'empty';
  if (c.type === 'number') {
    const n = Number(fa2en(v));
    if (Number.isNaN(n)) return 'fail';
    const hasMin = String(c.min ?? '') !== '';
    const hasMax = String(c.max ?? '') !== '';
    if ((hasMin && n < Number(c.min)) || (hasMax && n > Number(c.max))) return 'fail';
    return 'ok';
  }
  if (c.type === 'yesno') return v === 'yes' ? 'ok' : 'fail';
  if (c.type === 'choice') return ((c.failOptions ?? []) as string[]).includes(v) ? 'fail' : 'ok';
  return 'ok';
}

/** محاسبهٔ زندهٔ بهای تمام‌شده روی صفحهٔ سفارش (مثل نسخهٔ قبلی) */
export function costCalc(po: Row): { material: number; labor: number; overhead: number; total: number; unit: number } {
  let m = 0;
  let l = 0;
  let o = 0;
  (po.materials as Row[]).forEach((x) => {
    const q = x.ActualQty === '' ? x.PlannedQty : x.ActualQty;
    m += n0(q) * n0(x.UnitCost);
  });
  (po.steps as Row[]).forEach((s) => (s.Labor as Row[]).forEach((z) => (l += n0(z.qty) * n0(z.rate))));
  (po.overheads as Row[]).forEach((z) => (o += n0(z.Amount)));
  const ord = po.order as Row;
  const q = ord.ActualQty !== '' && n0(ord.ActualQty) > 0 ? n0(ord.ActualQty) : n0(ord.PlannedQty) || 1;
  return { material: Math.round(m), labor: Math.round(l), overhead: Math.round(o), total: Math.round(m + l + o), unit: Math.round((m + l + o) / q) };
}

/** بارگذاری سفارش برای ذخیره: همان ساختاری که سرور انتظار دارد */
export function orderPayload(company: string, po: Row, date: string, extra: Row = {}): Row {
  const o = po.order as Row;
  return {
    company,
    OrderID: o.OrderID,
    DateJalali: date || o.DateJalali,
    PlannedQty: o.PlannedQty,
    ActualQty: o.ActualQty,
    Notes: o.Notes,
    Params: o.Params,
    Extra: o.Extra,
    materials: (po.materials as Row[]).map((m) => ({ ProductID: m.ProductID, PlannedQty: m.PlannedQty, ActualQty: m.ActualQty, StepNo: m.StepNo, Notes: m.Notes })),
    steps: (po.steps as Row[]).map((s) => ({
      StepNo: s.StepNo,
      Name: s.Name,
      WorkCenter: s.WorkCenter,
      Status: s.Status,
      StdMinutes: s.StdMinutes,
      ActualMinutes: s.ActualMinutes,
      Instructions: s.Instructions,
      Notes: s.Notes,
      Labor: (s.Labor as Row[]).map((z) => ({ serviceId: z.serviceId, qty: z.qty, rate: z.rate, desc: z.desc })),
      Checks: (s.Checks as Row[]).map((c) => {
        const x: Row = {};
        Object.keys(c).forEach((k) => {
          if (k !== 'state') x[k] = c[k];
        });
        return x;
      }),
    })),
    overheads: (po.overheads as Row[]).map((z) => ({ ExpenseID: z.ExpenseID, Description: z.Description, Amount: z.Amount })),
    ...extra,
  };
}
