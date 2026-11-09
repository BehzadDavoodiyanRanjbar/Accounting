import { fmtNum, todayJalali } from '../../kit/format';
import type { Row } from '../../kit/types';

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export const stNat = (v: number): string => (Math.abs(v) < 0.5 ? '—' : v > 0 ? 'بدهکار' : 'بستانکار');
export const stPer = (r: Row): string => (r.from || r.to ? `دوره: ${r.from ? 'از ' + r.from : ''} ${r.to ? 'تا ' + r.to : ''}` : 'همه‌ی دوره‌ها');

/** ردیف‌های صورتحساب: مانده ابتدای دوره + گردش‌ها */
export function stRows(r: Row): Row[] {
  const first: Row = { no: '', j: '', desc: 'مانده ابتدای دوره', deb: 0, cred: 0, bal: r.opening, first: 1 };
  return [first, ...((r.lines ?? []) as Row[]).map((l) => ({ no: l.no, j: l.j, desc: l.desc || l.kind, deb: l.deb, cred: l.cred, bal: l.bal }))];
}

const wrap = (n: number) => (Math.abs(n) < 0.005 ? '0' : fmtNum(Math.abs(n)));
const closingText = (c: number) => (Math.abs(c) < 0.5 ? '' : c > 0 ? ' (او به ما بدهکار است)' : ' (ما به او بدهکاریم)');

export function statementHtml(r: Row, companyName: string): string {
  const rows = stRows(r);
  let h =
    `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>صورتحساب ${esc(r.name)}</title><style>@font-face{font-family:'VzFa';src:url('${location.origin}/v2/fonts/Vazirmatn-Regular.ttf?v=15')}body{font-family:'VzFa',Tahoma,sans-serif;margin:0;padding:24px;color:#111;background:#fff;font-size:13px}h1{font-size:18px;margin:0 0 4px}.m{color:#555;margin:2px 0}.bar{margin:14px 0}button{font:inherit;padding:7px 16px;margin-left:8px;border:1px solid #98a2b3;background:#f2f4f7;border-radius:6px;cursor:pointer}table{border-collapse:collapse;width:100%;margin-top:10px}th,td{border:1px solid #98a2b3;padding:6px 8px;text-align:right}th{background:#e8eef7}td.n{direction:ltr;text-align:right;white-space:nowrap}tr.f td{background:#f7f7f7}tr.t td{background:#e8eef7;font-weight:bold}.sum{margin-top:16px;border:1px solid #98a2b3;padding:10px 14px;border-radius:6px;line-height:2}.sum b{font-size:14px}@media print{.bar{display:none}body{padding:0}}</style></head><body>` +
    `<h1>صورتحساب ${r.merged ? 'ادغام‌شده (فروشنده و خریدار)' : 'حساب'}: ${esc(r.name)}</h1><div class="m">شرکت/مشتری: ${esc(companyName)}</div>` +
    `<div class="m">${esc(stPer(r))}${r.merged && r.supName !== r.cusName ? ` | نام در فهرست فروشندگان: ${esc(r.supName)}، در فهرست خریداران: ${esc(r.cusName)}` : ''}</div>` +
    `<div class="m">تاریخ تهیه گزارش: ${todayJalali()} | مبالغ به ریال</div><div class="bar"><button onclick="window.print()">چاپ</button></div>` +
    `<table><thead><tr><th>ردیف</th><th>شماره صورتحساب</th><th>تاریخ صورتحساب</th><th>شرح</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th><th>ماهیت</th></tr></thead><tbody>`;
  rows.forEach((x, i) => {
    h += `<tr${x.first ? ' class="f"' : ''}><td>${x.first ? '' : i}</td><td>${esc(x.no)}</td><td>${esc(x.j)}</td><td>${esc(x.desc)}</td><td class="n">${x.first || !x.deb ? '' : fmtNum(x.deb)}</td><td class="n">${x.first || !x.cred ? '' : fmtNum(x.cred)}</td><td class="n">${wrap(Number(x.bal) || 0)}</td><td>${stNat(Number(x.bal) || 0)}</td></tr>`;
  });
  const c = Number(r.closing) || 0;
  h += `<tr class="t"><td colspan="4">جمع گردش دوره / مانده نهایی</td><td class="n">${fmtNum(r.totalDeb)}</td><td class="n">${fmtNum(r.totalCred)}</td><td class="n">${wrap(c)}</td><td>${stNat(c)}</td></tr></tbody></table>`;
  if (r.merged && r.parts) {
    const ps = Number(r.parts.sup?.closing) || 0;
    const pc = Number(r.parts.cus?.closing) || 0;
    h += `<div class="sum"><b>محاسبه‌ی مانده نهایی (جمع جبری دو گزارش)</b><br>مانده به‌عنوان فروشنده (خرید از او): ${wrap(ps)} ${stNat(ps)}<br>مانده به‌عنوان خریدار (فروش به او): ${wrap(pc)} ${stNat(pc)}<br><b>مانده نهایی: ${wrap(c)} ${stNat(c)}${closingText(c)}</b></div>`;
  } else {
    h += `<div class="sum"><b>مانده نهایی: ${wrap(c)} ${stNat(c)}${closingText(c)}</b></div>`;
  }
  return h + `<p class="m" style="margin-top:14px">بدهکار = فروش به شخص (و مبلغ برگشت از خرید/پرداخت به او)؛ بستانکار = خرید از شخص (و برگشت از فروش/دریافت از او). مانده = بدهکار − بستانکار.</p></body></html>`;
}
