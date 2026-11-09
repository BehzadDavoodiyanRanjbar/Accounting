/* ===== سال مالی، بستن حساب‌ها و افتتاح سال بعد =====
   - هر شرکت: ماه شروع سال مالی (پیش‌فرض فروردین). سال مالی با «سال شمسیِ شروع» شناخته می‌شود (StartY).
   - جدول FiscalYears فقط وضعیت سال‌های «بسته‌شده» را نگه می‌دارد؛ سال‌ها از روی تاریخ محاسبه می‌شوند.
   - اسناد سیستمی (Source='sys') با SrcID = شناسه‌ی ردیف سال بسته‌شده:
       close_tax (ذخیره مالیات) | close_pl (بستن حساب‌های سود و زیان به خلاصه سود و زیان) | close_ret (انتقال به سود انباشته)
       close_res (انتقال به اندوخته قانونی) | close_bs (اختتامیه‌ی حساب‌های ترازنامه‌ای) | open_bs (افتتاحیه‌ی سال بعد)
   - سال بسته: هیچ سند/فاکتور/بانک/چکی با تاریخ در آن ثبت یا ویرایش نمی‌شود؛ فقط مدیر سیستم می‌تواند «باز کردن مجدد» کند. */

H.FiscalYears = ['FYID', 'CompanyID', 'StartY', 'Status', 'ClosedAt', 'ReopenedAt', 'Info'];
H.StockAdj = ['AdjID', 'CompanyID', 'ProductID', 'DateJalali', 'DateGregorian', 'Qty', 'UnitCost', 'Reason', 'FYID', 'CreatedAt'];

var FY_TIER = {open_bs: 0, close_bal: 1, close_tax: 1, close_pl: 2, close_ret: 3, close_res: 4, close_bs: 5};
var FY_PENDING = [];
var FY_SYS_LABEL = {close_bal: 'سند توازن (اصلاح ماهیت مانده‌ها)', close_tax: 'ذخیره مالیات عملکرد', close_pl: 'بستن حساب‌های سود و زیان', close_ret: 'انتقال سود (زیان) به سود انباشته', close_res: 'انتقال به اندوخته قانونی', close_bs: 'اختتامیه', open_bs: 'افتتاحیه'};

function fy_pad_(x) { return ('0' + x).slice(-2); }
function fy_addDay_(g, n) { var d = new Date(g + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().substring(0, 10); }
function fy_g_(jy, jm, jd) { var g = j2g_(jy, jm, jd); return g[0] + '-' + fy_pad_(g[1]) + '-' + fy_pad_(g[2]); }
function fy_j_(g) { var a = String(g).split('-').map(Number), j = g2j_(a[0], a[1], a[2]); return j[0] + '/' + fy_pad_(j[1]) + '/' + fy_pad_(j[2]); }
function fy_month_(co) { var m = parseInt(getSet_('acFYStart_' + co), 10); return m >= 1 && m <= 12 ? m : 1; }
/* بازه‌ی سال مالی که از سال شمسی sy شروع می‌شود */
function fy_range_(co, sy, m) {
  m = m || fy_month_(co);
  var fg = fy_g_(sy, m, 1), ng = fy_g_(sy + 1, m, 1), tg = fy_addDay_(ng, -1), fj = sy + '/' + fy_pad_(m) + '/01', tj = fy_j_(tg);
  return {sy: sy, fg: fg, tg: tg, fj: fj, tj: tj, ng: ng, nj: (sy + 1) + '/' + fy_pad_(m) + '/01', title: m === 1 ? 'سال مالی ' + sy : 'سال مالی ' + fj + ' تا ' + tj};
}
/* سال مالیِ شامل یک تاریخ میلادی (yyyy-mm-dd) */
function fy_of_(co, g, m) {
  m = m || fy_month_(co);
  var a = String(g).split('-').map(Number), j = g2j_(a[0], a[1], a[2]);
  return fy_range_(co, j[1] >= m ? j[0] : j[0] - 1, m);
}
function fy_row_(co, sy) { return rows_('FiscalYears').filter(function (r) { return r.CompanyID === co && Number(r.StartY) === Number(sy); })[0] || null; }
function fy_closedRows_(co) { return rows_('FiscalYears').filter(function (r) { return r.CompanyID === co && r.Status === 'closed'; }); }
/* تابعی که برای یک تاریخ، سال بسته‌ی شامل آن را برمی‌گرداند (یا null)؛ اگر هیچ سالی بسته نیست، خودِ null */
function fy_info_(row) { try { return JSON.parse((row && row.Info) || '{}') || {}; } catch (e) { return {}; } }
function fy_dirty_(row) { return !!fy_info_(row).dirty; }
function fy_closedFn_(co, cleanOnly) {
  var cl = fy_closedRows_(co).filter(function (r) { return !cleanOnly || !fy_dirty_(r); }); if (!cl.length) return null;
  var m = fy_month_(co), rs = cl.map(function (r) { return fy_range_(co, Number(r.StartY), m); });
  return function (g) { for (var i = 0; i < rs.length; i++) if (g >= rs[i].fg && g <= rs[i].tg) return rs[i]; return null; };
}
/* دروازه‌ی سال بسته: کاربر عادی هرگز؛ مدیر سیستم با تأیید (ackClosed) و سپس سال «نیازمند بستن مجدد» می‌شود */
function fy_gate_(co, g, p, what) {
  var f = fy_closedFn_(co); if (!f || !g) return;
  var r = f(g); if (!r) return;
  var row = fy_row_(co, r.sy);
  if (!p || !p._adm) throw new Error((what ? what + ': ' : '') + 'تاریخ در «' + r.title + '» است که بسته شده است؛ فقط مدیر سیستم می‌تواند اطلاعات آن را ویرایش کند.');
  if (!fy_dirty_(row) && !(p.ackClosed === true || String(p.ackClosed) === 'true')) throw new Error('FYCLOSED|' + r.title);
  FY_PENDING.push({co: co, sy: r.sy});
}
function fy_markDirty_(co, sy) {
  var ch = 0;
  fy_closedRows_(co).forEach(function (r) {
    if (Number(r.StartY) < sy) return;
    var i = fy_info_(r); if (i.dirty) return;
    i.dirty = 1; i.dirtyAt = nowStr_(); r.Info = JSON.stringify(i); pr_setRow_('FiscalYears', 'FYID', r.FYID, r); ch++;
  });
  if (ch) bump_();
}
function fy_flushDirty_() { var l = FY_PENDING; FY_PENDING = []; l.forEach(function (x) { fy_markDirty_(x.co, x.sy); }); }
/* اگر سالِ شامل g سند افتتاحیه داشته باشد، تاریخ شروع آن سال (تاریخ افتتاحیه) را می‌دهد؛ وگرنه '' */
function fy_floorG_(co, g) {
  if (!g) return '';
  var r = fy_of_(co, g), hit = '';
  rows_('Vouchers').forEach(function (v) { if (!hit && v.CompanyID === co && String(v.Source) === 'sys' && v.SrcType === 'open_bs' && v.DateGregorian >= r.fg && v.DateGregorian <= r.tg) hit = r.fg; });
  return hit;
}
/* دید گزارش‌ها نسبت به اسناد اختتامیه/افتتاحیه
   kind: 'all' | 'trial' | 'bs' | 'pl'
   - اگر افتتاحیه دیده شود و اختتامیه دیده نشود، سابقه‌ی قبل از افتتاحیه حذف می‌شود تا مانده‌ها دوبار حساب نشوند. */
function fy_ctx_(co, p, kind, icDef, ioDef) {
  var io = ac_b_(p.incOpen, ioDef !== false), ic = ac_b_(p.incClose, icDef === undefined ? kind === 'all' : icDef), f = tr_(p.from) ? ac_dateReq_(p.from, 'از تاریخ').g : '', L = '';
  if ((kind === 'all' || kind === 'trial') && io && !ic && f) L = fy_floorG_(co, f);
  return {kind: kind, io: io, ic: ic, L: L};
}
function fy_ok_(Z, v) {
  if (Z.L && v.DateGregorian < Z.L) return false;
  if (String(v.Source) !== 'sys') return true;
  var t = tr_(v.SrcType);
  if (t === 'close_pl' || t === 'close_ret' || t === 'close_bs') {
    if (Z.kind === 'bs') return t !== 'close_bs';
    if (Z.kind === 'pl') return false;
    return Z.ic;
  }
  if (t === 'open_bs') {
    if (Z.kind === 'bs' || Z.kind === 'pl' || !Z.io) return false;
    return Z.ic || (!!Z.L && v.DateGregorian === Z.L);
  }
  return true;
}
function fy_tier_(v) { return String(v.Source) === 'sys' && FY_TIER[v.SrcType] !== undefined ? FY_TIER[v.SrcType] : 1; }

/* ---------- شماره‌ی سند به تفکیک سال مالی ---------- */
function ac_nextNo_(co, g) {
  var r = fy_of_(co, g || parseJ_(pr_today_()).g), mx = 0;
  rows_('Vouchers').forEach(function (v) { if (v.CompanyID === co && v.DateGregorian >= r.fg && v.DateGregorian <= r.tg) { var n = parseInt(String(v.No), 10); if (n > mx) mx = n; } });
  return String(mx + 1);
}
/* تخصیص‌دهنده‌ی شماره برای چند سند جدید (هر سال شمارنده‌ی خودش) */
function ac_noAlloc_(co) {
  var m = fy_month_(co), mx = {};
  rows_('Vouchers').forEach(function (v) { if (v.CompanyID !== co) return; var k = fy_of_(co, v.DateGregorian, m).sy, n = parseInt(String(v.No), 10); if (n > (mx[k] || 0)) mx[k] = n; });
  return function (g) { var k = fy_of_(co, g, m).sy; mx[k] = (mx[k] || 0) + 1; return String(mx[k]); };
}
/* شماره‌گذاری مجدد: هر سال مالی از ۱؛ بر اساس تاریخ، سپس افتتاحیه اول و اختتامیه‌ها آخر، سپس شماره‌ی ارجاع */
function ac_renumber_(co, includeClosed) {
  var m = fy_month_(co), closed = fy_closedFn_(co, true), by = {};
  rows_('Vouchers').forEach(function (v) {
    if (v.CompanyID !== co) return;
    if (!includeClosed && closed && closed(v.DateGregorian)) return;
    var k = fy_of_(co, v.DateGregorian, m).sy; (by[k] = by[k] || []).push(v);
  });
  var ch = [], total = 0;
  Object.keys(by).forEach(function (k) {
    var l = by[k];
    l.sort(function (a, b) {
      return a.DateGregorian < b.DateGregorian ? -1 : (a.DateGregorian > b.DateGregorian ? 1 :
        ((fy_tier_(a) - fy_tier_(b)) || (Number(a.RefNo) - Number(b.RefNo)) || (a.VID < b.VID ? -1 : 1)));
    });
    l.forEach(function (v, i) { total++; var n = String(i + 1); if (String(v.No) !== n) { v.No = n; v.UpdatedAt = nowStr_(); ch.push(v); } });
  });
  ac_rewriteHeads_(ch);
  return {total: total, changed: ch.length};
}
function ac_isSorted_(co) {
  var m = fy_month_(co), by = {};
  rows_('Vouchers').forEach(function (v) { if (v.CompanyID === co) { var k = fy_of_(co, v.DateGregorian, m).sy; (by[k] = by[k] || []).push(v); } });
  return Object.keys(by).every(function (k) {
    var l = by[k]; l.sort(function (a, b) { return Number(a.No) - Number(b.No); });
    for (var i = 1; i < l.length; i++) if (l[i].DateGregorian < l[i - 1].DateGregorian) return false;
    return true;
  });
}

/* ---------- محافظ سال بسته برای اسناد مبدأ (فاکتور، بانک، چک، هزینه، تولید) ---------- */
var FY_GUARD = {
  saveInvoice: ['PurchaseInvoices', 'InvoiceID'], deleteInvoice: ['PurchaseInvoices', 'InvoiceID'],
  saveSale: ['SalesInvoices', 'SaleID'], deleteSale: ['SalesInvoices', 'SaleID'], saleStatus: ['SalesInvoices', 'SaleID'],
  expenseSave: ['ExpenseInvoices', 'ExpenseID'], expenseDelete: ['ExpenseInvoices', 'ExpenseID'],
  bankTxSave: ['BankTx', 'TxID'], bankTxDelete: ['BankTx', 'TxID'],
  transferSave: ['Transfers', 'TransferID'], transferDelete: ['Transfers', 'TransferID'],
  chequeSave: ['Cheques', 'ChequeID'], chequeDelete: ['Cheques', 'ChequeID'], chequeStatus: ['Cheques', 'ChequeID'],
  prodSave: ['ProdOrders', 'OrderID'], prodStatus: ['ProdOrders', 'OrderID'], prodDelete: ['ProdOrders', 'OrderID'], prodCreate: ['ProdOrders', 'OrderID'],
  docPaySave: ['', '']
};
function fy_scanDates_(o, out, depth) {
  if (!o || depth > 4) return;
  if (Array.isArray(o)) { o.forEach(function (x) { fy_scanDates_(x, out, depth + 1); }); return; }
  if (typeof o !== 'object') return;
  Object.keys(o).forEach(function (k) {
    var v = o[k];
    if (v && typeof v === 'object') { fy_scanDates_(v, out, depth + 1); return; }
    if (typeof v === 'string' && /date|jalali/i.test(k) && !/^due/i.test(k)) { var d = parseJ_(v); if (d) out.push(d.g); }
  });
}
function fy_guard_(co, action, p) {
  var g = FY_GUARD[action]; if (!co || !g) return;
  var f = fy_closedFn_(co); if (!f) return;
  var ds = []; fy_scanDates_(p, ds, 0);
  var ids = [p.id, p.ID, p.InvoiceID, p.SaleID, p.ExpenseID, p.OrderID, p.TxID, p.TransferID, p.ChequeID];
  if (p.obj) ids.push(p.obj.id, p.obj[g[1]], p.obj.TxID, p.obj.TransferID, p.obj.ChequeID);
  if (action === 'docPaySave') {
    var sh = p.type === 'expense' ? ['ExpenseInvoices', 'ExpenseID'] : ['SalesInvoices', 'SaleID'];
    rows_(sh[0]).forEach(function (r) { if (r[sh[1]] === p.id && r.DateGregorian) ds.push(r.DateGregorian); });
    rows_('DocPayments').forEach(function (r) { if (r.DocID === p.id && r.DateGregorian) ds.push(r.DateGregorian); });
  } else {
    ids = ids.filter(function (x) { return x; });
    if (ids.length) rows_(g[0]).forEach(function (r) { if (ids.indexOf(r[g[1]]) >= 0 && r.DateGregorian) ds.push(r.DateGregorian); });
  }
  for (var i = 0; i < ds.length; i++) fy_gate_(co, ds[i], p, 'این عملیات روی سال مالی بسته اثر می‌گذارد');
}

/* ---------- فهرست سال‌ها ---------- */
function fy_accByCode_(c, code) { var r = null; Object.keys(c.accs).forEach(function (id) { if (String(c.accs[id].Code) === code) r = c.accs[id]; }); return r; }
function yearList_(p) {
  var co = ac_co_(p); ac_open_(co);
  var m = fy_month_(co), cnt = {}, drf = {}, today = parseJ_(pr_today_()).g, cur = fy_of_(co, today, m).sy;
  rows_('Vouchers').forEach(function (v) { if (v.CompanyID !== co) return; var k = fy_of_(co, v.DateGregorian, m).sy; cnt[k] = (cnt[k] || 0) + 1; if (v.Status === 'draft') drf[k] = (drf[k] || 0) + 1; });
  var closedRows = fy_closedRows_(co), cl = {}; closedRows.forEach(function (r) { cl[Number(r.StartY)] = r; });
  var lastClosed = closedRows.length ? Math.max.apply(null, closedRows.map(function (r) { return Number(r.StartY); })) : null;
  var active = lastClosed !== null ? Math.max(cur, lastClosed + 1) : cur;
  var set = {}; Object.keys(cnt).forEach(function (k) { set[k] = 1; }); set[cur] = 1; set[active] = 1;
  var ys = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
  var firstData = Object.keys(cnt).length ? Math.min.apply(null, Object.keys(cnt).map(Number)) : cur;
  var rows = ys.map(function (sy) {
    var R = fy_range_(co, sy, m), row = cl[sy], info = row ? fy_info_(row) : {}, dirty = !!(row && info.dirty);
    var prevOk = true; for (var y = firstData; y < sy; y++) if (!cl[y] || fy_dirty_(cl[y])) { prevOk = false; break; }
    return {sy: sy, title: R.title, fj: R.fj, tj: R.tj, status: row ? 'closed' : 'open', dirty: dirty, closedAt: row ? row.ClosedAt : '', vouchers: cnt[sy] || 0, drafts: drf[sy] || 0, current: sy === active,
      canClose: !row && prevOk, canReopen: !!row && (sy === lastClosed || dirty), profit: info.profit === undefined ? '' : info.profit};
  });
  return {rows: rows, month: m, canChangeMonth: closedRows.length === 0, current: active, active: active, byDate: cur, taxRate: getSet_('acFYTaxRate_' + co) || '25', reservePct: getSet_('acFYResPct_' + co) || '5', capPct: getSet_('acFYCapPct_' + co) || '10'};
}
function yearSave_(p) {
  var co = ac_co_(p);
  return locked_(function () {
    if (p.month !== undefined && tr_(p.month) !== '') {
      var m = parseInt(fa2en_(String(p.month)), 10);
      if (!(m >= 1 && m <= 12)) throw new Error('ماه شروع سال مالی باید عددی بین ۱ تا ۱۲ باشد.');
      if (m !== fy_month_(co)) {
        if (fy_closedRows_(co).length) throw new Error('بعد از بستن یک سال مالی، ماه شروع سال تغییر نمی‌کند. ابتدا سال‌های بسته‌شده را باز کنید.');
        setSet_('acFYStart_' + co, String(m)); ac_renumber_(co, false);
      }
    }
    var num = function (x, d, lo, hi) { var v = Number(fa2en_(String(x === undefined || x === '' ? d : x))); if (!isFinite(v) || v < lo || v > hi) throw new Error('عدد درصد نامعتبر است.'); return String(v); };
    if (p.taxRate !== undefined) setSet_('acFYTaxRate_' + co, num(p.taxRate, 25, 0, 100));
    if (p.reservePct !== undefined) setSet_('acFYResPct_' + co, num(p.reservePct, 5, 0, 100));
    if (p.capPct !== undefined) setSet_('acFYCapPct_' + co, num(p.capPct, 10, 0, 100));
    bump_();
    return {ok: 1};
  });
}

/* ---------- جمع‌زنی مانده‌ها با حفظ تفصیلی/شخص/پروژه ---------- */
function fy_agg_(co, vm, fromG, pred, c) {
  var m = {};
  rp_eachRow_(co, vm, function (r, v) {
    if (fromG && v.DateGregorian < fromG) return;
    var a = c.accs[r.AccID]; if (!a || !pred(String(a.Code))) return;
    var k = [r.AccID, r.DetKind || '', r.DetID || '', r.PartyType || '', r.PartyID || '', r.ProjID || ''].join('|');
    var o = m[k] = m[k] || {AccID: r.AccID, DetKind: r.DetKind || '', DetID: r.DetID || '', PartyType: r.PartyType || '', PartyID: r.PartyID || '', ProjID: r.ProjID || '', code: String(a.Code), net: 0};
    o.net += (Number(r.Debit) || 0) - (Number(r.Credit) || 0);
  });
  return Object.keys(m).map(function (k) { m[k].net = r2_(m[k].net); return m[k]; }).filter(function (o) { return Math.abs(o.net) > 0.004; })
    .sort(function (a, b) { return a.code < b.code ? -1 : (a.code > b.code ? 1 : 0); });
}
var fy_isPL_ = function (code) { var d = code.charAt(0); return d === '6' || d === '7'; };
var fy_isBS_ = function (code) { var d = code.charAt(0); return (d >= '1' && d <= '5') || d === '9'; };

/* محاسبه‌ی سود دوره و پیشنهاد ذخیره/اندوخته */
function fy_calc_(co, R, c) {
  var vm = rp_vm_(co, {}, R.tg, 'pl'), plNet = 0, taxEx = 0, sales = 0;
  rp_eachRow_(co, vm, function (r, v) {
    if (v.DateGregorian < R.fg) return;
    var a = c.accs[r.AccID]; if (!a) return; var code = String(a.Code), x = (Number(r.Credit) || 0) - (Number(r.Debit) || 0);
    if (fy_isPL_(code)) { plNet += x; if (code === '7801') taxEx -= x; if (code.substring(0, 2) === '61' || code.substring(0, 2) === '62') sales += x; }
  });
  var vb = rp_vm_(co, {}, R.tg, 'bs'), cap = 0, res = 0, D = 0, C = 0, cashNeg = [], bal = {};
  rp_eachRow_(co, vb, function (r) {
    var a = c.accs[r.AccID]; if (!a) return; var code = String(a.Code), d = Number(r.Debit) || 0, cr = Number(r.Credit) || 0;
    D += d; C += cr; bal[r.AccID] = (bal[r.AccID] || 0) + d - cr;
    if (code === '5101') cap += cr - d; if (code === '5201') res += cr - d;
  });
  Object.keys(bal).forEach(function (id) { var a = c.accs[id], k = c.accs[a.ParentID]; if (k && String(k.Code) === '11' && bal[id] < -0.5) cashNeg.push(a.Name + ' (' + fmtNum_(r2_(bal[id])) + ')'); });
  return {profit: r2_(plNet), taxExisting: r2_(taxEx), sales: r2_(sales), capital: r2_(cap), reserve: r2_(res), D: r2_(D), C: r2_(C), cashNeg: cashNeg};
}
function yearSave_(p) {
  var co = ac_co_(p);
  return locked_(function () {
    if (p.month !== undefined && tr_(p.month) !== '') {
      var m = parseInt(fa2en_(String(p.month)), 10);
      if (!(m >= 1 && m <= 12)) throw new Error('ماه شروع سال مالی باید عددی بین ۱ تا ۱۲ باشد.');
      if (m !== fy_month_(co)) {
        if (fy_closedRows_(co).length) throw new Error('بعد از بستن یک سال مالی، ماه شروع سال تغییر نمی‌کند. ابتدا سال‌های بسته‌شده را باز کنید.');
        setSet_('acFYStart_' + co, String(m)); ac_renumber_(co, false);
      }
    }
    var num = function (x, d, lo, hi) { var v = Number(fa2en_(String(x === undefined || x === '' ? d : x))); if (!isFinite(v) || v < lo || v > hi) throw new Error('عدد درصد نامعتبر است.'); return String(v); };
    if (p.taxRate !== undefined) setSet_('acFYTaxRate_' + co, num(p.taxRate, 25, 0, 100));
    if (p.reservePct !== undefined) setSet_('acFYResPct_' + co, num(p.reservePct, 5, 0, 100));
    if (p.capPct !== undefined) setSet_('acFYCapPct_' + co, num(p.capPct, 10, 0, 100));
    bump_();
    return {ok: 1};
  });
}

/* ---------- جمع‌زنی مانده‌ها با حفظ تفصیلی/شخص/پروژه ---------- */
function fy_agg_(co, vm, fromG, pred, c) {
  var m = {};
  rp_eachRow_(co, vm, function (r, v) {
    if (fromG && v.DateGregorian < fromG) return;
    var a = c.accs[r.AccID]; if (!a || !pred(String(a.Code))) return;
    var k = [r.AccID, r.DetKind || '', r.DetID || '', r.PartyType || '', r.PartyID || '', r.ProjID || ''].join('|');
    var o = m[k] = m[k] || {AccID: r.AccID, DetKind: r.DetKind || '', DetID: r.DetID || '', PartyType: r.PartyType || '', PartyID: r.PartyID || '', ProjID: r.ProjID || '', code: String(a.Code), net: 0};
    o.net += (Number(r.Debit) || 0) - (Number(r.Credit) || 0);
  });
  return Object.keys(m).map(function (k) { m[k].net = r2_(m[k].net); return m[k]; }).filter(function (o) { return Math.abs(o.net) > 0.004; })
    .sort(function (a, b) { return a.code < b.code ? -1 : (a.code > b.code ? 1 : 0); });
}
var fy_isPL_ = function (code) { var d = code.charAt(0); return d === '6' || d === '7'; };
var fy_isBS_ = function (code) { var d = code.charAt(0); return (d >= '1' && d <= '5') || d === '9'; };

/* محاسبه‌ی سود دوره و پیشنهاد ذخیره/اندوخته */
function fy_calc_(co, R, c) {
  var vm = rp_vm_(co, {}, R.tg, 'pl'), plNet = 0, taxEx = 0, sales = 0;
  rp_eachRow_(co, vm, function (r, v) {
    if (v.DateGregorian < R.fg) return;
    var a = c.accs[r.AccID]; if (!a) return; var code = String(a.Code), x = (Number(r.Credit) || 0) - (Number(r.Debit) || 0);
    if (fy_isPL_(code)) { plNet += x; if (code === '7801') taxEx -= x; if (code.substring(0, 2) === '61' || code.substring(0, 2) === '62') sales += x; }
  });
  var vb = rp_vm_(co, {}, R.tg, 'bs'), cap = 0, res = 0, D = 0, C = 0, cashNeg = [], bal = {};
  rp_eachRow_(co, vb, function (r) {
    var a = c.accs[r.AccID]; if (!a) return; var code = String(a.Code), d = Number(r.Debit) || 0, cr = Number(r.Credit) || 0;
    D += d; C += cr; bal[r.AccID] = (bal[r.AccID] || 0) + d - cr;
    if (code === '5101') cap += cr - d; if (code === '5201') res += cr - d;
  });
  Object.keys(bal).forEach(function (id) { var a = c.accs[id], k = c.accs[a.ParentID]; if (k && String(k.Code) === '11' && bal[id] < -0.5) cashNeg.push(a.Name + ' (' + fmtNum_(r2_(bal[id])) + ')'); });
  return {profit: r2_(plNet), taxExisting: r2_(taxEx), sales: r2_(sales), capital: r2_(cap), reserve: r2_(res), D: r2_(D), C: r2_(C), cashNeg: cashNeg};
}
/* ---------- سند توازن: مانده‌هایی که ماهیتشان برعکس است ---------- */
var FY_BAL_A = {'1301': '3301', '1601': '3101', '1401': '3201', '1404': '3204', '1402': '3205', '1701': '3501', '1702': '3502', '1101': '3204', '1102': '3204', '1104': '3204', '1103': '3701', '1201': '3701'};
var FY_BAL_L = {'3101': '1601', '3301': '1301', '3201': '1401', '3204': '1404', '3205': '1402', '3501': '1701', '3502': '1702', '3401': '1403'};
function fy_contra_(a) { var code = String(a.Code); return code.substring(0, 2) === '22' || code === '1304' || /استهلاک انباشته|ذخیره/.test(String(a.Name || '')); }
function fy_balancing_(co, R, c) {
  var list = fy_agg_(co, rp_vm_(co, {}, R.tg, 'bs'), '', function (code) { var d = code.charAt(0); return d >= '1' && d <= '4'; }, c), items = [], unmapped = [];
  list.forEach(function (o) {
    var a = c.accs[o.AccID], d = o.code.charAt(0), asset = d === '1' || d === '2';
    if (Math.abs(o.net) < 0.5 || fy_contra_(a) || o.code.substring(0, 2) === '15') return;
    if (asset ? o.net >= 0 : o.net <= 0) return;
    var tcode = (asset ? FY_BAL_A : FY_BAL_L)[o.code];
    if (o.code === '3101' && o.PartyType === 'customer') tcode = '1301';
    var T = tcode ? fy_accByCode_(c, tcode) : null, it = {src: o, amount: r2_(Math.abs(o.net)), accName: a.Name, code: o.code, toCode: tcode || '', toName: T ? T.Name : '', ok: false, why: '',
      who: o.PartyID ? ac_partyName_(c, o.PartyType, o.PartyID) : (o.DetID ? ac_detName_(c, o.DetKind, o.DetID) : '')};
    if (!T) it.why = 'حساب مقابل مشخص نیست';
    else {
      var dk = '', di = '', pt = '', pi = '', pj = '';
      if (T.Det4) { if (o.DetKind === T.Det4 && o.DetID) { dk = o.DetKind; di = o.DetID; } else it.why = 'تفصیلی (' + (AC_DET4[T.Det4] || T.Det4) + ') برای حساب مقابل مشخص نیست'; }
      if (!it.why && T.Det5) { if (o.PartyID) { pt = o.PartyType; pi = o.PartyID; } else if (T.Det5 === 'req') it.why = 'حساب مقابل «شخص» لازم دارد'; }
      if (!it.why && T.Det6 && o.ProjID) pj = o.ProjID;
      if (!it.why) { it.ok = true; it.tgt = {AccID: T.AccID, DetKind: dk, DetID: di, PartyType: pt, PartyID: pi, ProjID: pj}; }
    }
    (it.ok ? items : unmapped).push(it);
  });
  return {items: items, unmapped: unmapped};
}
function fy_balPub_(it) { return {code: it.code, accName: it.accName, who: it.who, amount: it.amount, toCode: it.toCode, toName: it.toName, why: it.why, side: it.src.net < 0 ? 'بستانکار' : 'بدهکار'}; }
/* کالاهای دارای مانده‌ی منفی در پایان سال */
function fy_negStock_(co, R, c) {
  var m = stockMap_(co, '', R.tg), out = [];
  Object.keys(c.prod).forEach(function (pid) {
    var o = m[pid]; if (!o) return; var q = Math.round(stBal_(o) * 1e6) / 1e6;
    if (q < -0.0000005) out.push({pid: pid, name: c.prod[pid].Name, code: c.prod[pid].ProductCode || '', unit: c.prod[pid].DefaultUnit || '', qty: q});
  });
  return out.sort(function (a, b) { return a.qty - b.qty; });
}

function yearCheck_(p) {
  var co = ac_co_(p); ac_open_(co);
  var sy = parseInt(p.sy, 10); if (!sy) throw new Error('سال مالی را انتخاب کنید.');
  var R = fy_range_(co, sy), c = ac_ctx_(co), L = yearList_({company: co}), me = L.rows.filter(function (x) { return x.sy === sy; })[0];
  var blockers = [], warns = [], infos = [];
  if (me && me.status === 'closed') blockers.push('این سال مالی قبلاً بسته شده است.');
  if (me && !me.canClose && me.status !== 'closed') {
    var first = L.rows.filter(function (x) { return x.status !== 'closed' && x.sy < sy && x.vouchers > 0; })[0] || L.rows.filter(function (x) { return x.status !== 'closed' && x.sy < sy; })[0];
    blockers.push('سال‌های مالی باید به ترتیب بسته شوند؛ ابتدا ' + (first ? '«' + first.title + '»' : 'سال قبل') + ' را ببندید.');
  }
  var drafts = rows_('Vouchers').filter(function (v) { return v.CompanyID === co && v.Status === 'draft' && v.DateGregorian >= R.fg && v.DateGregorian <= R.tg; });
  if (drafts.length) blockers.push(drafts.length + ' سند «پیش‌نویس» در این سال وجود دارد؛ آن‌ها را تأیید یا حذف کنید (شماره‌ی سندها: ' + drafts.slice(0, 8).map(function (v) { return v.No; }).join('، ') + (drafts.length > 8 ? ' و ...' : '') + ').');
  var ae = ac_autoErr_(co);
  if (ae && ae.n) warns.push('در صدور سندهای خودکار ' + ae.n + ' خطا/هشدار وجود دارد (نمونه: ' + String((ae.msgs || [])[0] || '').substring(0, 160) + '). تا برطرف نشود، ارقام ممکن است ناقص باشد.');
  var K = fy_calc_(co, R, c);
  if (Math.abs(K.D - K.C) > 0.005) blockers.push('تراز آزمایشی تا پایان سال تراز نیست (جمع بدهکار ' + fmtNum_(K.D) + ' و جمع بستانکار ' + fmtNum_(K.C) + ').');
  if (K.cashNeg.length) warns.push('مانده‌ی منفی در حساب‌های نقد و بانک: ' + K.cashNeg.slice(0, 5).join('، ') + ' — معمولاً نشانه‌ی ثبت‌نشدن یک دریافت یا خطای تاریخ است.');
  var co0 = rows_('Companies').filter(function (r) { return r.CompanyID === co; })[0] || {}, legal = /حقوقی|^2$/.test(String(co0.PersonType || ''));
  infos.push('استهلاک دارایی‌ها در این نسخه خودکار نیست؛ اگر استهلاک سال را ثبت نکرده‌اید، پیش از بستن سند استهلاک بزنید.');
  infos.push('سود تقسیمی، اندوخته‌ی اختیاری و افزایش سرمایه را (در صورت وجود) با سند دستی پیش از بستن ثبت کنید.');
  infos.push('چک‌های در جریان و مانده‌ی اشخاص با همان تفصیلی/شخص به سال بعد منتقل می‌شوند.');
  /* مانده‌های هم‌ماهیت‌نبودن و موجودی منفی */
  var B = fy_balancing_(co, R, c), NS = fy_negStock_(co, R, c);
  if (B.items.length) warns.push(B.items.length + ' مانده با ماهیت برعکس (مثلاً حساب دریافتنی با مانده‌ی بستانکار) وجود دارد؛ با اجازه‌ی شما با «سند توازن» اصلاح می‌شود.');
  if (B.unmapped.length) warns.push(B.unmapped.length + ' مانده با ماهیت برعکس قابل اصلاح خودکار نیست (جدول زیر)؛ آن‌ها را با سند دستی اصلاح کنید یا همان‌طور به سال بعد منتقل می‌شوند.');
  if (NS.length) warns.push(NS.length + ' کالا مانده‌ی منفی دارد؛ مانده‌ی منفی به سال بعد منتقل نمی‌شود و با «تعدیل موجودی» صفر می‌شود.');
  var taxRate = Number(fa2en_(String(p.taxRate !== undefined && p.taxRate !== '' ? p.taxRate : L.taxRate))) || 0, resPct = Number(fa2en_(String(p.reservePct !== undefined && p.reservePct !== '' ? p.reservePct : L.reservePct))) || 0, capPct = Number(fa2en_(String(p.capPct !== undefined && p.capPct !== '' ? p.capPct : L.capPct))) || 0;
  var before = r2_(K.profit + K.taxExisting), sugTax = 0, sugRes = 0, notes = [];
  if (legal) {
    sugTax = Math.max(0, Math.round(Math.max(0, before) * taxRate / 100 - K.taxExisting));
    var net = before - K.taxExisting - sugTax, cand = Math.max(0, net) * resPct / 100, room = Math.max(0, K.capital * capPct / 100 - K.reserve);
    sugRes = K.capital > 0 ? Math.max(0, Math.round(Math.min(cand, room))) : 0;
    notes.push('پیشنهاد مالیات = ' + taxRate + '٪ سود قبل از مالیات منهای مالیات عملکردِ قبلاً ثبت‌شده؛ پیشنهاد اندوخته‌ی قانونی = ' + resPct + '٪ سود خالص تا رسیدن اندوخته به ' + capPct + '٪ سرمایه.');
    if (K.capital <= 0) notes.push('سرمایه (حساب ۵۱۰۱) ثبت نشده است؛ پیشنهاد اندوخته‌ی قانونی صفر است.');
  } else notes.push('برای اشخاص حقیقی، مالیات (ماده ۱۰۱ و پلکانی) و اندوخته پیشنهاد داده نمی‌شود؛ در صورت نیاز مبلغ را خودتان محاسبه و وارد کنید.');
  notes.push('نرخ‌ها پیشنهادی هستند و باید با قانون و آخرین بخشنامه‌ی همان سال تطبیق داده شوند؛ مبلغ‌ها قابل ویرایش‌اند.');
  return {year: me || {sy: sy, title: R.title}, range: {fj: R.fj, tj: R.tj, nj: R.nj}, blockers: blockers, warns: warns, infos: infos, legal: legal,
    calc: {profitBeforeTax: before, taxExisting: K.taxExisting, profit: K.profit, capital: K.capital, reserve: K.reserve, sales: K.sales}, suggest: {tax: sugTax, reserve: sugRes, taxRate: taxRate, resPct: resPct, capPct: capPct}, notes: notes,
    balancing: {items: B.items.map(fy_balPub_), unmapped: B.unmapped.map(fy_balPub_)}, negStock: NS};
}

/* ---------- ساخت سند سیستمی ---------- */
function fy_vch_(co, o) {
  var D = 0, C = 0; o.rows.forEach(function (r) { r.Debit = r.Debit > 0 ? r2_(r.Debit) : ''; r.Credit = r.Credit > 0 ? r2_(r.Credit) : ''; D += Number(r.Debit) || 0; C += Number(r.Credit) || 0; });
  D = r2_(D); C = r2_(C);
  if (!o.rows.length) return null;
  if (Math.abs(D - C) > 0.005) throw new Error('سند «' + o.desc + '» تراز نشد (بد ' + fmtNum_(D) + ' / بس ' + fmtNum_(C) + ').');
  var id = nextIds_('VCH', 1)[0], ref = ac_takeRef_(co, 1)[0], now = nowStr_(), no = ac_nextNo_(co, o.dateG);
  appendRows_(sh_('Vouchers'), [pr_arr_('Vouchers', {VID: id, CompanyID: co, No: no, RefNo: ref, Ref: '', DateJalali: fy_j_(o.dateG), DateGregorian: o.dateG, Time: '', Description: o.desc, Status: 'confirmed', Source: 'sys', SrcType: o.type, SrcID: o.fyid, ProjID: '', TotalDebit: D, TotalCredit: C, CreatedAt: now, UpdatedAt: now})]);
  var rid = nextIds_('VRW', o.rows.length);
  appendRows_(sh_('VoucherRows'), o.rows.map(function (r, i) { return pr_arr_('VoucherRows', Object.assign({VRID: rid[i], VID: id, CompanyID: co, LineNo: i + 1}, r)); }));
  return {VID: id, RefNo: ref, type: o.type, total: D};
}
function fy_row_mk_(co, a, deb, cre, desc) { return {AccID: a.AccID, DetKind: '', DetID: '', PartyType: '', PartyID: '', ProjID: '', Description: desc || '', Debit: deb, Credit: cre}; }
/* ردیف‌های برگردان یک مانده (اختتام) */
function fy_reverse_(list, desc) {
  return list.map(function (o) { return {AccID: o.AccID, DetKind: o.DetKind, DetID: o.DetID, PartyType: o.PartyType, PartyID: o.PartyID, ProjID: o.ProjID, Description: desc, Debit: o.net < 0 ? -o.net : 0, Credit: o.net > 0 ? o.net : 0}; });
}
function fy_same_(list, desc) {
  return list.map(function (o) { return {AccID: o.AccID, DetKind: o.DetKind, DetID: o.DetID, PartyType: o.PartyType, PartyID: o.PartyID, ProjID: o.ProjID, Description: desc, Debit: o.net > 0 ? o.net : 0, Credit: o.net < 0 ? -o.net : 0}; });
}

function yearClose_(p) {
  var co = ac_co_(p); ac_open_(co);
  var sy = parseInt(p.sy, 10); if (!sy) throw new Error('سال مالی را انتخاب کنید.');
  var tax = r2_(Math.max(0, Number(fa2en_(String(p.tax || 0)).replace(/,/g, '')) || 0)), rsv = r2_(Math.max(0, Number(fa2en_(String(p.reserve || 0)).replace(/,/g, '')) || 0));
  return locked_(function () {
    var chk = yearCheck_({company: co, sy: sy});
    if (chk.blockers.length) throw new Error('بستن سال ممکن نیست: ' + chk.blockers[0]);
    if (p.confirm !== true && String(p.confirm) !== 'true') throw new Error('تأیید نهایی انجام نشده است.');
    var R = fy_range_(co, sy), c = ac_ctx_(co), A = {};
    ['5301', '8101', '8201', '8202', '3401', '7801', '5201'].forEach(function (k) { A[k] = fy_accByCode_(c, k); if (!A[k]) throw new Error('حساب ' + k + ' در سرفصل‌ها پیدا نشد؛ از «کدینگ حساب‌ها» گزینه‌ی بازسازی حساب‌های سیستمی را بزنید.'); });
    if (rsv > 0 && !chk.legal) { /* اشخاص حقیقی هم می‌توانند اندوخته‌ی دلخواه ثبت کنند */ }
    var fyid = (fy_row_(co, sy) || {}).FYID || nextIds_('FYR', 1)[0], made = [], t = R.title;
    var B0 = fy_balancing_(co, R, c), NS0 = fy_negStock_(co, R, c), okT = function (x) { return x === true || String(x) === 'true'; };
    if (NS0.length && !okT(p.stockFix)) throw new Error('موجودی منفی کالاها باید با «تعدیل موجودی» صفر شود؛ تأیید آن را بزنید.');
    if (B0.items.length && !okT(p.balance)) throw new Error('برای اصلاح مانده‌های با ماهیت برعکس باید اجازه‌ی صدور «سند توازن» را بدهید.');
    /* ۰-الف) تعدیل موجودی منفی (پیش از هر چیز، چون روی سود اثر دارد) */
    var adjN = 0;
    if (NS0.length) {
      var X0 = ac_xctx_(co), ids = nextIds_('ADJ', NS0.length), nowA = nowStr_();
      appendRows_(sh_('StockAdj'), NS0.map(function (n, i) {
        adjN++; return pr_arr_('StockAdj', {AdjID: ids[i], CompanyID: co, ProductID: n.pid, DateJalali: R.tj, DateGregorian: R.tg, Qty: -n.qty, UnitCost: ac_n_(X0.cm[n.pid]), Reason: 'صفر کردن مانده‌ی منفی هنگام بستن ' + R.title, FYID: fyid, CreatedAt: nowA});
      }));
      bump_(); ac_autoSync_(co); c = ac_ctx_(co);
    }
    /* ۰-ب) سند توازن */
    var B = fy_balancing_(co, R, c), balN = 0;
    if (B.items.length) {
      var brow = [];
      B.items.forEach(function (it) {
        var o = it.src, A = it.amount, dr = o.net < 0; /* منبع بستانکار → منبع را بدهکار می‌کنیم */
        brow.push({AccID: o.AccID, DetKind: o.DetKind, DetID: o.DetID, PartyType: o.PartyType, PartyID: o.PartyID, ProjID: o.ProjID, Description: 'اصلاح ماهیت مانده (توازن)', Debit: dr ? A : 0, Credit: dr ? 0 : A});
        brow.push({AccID: it.tgt.AccID, DetKind: it.tgt.DetKind, DetID: it.tgt.DetID, PartyType: it.tgt.PartyType, PartyID: it.tgt.PartyID, ProjID: it.tgt.ProjID, Description: 'انتقال از ' + it.accName, Debit: dr ? 0 : A, Credit: dr ? A : 0});
        balN++;
      });
      made.push(fy_vch_(co, {dateG: R.tg, desc: 'سند توازن (اصلاح ماهیت مانده‌ها) ' + t, type: 'close_bal', fyid: fyid, rows: brow}));
    }
    /* ۱) ذخیره مالیات */
    if (tax > 0) made.push(fy_vch_(co, {dateG: R.tg, desc: 'ثبت ذخیره مالیات عملکرد ' + t, type: 'close_tax', fyid: fyid, rows: [fy_row_mk_(co, A['7801'], tax, 0, 'هزینه مالیات عملکرد'), fy_row_mk_(co, A['3401'], 0, tax, 'ذخیره مالیات عملکرد')]}));
    /* ۲) بستن حساب‌های سود و زیان */
    var pl = fy_agg_(co, rp_vm_(co, {}, R.tg, 'pl'), R.fg, fy_isPL_, c), net = 0;
    pl.forEach(function (o) { net += o.net; }); net = r2_(net); /* net = بدهکار − بستانکار؛ سود = −net */
    if (pl.length) {
      var rows = fy_reverse_(pl, 'بستن حساب به خلاصه سود و زیان');
      rows.push(fy_row_mk_(co, A['8101'], net > 0 ? net : 0, net < 0 ? -net : 0, 'خلاصه حساب سود و زیان'));
      made.push(fy_vch_(co, {dateG: R.tg, desc: 'بستن حساب‌های سود و زیان ' + t, type: 'close_pl', fyid: fyid, rows: rows}));
    }
    var profit = r2_(-net);
    /* ۳) انتقال به سود انباشته */
    if (Math.abs(profit) > 0.004) {
      var P = Math.abs(profit);
      made.push(fy_vch_(co, {dateG: R.tg, desc: 'انتقال ' + (profit > 0 ? 'سود' : 'زیان') + ' خالص ' + t + ' به سود (زیان) انباشته', type: 'close_ret', fyid: fyid, rows: profit > 0 ?
        [fy_row_mk_(co, A['8101'], P, 0, 'خلاصه حساب سود و زیان'), fy_row_mk_(co, A['5301'], 0, P, 'سود (زیان) انباشته')] :
        [fy_row_mk_(co, A['5301'], P, 0, 'سود (زیان) انباشته'), fy_row_mk_(co, A['8101'], 0, P, 'خلاصه حساب سود و زیان')]}));
    }
    /* ۴) اندوخته‌ی قانونی */
    if (rsv > 0) made.push(fy_vch_(co, {dateG: R.tg, desc: 'انتقال به اندوخته‌ی قانونی ' + t, type: 'close_res', fyid: fyid, rows: [fy_row_mk_(co, A['5301'], rsv, 0, 'سود (زیان) انباشته'), fy_row_mk_(co, A['5201'], 0, rsv, 'اندوخته قانونی')]}));
    /* ۵) اختتامیه‌ی حساب‌های ترازنامه‌ای و ۶) افتتاحیه‌ی سال بعد */
    var bs = fy_agg_(co, rp_vm_(co, {}, R.tg, 'bs'), '', fy_isBS_, c), sd = 0, sc = 0;
    bs.forEach(function (o) { if (o.net > 0) sd += o.net; else sc += -o.net; });
    sd = r2_(sd); sc = r2_(sc);
    if (bs.length) {
      var cr = fy_reverse_(bs, 'اختتام حساب'); cr.push(fy_row_mk_(co, A['8202'], sd, 0, 'تراز اختتامیه (مانده‌های بدهکار)'), fy_row_mk_(co, A['8202'], 0, sc, 'تراز اختتامیه (مانده‌های بستانکار)'));
      made.push(fy_vch_(co, {dateG: R.tg, desc: 'سند اختتامیه ' + t, type: 'close_bs', fyid: fyid, rows: cr}));
      var op = fy_same_(bs, 'مانده‌ی افتتاحیه'); op.push(fy_row_mk_(co, A['8201'], 0, sd, 'تراز افتتاحیه (مانده‌های بدهکار)'), fy_row_mk_(co, A['8201'], sc, 0, 'تراز افتتاحیه (مانده‌های بستانکار)'));
      made.push(fy_vch_(co, {dateG: R.ng, desc: 'سند افتتاحیه سال مالی ' + fy_range_(co, sy + 1).title.replace('سال مالی ', ''), type: 'open_bs', fyid: fyid, rows: op}));
    }
    made = made.filter(function (x) { return x; });
    var now = nowStr_(), info = JSON.stringify({profit: profit, tax: tax, reserve: rsv, balanced: balN, stockAdj: adjN, vouchers: made.map(function (x) { return {VID: x.VID, RefNo: x.RefNo, type: x.type, total: x.total}; })});
    pr_setRow_('FiscalYears', 'FYID', fyid, {FYID: fyid, CompanyID: co, StartY: sy, Status: 'closed', ClosedAt: now, ReopenedAt: (fy_row_(co, sy) || {}).ReopenedAt || '', Info: info});
    ac_renumber_(co, true);
    bump_();
    return {fyid: fyid, profit: profit, tax: tax, reserve: rsv, vouchers: made.length, title: t, balanced: balN, stockAdj: adjN};
  });
}
function yearOpen_(p) {
  var co = ac_co_(p), sy = parseInt(p.sy, 10);
  if (!p._adm) throw new Error('فقط مدیر سیستم می‌تواند سال مالی بسته را باز کند.');
  return locked_(function () {
    var row = fy_row_(co, sy);
    if (!row || row.Status !== 'closed') throw new Error('این سال مالی بسته نیست.');
    var later = fy_closedRows_(co).filter(function (r) { return Number(r.StartY) > sy; });
    if (later.some(function (r) { return !fy_dirty_(r); })) throw new Error('ابتدا سال‌های بعدی را باز کنید (از آخرین سال بسته‌شده شروع کنید).');
    var targets = [row].concat(later), delV = {}, nAdj = 0, ids = {};
    targets.forEach(function (r) { ids[r.FYID] = 1; });
    rows_('Vouchers').forEach(function (v) { if (v.CompanyID === co && String(v.Source) === 'sys' && ids[v.SrcID]) delV[v.VID] = 1; });
    var n = Object.keys(delV).length;
    if (n) { delWhere_('VoucherRows', 2, function (x) { return delV[x]; }); delWhere_('Vouchers', 1, function (x) { return delV[x]; }); }
    nAdj = delWhere_('StockAdj', H.StockAdj.indexOf('FYID') + 1, function (x) { return ids[x]; });
    targets.forEach(function (r) { r.Status = 'open'; r.ReopenedAt = nowStr_(); r.Info = ''; pr_setRow_('FiscalYears', 'FYID', r.FYID, r); });
    bump_();
    if (nAdj) ac_autoSync_(co);
    ac_renumber_(co, false);
    bump_();
    return {removed: n, adjRemoved: nAdj, reopened: targets.length, title: fy_range_(co, sy).title};
  });
}
