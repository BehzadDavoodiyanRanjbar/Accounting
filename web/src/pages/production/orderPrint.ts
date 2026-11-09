import { fmtNum, str } from '../../kit/format';
import type { Row } from '../../kit/types';

const esc = (s: unknown) => str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** برگهٔ تولید قابل چاپ (مواد + مراحل + کنترل‌های کیفی + محل امضا) */
export function orderHtml(po: Row, companyName: string): string {
  const o = po.order as Row;
  const n = (v: unknown) => fmtNum(v, 3);
  const lim = (c: Row) =>
    c.type === 'number'
      ? `${String(c.min ?? '') !== '' ? esc(c.min) : '…'} تا ${String(c.max ?? '') !== '' ? esc(c.max) : '…'} ${esc(c.unit ?? '')}`
      : c.type === 'yesno'
        ? 'بله'
        : esc(((c.options ?? []) as string[]).join(' / '));
  const val = (c: Row) => (c.value === '' || c.value == null ? '' : esc(c.value === 'yes' ? 'بله' : c.value === 'no' ? 'خیر' : c.value));
  let h =
    `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>برگه‌ی تولید ${esc(o.OrderNo)}</title><style>@font-face{font-family:'VzFa';src:url('${location.origin}/v2/fonts/Vazirmatn-Regular.ttf?v=15')}body{font-family:'VzFa',Tahoma,sans-serif;padding:20px;font-size:13px;color:#111}h1{font-size:18px;margin:0 0 6px}table{border-collapse:collapse;width:100%;margin:6px 0 14px}th,td{border:1px solid #666;padding:5px 7px;text-align:right}th{background:#e8e8e8}.m{margin:2px 0;color:#444}.bar button{padding:6px 14px;margin-bottom:10px}@media print{.bar{display:none}}</style></head><body>` +
    `<div class="bar"><button onclick="window.print()">چاپ</button></div><h1>برگه‌ی تولید ${esc(o.OrderNo)} — ${esc(o.Product)}</h1>` +
    `<div class="m">${esc(companyName)} | تاریخ: ${esc(o.DateJalali)} | مقدار: ${n(o.PlannedQty)} ${esc(o.Unit)} | وضعیت: ${esc(o.Status)}${o.SaleSerial ? ' | برای فروش ' + esc(o.SaleSerial) : ''}</div>`;
  h += `<h3>مواد مصرفی</h3><table><tr><th>ماده</th><th>مقدار برنامه</th><th>مصرف واقعی</th><th>واحد</th></tr>${(po.materials as Row[])
    .map((m) => `<tr><td>${esc(m.Name)}</td><td>${n(m.PlannedQty)}</td><td>${m.ActualQty === '' ? '' : n(m.ActualQty)}</td><td>${esc(m.Unit)}</td></tr>`)
    .join('')}</table>`;
  (po.steps as Row[]).forEach((s, i) => {
    h += `<h3>مرحله ${i + 1}: ${esc(s.Name)}${s.WorkCenter ? ' (' + esc(s.WorkCenter) + ')' : ''}</h3>${s.Instructions ? `<div class="m">${esc(s.Instructions)}</div>` : ''}`;
    h += `<table><tr><th style="width:30px">✓</th><th>کنترل / کار</th><th>حد مجاز</th><th>مقدار ثبت‌شده</th></tr>`;
    (s.Checks as Row[]).forEach((c) => (h += `<tr><td>☐</td><td>${esc(c.label)}</td><td>${lim(c)}</td><td>${val(c)}</td></tr>`));
    (s.Labor as Row[]).forEach((z) => (h += `<tr><td>☐</td><td>دستمزد: ${esc(z.name)}</td><td colspan="2">${n(z.qty)} واحد</td></tr>`));
    h += `<tr><td colspan="4" style="height:34px">یادداشت: ${esc(s.Notes ?? '')}</td></tr></table>`;
  });
  return h + `<p class="m" style="margin-top:30px">امضای مسئول تولید: ____________ &nbsp;&nbsp;&nbsp; امضای کنترل کیفیت: ____________</p><script>(document.fonts?document.fonts.ready:Promise.resolve())</script></body></html>`;
}

export function printOrder(po: Row, companyName: string): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(orderHtml(po, companyName));
  w.document.close();
  return true;
}
