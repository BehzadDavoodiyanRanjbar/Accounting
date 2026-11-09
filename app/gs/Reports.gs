/* ===== گزارش‌ها =====
   همه‌ی گزارش‌ها با یک اکشن به‌نام «report» (p.id = شناسه‌ی گزارش) صدا زده می‌شوند و یک ساختار یکسان برمی‌گردانند:
   {title, sub, cols:[{k,t,n}], rows:[{...}], foot:{...}, notes:[...]}
   n=1 یعنی ستون عددی. فیلدهای ویژه‌ی ردیف: _b (پررنگ)، _l (تورفتگی)، _sec (ردیف عنوان)، _vid (لینک به سند)،
   _acc (لینک به دفتر حساب)، _party ([نوع، شناسه])، _inv ([نوع، شناسه])، _cont (ردیف ادامه‌ی همان سند).
   منبع گزارش‌های حسابداری و صورت‌های مالی فقط اسناد «تأییدشده» است (به‌جز در صورت تیک پیش‌نویس‌ها). */
var RP_MON = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
var RP_CLOSE = {close_pl: 1, close_ret: 1, close_bs: 1};
var RP_OPEN = {open_bs: 1};

function rp_co_(p) { var co = ac_co_(p); ac_open_(co); return co; }
function rp_n_(x) { return Number(x) || 0; }
function rp_col_(k, t, n) { return {k: k, t: t, n: n ? 1 : 0}; }
function rp_out_(id, title, sub, cols, rows, foot, notes) { return {id: id, title: title, sub: sub || '', cols: cols, rows: rows, foot: foot || null, notes: notes || []}; }
function rp_range_(p) {
  var f = tr_(p.from) ? ac_dateReq_(p.from, 'از تاریخ') : null, t = tr_(p.to) ? ac_dateReq_(p.to, 'تا تاریخ') : null;
  if (f && t && f.g > t.g) throw new Error('«از تاریخ» نباید بعد از «تا تاریخ» باشد.');
  return {f: f ? f.g : '', t: t ? t.g : '', fj: f ? f.j : '', tj: t ? t.j : ''};
}
function rp_subRange_(R) { return (R.fj || R.tj) ? ('از ' + (R.fj || 'ابتدا') + ' تا ' + (R.tj || 'انتها')) : 'کل دوره'; }
function rp_shiftJ_(j, dy) {
  var m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(String(j || '')); if (!m) return '';
  var y = +m[1] + dy, mo = +m[2], d = +m[3], r = parseJ_(y + '/' + mo + '/' + d);
  while (!r && d > 28) { d--; r = parseJ_(y + '/' + mo + '/' + d); }
  return r ? r.j : '';
}
function rp_dayBefore_(g) { var d = new Date(g + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().substring(0, 10); }
function rp_sign_(x) { return x > 0.005 ? 'بد' : (x < -0.005 ? 'بس' : ''); }
function rp_pos_(x) { return r2_(Math.max(x, 0)); }

/* نوع سندهای سیستمی (اختتامیه/افتتاحیه) و فیلتر آن‌ها
   kind: all = همه (اختتامیه و افتتاحیه پیش‌فرض شامل) | trial = اختتامیه پیش‌فرض خارج | bs = ترازنامه (جفت اختتامیه/افتتاحیه ترازی حذف) | pl = دوره‌ای (هر چهار نوع حذف) */
function rp_vm_(co, p, hi, kind) {
  var all = ac_b_(p.includeDraft, false), m = {}, Z = fy_ctx_(co, p, kind);
  rows_('Vouchers').forEach(function (v) {
    if (v.CompanyID !== co) return;
    if (!all && v.Status !== 'confirmed') return;
    if (hi && v.DateGregorian > hi) return;
    if (!fy_ok_(Z, v)) return;
    m[v.VID] = v;
  });
  return m;
}
function rp_eachRow_(co, vm, fn) { rows_('VoucherRows').forEach(function (r) { if (r.CompanyID !== co) return; var v = vm[r.VID]; if (v) fn(r, v); }); }
function rp_cmpV_(x, y) { return x.DateGregorian < y.DateGregorian ? -1 : (x.DateGregorian > y.DateGregorian ? 1 : ((Number(x.No) - Number(y.No)) || (x.VID < y.VID ? -1 : (x.VID > y.VID ? 1 : 0)))); }
function rp_anc_(c, a, lvl) { var x = a; while (x && Number(x.Level) > lvl) x = c.accs[x.ParentID]; return x; }
function rp_accName_(a) { return a ? (a.Code + ' - ' + a.Name) : ''; }
function rp_dims_(c, r, pj) {
  var l = [];
  if (r.DetID) l.push(ac_detName_(c, r.DetKind, r.DetID));
  if (r.PartyID) l.push(ac_partyName_(c, r.PartyType, r.PartyID));
  var pid = r.ProjID || pj; if (pid && c.proj[pid]) l.push(c.proj[pid].Name);
  return l.filter(Boolean).join(' | ');
}
/* جمع بدهکار/بستانکار هر حساب؛ قبل از f = مانده‌ی ابتدای دوره */
function rp_acc_(co, vm, f, filter) {
  var m = {};
  rp_eachRow_(co, vm, function (r, v) {
    if (filter && !filter(r, v)) return;
    var o = m[r.AccID] || (m[r.AccID] = {pd: 0, pc: 0, d: 0, c: 0});
    var D = rp_n_(r.Debit), C = rp_n_(r.Credit);
    if (f && v.DateGregorian < f) { o.pd += D; o.pc += C; } else { o.d += D; o.c += C; }
  });
  return m;
}
/* سرجمع حساب‌های معین در سطح «کل»: {کدکل: {a, v, mo:{کدمعین:{a,v}}}} */
function rp_roll_(c, net) {
  var K = {};
  Object.keys(net).forEach(function (id) {
    var a = c.accs[id]; if (!a || Math.abs(net[id]) < 0.005) return;
    var k = c.accs[a.ParentID]; if (!k) return;
    var kc = String(k.Code), o = K[kc] || (K[kc] = {a: k, v: 0, mo: {}});
    o.v += net[id]; o.mo[String(a.Code)] = {a: a, v: net[id]};
  });
  return K;
}
function rp_codes_(Ks, pre) {
  var u = {};
  Ks.forEach(function (K) { Object.keys(K || {}).forEach(function (k) { if (!pre || k.charAt(0) === pre) u[k] = 1; }); });
  return Object.keys(u).sort();
}

/* ---------- دفتر روزنامه ---------- */
function rpJournal_(co, p) {
  var c = ac_ctx_(co), R = rp_range_(p), vm = rp_vm_(co, p, R.t, 'all');
  var nf = parseInt(fa2en_(p.noFrom || ''), 10) || 0, nt = parseInt(fa2en_(p.noTo || ''), 10) || 0, list = [];
  rp_eachRow_(co, vm, function (r, v) {
    if (R.f && v.DateGregorian < R.f) return;
    var n = parseInt(String(v.No), 10) || 0; if (nf && n < nf) return; if (nt && n > nt) return;
    list.push({r: r, v: v});
  });
  list.sort(function (x, y) { return rp_cmpV_(x.v, y.v) || (Number(x.r.LineNo) - Number(y.r.LineNo)); });
  var rows = [], D = 0, C = 0, last = '', nv = 0;
  list.forEach(function (x) {
    var a = c.accs[x.r.AccID], kl = a ? c.accs[a.ParentID] : null, d = rp_n_(x.r.Debit), cr = rp_n_(x.r.Credit), first = x.v.VID !== last;
    if (first) nv++; last = x.v.VID; D += d; C += cr;
    rows.push({date: x.v.DateJalali, no: String(x.v.No), ref: String(x.v.RefNo || ''), kol: kl ? String(kl.Code) : '', code: a ? String(a.Code) : '', acc: a ? a.Name : '', dim: rp_dims_(c, x.r, x.v.ProjID), desc: x.r.Description || x.v.Description || '', debit: d || '', credit: cr || '', _vid: x.v.VID, _cont: !first});
  });
  return rp_out_('journal', 'دفتر روزنامه', rp_subRange_(R) + ' | ' + nv + ' سند', [rp_col_('date', 'تاریخ'), rp_col_('no', 'شماره سند'), rp_col_('ref', 'ارجاع'), rp_col_('kol', 'کد کل'), rp_col_('code', 'کد معین'), rp_col_('acc', 'نام حساب'), rp_col_('dim', 'تفصیلی / شخص / پروژه'), rp_col_('desc', 'شرح'), rp_col_('debit', 'بدهکار', 1), rp_col_('credit', 'بستانکار', 1)], rows,
    {acc: 'جمع', debit: r2_(D), credit: r2_(C)}, Math.abs(D - C) > 0.01 ? ['جمع بدهکار و بستانکار برابر نیست (اختلاف ' + fmtNum_(r2_(Math.abs(D - C))) + ').'] : []);
}
function rp_period_(dj, by) { return by === 'day' ? dj : dj.substring(0, 7); }
function rp_periodName_(k, by) { if (by === 'day') return k; var m = parseInt(k.substring(5, 7), 10); return k.substring(0, 4) + ' ' + (RP_MON[m - 1] || ''); }
/* ---------- دفتر روزنامه (تجمیعی) ---------- */
function rpJournalAgg_(co, p) {
  var c = ac_ctx_(co), R = rp_range_(p), vm = rp_vm_(co, p, R.t, 'all'), by = p.by === 'day' ? 'day' : 'month', lvl = String(p.level) === '2' ? 2 : 3, agg = {}, keys = [];
  rp_eachRow_(co, vm, function (r, v) {
    if (R.f && v.DateGregorian < R.f) return;
    var a = c.accs[r.AccID]; a = a && rp_anc_(c, a, lvl); if (!a) return;
    var pk = rp_period_(v.DateJalali, by), k = pk + '|' + a.Code, o = agg[k];
    if (!o) { o = agg[k] = {pk: pk, code: String(a.Code), name: a.Name, d: 0, c: 0, n: {}}; keys.push(k); }
    o.d += rp_n_(r.Debit); o.c += rp_n_(r.Credit); o.n[v.VID] = 1;
  });
  keys.sort(function (x, y) { var a = agg[x], b = agg[y]; return a.pk < b.pk ? -1 : (a.pk > b.pk ? 1 : (a.code < b.code ? -1 : (a.code > b.code ? 1 : 0))); });
  var rows = [], D = 0, C = 0, cur = null, sd = 0, sc = 0;
  var flush = function () { if (cur !== null) rows.push({period: rp_periodName_(cur, by), code: '', acc: 'جمع ' + rp_periodName_(cur, by), docs: '', debit: r2_(sd), credit: r2_(sc), _b: true}); sd = 0; sc = 0; };
  keys.forEach(function (k) {
    var o = agg[k]; if (cur !== null && o.pk !== cur) flush(); cur = o.pk;
    rows.push({period: rp_periodName_(o.pk, by), code: o.code, acc: o.name, docs: Object.keys(o.n).length, debit: r2_(o.d), credit: r2_(o.c)});
    sd += o.d; sc += o.c; D += o.d; C += o.c;
  });
  flush();
  return rp_out_('journalAgg', 'دفتر روزنامه (تجمیعی) — ' + (by === 'day' ? 'روزانه' : 'ماهانه') + '، سطح ' + (lvl === 2 ? 'کل' : 'معین'), rp_subRange_(R), [rp_col_('period', by === 'day' ? 'تاریخ' : 'ماه'), rp_col_('code', 'کد حساب'), rp_col_('acc', 'نام حساب'), rp_col_('docs', 'تعداد سند', 1), rp_col_('debit', 'بدهکار', 1), rp_col_('credit', 'بستانکار', 1)], rows, {acc: 'جمع کل', debit: r2_(D), credit: r2_(C)});
}

/* ---------- دفتر کل (سطح گروه/کل) ---------- */
function rp_ledgerBase_(co, p, lvl) {
  var c = ac_ctx_(co), R = rp_range_(p), vm = rp_vm_(co, p, R.t, 'all'), pick = tr_(p.acc), per = {};
  var sel = pick ? c.accs[pick] : null;
  if (pick && !sel) throw new Error('حساب پیدا نشد.');
  rp_eachRow_(co, vm, function (r, v) {
    var a = c.accs[r.AccID]; if (!a) return;
    var n = rp_anc_(c, a, lvl); if (!n) return;
    if (sel && rp_anc_(c, a, Number(sel.Level)) !== sel) return;
    var o = per[n.AccID] || (per[n.AccID] = {n: n, carry: 0, byV: {}});
    var D = rp_n_(r.Debit), C = rp_n_(r.Credit);
    if (R.f && v.DateGregorian < R.f) { o.carry += D - C; return; }
    var b = o.byV[v.VID] || (o.byV[v.VID] = {v: v, d: 0, c: 0}); b.d += D; b.c += C;
  });
  var cp = fa2en_(tr_(p.codePrefix));
  return {c: c, R: R, per: per, list: Object.keys(per).map(function (k) { return per[k]; }).filter(function (o) { return !cp || String(o.n.Code).indexOf(cp) === 0; }).sort(function (x, y) { return String(x.n.Code) < String(y.n.Code) ? -1 : 1; })};
}
function rpKolLedger_(co, p) {
  var lvl = String(p.level) === '1' ? 1 : 2, B = rp_ledgerBase_(co, p, lvl), rows = [], GD = 0, GC = 0;
  B.list.forEach(function (o) {
    var vs = Object.keys(o.byV).map(function (k) { return o.byV[k]; }).sort(function (x, y) { return rp_cmpV_(x.v, y.v); });
    if (!vs.length && Math.abs(o.carry) < 0.005) return;
    rows.push({date: '', no: '', ref: '', desc: rp_accName_(o.n), debit: '', credit: '', bal: '', sg: '', _sec: true});
    var bal = o.carry, td = 0, tc = 0;
    if (Math.abs(o.carry) > 0.005) rows.push({date: '', no: '', ref: '', desc: 'مانده از قبل', debit: '', credit: '', bal: rp_pos_(Math.abs(bal)), sg: rp_sign_(bal), _b: true});
    vs.forEach(function (x) { bal += x.d - x.c; td += x.d; tc += x.c; rows.push({date: x.v.DateJalali, no: String(x.v.No), ref: String(x.v.RefNo || ''), desc: x.v.Description || '', debit: r2_(x.d) || '', credit: r2_(x.c) || '', bal: r2_(Math.abs(bal)), sg: rp_sign_(bal), _vid: x.v.VID}); });
    rows.push({date: '', no: '', ref: '', desc: 'جمع ' + o.n.Name, debit: r2_(td), credit: r2_(tc), bal: r2_(Math.abs(bal)), sg: rp_sign_(bal), _b: true});
    GD += td; GC += tc;
  });
  return rp_out_('kolLedger', 'دفتر کل (سطح ' + (lvl === 1 ? 'گروه' : 'کل') + ')', rp_subRange_(B.R), [rp_col_('date', 'تاریخ'), rp_col_('no', 'شماره سند'), rp_col_('ref', 'ارجاع'), rp_col_('desc', 'شرح'), rp_col_('debit', 'بدهکار', 1), rp_col_('credit', 'بستانکار', 1), rp_col_('bal', 'مانده', 1), rp_col_('sg', 'تشخیص')], rows, {desc: 'جمع کل', debit: r2_(GD), credit: r2_(GC)}, ['برای هر حساب، گردش هر سند یک‌جا (جمع ردیف‌های آن حساب در آن سند) نمایش داده می‌شود.']);
}
/* ---------- دفتر کل (تجمیعی) ---------- */
function rpKolLedgerAgg_(co, p) {
  var lvl = String(p.level) === '1' ? 1 : 2, by = p.by === 'day' ? 'day' : 'month', B = rp_ledgerBase_(co, p, lvl), rows = [], GD = 0, GC = 0;
  B.list.forEach(function (o) {
    var per = {}, ks = [];
    Object.keys(o.byV).forEach(function (k) { var x = o.byV[k], pk = rp_period_(x.v.DateJalali, by); if (!per[pk]) { per[pk] = {d: 0, c: 0}; ks.push(pk); } per[pk].d += x.d; per[pk].c += x.c; });
    if (!ks.length && Math.abs(o.carry) < 0.005) return;
    ks.sort();
    var bal = o.carry;
    if (Math.abs(o.carry) > 0.005) rows.push({code: String(o.n.Code), name: o.n.Name, period: 'مانده از قبل', debit: '', credit: '', bal: r2_(Math.abs(bal)), sg: rp_sign_(bal)});
    ks.forEach(function (k) { var x = per[k]; bal += x.d - x.c; GD += x.d; GC += x.c; rows.push({code: String(o.n.Code), name: o.n.Name, period: rp_periodName_(k, by), debit: r2_(x.d) || '', credit: r2_(x.c) || '', bal: r2_(Math.abs(bal)), sg: rp_sign_(bal)}); });
  });
  return rp_out_('kolLedgerAgg', 'دفتر کل (تجمیعی) — ' + (by === 'day' ? 'روزانه' : 'ماهانه'), rp_subRange_(B.R), [rp_col_('code', 'کد'), rp_col_('name', 'نام حساب'), rp_col_('period', by === 'day' ? 'تاریخ' : 'ماه'), rp_col_('debit', 'بدهکار', 1), rp_col_('credit', 'بستانکار', 1), rp_col_('bal', 'مانده', 1), rp_col_('sg', 'تشخیص')], rows, {name: 'جمع کل', debit: r2_(GD), credit: r2_(GC)});
}

/* ---------- مرور حساب‌ها (درختی) ---------- */
function rpReviewAcc_(co, p) {
  var c = ac_ctx_(co), R = rp_range_(p), lvl = Math.max(1, Math.min(3, parseInt(p.level, 10) || 3)), vm = rp_vm_(co, p, R.t, 'trial'), m = rp_acc_(co, vm, R.f), agg = {};
  var hz = ac_b_(p.hideZero, true);
  Object.keys(m).forEach(function (id) {
    var a = c.accs[id]; if (!a) return;
    for (var x = a; x; x = c.accs[x.ParentID]) {
      var o = agg[x.AccID] || (agg[x.AccID] = {a: x, pd: 0, pc: 0, d: 0, c: 0});
      o.pd += m[id].pd; o.pc += m[id].pc; o.d += m[id].d; o.c += m[id].c;
    }
  });
  var cp = fa2en_(tr_(p.codePrefix));
  var l = Object.keys(agg).map(function (k) { return agg[k]; }).filter(function (o) { return Number(o.a.Level) <= lvl && (!cp || String(o.a.Code).indexOf(cp) === 0 || cp.indexOf(String(o.a.Code)) === 0); }).sort(function (x, y) { return String(x.a.Code) < String(y.a.Code) ? -1 : (String(x.a.Code) > String(y.a.Code) ? 1 : 0); });
  var rows = [], T = {od: 0, oc: 0, d: 0, c: 0, ed: 0, ec: 0};
  l.forEach(function (o) {
    var op = o.pd - o.pc, en = op + o.d - o.c;
    if (hz && Math.abs(op) < 0.005 && Math.abs(o.d) < 0.005 && Math.abs(o.c) < 0.005 && Math.abs(en) < 0.005) return;
    var lv = Number(o.a.Level), row = {code: String(o.a.Code), name: o.a.Name, od: rp_pos_(op), oc: rp_pos_(-op), d: r2_(o.d), c: r2_(o.c), ed: rp_pos_(en), ec: rp_pos_(-en), _l: lv - 1, _b: lv < 3};
    if (lv === 3) row._acc = o.a.AccID;
    rows.push(row);
    if (lv === 1) { T.od += row.od; T.oc += row.oc; T.d += row.d; T.c += row.c; T.ed += row.ed; T.ec += row.ec; }
  });
  Object.keys(T).forEach(function (k) { T[k] = r2_(T[k]); });
  return rp_out_('reviewAcc', 'مرور حساب‌ها (گروه ← کل ← معین)', rp_subRange_(R), [rp_col_('code', 'کد'), rp_col_('name', 'نام حساب'), rp_col_('od', 'مانده قبل بدهکار', 1), rp_col_('oc', 'مانده قبل بستانکار', 1), rp_col_('d', 'گردش بدهکار', 1), rp_col_('c', 'گردش بستانکار', 1), rp_col_('ed', 'مانده بدهکار', 1), rp_col_('ec', 'مانده بستانکار', 1)], rows,
    {name: 'جمع (سطح گروه)', od: T.od, oc: T.oc, d: T.d, c: T.c, ed: T.ed, ec: T.ec}, ['با کلیک روی ردیف «معین»، دفتر همان حساب باز می‌شود.']);
}

/* ---------- مرور حساب‌های تفصیل (تفصیلی / شخص / پروژه) ---------- */
var RP_DIMS = {'det:detail': 'تفصیلی عمومی', 'det:bank': 'بانک', 'det:cash': 'صندوق', 'det:imprest': 'تنخواه‌گردان', 'det:product': 'کالا', 'party:customer': 'خریدار', 'party:supplier': 'فروشنده', 'party:employee': 'کارمند', proj: 'پروژه'};
function rp_dimKey_(c, dim, r, v) {
  var m = /^(det|party):(.+)$/.exec(dim), rec;
  if (m && m[1] === 'det') {
    if (!r.DetID || r.DetKind !== m[2]) return null;
    rec = ac_detRec_(c, m[2], r.DetID); if (!rec) return {key: r.DetID, code: '', name: '؟ ' + r.DetID};
    return {key: r.DetID, code: String((m[2] === 'product' ? rec.ProductCode : rec.Code) || ''), name: (m[2] === 'bank' || m[2] === 'cash' || m[2] === 'imprest') ? rec.Name : rec.Name};
  }
  if (m && m[1] === 'party') {
    if (!r.PartyID || r.PartyType !== m[2]) return null;
    rec = ac_partyRec_(c, m[2], r.PartyID); if (!rec) return {key: r.PartyID, code: '', name: '؟ ' + r.PartyID};
    return {key: r.PartyID, code: String(rec.CustomerCode || rec.SupplierCode || rec.Code || ''), name: rec.Name};
  }
  var pid = r.ProjID || v.ProjID; if (!pid) return null;
  rec = c.proj[pid]; return {key: pid, code: rec ? String(rec.Code || '') : '', name: rec ? rec.Name : pid};
}
function rpReviewDim_(co, p) {
  var dim = String(p.dim || 'party:customer'); if (!RP_DIMS[dim]) throw new Error('نوع تفصیل نامعتبر است.');
  var c = ac_ctx_(co), R = rp_range_(p), vm = rp_vm_(co, p, R.t, 'trial'), acc = tr_(p.acc), agg = {}, hz = ac_b_(p.hideZero, true);
  if (acc && !c.accs[acc]) throw new Error('حساب پیدا نشد.');
  rp_eachRow_(co, vm, function (r, v) {
    if (acc && r.AccID !== acc) return;
    var k = rp_dimKey_(c, dim, r, v); if (!k) return;
    var o = agg[k.key] || (agg[k.key] = {k: k, pd: 0, pc: 0, d: 0, c: 0}), D = rp_n_(r.Debit), C = rp_n_(r.Credit);
    if (R.f && v.DateGregorian < R.f) { o.pd += D; o.pc += C; } else { o.d += D; o.c += C; }
  });
  var rows = [], T = {od: 0, oc: 0, d: 0, c: 0, ed: 0, ec: 0};
  Object.keys(agg).map(function (k) { return agg[k]; }).sort(function (x, y) { return x.k.code < y.k.code ? -1 : (x.k.code > y.k.code ? 1 : (x.k.name < y.k.name ? -1 : 1)); }).forEach(function (o) {
    var op = o.pd - o.pc, en = op + o.d - o.c;
    if (hz && Math.abs(op) < 0.005 && Math.abs(o.d) < 0.005 && Math.abs(o.c) < 0.005 && Math.abs(en) < 0.005) return;
    var row = {code: o.k.code, name: o.k.name, od: rp_pos_(op), oc: rp_pos_(-op), d: r2_(o.d), c: r2_(o.c), ed: rp_pos_(en), ec: rp_pos_(-en)};
    if (/^party:/.test(dim)) row._party = [dim.split(':')[1], o.k.key];
    rows.push(row); T.od += row.od; T.oc += row.oc; T.d += row.d; T.c += row.c; T.ed += row.ed; T.ec += row.ec;
  });
  Object.keys(T).forEach(function (k) { T[k] = r2_(T[k]); });
  var an = acc ? ' | حساب: ' + rp_accName_(c.accs[acc]) : '';
  return rp_out_('reviewDim', 'مرور حساب‌های تفصیل — ' + RP_DIMS[dim], rp_subRange_(R) + an, [rp_col_('code', 'کد'), rp_col_('name', 'نام'), rp_col_('od', 'مانده قبل بدهکار', 1), rp_col_('oc', 'مانده قبل بستانکار', 1), rp_col_('d', 'گردش بدهکار', 1), rp_col_('c', 'گردش بستانکار', 1), rp_col_('ed', 'مانده بدهکار', 1), rp_col_('ec', 'مانده بستانکار', 1)], rows,
    {name: 'جمع', od: T.od, oc: T.oc, d: T.d, c: T.c, ed: T.ed, ec: T.ec}, ['مجموع همه‌ی حساب‌هایی که این تفصیل روی آن‌ها ثبت شده است' + (acc ? ' (فقط حساب انتخاب‌شده)' : '') + '.']);
}

/* ---------- کارت حساب (شخص / پروژه / تفصیلی): ردیف‌های همه‌ی حساب‌ها با مانده‌ی جاری ---------- */
function rp_card_(co, p, id, title, test) {
  var c = ac_ctx_(co), R = rp_range_(p), vm = rp_vm_(co, p, R.t, 'all'), acc = tr_(p.acc), carry = 0, list = [];
  rp_eachRow_(co, vm, function (r, v) {
    if (acc && r.AccID !== acc) return;
    if (!test(r, v)) return;
    var D = rp_n_(r.Debit), C = rp_n_(r.Credit);
    if (R.f && v.DateGregorian < R.f) { carry += D - C; return; }
    list.push({r: r, v: v, d: D, c: C});
  });
  list.sort(function (x, y) { return rp_cmpV_(x.v, y.v) || (Number(x.r.LineNo) - Number(y.r.LineNo)); });
  var bal = carry, rows = [], TD = 0, TC = 0;
  if (Math.abs(carry) > 0.005) rows.push({date: '', no: '', ref: '', acc: 'مانده از قبل', desc: '', debit: '', credit: '', bal: r2_(Math.abs(carry)), sg: rp_sign_(carry), _b: true});
  list.forEach(function (x) {
    var a = c.accs[x.r.AccID]; bal += x.d - x.c; TD += x.d; TC += x.c;
    rows.push({date: x.v.DateJalali, no: String(x.v.No), ref: String(x.v.RefNo || ''), acc: a ? rp_accName_(a) : '', desc: x.r.Description || x.v.Description || '', debit: x.d || '', credit: x.c || '', bal: r2_(Math.abs(bal)), sg: rp_sign_(bal), _vid: x.v.VID});
  });
  return {R: R, c: c, rows: rows, TD: r2_(TD), TC: r2_(TC), bal: r2_(bal), acc: acc};
}
function rp_cardOut_(id, title, sub, X) {
  return rp_out_(id, title, sub, [rp_col_('date', 'تاریخ'), rp_col_('no', 'شماره سند'), rp_col_('ref', 'ارجاع'), rp_col_('acc', 'حساب'), rp_col_('desc', 'شرح'), rp_col_('debit', 'بدهکار', 1), rp_col_('credit', 'بستانکار', 1), rp_col_('bal', 'مانده', 1), rp_col_('sg', 'تشخیص')], X.rows,
    {acc: 'جمع', debit: X.TD, credit: X.TC, bal: r2_(Math.abs(X.bal)), sg: rp_sign_(X.bal)});
}
function rpPartyCard_(co, p) {
  var pt = tr_(p.ptype), pid = tr_(p.party); if (!AC_PARTY[pt] || !pid) throw new Error('نوع و نام شخص را انتخاب کنید.');
  var X = rp_card_(co, p, pid, '', function (r) { return r.PartyID === pid && r.PartyType === pt; }), nm = ac_partyName_(X.c, pt, pid);
  if (!nm) throw new Error('شخص پیدا نشد.');
  return rp_cardOut_('partyCard', 'کارت حساب اشخاص — ' + nm, rp_subRange_(X.R) + (X.acc ? ' | حساب: ' + rp_accName_(X.c.accs[X.acc]) : ''), X);
}
function rpDetCard_(co, p) {
  var dk = tr_(p.dkind), did = tr_(p.det); if (!AC_DET4[dk] || !did) throw new Error('نوع و مورد تفصیلی را انتخاب کنید.');
  var X = rp_card_(co, p, did, '', function (r) { return r.DetID === did && r.DetKind === dk; }), nm = ac_detName_(X.c, dk, did);
  return rp_cardOut_('detCard', 'کارت تفصیلی — ' + AC_DET4[dk] + ': ' + nm, rp_subRange_(X.R) + (X.acc ? ' | حساب: ' + rp_accName_(X.c.accs[X.acc]) : ''), X);
}
function rpProjCard_(co, p) {
  var pj = tr_(p.proj), c0 = ac_ctx_(co); if (!pj || !c0.proj[pj]) throw new Error('پروژه را انتخاب کنید.');
  if (String(p.mode) === 'sum') {
    var R = rp_range_(p), vm = rp_vm_(co, p, R.t, 'all'), m = {}, rows = [], TD = 0, TC = 0;
    rp_eachRow_(co, vm, function (r, v) {
      if ((r.ProjID || v.ProjID) !== pj) return; if (R.f && v.DateGregorian < R.f) return;
      var o = m[r.AccID] || (m[r.AccID] = {d: 0, c: 0}); o.d += rp_n_(r.Debit); o.c += rp_n_(r.Credit);
    });
    Object.keys(m).map(function (id) { return c0.accs[id]; }).filter(Boolean).sort(function (a, b) { return String(a.Code) < String(b.Code) ? -1 : 1; }).forEach(function (a) {
      var o = m[a.AccID], b = o.d - o.c; TD += o.d; TC += o.c;
      rows.push({code: String(a.Code), name: a.Name, debit: r2_(o.d) || '', credit: r2_(o.c) || '', bal: r2_(Math.abs(b)), sg: rp_sign_(b), _acc: a.AccID});
    });
    return rp_out_('projCard', 'کارت پروژه (خلاصه به تفکیک حساب) — ' + c0.proj[pj].Name, rp_subRange_(R), [rp_col_('code', 'کد'), rp_col_('name', 'نام حساب'), rp_col_('debit', 'بدهکار', 1), rp_col_('credit', 'بستانکار', 1), rp_col_('bal', 'مانده', 1), rp_col_('sg', 'تشخیص')], rows, {name: 'جمع', debit: r2_(TD), credit: r2_(TC), bal: r2_(Math.abs(TD - TC)), sg: rp_sign_(TD - TC)});
  }
  var X = rp_card_(co, p, pj, '', function (r, v) { return (r.ProjID || v.ProjID) === pj; });
  return rp_cardOut_('projCard', 'کارت پروژه — ' + c0.proj[pj].Name, rp_subRange_(X.R), X);
}

/* ---------- بدهکاران و بستانکاران (بر پایه‌ی اسناد حسابداری، به تفکیک شخص) ---------- */
function rpDebtors_(co, p) {
  var c = ac_ctx_(co), R = rp_range_(p), vm = rp_vm_(co, p, R.t, 'trial'), only = String(p.accs || 'arap'), show = String(p.show || 'all'), agg = {}, hz = ac_b_(p.hideZero, true);
  var okAcc = function (a) {
    if (only === 'all') return true;
    var k = tr_(a.SysKey), kol = c.accs[a.ParentID], kc = kol ? String(kol.Code) : '';
    return ['ar', 'ap', 'notes_rec', 'notes_pay', 'prepay_buy', 'prepay_sell', 'salary_pay', 'pay_other', 'partners'].indexOf(k) >= 0 || kc === '13' || kc === '31' || kc === '32' || kc === '16' || kc === '33' || kc === '14';
  };
  rp_eachRow_(co, vm, function (r, v) {
    if (!r.PartyID) return; var a = c.accs[r.AccID]; if (!a || !okAcc(a)) return;
    var key = r.PartyType + '|' + r.PartyID, o = agg[key] || (agg[key] = {t: r.PartyType, id: r.PartyID, pd: 0, pc: 0, d: 0, c: 0}), D = rp_n_(r.Debit), C = rp_n_(r.Credit);
    if (R.f && v.DateGregorian < R.f) { o.pd += D; o.pc += C; } else { o.d += D; o.c += C; }
  });
  var rows = [], T = {d: 0, c: 0, ed: 0, ec: 0};
  Object.keys(agg).map(function (k) { return agg[k]; }).forEach(function (o) {
    var rec = ac_partyRec_(c, o.t, o.id), en = o.pd - o.pc + o.d - o.c;
    if (hz && Math.abs(en) < 0.005 && Math.abs(o.d) < 0.005 && Math.abs(o.c) < 0.005) return;
    if (show === 'debtor' && en <= 0.005) return; if (show === 'creditor' && en >= -0.005) return;
    var op = o.pd - o.pc;
    rows.push({type: AC_PARTY[o.t] || o.t, code: rec ? String(rec.CustomerCode || rec.SupplierCode || rec.Code || '') : '', name: rec ? rec.Name : '؟', op: r2_(Math.abs(op)) || '', osg: rp_sign_(op), d: r2_(o.d), c: r2_(o.c), ed: rp_pos_(en), ec: rp_pos_(-en), _party: [o.t, o.id], _s: en});
    T.d += o.d; T.c += o.c; T.ed += rp_pos_(en); T.ec += rp_pos_(-en);
  });
  rows.sort(function (x, y) { return Math.abs(y._s) - Math.abs(x._s); }); rows.forEach(function (x) { delete x._s; });
  Object.keys(T).forEach(function (k) { T[k] = r2_(T[k]); });
  return rp_out_('debtors', 'بدهکاران و بستانکاران' + (show === 'debtor' ? ' — فقط بدهکاران' : (show === 'creditor' ? ' — فقط بستانکاران' : '')), rp_subRange_(R) + ' | ' + (only === 'all' ? 'همه‌ی حساب‌های دارای شخص' : 'حساب‌های دریافتنی/پرداختنی و پیش‌پرداخت/پیش‌دریافت'),
    [rp_col_('type', 'نوع'), rp_col_('code', 'کد'), rp_col_('name', 'نام شخص'), rp_col_('op', 'مانده قبل', 1), rp_col_('osg', ''), rp_col_('d', 'گردش بدهکار', 1), rp_col_('c', 'گردش بستانکار', 1), rp_col_('ed', 'مانده بدهکار', 1), rp_col_('ec', 'مانده بستانکار', 1)], rows,
    {name: 'جمع', d: T.d, c: T.c, ed: T.ed, ec: T.ec}, ['مانده بدهکار = طلب ما از آن شخص؛ مانده بستانکار = بدهی ما به آن شخص. این گزارش از روی «اسناد حسابداری» ساخته می‌شود (فاکتورها از طریق اسناد خودکار وارد آن می‌شوند).']);
}

/* ================= صورت‌های مالی ================= */
function rp_stRow_(t, vals, o) { var r = {t: t, v0: vals[0], v1: vals.length > 1 ? vals[1] : ''}; if (o) Object.keys(o).forEach(function (k) { r[k] = o[k]; }); return r; }
function rp_cmpRange_(R) {
  var fj = rp_shiftJ_(R.fj, -1), tj = rp_shiftJ_(R.tj, -1); if (!fj && R.fj) return null; if (!tj) return null;
  var f = fj ? parseJ_(fj) : null, t = parseJ_(tj); return {f: f ? f.g : '', t: t ? t.g : '', fj: fj, tj: tj};
}
function rp_stCols_(cmp, R, R2) { return [rp_col_('t', 'شرح'), rp_col_('v0', 'دوره‌ی جاری' + (R.tj ? ' (' + (R.fj ? R.fj + ' تا ' : 'تا ') + R.tj + ')' : ''), 1)].concat(cmp ? [rp_col_('v1', 'دوره‌ی مقایسه‌ای (' + (R2.fj ? R2.fj + ' تا ' : 'تا ') + R2.tj + ')', 1)] : []); }
function rp_val_(K, code, sg) { return K && K[code] ? r2_(sg * K[code].v) : 0; }

/* ترازنامه: مانده‌ی همه‌ی حساب‌ها تا تاریخ «تا» */
function rp_bsNet_(co, p, hi) {
  var vm = rp_vm_(co, p, hi, 'bs'), m = rp_acc_(co, vm, ''), net = {};
  Object.keys(m).forEach(function (id) { net[id] = m[id].d - m[id].c; });
  return net;
}
function rpBalanceSheet_(co, p) {
  var c = ac_ctx_(co), R = rp_range_(p); if (!R.t) throw new Error('تاریخ ترازنامه («تا تاریخ») را وارد کنید.');
  var cmp = ac_b_(p.compare, false), R2 = cmp ? rp_cmpRange_(R) : null; if (cmp && !R2) cmp = false;
  var detail = String(p.detail) === 'moein';
  var nets = [rp_bsNet_(co, p, R.t)]; if (cmp) nets.push(rp_bsNet_(co, p, R2.t));
  var Ks = [], prof = [], g8 = [];
  nets.forEach(function (net, i) {
    var plNet = {}, k8 = {}, pf = 0;
    Object.keys(net).forEach(function (id) {
      var a = c.accs[id]; if (!a) return; var g = String(a.Code).charAt(0);
      if (g === '6' || g === '7' || String(a.Code) === '8101') pf += net[id]; else if (g === '8') k8[id] = net[id]; else if (g !== '9') plNet[id] = net[id];
    });
    Ks.push(rp_roll_(c, plNet)); prof.push(r2_(-pf)); g8.push(k8);
  });
  var rows = [], vs = function (f) { return cmp ? [f(0), f(1)] : [f(0)]; };
  var section = function (digit, title, sg) {
    var codes = rp_codes_(Ks, digit), tot = [0, 0], any = false;
    var body = [];
    codes.forEach(function (kc) {
      var K0 = Ks[0][kc], K1 = cmp ? Ks[1][kc] : null, a = (K0 || K1).a;
      var v = vs(function (i) { return r2_(sg * ((Ks[i][kc] || {v: 0}).v)); });
      if (Math.abs(v[0]) < 0.005 && (!cmp || Math.abs(v[1]) < 0.005)) return;
      body.push(rp_stRow_(a.Name, v, {_l: 1}));
      if (detail) rp_codes_([K0 ? K0.mo : {}, K1 ? K1.mo : {}]).forEach(function (mc) {
        var mv = vs(function (i) { var o = Ks[i][kc] && Ks[i][kc].mo[mc]; return o ? r2_(sg * o.v) : 0; }), ma = ((K0 && K0.mo[mc]) || (K1 && K1.mo[mc])).a;
        body.push(rp_stRow_(ma.Name, mv, {_l: 2, _acc: ma.AccID}));
      });
      tot[0] += v[0]; tot[1] += cmp ? v[1] : 0; any = true;
    });
    return {title: title, body: body, tot: cmp ? [r2_(tot[0]), r2_(tot[1])] : [r2_(tot[0])], any: any};
  };
  var put = function (S) { if (!S.any && !S.force) return; rows.push(rp_stRow_(S.title, vs(function () { return ''; }), {_sec: true})); S.body.forEach(function (r) { rows.push(r); }); rows.push(rp_stRow_('جمع ' + S.title, S.tot, {_b: true})); };
  var A1 = section('1', 'دارایی‌های جاری', 1), A2 = section('2', 'دارایی‌های غیرجاری', 1);
  A1.force = A2.force = true; put(A1); put(A2);
  var TA = vs(function (i) { return r2_(A1.tot[i] + A2.tot[i]); }); rows.push(rp_stRow_('جمع دارایی‌ها', TA, {_b: true, _hl: true}));
  var L1 = section('3', 'بدهی‌های جاری', -1), L2 = section('4', 'بدهی‌های غیرجاری', -1); L1.force = L2.force = true; put(L1); put(L2);
  var TL = vs(function (i) { return r2_(L1.tot[i] + L2.tot[i]); }); rows.push(rp_stRow_('جمع بدهی‌ها', TL, {_b: true}));
  var E = section('5', 'حقوق صاحبان سهام', -1), eTot = E.tot.slice();
  E.force = true;
  var pr = vs(function (i) { return prof[i]; });
  if (Math.abs(pr[0]) > 0.005 || (cmp && Math.abs(pr[1]) > 0.005)) { E.body.push(rp_stRow_('سود (زیان) خالص دوره‌ی جاری (هنوز به سود انباشته منتقل نشده)', pr, {_l: 1})); eTot = eTot.map(function (x, i) { return r2_(x + pr[i]); }); }
  var ids8 = {}; g8.forEach(function (m) { Object.keys(m).forEach(function (id) { ids8[id] = 1; }); });
  Object.keys(ids8).map(function (id) { return c.accs[id]; }).sort(function (a, b) { return String(a.Code) < String(b.Code) ? -1 : 1; }).forEach(function (a) {
    var v = vs(function (i) { return r2_(-(g8[i][a.AccID] || 0)); }); if (Math.abs(v[0]) < 0.005 && (!cmp || Math.abs(v[1]) < 0.005)) return;
    E.body.push(rp_stRow_(a.Code + ' - ' + a.Name + ' (منتقل‌نشده)', v, {_l: 1, _acc: a.AccID})); eTot = eTot.map(function (x, i) { return r2_(x + v[i]); });
  });
  E.tot = eTot; put(E);
  var TLE = vs(function (i) { return r2_(TL[i] + eTot[i]); }); rows.push(rp_stRow_('جمع بدهی‌ها و حقوق صاحبان سهام', TLE, {_b: true, _hl: true}));
  var notes = [], diff = vs(function (i) { return r2_(TA[i] - TLE[i]); });
  if (Math.abs(diff[0]) > 0.01 || (cmp && Math.abs(diff[1]) > 0.01)) notes.push('⚠ ترازنامه متوازن نیست (اختلاف دارایی‌ها و بدهی+حقوق: ' + fmtNum_(diff[0]) + '). معمولاً به‌خاطر سند ناتراز، حساب گروه ۹ یا حساب ثبت‌نشده در گروه‌های ۱ تا ۵ است.');
  else notes.push('✔ جمع دارایی‌ها با جمع بدهی‌ها و حقوق صاحبان سهام برابر است.');
  if (Object.keys(ids8).length) notes.push('بخشی از مانده‌ها هنوز در «تراز افتتاحیه» (۸۲۰۱) است؛ با سند افتتاحیه‌ی سال مالی یا ثبت سرمایه/سود انباشته منتقل می‌شود.');
  notes.push('تحلیل کمکی از روی اسناد حسابداری؛ قالب سرفصل‌ها طبق ساختار استاندارد ایران است و باید توسط حسابدار رسمی بازبینی شود.');
  return rp_out_('balanceSheet', 'ترازنامه (صورت وضعیت مالی)', 'در تاریخ ' + R.tj, rp_stCols_(cmp, R, R2), rows, null, notes);
}

/* سود و زیان: گردش حساب‌های گروه ۶ و ۷ در بازه (بدون اسناد اختتامیه) */
function rp_plNet_(co, p, R) {
  var vm = rp_vm_(co, p, R.t, 'pl'), m = rp_acc_(co, vm, R.f), net = {};
  Object.keys(m).forEach(function (id) { net[id] = m[id].d - m[id].c; });
  return net;
}
function rp_plK_(c, net) { var o = {}; Object.keys(net).forEach(function (id) { var a = c.accs[id], g = a ? String(a.Code).charAt(0) : ''; if (g === '6' || g === '7') o[id] = net[id]; }); return rp_roll_(c, o); }
function rpIncome_(co, p) {
  var c = ac_ctx_(co), R = rp_range_(p); if (!R.f || !R.t) throw new Error('بازه‌ی دوره (از تاریخ و تا تاریخ) را وارد کنید.');
  var cmp = ac_b_(p.compare, false), R2 = cmp ? rp_cmpRange_(R) : null; if (cmp && !R2) cmp = false;
  var detail = String(p.detail) === 'moein', Ks = [rp_plK_(c, rp_plNet_(co, p, R))]; if (cmp) Ks.push(rp_plK_(c, rp_plNet_(co, p, R2)));
  var N = cmp ? 2 : 1, rows = [], vs = function (f) { var o = []; for (var i = 0; i < N; i++) o.push(f(i)); return o; };
  var inSet = function (kc, list) { return list.indexOf(kc) >= 0; };
  var lines = function (codes, sg, lvl) {
    var tot = vs(function () { return 0; });
    codes.forEach(function (kc) {
      var K0 = Ks[0][kc], K1 = cmp ? Ks[1][kc] : null, a = (K0 || K1).a, v = vs(function (i) { return r2_(sg * ((Ks[i][kc] || {v: 0}).v)); });
      if (Math.abs(v[0]) < 0.005 && (!cmp || Math.abs(v[1]) < 0.005)) return;
      rows.push(rp_stRow_(a.Name, v, {_l: lvl}));
      if (detail) rp_codes_([K0 ? K0.mo : {}, K1 ? K1.mo : {}]).forEach(function (mc) {
        var mv = vs(function (i) { var o = Ks[i][kc] && Ks[i][kc].mo[mc]; return o ? r2_(sg * o.v) : 0; }), ma = ((K0 && K0.mo[mc]) || (K1 && K1.mo[mc])).a;
        rows.push(rp_stRow_(ma.Name, mv, {_l: lvl + 1, _acc: ma.AccID}));
      });
      for (var i = 0; i < N; i++) tot[i] += v[i];
    });
    return tot.map(r2_);
  };
  var all6 = rp_codes_(Ks, '6'), all7 = rp_codes_(Ks, '7');
  var salesK = all6.filter(function (k) { return k === '61' || k === '62'; }), othIncK = all6.filter(function (k) { return !inSet(k, ['61', '62']); });
  var cogsK = all7.filter(function (k) { return k === '71'; }), finK = all7.filter(function (k) { return k === '75'; }), othExpK = all7.filter(function (k) { return k === '77'; }), taxK = all7.filter(function (k) { return k === '78'; });
  var opK = all7.filter(function (k) { return !inSet(k, ['71', '75', '77', '78']); });
  var sec = function (t) { rows.push(rp_stRow_(t, vs(function () { return ''; }), {_sec: true})); };
  var sum = function (t, a, b, sgn) { var v = vs(function (i) { return r2_(a[i] + (sgn || 1) * b[i]); }); rows.push(rp_stRow_(t, v, {_b: true})); return v; };
  sec('درآمدهای عملیاتی');
  var sales = lines(salesK, -1, 1);
  rows.push(rp_stRow_('فروش خالص', sales, {_b: true}));
  sec('بهای تمام‌شده');
  var cogs = lines(cogsK, 1, 1);
  rows.push(rp_stRow_('بهای تمام‌شده‌ی کالای فروش‌رفته', cogs, {_b: true}));
  var gross = vs(function (i) { return r2_(sales[i] - cogs[i]); }); rows.push(rp_stRow_('سود (زیان) ناخالص', gross, {_b: true, _hl: true}));
  sec('هزینه‌های عملیاتی (فروش، اداری و عمومی و ...)');
  var opx = lines(opK, 1, 1); rows.push(rp_stRow_('جمع هزینه‌های عملیاتی', opx, {_b: true}));
  var opr = vs(function (i) { return r2_(gross[i] - opx[i]); }); rows.push(rp_stRow_('سود (زیان) عملیاتی', opr, {_b: true, _hl: true}));
  sec('درآمدها و هزینه‌های غیرعملیاتی');
  var fin = lines(finK, -1, 1), oi = lines(othIncK, -1, 1), oe = lines(othExpK, -1, 1);
  var nonop = vs(function (i) { return r2_(fin[i] + oi[i] + oe[i]); }); rows.push(rp_stRow_('خالص درآمدها (هزینه‌های) غیرعملیاتی', nonop, {_b: true}));
  var pbt = vs(function (i) { return r2_(opr[i] + nonop[i]); }); rows.push(rp_stRow_('سود (زیان) قبل از مالیات', pbt, {_b: true, _hl: true}));
  var tax = lines(taxK, 1, 1); if (taxK.length) rows.push(rp_stRow_('مالیات بر درآمد', tax, {_b: true}));
  var np = vs(function (i) { return r2_(pbt[i] - tax[i]); }); rows.push(rp_stRow_('سود (زیان) خالص', np, {_b: true, _hl: true}));
  return rp_out_('income', 'صورت سود و زیان', rp_subRange_(R), rp_stCols_(cmp, R, R2), rows, null, ['هزینه‌ها و بهای تمام‌شده با علامت مثبت و در صورت کسر شدن از درآمد نمایش داده شده‌اند؛ هزینه‌های مالی و سایر هزینه‌های غیرعملیاتی با علامت منفی.', 'تحلیل کمکی از روی اسناد حسابداری (بدون اسناد اختتامیه)؛ قالب باید توسط حسابدار رسمی بازبینی شود.']);
}
/* خود سود خالص دوره (برای صورت تغییرات سرمایه) */
function rp_netProfit_(co, p, R) {
  var c = ac_ctx_(co), net = rp_plNet_(co, p, R), s = 0;
  Object.keys(net).forEach(function (id) { var a = c.accs[id], g = a ? String(a.Code).charAt(0) : ''; if (g === '6' || g === '7') s += net[id]; });
  return r2_(-s);
}

/* صورت تغییرات سرمایه و گردش سود (زیان) انباشته: ستون‌ها = سرمایه | اندوخته‌ها | سود (زیان) انباشته | جمع */
function rpEquity_(co, p) {
  var c = ac_ctx_(co), R = rp_range_(p); if (!R.f || !R.t) throw new Error('بازه‌ی دوره (از تاریخ و تا تاریخ) را وارد کنید.');
  var kolOf = function (a) { var k = c.accs[a.ParentID]; return k ? String(k.Code) : ''; };
  var colOf = function (kc) { return kc === '51' ? 0 : (kc === '52' ? 1 : (kc === '53' ? 2 : -1)); };
  /* مانده‌ی ابتدای دوره: همه‌ی اسناد پیش از «از تاریخ» (بدون جفت اختتامیه/افتتاحیه‌ی ترازی) */
  var vmO = rp_vm_(co, p, rp_dayBefore_(R.f), 'bs'), op = [0, 0, 0];
  rp_eachRow_(co, vmO, function (r) { var a = c.accs[r.AccID]; if (!a) return; var i = colOf(kolOf(a)); if (i >= 0) op[i] += rp_n_(r.Credit) - rp_n_(r.Debit); });
  var vmP = rp_vm_(co, p, R.t, 'pl'), mv = [0, 0, 0];
  rp_eachRow_(co, vmP, function (r, v) { if (v.DateGregorian < R.f) return; var a = c.accs[r.AccID]; if (!a) return; var i = colOf(kolOf(a)); if (i >= 0) mv[i] += rp_n_(r.Credit) - rp_n_(r.Debit); });
  var np = rp_netProfit_(co, p, R), T = mv[1], other = mv[2] + T;
  var rowsDef = [], add = function (t, a, o) { var s = r2_(a[0] + a[1] + a[2]); rowsDef.push({t: t, a: r2_(a[0]) || '', b: r2_(a[1]) || '', d: r2_(a[2]) || '', s: s || '', _b: o && o.b, _hl: o && o.hl}); };
  add('مانده در ابتدای دوره (' + R.fj + ')', op, {b: true});
  var cur = op.slice();
  var step = function (t, a) { if (Math.abs(a[0]) + Math.abs(a[1]) + Math.abs(a[2]) < 0.005) return; add(t, a); for (var i = 0; i < 3; i++) cur[i] += a[i]; };
  step('سود (زیان) خالص دوره', [0, 0, np]);
  step('افزایش (کاهش) سرمایه', [mv[0], 0, 0]);
  step('انتقال به اندوخته‌ها (از جمله اندوخته‌ی قانونی)', [0, T, -T]);
  step('سود سهام مصوب و سایر تعدیلات سود انباشته', [0, 0, other]);
  add('مانده در پایان دوره (' + R.tj + ')', cur, {b: true, hl: true});
  return rp_out_('equity', 'صورت تغییرات سرمایه و گردش سود (زیان) انباشته', rp_subRange_(R), [rp_col_('t', 'شرح'), rp_col_('a', 'سرمایه', 1), rp_col_('b', 'اندوخته‌ها', 1), rp_col_('d', 'سود (زیان) انباشته', 1), rp_col_('s', 'جمع', 1)], rowsDef, null,
    ['سرمایه = گروه کل ۵۱، اندوخته‌ها = ۵۲، سود (زیان) انباشته = ۵۳. هر مانده‌ی بستانکار مثبت و بدهکار منفی است.', 'اگر حساب سرمایه یا سود انباشته در سند اختتامیه جابه‌جا شده باشد، فقط جمع نهایی پایان دوره (که سود خالص را شامل می‌شود) معتبر است. تعدیلات سنواتی جداگانه شناسایی نمی‌شود و در «سایر تعدیلات» می‌آید.']);
}

/* صورت جریان وجوه نقد (روش مستقیم) از روی اسناد: هر ردیف غیرنقدی، سهم نقدیِ همان سند را مشخص می‌کند (بستانکار − بدهکار) */
var RP_CF_ORDER = [
  ['op_recv', 'دریافت‌های نقدی از مشتریان و بابت فروش', 'op'], ['op_pay', 'پرداخت‌های نقدی بابت خرید کالا و خدمات (تأمین‌کنندگان، موجودی و مالیات ارزش افزوده)', 'op'], ['op_wage', 'پرداخت‌های نقدی بابت حقوق و دستمزد', 'op'], ['op_other', 'سایر دریافت‌ها و پرداخت‌های نقدی عملیاتی (هزینه‌های اداری، فروش و ...)', 'op'],
  ['ret_in', 'سود دریافتی بابت سپرده‌ها و سرمایه‌گذاری‌ها', 'ret'], ['ret_fin', 'سود پرداختی بابت تسهیلات مالی', 'ret'], ['ret_div', 'سود سهام پرداختی', 'ret'],
  ['tax', 'مالیات بر درآمد پرداختی', 'tax'],
  ['inv_in', 'دریافت‌های نقدی حاصل از فروش دارایی‌ها و سرمایه‌گذاری‌ها', 'inv'], ['inv_out', 'پرداخت‌های نقدی برای خرید دارایی‌ها و سرمایه‌گذاری‌ها', 'inv'],
  ['fin_loan_in', 'دریافت تسهیلات مالی', 'fin'], ['fin_loan_out', 'بازپرداخت اصل تسهیلات مالی', 'fin'], ['fin_cap_in', 'افزایش سرمایه و دریافت از شرکا/سهامداران', 'fin'], ['fin_cap_out', 'کاهش سرمایه و پرداخت به شرکا/سهامداران', 'fin']
];
function rp_cfCat_(a, kc, flow) {
  var code = String(a.Code);
  if (['3201', '3202', '3203', '7201', '7202', '7203', '7204'].indexOf(code) >= 0 || kc === '72') return 'op_wage';
  if (['13', '33', '35', '61', '62'].indexOf(kc) >= 0) return 'op_recv';
  if (['15', '16', '17', '31', '71'].indexOf(kc) >= 0) return 'op_pay';
  if (code === '6301') return 'ret_in';
  if (code === '7502' || (kc === '75' && code !== '7501')) return 'ret_fin';
  if (kc === '36' || kc === '53') return 'ret_div';
  if (kc === '78' || code === '3401' || code === '1403') return 'tax';
  if (code === '6302' || code === '7701' || ['12', '21', '22', '23', '24'].indexOf(kc) >= 0) return flow >= 0 ? 'inv_in' : 'inv_out';
  if (kc === '37' || kc === '41') return flow >= 0 ? 'fin_loan_in' : 'fin_loan_out';
  if (kc === '51' || kc === '52' || kc === '54') return flow >= 0 ? 'fin_cap_in' : 'fin_cap_out';
  return 'op_other';
}
function rp_cfCalc_(co, p, R, c) {
  var vm = rp_vm_(co, p, R.t, 'pl'), cash = {}, byV = {}, res = {}, opening = 0, per = 0;
  Object.keys(c.accs).forEach(function (id) { var a = c.accs[id], k = c.accs[a.ParentID]; if (Number(a.Level) === 3 && k && String(k.Code) === '11') cash[id] = 1; });
  rp_eachRow_(co, vm, function (r, v) { (byV[v.VID] = byV[v.VID] || {v: v, rows: []}).rows.push(r); });
  var chk = 0;
  Object.keys(byV).forEach(function (vid) {
    var X = byV[vid], cashNet = 0, hasCash = false;
    X.rows.forEach(function (r) { if (cash[r.AccID]) { hasCash = true; cashNet += rp_n_(r.Debit) - rp_n_(r.Credit); } });
    if (!hasCash) return;
    var before = X.v.DateGregorian < R.f;
    if (before) { opening += cashNet; return; }
    per += cashNet;
    X.rows.forEach(function (r) {
      if (cash[r.AccID]) return;
      var a = c.accs[r.AccID], kl = a ? c.accs[a.ParentID] : null; if (!a) return;
      var flow = rp_n_(r.Credit) - rp_n_(r.Debit), cat = rp_cfCat_(a, kl ? String(kl.Code) : '', flow);
      res[cat] = (res[cat] || 0) + flow; chk += flow;
    });
  });
  return {cat: res, opening: r2_(opening), net: r2_(per), chk: r2_(chk)};
}
function rpCashFlow_(co, p) {
  var c = ac_ctx_(co), R = rp_range_(p); if (!R.f || !R.t) throw new Error('بازه‌ی دوره (از تاریخ و تا تاریخ) را وارد کنید.');
  var cmp = ac_b_(p.compare, false), R2 = cmp ? rp_cmpRange_(R) : null; if (cmp && !R2) cmp = false;
  var X = [rp_cfCalc_(co, p, R, c)]; if (cmp) X.push(rp_cfCalc_(co, p, R2, c));
  var N = cmp ? 2 : 1, rows = [], vs = function (f) { var o = []; for (var i = 0; i < N; i++) o.push(f(i)); return o; };
  var secs = [['op', 'جریان‌های نقدی حاصل از فعالیت‌های عملیاتی', 'جریان خالص ورود (خروج) نقد حاصل از فعالیت‌های عملیاتی'], ['ret', 'بازده سرمایه‌گذاری‌ها و سود پرداختی بابت تأمین مالی', 'جریان خالص ورود (خروج) نقد حاصل از بازده سرمایه‌گذاری‌ها و سود پرداختی بابت تأمین مالی'], ['tax', 'مالیات بر درآمد', 'مالیات بر درآمد پرداختی'], ['inv', 'فعالیت‌های سرمایه‌گذاری', 'جریان خالص ورود (خروج) نقد حاصل از فعالیت‌های سرمایه‌گذاری'], ['fin', 'فعالیت‌های تأمین مالی', 'جریان خالص ورود (خروج) نقد حاصل از فعالیت‌های تأمین مالی']];
  var tot = vs(function () { return 0; }), totSec = {};
  secs.forEach(function (s) {
    rows.push(rp_stRow_(s[1], vs(function () { return ''; }), {_sec: true}));
    var st = vs(function () { return 0; });
    RP_CF_ORDER.filter(function (o) { return o[2] === s[0]; }).forEach(function (o) {
      var v = vs(function (i) { return r2_(X[i].cat[o[0]] || 0); });
      if (Math.abs(v[0]) < 0.005 && (!cmp || Math.abs(v[1]) < 0.005)) return;
      rows.push(rp_stRow_(o[1], v, {_l: 1})); for (var i = 0; i < N; i++) st[i] += v[i];
    });
    st = st.map(r2_); totSec[s[0]] = st;
    rows.push(rp_stRow_(s[2], st, {_b: true})); for (var i = 0; i < N; i++) tot[i] += st[i];
  });
  tot = tot.map(r2_);
  rows.push(rp_stRow_('خالص افزایش (کاهش) وجه نقد', tot, {_b: true, _hl: true}));
  rows.push(rp_stRow_('مانده‌ی وجه نقد در ابتدای دوره', vs(function (i) { return X[i].opening; }), {_b: true}));
  rows.push(rp_stRow_('مانده‌ی وجه نقد در پایان دوره', vs(function (i) { return r2_(X[i].opening + X[i].net); }), {_b: true, _hl: true}));
  var notes = ['وجه نقد = موجودی صندوق، تنخواه‌گردان، بانک‌ها و وجوه در راه (گروه کل ۱۱).', 'روش مستقیم: برای هر سند، سهم نقدی هر ردیف غیرنقدی (بستانکار − بدهکار) در طبقه‌ی مربوط به آن حساب جمع می‌شود. طبقه‌بندی حساب‌ها بر پایه‌ی کد حساب است؛ حساب‌هایی که نتوانسته‌ایم طبقه‌بندی کنیم، در «سایر عملیاتی» آمده‌اند.'];
  for (var i = 0; i < N; i++) if (Math.abs(X[i].chk - X[i].net) > 0.01) notes.push('⚠ مجموع طبقه‌ها با تغییر موجودی نقد برابر نیست (اختلاف ' + fmtNum_(r2_(X[i].chk - X[i].net)) + ')؛ احتمالاً سند ناتراز دارید.');
  return rp_out_('cashFlow', 'صورت جریان وجوه نقد', rp_subRange_(R), rp_stCols_(cmp, R, R2), rows, null, notes);
}

/* ---------- کارت حساب کالا (کاردکس مقداری) ---------- */
function rpGoodsCard_(co, p) {
  var pid = tr_(p.product); if (!pid) throw new Error('کالا را انتخاب کنید.');
  var pr = pr_prod_(co, pid, 'کالا'), R = rp_range_(p), ev = [], carry = 0;
  var sup = {}, cus = {}, inv = {}, sl = {};
  rows_('Suppliers').forEach(function (r) { if (r.CompanyID === co) sup[r.SupplierID] = r.Name; });
  rows_('Customers').forEach(function (r) { if (r.CompanyID === co) cus[r.CustomerID] = r.Name; });
  var add = function (g, j, type, no, party, qin, qout, amt, o) { ev.push(Object.assign({g: g, j: j, type: type, no: no, party: party, qin: qin, qout: qout, amt: amt}, o || {})); };
  var opQ = rp_n_(pr.OpeningQty), opC = rp_n_(pr.OpeningCost);
  rows_('PurchaseInvoices').forEach(function (r) { if (r.CompanyID === co) inv[r.InvoiceID] = r; });
  rows_('PurchaseItems').forEach(function (it) {
    var iv = inv[it.InvoiceID]; if (!iv || it.ProductID !== pid) return;
    var ret = iv.DocType === 'return', q = rp_n_(it.Quantity), a = rp_n_(it.NetAfterDiscount);
    add(iv.DateGregorian, iv.DateJalali, ret ? 'برگشت از خرید' : 'خرید', iv.InvoiceNo, sup[iv.SupplierID] || '', ret ? 0 : q, ret ? q : 0, a, {_inv: ['purchase', iv.InvoiceID]});
  });
  rows_('SalesInvoices').forEach(function (r) { if (r.CompanyID === co) sl[r.SaleID] = r; });
  rows_('SalesItems').forEach(function (it) {
    var s = sl[it.SaleID]; if (!s || it.ProductID !== pid || !sl_valid_(s)) return;
    var ins = Number(s.Ins), q = rp_n_(it.Am), a = rp_n_(it.Adis) || (rp_n_(it.Prdis) - rp_n_(it.Dis));
    add(s.DateGregorian, s.DateJalali, ins === 4 ? 'برگشت از فروش' : 'فروش', s.SerialNo, cus[s.CustomerID] || '', ins === 4 ? q : 0, ins === 4 ? 0 : q, a, {_inv: ['sale', s.SaleID]});
  });
  var ord = {};
  rows_('ProdOrders').forEach(function (o) { if (o.CompanyID === co && o.Status === 'تکمیل‌شده') { ord[o.OrderID] = o; if (o.ProductID === pid) add(o.DoneDateGregorian || o.DateGregorian, o.DoneJalali || o.DateJalali, 'تولید (ورود)', o.OrderNo, '', rp_n_(o.ActualQty), 0, rp_n_(o.TotalCost)); } });
  rows_('ProdMaterials').forEach(function (x) { var o = ord[x.OrderID]; if (o && x.ProductID === pid) add(o.DoneDateGregorian || o.DateGregorian, o.DoneJalali || o.DateJalali, 'مصرف در تولید', o.OrderNo, '', 0, rp_n_(x.ActualQty === '' ? x.PlannedQty : x.ActualQty), rp_n_(x.Cost)); });
  ev.sort(function (a, b) { return a.g < b.g ? -1 : (a.g > b.g ? 1 : 0); });
  var bal = opQ, rows = [], TI = 0, TO = 0;
  if (R.f) ev.forEach(function (e) { if (e.g < R.f) bal += e.qin - e.qout; });
  rows.push({date: '', type: 'موجودی اولیه' + (R.f ? ' / مانده از قبل' : ''), no: '', party: '', qin: '', qout: '', bal: r2_(bal), amt: opC && !R.f ? r2_(opQ * opC) : '', _b: true});
  ev.forEach(function (e) {
    if (R.f && e.g < R.f) return; if (R.t && e.g > R.t) return;
    bal += e.qin - e.qout; TI += e.qin; TO += e.qout;
    rows.push({date: e.j, type: e.type, no: e.no, party: e.party, qin: e.qin || '', qout: e.qout || '', bal: Math.round(bal * 1e4) / 1e4, amt: r2_(e.amt) || '', _inv: e._inv});
  });
  return rp_out_('goodsCard', 'کارت حساب کالا — ' + (pr.ProductCode ? pr.ProductCode + ' - ' : '') + pr.Name + (pr.DefaultUnit ? ' (' + pr.DefaultUnit + ')' : ''), rp_subRange_(R), [rp_col_('date', 'تاریخ'), rp_col_('type', 'نوع گردش'), rp_col_('no', 'شماره سند / فاکتور'), rp_col_('party', 'طرف حساب'), rp_col_('qin', 'ورود', 1), rp_col_('qout', 'خروج', 1), rp_col_('bal', 'مانده مقدار', 1), rp_col_('amt', 'مبلغ سند (پس از تخفیف، ریال)', 1)], rows,
    {type: 'جمع', qin: Math.round(TI * 1e4) / 1e4, qout: Math.round(TO * 1e4) / 1e4, bal: Math.round(bal * 1e4) / 1e4},
    ['مقدار موجودی از جمع موجودی اولیه، خرید، برگشت از خرید، فروش، برگشت از فروش و تولید (فقط سفارش‌های «تکمیل‌شده») به‌دست می‌آید. فاکتورهای فروش ابطال/اصلاح‌شده حساب نمی‌شوند.']);
}

/* ================= گزارش‌های خرید و فروش ================= */
function rp_inR_(g, R) { return !(R.f && g < R.f) && !(R.t && g > R.t); }
function rp_sgn_(s) { return Number(s.Ins) === 4 ? -1 : 1; }
function rp_names_(co) {
  var N = {cus: {}, sup: {}, prd: {}, prdCode: {}, unit: {}};
  rows_('Customers').forEach(function (r) { if (r.CompanyID === co) N.cus[r.CustomerID] = r.Name; });
  rows_('Suppliers').forEach(function (r) { if (r.CompanyID === co) N.sup[r.SupplierID] = r.Name; });
  rows_('Products').forEach(function (r) { if (r.CompanyID === co) { N.prd[r.ProductID] = r.Name; N.prdCode[r.ProductID] = String(r.ProductCode || ''); N.unit[r.ProductID] = r.DefaultUnit || ''; } });
  rows_('Services').forEach(function (r) { if (r.CompanyID === co) { N.prd[r.ServiceID] = r.Name + ' (خدمت)'; N.prdCode[r.ServiceID] = String(r.ServiceCode || ''); N.unit[r.ServiceID] = r.DefaultUnit || ''; } });
  return N;
}
function rp_saleList_(co, p, R) {
  var cu = tr_(p.customer), all = ac_b_(p.all, false);
  return rows_('SalesInvoices').filter(function (s) {
    if (s.CompanyID !== co || !rp_inR_(s.DateGregorian, R)) return false;
    if (cu && s.CustomerID !== cu) return false;
    if (!all && !sl_valid_(s)) return false;
    return true;
  }).sort(function (a, b) { return a.DateGregorian < b.DateGregorian ? -1 : (a.DateGregorian > b.DateGregorian ? 1 : (Number(a.SerialNo) - Number(b.SerialNo))); });
}
function rp_salePay_(co) {
  var pm = {};
  rows_('DocPayments').forEach(function (y) { if (y.CompanyID !== co || y.DocType !== 'sale' || (y.Method === 'چک' && y.ChequeStatus === 'عودت شده')) return; pm[y.DocID] = r2_((pm[y.DocID] || 0) + rp_n_(y.Amount)); });
  return pm;
}
function rp_purList_(co, p, R) {
  var su = tr_(p.supplier);
  return rows_('PurchaseInvoices').map(normInv_).filter(function (r) {
    if (r.CompanyID !== co || !rp_inR_(r.DateGregorian, R)) return false;
    return !su || r.SupplierID === su;
  }).sort(function (a, b) { return a.DateGregorian < b.DateGregorian ? -1 : (a.DateGregorian > b.DateGregorian ? 1 : 0); });
}
var RP_INS = {1: 'اصلی', 2: 'اصلاحی', 3: 'ابطالی', 4: 'برگشت از فروش'};

function rpSalesByProduct_(co, p) {
  var R = rp_range_(p), N = rp_names_(co), sales = {}, agg = {}, keys = [];
  rp_saleList_(co, p, R).forEach(function (s) { sales[s.SaleID] = s; });
  rows_('SalesItems').forEach(function (it) {
    var s = sales[it.SaleID]; if (!s) return;
    var sg = rp_sgn_(s), key = it.ProductID || ('t|' + (it.Sstt || '؟')), o = agg[key];
    if (!o) { o = agg[key] = {id: it.ProductID, name: it.ProductID ? (N.prd[it.ProductID] || '؟') : (it.Sstt || '؟'), code: N.prdCode[it.ProductID] || '', unit: N.unit[it.ProductID] || '', qs: 0, qr: 0, g: 0, d: 0, a: 0, v: 0, t: 0}; keys.push(key); }
    var q = rp_n_(it.Am), pr = rp_n_(it.Prdis), dis = rp_n_(it.Dis), ad = rp_n_(it.Adis) || (pr - dis);
    if (sg < 0) o.qr += q; else o.qs += q;
    o.g += sg * pr; o.d += sg * dis; o.a += sg * ad; o.v += sg * rp_n_(it.Vam); o.t += sg * (rp_n_(it.Tsstam) || (ad + rp_n_(it.Vam)));
  });
  var rows = [], T = {qs: 0, qr: 0, g: 0, d: 0, a: 0, v: 0, t: 0};
  keys.map(function (k) { return agg[k]; }).sort(function (x, y) { return y.a - x.a; }).forEach(function (o) {
    rows.push({code: o.code, name: o.name, unit: o.unit, qs: o.qs, qr: o.qr || '', qn: Math.round((o.qs - o.qr) * 1e4) / 1e4, g: r2_(o.g), d: r2_(o.d) || '', a: r2_(o.a), v: r2_(o.v) || '', t: r2_(o.t)});
    Object.keys(T).forEach(function (k) { T[k] += o[k]; });
  });
  return rp_out_('salesByProduct', 'فروش به تفکیک کالا', rp_subRange_(R) + (p.customer ? ' | مشتری: ' + (N.cus[p.customer] || '') : ''), [rp_col_('code', 'کد'), rp_col_('name', 'کالا / خدمت'), rp_col_('unit', 'واحد'), rp_col_('qs', 'تعداد فروش', 1), rp_col_('qr', 'تعداد برگشتی', 1), rp_col_('qn', 'تعداد خالص', 1), rp_col_('g', 'مبلغ ناخالص', 1), rp_col_('d', 'تخفیف', 1), rp_col_('a', 'پس از تخفیف', 1), rp_col_('v', 'مالیات', 1), rp_col_('t', 'جمع', 1)], rows,
    {name: 'جمع', qs: '', qr: '', qn: '', g: r2_(T.g), d: r2_(T.d), a: r2_(T.a), v: r2_(T.v), t: r2_(T.t)}, ['فاکتورهای برگشت از فروش از مبالغ کسر شده‌اند؛ فاکتورهای ابطال/اصلاح‌شده و ردشده حساب نمی‌شوند.']);
}
function rpPurchByProduct_(co, p) {
  var R = rp_range_(p), N = rp_names_(co), inv = {}, agg = {}, keys = [];
  rp_purList_(co, p, R).forEach(function (r) { inv[r.InvoiceID] = r; });
  rows_('PurchaseItems').forEach(function (it) {
    var iv = inv[it.InvoiceID]; if (!iv) return;
    var sg = iv.DocType === 'return' ? -1 : 1, key = it.ProductID, o = agg[key];
    if (!o) { o = agg[key] = {name: N.prd[key] || '؟', code: N.prdCode[key] || '', unit: N.unit[key] || '', qs: 0, qr: 0, g: 0, d: 0, a: 0, v: 0, t: 0}; keys.push(key); }
    var q = rp_n_(it.Quantity); if (sg < 0) o.qr += q; else o.qs += q;
    o.g += sg * rp_n_(it.Gross); o.d += sg * rp_n_(it.Discount); o.a += sg * rp_n_(it.NetAfterDiscount); o.v += sg * rp_n_(it.VAT); o.t += sg * rp_n_(it.LineTotal);
  });
  var rows = [], T = {g: 0, d: 0, a: 0, v: 0, t: 0};
  keys.map(function (k) { return agg[k]; }).sort(function (x, y) { return y.a - x.a; }).forEach(function (o) {
    rows.push({code: o.code, name: o.name, unit: o.unit, qs: o.qs, qr: o.qr || '', qn: Math.round((o.qs - o.qr) * 1e4) / 1e4, g: r2_(o.g), d: r2_(o.d) || '', a: r2_(o.a), v: r2_(o.v) || '', t: r2_(o.t)});
    Object.keys(T).forEach(function (k) { T[k] += o[k]; });
  });
  return rp_out_('purchByProduct', 'خرید به تفکیک کالا', rp_subRange_(R) + (p.supplier ? ' | فروشنده: ' + (N.sup[p.supplier] || '') : ''), [rp_col_('code', 'کد'), rp_col_('name', 'کالا / خدمت'), rp_col_('unit', 'واحد'), rp_col_('qs', 'تعداد خرید', 1), rp_col_('qr', 'برگشت از خرید', 1), rp_col_('qn', 'تعداد خالص', 1), rp_col_('g', 'مبلغ ناخالص', 1), rp_col_('d', 'تخفیف', 1), rp_col_('a', 'پس از تخفیف', 1), rp_col_('v', 'مالیات', 1), rp_col_('t', 'جمع', 1)], rows,
    {name: 'جمع', g: r2_(T.g), d: r2_(T.d), a: r2_(T.a), v: r2_(T.v), t: r2_(T.t)}, ['هزینه‌های جانبی فاکتور (حمل و ...) در این گزارش نیست؛ برگشت از خرید کسر شده است.']);
}
function rpSalesByInvoice_(co, p) {
  var R = rp_range_(p), N = rp_names_(co), pm = rp_salePay_(co), rows = [], T = {a: 0, v: 0, t: 0, rec: 0, rem: 0};
  rp_saleList_(co, p, R).forEach(function (s) {
    var ok = sl_valid_(s), sg = rp_sgn_(s), x = sl_parseX_(s.Extra), tb = rp_n_(s.Tbill), rec = ok ? sl_settled_(s, pm) : 0;
    var a = sg * rp_n_(s.Tadis), v = sg * rp_n_(s.Tvam), t = sg * tb, re = ok && sg > 0 ? rec : 0, rem = ok && sg > 0 ? r2_(tb - rec) : 0;
    rows.push({ser: String(s.SerialNo), date: s.DateJalali, cus: N.cus[s.CustomerID] || '', seller: x.seller || '', kind: RP_INS[Number(s.Ins)] || '', st: ok ? (s.SendStatus || '') : (s.SendStatus || '') + ' (کنارگذاشته‌شده)', a: r2_(a), v: r2_(v) || '', t: r2_(t), rec: re || '', rem: rem || '', _inv: ['sale', s.SaleID]});
    if (ok) { T.a += a; T.v += v; T.t += t; T.rec += re; T.rem += rem; }
  });
  return rp_out_('salesByInvoice', 'فروش به تفکیک فاکتور', rp_subRange_(R) + (p.customer ? ' | مشتری: ' + (N.cus[p.customer] || '') : ''), [rp_col_('ser', 'سریال'), rp_col_('date', 'تاریخ'), rp_col_('cus', 'مشتری'), rp_col_('seller', 'فروشنده / ویزیتور'), rp_col_('kind', 'موضوع'), rp_col_('st', 'وضعیت'), rp_col_('a', 'پیش از مالیات', 1), rp_col_('v', 'مالیات', 1), rp_col_('t', 'جمع صورتحساب', 1), rp_col_('rec', 'دریافتی', 1), rp_col_('rem', 'مانده', 1)], rows,
    {cus: 'جمع (فقط فاکتورهای معتبر)', a: r2_(T.a), v: r2_(T.v), t: r2_(T.t), rec: r2_(T.rec), rem: r2_(T.rem)}, ['برگشت از فروش با علامت منفی آمده است؛ «دریافتی» = بیشینه‌ی نقدی همان فاکتور و دریافت‌های ثبت‌شده در بانکداری.']);
}
function rpPurchByInvoice_(co, p) {
  var R = rp_range_(p), N = rp_names_(co), rows = [], T = {g: 0, d: 0, a: 0, v: 0, c: 0, pay: 0, paid: 0, rem: 0};
  rp_purList_(co, p, R).forEach(function (r) {
    var sg = r.DocType === 'return' ? -1 : 1, g = sg * rp_n_(r.TotalGross), d = sg * rp_n_(r.TotalDiscount), a = sg * rp_n_(r.TotalAfterDiscount), v = sg * rp_n_(r.TotalVAT), cc = sg * rp_n_(r.TotalCosts), pay = sg * rp_n_(r.PayableTotal), paid = rp_n_(r.TotalPaid), rem = r2_(sg * rp_n_(r.Remaining));
    rows.push({no: String(r.InvoiceNo), date: r.DateJalali, sup: N.sup[r.SupplierID] || '', kind: sg < 0 ? 'برگشت از خرید' : 'خرید', g: r2_(g), d: r2_(d) || '', a: r2_(a), v: r2_(v) || '', c: r2_(cc) || '', pay: r2_(pay), paid: paid || '', rem: rem || '', st: r.PayStatus || '', _inv: ['purchase', r.InvoiceID]});
    T.g += g; T.d += d; T.a += a; T.v += v; T.c += cc; T.pay += pay; T.paid += paid; T.rem += rem;
  });
  return rp_out_('purchByInvoice', 'خرید به تفکیک فاکتور', rp_subRange_(R) + (p.supplier ? ' | فروشنده: ' + (N.sup[p.supplier] || '') : ''), [rp_col_('no', 'شماره فاکتور'), rp_col_('date', 'تاریخ'), rp_col_('sup', 'فروشنده'), rp_col_('kind', 'نوع'), rp_col_('g', 'ناخالص', 1), rp_col_('d', 'تخفیف', 1), rp_col_('a', 'پس از تخفیف', 1), rp_col_('v', 'مالیات', 1), rp_col_('c', 'هزینه‌های جانبی', 1), rp_col_('pay', 'قابل پرداخت', 1), rp_col_('paid', 'پرداخت‌شده', 1), rp_col_('rem', 'مانده', 1), rp_col_('st', 'وضعیت')], rows,
    {sup: 'جمع', g: r2_(T.g), d: r2_(T.d), a: r2_(T.a), v: r2_(T.v), c: r2_(T.c), pay: r2_(T.pay), paid: r2_(T.paid), rem: r2_(T.rem)});
}

/* ---------- گزارش مالیات (ارزش افزوده به تفکیک ماه) ---------- */
function rpTax_(co, p) {
  var R = rp_range_(p), M = {}, mk = function (j) { var k = j.substring(0, 7), o = M[k]; if (!o) o = M[k] = {sa: 0, sv: 0, so: 0, pa: 0, pv: 0, ev: 0}; return o; };
  rows_('SalesInvoices').forEach(function (s) {
    if (s.CompanyID !== co || !rp_inR_(s.DateGregorian, R) || !sl_valid_(s)) return;
    var o = mk(s.DateJalali), sg = rp_sgn_(s); o.sa += sg * rp_n_(s.Tadis); o.sv += sg * rp_n_(s.Tvam); o.so += sg * rp_n_(s.Todam);
  });
  var inv = {};
  rows_('PurchaseInvoices').forEach(function (r) {
    if (r.CompanyID !== co || !rp_inR_(r.DateGregorian, R)) return; inv[r.InvoiceID] = r;
    var o = mk(r.DateJalali), sg = r.DocType === 'return' ? -1 : 1; o.pa += sg * rp_n_(r.TotalAfterDiscount); o.pv += sg * rp_n_(r.TotalVAT);
  });
  rows_('InvoiceCosts').forEach(function (cst) { var r = inv[cst.InvoiceID]; if (!r) return; mk(r.DateJalali).ev += (r.DocType === 'return' ? -1 : 1) * rp_n_(cst.VAT); });
  rows_('ExpenseInvoices').forEach(function (e) { if (e.CompanyID !== co || !rp_inR_(e.DateGregorian, R)) return; if (String(e.VATInCost) === 'true') return; mk(e.DateJalali).ev += rp_n_(e.VAT); });
  var rows = [], T = {sa: 0, sv: 0, so: 0, pa: 0, pv: 0, ev: 0};
  Object.keys(M).sort().forEach(function (k) {
    var o = M[k], cr = o.pv + o.ev, pay = o.sv - cr, mm = parseInt(k.substring(5, 7), 10);
    rows.push({m: k.substring(0, 4) + ' ' + (RP_MON[mm - 1] || ''), sa: r2_(o.sa), sv: r2_(o.sv), so: r2_(o.so) || '', pa: r2_(o.pa), pv: r2_(o.pv), ev: r2_(o.ev) || '', cr: r2_(cr), pay: r2_(pay)});
    Object.keys(T).forEach(function (x) { T[x] += o[x]; });
  });
  var cr = T.pv + T.ev;
  return rp_out_('tax', 'گزارش مالیات بر ارزش افزوده (به تفکیک ماه)', rp_subRange_(R), [rp_col_('m', 'ماه'), rp_col_('sa', 'فروش خالص (پیش از مالیات)', 1), rp_col_('sv', 'مالیات فروش', 1), rp_col_('so', 'عوارض و سایر مالیات فروش', 1), rp_col_('pa', 'خرید خالص (پیش از مالیات)', 1), rp_col_('pv', 'مالیات خرید کالا', 1), rp_col_('ev', 'مالیات هزینه‌ها و هزینه‌های جانبی', 1), rp_col_('cr', 'جمع مالیات قابل کسر', 1), rp_col_('pay', 'مالیات قابل پرداخت (منفی = اعتبار)', 1)], rows,
    {m: 'جمع', sa: r2_(T.sa), sv: r2_(T.sv), so: r2_(T.so), pa: r2_(T.pa), pv: r2_(T.pv), ev: r2_(T.ev), cr: r2_(cr), pay: r2_(T.sv - cr)},
    ['ماه = ماه شمسی تاریخ فاکتور. مالیات هزینه‌ای که جزو بهای هزینه گرفته شده، قابل کسر حساب نشده است. این گزارش کمکی است؛ مبنای اظهارنامه‌ی ارزش افزوده، سامانه‌ی مؤدیان و قوانین جاری است و باید با آن تطبیق داده شود.']);
}

/* ---------- سود فاکتور ---------- */
function rpInvoiceProfit_(co, p) {
  var R = rp_range_(p), N = rp_names_(co), cm = prCostMap_(co, prCfg_(co).method), sales = rp_saleList_(co, p, R), byS = {}, rows = [], T = {a: 0, c: 0, g: 0};
  var isP = {}; rows_('Products').forEach(function (r) { if (r.CompanyID === co) isP[r.ProductID] = 1; });
  rows_('SalesItems').forEach(function (it) { (byS[it.SaleID] = byS[it.SaleID] || []).push(it); });
  sales.forEach(function (s) {
    var sg = rp_sgn_(s), cost = 0, noCost = 0;
    (byS[s.SaleID] || []).forEach(function (it) { if (!isP[it.ProductID]) return; var u = rp_n_(cm[it.ProductID]); if (!u) noCost++; cost += rp_n_(it.Am) * u; });
    var a = sg * rp_n_(s.Tadis), c = sg * r2_(cost), g = a - c;
    rows.push({ser: String(s.SerialNo), date: s.DateJalali, cus: N.cus[s.CustomerID] || '', a: r2_(a), c: r2_(c), g: r2_(g), pct: a ? Math.round(g / a * 1000) / 10 : '', note: noCost ? 'بهای ' + noCost + ' کالا صفر است' : '', _inv: ['sale', s.SaleID]});
    T.a += a; T.c += c; T.g += g;
  });
  return rp_out_('invoiceProfit', 'سود فاکتور (فروش پس از تخفیف − بهای تمام‌شده)', rp_subRange_(R), [rp_col_('ser', 'سریال'), rp_col_('date', 'تاریخ'), rp_col_('cus', 'مشتری'), rp_col_('a', 'فروش (پیش از مالیات)', 1), rp_col_('c', 'بهای تمام‌شده', 1), rp_col_('g', 'سود (زیان)', 1), rp_col_('pct', 'درصد سود', 1), rp_col_('note', 'توضیح')], rows,
    {cus: 'جمع', a: r2_(T.a), c: r2_(T.c), g: r2_(T.g), pct: T.a ? Math.round(T.g / T.a * 1000) / 10 : ''}, ['بهای تمام‌شده طبق روش بهای‌یابی تنظیمات تولید و با بهای فعلی کالا محاسبه می‌شود (همان مبنای سند «بهای تمام‌شده کالای فروش‌رفته»)؛ اگر بهای کالا بعدها تغییر کند، این عدد هم تغییر می‌کند. خدمات بهای تمام‌شده ندارند.']);
}

/* ---------- خلاصه فاکتور به تفکیک شخص ---------- */
function rpPartySummary_(co, p) {
  var R = rp_range_(p), N = rp_names_(co), kind = String(p.kind || 'both'), rows = [], pm = rp_salePay_(co), TT = {n: 0, t: 0, paid: 0, rem: 0};
  var emit = function (title, list, T) {
    rows.push({name: title, n: '', t: '', paid: '', rem: '', _sec: true});
    var L = Object.keys(list).map(function (k) { return list[k]; }).sort(function (a, b) { return b.t - a.t; }), S = {n: 0, t: 0, paid: 0, rem: 0};
    L.forEach(function (o) { rows.push({name: o.name, n: o.n, t: r2_(o.t), paid: r2_(o.paid) || '', rem: r2_(o.rem) || '', _party: [o.type, o.id]}); S.n += o.n; S.t += o.t; S.paid += o.paid; S.rem += o.rem; });
    rows.push({name: 'جمع ' + title, n: S.n, t: r2_(S.t), paid: r2_(S.paid), rem: r2_(S.rem), _b: true});
  };
  if (kind === 'both' || kind === 'customer') {
    var cu = {};
    rp_saleList_(co, p, R).forEach(function (s) {
      var sg = rp_sgn_(s), o = cu[s.CustomerID] || (cu[s.CustomerID] = {id: s.CustomerID, type: 'customer', name: N.cus[s.CustomerID] || '؟', n: 0, t: 0, paid: 0, rem: 0}), tb = rp_n_(s.Tbill), rec = sl_settled_(s, pm);
      o.n++; o.t += sg * tb; if (sg > 0) { o.paid += rec; o.rem += tb - rec; }
    });
    emit('خریداران (فاکتورهای فروش)', cu);
  }
  if (kind === 'both' || kind === 'supplier') {
    var su = {};
    rp_purList_(co, p, R).forEach(function (r) {
      var sg = r.DocType === 'return' ? -1 : 1, o = su[r.SupplierID] || (su[r.SupplierID] = {id: r.SupplierID, type: 'supplier', name: N.sup[r.SupplierID] || '؟', n: 0, t: 0, paid: 0, rem: 0});
      o.n++; o.t += sg * rp_n_(r.PayableTotal); o.paid += sg > 0 ? rp_n_(r.TotalPaid) : 0; o.rem += sg * rp_n_(r.Remaining);
    });
    emit('فروشندگان (فاکتورهای خرید)', su);
  }
  return rp_out_('partySummary', 'خلاصه‌ی فاکتورها به تفکیک شخص', rp_subRange_(R), [rp_col_('name', 'نام'), rp_col_('n', 'تعداد فاکتور', 1), rp_col_('t', 'جمع مبلغ', 1), rp_col_('paid', 'تسویه‌شده', 1), rp_col_('rem', 'مانده', 1)], rows, null, ['برگشت از فروش/خرید از جمع مبلغ کسر شده است.']);
}

/* ---------- فروش به تفکیک فروشنده / ویزیتور ---------- */
function rpSalesBySeller_(co, p) {
  var R = rp_range_(p), agg = {};
  rp_saleList_(co, p, R).forEach(function (s) {
    var x = sl_parseX_(s.Extra), nm = tr_(x.seller) || '(بدون فروشنده)', sg = rp_sgn_(s), o = agg[nm] || (agg[nm] = {n: 0, nr: 0, a: 0, v: 0, t: 0});
    if (sg > 0) o.n++; else o.nr++; o.a += sg * rp_n_(s.Tadis); o.v += sg * rp_n_(s.Tvam); o.t += sg * rp_n_(s.Tbill);
  });
  var rows = [], T = {n: 0, nr: 0, a: 0, v: 0, t: 0};
  Object.keys(agg).sort(function (a, b) { return agg[b].t - agg[a].t; }).forEach(function (k) {
    var o = agg[k]; rows.push({name: k, n: o.n, nr: o.nr || '', a: r2_(o.a), v: r2_(o.v) || '', t: r2_(o.t), avg: o.n ? r2_(o.t / o.n) : ''});
    Object.keys(T).forEach(function (x) { T[x] += o[x]; });
  });
  return rp_out_('salesBySeller', 'فروش به تفکیک فروشنده / ویزیتور', rp_subRange_(R), [rp_col_('name', 'فروشنده / ویزیتور'), rp_col_('n', 'تعداد فاکتور', 1), rp_col_('nr', 'تعداد برگشتی', 1), rp_col_('a', 'فروش خالص (پیش از مالیات)', 1), rp_col_('v', 'مالیات', 1), rp_col_('t', 'جمع صورتحساب', 1), rp_col_('avg', 'میانگین هر فاکتور', 1)], rows,
    {name: 'جمع', n: T.n, nr: T.nr || '', a: r2_(T.a), v: r2_(T.v), t: r2_(T.t)}, ['نام فروشنده در فرم «فاکتور فروش» (فیلد فروشنده / ویزیتور) ثبت می‌شود؛ فاکتورهای قدیمی بدون فروشنده در ردیف «بدون فروشنده» می‌آیند.']);
}

/* ---------- وضعیت اقساط / سررسید طلب‌ها و بدهی‌ها ---------- */
function rp_days_(a, b) { return Math.round((new Date(a + 'T12:00:00Z') - new Date(b + 'T12:00:00Z')) / 864e5); }
function rpInstallments_(co, p) {
  var dir = String(p.dir || 'both'), asof = p.asof ? ac_dateReq_(p.asof, 'تاریخ مبنا').g : parseJ_(pr_today_()).g, N = rp_names_(co), rows = [], B = {late: 0, w7: 0, w30: 0, more: 0, n: 0}, T = 0;
  var bucket = function (d) { return d < 0 ? 'late' : (d <= 7 ? 'w7' : (d <= 30 ? 'w30' : 'more')); };
  var label = {late: 'سررسید گذشته', w7: 'تا ۷ روز آینده', w30: '۸ تا ۳۰ روز آینده', more: 'بیش از ۳۰ روز'};
  var list = [];
  rows_('Cheques').forEach(function (c) {
    if (c.CompanyID !== co) return;
    var pend = c.Dir === 'in' ? (c.Status === 'عادی' || c.Status === 'در جریان وصول') : c.Status === 'عادی';
    if (!pend) return; if (dir !== 'both' && c.Dir !== dir) return;
    if (!c.DueGregorian) return;
    var d = rp_days_(c.DueGregorian, asof), party = c.PartyName || (c.PartyType === 'customer' ? N.cus[c.PartyID] : N.sup[c.PartyID]) || '';
    list.push({g: c.DueGregorian, d: d, row: {type: c.Dir === 'in' ? 'چک دریافتی (طلب)' : 'چک پرداختی (بدهی)', party: party, no: (c.No || '') + (c.SayadNo ? ' / صیاد ' + c.SayadNo : ''), bank: c.BankName || '', due: c.DueJalali, amt: rp_n_(c.Amount), days: d, bk: label[bucket(d)], st: c.Status}});
  });
  if (ac_b_(p.inv, true)) {
    var pm = rp_salePay_(co);
    if (dir !== 'out') rows_('SalesInvoices').forEach(function (s) {
      if (s.CompanyID !== co || !sl_valid_(s) || rp_sgn_(s) < 0) return;
      var rem = r2_(rp_n_(s.Tbill) - sl_settled_(s, pm)); if (rem <= 0.5) return;
      list.push({g: '9999', d: -rp_days_(asof, s.DateGregorian), row: {type: 'مانده فاکتور فروش (طلب)', party: N.cus[s.CustomerID] || '', no: String(s.SerialNo), bank: '', due: '', amt: rem, days: '', bk: 'بدون سررسید', st: rp_days_(asof, s.DateGregorian) + ' روز از صدور (' + s.DateJalali + ')', _inv: ['sale', s.SaleID]}});
    });
    if (dir !== 'in') rp_purList_(co, {}, {f: '', t: ''}).forEach(function (r) {
      var rem = r2_(rp_n_(r.Remaining)); if (r.DocType === 'return' || rem <= 0.5) return;
      list.push({g: '9999', d: -rp_days_(asof, r.DateGregorian), row: {type: 'مانده فاکتور خرید (بدهی)', party: N.sup[r.SupplierID] || '', no: String(r.InvoiceNo), bank: '', due: '', amt: rem, days: '', bk: 'بدون سررسید', st: rp_days_(asof, r.DateGregorian) + ' روز از صدور (' + r.DateJalali + ')', _inv: ['purchase', r.InvoiceID]}});
    });
  }
  list.sort(function (a, b) { return a.g < b.g ? -1 : (a.g > b.g ? 1 : 0); });
  list.forEach(function (x) { rows.push(x.row); if (x.row.days !== '') { B[bucket(x.d)] += x.row.amt * (x.row.type.indexOf('دریافتی') >= 0 ? 1 : -1); } T += x.row.amt * (x.row.type.indexOf('طلب') >= 0 ? 1 : -1); });
  var nt = ['تاریخ مبنا: ' + (p.asof || pr_today_()) + '. ردیف‌ها بر اساس تاریخ سررسید مرتب شده‌اند؛ مانده‌ی فاکتورها سررسید ندارند و بر حسب سن (روز از صدور) نشان داده شده‌اند.', 'خالص چک‌ها به تفکیک سررسید (دریافتی مثبت، پرداختی منفی): ' + [['late', 'گذشته'], ['w7', 'تا ۷ روز'], ['w30', '۸ تا ۳۰ روز'], ['more', 'بیش از ۳۰ روز']].map(function (k) { return k[1] + ' ' + fmtNum_(r2_(B[k[0]])); }).join(' | ')];
  return rp_out_('installments', 'وضعیت اقساط — سررسید طلب‌ها و بدهی‌ها', 'تا تاریخ مبنا ' + (p.asof || pr_today_()), [rp_col_('type', 'نوع'), rp_col_('party', 'طرف حساب'), rp_col_('no', 'شماره چک / فاکتور'), rp_col_('bank', 'بانک'), rp_col_('due', 'سررسید'), rp_col_('amt', 'مبلغ', 1), rp_col_('days', 'روز تا سررسید', 1), rp_col_('bk', 'وضعیت سررسید'), rp_col_('st', 'وضعیت / توضیح')], rows,
    {type: 'خالص طلب − بدهی', amt: r2_(T)}, nt);
}

/* ---------- گزارش شماره سریال ---------- */
function rpSerials_(co, p) {
  var N = rp_names_(co), S = {}, order = [], q = nn_(p.q || ''), st = String(p.status || 'all'), pf = tr_(p.product);
  var get = function (sn, pid) { var k = sn + '|' + (pid || ''); if (!S[k]) { S[k] = {sn: sn, pid: pid, ev: []}; order.push(k); } return S[k]; };
  var inv = {}; rows_('PurchaseInvoices').forEach(function (r) { if (r.CompanyID === co) inv[r.InvoiceID] = r; });
  rows_('PurchaseItems').forEach(function (it) {
    var iv = inv[it.InvoiceID]; if (!iv || !tr_(it.Serials)) return;
    rp_serials_(it.Serials).forEach(function (sn) { get(sn, it.ProductID).ev.push({g: iv.DateGregorian, j: iv.DateJalali, k: iv.DocType === 'return' ? 'pr' : 'p', no: iv.InvoiceNo, who: N.sup[iv.SupplierID] || '', ref: ['purchase', iv.InvoiceID]}); });
  });
  var sl = {}; rows_('SalesInvoices').forEach(function (s) { if (s.CompanyID === co && sl_valid_(s)) sl[s.SaleID] = s; });
  rows_('SalesItems').forEach(function (it) {
    var s = sl[it.SaleID]; if (!s) return; var x = sl_parseX_(it.Extra); if (!tr_(x.serials)) return;
    rp_serials_(x.serials).forEach(function (sn) { get(sn, it.ProductID).ev.push({g: s.DateGregorian, j: s.DateJalali, k: Number(s.Ins) === 4 ? 'sr' : 's', no: s.SerialNo, who: N.cus[s.CustomerID] || '', ref: ['sale', s.SaleID]}); });
  });
  var rows = [], cnt = {stock: 0, sold: 0, out: 0, warn: 0};
  order.map(function (k) { return S[k]; }).sort(function (a, b) { return a.sn < b.sn ? -1 : (a.sn > b.sn ? 1 : 0); }).forEach(function (o) {
    if (pf && o.pid !== pf) return;
    if (q && nn_(o.sn + ' ' + (N.prd[o.pid] || '')).indexOf(q) < 0) return;
    o.ev.sort(function (a, b) { return a.g < b.g ? -1 : (a.g > b.g ? 1 : 0); });
    var state = '', warn = '', lastP = null, lastS = null, inStock = false, known = false;
    o.ev.forEach(function (e) {
      if (e.k === 'p') { if (inStock) warn = 'خرید تکراری بدون خروج'; inStock = true; known = true; lastP = e; }
      else if (e.k === 'pr') { if (!inStock) warn = warn || 'برگشت از خرید بدون موجودی'; inStock = false; lastS = e; state = 'برگشت به فروشنده'; }
      else if (e.k === 's') { if (!inStock && known) warn = warn || 'فروش بدون موجودی (دوباره فروخته شده؟)'; if (!known) warn = warn || 'خرید این سریال ثبت نشده'; inStock = false; lastS = e; state = 'فروخته‌شده'; }
      else if (e.k === 'sr') { inStock = true; known = true; state = 'برگشت از مشتری'; }
    });
    var status = inStock ? 'در انبار' : (state || 'فروخته‌شده');
    var kind = inStock ? 'stock' : (state === 'برگشت به فروشنده' ? 'out' : 'sold');
    if (st !== 'all' && st !== kind) return;
    cnt[kind]++; if (warn) cnt.warn++;
    var pe = o.ev.filter(function (e) { return e.k === 'p'; }).pop(), se = o.ev.filter(function (e) { return e.k === 's'; }).pop();
    rows.push({sn: o.sn, prd: N.prd[o.pid] || '؟', pno: pe ? pe.no : '', pdate: pe ? pe.j : '', psup: pe ? pe.who : '', sno: se ? se.no : '', sdate: se ? se.j : '', scus: se ? se.who : '', st: status, warn: warn, _inv: (se && !inStock ? se.ref : (pe ? pe.ref : null))});
  });
  return rp_out_('serials', 'گزارش شماره سریال', cnt.stock + ' در انبار | ' + cnt.sold + ' فروخته‌شده | ' + cnt.out + ' برگشتی به فروشنده' + (cnt.warn ? ' | ' + cnt.warn + ' هشدار' : ''), [rp_col_('sn', 'شماره سریال'), rp_col_('prd', 'کالا'), rp_col_('pno', 'فاکتور خرید'), rp_col_('pdate', 'تاریخ خرید'), rp_col_('psup', 'فروشنده'), rp_col_('sno', 'فاکتور فروش'), rp_col_('sdate', 'تاریخ فروش'), rp_col_('scus', 'خریدار'), rp_col_('st', 'وضعیت'), rp_col_('warn', 'هشدار')], rows, null,
    ['سریال‌ها را در فرم فاکتور خرید و فاکتور فروش (دکمه‌ی «سریال» هر ردیف) وارد کنید؛ هر سریال در یک خط یا با ویرگول جدا شود.']);
}

/* ---------- لاگ کاربران (فقط مدیر؛ اکشن جدا) ---------- */
var LOG_LABEL = {login: 'ورود به سامانه', csSave: 'ثبت/ویرایش بهای خدمات (قرارداد، دفتر هزینه، تنظیمات)', csDelete: 'حذف بهای خدمات', csOhRun: 'تسهیم ماهانه سربار', csOhUndo: 'لغو تسهیم ماهانه سربار', csOhYearPost: 'تعدیل پایان سال سربار کم/بیش‌جذب‌شده', csOhYearUndo: 'لغو تعدیل پایان سال سربار', csMachRun: 'محاسبه ماهانه ماشین‌آلات و اجاره', csMachUndo: 'لغو محاسبه ماهانه ماشین‌آلات', csMobRun: 'تسهیم تجهیز/برچیدن کارگاه', csMobUndo: 'لغو تسهیم کارگاه', csLaborRun: 'محاسبه دستمزد ماهانه قراردادها', csLaborUndo: 'لغو محاسبه دستمزد ماه', csStmtStatus: 'تأیید/برگشت صورت‌وضعیت پیمانکار', csRuleSave: 'تغییر قواعد بهای خدمات', saveInvoice: 'ثبت/ویرایش فاکتور خرید', deleteInvoice: 'حذف فاکتور خرید', saveSale: 'ثبت/ویرایش فاکتور فروش', deleteSale: 'حذف فاکتور فروش', saleStatus: 'تغییر وضعیت فاکتور فروش', voucherSave: 'ثبت/ویرایش سند حسابداری', voucherDelete: 'حذف سند حسابداری', voucherStatus: 'تغییر وضعیت سند', voucherRenumber: 'مرتب‌سازی شماره اسناد', save: 'ثبت/ویرایش اطلاعات پایه', deleteEntity: 'حذف اطلاعات پایه', import: 'ورود از Excel', scanCommit: 'ثبت فاکتور از روی اسکن', backup: 'پشتیبان‌گیری', backupCompany: 'پشتیبان شرکت', bankTxSave: 'ثبت گردش بانکی', bankTxDelete: 'حذف گردش بانکی', transferSave: 'ثبت انتقال', transferDelete: 'حذف انتقال', chequeSave: 'ثبت/ویرایش چک', chequeDelete: 'حذف چک', chequeStatus: 'تغییر وضعیت چک', docPaySave: 'ثبت پرداخت/دریافت فاکتور', accSave: 'ثبت/ویرایش حساب', accDelete: 'حذف حساب', expenseSave: 'ثبت فاکتور هزینه', expenseDelete: 'حذف فاکتور هزینه', prodCreate: 'ایجاد سفارش تولید', prodSave: 'ویرایش سفارش تولید', prodStatus: 'تغییر وضعیت سفارش تولید', prodDelete: 'حذف سفارش تولید', recipeSave: 'ثبت فرمول ساخت', recipeDelete: 'حذف فرمول ساخت', saveUser: 'ثبت/ویرایش کاربر', coInvite: 'دعوت کارمند شرکت', coInviteResend: 'ارسال مجدد دعوت کارمند', coInviteCancel: 'لغو دعوت کارمند', coUserSave: 'ویرایش دسترسی کارمند', coUserPassword: 'تعیین رمز موقت کارمند', setPassword: 'تغییر رمز کاربر', changeMyPassword: 'تغییر رمز خود', setSettings: 'تغییر تنظیمات', yearClose: 'بستن سال مالی', yearOpen: 'باز کردن مجدد سال مالی', yearSave: 'ثبت سال مالی'};
function log_(o) {
  var id = nextIds_('LOG', 1)[0];
  o.At = o.At || nowStr_();
  appendRows_(sh_('UserLog'), [H.UserLog.map(function (k) { return k === 'LogID' ? id : (o[k] === undefined ? '' : o[k]); })]);
}
function userLog_(p) {
  var R = rp_range_(p), u = nn_(p.user || ''), co = tr_(p.logCompany), a = tr_(p.action), rows = [], q = nn_(p.q || '');
  var list = rows_('UserLog').filter(function (r) {
    var g = String(r.At).substring(0, 10); if (R.f && g < R.f) return false; if (R.t && g > R.t) return false;
    if (u && nn_(r.Username + ' ' + r.FullName).indexOf(u) < 0) return false;
    if (co && r.CompanyID !== co) return false;
    if (a && r.Action !== a) return false;
    if (q && nn_(r.Detail + ' ' + r.Action + ' ' + (LOG_LABEL[r.Action] || '')).indexOf(q) < 0) return false;
    return true;
  }).sort(function (x, y) { return x.At < y.At ? 1 : (x.At > y.At ? -1 : 0); });
  var cn = {}; rows_('Companies').forEach(function (c) { cn[c.CompanyID] = c.Name; });
  var total = list.length; if (list.length > 2000) list = list.slice(0, 2000);
  list.forEach(function (r) {
    var at = String(r.At), g = at.substring(0, 10).split('-').map(Number), j = g.length === 3 ? g2j_(g[0], g[1], g[2]) : null, pad = function (x) { return ('0' + x).slice(-2); };
    rows.push({date: j ? j[0] + '/' + pad(j[1]) + '/' + pad(j[2]) : at.substring(0, 10), time: at.substring(11, 19), user: r.Username + (r.FullName ? ' (' + r.FullName + ')' : ''), co: cn[r.CompanyID] || '', act: LOG_LABEL[r.Action] || r.Action, detail: r.Detail || '', res: r.Result || ''});
  });
  return rp_out_('userLog', 'لاگ کاربران', rp_subRange_(R) + ' | ' + total + ' رویداد' + (total > rows.length ? ' (۲۰۰۰ مورد آخر نمایش داده می‌شود)' : ''), [rp_col_('date', 'تاریخ'), rp_col_('time', 'ساعت'), rp_col_('user', 'کاربر'), rp_col_('co', 'شرکت/مشتری'), rp_col_('act', 'عملیات'), rp_col_('detail', 'جزئیات'), rp_col_('res', 'نتیجه')], rows, null,
    ['زمان‌ها به وقت تهران است. ثبت لاگ از زمان نصب این نسخه شروع شده است و برای قبل از آن سابقه‌ای نیست.']);
}

/* ---------- نقطه‌ی ورود گزارش‌ها ---------- */
var RP_MAP = {journal: rpJournal_, journalAgg: rpJournalAgg_, kolLedger: rpKolLedger_, kolLedgerAgg: rpKolLedgerAgg_, reviewAcc: rpReviewAcc_, reviewDim: rpReviewDim_, partyCard: rpPartyCard_, detCard: rpDetCard_, projCard: rpProjCard_, debtors: rpDebtors_,
  balanceSheet: rpBalanceSheet_, income: rpIncome_, equity: rpEquity_, cashFlow: rpCashFlow_, goodsCard: rpGoodsCard_,
  salesByProduct: rpSalesByProduct_, purchByProduct: rpPurchByProduct_, salesByInvoice: rpSalesByInvoice_, purchByInvoice: rpPurchByInvoice_, tax: rpTax_, invoiceProfit: rpInvoiceProfit_, partySummary: rpPartySummary_, salesBySeller: rpSalesBySeller_, installments: rpInstallments_, serials: rpSerials_};
function report_(p) {
  var f = RP_MAP[p.id]; if (!f) throw new Error('گزارش نامعتبر است.');
  var co = rp_co_(p); return f(co, p);
}
