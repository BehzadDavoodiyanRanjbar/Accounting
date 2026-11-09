/** خروجی ساده: فایل CSV (با BOM برای Excel فارسی) و چاپ جدول در تب جدید */

export interface ExportCol<T> {
  title: string;
  value: (r: T) => string | number | null | undefined;
  numeric?: boolean;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const cell = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadCsv<T>(fileName: string, cols: ExportCol<T>[], rows: T[], foot?: T, notes: string[] = []): void {
  const lines: string[] = [cols.map((c) => cell(c.title)).join(',')];
  rows.forEach((r) => lines.push(cols.map((c) => cell(c.value(r))).join(',')));
  if (foot) lines.push(cols.map((c) => cell(c.value(foot))).join(','));
  if (notes.length) {
    lines.push('');
    notes.forEach((n) => lines.push(cell(n)));
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** چاپ؛ در صورت مسدود بودن پنجرهٔ جدید false برمی‌گرداند */
export function printTable<T>(title: string, sub: string, cols: ExportCol<T>[], rows: T[], foot?: T, notes: string[] = [], landscape = true): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  const td = (c: ExportCol<T>, r: T) => {
    const v = c.value(r);
    const t = v == null || v === '' ? '' : c.numeric && typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : String(v);
    return `<td class="${c.numeric ? 'n' : ''}">${esc(t)}</td>`;
  };
  const html =
    `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@font-face{font-family:'VzFa';src:url('${location.origin}/v2/fonts/Vazirmatn-Regular.ttf?v=15')}@page{size:A4 ${landscape ? 'landscape' : 'portrait'};margin:9mm}body{font-family:'VzFa',Tahoma,sans-serif;font-size:11px;color:#111;padding:8px}h1{font-size:16px;margin:0 0 4px}.m{margin:2px 0}table{border-collapse:collapse;width:100%;margin-top:8px}th,td{border:1px solid #444;padding:3px 5px}th{background:#e4e4e4}td.n{text-align:right;direction:ltr}tfoot td{font-weight:700;background:#f2f2f2}.nt{margin-top:8px;font-size:10px;color:#333}</style></head><body>` +
    `<h1>${esc(title)}</h1><div class="m">${esc(sub)}</div><table><thead><tr>${cols.map((c) => `<th>${esc(c.title)}</th>`).join('')}</tr></thead><tbody>` +
    rows.map((r) => `<tr>${cols.map((c) => td(c, r)).join('')}</tr>`).join('') +
    `</tbody>${foot ? `<tfoot><tr>${cols.map((c) => td(c, foot)).join('')}</tr></tfoot>` : ''}</table>` +
    (notes.length ? `<div class="nt">${notes.map((n) => `<div>• ${esc(n)}</div>`).join('')}</div>` : '') +
    `<script>(document.fonts?document.fonts.ready:Promise.resolve()).then(function(){setTimeout(function(){window.print()},200)})</script></body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
