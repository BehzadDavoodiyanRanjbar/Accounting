import { fmtNum, str } from '../../kit/format';
import type { Row } from '../../kit/types';
import { words } from '../accounting/voucherPrint';
import { payDetail } from './common';

const FA = (x: unknown) => str(x).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const esc = (s: unknown) => str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const m = (x: unknown) => FA(fmtNum(x));

const party = (title: string, P: Row) => {
  const w = (l: string, v: unknown) => (v ? `<div><b>${l}:</b> ${esc(FA(v))}</div>` : '<div></div>');
  const adr = P.Address ? `<div class="w"><b>آدرس:</b> ${esc(FA(P.Address))}${P.Phone || P.Mobile ? ` - <b>تلفن:</b> ${esc(FA(P.Phone || P.Mobile))}` : ''}</div>` : P.Phone || P.Mobile ? `<div class="w"><b>تلفن:</b> ${esc(FA(P.Phone || P.Mobile))}</div>` : '';
  return `<div class="pt"><div class="sd">${title}</div><div class="bd"><div><b>${title}:</b> ${esc(P.Name)}</div>${w('کد اقتصادی', P.EconomicCode)}${w('شماره ثبت', P.RegNo)}${w('شناسه ملی', P.NationalID)}${w('کدپستی', P.PostalCode)}<div><b>شهر:</b> ${esc(P.City)}</div><div><b>استان:</b> ${esc(P.Province)} &nbsp; <b>کشور:</b> ایران</div>${adr}</div></div>`;
};

/** چاپ فاکتور خرید / برگشت از خرید (A4 افقی) در پنجرهٔ جدید */
export const INVOICE_CSS = `@page{size:A4 landscape;margin:6mm}
body{font-family:Tahoma,'Vazirmatn',sans-serif;font-size:9pt;margin:0;color:#000}
.top{display:flex;justify-content:space-between;align-items:center;border:1px solid #000;padding:6px 10px;margin-bottom:4px}.ti{font-size:15pt}
.pt{display:flex;border:1px solid #000;margin-bottom:4px}.sd{writing-mode:vertical-rl;transform:rotate(180deg);background:#eee;padding:4px;text-align:center;border-inline-start:1px solid #000;font-weight:bold}
.bd{flex:1;display:grid;grid-template-columns:repeat(4,1fr);gap:2px 8px;padding:4px 8px}.bd .w{grid-column:1/-1}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:2px 4px;text-align:center}th{background:#eee}td.nm{text-align:start}
.pb h4{margin:6px 0 2px}.bt2{display:flex;gap:8px;margin-top:6px}.tt{width:260px}.tt td:first-child{text-align:start}.tt tr.g td{font-weight:bold;background:#eee}
.wd{border:1px solid #000;padding:4px}.nt{margin-top:4px}.cb{margin-top:4px}.cb span{margin-inline-start:14px}.cb i{display:inline-block;width:12px;height:12px;border:1px solid #000;margin-inline-end:3px;text-align:center;line-height:12px;font-style:normal}
.sg{display:flex;justify-content:space-around;margin-top:26px}.sg div{border-top:1px solid #000;padding:4px 40px}
thead{display:table-header-group}tr{page-break-inside:avoid}
.doc{page-break-after:always;break-after:page}.doc:last-child{page-break-after:auto;break-after:auto}
`;

function invoiceSection(r: Row, company: Row, supplier: Row, nameOf: (id: string) => string): { title: string; html: string } {
  const ret = r.DocType === 'return';
  const items: Row[] = r.items ?? [];
  const costs: Row[] = r.costs ?? [];
  const pays: Row[] = r.payments ?? [];
  const fr = Math.round((Number(r.PayableTotal) - Math.floor(Number(r.PayableTotal))) * 100);
  const wd = `${words(Number(r.PayableTotal))} ریال${fr ? ` و ${words(fr)} صدم ریال` : ''}`;
  const cash = Number(r.Remaining) < 0.005;
  const tr2 = (l: string, v: unknown, c = '') => `<tr class="${c}"><td>${l}</td><td>${m(v)} ریال</td></tr>`;
  const rows = items.map((i, k) => `<tr><td>${FA(k + 1)}</td><td class="nm">${esc(nameOf(str(i.ProductID)))}</td><td>${m(i.Quantity)}</td><td>${esc(i.Unit)}</td><td>${m(i.UnitPrice)}</td><td>${m(i.Gross)}</td><td>${m(i.Discount)}</td><td>${m(i.VAT)}</td><td>${m(i.LineTotal)}</td></tr>`).join('');
  const cs = costs.length
    ? `<div class="pb"><h4>هزینه‌های جانبی</h4><table><tr><th>ردیف</th><th>نوع</th><th>توضیحات</th><th>مبلغ (ریال)</th><th>مالیات (ریال)</th><th>جمع (ریال)</th></tr>${costs.map((c, k) => `<tr><td>${FA(k + 1)}</td><td>${esc(c.CostType)}</td><td class="nm">${esc(FA([c.Payee, c.Description].filter(Boolean).join(' - ')))}</td><td>${m(c.Amount)}</td><td>${m(c.VAT)}</td><td>${m(c.Total)}</td></tr>`).join('')}</table></div>`
    : '';
  const py = pays.length
    ? `<div class="pb"><h4>اطلاعات پرداخت</h4><table><tr><th>ردیف</th><th>تاریخ</th><th>روش پرداخت</th><th>مبلغ (ریال)</th><th>جزئیات</th></tr>${pays.map((p, k) => `<tr><td>${FA(k + 1)}</td><td>${FA(p.DateJalali)}</td><td>${esc(p.Method)}</td><td>${m(p.Amount)}</td><td class="nm">${esc(FA(payDetail(p)))}</td></tr>`).join('')}</table></div>`
    : '';
  const html = `<div class="top"><div></div><div class="ti"><b>${ret ? 'فاکتور برگشت از خرید' : 'فاکتور خرید'}</b></div><div>شماره: <b>${esc(FA(r.InvoiceNo))}</b><br>تاریخ: <b>${esc(FA(r.DateJalali))}</b></div></div>
${party('فروشنده', supplier)}${party('خریدار', company)}
<table><thead><tr><th>#</th><th>شرح</th><th>تعداد</th><th>واحد</th><th>مبلغ واحد<br>(ریال)</th><th>مبلغ<br>(ریال)</th><th>تخفیف<br>(ریال)</th><th>مالیات<br>(ریال)</th><th>مبلغ کل<br>(ریال)</th></tr></thead><tbody>${rows}</tbody></table>
${cs}
<div class="bt2"><table class="tt">${tr2('مجموع پس از تخفیف', r.TotalAfterDiscount)}${tr2('مالیات', r.TotalVAT)}${Number(r.TotalCosts) ? tr2('هزینه‌های جانبی', r.TotalCosts) : ''}${tr2('مبلغ کل', r.PayableTotal, 'g')}${tr2('پرداخت‌شده', r.TotalPaid)}${tr2(`مانده (${esc(r.PayStatus)})`, r.Remaining)}</table>
<div style="flex:1"><div class="wd">مبلغ کل: ${esc(wd)}</div><div class="cb">شرایط و نحوه فروش <span><i>${cash ? '✓' : ''}</i>نقدی</span><span><i>${cash ? '' : '✓'}</i>غیرنقدی</span></div>${r.Notes ? `<div class="nt"><b>توضیحات:</b> ${esc(FA(r.Notes))}</div>` : ''}</div></div>
${py}
<div class="sg"><div>مهر و امضاء فروشنده</div><div>مهر و امضاء خریدار</div></div>`;
  return { title: `${ret ? 'برگشت از خرید' : 'فاکتور خرید'} ${esc(r.InvoiceNo)}`, html };
}

export interface InvoicePrintDoc {
  r: Row;
  company: Row;
  supplier: Row;
}

/** چاپ یک یا چند فاکتور خرید در یک پنجره؛ هر فاکتور از صفحهٔ جدید شروع می‌شود */
export function printInvoices(docs: InvoicePrintDoc[], nameOf: (id: string) => string, w?: Window | null): boolean {
  const win = w ?? window.open('', '_blank');
  if (!win) return false;
  const secs = docs.map((d) => invoiceSection(d.r, d.company, d.supplier, nameOf));
  const title = secs.length === 1 ? secs[0].title : `چاپ ${secs.length} فاکتور خرید`;
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${title}</title><style>${INVOICE_CSS}</style></head><body>
${secs.map((x) => `<div class="doc">${x.html}</div>`).join('\n')}
<script>setTimeout(function(){window.print()},300)</script></body></html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}

export const printInvoice = (r: Row, company: Row, supplier: Row, nameOf: (id: string) => string): boolean => printInvoices([{ r, company, supplier }], nameOf);
