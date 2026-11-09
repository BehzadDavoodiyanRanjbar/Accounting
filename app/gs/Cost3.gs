/* ===================================================================
   ماژول «بهای تمام‌شده خدمات» — مرحله ۳: ماشین‌آلات (خودی/اجاره‌ای)، تجهیز و برچیدن کارگاه، کنترل هزینه‌های مستقیم کارگاه
   - استهلاک ماشین‌های خودی از روی مشخصات ماشین (خط مستقیم / نزولی / ساعت کارکرد) و به‌صورت قطعی و بدون وابستگی
     به ثبت‌های قبلی محاسبه می‌شود؛ ضریب نزولی و قاعده‌ی ماه اول از «تنظیمات» می‌آید (نیازمند تأیید).
   - نرخ ساعتی ماشین = (استهلاک + هزینه‌های ماهانه) ÷ ساعت مبنا؛ ساعت خواب طبق قاعده‌ی «idle_machine_excluded».
   - همه‌ی مبالغ ریال صحیح؛ تقسیم‌ها با BigInt و گرد نیم‌به‌بالا؛ باقیمانده‌ی گرد کردن هزینه‌ی دوره (E22) می‌شود.
   =================================================================== */
H.MachLogs = ['LogID', 'CompanyID', 'MachID', 'CCID', 'ContractID', 'DateJalali', 'DateGregorian', 'Period', 'HType', 'Hours', 'Notes', 'CreatedAt', 'UpdatedAt'];
H.MachCosts = ['MCID', 'CompanyID', 'MachID', 'Period', 'Fuel', 'Repair', 'Insurance', 'Operator', 'Other', 'Notes', 'CreatedAt', 'UpdatedAt'];
H.Mobs = ['MobID', 'CompanyID', 'ContractID', 'Kind', 'Title', 'Amount', 'Notes', 'CreatedAt', 'UpdatedAt'];
CS_KINDS.mlog = {sheet: 'MachLogs', key: 'LogID', pf: 'MLG', t: 'برگه کارکرد ماشین'};
CS_KINDS.mcost = {sheet: 'MachCosts', key: 'MCID', pf: 'MCS', t: 'هزینه ماهانه ماشین'};
CS_KINDS.mob = {sheet: 'Mobs', key: 'MobID', pf: 'MOB', t: 'تجهیز/برچیدن کارگاه'};
var CS_MHT = {work: 'کارکرد', idle: 'خواب / بیکار'};
var CS_MOBK = {setup: 'تجهیز کارگاه', demob: 'برچیدن کارگاه (برآورد)'};
CS_SEED_RULE2.push(['depr_db_factor', 'ضریب استهلاک نزولی (نرخ سالانه = ضریب ÷ عمر مفید)', 'num', '2', '', 'استاندارد ۱۱ — روش و ضریب [نیازمند تأیید]', 1]);
CS_SEED_RULE2.push(['depr_first_month', 'شروع استهلاک ماشین', 'choice', 'same', 'same:از ماه شروع بهره‌برداری|next:از ماه بعد از شروع بهره‌برداری', 'استاندارد ۱۱ — [نیازمند تأیید]', 1]);

function cs_idx_(period) { return (+period.slice(0, 4)) * 12 + (+period.slice(5, 7)) - 1; }
function cs_mpost_(co, pre) { return rows_('CostLedger').some(function (r) { return r.CompanyID === co && String(r.SrcID).indexOf(pre) === 0; }); }
function cs_postedAny_(co, re) { return rows_('CostLedger').some(function (r) { return r.CompanyID === co && re.test(String(r.SrcID)); }); }
function cs_machKeyLocked_(co, period, machId, ccId) {
  return (machId && cs_mpost_(co, 'MCH:' + period + ':' + machId)) || (ccId && cs_mpost_(co, 'RENT:' + period + ':' + ccId));
}

/* ---------- حفاظت از ماشین و منابع ---------- */
function cs_machGuard_(co, old, rec) {
  var posted = rows_('CostLedger').some(function (r) { return r.CompanyID === co && /^MCH:/.test(String(r.SrcID)) && String(r.SrcID).slice(-old.MachID.length) === old.MachID; });
  if (!posted) return;
  if (cs_b_(old.Own, false) !== rec.Own) throw new Error('برای این ماشین هزینه ثبت شده است؛ نوع مالکیت قابل‌تغییر نیست.');
  ['Cost', 'Salvage', 'LifeYears', 'DeprMethod', 'EstHours', 'InServiceJ'].forEach(function (f) {
    var x = old[f] == null ? '' : String(old[f]), y = rec[f] == null ? '' : String(rec[f]);
    if (x !== '' && y !== '' && !isNaN(Number(x)) && !isNaN(Number(y))) { x = String(Number(x)); y = String(Number(y)); }
    if (x !== y) throw new Error('برای این ماشین استهلاک/هزینه در دفتر ثبت شده است؛ مشخصات استهلاک (بها، اسقاط، عمر، روش، ساعت مفید، تاریخ شروع) قابل‌تغییر نیست. ابتدا «لغو محاسبه ماه» را برای ماه‌های ثبت‌شده بزنید.');
  });
}
function cs_machUsed_(co, id) {
  return rows_('MachLogs').filter(function (x) { return x.CompanyID === co && x.MachID === id; }).length + rows_('MachCosts').filter(function (x) { return x.CompanyID === co && x.MachID === id; }).length;
}
function cs_capCheck_(co, st, sid, amount, old) {
  var cap = 0, nm = '';
  if (st === 'expense') { var e = rows_('ExpenseInvoices').filter(function (r) { return r.CompanyID === co && r.ExpenseID === sid; })[0]; if (!e) return; cap = Number(e.CostBase) > 0 ? Number(e.CostBase) : Number(e.Amount) || 0; nm = 'فاکتور هزینه ' + e.DocNo; }
  else if (st === 'purchase') { var p = rows_('PurchaseInvoices').filter(function (r) { return r.CompanyID === co && r.InvoiceID === sid; })[0]; if (!p) return; cap = Number(p.GrandTotal) || 0; nm = 'فاکتور خرید ' + p.InvoiceNo; }
  else return;
  var used = 0; rows_('CostLedger').forEach(function (r) { if (r.CompanyID === co && r.SrcID === sid && (!old || r.CLID !== old.CLID)) used += Number(r.Amount) || 0; });
  if (cap > 0 && used + amount > cap) throw new Error('جمع هزینه‌های ثبت‌شده روی ' + nm + ' (' + (used + amount) + ') از مبلغ سند (' + cap + ') بیشتر می‌شود؛ احتمالاً یک سند دو بار ثبت شده است.');
}

/* ===================================================================
   ۱) استهلاک ماشین خودی
   =================================================================== */
function cs_hoursByPeriod_(co, machId) {
  var m = {}; rows_('MachLogs').forEach(function (r) { if (r.CompanyID === co && r.MachID === machId && r.HType === 'work') m[r.Period] = (m[r.Period] || BigInt(0)) + cs_s6_(r.Hours); });
  return m;
}
function cs_depr_(co, m, period) {
  var cost = Number(m.Cost) || 0, salv = Number(m.Salvage) || 0, base = cost - salv;
  if (!cs_b_(m.Own, false)) throw new Error('ماشین «' + m.Name + '» خودی نیست.');
  if (!(base > 0)) return {amount: 0, formula: 'مبنای استهلاک (بها − اسقاط) صفر است.', accumBefore: 0, base: 0};
  if (!tr_(m.InServiceJ)) throw new Error('ماشین «' + m.Name + '»: تاریخ شروع بهره‌برداری برای محاسبه‌ی استهلاک لازم است.');
  var fp = cs_idx_(String(m.InServiceJ).slice(0, 7)) + (cs_rule_(co, 'depr_first_month') === 'next' ? 1 : 0), pi = cs_idx_(period);
  if (pi < fp) return {amount: 0, formula: 'استهلاک ماشین از ماه ' + cs_idxName_(fp) + ' شروع می‌شود.', accumBefore: 0, base: base};
  var k = pi - fp + 1, meth = m.DeprMethod || 'sl', amount = 0, acc = 0, f = '';
  if (meth === 'hours') {
    var eh = tr_(m.EstHours); if (!(Number(eh) > 0)) throw new Error('ماشین «' + m.Name + '»: ساعت مفید برآوردی لازم است.');
    var hp = cs_hoursByPeriod_(co, m.MachID), keys = Object.keys(hp).sort(), left = base;
    keys.forEach(function (q) { var qi = cs_idx_(q); if (qi < fp || qi > pi) return; var d = Math.min(left, cs_mulDiv_(base, cs_f6_(hp[q]), eh)); if (qi < pi) { acc += d; left -= d; } else { amount = d; } });
    var hc = hp[period] ? cs_f6_(hp[period]) : '0';
    f = 'استهلاک ساعتی: (' + cost + ' − ' + salv + ') × ' + hc + ' ÷ ' + eh + ' = ' + amount + (amount < cs_mulDiv_(base, hc, eh) ? ' (محدود به باقیمانده‌ی مبنا)' : '');
  } else {
    var ly = tr_(m.LifeYears); if (!(Number(ly) > 0)) throw new Error('ماشین «' + m.Name + '»: عمر مفید لازم است.');
    var N = cs_f6_(cs_s6_(ly) * BigInt(12));
    if (k > 2400) k = 2400;
    if (meth === 'sl') {
      var cum = function (j) { return j >= Number(N) ? base : Math.min(base, cs_mulDiv_(base, j, N)); };
      amount = cum(k) - cum(k - 1); acc = cum(k - 1);
      f = 'خط مستقیم: (' + cost + ' − ' + salv + ') ÷ (' + ly + ' × ۱۲) = ' + base + ' ÷ ' + N + ' ماه؛ ماه ' + k + ' → ' + amount + ' (با گرد کردن تجمعی)';
    } else {
      var fac = cs_rule_(co, 'depr_db_factor'), book = cost, d;
      for (var j = 1; j <= k; j++) { d = Math.min(cs_mulDiv_(book, String(fac), N), book - salv); if (d < 0) d = 0; if (j === k) amount = d; else { acc += d; book -= d; } }
      f = 'نزولی (ضریب ' + fac + '): ارزش دفتری اول ماه ' + book + ' × ' + fac + ' ÷ (' + ly + ' × ۱۲) = ' + amount;
    }
  }
  return {amount: amount, formula: f, accumBefore: acc, base: base};
}
function cs_idxName_(i) { return Math.floor(i / 12) + '/' + ('0' + ((i % 12) + 1)).slice(-2); }

/* ===================================================================
   ۲) ثبت‌ها: کارکرد روزانه، هزینه‌های ماهانه‌ی ماشین، تجهیز کارگاه
   =================================================================== */
CS_EXT.mlog = {
  list: function (p, co) {
    var mach = {}, ctr = {}, cc = {}; rows_('Machines').forEach(function (r) { if (r.CompanyID === co) mach[r.MachID] = r.Name; }); rows_('Contracts').forEach(function (r) { if (r.CompanyID === co) ctr[r.ContractID] = r.No; }); rows_('CostContracts').forEach(function (r) { if (r.CompanyID === co) cc[r.CCID] = r; });
    var out = rows_('MachLogs').filter(function (r) { return r.CompanyID === co; }).map(function (r) { var o = Object.assign({}, r), c = cc[r.CCID]; o.MachName = r.MachID ? mach[r.MachID] || '' : (c ? c.Title : ''); o.Kind = r.CCID ? 'rent' : 'own'; o.ContractNo = ctr[r.ContractID] || ''; o.CCNo = c ? c.No : ''; return o; });
    if (tr_(p.period)) { var pe = cs_periodOf_(p.period); out = out.filter(function (r) { return r.Period === pe; }); }
    if (tr_(p.mach)) out = out.filter(function (r) { return r.MachID === p.mach || r.CCID === p.mach; });
    out.sort(function (a, b) { return a.DateGregorian < b.DateGregorian ? -1 : a.DateGregorian > b.DateGregorian ? 1 : (a.LogID < b.LogID ? -1 : 1); });
    return {rows: out};
  },
  save: function (p, co) {
    var o = p.obj || {}, old = null, list = rows_('MachLogs').filter(function (r) { return r.CompanyID === co; });
    if (o.LogID) { old = list.filter(function (r) { return r.LogID === o.LogID; })[0]; if (!old) throw new Error('برگه کارکرد پیدا نشد.'); }
    var d = cs_date_(o.DateJalali, 'تاریخ'), per = d.j.slice(0, 7), ht = cs_choice_(o.HType, CS_MHT, 'نوع', 'work');
    var hrs = cs_qty_(o.Hours, 'ساعت'); if (!(Number(hrs) > 0)) throw new Error('ساعت باید بیشتر از صفر باشد.'); if (Number(hrs) > 24) throw new Error('ساعت یک روز نمی‌تواند از ۲۴ بیشتر باشد.');
    var ctr = cs_own_('Contracts', 'ContractID', o.ContractID, co, 'قرارداد'); if (ctr.Status === 'cancel') throw new Error('قرارداد لغو شده است.');
    var machId = '', ccId = '', key;
    if (tr_(o.CCID)) { var cc = cs_own_('CostContracts', 'CCID', o.CCID, co, 'قرارداد اجاره'); if (cc.Kind !== 'rent') throw new Error('فقط قرارداد اجاره‌ی ماشین/تجهیز انتخاب می‌شود.'); if (cc.Status === 'cancel') throw new Error('قرارداد اجاره لغو شده است.'); ccId = cc.CCID; key = cc.CCID; }
    else { var m = cs_own_('Machines', 'MachID', o.MachID, co, 'ماشین'); if (!cs_b_(m.Own, false)) throw new Error('برای ماشین اجاره‌ای، قرارداد اجاره را انتخاب کنید.'); machId = m.MachID; key = m.MachID; }
    [old ? old.Period : '', per].forEach(function (q) { if (q && cs_machKeyLocked_(co, q, old ? old.MachID : machId, old ? old.CCID : ccId) || (q && cs_machKeyLocked_(co, q, machId, ccId))) throw new Error('هزینه‌ی ماشین ماه ' + q + ' محاسبه شده است؛ ابتدا «لغو محاسبه ماه» را بزنید.'); });
    fy_gate_(co, d.g, p, 'تاریخ کارکرد');
    var day = cs_s6_(hrs); list.forEach(function (r) { if ((r.MachID || r.CCID) && (r.MachID === key || r.CCID === key) && r.DateGregorian === d.g && r.LogID !== o.LogID) day += cs_s6_(r.Hours); });
    if (day > cs_s6_('24')) throw new Error('جمع ساعت این ماشین در این روز از ۲۴ ساعت بیشتر می‌شود.');
    var now = nowStr_(), id = old ? old.LogID : nextIds_('MLG', 1)[0];
    pr_setRow_('MachLogs', 'LogID', id, {LogID: id, CompanyID: co, MachID: machId, CCID: ccId, ContractID: ctr.ContractID, DateJalali: d.j, DateGregorian: d.g, Period: per, HType: ht, Hours: hrs, Notes: tr_(o.Notes), CreatedAt: old ? old.CreatedAt : now, UpdatedAt: now});
    bump_(); return {LogID: id};
  },
  del: function (p, co) {
    var r = cs_own_('MachLogs', 'LogID', p.id, co, 'برگه کارکرد');
    if (cs_machKeyLocked_(co, r.Period, r.MachID, r.CCID)) throw new Error('هزینه‌ی ماشین این ماه محاسبه شده است؛ ابتدا «لغو محاسبه ماه» را بزنید.');
    fy_gate_(co, r.DateGregorian, p, 'تاریخ کارکرد');
    delWhere_('MachLogs', 1, function (v) { return v === r.LogID; }); bump_(); return {deleted: 1};
  }
};
CS_EXT.mcost = {
  list: function (p, co) {
    var mach = {}; rows_('Machines').forEach(function (r) { if (r.CompanyID === co) mach[r.MachID] = r.Name; });
    var out = rows_('MachCosts').filter(function (r) { return r.CompanyID === co; }).map(function (r) { var o = Object.assign({}, r); o.MachName = mach[r.MachID] || ''; return o; });
    if (tr_(p.period)) { var pe = cs_periodOf_(p.period); out = out.filter(function (r) { return r.Period === pe; }); }
    out.sort(function (a, b) { return a.Period < b.Period ? 1 : a.Period > b.Period ? -1 : 0; });
    return {rows: out};
  },
  save: function (p, co) {
    var o = p.obj || {}, old = null, list = rows_('MachCosts').filter(function (r) { return r.CompanyID === co; });
    if (o.MCID) { old = list.filter(function (r) { return r.MCID === o.MCID; })[0]; if (!old) throw new Error('ردیف پیدا نشد.'); }
    var m = cs_own_('Machines', 'MachID', o.MachID, co, 'ماشین'); if (!cs_b_(m.Own, false)) throw new Error('هزینه‌ی ماهانه فقط برای ماشین خودی ثبت می‌شود.');
    var per = cs_periodOf_(o.Period);
    if (list.some(function (r) { return r.MCID !== o.MCID && r.MachID === m.MachID && r.Period === per; })) throw new Error('برای این ماشین در این ماه قبلاً ثبت شده است.');
    [old ? old.Period : '', per].forEach(function (q) { if (q && cs_machKeyLocked_(co, q, m.MachID, '')) throw new Error('هزینه‌ی ماشین ماه ' + q + ' محاسبه شده است؛ ابتدا «لغو محاسبه ماه» را بزنید.'); });
    fy_gate_(co, cs_date_(cs_periodEnd_(per), 'ماه').g, p, 'ماه هزینه');
    var rec = {MachID: m.MachID, Period: per, Fuel: cs_int_(o.Fuel, 'سوخت', true), Repair: cs_int_(o.Repair, 'تعمیر و نگهداری', true), Insurance: cs_int_(o.Insurance, 'بیمه', true), Operator: cs_int_(o.Operator, 'اپراتور', true), Other: cs_int_(o.Other, 'سایر', true), Notes: tr_(o.Notes)};
    if (!(rec.Fuel + rec.Repair + rec.Insurance + rec.Operator + rec.Other > 0)) throw new Error('حداقل یک مبلغ وارد کنید.');
    var now = nowStr_(), id = old ? old.MCID : nextIds_('MCS', 1)[0];
    rec.MCID = id; rec.CompanyID = co; rec.CreatedAt = old ? old.CreatedAt : now; rec.UpdatedAt = now;
    pr_setRow_('MachCosts', 'MCID', id, rec); bump_(); return {MCID: id};
  },
  del: function (p, co) {
    var r = cs_own_('MachCosts', 'MCID', p.id, co, 'ردیف');
    if (cs_machKeyLocked_(co, r.Period, r.MachID, '')) throw new Error('هزینه‌ی ماشین این ماه محاسبه شده است؛ ابتدا «لغو محاسبه ماه» را بزنید.');
    fy_gate_(co, cs_date_(cs_periodEnd_(r.Period), 'ماه').g, p, 'ماه هزینه');
    delWhere_('MachCosts', 1, function (v) { return v === r.MCID; }); bump_(); return {deleted: 1};
  }
};
function cs_mobPosted_(co, id) { return cs_postedAny_(co, new RegExp('^MOB:[0-9/]+:' + id + '$')); }
CS_EXT.mob = {
  list: function (p, co) {
    var ctr = {}; rows_('Contracts').forEach(function (r) { if (r.CompanyID === co) ctr[r.ContractID] = r; });
    var post = {}; rows_('CostLedger').forEach(function (r) { var m = /^MOB:[0-9\/]+:(.+)$/.exec(String(r.SrcID)); if (r.CompanyID === co && m) post[m[1]] = (post[m[1]] || 0) + (Number(r.Amount) || 0); });
    var out = rows_('Mobs').filter(function (r) { return r.CompanyID === co; }).map(function (r) { var o = Object.assign({}, r), c = ctr[r.ContractID] || {}; o.ContractNo = c.No || ''; o.MobAlloc = c.MobAlloc || ''; o.Posted = post[r.MobID] || 0; return o; });
    if (tr_(p.contract)) out = out.filter(function (r) { return r.ContractID === p.contract; });
    return {rows: out};
  },
  save: function (p, co) {
    var o = p.obj || {}, old = null;
    if (o.MobID) { old = cs_own_('Mobs', 'MobID', o.MobID, co, 'ردیف'); if (cs_mobPosted_(co, old.MobID)) throw new Error('بخشی از این مبلغ تسهیم شده است؛ برای ویرایش ابتدا «لغو تسهیم ماه» را برای ماه‌های ثبت‌شده بزنید.'); }
    var ctr = cs_own_('Contracts', 'ContractID', o.ContractID, co, 'قرارداد'); if (ctr.Status === 'cancel') throw new Error('قرارداد لغو شده است.');
    var title = tr_(o.Title); if (!title) throw new Error('عنوان الزامی است.');
    var amount = cs_int_(o.Amount, 'مبلغ'); if (!(amount > 0)) throw new Error('مبلغ باید بیشتر از صفر باشد.');
    var now = nowStr_(), id = old ? old.MobID : nextIds_('MOB', 1)[0];
    pr_setRow_('Mobs', 'MobID', id, {MobID: id, CompanyID: co, ContractID: ctr.ContractID, Kind: cs_choice_(o.Kind, CS_MOBK, 'نوع', 'setup'), Title: title, Amount: amount, Notes: tr_(o.Notes), CreatedAt: old ? old.CreatedAt : now, UpdatedAt: now});
    bump_(); return {MobID: id};
  },
  del: function (p, co) {
    var r = cs_own_('Mobs', 'MobID', p.id, co, 'ردیف');
    if (cs_mobPosted_(co, r.MobID)) throw new Error('بخشی از این مبلغ تسهیم شده است؛ ابتدا «لغو تسهیم ماه» را بزنید.');
    delWhere_('Mobs', 1, function (v) { return v === r.MobID; }); bump_(); return {deleted: 1};
  }
};

/* ===================================================================
   ۳) محاسبه‌ی ماهانه‌ی ماشین‌آلات (خودی: استهلاک + هزینه‌ها؛ اجاره‌ای: بر پایه‌ی نرخ قرارداد)
   =================================================================== */
function cs_hostOf_(list) { var best = null; list.forEach(function (c) { if (!best || Number(c.WorkHours) > Number(best.WorkHours)) best = c; }); return best; }
function cs_machCalc_(co, period) {
  var idleEx = cs_rule_(co, 'idle_machine_excluded'), res = {period: period, machines: [], rents: [], warnings: [], totals: {contracts: 0, period: 0, noContract: 0}, idleExcluded: idleEx};
  var ctr = {}; rows_('Contracts').forEach(function (r) { if (r.CompanyID === co) ctr[r.ContractID] = r; });
  var logs = rows_('MachLogs').filter(function (r) { return r.CompanyID === co && r.Period === period; });
  var costs = rows_('MachCosts').filter(function (r) { return r.CompanyID === co && r.Period === period; });
  /* ----- ماشین‌های خودی ----- */
  rows_('Machines').forEach(function (m) {
    if (m.CompanyID !== co || !cs_b_(m.Own, false)) return;
    var ml = logs.filter(function (l) { return l.MachID === m.MachID; }), mc = costs.filter(function (c) { return c.MachID === m.MachID; })[0];
    var inactive = !cs_b_(m.IsActive, true);
    var dep = {amount: 0, formula: ''};
    if (Number(m.Cost) > 0 && (tr_(m.InServiceJ) || ml.length || mc)) { if (!(inactive && !ml.length && !mc)) dep = cs_depr_(co, m, period); }
    var opex = mc ? (Number(mc.Fuel) + Number(mc.Repair) + Number(mc.Insurance) + Number(mc.Operator) + Number(mc.Other)) : 0, total = dep.amount + opex;
    if (!ml.length && total === 0) return;
    var byC = {}, order = [], work = BigInt(0), idle = BigInt(0);
    ml.forEach(function (l) { var h = cs_s6_(l.Hours); if (l.HType === 'idle') idle += h; else work += h; var c = byC[l.ContractID] || (byC[l.ContractID] = {ContractID: l.ContractID, ContractNo: (ctr[l.ContractID] || {}).No || '', w: BigInt(0), i: BigInt(0)}); if (order.indexOf(l.ContractID) < 0) order.push(l.ContractID); if (l.HType === 'idle') c.i += h; else c.w += h; });
    var Hn = idleEx ? work + idle : work, Hs = cs_f6_(Hn);
    var row = {MachID: m.MachID, Name: m.Name, Dep: dep.amount, DepFormula: dep.formula, Opex: opex, Total: total, WorkHours: cs_f6_(work), IdleHours: cs_f6_(idle), BaseHours: Hs, Rate: 0, Contracts: [], PeriodAmt: 0, Formula: ''};
    if (!(Hn > BigInt(0))) {
      if (total > 0) { row.NoContract = total; res.totals.noContract += total; res.warnings.push('ماشین «' + m.Name + '»: ساعتی ثبت نشده؛ هزینه‌ی ' + total + ' ریال به قرارداد تخصیص نیافت (هزینه دوره بدون قرارداد).'); }
      res.machines.push(row); return;
    }
    row.Rate = cs_divRound_(total, Hs);
    var sum = 0;
    order.forEach(function (cid) { var c = byC[cid], h = idleEx ? c.w : c.w, hs = cs_f6_(h); var amt = cs_mulDiv_(total, hs, Hs); sum += amt; row.Contracts.push({ContractID: cid, ContractNo: c.ContractNo, Hours: hs, Amount: amt}); });
    row.PeriodAmt = total - sum;
    row.Formula = 'نرخ ساعتی = (' + dep.amount + ' استهلاک + ' + opex + ' هزینه ماهانه) ÷ ' + Hs + ' ساعت مبنا = ' + row.Rate + '؛ سهم قرارداد = کل × ساعت قرارداد ÷ ' + Hs + '؛ باقیمانده (خواب/گرد کردن) = ' + row.PeriodAmt + ' → هزینه دوره';
    row.Host = (cs_hostOf_(order.map(function (cid) { return {ContractID: cid, WorkHours: cs_f6_(byC[cid].w)}; })) || {}).ContractID || order[0];
    var chk = row.PeriodAmt; row.Contracts.forEach(function (c) { chk += c.Amount; });
    if (chk !== total) throw new Error('خطای داخلی: جمع تخصیص ماشین با کل هزینه برابر نیست.');
    res.totals.contracts += sum; res.totals.period += row.PeriodAmt;
    res.machines.push(row);
  });
  /* ----- اجاره ----- */
  rows_('CostContracts').forEach(function (cc) {
    if (cc.CompanyID !== co || cc.Kind !== 'rent' || cc.Status === 'cancel') return;
    var rl = logs.filter(function (l) { return l.CCID === cc.CCID; }); if (!rl.length) return;
    var unit = cc.RateUnit, rate = Number(cc.Rate) || 0, by = {}, order = [], totalH = BigInt(0);
    rl.forEach(function (l) { var c = by[l.ContractID] || (by[l.ContractID] = {ContractID: l.ContractID, ContractNo: (ctr[l.ContractID] || {}).No || '', w: BigInt(0), i: BigInt(0), days: {}}); if (order.indexOf(l.ContractID) < 0) order.push(l.ContractID); var h = cs_s6_(l.Hours); if (l.HType === 'idle') c.i += h; else { c.w += h; c.days[l.DateGregorian] = 1; } totalH += h; });
    var row = {CCID: cc.CCID, No: cc.No, Title: cc.Title, Unit: unit, Rate: rate, Contracts: [], PeriodAmt: 0, Formula: ''}, sumAll = 0;
    var cap = tr_(cc.EndG) && cc.EndG < cs_date_(period + '/01', 'ماه').g, early = tr_(cc.StartG) && cs_date_(cs_periodEnd_(period), 'ماه').g < cc.StartG;
    if (cap || early) res.warnings.push('قرارداد اجاره ' + cc.No + ': ماه ' + period + ' خارج از بازه‌ی قرارداد است.');
    if (unit === 'month') {
      var parts = 0;
      order.forEach(function (cid) { var c = by[cid], w = cs_mulDiv_(rate, cs_f6_(c.w), cs_f6_(totalH)), i = cs_mulDiv_(rate, cs_f6_(c.i), cs_f6_(totalH)); row.Contracts.push({ContractID: cid, ContractNo: c.ContractNo, Qty: cs_f6_(c.w), Amount: w, IdleAmount: i}); parts += w + i; });
      var rem = rate - parts; row.PeriodAmt = rem;
      if (!idleEx) row.Contracts.forEach(function (c) { c.Amount += c.IdleAmount; c.IdleAmount = 0; });
      if (!idleEx && rem) { row.Contracts[0].Amount += rem; row.PeriodAmt = 0; }
      row.Formula = 'اجاره ماهانه ' + rate + ' بین قراردادها بر پایه‌ی ساعت (کارکرد + خواب) از جمع ' + cs_f6_(totalH) + ' ساعت تقسیم شد' + (idleEx ? '؛ سهم ساعت خواب هزینه دوره است' : '');
    } else if (unit === 'day') {
      order.forEach(function (cid) { var c = by[cid], n = Object.keys(c.days).length; row.Contracts.push({ContractID: cid, ContractNo: c.ContractNo, Qty: String(n), Amount: n * rate, IdleAmount: 0}); });
      row.Formula = 'اجاره روزانه: تعداد روزهای کارکرد هر قرارداد × ' + rate + ' (روز خواب محاسبه نمی‌شود)';
    } else {
      order.forEach(function (cid) { var c = by[cid], q = cs_f6_(c.w); row.Contracts.push({ContractID: cid, ContractNo: c.ContractNo, Qty: q, Amount: cs_mulRound_(q, rate), IdleAmount: 0}); });
      row.Formula = 'اجاره ساعتی: ساعت کارکرد هر قرارداد × ' + rate + ' (ساعت خواب محاسبه نمی‌شود)';
    }
    row.Contracts = row.Contracts.filter(function (c) { return c.Amount > 0 || Number(c.Qty) > 0; });
    row.Contracts.forEach(function (c) { res.totals.contracts += c.Amount; res.totals.period += c.IdleAmount || 0; }); res.totals.period += row.PeriodAmt;
    row.Host = order[0]; if (row.Contracts.length) row.Host = row.Contracts[0].ContractID;
    if (row.PeriodAmt > 0 && !row.Host) row.Host = order[0];
    res.rents.push(row);
  });
  return res;
}
function csMachRates_(p) { var co = cs_co_(p); cs_seed_(co); var per = cs_periodOf_(p.period), r = cs_machCalc_(co, per); r.locked = cs_postedAny_(co, new RegExp('^(MCH|RENT):' + per.replace('/', '\\/') + ':')); return r; }
function csMachRun_(p) {
  var co = cs_co_(p); cs_seed_(co);
  return locked_(function () {
    var per = cs_periodOf_(p.period), end = cs_periodEnd_(per), r = cs_machCalc_(co, per), n = 0;
    if (!r.machines.length && !r.rents.length) throw new Error('برای این ماه کارکرد یا هزینه‌ای ثبت نشده است.');
    r.machines.forEach(function (m) { cs_unput_(co, p, 'MCH:' + per + ':' + m.MachID); });
    r.rents.forEach(function (m) { cs_unput_(co, p, 'RENT:' + per + ':' + m.CCID); });
    r.machines.forEach(function (m) {
      var sid = 'MCH:' + per + ':' + m.MachID, base = {SrcType: 'machinelog', SrcID: sid, DateJalali: end};
      m.Contracts.forEach(function (c) { if (c.Amount > 0) { cs_put_(co, p, Object.assign({ContractID: c.ContractID, ElemCode: 'E04', Qty: c.Hours, Rate: String(m.Rate), Amount: c.Amount, Inputs: {mach: m.MachID, period: per, dep: m.Dep, opex: m.Opex, baseHours: m.BaseHours}, Formula: 'ماشین ' + m.Name + ' ' + per + ': ' + m.Total + ' × ' + c.Hours + ' ÷ ' + m.BaseHours + ' = ' + c.Amount + ' | ' + m.DepFormula}, base)); n++; } });
      if (m.PeriodAmt > 0) { cs_put_(co, p, Object.assign({ContractID: m.Host, ElemCode: 'E22', Qty: m.IdleHours, Amount: m.PeriodAmt, Inputs: {mach: m.MachID, period: per}, Formula: m.Formula}, base)); n++; }
    });
    r.rents.forEach(function (m) {
      var sid = 'RENT:' + per + ':' + m.CCID, base = {SrcType: 'machinelog', SrcID: sid, DateJalali: end};
      m.Contracts.forEach(function (c) { if (c.Amount > 0) { cs_put_(co, p, Object.assign({ContractID: c.ContractID, ElemCode: 'E05', Qty: c.Qty, Amount: c.Amount, Inputs: {cc: m.No, period: per, unit: m.Unit, rate: m.Rate}, Formula: 'اجاره ' + m.Title + ' ' + per + ': ' + m.Formula + ' → ' + c.Amount}, base)); n++; } if (c.IdleAmount > 0) { cs_put_(co, p, Object.assign({ContractID: c.ContractID, ElemCode: 'E22', Qty: '', Amount: c.IdleAmount, Inputs: {cc: m.No, period: per}, Formula: 'سهم ساعت خواب ماشین اجاره‌ای (هزینه دوره): ' + c.IdleAmount}, base)); n++; } });
      if (m.PeriodAmt > 0) { cs_put_(co, p, Object.assign({ContractID: m.Host, ElemCode: 'E22', Amount: m.PeriodAmt, Inputs: {cc: m.No, period: per}, Formula: 'باقیمانده‌ی اجاره (خواب/گرد کردن): ' + m.PeriodAmt}, base)); n++; }
    });
    bump_();
    return {period: per, entries: n, totals: r.totals, warnings: r.warnings};
  });
}
function csMachUndo_(p) {
  var co = cs_co_(p);
  return locked_(function () {
    var per = cs_periodOf_(p.period), ids = {}, n = 0, re = new RegExp('^(MCH|RENT):' + per.replace('/', '\\/') + ':');
    rows_('CostLedger').forEach(function (r) { if (r.CompanyID === co && re.test(String(r.SrcID))) ids[r.SrcID] = 1; });
    Object.keys(ids).forEach(function (s) { n += cs_unput_(co, p, s); });
    bump_(); return {removed: n};
  });
}
/* جدول استهلاک ماشین تا ماه مورد نظر (برای بررسی/حسابرسی) */
function csDeprSched_(p) {
  var co = cs_co_(p), m = cs_own_('Machines', 'MachID', p.mach, co, 'ماشین'), to = cs_periodOf_(p.period);
  if (!tr_(m.InServiceJ)) throw new Error('تاریخ شروع بهره‌برداری لازم است.');
  var fp = cs_idx_(String(m.InServiceJ).slice(0, 7)), te = cs_idx_(to), out = [], cum = 0;
  if (te - fp > 600) throw new Error('بازه‌ی نمایش بیش از ۶۰۰ ماه است.');
  for (var i = fp; i <= te; i++) { var q = cs_idxName_(i), d = cs_depr_(co, m, q); cum += d.amount; out.push({period: q, amount: d.amount, accum: cum, book: (Number(m.Cost) || 0) - cum, formula: d.formula}); }
  return {machine: m.Name, rows: out};
}

/* ===================================================================
   ۴) تجهیز و برچیدن کارگاه: تسهیم خط مستقیم طی دوره‌ی قرارداد (گردکردن تجمعی؛ مجموع دقیقاً برابر مبلغ)
   =================================================================== */
function cs_mobCalc_(co, period) {
  var res = {period: period, items: [], skipped: [], totals: {amount: 0}}, ctr = {}; rows_('Contracts').forEach(function (r) { if (r.CompanyID === co) ctr[r.ContractID] = r; });
  var post = {}; rows_('CostLedger').forEach(function (r) { var m = /^MOB:([0-9\/]+):(.+)$/.exec(String(r.SrcID)); if (r.CompanyID === co && m && m[1] < period) post[m[2]] = (post[m[2]] || 0) + (Number(r.Amount) || 0); });
  rows_('Mobs').forEach(function (it) {
    if (it.CompanyID !== co) return; var c = ctr[it.ContractID]; if (!c || c.Status === 'cancel') return;
    if (c.MobAlloc !== 'straight_line') { res.skipped.push({MobID: it.MobID, Title: it.Title, ContractNo: c.No, why: c.MobAlloc === 'progress' ? 'روش «بر پایه درصد پیشرفت» پس از مرحله ۵ (پیشرفت) فعال می‌شود' : 'روش «دستی» — از «دفتر هزینه» با عنصر E07 ثبت کنید'}); return; }
    if (!tr_(c.StartJ) || !tr_(c.EndJ)) throw new Error('قرارداد ' + c.No + ': برای تسهیم خط مستقیم، تاریخ شروع و پایان لازم است.');
    var s = cs_idx_(c.StartJ.slice(0, 7)), e = cs_idx_(c.EndJ.slice(0, 7)), N = e - s + 1, pi = cs_idx_(period);
    if (pi < s) return;
    var k = Math.min(pi - s + 1, N), total = Number(it.Amount) || 0, cum = k >= N ? total : cs_mulDiv_(total, k, N), before = post[it.MobID] || 0, amt = cum - before;
    if (amt <= 0) return;
    res.items.push({MobID: it.MobID, Title: it.Title, ContractID: c.ContractID, ContractNo: c.No, Kind: it.Kind, Total: total, N: N, K: k, Amount: amt, Formula: it.Title + ': ' + total + ' × ' + k + ' ÷ ' + N + ' ماه = ' + cum + ' (تجمعی) − ' + before + ' (قبلاً ثبت‌شده) = ' + amt});
    res.totals.amount += amt;
  });
  return res;
}
function csMobRates_(p) { var co = cs_co_(p); cs_seed_(co); var per = cs_periodOf_(p.period), r = cs_mobCalc_(co, per); r.locked = cs_postedAny_(co, new RegExp('^MOB:' + per.replace('/', '\\/') + ':')); return r; }
function csMobRun_(p) {
  var co = cs_co_(p); cs_seed_(co);
  return locked_(function () {
    var per = cs_periodOf_(p.period), end = cs_periodEnd_(per), ids = {};
    rows_('CostLedger').forEach(function (r) { if (r.CompanyID === co && new RegExp('^MOB:' + per.replace('/', '\\/') + ':').test(String(r.SrcID))) ids[r.SrcID] = 1; });
    Object.keys(ids).forEach(function (s) { cs_unput_(co, p, s); });
    var r = cs_mobCalc_(co, per), n = 0;
    r.items.forEach(function (it) { cs_put_(co, p, {ContractID: it.ContractID, ElemCode: 'E07', Qty: String(it.K), Amount: it.Amount, SrcType: 'alloc', SrcID: 'MOB:' + per + ':' + it.MobID, DateJalali: end, Inputs: {mob: it.MobID, total: it.Total, months: it.N, k: it.K}, Formula: it.Formula}); n++; });
    bump_(); return {period: per, entries: n, totals: r.totals, skipped: r.skipped};
  });
}
function csMobUndo_(p) {
  var co = cs_co_(p);
  return locked_(function () {
    var per = cs_periodOf_(p.period), ids = {}, n = 0, re = new RegExp('^MOB:' + per.replace('/', '\\/') + ':');
    rows_('CostLedger').forEach(function (r) { if (r.CompanyID === co && re.test(String(r.SrcID))) ids[r.SrcID] = 1; });
    Object.keys(ids).forEach(function (s) { n += cs_unput_(co, p, s); });
    bump_(); return {removed: n};
  });
}
