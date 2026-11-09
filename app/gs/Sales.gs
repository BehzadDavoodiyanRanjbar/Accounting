/* ماژول فاکتور فروش، موجودی کالا و آماده‌سازی برای سامانه مؤدیان
   مبنای قواعد: «دستورالعمل صدور صورتحساب الکترونیکی» نسخه 7.9 (RC_IITP.IS_V7.9 - تیر 1405)
   توجه: ارسال مستقیم به سامانه مؤدیان در این نسخه فعال نیست (نیاز به سند پروتکل ارسال و الگوریتم
   رقم کنترلی شماره مالیاتی). خروجی JSON ساخته می‌شود و وضعیت ارسال دستی ثبت می‌شود. */

var SL_PATTERNS = {1: 'فروش', 2: 'فروش ارز', 4: 'قرارداد پیمانکاری', 5: 'قبوض خدماتی', 6: 'بلیط هواپیما', 8: 'بارنامه', 11: 'بورس اوراق بهادار مبتنی بر کالا', 13: 'فروش خدمات بیمه‌ای'};
var SL_TYPE2_PATTERNS = [1, 3, 9, 13];
var SL_SUBJECTS = {1: 'اصلی', 2: 'اصلاحی', 3: 'ابطالی', 4: 'برگشت از فروش'};
var SL_STATUSES = ['پیش‌نویس', 'آماده ارسال', 'ارسال‌شده', 'تأییدشده', 'ردشده'];
var SL_LOCKED = ['ارسال‌شده', 'تأییدشده'];
/* فیلدهای اختصاصی الگو که در ستون Extra سربرگ ذخیره می‌شود */
var SL_HDR_X = {
  4: ['crn'], 5: ['billid'], 6: ['ft', 'bpn', 'tinc'],
  8: ['lno', 'lrno', 'ocu', 'oci', 'dco', 'dci', 'tid', 'rid', 'lt', 'cno', 'did', 'sg'],
  11: ['asn', 'asd'], 13: ['in', 'an'], 2: []
};
var SL_ALL_HDR_X = ['crn', 'billid', 'ft', 'bpn', 'tinc', 'lno', 'lrno', 'ocu', 'oci', 'dco', 'dci', 'tid', 'rid', 'lt', 'cno', 'did', 'sg', 'asn', 'asd', 'in', 'an', 'tob', 'bid', 'tinb', 'bpc', 'bbc', 'sbc', 'insr', 'indati2m', 'n1', 'n2', 'tax17', 'seller'];
var SL_LINE_X = ['unit', 'cut', 'cfee', 'exr', 'cpr', 'sovat', 'nw', 'cui', 'vba', 'serials'];

/* ===== محاسبات (طبق جداول 15 تا 28 و 40 تا 53 دستورالعمل؛ مقادیر ریالی با قطع کردن) ===== */
function sl_n_(x) { var v = Number(fa2en_(String(x == null ? '' : x)).replace(/[,\s]/g, '')); return isNaN(v) ? 0 : v; }
function sl_trunc_(x) { x = Math.round(x * 1e4) / 1e4; return x >= 0 ? Math.floor(x + 1e-9) : Math.ceil(x - 1e-9); }
function sl_line_(inp, l) {
  var am = sl_n_(l.Am), fee = sl_n_(l.Fee), dis = sl_trunc_(sl_n_(l.Dis)), vra = sl_n_(l.Vra);
  var prdis;
  if (inp === 2) prdis = sl_trunc_(sl_n_(l.cfee) * sl_n_(l.exr));
  else if (inp === 6) prdis = sl_trunc_(fee);
  else prdis = sl_trunc_(am * fee);
  var adis = prdis - dis;
  var vam = inp === 2 ? sl_trunc_(sl_n_(l.sovat) * vra / 100) : sl_trunc_(adis * vra / 100);
  var odr = sl_n_(l.Odr), olr = sl_n_(l.Olr);
  var odam = l.Odam !== '' && l.Odam != null ? sl_trunc_(sl_n_(l.Odam)) : sl_trunc_(adis * odr / 100);
  var olam = l.Olam !== '' && l.Olam != null ? sl_trunc_(sl_n_(l.Olam)) : sl_trunc_(adis * olr / 100);
  return {Am: am, Fee: fee, Prdis: prdis, Dis: dis, Adis: adis, Vra: vra, Vam: vam, Odam: odam, Olam: olam, Tsstam: adis + vam + odam + olam};
}
function sl_calc_(inp, items) {
  var T = {Tprdis: 0, Tdis: 0, Tadis: 0, Tvam: 0, Todam: 0, Tbill: 0}, out = [];
  (items || []).forEach(function (l) {
    var c = sl_line_(inp, l);
    out.push(c);
    T.Tprdis += c.Prdis; T.Tdis += c.Dis; T.Tadis += c.Adis; T.Tvam += c.Vam; T.Todam += c.Odam + c.Olam; T.Tbill += c.Tsstam;
  });
  return {lines: out, totals: T};
}

/* ===== شماره مالیاتی (بخش‌های قابل استخراج؛ رقم کنترلی طبق سند SN.DCPS_RC است که هنوز در دسترس نیست) ===== */
function sl_hex_(n, len) { var s = Math.floor(n).toString(16).toUpperCase(); while (s.length < len) s = '0' + s; return s; }
function sl_days_(gIso, hm) { return Math.floor(sl_unixMs_(gIso, hm) / 864e5); }
function sl_taxPrefix_(memId, gIso, serial, hm) {
  if (!memId || !gIso || !/^\d+$/.test(String(serial))) return '';
  return String(memId).toUpperCase() + sl_hex_(sl_days_(gIso, hm), 5) + sl_hex_(Number(serial), 10);
}
/* زمان یونیکس (میلی‌ثانیه) برای تاریخ میلادی و ساعت به وقت تهران (UTC+03:30) */
function sl_unixMs_(gIso, hm) {
  var p = gIso.split('-'), t = String(hm || '12:00').split(':');
  return Date.UTC(+p[0], +p[1] - 1, +p[2], +t[0] || 0, +t[1] || 0, 0) - (3.5 * 3600 * 1000);
}

/* ===== اعتبارسنجی بر اساس قواعد سند ===== */
function sl_validate_(s, ctx) {
  var E = [], W = [], h = s.h, x = h.x || {}, items = s.items || [], inp = Number(h.Inp), ins = Number(h.Ins), inty = Number(h.Inty);
  var co = ctx.company || {}, cu = ctx.customer || {}, ref = ctx.ref;
  var digits = function (v, re) { return re.test(String(v == null ? '' : v)); };
  if (!SL_PATTERNS[inp]) E.push('الگوی صورتحساب نامعتبر است.');
  if (!(inty >= 1 && inty <= 3)) E.push('نوع صورتحساب نامعتبر است.');
  if (inty === 2 && SL_TYPE2_PATTERNS.indexOf(inp) < 0) E.push('الگوی «' + (SL_PATTERNS[inp] || inp) + '» برای صورتحساب نوع دوم مجاز نیست (فقط الگوهای اول، سوم، نهم و سیزدهم).');
  if (!SL_SUBJECTS[ins]) E.push('موضوع صورتحساب نامعتبر است.');
  if ([8, 11].indexOf(inp) >= 0 && ins === 4) E.push('در الگوی بارنامه و بورس، موضوع «برگشت از فروش» وجود ندارد.');
  /* فروشنده */
  if (!digits(co.EconomicCode, /^(\d{11}|\d{14})$/)) E.push('کد اقتصادی فروشنده (شرکت) باید ۱۱ یا ۱۴ رقم باشد.');
  if (!co.TaxMemoryID) W.push('شناسه یکتای حافظه مالیاتی شرکت ثبت نشده است (برای ساخت شماره مالیاتی لازم است).');
  else if (String(co.TaxMemoryID).length !== 6) E.push('شناسه یکتای حافظه مالیاتی باید ۶ کاراکتر باشد.');
  /* تاریخ و سریال */
  if (!h.DateGregorian) E.push('تاریخ صدور نامعتبر است.');
  else if (ctx.nowIso && h.DateGregorian > ctx.nowIso) E.push('تاریخ صدور نمی‌تواند از امروز بزرگ‌تر باشد.');
  if (!/^\d{1,2}:\d{2}$/.test(String(h.TimeHM || ''))) E.push('ساعت صدور را به صورت 14:30 وارد کنید.');
  if (!/^\d+$/.test(String(h.SerialNo || ''))) E.push('سریال صورتحساب باید عدد باشد.');
  else if (Number(h.SerialNo) > 0xFFFFFFFFFF) E.push('سریال صورتحساب بیش از ظرفیت ۱۰ رقم هگزادسیمال است.');
  /* خریدار */
  var needBuyer = inty === 1 && ins === 1 && inp !== 11;
  var tob = Number(x.tob || cu.PersonType || 0);
  if (needBuyer) {
    if (!cu.CustomerID) E.push('مشتری (خریدار) انتخاب نشده است.');
    else {
      var eco = x.tinb || cu.EconomicCode, bid = x.bid || cu.NationalID, bpc = x.bpc || cu.PostalCode;
      if (tob === 2 || tob === 3) {
        if (!digits(eco, /^(\d{11}|\d{14})$/)) E.push('برای خریدار حقوقی/مشارکت مدنی، کد اقتصادی (۱۱ یا ۱۴ رقم) الزامی است.');
      } else if (tob === 1 || tob === 4) {
        if (!digits(eco, /^(\d{11}|\d{14})$/) && !(bid && bpc)) E.push('برای خریدار حقیقی/اتباع، کد اقتصادی یا (شماره ملی/کد فراگیر + کد پستی) الزامی است.');
        if (inp === 2 && !bid) E.push('در فروش ارز، برای خریدار حقیقی/اتباع، شماره ملی یا کد فراگیر الزامی است.');
        if (inp === 2 && tob === 4 && !bid && !x.bpn) E.push('در فروش ارز، برای اتباع بدون کد فراگیر، شماره گذرنامه الزامی است.');
      } else E.push('نوع شخص خریدار (حقیقی، حقوقی، مشارکت مدنی، اتباع) مشخص نیست.');
    }
  }
  if (inty === 2 && h.Setm && Number(h.Setm) !== 1) E.push('در صورتحساب نوع دوم، روش تسویه نقدی است.');
  /* ارجاعی */
  if (ins >= 2) {
    if (!h.RefTaxID && !(ref && ref.TaxNo)) E.push('برای موضوع اصلاحی/ابطالی/برگشت از فروش، شماره مالیاتی صورتحساب مرجع الزامی است.');
    else if (h.RefTaxID && String(h.RefTaxID).length !== 22) E.push('شماره مالیاتی مرجع باید ۲۲ کاراکتر باشد.');
    if (ref) {
      if (Number(ref.Ins) === 3) E.push('صورتحساب ابطالی را نمی‌توان مرجع قرار داد.');
      if (Number(ref.Inp) !== inp || Number(ref.Inty) !== inty) E.push('نوع و الگوی صورتحساب ارجاعی باید با مرجع یکسان باشد.');
      if (ref.DateGregorian && h.DateGregorian && h.DateGregorian < ref.DateGregorian) E.push('تاریخ صورتحساب ارجاعی نمی‌تواند قبل از مرجع باشد.');
      if (SL_LOCKED.indexOf(ref.SendStatus) < 0) W.push('صورتحساب مرجع هنوز در وضعیت «ارسال‌شده/تأییدشده» نیست.');
    } else if (!h.RefSaleID) W.push('مرجع در این سامانه انتخاب نشده است؛ کنترل تطابق اقلام انجام نشد.');
  }
  /* اقلام */
  if (ins !== 3 && !items.length) E.push('حداقل یک ردیف کالا/خدمت لازم است.');
  var calc = sl_calc_(inp, items);
  items.forEach(function (l, i) {
    var k = 'ردیف ' + (i + 1) + ': ', c = calc.lines[i];
    if (!l.ProductID) W.push(k + 'کالا از فهرست انتخاب نشده است (موجودی کسر نمی‌شود).');
    if (!digits(l.Sstid, /^\d{13}$/)) E.push(k + 'شناسه کالا/خدمت باید ۱۳ رقم باشد.');
    if (String(l.Sstt || '').length > 400) E.push(k + 'شرح کالا بیش از ۴۰۰ کاراکتر است.');
    if (!(c.Am > 0)) E.push(k + 'تعداد/مقدار باید بزرگ‌تر از صفر باشد.');
    if (Math.abs(c.Am * 1e8 - Math.round(c.Am * 1e8)) > 1e-3) E.push(k + 'تعداد/مقدار حداکثر ۸ رقم اعشار دارد.');
    if ((inp === 6 || inp === 8) && c.Am !== 1) E.push(k + 'در الگوی بلیط هواپیما/بارنامه، تعداد هر ردیف باید ۱ باشد.');
    if (inp !== 2 && !(c.Fee > 0)) E.push(k + 'مبلغ واحد باید بزرگ‌تر از صفر باشد.');
    if (!(c.Prdis > 0)) E.push(k + 'مبلغ قبل از تخفیف باید بزرگ‌تر از صفر باشد.');
    if (c.Dis < 0 || c.Dis > c.Prdis) E.push(k + 'تخفیف باید بین صفر و مبلغ قبل از تخفیف باشد.');
    if (c.Vra < 0 || c.Vra > 100) E.push(k + 'نرخ مالیات نامعتبر است.');
    if (inp === 11 && c.Vra !== 0) E.push(k + 'در الگوی بورس، نرخ مالیات بر ارزش افزوده صفر است.');
    if (Math.abs(sl_n_(l.Fee) - Math.round(sl_n_(l.Fee))) > 1e-9 && sl_n_(l.Fee) > 0) W.push(k + 'مبلغ واحد اعشاری است؛ مبالغ ریالی با قطع اعشار محاسبه می‌شوند.');
    if (inp === 2) {
      var lab = {cut: 'نوع ارز', cfee: 'میزان ارز', exr: 'نرخ برابری ارز با ریال', cpr: 'نرخ خرید ارز', sovat: 'مأخذ مالیات بر ارزش افزوده'};
      Object.keys(lab).forEach(function (f) {
        var miss = f === 'cut' ? !String(l.cut || '').trim() : !(sl_n_(l[f]) > 0);
        if (miss) E.push(k + 'در فروش ارز، فیلد «' + lab[f] + '» الزامی است.');
      });
    }
  });
  if ((inp === 11) && items.length > 1) E.push('در الگوی بورس فقط یک ردیف مجاز است.');
  /* قواعد اختصاصی الگو */
  var need = function (f, label) { if (x[f] == null || String(x[f]).trim() === '') E.push('فیلد «' + label + '» در این الگو الزامی است.'); };
  if (inp === 4) { need('crn', 'شماره قرارداد پیمانکاری'); if (x.crn && !digits(x.crn, /^\d{1,12}$/)) E.push('شماره قرارداد پیمانکاری حداکثر ۱۲ رقم عددی است.'); }
  if (inp === 5) { need('billid', 'شماره اشتراک/شناسه قبض'); if (x.billid && !digits(x.billid, /^\d{1,19}$/)) E.push('شناسه قبض حداکثر ۱۹ رقم عددی است.'); }
  if (inp === 6) { need('ft', 'نوع پرواز'); if (x.ft && [1, 2].indexOf(Number(x.ft)) < 0) E.push('نوع پرواز: ۱ داخلی، ۲ خارجی.'); }
  if (inp === 8) {
    [['lno', 'شماره بارنامه'], ['ocu', 'کشور مبدأ'], ['dco', 'کشور مقصد'], ['tid', 'شناسه ملی فرستنده'], ['rid', 'شناسه ملی گیرنده'], ['lt', 'نوع بارنامه/حمل'], ['cno', 'شماره ناوگان']].forEach(function (a) { need(a[0], a[1]); });
    var sg = x.sg || [];
    if (!sg.length) E.push('در بارنامه، فهرست کالاهای حمل‌شده الزامی است.');
    sg.forEach(function (g, i) { if (!g.sgid || !g.sgt) E.push('کالای حمل‌شده ' + (i + 1) + ': شناسه و شرح الزامی است.'); });
  }
  if (inp === 11) { need('asn', 'شماره اعلامیه فروش بورس'); need('asd', 'تاریخ اعلامیه فروش بورس'); }
  if (inp === 13) need('in', 'شناسه یکتای بیمه‌نامه');
  /* تسویه */
  var T = calc.totals, setm = Number(h.Setm);
  if (ins !== 3) {
    if ([1, 2, 3].indexOf(setm) < 0) E.push('روش تسویه نامعتبر است (۱ نقدی، ۲ نسیه، ۳ نقدی/نسیه).');
    if (setm === 3) {
      var cap = sl_n_(h.Cap), insp = sl_n_(h.Insp);
      if (!(cap > 0) || !(insp > 0)) E.push('در روش نقدی/نسیه، مبلغ نقدی و مبلغ نسیه هر دو باید بزرگ‌تر از صفر باشند.');
      if (cap + insp > T.Tbill) E.push('مجموع مبلغ نقدی و نسیه از مجموع صورتحساب بیشتر است.');
      if (cap > 0 && insp > 0 && cap + insp !== T.Tadis + T.Todam) W.push('طبق سند، مبلغ نقدی = مجموع صورتحساب − مالیات − سایر مالیات‌ها − نسیه؛ مجموع نقدی و نسیه (' + (cap + insp) + ') با مبلغ مبنا (' + (T.Tbill - T.Tvam - T.Todam) + ') برابر نیست.');
    }
  }
  /* برگشت از فروش و اصلاحی نسبت به مرجع */
  if (ref && ctx.refItems && (ins === 4 || ins === 2)) {
    items.forEach(function (l, i) {
      var k = 'ردیف ' + (i + 1) + ': ', r = ctx.refItems.filter(function (z) { return String(z.Sstid) === String(l.Sstid); })[0];
      if (!r) { E.push(k + 'شناسه کالا/خدمت در صورتحساب مرجع وجود ندارد (افزودن ردیف جدید در اصلاحی/برگشت مجاز نیست).'); return; }
      if (ins === 4 && sl_n_(l.Am) > Number(r.Am) + 1e-9) E.push(k + 'مقدار برگشتی از مقدار صورتحساب مرجع بیشتر است.');
      if (ins === 4 && Number(l.Vra) !== Number(r.Vra)) E.push(k + 'نرخ مالیات در برگشت از فروش قابل تغییر نیست.');
      if (ins === 4 && Math.abs(sl_n_(l.Fee) - Number(r.Fee)) > 1e-6) W.push(k + 'مبلغ واحد با مرجع متفاوت است؛ مبالغ کالا در برگشت از فروش نباید تغییر کند.');
      if (ins === 2 && Number(l.Vra) !== Number(r.Vra)) E.push(k + 'نرخ مالیات در صورتحساب اصلاحی قابل تغییر نیست.');
    });
  }
  return {errors: E, warnings: W, calc: calc};
}

/* ===== ساخت JSON مؤدیان (سرآمد، بدنه، اطلاعات پرداخت) ===== */
function sl_clean_(o) {
  var r = {};
  Object.keys(o).forEach(function (k) { var v = o[k]; if (v !== undefined && v !== null && v !== '') r[k] = v; });
  return r;
}
function sl_buildJson_(s, ctx) {
  var h = s.h, x = h.x || {}, inp = Number(h.Inp), ins = Number(h.Ins), inty = Number(h.Inty), co = ctx.company || {}, cu = ctx.customer || {};
  var calc = sl_calc_(inp, s.items), T = calc.totals;
  var ms = sl_unixMs_(h.DateGregorian, h.TimeHM);
  var header = {
    taxid: h.TaxNo || undefined,
    indatim: ms, inty: inty, inno: sl_hex_(Number(h.SerialNo), 10), irtaxid: ins >= 2 ? (h.RefTaxID || (ctx.ref && ctx.ref.TaxNo) || '') : '',
    inp: ins === 3 ? undefined : inp, ins: ins, tins: co.EconomicCode, sbc: co.BranchCode || ''
  };
  if (x.indati2m) { header.indati2m = x.indati2m; header.insr = 1; }
  if (ins === 1 && inty === 1 && inp !== 11 || (inp === 11 && cu.CustomerID)) {
    var tob = Number(x.tob || cu.PersonType || 0);
    header.tob = tob; header.tinb = x.tinb || cu.EconomicCode; header.bid = x.bid || cu.NationalID;
    header.bpc = x.bpc || cu.PostalCode; header.bbc = x.bbc || cu.BranchCode;
    if (tob === 2 || tob === 3) delete header.bid;
    if (x.bpn || cu.PassportNo) header.bpn = x.bpn || cu.PassportNo;
  }
  if (ins !== 3) {
    header.tprdis = T.Tprdis; header.tdis = T.Tdis; header.tadis = T.Tadis; header.tvam = T.Tvam; header.todam = T.Todam; header.tbill = T.Tbill;
    header.setm = Number(h.Setm);
    if (Number(h.Setm) === 3) { header.cap = sl_n_(h.Cap); header.insp = sl_n_(h.Insp); }
    if (x.tax17) header.tax17 = sl_n_(x.tax17);
    (SL_HDR_X[inp] || []).forEach(function (f) { if (f === 'sg') return; header[f] = x[f]; });
    if (inp === 8) header.sg = (x.sg || []).map(function (g) { return {sgid: g.sgid, sgt: g.sgt}; });
    if (inp === 2) { header.torv = 0; }
  }
  if (x.n1) header['1nti'] = x.n1;
  if (x.n2) header['2nti'] = x.n2;
  var body = [];
  if (ins !== 3) s.items.forEach(function (l, i) {
    var c = calc.lines[i];
    body.push(sl_clean_({
      sstid: String(l.Sstid), sstt: l.Sstt, am: c.Am, mu: l.Mu, fee: inp === 2 ? undefined : c.Fee,
      cut: l.cut, cfee: l.cfee ? sl_n_(l.cfee) : undefined, exr: l.exr ? sl_n_(l.exr) : undefined, cpr: l.cpr ? sl_n_(l.cpr) : undefined,
      sovat: l.sovat ? sl_n_(l.sovat) : undefined, nw: l.nw ? sl_n_(l.nw) : undefined,
      prdis: c.Prdis, dis: c.Dis, adis: c.Adis, vra: c.Vra, vam: c.Vam,
      odt: l.Odt, odr: l.Odr !== '' && l.Odr != null ? sl_n_(l.Odr) : undefined, odam: c.Odam || (l.Odt ? 0 : undefined),
      olt: l.Olt, olr: l.Olr !== '' && l.Olr != null ? sl_n_(l.Olr) : undefined, olam: c.Olam || (l.Olt ? 0 : undefined),
      tsstam: c.Tsstam
    }));
  });
  return {header: sl_clean_(header), body: body, payments: []};
}

/* ===== دسترسی به شیت‌ها ===== */
function sl_parseX_(s) { try { return s ? JSON.parse(s) : {}; } catch (e) { return {}; } }
function sl_hdrOut_(r) {
  var o = Object.assign({}, r);
  o.x = sl_parseX_(r.Extra);
  delete o.Extra;
  return o;
}
function sl_itemOut_(r) {
  var o = Object.assign({}, r), x = sl_parseX_(r.Extra);
  Object.keys(x).forEach(function (k) { o[k] = x[k]; });
  delete o.Extra;
  return o;
}
function sl_serialNext_(co) {
  var mx = 0;
  rows_('SalesInvoices').forEach(function (r) { if (r.CompanyID === co) { var n = Number(r.SerialNo); if (n > mx) mx = n; } });
  if (mx) return String(mx + 1);
  var st = getSet_('SaleSerialStart_' + co) || getSet_('SaleSerialStart');
  return st || '1';
}
function sl_defaults_(p) {
  var now = new Date(), g = Utilities.formatDate(now, TZ, 'yyyy-MM-dd'), parts = g.split('-').map(Number), j = g2j_(parts[0], parts[1], parts[2]);
  var pad = function (v) { return ('0' + v).slice(-2); };
  return {serial: sl_serialNext_(p.company), dateJalali: j[0] + '/' + pad(j[1]) + '/' + pad(j[2]), time: Utilities.formatDate(now, TZ, 'HH:mm'), vat: vat_(p.company)};
}
function sl_load_(id) {
  var h = rows_('SalesInvoices').filter(function (r) { return r.SaleID === id; })[0];
  if (!h) throw new Error('فاکتور فروش پیدا نشد.');
  var out = sl_hdrOut_(h);
  var is = sh_('SalesItems'), ids = sl_cols_('SalesItems', ['SaleID']).SaleID, i0 = ids.indexOf(id), items = [];
  if (i0 >= 0) {
    var i1 = ids.lastIndexOf(id), hh = H.SalesItems, blk = is.getRange(i0 + 2, 1, i1 - i0 + 1, hh.length).getValues();
    blk.forEach(function (r) { if (r[1] === id) { var o = {}; hh.forEach(function (k, i) { o[k] = r[i]; }); items.push(o); } });
  }
  out.items = items.sort(function (a, b) { return a.LineNo - b.LineNo; }).map(sl_itemOut_);
  return out;
}
function sl_ctx_(p, ref) {
  var cos = rows_('Companies').filter(function (c) { return c.CompanyID === p.CompanyID; })[0] || {};
  var cu = p.CustomerID ? (rows_('Customers').filter(function (c) { return c.CustomerID === p.CustomerID; })[0] || {}) : {};
  var now = new Date();
  return {company: cos, customer: cu, ref: ref || null, refItems: ref ? ref.items : null, nowIso: Utilities.formatDate(now, TZ, 'yyyy-MM-dd')};
}
function sl_normalize_(p) {
  var j = parseJ_(p.DateJalali);
  var h = {
    SaleID: p.SaleID || '', CompanyID: p.CompanyID, CustomerID: p.CustomerID || '', SerialNo: String(fa2en_(p.SerialNo || '')).trim(),
    DateJalali: j ? j.j : '', DateGregorian: j ? j.g : '', TimeHM: fa2en_(p.TimeHM || ''), Inty: Number(p.Inty) || 1, Inp: Number(p.Inp) || 1,
    Ins: Number(p.Ins) || 1, RefSaleID: p.RefSaleID || '', RefTaxID: String(p.RefTaxID || '').trim().toUpperCase(),
    Setm: Number(p.Setm) || 1, Cap: sl_n_(p.Cap), Insp: sl_n_(p.Insp), Notes: p.Notes || '', x: {}
  };
  var src = p.x || {};
  SL_ALL_HDR_X.forEach(function (k) { if (src[k] !== undefined && src[k] !== '') h.x[k] = src[k]; });
  var items = (p.items || []).map(function (l) {
    var o = {ProductID: l.ProductID || '', Sstid: String(fa2en_(l.Sstid || '')).trim(), Sstt: l.Sstt || '', Mu: String(l.Mu || ''), Am: sl_n_(l.Am), Fee: sl_n_(l.Fee), Dis: sl_n_(l.Dis),
      Vra: sl_n_(l.Vra), Odt: l.Odt || '', Odr: l.Odr === '' || l.Odr == null ? '' : sl_n_(l.Odr), Odam: l.Odam === '' || l.Odam == null ? '' : sl_n_(l.Odam),
      Olt: l.Olt || '', Olr: l.Olr === '' || l.Olr == null ? '' : sl_n_(l.Olr), Olam: l.Olam === '' || l.Olam == null ? '' : sl_n_(l.Olam)};
    SL_LINE_X.forEach(function (k) { if (l[k] !== undefined && l[k] !== '') o[k] = l[k]; });
    if (o.serials !== undefined) { var sn = rp_serials_(o.serials); if (sn.length) o.serials = sn.join('\n'); else delete o.serials; }
    return o;
  });
  return {h: h, items: items};
}
function saveSale_(p) {
  if (!p.CompanyID) throw new Error('شرکت انتخاب نشده است.');
  var s = sl_normalize_(p);
  if (!s.h.DateGregorian) throw new Error('تاریخ شمسی نامعتبر است (قالب: 1405/07/09).');
  if (!s.h.SerialNo) throw new Error('سریال صورتحساب الزامی است.');
  s.items.forEach(function (l, i) {
    if (!l.serials) return; var sn = rp_serials_(l.serials), seen = {};
    if (sn.length > l.Am + 1e-9) throw new Error('ردیف ' + (i + 1) + ': تعداد شماره سریال‌ها (' + sn.length + ') از تعداد کالا (' + l.Am + ') بیشتر است.');
    sn.forEach(function (x) { if (seen[x]) throw new Error('ردیف ' + (i + 1) + ': سریال «' + x + '» تکراری وارد شده است.'); seen[x] = 1; });
  });
  return locked_(function () {
    var ss = sh_('SalesInvoices'), id = s.h.SaleID, now = nowStr_(), old = null;
    if (id) {
      old = sl_load_(id);
      if (SL_LOCKED.indexOf(old.SendStatus) >= 0) throw new Error('این صورتحساب ارسال/تأیید شده و قابل ویرایش نیست. برای تغییر، صورتحساب اصلاحی، ابطالی یا برگشت از فروش صادر کنید.');
    }
    var dup = rows_('SalesInvoices').filter(function (r) { return r.CompanyID === s.h.CompanyID && String(r.SerialNo) === s.h.SerialNo && r.SaleID !== id; });
    if (dup.length) throw new Error('سریال ' + s.h.SerialNo + ' قبلاً برای این شرکت ثبت شده است.');
    var ref = null;
    if (s.h.Ins >= 2) {
      if (!s.h.RefSaleID) { /* مرجع خارج از سامانه */ }
      else {
        ref = sl_load_(s.h.RefSaleID);
        if (ref.CompanyID !== s.h.CompanyID) throw new Error('مرجع متعلق به شرکت دیگری است.');
        if (String(ref.Superseded) === '1' && (!old || old.RefSaleID !== ref.SaleID)) throw new Error('این صورتحساب قبلاً اصلاح یا ابطال شده است.');
        if (!s.h.RefTaxID && ref.TaxNo) s.h.RefTaxID = ref.TaxNo;
        if (s.h.Ins === 3 && !s.items.length) s.items = ref.items.map(function (l) { return Object.assign({}, l); });
        if (s.h.Ins === 3) { s.h.Inp = ref.Inp; s.h.Inty = ref.Inty; s.h.CustomerID = ref.CustomerID; }
      }
    }
    var ctx = sl_ctx_(s.h, ref);
    var v = sl_validate_(s, ctx), T = v.calc.totals;
    var status = v.errors.length ? 'پیش‌نویس' : 'آماده ارسال';
    var tax = old ? old.TaxNo : '';
    var x = s.h.x;
    var hrow = H.SalesInvoices.map(function (k) {
      var m = {SaleID: id, CompanyID: s.h.CompanyID, CustomerID: s.h.CustomerID, SerialNo: s.h.SerialNo, DateJalali: s.h.DateJalali, DateGregorian: s.h.DateGregorian, TimeHM: s.h.TimeHM,
        Inty: s.h.Inty, Inp: s.h.Inp, Ins: s.h.Ins, RefSaleID: s.h.RefSaleID, RefTaxID: s.h.RefTaxID, Setm: s.h.Setm, Cap: s.h.Cap, Insp: s.h.Insp,
        Tprdis: T.Tprdis, Tdis: T.Tdis, Tadis: T.Tadis, Tvam: T.Tvam, Todam: T.Todam, Tbill: T.Tbill, Extra: JSON.stringify(x), TaxNo: tax,
        SendStatus: old && old.SendStatus === 'ردشده' ? 'پیش‌نویس' : status, SendRef: old ? old.SendRef : '', SendError: old ? old.SendError : '', SentAt: old ? old.SentAt : '',
        Superseded: old ? old.Superseded : '', ItemCount: s.items.length, Notes: s.h.Notes, CreatedAt: old ? old.CreatedAt : now, UpdatedAt: now};
      if (k === 'SaleID' && !id) return '';
      return m.hasOwnProperty(k) ? m[k] : '';
    });
    if (!id) { id = nextIds_(PF.SalesInvoices, 1)[0]; hrow[0] = id; }
    if (old) {
      var r0 = findRow_(ss, id);
      ss.getRange(r0, 1, 1, hrow.length).setValues([hrow]);
      sl_delItems_(id);
    } else appendRows_(ss, [hrow]);
    var ids = nextIds_(PF.SalesItems, s.items.length), irows = [];
    s.items.forEach(function (l, i) {
      var c = v.calc.lines[i], ex = {};
      SL_LINE_X.forEach(function (k) { if (l[k] !== undefined) ex[k] = l[k]; });
      var m = {SItemID: ids[i], SaleID: id, LineNo: i + 1, ProductID: l.ProductID, Sstid: l.Sstid, Sstt: l.Sstt, Mu: l.Mu, Am: c.Am, Fee: c.Fee, Prdis: c.Prdis, Dis: c.Dis, Adis: c.Adis,
        Vra: c.Vra, Vam: c.Vam, Odt: l.Odt, Odr: l.Odr, Odam: c.Odam, Olt: l.Olt, Olr: l.Olr, Olam: c.Olam, Tsstam: c.Tsstam, Extra: JSON.stringify(ex)};
      irows.push(H.SalesItems.map(function (k) { return m.hasOwnProperty(k) ? m[k] : ''; }));
    });
    appendRows_(sh_('SalesItems'), irows);
    /* اصلاحی/ابطالی: مرجع کنار گذاشته می‌شود (موجودی از مرجع کسر نشود) */
    if (ref && (s.h.Ins === 2 || s.h.Ins === 3)) setSaleField_(ref.SaleID, 'Superseded', '1');
    if (old && old.RefSaleID && old.RefSaleID !== s.h.RefSaleID) setSaleField_(old.RefSaleID, 'Superseded', '');
    bump_();
    var stock = sl_stockWarn_(s, v.calc, s.h.CompanyID, id);
    return {SaleID: id, status: hrow[H.SalesInvoices.indexOf('SendStatus')], errors: v.errors, warnings: v.warnings.concat(stock), totals: T, shortage: prSaleShortage_(s.h.CompanyID, s.items, s.h.Ins)};
  });
}
function setSaleField_(id, field, val) {
  var s = sh_('SalesInvoices'), r = findRow_(s, id);
  if (!r) return;
  s.getRange(r, H.SalesInvoices.indexOf(field) + 1).setValue(val);
}
function sl_delItems_(id) {
  var s = sh_('SalesItems'), last = s.getLastRow();
  if (last < 2) return;
  var v = s.getRange(2, 2, last - 1, 1).getValues(), rows = [];
  for (var i = 0; i < v.length; i++) if (v[i][0] === id) rows.push(i + 2);
  delRows_(s, rows);
}
function getSale_(id) { return sl_load_(id); }
function sl_filter_(f) {
  f = f || {};
  var g1 = f.from ? parseJ_(f.from) : null, g2 = f.to ? parseJ_(f.to) : null;
  if ((f.from && !g1) || (f.to && !g2)) throw new Error('تاریخ فیلتر نامعتبر است.');
  var r = rows_('SalesInvoices').filter(function (s) {
    if (f.company && s.CompanyID !== f.company) return false;
    if (f.customer && s.CustomerID !== f.customer) return false;
    if (f.status && s.SendStatus !== f.status) return false;
    if (f.pattern && String(s.Inp) !== String(f.pattern)) return false;
    if (f.subject && String(s.Ins) !== String(f.subject)) return false;
    if (f.serial && normNo_(s.SerialNo).indexOf(normNo_(f.serial)) < 0) return false;
    if (g1 && s.DateGregorian < g1.g) return false;
    if (g2 && s.DateGregorian > g2.g) return false;
    return true;
  });
  r.sort(function (a, b) { return a.DateGregorian < b.DateGregorian ? 1 : (a.DateGregorian > b.DateGregorian ? -1 : (Number(b.SerialNo) - Number(a.SerialNo))); });
  return r;
}
/* مبلغ تسویه‌شده‌ی یک فاکتور فروش: بیشینه‌ی «نقدیِ همان فاکتور» و «دریافت‌های ثبت‌شده در بانکداری» */
function sl_cash_(s) { var tot = Number(s.Tbill) || 0, setm = Number(s.Setm); return setm === 1 ? tot : (setm === 3 ? Math.min(Number(s.Cap) || 0, tot) : 0); }
function sl_settled_(s, pm) { return r2_(Math.max(sl_cash_(s), pm[s.SaleID] || 0)); }
function listSales_(f) {
  var r = sl_filter_(f), pm = {};
  rows_('DocPayments').forEach(function (y) { if (y.DocType !== 'sale' || (y.Method === 'چک' && y.ChequeStatus === 'عودت شده')) return; pm[y.DocID] = r2_((pm[y.DocID] || 0) + (Number(y.Amount) || 0)); });
  var rows = (f && f.all ? r : r.slice(0, 500)).map(function (h) {
    var o = sl_hdrOut_(h), ok = sl_valid_(h), tot = Number(h.Tbill) || 0;
    o.Received = ok ? sl_settled_(h, pm) : 0; o.Remain = ok ? r2_(tot - o.Received) : 0; o.Receipts = pm[h.SaleID] || 0;
    return o;
  });
  return {total: r.length, rows: rows, totals: slTotals_(r)};
}
/* آیا این صورتحساب در جمع‌ها حساب می‌شود؟ (کنارگذاشته‌شده، ابطال و ردشده حساب نمی‌شوند) */
function sl_valid_(s) { return String(s.Superseded) !== '1' && Number(s.Ins) !== 3 && s.SendStatus !== 'ردشده'; }
function slTotals_(a) {
  var T = {count: 0, skipped: 0, sales: 0, returns: 0, tadis: 0, tvam: 0, tbill: 0}, n = function (x) { return Number(x) || 0; };
  a.forEach(function (s) {
    if (!sl_valid_(s)) { T.skipped++; return; }
    var sg = Number(s.Ins) === 4 ? -1 : 1;
    T.count++; if (sg < 0) T.returns++; else T.sales++;
    T.tadis += sg * n(s.Tadis); T.tvam += sg * n(s.Tvam); T.tbill += sg * n(s.Tbill);
  });
  ['tadis', 'tvam', 'tbill'].forEach(function (k) { T[k] = r2_(T[k]); });
  return T;
}
/* ===== گزارش حساب فروشندگان و خریداران =====
   p: company، from/to (شمسی، اختیاری)، party (شناسه برای ریز یک طرف‌حساب)، detail (ریز همه)
   فروشنده: مانده = خرید − برگشت از خرید − پرداخت‌ها (+ دریافت از فروشنده بابت برگشت)  → مثبت = بدهی ما به فروشنده
   خریدار : مانده = فروش − برگشت از فروش − دریافت نقدیِ همان فاکتورها                   → مثبت = بدهی خریدار به ما */
/* ردیف‌های «سند حسابداری دستی» روی حساب‌های طرف‌حساب (دریافتنی، پرداختنی، پیش‌پرداخت و پیش‌دریافت) برای گزارش حساب اشخاص */
function pr_manualParty_(co, type) {
  var accs = {}, vs = {}, out = [], sup = type === 'supplier';
  rows_('Accounts').forEach(function (a) { if (a.CompanyID === co && ['1301', '3101', '1601', '3301'].indexOf(String(a.Code)) >= 0) accs[a.AccID] = a; });
  rows_('Vouchers').forEach(function (v) { if (v.CompanyID === co && v.Status === 'confirmed' && String(v.Source) !== 'auto' && String(v.Source) !== 'sys') vs[v.VID] = v; });
  rows_('VoucherRows').forEach(function (r) {
    if (r.CompanyID !== co || r.PartyType !== type || !r.PartyID || !accs[r.AccID]) return;
    var v = vs[r.VID]; if (!v) return;
    var d = Number(r.Debit) || 0, c = Number(r.Credit) || 0; if (!d && !c) return;
    /* فروشنده: بستانکار = بدهی ما بیشتر؛ خریدار: بدهکار = طلب ما بیشتر */
    var inc = sup ? c : d, dec = sup ? d : c;
    out.push({id: r.PartyID, g: v.DateGregorian, j: v.DateJalali, t: 'c', o: 3, no: 'سند ' + v.No, desc: (r.Description || v.Description || ''), kind: 'سند حسابداری', inc: inc, dec: dec, amt: dec - inc});
  });
  /* دریافتِ فاکتور فروش از طریق «حساب دیگر» با شخصِ دیگر (تعهد/انتقال به حساب شخص) */
  var sal = {}; rows_('SalesInvoices').forEach(function (s) { if (s.CompanyID === co) sal[s.SaleID] = s; });
  rows_('DocPayments').forEach(function (y) {
    if (y.CompanyID !== co || y.DocType !== 'sale' || !tr_(y.CAcc) || !accs[y.CAcc] || y.CPartyType !== type || !tr_(y.CPartyID) || !sal[y.DocID]) return;
    var a = Number(y.Amount) || 0; if (!(a > 0)) return;
    var ret = Number(sal[y.DocID].Ins) === 4, d = ret ? 0 : a, c = ret ? a : 0, inc = sup ? c : d, dec = sup ? d : c;
    out.push({id: y.CPartyID, g: y.DateGregorian, j: y.DateJalali, t: 'c', o: 3, no: 'فاکتور فروش ' + sal[y.DocID].SerialNo, desc: tr_(y.Description) || 'تعهد/انتقال بابت فاکتور فروش', kind: 'تعهد / انتقال بابت فاکتور فروش', inc: inc, dec: dec, amt: dec - inc});
  });
  return out;
}
function partyReport_(p) {
  var co = p.company;
  if (!co) throw new Error('شرکت را انتخاب کنید.');
  var g1 = p.from ? parseJ_(p.from) : null, g2 = p.to ? parseJ_(p.to) : null;
  if ((p.from && !g1) || (p.to && !g2)) throw new Error('تاریخ نامعتبر است.');
  var n = function (x) { return Number(x) || 0; };
  var want = function (kind) { return !p.kind || p.kind === 'both' || p.kind === kind; };
  var build = function (names, events, labels) {
    var P = {};
    events.forEach(function (ev) {
      var o = P[ev.id] = P[ev.id] || {id: ev.id, name: names[ev.id] || '؟', opening: 0, a: 0, b: 0, c: 0, d: 0, count: 0, ev: []};
      if (g1 && ev.g < g1.g) { o.opening += ev.inc - ev.dec; return; }
      if (g2 && ev.g > g2.g) return;
      o.ev.push(ev);
    });
    var rows = [], ledger = {}, T = {opening: 0, a: 0, b: 0, c: 0, d: 0, closing: 0, count: 0};
    Object.keys(P).forEach(function (k) {
      var o = P[k]; o.ev.sort(function (x, y) { return x.g < y.g ? -1 : (x.g > y.g ? 1 : (x.o - y.o)); });
      var bal = o.opening, lines = [];
      o.ev.forEach(function (ev) {
        bal += ev.inc - ev.dec;
        o[ev.t] += ev.amt;
        if (ev.doc) o.count++;
        lines.push({j: ev.j, g: ev.g, o: ev.o, kind: ev.kind || labels[ev.t], no: ev.no, desc: ev.desc || '', inc: r2_(ev.inc), dec: r2_(ev.dec), bal: r2_(bal)});
      });
      var r = {id: o.id, name: o.name, opening: r2_(o.opening), a: r2_(o.a), b: r2_(o.b), c: r2_(o.c), d: r2_(o.d), closing: r2_(bal), count: o.count};
      if (!r.opening && !r.a && !r.b && !r.c && !r.d && !r.closing && !o.ev.length) return;
      rows.push(r);
      if (p.detail || p.party === o.id) ledger[o.id] = lines;
      Object.keys(T).forEach(function (t) { T[t] += r[t] || 0; });
    });
    rows.sort(function (x, y) { return String(x.name) < String(y.name) ? -1 : 1; });
    Object.keys(T).forEach(function (t) { T[t] = r2_(T[t]); });
    return {rows: rows, total: T, ledger: ledger};
  };
  var out = {company: co, from: p.from || '', to: p.to || ''};
  if (want('sup')) {
    var sn = {}, inv = {}, ev = [];
    rows_('Suppliers').forEach(function (s) { if (s.CompanyID === co) sn[s.SupplierID] = s.Name; });
    rows_('PurchaseInvoices').map(normInv_).forEach(function (r) {
      if (r.CompanyID !== co) return;
      inv[r.InvoiceID] = r;
      var ret = r.DocType === 'return', amt = n(r.PayableTotal), sid = r.SupplierID || '-';
      /* a=خرید، b=برگشت از خرید؛ خرید مانده را زیاد و برگشت کم می‌کند */
      ev.push({id: sid, g: r.DateGregorian, j: r.DateJalali, t: ret ? 'b' : 'a', o: 1, no: r.InvoiceNo, desc: ret ? 'برگشت از خرید' : 'فاکتور خرید', inc: ret ? 0 : amt, dec: ret ? amt : 0, amt: amt, doc: 1});
    });
    rows_('Payments').forEach(function (q) {
      var r = inv[q.InvoiceID]; if (!r) return;
      if (q.Method === 'چک' && q.ChequeStatus === 'برگشتی') return;
      var ret = r.DocType === 'return', amt = n(q.Amount), g = q.DateGregorian || r.DateGregorian, j = q.DateJalali || r.DateJalali;
      var d = (q.Method || '') + (q.ChequeNo ? ' ' + q.ChequeNo : '') + (q.Description ? ' - ' + q.Description : '');
      /* c=پرداخت به فروشنده، d=دریافت از فروشنده بابت برگشت */
      ev.push({id: r.SupplierID || '-', g: g, j: j, t: ret ? 'd' : 'c', o: 2, no: r.InvoiceNo, desc: (ret ? 'دریافت بابت برگشت' : 'پرداخت') + (d ? ' - ' + d : ''), inc: ret ? amt : 0, dec: ret ? 0 : amt, amt: amt});
    });
    sn['-'] = 'بدون فروشنده';
    ev = ev.concat(pr_manualParty_(co, 'supplier'));
    out.sup = build(sn, ev, {a: 'خرید', b: 'برگشت از خرید', c: 'پرداخت', d: 'دریافت بابت برگشت'});
  }
  if (want('cus')) {
    var cn = {'-': 'بدون مشتری (فروش خرد)'}, ev2 = [];
    rows_('Customers').forEach(function (c) { if (c.CompanyID === co) cn[c.CustomerID] = c.Name; });
    rows_('SalesInvoices').forEach(function (s) {
      if (s.CompanyID !== co || !sl_valid_(s)) return;
      var ret = Number(s.Ins) === 4, tot = n(s.Tbill), setm = Number(s.Setm), cash = setm === 1 ? tot : (setm === 3 ? Math.min(n(s.Cap), tot) : 0);
      /* a=فروش، b=برگشت از فروش؛ نقدی هر فاکتور همان‌جا تسویه می‌شود */
      ev2.push({id: s.CustomerID || '-', g: s.DateGregorian, j: s.DateJalali, t: ret ? 'b' : 'a', o: 1, no: s.SerialNo, desc: (ret ? 'برگشت از فروش' : 'فاکتور فروش') + (cash ? ' (نقدی ' + Math.round(cash) + ')' : ''), inc: ret ? cash : tot, dec: ret ? tot : cash, amt: tot, doc: 1});
    });
    /* دریافت‌ها/پرداخت‌های ثبت‌شده در بانکداری (به‌جز بخشی که برابر نقدیِ خودِ فاکتور است) */
    var sIdx = {}; rows_('SalesInvoices').forEach(function (s) { if (s.CompanyID === co && sl_valid_(s)) sIdx[s.SaleID] = s; });
    var dp = rows_('DocPayments').filter(function (y) { return y.CompanyID === co && y.DocType === 'sale' && sIdx[y.DocID] && !(y.Method === 'چک' && y.ChequeStatus === 'عودت شده'); });
    dp.sort(function (x, y) { return x.DateGregorian < y.DateGregorian ? -1 : (x.DateGregorian > y.DateGregorian ? 1 : 0); });
    var left = {};
    dp.forEach(function (y) {
      var s = sIdx[y.DocID], ret = Number(s.Ins) === 4, a = n(y.Amount);
      if (left[s.SaleID] === undefined) left[s.SaleID] = sl_cash_(s);
      var part = Math.max(0, a - left[s.SaleID]); left[s.SaleID] = Math.max(0, left[s.SaleID] - a);
      if (part <= 0) return;
      ev2.push({id: s.CustomerID || '-', g: y.DateGregorian, j: y.DateJalali, t: ret ? 'd' : 'c', o: 2, no: s.SerialNo, desc: (ret ? 'پرداخت بابت برگشت' : 'دریافت') + ' - ' + (y.Method || '') + (y.ChequeNo ? ' ' + y.ChequeNo : ''), inc: ret ? 0 : 0, dec: ret ? 0 : part, amt: part});
      if (ret) ev2[ev2.length - 1].inc = part;
    });
    ev2 = ev2.concat(pr_manualParty_(co, 'customer'));
    var C = build(cn, ev2, {a: 'فروش', b: 'برگشت از فروش', c: 'دریافت', d: 'پرداخت بابت برگشت'});
    /* ستون c = دریافت نقدی خالص (نقدی فروش‌ها − نقدی بازگشتی‌ها) از روی مانده */
    C.rows.forEach(function (r) { r.c = r2_(r.opening + r.a - r.b - r.closing); r.d = 0; });
    C.total.c = r2_(C.rows.reduce(function (t, r) { return t + r.c; }, 0)); C.total.d = 0;
    out.cus = C;
  }
  /* اشخاصی که هم در فهرست فروشندگان و هم خریداران هستند (هم‌نام، یا دارای شناسه/شماره ملی یکسان) */
  if (out.sup && out.cus) {
    var keyOf = function (o) { var k = []; if (nn_(o.Name)) k.push('n:' + nn_(o.Name)); var id = tr_(fa2en_(o.NationalID)); if (id) k.push('i:' + id); return k; };
    var cIdx = {}, sIdx = {}, cRow = {}, sRow = {};
    out.cus.rows.forEach(function (r) { cRow[r.id] = r; });
    out.sup.rows.forEach(function (r) { sRow[r.id] = r; });
    rows_('Customers').forEach(function (c) { if (c.CompanyID === co && cRow[c.CustomerID]) keyOf(c).forEach(function (k) { if (!cIdx[k]) cIdx[k] = c.CustomerID; }); });
    rows_('Suppliers').forEach(function (x) {
      if (x.CompanyID !== co || !sRow[x.SupplierID]) return;
      var hit = ''; keyOf(x).forEach(function (k) { if (!hit && cIdx[k]) hit = cIdx[k]; });
      if (hit && !cRow[hit].pair && !sRow[x.SupplierID].pair) { sRow[x.SupplierID].pair = hit; cRow[hit].pair = x.SupplierID; }
    });
  }
  return out;
}
/* ===== صورتحساب (کارنامه) استاندارد یک شخص: ردیف، شماره صورتحساب، تاریخ، شرح، بدهکار، بستانکار، مانده =====
   دید حساب «شخص» در دفاتر ما: فروش به او = بدهکار، خرید از او = بستانکار؛ مانده = بدهکار − بستانکار.
   اگر هم فروشنده و هم خریدار باشد (p.supplier و p.customer)، هر دو گزارش ادغام و مانده از جمع جبری به دست می‌آید. */
function partyStatement_(p) {
  if (!p.company) throw new Error('شرکت را انتخاب کنید.');
  if (!p.supplier && !p.customer) throw new Error('طرف‌حساب مشخص نشده است.');
  var r = partyReport_({company: p.company, from: p.from, to: p.to, kind: 'both', detail: true});
  var S = p.supplier ? (r.sup.rows.filter(function (x) { return x.id === p.supplier; })[0] || null) : null;
  var C = p.customer ? (r.cus.rows.filter(function (x) { return x.id === p.customer; })[0] || null) : null;
  var nameOf = function (sheet, key, id) { var x = rows_(sheet).filter(function (z) { return z[key] === id && z.CompanyID === p.company; })[0]; return x ? x.Name : (id === '-' ? 'بدون مشتری (فروش خرد)' : '؟'); };
  var sName = p.supplier ? (S ? S.name : nameOf('Suppliers', 'SupplierID', p.supplier)) : '', cName = p.customer ? (C ? C.name : nameOf('Customers', 'CustomerID', p.customer)) : '';
  var lines = [], idx = 0;
  if (S) (r.sup.ledger[S.id] || []).forEach(function (l) { lines.push({j: l.j, g: l.g, o: l.o, i: idx++, side: 'sup', kind: l.kind, no: l.no, desc: l.desc, deb: l.dec, cred: l.inc}); });
  if (C) (r.cus.ledger[C.id] || []).forEach(function (l) { lines.push({j: l.j, g: l.g, o: l.o, i: idx++, side: 'cus', kind: l.kind, no: l.no, desc: l.desc, deb: l.inc, cred: l.dec}); });
  lines.sort(function (a, b) { return a.g < b.g ? -1 : (a.g > b.g ? 1 : (a.o !== b.o ? a.o - b.o : a.i - b.i)); });
  var sOpen = S ? -S.opening : 0, cOpen = C ? C.opening : 0, opening = sOpen + cOpen, bal = opening, td = 0, tc = 0;
  lines.forEach(function (l) { l.deb = r2_(l.deb); l.cred = r2_(l.cred); bal = r2_(bal + l.deb - l.cred); l.bal = bal; td += l.deb; tc += l.cred; delete l.o; delete l.i; });
  var sClose = S ? -S.closing : 0, cClose = C ? C.closing : 0;
  return {
    company: p.company, from: p.from || '', to: p.to || '', name: sName || cName, supName: sName, cusName: cName, merged: !!(p.supplier && p.customer),
    opening: r2_(opening), lines: lines, totalDeb: r2_(td), totalCred: r2_(tc), closing: r2_(opening + td - tc),
    parts: {sup: p.supplier ? {name: sName, opening: r2_(sOpen), closing: r2_(sClose)} : null, cus: p.customer ? {name: cName, opening: r2_(cOpen), closing: r2_(cClose)} : null}
  };
}
/* ===== تبدیل فاکتورهای فروشِ اشتباه (که در واقع خرید بوده‌اند) به فاکتور خرید =====
   پیش‌نمایش: p.preview = true  ← فقط شمارش و فهرست شناسه‌ها
   اجرا: p.ids = [SaleID...] (دسته‌ای)؛ هر فاکتور فروش → یک فاکتور خرید، مشتری → فروشنده، و فاکتور فروش حذف می‌شود. */
function s2pEligible_(r) {
  return Number(r.Ins) === 1 && String(r.Superseded) !== '1' && SL_LOCKED.indexOf(r.SendStatus) < 0;
}
function salesToPurchase_(p) {
  if (!p.company) throw new Error('شرکت را انتخاب کنید.');
  if (p.preview) {
    var all = sl_filter_(p), ok = all.filter(s2pEligible_), cu = {}, sup = {}, dupKeys = {}, newSup = {}, dups = 0, tot = 0;
    rows_('Customers').forEach(function (c) { cu[c.CustomerID] = c; });
    rows_('Suppliers').forEach(function (x) { if (x.CompanyID === p.company) sup[nn_(x.Name)] = x.SupplierID; });
    rows_('PurchaseInvoices').forEach(function (x) { if (x.CompanyID === p.company) dupKeys[x.DupKey] = 1; });
    ok.forEach(function (s) {
      var nm = (cu[s.CustomerID] || {}).Name || '', sid = sup[nn_(nm)];
      if (!sid) newSup[nn_(nm)] = 1;
      if (sid && dupKeys[[p.company, sid, normNo_(s.SerialNo)].join('|')]) dups++;
      tot += Number(s.Tbill) || 0;
    });
    return {found: all.length, eligible: ok.length, skipped: all.length - ok.length, newSuppliers: Object.keys(newSup).length, duplicates: dups, total: Math.round(tot),
      ids: ok.map(function (s) { return s.SaleID; }),
      sample: ok.slice(0, 8).map(function (s) { return {no: s.SerialNo, date: s.DateJalali, party: (cu[s.CustomerID] || {}).Name || '', total: Number(s.Tbill) || 0}; })};
  }
  var ids = p.ids || [];
  if (!ids.length) return {converted: 0, dup: 0, skipped: 0, newSuppliers: 0};
  return locked_(function () {
    var co = p.company, want = {}, now = nowStr_(), out = {converted: 0, dup: 0, skipped: 0, newSuppliers: 0, errors: []};
    ids.forEach(function (i) { want[i] = 1; });
    var cu = {}, sup = {}, dupKeys = {}, prd = {};
    rows_('Customers').forEach(function (c) { cu[c.CustomerID] = c; });
    rows_('Suppliers').forEach(function (x) { if (x.CompanyID === co) sup[nn_(x.Name)] = x.SupplierID; });
    rows_('PurchaseInvoices').forEach(function (x) { if (x.CompanyID === co) dupKeys[x.DupKey] = 1; });
    rows_('Products').forEach(function (x) { prd[x.ProductID] = x; });
    var heads = rows_('SalesInvoices').filter(function (s) { return want[s.SaleID] && s.CompanyID === co; });
    var lines = {};
    rows_('SalesItems').forEach(function (it) { if (want[it.SaleID]) (lines[it.SaleID] = lines[it.SaleID] || []).push(it); });
    var A = {Suppliers: [], PurchaseInvoices: [], PurchaseItems: []}, delSales = {};
    var PT = {1: 'حقیقی', 2: 'حقوقی', 3: 'حقوقی', 4: 'حقیقی'};
    var inv = heads.filter(function (s) { if (s2pEligible_(s)) return true; out.skipped++; return false; });
    var ls = inv.map(function (s) { return (lines[s.SaleID] || []).sort(function (a, b) { return a.LineNo - b.LineNo; }); });
    var nItems = ls.reduce(function (a, l) { return a + l.length; }, 0);
    var invIds = nextIds_('INV', inv.length), itmIds = nextIds_('ITM', nItems), ii = 0;
    var newSupList = [];
    inv.forEach(function (s, k) {
      var c = cu[s.CustomerID] || {}, nm = String(c.Name || '').trim() || 'نامشخص', key = nn_(nm), sid = sup[key];
      if (sid && dupKeys[[co, sid, normNo_(s.SerialNo)].join('|')]) { out.dup++; return; }
      if (!sid) { newSupList.push({k: key, c: c, nm: nm}); sid = 'NEW:' + key; sup[key] = sid; }
      var T = {g: 0, d: 0, n: 0, v: 0, t: 0}, rowsI = [];
      ls[k].forEach(function (it, i) {
        var g = Number(it.Prdis) || 0, d = Number(it.Dis) || 0, net = Number(it.Adis) || 0, v = (Number(it.Vam) || 0) + (Number(it.Odam) || 0) + (Number(it.Olam) || 0), pr = prd[it.ProductID] || {};
        var tot = r2_(net + v);
        T.g += g; T.d += d; T.n += net; T.v += v; T.t += tot;
        rowsI.push({ItemID: itmIds[ii++], LineNo: i + 1, ProductID: it.ProductID, Unit: pr.DefaultUnit || '', Quantity: Number(it.Am) || 0, UnitPrice: Number(it.Fee) || 0, Gross: g, Discount: d, NetAfterDiscount: net, VAT: v, LineTotal: tot});
      });
      A.PurchaseInvoices.push({sale: s, sid: sid, T: T, id: invIds[A.PurchaseInvoices.length], items: rowsI});
      delSales[s.SaleID] = 1; out.converted++;
    });
    /* فروشنده‌های جدید */
    var sids = nextIds_('SUP', newSupList.length), real = {};
    newSupList.forEach(function (x, i) {
      var c = x.c, o = {SupplierID: sids[i], CompanyID: co, PersonType: PT[Number(c.PersonType)] || 'حقوقی', Name: x.nm, NationalID: c.NationalID || '', EconomicCode: c.EconomicCode || '', RegNo: c.RegNo || '',
        Phone: c.Phone || '', Mobile: c.Mobile || '', Address: c.Address || '', Province: c.Province || '', City: c.City || '', PostalCode: c.PostalCode || '', IsActive: true, CreatedAt: now, UpdatedAt: now};
      real['NEW:' + x.k] = sids[i]; sup[x.k] = sids[i]; A.Suppliers.push(o); out.newSuppliers++;
    });
    var invRows = [], itRows = [];
    A.PurchaseInvoices.forEach(function (z) {
      var s = z.sale, sid = real[z.sid] || z.sid, T = z.T, no = String(s.SerialNo);
      invRows.push({InvoiceID: z.id, CompanyID: co, SupplierID: sid, InvoiceNo: no, DateJalali: s.DateJalali, DateGregorian: s.DateGregorian, ItemCount: z.items.length, TotalGross: r2_(T.g), TotalDiscount: r2_(T.d), TotalAfterDiscount: r2_(T.n),
        TotalVAT: r2_(T.v), GrandTotal: r2_(T.t), Source: 'تبدیل از فروش', ImportID: p.importId || '', DupKey: [co, sid, normNo_(no)].join('|'), CreatedAt: now, UpdatedAt: now, TotalCosts: 0, PayableTotal: r2_(T.t), TotalPaid: 0, Remaining: r2_(T.t), PayStatus: 'پرداخت‌نشده', Notes: s.Notes || ''});
      z.items.forEach(function (it) { it.InvoiceID = z.id; itRows.push(it); });
    });
    var put = function (sh, arr) { appendRows_(sh_(sh), arr.map(function (o) { return H[sh].map(function (k) { return o[k] === undefined ? '' : o[k]; }); })); };
    put('Suppliers', A.Suppliers); put('PurchaseInvoices', invRows); put('PurchaseItems', itRows);
    /* حذف فاکتورهای فروش تبدیل‌شده */
    var hs = sh_('SalesInvoices'), is = sh_('SalesItems'), r1 = [], r2 = [], v, i;
    if (hs.getLastRow() > 1) { v = hs.getRange(2, 1, hs.getLastRow() - 1, 1).getValues(); for (i = 0; i < v.length; i++) if (delSales[v[i][0]]) r1.push(i + 2); }
    if (is.getLastRow() > 1) { v = is.getRange(2, 2, is.getLastRow() - 1, 1).getValues(); for (i = 0; i < v.length; i++) if (delSales[v[i][0]]) r2.push(i + 2); }
    delRows_(is, r2); delRows_(hs, r1);
    bump_();
    return out;
  });
}
function deleteSale_(id) {
  return locked_(function () {
    var h = sl_load_(id);
    if (SL_LOCKED.indexOf(h.SendStatus) >= 0) throw new Error('صورتحساب ارسال/تأییدشده حذف نمی‌شود؛ صورتحساب ابطالی صادر کنید.');
    sl_delItems_(id);
    bk_dropDoc_('sale', id);
    var s = sh_('SalesInvoices'), r = findRow_(s, id);
    if (r) s.deleteRow(r);
    if (h.RefSaleID) setSaleField_(h.RefSaleID, 'Superseded', '');
    bump_();
    return {deleted: true};
  });
}
/* ثبت دستی نتیجهٔ ارسال (تا فعال شدن ارسال مستقیم) */
function setSaleStatus_(p) {
  if (SL_STATUSES.indexOf(p.status) < 0) throw new Error('وضعیت نامعتبر است.');
  return locked_(function () {
    var h = sl_load_(p.id);
    if (p.status === 'آماده ارسال' || p.status === 'ارسال‌شده' || p.status === 'تأییدشده') {
      var s = {h: Object.assign({}, h), items: h.items};
      var ref = h.RefSaleID ? sl_load_(h.RefSaleID) : null;
      var v = sl_validate_(s, sl_ctx_(h, ref));
      if (v.errors.length) throw new Error('ابتدا خطاهای صورتحساب را برطرف کنید:\n' + v.errors.slice(0, 5).join('\n'));
    }
    var tax = String(p.taxNo || '').trim().toUpperCase();
    if ((p.status === 'ارسال‌شده' || p.status === 'تأییدشده') && tax && !/^[0-9A-Z]{22}$/.test(tax)) throw new Error('شماره مالیاتی باید ۲۲ کاراکتر (حروف انگلیسی و رقم) باشد.');
    setSaleField_(p.id, 'SendStatus', p.status);
    if (tax) setSaleField_(p.id, 'TaxNo', tax);
    if (p.ref !== undefined) setSaleField_(p.id, 'SendRef', p.ref);
    if (p.error !== undefined) setSaleField_(p.id, 'SendError', p.error);
    if (p.status === 'ارسال‌شده' || p.status === 'تأییدشده') setSaleField_(p.id, 'SentAt', nowStr_());
    bump_();
    return {ok: true};
  });
}
function saleJson_(p) {
  var h = sl_load_(p.id), ref = h.RefSaleID ? sl_load_(h.RefSaleID) : null;
  var ctx = sl_ctx_(h, ref), s = {h: h, items: h.items};
  var v = sl_validate_(s, ctx);
  return {json: sl_buildJson_(s, ctx), errors: v.errors, warnings: v.warnings, taxPrefix: sl_taxPrefix_(ctx.company.TaxMemoryID, h.DateGregorian, h.SerialNo, h.TimeHM)};
}
/* ===== موجودی کالا = خرید − فروش + برگشت از فروش ===== */
/* خواندن فقط ستون‌های لازم (برای شیت‌های بزرگ بسیار سریع‌تر از خواندن کل شیت) */
function sl_cols_(sheetName, names) {
  var s = sh_(sheetName), last = s.getLastRow(), out = {};
  names.forEach(function (k) {
    out[k] = last < 2 ? [] : s.getRange(2, H[sheetName].indexOf(k) + 1, last - 1, 1).getValues().map(function (r) { return r[0]; });
  });
  return out;
}
function stockMap_(co, from, to) {
  /* from/to (میلادی yyyy-mm-dd، اختیاری): اسناد قبل از from در «مانده ابتدای دوره» جمع می‌شوند و اسناد بعد از to نادیده گرفته می‌شوند */
  var m = {}, add = function (pid, k, q, g) {
    if (!pid) return; q = Number(q) || 0;
    if (to && g && g > to) return;
    var o = m[pid] || (m[pid] = {purchased: 0, sold: 0, returned: 0, retPurch: 0, produced: 0, consumed: 0, adj: 0});
    if (from && g && g < from) { o.pre = (o.pre || 0) + ((k === 'purchased' || k === 'returned' || k === 'produced' || k === 'adj' || k === 'issueRet') ? q : -q); return; }
    o[k] = (o[k] || 0) + q;
  };
  var pinv = {};
  rows_('PurchaseInvoices').forEach(function (r) { if (r.CompanyID === co) pinv[r.InvoiceID] = {t: r.DocType === 'return' ? 2 : 1, g: r.DateGregorian}; });
  var pi = sl_cols_('PurchaseItems', ['InvoiceID', 'ProductID', 'Quantity']);
  for (var i = 0; i < pi.InvoiceID.length; i++) { var iv = pinv[pi.InvoiceID[i]]; if (iv) add(pi.ProductID[i], iv.t === 2 ? 'retPurch' : 'purchased', pi.Quantity[i], iv.g); }
  var sales = {};
  rows_('SalesInvoices').forEach(function (s) { if (s.CompanyID === co && String(s.Superseded) !== '1') sales[s.SaleID] = s; });
  var si = sl_cols_('SalesItems', ['SaleID', 'ProductID', 'Am']);
  for (var j = 0; j < si.SaleID.length; j++) {
    var s = sales[si.SaleID[j]];
    if (!s) continue;
    var ins = Number(s.Ins);
    if (ins === 1 || ins === 2) add(si.ProductID[j], 'sold', si.Am[j], s.DateGregorian); else if (ins === 4) add(si.ProductID[j], 'returned', si.Am[j], s.DateGregorian);
  }
  /* تولید: فقط سفارش‌های «تکمیل‌شده» (تأیید دستی) روی موجودی اثر دارند */
  var done = {};
  rows_('ProdOrders').forEach(function (o) { if (o.CompanyID === co && o.Status === 'تکمیل‌شده') { var g = o.DoneDateGregorian || o.DateGregorian; done[o.OrderID] = g; add(o.ProductID, 'produced', o.ActualQty, g); } });
  rows_('ProdMaterials').forEach(function (x) { if (done[x.OrderID] !== undefined) add(x.ProductID, 'consumed', x.ActualQty === '' ? x.PlannedQty : x.ActualQty, done[x.OrderID]); });
  /* تعدیل موجودی (مثلاً صفر کردن مانده‌ی منفی هنگام بستن سال) */
  rows_('StockAdj').forEach(function (a) { if (a.CompanyID === co) add(a.ProductID, 'adj', a.Qty, a.DateGregorian); });
  /* حواله مصرف قراردادهای خدماتی (مصرف و برگشت به انبار) */
  if (sh_('StockIssues')) rows_('StockIssues').forEach(function (x) { if (x.CompanyID === co && (x.Kind === 'issue' || x.Kind === 'return')) add(x.ProductID, x.Kind === 'issue' ? 'issued' : 'issueRet', x.Qty, x.DateGregorian); });
  /* موجودی اولیه (ثبت‌شده هنگام تعریف کالا) */
  rows_('Products').forEach(function (pr) {
    if (pr.CompanyID !== co) return;
    var q = Number(pr.OpeningQty) || 0; if (!q) return;
    var o = m[pr.ProductID] || (m[pr.ProductID] = {purchased: 0, sold: 0, returned: 0, retPurch: 0, produced: 0, consumed: 0, adj: 0});
    o.openBase = q; o.openingCost = Number(pr.OpeningCost) || 0;
  });
  Object.keys(m).forEach(function (k) { var o = m[k]; if (o.openBase || o.pre) o.opening = (o.openBase || 0) + (o.pre || 0); });
  return m;
}
function stockReport_(p) {
  var g1 = p.from ? parseJ_(p.from) : null, g2 = p.to ? parseJ_(p.to) : null;
  var m = stockMap_(p.company, g1 ? g1.g : '', g2 ? g2.g : ''), out = [], made = prMadeSet_(p.company);
  rows_('Products').forEach(function (pr) {
    if (pr.CompanyID !== p.company) return;
    var o = m[pr.ProductID] || {purchased: 0, sold: 0, returned: 0, retPurch: 0, produced: 0, consumed: 0};
    out.push({ProductID: pr.ProductID, Name: pr.Name, Code: pr.ProductCode, Unit: pr.DefaultUnit, GroupID: pr.GroupID, made: !!made[pr.ProductID], opening: o.opening || 0, purchased: o.purchased, retPurch: o.retPurch || 0, sold: o.sold, returned: o.returned, produced: o.produced || 0, consumed: o.consumed || 0,
      adj: o.adj || 0, cu: Math.round(((o.issued || 0) - (o.issueRet || 0)) * 1e6) / 1e6, balance: Math.round(stBal_(o) * 1e8) / 1e8});
  });
  out.sort(function (a, b) { return a.balance - b.balance; });
  return out;
}
function stockDetail_(p) {
  var co = p.company, pid = p.product, out = {purchases: [], sales: [], production: []}, inv = {}, sup = {}, cus = {}, sl = {};
  rows_('Suppliers').forEach(function (r) { sup[r.SupplierID] = r.Name; });
  rows_('Customers').forEach(function (r) { cus[r.CustomerID] = r.Name; });
  rows_('PurchaseInvoices').forEach(function (r) { if (r.CompanyID === co) inv[r.InvoiceID] = r; });
  rows_('PurchaseItems').forEach(function (it) {
    var iv = inv[it.InvoiceID];
    if (iv && it.ProductID === pid) out.purchases.push({id: it.InvoiceID, no: iv.InvoiceNo, date: iv.DateJalali, party: sup[iv.SupplierID] || '', qty: Number(it.Quantity) || 0, source: iv.Source || '', ret: iv.DocType === 'return'});
  });
  rows_('SalesInvoices').forEach(function (r) { if (r.CompanyID === co) sl[r.SaleID] = r; });
  rows_('SalesItems').forEach(function (it) {
    var s = sl[it.SaleID];
    if (s && it.ProductID === pid) out.sales.push({id: it.SaleID, no: s.SerialNo, date: s.DateJalali, party: cus[s.CustomerID] || '', ins: Number(s.Ins), qty: Number(it.Am) || 0, superseded: String(s.Superseded) === '1', status: s.SendStatus});
  });
  var ord = {};
  rows_('ProdOrders').forEach(function (o) { if (o.CompanyID === co) ord[o.OrderID] = o; });
  Object.keys(ord).forEach(function (k) { var o = ord[k]; if (o.ProductID === pid && o.Status === 'تکمیل‌شده') out.production.push({id: o.OrderID, no: o.OrderNo, date: o.DoneJalali || o.DateJalali, qty: Number(o.ActualQty) || 0, kind: 'out'}); });
  rows_('ProdMaterials').forEach(function (x) { var o = ord[x.OrderID]; if (o && x.ProductID === pid && o.Status === 'تکمیل‌شده') out.production.push({id: o.OrderID, no: o.OrderNo, date: o.DoneJalali || o.DateJalali, qty: Number(x.ActualQty === '' ? x.PlannedQty : x.ActualQty) || 0, kind: 'in'}); });
  var pr0 = rows_('Products').filter(function (r) { return r.ProductID === pid && r.CompanyID === co; })[0];
  out.opening = pr0 && Number(pr0.OpeningQty) > 0 ? {qty: Number(pr0.OpeningQty), cost: Number(pr0.OpeningCost) || 0} : null;
  return out;
}
function sl_stockWarn_(s, calc, co, selfId) {
  var W = [];
  if (Number(s.h.Ins) === 3) return W;
  var m = stockMap_(co), names = {}, sign = Number(s.h.Ins) === 4 ? 1 : -1;
  rows_('Products').forEach(function (pr) { names[pr.ProductID] = pr.Name; });
  var delta = {};
  s.items.forEach(function (l) { if (l.ProductID) delta[l.ProductID] = (delta[l.ProductID] || 0) + sign * sl_n_(l.Am); });
  /* موجودی فعلی شامل همین فاکتور است (پس از ذخیره)، پس مقدار نهایی همان موجودی فعلی است */
  Object.keys(delta).forEach(function (pid) {
    if (!names.hasOwnProperty(pid)) return; /* خدمات موجودی ندارند */
    var o = m[pid] || {purchased: 0, sold: 0, returned: 0, retPurch: 0, produced: 0, consumed: 0}, bal = stBal_(o);
    if (bal < -1e-9) W.push('موجودی «' + (names[pid] || pid) + '» پس از این فاکتور منفی می‌شود (' + (Math.round(bal * 100) / 100) + ').');
  });
  return W;
}

/* ===== ثبت گروهی فاکتورهای فروش از Excel =====
   هر ردیف فایل یک قلم کالا است؛ ردیف‌های هم‌سریال یک صورتحساب را می‌سازند.
   فقط صورتحساب «اصلی» با الگوهای فروش (۱)، پیمانکاری (۴) و قبوض خدماتی (۵) پشتیبانی می‌شود. */
function impSales_(p) {
  var co = p.company;
  if (!co) throw new Error('شرکت را انتخاب کنید.');
  var commit = !!p.commit, rows = p.rows || [], S = {read: rows.length, ok: 0, dup: 0, err: 0, blocked: 0, draft: 0, nw: 0}, n = {sup: 0, prd: 0, g: 0, s: 0, u: 0, cu: 0}, items = [], nl = {cu: {}, prd: {}, u: {}};
  var ns_ = function (x) { var v = fa2en_(String(x == null ? '' : x).replace(/[٬،,\s%٪]/g, '').replace(/٫/g, '.')); return v === '' ? 0 : Number(v); };
  var company = rows_('Companies').filter(function (c) { return c.CompanyID === co; })[0] || {};
  var cuN = {}, cuE = {}, prN = {}, prC = {}, um = {}, seen = {};
  rows_('Customers').forEach(function (c) { if (c.CompanyID !== co) return; cuN[nn_(c.Name)] = c; if (String(c.EconomicCode) !== '') cuE[String(c.EconomicCode)] = c; });
  rows_('Products').forEach(function (r) { if (r.CompanyID !== co) return; prN[nn_(r.Name)] = r; if (String(r.ProductCode) !== '') prC[nn_(r.ProductCode)] = r; });
  rows_('Services').forEach(function (r) { if (r.CompanyID !== co) return; var q = {ProductID: r.ServiceID, Name: r.Name, ProductCode: r.ServiceCode, DefaultUnit: r.DefaultUnit, VatRate: r.VatRate, SstID: r.SstID, GroupID: 'SVC'}; if (!prN[nn_(r.Name)]) prN[nn_(r.Name)] = q; if (String(r.ServiceCode) !== '' && !prC[nn_(r.ServiceCode)]) prC[nn_(r.ServiceCode)] = q; });
  rows_('Units').forEach(function (u) { if (u.CompanyID === co) um[nn_(u.UnitName)] = u; });
  rows_('SalesInvoices').forEach(function (r) { if (r.CompanyID === co) seen[String(r.SerialNo)] = 1; });
  var PT = {'حقیقی': 1, 'حقوقی': 2, 'مشارکت مدنی': 3, 'اتباع': 4, 'اتباع غیرایرانی': 4}, SM = {'نقدی': 1, 'نقد': 1, 'نسیه': 2, 'نقدی/نسیه': 3, 'نقدی-نسیه': 3, 'نقدی نسیه': 3, 'نقد/نسیه': 3},
    IT = {'نوع اول': 1, 'نوع یک': 1, 'اول': 1, 'یک': 1, 'نوع دوم': 2, 'نوع دو': 2, 'دوم': 2, 'دو': 2, 'نوع سوم': 3, 'نوع سه': 3, 'سوم': 3, 'سه': 3},
    IP = {'فروش': 1, 'فروش کالا و خدمات': 1, 'فروش کالا': 1, 'فروش ارز': 2, 'پیمانکاری': 4, 'قبوض خدماتی': 5, 'قبوض': 5, 'بلیط هواپیما': 6, 'بارنامه': 8, 'بورس': 11, 'بورس اوراق بهادار': 11, 'بیمه': 13, 'فروش خدمات بیمه ای': 13};
  var nowIso = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), defVat = vat_(co);
  function out(r, st, m, ex) { S[st]++; var o = {r: r._r, st: st, m: m || ''}; if (ex) for (var k in ex) o[k] = ex[k]; items.push(o); }
  function code(v, map, def) { var t = nn_(v); if (t === '') return def; if (map[t] !== undefined) return map[t]; var x = Number(t); return isNaN(x) ? NaN : x; }
  var G = {}, order = [];
  rows.forEach(function (r) { if (!G[r._k]) { G[r._k] = []; order.push(r._k); } G[r._k].push(r); });
  var plans = [];
  order.forEach(function (k) {
    var L = G[k], f = L[0], errs = [], soft = '', serial = fa2en_(tr_(f.SerialNo)).replace(/\s/g, ''), dt = parseJ_(f.DateJalali);
    var inp = code(f.Inp, IP, 1), inty = code(f.Inty, IT, 1), setm = code(f.Setm, SM, 1);
    var meta = {key: k, no: serial, date: tr_(f.DateJalali), sup: tr_(f.CustomerName) || tr_(f.CustomerEco), lines: L.length, total: 0};
    if (!serial) errs.push('سریال صورتحساب خالی است');
    else if (!/^\d+$/.test(serial)) errs.push('سریال باید عدد باشد');
    if (!dt) errs.push('تاریخ نامعتبر (قالب 1405/07/09)');
    if ([1, 4, 5].indexOf(inp) < 0) errs.push('در ثبت گروهی فقط الگوی ۱ (فروش)، ۴ (پیمانکاری) و ۵ (قبوض) مجاز است؛ سایر الگوها را از فرم دستی ثبت کنید');
    if ([1, 2, 3].indexOf(inty) < 0) errs.push('نوع صورتحساب باید ۱، ۲ یا ۳ (نوع اول/دوم/سوم) باشد');
    if ([1, 2, 3].indexOf(setm) < 0) errs.push('روش تسویه نامعتبر (نقدی / نسیه / نقدی-نسیه)');
    L.forEach(function (r) { if (tr_(r.SerialNo) !== '' && fa2en_(tr_(r.SerialNo)) !== serial) errs.push('ردیف ' + r._r + ': سریال متفاوت'); });
    /* مشتری */
    var cname = tr_(f.CustomerName), ceco = fa2en_(tr_(f.CustomerEco)).replace(/\s/g, ''), cu = (ceco && cuE[ceco]) || (cname && cuN[nn_(cname)]) || null, newCu = null;
    if (!cu && (inty === 1 || cname)) {
      if (!cname) errs.push('نام مشتری خالی است');
      else {
        var pt = code(f.CustomerType, PT, ceco.length === 11 ? 2 : 1);
        if (isNaN(pt) || [1, 2, 3, 4].indexOf(pt) < 0) errs.push('«نوع شخص مشتری» نامعتبر است (حقیقی/حقوقی/مشارکت مدنی/اتباع)');
        else if (tr_(f.CustomerType) === '') soft = 'نوع شخص مشتری در فایل نبود و ' + (pt === 2 ? 'حقوقی' : 'حقیقی') + ' فرض شد';
        newCu = {CompanyID: co, Name: cname, PersonType: pt, EconomicCode: ceco, NationalID: fa2en_(tr_(f.CustomerNid)), PostalCode: fa2en_(tr_(f.CustomerPostal))};
        cu = Object.assign({CustomerID: 'NEW'}, newCu);
      }
    }
    /* اقلام */
    var lines = [], newPrd = [], newUnits = {}, fill = [];
    L.forEach(function (r) {
      var ep = 'ردیف ' + r._r + ': ', pn = tr_(r.ProductName), pc = tr_(r.ProductCode), pr = (pc && prC[nn_(pc)]) || (pn && prN[nn_(pn)]) || null;
      var q = ns_(r.Quantity), fee = ns_(r.UnitPrice), d = tr_(r.Discount) === '' ? 0 : ns_(r.Discount), un = tr_(r.Unit) || (pr && pr.DefaultUnit) || '';
      var vr = tr_(r.VatRate) !== '' ? ns_(r.VatRate) : (pr && String(pr.VatRate) !== '' ? Number(pr.VatRate) : defVat);
      var sstid = fa2en_(tr_(r.Sstid)) || (pr ? String(pr.SstID || '') : '');
      if (!pr && !pn) errs.push(ep + 'نام کالا خالی است');
      if (isNaN(q) || isNaN(fee) || isNaN(d) || isNaN(vr)) errs.push(ep + 'عدد نامعتبر (تعداد/مبلغ/تخفیف/نرخ مالیات)');
      if (!isNaN(q) && !(q > 0)) errs.push(ep + 'تعداد باید بزرگتر از صفر باشد');
      if (!isNaN(fee) && fee < 0) errs.push(ep + 'قیمت واحد منفی است');
      var ln = {ProductID: pr ? pr.ProductID : '', Sstid: sstid, Sstt: pn || (pr && pr.Name) || '', unit: un, Mu: un && um[nn_(un)] && um[nn_(un)].MuCode !== '' ? String(um[nn_(un)].MuCode) : '', Am: q, Fee: fee, Dis: d, Vra: vr};
      if (!pr && pn) newPrd.push({ln: ln, o: {CompanyID: co, Name: pn, ProductCode: pc, DefaultUnit: un, SstID: sstid, VatRate: tr_(r.VatRate), _g: tr_(r.GroupName), _s: tr_(r.SubGroupName)}});
      if (pr && tr_(r.GroupName) && !String(pr.GroupID || '')) fill.push({pr: pr, g: tr_(r.GroupName), s: tr_(r.SubGroupName)});
      if (un && !um[nn_(un)]) newUnits[nn_(un)] = un;
      lines.push(ln);
    });
    function sumCol(c) { var vals = L.map(function (r) { return ns_(r[c]) || 0; }), same = vals.every(function (v) { return v === vals[0]; }); return setm === 3 && !same ? vals.reduce(function (a, b) { return a + b; }, 0) : vals[0]; }
    var pay = {CompanyID: co, CustomerID: cu ? cu.CustomerID : '', SerialNo: serial, DateJalali: tr_(f.DateJalali), TimeHM: fa2en_(tr_(f.TimeHM)) || '12:00', Inty: inty, Inp: inp, Ins: 1, Setm: setm,
      Cap: sumCol('Cap'), Insp: sumCol('Insp'), Notes: tr_(f.Notes), x: {crn: fa2en_(tr_(f.Crn)), billid: fa2en_(tr_(f.BillId))}, items: lines};
    if (!errs.length) {
      var s = sl_normalize_(pay), v = sl_validate_(s, {company: company, customer: cu || {}, ref: null, refItems: null, nowIso: nowIso});
      meta.total = v.calc.totals.Tbill;
      /* ایرادهای «آمادگی ارسال به مودیان» مانع ثبت نیستند؛ صورتحساب به‌صورت پیش‌نویس ثبت می‌شود و بعداً از فرم ویرایش تکمیل می‌گردد */
      if (v.errors.length) {
        var uq = [], seenE = {};
        v.errors.forEach(function (z) { var k = z.replace(/^ردیف \d+: /, ''); if (!seenE[k]) { seenE[k] = 1; uq.push(k); } });
        soft = (soft ? soft + '؛ ' : '') + uq.slice(0, 2).join('؛ ') + (uq.length > 2 ? ' (+' + (uq.length - 2) + ' مورد دیگر)' : '');
      }
    }
    if (errs.length) return out(f, 'err', errs.slice(0, 3).join('؛ ') + (errs.length > 3 ? ' (+' + (errs.length - 3) + ' خطای دیگر)' : ''), meta);
    if (seen[serial]) return out(f, 'dup', 'سریال ' + serial + ' برای این شرکت قبلاً ثبت شده است.', meta);
    var needNew = !!newCu || newPrd.length > 0 || Object.keys(newUnits).length > 0;
    if (needNew && !commit) { meta.nw = 1; S.nw++; if (newCu) nl.cu[nn_(newCu.Name)] = 1; newPrd.forEach(function (z) { nl.prd[nn_(z.o.Name)] = 1; }); Object.keys(newUnits).forEach(function (z) { nl.u[z] = 1; }); }
    if (needNew && !p.createNew) return out(f, 'blocked', 'شامل مشتری، کالا یا واحد جدید است؛ گزینه ایجاد را فعال کنید.', meta);
    seen[serial] = 1;
    plans.push({f: f, meta: meta, pay: pay, newCu: newCu, newPrd: newPrd, newUnits: newUnits, fill: fill});
    if (soft) { S.draft++; out(f, 'ok', 'ثبت می‌شود؛ برای ارسال به مودیان نیاز به تکمیل دارد: ' + soft, meta); } else out(f, 'ok', '', meta);
  });
  if (commit && plans.length) {
    locked_(function () { sl_bulkCommit_(plans, {co: co, company: company, um: um, cuN: cuN, cuE: cuE, prN: prN, prC: prC, nowIso: nowIso, S: S, n: n, items: items}); });
  }
  if (commit) {
    bump_();
    appendRows_(sh_('ImportLog'), [[p.importId || '', nowStr_(), p.fileName || '', co, S.read, S.ok, S.dup, S.err, n.cu, n.prd, 'Done']]);
  }
  var rank = {err: 0, blocked: 1, dup: 2, ok: 3};
  items.sort(function (a, b) { return rank[a.st] - rank[b.st]; });
  var res = {summary: S, n: n, total: items.length, items: items.slice(0, 300)};
  if (!commit) res.nl = {cu: Object.keys(nl.cu), prd: Object.keys(nl.prd), u: Object.keys(nl.u)};
  return res;
}

/* ===== کدگذاری خودکار =====
   کالا: [کد گروه ۲رقمی][ترتیبی ۴رقمی] مثال 010001 (بدون گروه: 00)
   مشتری: 1 + ۵ رقم ترتیبی (100001، 100002، ...)   فروشنده: 2 + ۵ رقم ترتیبی (200001، ...)
   کدهای موجود هرگز تغییر نمی‌کنند. */
function cd_pad_(n, l) { var t = String(n); while (t.length < l) t = '0' + t; return t; }
function cd_state_(n, co) {
  var cf = CODEF[n], used = {}, mx = {}, grp = {};
  if (n === 'Products') rows_('ProductGroups').forEach(function (g) { var m = String(g.GroupID).match(/(\d+)$/); grp[g.GroupID] = m ? cd_pad_(Number(m[1]) % 100, 2) : '00'; });
  var rs = rows_(n).filter(function (r) { return r.CompanyID === co; });
  rs.forEach(function (r) {
    var c = String(r[cf] == null ? '' : r[cf]).trim();
    if (!c) return;
    used[c] = 1;
    var m = n === 'Products' ? c.match(/^(\d{2})(\d{4})$/) : c.match(/^([12])(\d{5})$/);
    if (m) mx[m[1]] = Math.max(mx[m[1]] || 0, Number(m[2]));
  });
  return {rs: rs, used: used, mx: mx, grp: grp};
}
function cd_next_(n, st, r) {
  var pf = n === 'Customers' ? '1' : n === 'Suppliers' ? '2' : (r.GroupID && st.grp[r.GroupID] ? st.grp[r.GroupID] : '00'), code;
  do { st.mx[pf] = (st.mx[pf] || 0) + 1; code = pf + cd_pad_(st.mx[pf], n === 'Products' ? 4 : 5); } while (st.used[code]);
  st.used[code] = 1;
  return code;
}
function nextCode_(n, o) { return cd_next_(n, cd_state_(n, o.CompanyID), o); }
function cd_plan_(n, co) {
  var st = cd_state_(n, co), cf = CODEF[n], nf = NAMEF[n], plan = [];
  st.rs.forEach(function (r) {
    if (String(r[cf] == null ? '' : r[cf]).trim()) return;
    plan.push({id: r[KEY[n]], name: r[nf], code: cd_next_(n, st, r)});
  });
  return {plan: plan, total: st.rs.length};
}
/* بدون قفل؛ فقط داخل عملیاتی که خودش قفل دارد صدا زده شود */
function codeFill_(n, co) {
  var q = cd_plan_(n, co);
  if (!q.plan.length) return 0;
  var s = sh_(n), col = H[n].indexOf(CODEF[n]) + 1, last = s.getLastRow();
  var ids = s.getRange(2, 1, last - 1, 1).getValues(), cur = s.getRange(2, col, last - 1, 1).getValues(), map = {}, k = 0;
  q.plan.forEach(function (z) { map[z.id] = z.code; });
  for (var i = 0; i < ids.length; i++) if (map[ids[i][0]] && String(cur[i][0] || '').trim() === '') { cur[i][0] = map[ids[i][0]]; k++; }
  s.getRange(2, col, last - 1, 1).setNumberFormat('@').setValues(cur);
  return k;
}
function autoProductCodes_(p) {
  if (!p.company) throw new Error('شرکت را انتخاب کنید.');
  var kinds = ['Products', 'Suppliers', 'Customers'];
  if (!p.commit) {
    var out = {};
    kinds.forEach(function (n) { var q = cd_plan_(n, p.company); out[n] = {total: q.total, toAssign: q.plan.length, sample: q.plan.slice(0, 6)}; });
    return out;
  }
  return locked_(function () {
    var out = {};
    kinds.forEach(function (n) { out[n] = codeFill_(n, p.company); });
    bump_();
    return out;
  });
}

/* ===== کلید خصوصی شرکت (برای امضای صورتحساب‌های مودیان) =====
   کلید در Script Properties ذخیره می‌شود، نه در Sheet و نه در پشتیبان؛
   هرگز به مرورگر برگردانده نمی‌شود (فقط وضعیت «ثبت‌شده/نشده»). */
function hasCompanyKey_(co) { return !!PropertiesService.getScriptProperties().getProperty('PK_' + co); }
function getCompanyKey_(co) { return PropertiesService.getScriptProperties().getProperty('PK_' + co) || ''; }
function setCompanyKey_(p) {
  if (!p.company) throw new Error('شرکت مشخص نیست.');
  if (!rows_('Companies').some(function (c) { return c.CompanyID === p.company; })) throw new Error('شرکت پیدا نشد.');
  var props = PropertiesService.getScriptProperties();
  if (p.remove) { props.deleteProperty('PK_' + p.company); return {has: false}; }
  var k = String(p.key || '').replace(/\r/g, '').trim();
  if (!k) throw new Error('کلید خالی است.');
  if (/PUBLIC KEY|CERTIFICATE/.test(k)) throw new Error('این کلید عمومی/گواهی است؛ «کلید خصوصی» (PRIVATE KEY) لازم است.');
  var m = k.match(/^-----BEGIN ((?:RSA )?PRIVATE KEY)-----([A-Za-z0-9+\/=\s]+)-----END \1-----$/);
  if (!m) throw new Error('قالب کلید نامعتبر است. باید با -----BEGIN PRIVATE KEY----- شروع و با -----END PRIVATE KEY----- تمام شود.');
  var b64 = m[2].replace(/\s+/g, '');
  if (b64.length < 600 || b64.length % 4 !== 0) throw new Error('محتوای کلید ناقص یا خراب است (طول نامعتبر).');
  var lines = b64.match(/.{1,64}/g).join('\n');
  props.setProperty('PK_' + p.company, '-----BEGIN ' + m[1] + '-----\n' + lines + '\n-----END ' + m[1] + '-----');
  return {has: true};
}


/* گواهی امضا (گواهی عمومی همراه کلید خصوصی) */
function hasCompanyCert_(co) { return !!PropertiesService.getScriptProperties().getProperty('CERT_' + co); }
function getCompanyCert_(co) { return PropertiesService.getScriptProperties().getProperty('CERT_' + co) || ''; }
function setCompanyCert_(p) {
  if (!p.company) throw new Error('شرکت مشخص نیست.');
  if (!rows_('Companies').some(function (c) { return c.CompanyID === p.company; })) throw new Error('شرکت پیدا نشد.');
  var props = PropertiesService.getScriptProperties();
  if (p.remove) { props.deleteProperty('CERT_' + p.company); return {has: false}; }
  var k = String(p.cert || '').replace(/\r/g, '').trim();
  if (!k) throw new Error('گواهی خالی است.');
  if (/PRIVATE KEY/.test(k)) throw new Error('این «کلید خصوصی» است؛ در این قسمت «گواهی» (CERTIFICATE) لازم است.');
  var b64 = k.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+\/=]+$/.test(b64) || b64.length < 400) throw new Error('محتوای گواهی نامعتبر یا ناقص است.');
  props.setProperty('CERT_' + p.company, '-----BEGIN CERTIFICATE-----\n' + b64.match(/.{1,64}/g).join('\n') + '\n-----END CERTIFICATE-----');
  return {has: true};
}

/* ===== ثبت دسته‌ایِ فاکتورهای فروش (سریع: یک‌باره نوشتن در Sheet) ===== */
function ent_bulk_(n, objs) {
  if (!objs.length) return [];
  var h = H[n], now = nowStr_(), ids = nextIds_(PF[n], objs.length), cf = CODEF[n], st = cf ? cd_state_(n, objs[0].CompanyID) : null;
  var rows = objs.map(function (o, i) {
    o[KEY[n]] = ids[i];
    if (cf && !String(o[cf] || '').trim()) o[cf] = cd_next_(n, st, o);
    return h.map(function (k) {
      if (k === KEY[n]) return ids[i];
      if (k === 'CreatedAt' || k === 'UpdatedAt') return now;
      if (k === 'IsActive') return o.IsActive !== false;
      return o.hasOwnProperty(k) ? o[k] : '';
    });
  });
  appendRows_(sh_(n), rows);
  return objs;
}
function sl_appendBig_(sheet, rows) {
  for (var i = 0; i < rows.length; i += 4000) appendRows_(sheet, rows.slice(i, i + 4000));
}
function sl_bulkCommit_(plans, c) {
  var now = nowStr_(), S = c.S, n = c.n, items = c.items, co = c.co;
  /* ۱) واحد/مشتری/کالای جدید: همه با یک نوشتن */
  var nu = {}, ncu = {}, npr = {};
  plans.forEach(function (pl) {
    Object.keys(pl.newUnits).forEach(function (k) { if (!c.um[k]) nu[k] = pl.newUnits[k]; });
    if (pl.newCu && !c.cuN[nn_(pl.newCu.Name)]) ncu[nn_(pl.newCu.Name)] = pl.newCu;
    pl.newPrd.forEach(function (np) { var k = nn_(np.o.Name); if (!c.prN[k] && !npr[k]) npr[k] = np.o; });
  });
  ent_bulk_('Units', Object.keys(nu).map(function (k) { return {CompanyID: co, UnitName: nu[k]}; })).forEach(function (o) { c.um[nn_(o.UnitName)] = o; n.u++; });
  ent_bulk_('Customers', Object.keys(ncu).map(function (k) { return ncu[k]; })).forEach(function (o) { c.cuN[nn_(o.Name)] = o; if (o.EconomicCode) c.cuE[o.EconomicCode] = o; n.cu++; });
  /* گروه اصلی/فرعی کالاها (کالای جدید + تکمیل کالاهای موجودِ بدون گروه) */
  var gm = {}, sm = {}, pairs = [], fillM = {};
  rows_('ProductGroups').forEach(function (g) { if (g.CompanyID === co) gm[nn_(g.GroupName)] = g.GroupID; });
  rows_('ProductSubGroups').forEach(function (g) { if (g.CompanyID === co) sm[g.GroupID + '|' + nn_(g.SubGroupName)] = g.SubGroupID; });
  Object.keys(npr).forEach(function (k) { if (npr[k]._g) pairs.push({g: npr[k]._g, s: npr[k]._s}); });
  plans.forEach(function (pl) { (pl.fill || []).forEach(function (f) { if (!fillM[f.pr.ProductID]) { fillM[f.pr.ProductID] = f; pairs.push({g: f.g, s: f.s}); } }); });
  var ng = {}, nsb = {};
  pairs.forEach(function (x) { if (!gm[nn_(x.g)]) ng[nn_(x.g)] = x.g; });
  ent_bulk_('ProductGroups', Object.keys(ng).map(function (k) { return {CompanyID: co, GroupName: ng[k]}; })).forEach(function (o) { gm[nn_(o.GroupName)] = o.GroupID; n.g++; });
  pairs.forEach(function (x) { if (x.s && !sm[gm[nn_(x.g)] + '|' + nn_(x.s)]) nsb[gm[nn_(x.g)] + '|' + nn_(x.s)] = {CompanyID: co, GroupID: gm[nn_(x.g)], SubGroupName: x.s}; });
  ent_bulk_('ProductSubGroups', Object.keys(nsb).map(function (k) { return nsb[k]; })).forEach(function (o) { sm[o.GroupID + '|' + nn_(o.SubGroupName)] = o.SubGroupID; n.s++; });
  Object.keys(npr).forEach(function (k) { var o = npr[k]; if (o._g) { o.GroupID = gm[nn_(o._g)]; if (o._s) o.SubGroupID = sm[o.GroupID + '|' + nn_(o._s)] || ''; } });
  var fk = Object.keys(fillM);
  if (fk.length) {
    var ps = sh_('Products'), last = ps.getLastRow(), hh = H.Products, cg = hh.indexOf('GroupID') + 1, cs = hh.indexOf('SubGroupID') + 1;
    if (last >= 2) {
      var ids = ps.getRange(2, 1, last - 1, 1).getValues(), gv = ps.getRange(2, cg, last - 1, 1).getValues(), sv = ps.getRange(2, cs, last - 1, 1).getValues();
      ids.forEach(function (r, i) { var f = fillM[r[0]]; if (f && !String(gv[i][0] || '')) { gv[i][0] = gm[nn_(f.g)]; sv[i][0] = f.s ? (sm[gm[nn_(f.g)] + '|' + nn_(f.s)] || '') : ''; } });
      ps.getRange(2, cg, last - 1, 1).setValues(gv); ps.getRange(2, cs, last - 1, 1).setValues(sv);
    }
  }
  ent_bulk_('Products', Object.keys(npr).map(function (k) { return npr[k]; })).forEach(function (o) { c.prN[nn_(o.Name)] = o; if (o.ProductCode) c.prC[nn_(o.ProductCode)] = o; n.prd++; });
  /* ۲) ساخت ردیف‌ها در حافظه */
  var built = [], total = 0, byId = {};
  Object.keys(c.cuN).forEach(function (k) { byId[c.cuN[k].CustomerID] = c.cuN[k]; });
  plans.forEach(function (pl) {
    try {
      var cu = null;
      if (pl.newCu) { cu = c.cuN[nn_(pl.newCu.Name)]; pl.pay.CustomerID = cu.CustomerID; }
      else if (pl.pay.CustomerID) cu = null;
      pl.pay.items.forEach(function (l) { if (!l.ProductID) { var q = c.prN[nn_(l.Sstt)]; if (q) l.ProductID = q.ProductID; } });
      var s = sl_normalize_(pl.pay);
      var custObj = cu || byId[pl.pay.CustomerID] || {};
      var v = sl_validate_(s, {company: c.company, customer: custObj, ref: null, refItems: null, nowIso: c.nowIso});
      built.push({pl: pl, s: s, v: v});
      total += s.items.length;
    } catch (e) {
      S.ok--; S.err++;
      items.forEach(function (it) { if (it.key === pl.meta.key) { it.st = 'err'; it.m = 'ثبت نشد: ' + (e.message || e); } });
    }
  });
  if (!built.length) return;
  var sIds = nextIds_(PF.SalesInvoices, built.length), tIds = nextIds_(PF.SalesItems, total), ti = 0, hrows = [], irows = [];
  built.forEach(function (b, bi) {
    var s = b.s, v = b.v, T = v.calc.totals, id = sIds[bi], status = v.errors.length ? 'پیش‌نویس' : 'آماده ارسال';
    var m = {SaleID: id, CompanyID: s.h.CompanyID, CustomerID: s.h.CustomerID, SerialNo: s.h.SerialNo, DateJalali: s.h.DateJalali, DateGregorian: s.h.DateGregorian, TimeHM: s.h.TimeHM,
      Inty: s.h.Inty, Inp: s.h.Inp, Ins: s.h.Ins, RefSaleID: '', RefTaxID: '', Setm: s.h.Setm, Cap: s.h.Cap, Insp: s.h.Insp,
      Tprdis: T.Tprdis, Tdis: T.Tdis, Tadis: T.Tadis, Tvam: T.Tvam, Todam: T.Todam, Tbill: T.Tbill, Extra: JSON.stringify(s.h.x), TaxNo: '',
      SendStatus: status, SendRef: '', SendError: '', SentAt: '', Superseded: '', ItemCount: s.items.length, Notes: s.h.Notes, CreatedAt: now, UpdatedAt: now};
    hrows.push(H.SalesInvoices.map(function (k) { return m.hasOwnProperty(k) ? m[k] : ''; }));
    s.items.forEach(function (l, i) {
      var cl = v.calc.lines[i], ex = {};
      SL_LINE_X.forEach(function (k) { if (l[k] !== undefined) ex[k] = l[k]; });
      var im = {SItemID: tIds[ti++], SaleID: id, LineNo: i + 1, ProductID: l.ProductID, Sstid: l.Sstid, Sstt: l.Sstt, Mu: l.Mu, Am: cl.Am, Fee: cl.Fee, Prdis: cl.Prdis, Dis: cl.Dis, Adis: cl.Adis,
        Vra: cl.Vra, Vam: cl.Vam, Odt: l.Odt, Odr: l.Odr, Odam: cl.Odam, Olt: l.Olt, Olr: l.Olr, Olam: cl.Olam, Tsstam: cl.Tsstam, Extra: JSON.stringify(ex)};
      irows.push(H.SalesItems.map(function (k) { return im.hasOwnProperty(k) ? im[k] : ''; }));
    });
  });
  sl_appendBig_(sh_('SalesInvoices'), hrows);
  sl_appendBig_(sh_('SalesItems'), irows);
}


/* ===== داشبورد فروش (خریداران، کالا و خدمات) ===== */
function salesDash_(f) {
  f = f || {};
  var g1 = f.from ? parseJ_(f.from) : null, g2 = f.to ? parseJ_(f.to) : null;
  var hdr = {}, invCnt = {}, custs = {}, drafts = {}, DG = {all: 0, superseded: 0, cancel: 0, rejected: 0};
  rows_('SalesInvoices').forEach(function (s) {
    if (f.company && s.CompanyID !== f.company) return;
    if (f.customer && s.CustomerID !== f.customer) return;
    if (g1 && s.DateGregorian < g1.g) return;
    if (g2 && s.DateGregorian > g2.g) return;
    var ins = Number(s.Ins);
    DG.all++;
    if (String(s.Superseded) === '1') { DG.superseded++; return; }
    if (ins === 3) { DG.cancel++; return; }
    if (s.SendStatus === 'ردشده') { DG.rejected++; return; }
    hdr[s.SaleID] = s;
  });
  var cn = {}, gn = {}, sn = {}, prods = {};
  rows_('Customers').forEach(function (c) { cn[c.CustomerID] = c.Name; });
  rows_('ProductGroups').forEach(function (g) { gn[g.GroupID] = g.GroupName; });
  rows_('ProductSubGroups').forEach(function (g) { sn[g.SubGroupID] = g.SubGroupName; });
  rows_('Products').forEach(function (p) { if (!f.company || p.CompanyID === f.company) prods[p.ProductID] = p; });
  rows_('Services').forEach(function (p) { if (!f.company || p.CompanyID === f.company) prods[p.ServiceID] = {Name: p.Name, svc: true}; });
  var acc = {}, T = {gross: 0, disc: 0, net: 0, vat: 0, total: 0}, num = function (x) { return Number(x) || 0; };
  var bump = function (cat, key, name, sg, o) {
    var m = acc[cat] = acc[cat] || {}, a = m[key] = m[key] || {name: name, qty: 0, gross: 0, disc: 0, net: 0, vat: 0, total: 0, _i: {}};
    a.qty += sg * o.qty; a.gross += sg * o.gross; a.disc += sg * o.disc; a.net += sg * o.net; a.vat += sg * o.vat; a.total += sg * o.total; a._i[o.id] = 1;
  };
  rows_('SalesItems').forEach(function (it) {
    var s = hdr[it.SaleID]; if (!s) return;
    var p = prods[it.ProductID] || {};
    if (f.product && it.ProductID !== f.product) return;
    if (f.group && p.GroupID !== f.group) return;
    if (f.subgroup && p.SubGroupID !== f.subgroup) return;
    var sg = Number(s.Ins) === 4 ? -1 : 1,
        o = {id: s.SaleID, qty: num(it.Am), gross: num(it.Prdis), disc: num(it.Dis), net: num(it.Adis), vat: num(it.Vam) + num(it.Odam) + num(it.Olam), total: num(it.Tsstam)};
    T.gross += sg * o.gross; T.disc += sg * o.disc; T.net += sg * o.net; T.vat += sg * o.vat; T.total += sg * o.total;
    invCnt[s.SaleID] = 1; custs[s.CustomerID || '-'] = 1;
    if (s.SendStatus === 'پیش‌نویس') drafts[s.SaleID] = 1;
    bump('cu', s.CustomerID || '-', s.CustomerID ? (cn[s.CustomerID] || '؟') : 'بدون مشتری (فروش خرد)', sg, o);
    bump('grp', p.svc ? 'SVC' : (p.GroupID || '-'), p.svc ? 'خدمات' : (gn[p.GroupID] || 'بدون گروه'), sg, o);
    bump('sub', p.svc ? 'SVC' : (p.SubGroupID || '-'), p.svc ? 'خدمات' : (sn[p.SubGroupID] || 'بدون گروه فرعی'), sg, o);
    var mo = String(s.DateJalali).substring(0, 7);
    bump('mon', mo, mo, sg, o);
    bump('prd', it.ProductID, p.Name || it.Sstt || '؟', sg, o);
  });
  var out = function (cat, sortKey, lim) {
    var a = Object.keys(acc[cat] || {}).map(function (k) {
      var o = acc[cat][k];
      return {key: k, name: o.name, count: Object.keys(o._i).length, qty: r2_(o.qty), gross: r2_(o.gross), disc: r2_(o.disc), net: r2_(o.net), vat: r2_(o.vat), total: r2_(o.total)};
    });
    if (sortKey === 'name') a.sort(function (x, y) { return x.name < y.name ? -1 : 1; });
    else a.sort(function (x, y) { return y[sortKey] - x[sortKey]; });
    return lim ? a.slice(0, lim) : a;
  };
  return {
    total: {gross: r2_(T.gross), disc: r2_(T.disc), net: r2_(T.net), vat: r2_(T.vat), total: r2_(T.total), invoices: Object.keys(invCnt).length, customers: Object.keys(custs).length, drafts: Object.keys(drafts).length},
    diag: DG,
    byCustomer: out('cu', 'total'), byGroup: out('grp', 'net'), bySub: out('sub', 'net'), byMonth: out('mon', 'name'), byProduct: out('prd', 'net', 100)
  };
}
