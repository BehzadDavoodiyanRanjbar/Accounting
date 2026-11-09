import { PRINT_CSS, PRINT_HELPERS_JS, PRINT_SALE_JS, PRINT_VOUCHER_JS } from './legacyAssets';
import { SLM, SLS, SLT, SLX } from '../sales/constants';

const FONT_FACES = () => {
  const o = window.location.origin;
  return `@font-face{font-family:Vazirmatn;font-weight:400;src:url(${o}/v2/fonts/Vazirmatn-Regular.ttf?v=15) format('truetype')}@font-face{font-family:Vazirmatn;font-weight:500;src:url(${o}/v2/fonts/Vazirmatn-Medium.ttf?v=15) format('truetype')}@font-face{font-family:Vazirmatn;font-weight:700;src:url(${o}/v2/fonts/Vazirmatn-Bold.ttf?v=15) format('truetype')}`;
};

/** کد راه‌انداز چاپ فاکتور فروش (در پنجرهٔ چاپ اجرا می‌شود؛ pd/fmt/e و … از PRINT_HELPERS_JS) */
export const PRINT_SALE_BOOT = `${PRINT_SALE_JS}
var SLX=${JSON.stringify(SLX)},SLT=${JSON.stringify(SLT)},SLS=${JSON.stringify(SLS)},SLM=${JSON.stringify(SLM)};
function build(){var all=[];DATA.docs.forEach(function(d){slBuild(d.r,d.co,d.cu);var t=document.createElement('div');t.innerHTML=document.getElementById('pr').innerHTML;[].forEach.call(t.querySelectorAll('.pg'),function(p){all.push(p.outerHTML)})});document.getElementById('pr').innerHTML='<div class="pv">'+all.join('')+'</div>'}`;

export const PRINT_VOUCHER_BOOT = `${PRINT_VOUCHER_JS}
function build(){window.__CO=DATA.co;document.getElementById('pr').innerHTML=DATA.docs.map(function(r){return acPFBuild(r,DATA.L)}).join('')}`;

/** پنجرهٔ خالی را همان لحظهٔ کلیک باز می‌کند تا مرورگر آن را مسدود نکند (چاپ گروهی ممکن است چند ثانیه داده بخواند) */
export function openBlankPrintWindow(): Window | null {
  const w = window.open('', '_blank');
  if (!w) return null;
  w.document.open();
  w.document.write('<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>آماده‌سازی چاپ…</title></head><body style="font-family:Tahoma,sans-serif;padding:30px">در حال آماده‌سازی چاپ، لطفاً صبر کنید…</body></html>');
  w.document.close();
  return w;
}

interface PrintOpts {
  w?: Window | null;
  title: string;
  landscape: boolean;
  data: unknown;
  boot: string;
}

/** پنجرهٔ چاپ جدید با همان قالب و منطق صفحه‌بندی نسخهٔ قبلی برنامه */
export function openPrintWindow(o: PrintOpts): boolean {
  const w = o.w ?? window.open('', '_blank');
  if (!w) return false;
  const json = JSON.stringify(o.data).replace(/</g, '\\u003c').split(String.fromCharCode(0x2028)).join('\\u2028').split(String.fromCharCode(0x2029)).join('\\u2029');
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${o.title.replace(/</g, '&lt;')}</title><style>
${FONT_FACES()}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}html,body{margin:0;padding:0;background:#fff}body{color:#000;font:14px Vazirmatn,Tahoma,sans-serif}
@page{size:A4 ${o.landscape ? 'landscape' : 'portrait'};margin:6mm}
${PRINT_CSS}
.vf+.vf{break-before:page;page-break-before:always}
</style></head><body><div id="pr"></div><script>
function $(s){return document.querySelector(s)}
${PRINT_HELPERS_JS}
var DATA=${json};
${o.boot}
function go(){try{build()}catch(err){document.body.textContent='خطا در ساخت چاپ: '+err.message;return}setTimeout(function(){window.print()},200)}
var fl=document.fonts&&document.fonts.load?[document.fonts.load('400 12px Vazirmatn'),document.fonts.load('700 12px Vazirmatn')]:[];
Promise.all(fl).then(go,go);
</script></body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
