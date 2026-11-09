/* ===================================================================
   ماژول «بهای تمام‌شده خدمات» — مرحله ۴: سربار و تسهیم
   - هر «مرکز/دسته سربار» برای یک سال بودجه‌ی سربار ثابت و متغیر و «ظرفیت عادی» (مبنای تسهیم) دارد.
     نرخ از پیش تعیین‌شده = بودجه ÷ ظرفیت عادی؛ سربار جذب‌شده‌ی قرارداد = نرخ × مبنای واقعی همان قرارداد در ماه.
   - سربار واقعی هر ماه (ثابت و متغیر) ثبت می‌شود؛ تفاوت آن با جذب‌شده = سربار کم/بیش‌جذب‌شده.
   - اگر مبنای واقعی ماه کمتر از ظرفیت عادی ماهانه باشد، سهم ثابتِ ظرفیت بلااستفاده جدا و «هزینه دوره» می‌شود
     (قاعده‌ی unused_capacity_excluded) و روی قراردادها بار نمی‌شود.
   - هیچ نرخی در کد نیست؛ همه‌ی ارقام از بودجه‌ی واردشده‌ی کاربر می‌آید. تقسیم‌ها با BigInt و گرد نیم‌به‌بالا.
   =================================================================== */
H.OhPools = ['PoolID', 'CompanyID', 'Code', 'Name', 'Kind', 'BaseID', 'Year', 'BudgetFixed', 'BudgetVar', 'BudgetBase', 'IsActive', 'Notes', 'CreatedAt', 'UpdatedAt'];
H.OhActual = ['OAID', 'CompanyID', 'PoolID', 'Period', 'Fixed', 'Variable', 'Notes', 'CreatedAt', 'UpdatedAt'];
H.BaseQty = ['BQID', 'CompanyID', 'BaseID', 'ContractID', 'Period', 'Qty', 'Notes', 'CreatedAt', 'UpdatedAt'];
H.OhRuns = ['RunID', 'CompanyID', 'PoolID', 'Period', 'BaseTotal', 'Absorbed', 'ActualFixed', 'ActualVar', 'Variance', 'Unused', 'Detail', 'CreatedAt'];
CS_KINDS.pool = {sheet: 'OhPools', key: 'PoolID', pf: 'OHP', t: 'مرکز سربار'};
CS_KINDS.oact = {sheet: 'OhActual', key: 'OAID', pf: 'OHA', t: 'سربار واقعی ماه'};
CS_KINDS.bqty = {sheet: 'BaseQty', key: 'BQID', pf: 'BQT', t: 'مقدار مبنای تسهیم'};
var CS_OHK = {overhead: 'سربار تولید/اجرا (جزو بهای خدمات)', ga: 'هزینه عمومی و اداری ستاد (فقط قراردادهای قابل‌مطالبه)'};
CS_SEED_RULE2.push(['oh_variance_policy', 'سربار کم/بیش‌جذب‌شده‌ی سال', 'choice', 'period', 'period:هزینه (یا درآمد) دوره — بدون تعدیل قراردادها|prorate:تعدیل در پایان سال به نسبت سربار جذب‌شده‌ی قراردادها', 'استاندارد ۸ — [نیازمند تأیید]', 1]);

function cs_ohRe_(per, pre) { return new RegExp('^' + pre + ':' + per.replace('/', '\\/') + ':'); }
function cs_poolLocked_(co, poolId) { return rows_('OhRuns').some(function (r) { return r.CompanyID === co && r.PoolID === poolId; }); }
function cs_poolYearPosted_(co, poolId) { return cs_postedAny_(co, new RegExp('^OHV:' + poolId + '$')); }
function cs_baseUsed_(co, id) { return rows_('OhPools').filter(function (r) { return r.CompanyID === co && r.BaseID === id; }).length + rows_('BaseQty').filter(function (r) { return r.CompanyID === co && r.BaseID === id; }).length; }
function cs_isMoney_(code) { return code === 'B3' || code === 'B4'; }
function cs_baseUnit_(code) { return code === 'B1' || code === 'B2' ? 'ساعت' : (cs_isMoney_(code) ? 'ریال' : 'واحد'); }

/* ---------- مرکز سربار ---------- */
CS_EXT.pool = {
  list: function (p, co) {
    var base = {}, runs = {}; rows_('AllocBases').forEach(function (r) { if (r.CompanyID === co) base[r.BaseID] = r; });
    rows_('OhRuns').forEach(function (r) { if (r.CompanyID === co) runs[r.PoolID] = (runs[r.PoolID] || 0) + 1; });
    var out = rows_('OhPools').filter(function (r) { return r.CompanyID === co; }).map(function (r) { var o = Object.assign({}, r), b = base[r.BaseID] || {}; o.BaseName = b.Name || ''; o.BaseCode = String(b.Code || ''); o.Unit = cs_baseUnit_(String(b.Code || '')); o.IsActive = cs_b_(r.IsActive, true); o.Code = String(r.Code); o.Runs = runs[r.PoolID] || 0;
      var bb = Number(r.BudgetBase) || 0; o.FixedRate = bb > 0 ? Math.round((Number(r.BudgetFixed) || 0) / bb * 10000) / 10000 : 0; o.VarRate = bb > 0 ? Math.round((Number(r.BudgetVar) || 0) / bb * 10000) / 10000 : 0; return o; });
    out.sort(function (a, b) { return a.Year < b.Year ? 1 : a.Year > b.Year ? -1 : (a.Code < b.Code ? -1 : 1); });
    return {rows: out};
  },
  save: function (p, co) {
    var o = p.obj || {}, old = null, list = rows_('OhPools').filter(function (r) { return r.CompanyID === co; });
    if (o.PoolID) { old = list.filter(function (r) { return r.PoolID === o.PoolID; })[0]; if (!old) throw new Error('مرکز سربار پیدا نشد.'); }
    var code = tr_(fa2en_(o.Code)), name = tr_(o.Name); if (!code) throw new Error('کد الزامی است.'); if (!name) throw new Error('نام الزامی است.');
    var yr = tr_(fa2en_(o.Year)); if (!/^1[34]\d\d$/.test(yr)) throw new Error('سال شمسی نامعتبر است (مثال ۱۴۰۵).');
    if (list.some(function (r) { return r.PoolID !== o.PoolID && String(r.Code) === code && String(r.Year) === yr; })) throw new Error('این کد برای این سال قبلاً استفاده شده است.');
    var base = cs_own_('AllocBases', 'BaseID', o.BaseID, co, 'مبنای تسهیم'); if (!cs_b_(base.IsActive, true)) throw new Error('مبنای تسهیم غیرفعال است.');
    var kind = cs_choice_(o.Kind, CS_OHK, 'نوع', 'overhead');
    var bf = cs_int_(o.BudgetFixed, 'بودجه سربار ثابت سالانه', true), bv = cs_int_(o.BudgetVar, 'بودجه سربار متغیر سالانه', true), bb = cs_qty_(o.BudgetBase, 'ظرفیت عادی سالانه (مبنا)');
    if (!(Number(bb) > 0)) throw new Error('ظرفیت عادی سالانه باید بیشتر از صفر باشد.');
    if (!(bf + bv > 0)) throw new Error('حداقل یکی از بودجه‌های ثابت یا متغیر باید بیشتر از صفر باشد.');
    if (old && cs_poolLocked_(co, old.PoolID) && (old.BaseID !== base.BaseID || String(old.Year) !== yr || Number(old.BudgetFixed) !== bf || Number(old.BudgetVar) !== bv || Number(old.BudgetBase) !== Number(bb) || old.Kind !== kind))
      throw new Error('برای این مرکز سربار تسهیم ماهانه ثبت شده است؛ نرخ‌ها قابل‌تغییر نیست. ابتدا «لغو تسهیم ماه» را برای ماه‌های ثبت‌شده بزنید.');
    var now = nowStr_(), id = old ? old.PoolID : nextIds_('OHP', 1)[0];
    pr_setRow_('OhPools', 'PoolID', id, {PoolID: id, CompanyID: co, Code: code, Name: name, Kind: kind, BaseID: base.BaseID, Year: yr, BudgetFixed: bf, BudgetVar: bv, BudgetBase: bb, IsActive: cs_b_(o.IsActive, true), Notes: tr_(o.Notes), CreatedAt: old ? old.CreatedAt : now, UpdatedAt: now});
    bump_(); return {PoolID: id};
  },
  del: function (p, co) {
    var r = cs_own_('OhPools', 'PoolID', p.id, co, 'مرکز سربار');
    if (cs_poolLocked_(co, r.PoolID)) throw new Error('برای این مرکز سربار تسهیم ثبت شده است؛ حذف نمی‌شود. می‌توانید «غیرفعال» کنید.');
    if (rows_('OhActual').some(function (x) { return x.CompanyID === co && x.PoolID === r.PoolID; })) throw new Error('برای این مرکز سربار واقعی ثبت شده است؛ ابتدا آن‌ها را حذف کنید.');
    delWhere_('OhPools', 1, function (v) { return v === r.PoolID; }); bump_(); return {deleted: 1};
  }
};
CS_EXT.oact = {
  list: function (p, co) {
    var pool = {}; rows_('OhPools').forEach(function (r) { if (r.CompanyID === co) pool[r.PoolID] = r; });
    var out = rows_('OhActual').filter(function (r) { return r.CompanyID === co; }).map(function (r) { var o = Object.assign({}, r), q = pool[r.PoolID] || {}; o.PoolName = (q.Code ? q.Code + ' - ' : '') + (q.Name || ''); return o; });
    if (tr_(p.period)) { var pe = cs_periodOf_(p.period); out = out.filter(function (r) { return r.Period === pe; }); }
    out.sort(function (a, b) { return a.Period < b.Period ? 1 : a.Period > b.Period ? -1 : 0; });
    return {rows: out};
  },
  save: function (p, co) {
    var o = p.obj || {}, old = null, list = rows_('OhActual').filter(function (r) { return r.CompanyID === co; });
    if (o.OAID) { old = list.filter(function (r) { return r.OAID === o.OAID; })[0]; if (!old) throw new Error('ردیف پیدا نشد.'); }
    var pool = cs_own_('OhPools', 'PoolID', o.PoolID, co, 'مرکز سربار'), per = cs_periodOf_(o.Period);
    if (per.slice(0, 4) !== String(pool.Year)) throw new Error('دوره باید در سال ' + pool.Year + ' (سال همین مرکز سربار) باشد.');
    if (list.some(function (r) { return r.OAID !== o.OAID && r.PoolID === pool.PoolID && r.Period === per; })) throw new Error('برای این مرکز در این ماه قبلاً سربار واقعی ثبت شده است.');
    [old ? old.PoolID + '|' + old.Period : '', pool.PoolID + '|' + per].forEach(function (k) { if (!k) return; var a = k.split('|'); if (rows_('OhRuns').some(function (r) { return r.CompanyID === co && r.PoolID === a[0] && r.Period === a[1]; })) throw new Error('تسهیم ماه ' + a[1] + ' ثبت شده است؛ ابتدا «لغو تسهیم ماه» را بزنید.'); });
    fy_gate_(co, cs_date_(cs_periodEnd_(per), 'ماه').g, p, 'ماه سربار');
    var rec = {PoolID: pool.PoolID, Period: per, Fixed: cs_int_(o.Fixed, 'سربار ثابت واقعی', true), Variable: cs_int_(o.Variable, 'سربار متغیر واقعی', true), Notes: tr_(o.Notes)};
    var now = nowStr_(), id = old ? old.OAID : nextIds_('OHA', 1)[0];
    rec.OAID = id; rec.CompanyID = co; rec.CreatedAt = old ? old.CreatedAt : now; rec.UpdatedAt = now;
    pr_setRow_('OhActual', 'OAID', id, rec); bump_(); return {OAID: id};
  },
  del: function (p, co) {
    var r = cs_own_('OhActual', 'OAID', p.id, co, 'ردیف');
    if (rows_('OhRuns').some(function (x) { return x.CompanyID === co && x.PoolID === r.PoolID && x.Period === r.Period; })) throw new Error('تسهیم این ماه ثبت شده است؛ ابتدا «لغو تسهیم ماه» را بزنید.');
    delWhere_('OhActual', 1, function (v) { return v === r.OAID; }); bump_(); return {deleted: 1};
  }
};
CS_EXT.bqty = {
  list: function (p, co) {
    var base = {}, ctr = {}; rows_('AllocBases').forEach(function (r) { if (r.CompanyID === co) base[r.BaseID] = r.Name; }); rows_('Contracts').forEach(function (r) { if (r.CompanyID === co) ctr[r.ContractID] = r.No; });
    var out = rows_('BaseQty').filter(function (r) { return r.CompanyID === co; }).map(function (r) { var o = Object.assign({}, r); o.BaseName = base[r.BaseID] || ''; o.ContractNo = ctr[r.ContractID] || ''; return o; });
    if (tr_(p.period)) { var pe = cs_periodOf_(p.period); out = out.filter(function (r) { return r.Period === pe; }); }
    return {rows: out};
  },
  save: function (p, co) {
    var o = p.obj || {}, old = null, list = rows_('BaseQty').filter(function (r) { return r.CompanyID === co; });
    if (o.BQID) { old = list.filter(function (r) { return r.BQID === o.BQID; })[0]; if (!old) throw new Error('ردیف پیدا نشد.'); }
    var base = cs_own_('AllocBases', 'BaseID', o.BaseID, co, 'مبنا'); if (['B1', 'B2', 'B3', 'B4'].indexOf(String(base.Code)) >= 0) throw new Error('این مبنا از دفتر هزینه/برگه‌ها خودکار محاسبه می‌شود؛ مقدار دستی لازم نیست.');
    var ctr = cs_own_('Contracts', 'ContractID', o.ContractID, co, 'قرارداد'), per = cs_periodOf_(o.Period), qty = cs_qty_(o.Qty, 'مقدار');
    if (list.some(function (r) { return r.BQID !== o.BQID && r.BaseID === base.BaseID && r.ContractID === ctr.ContractID && r.Period === per; })) throw new Error('برای این مبنا/قرارداد/ماه قبلاً مقدار ثبت شده است.');
    var lockedFn = function (pe, bid) { var pools = {}; rows_('OhPools').forEach(function (x) { if (x.CompanyID === co && x.BaseID === bid) pools[x.PoolID] = 1; }); return rows_('OhRuns').some(function (r) { return r.CompanyID === co && pools[r.PoolID] && r.Period === pe; }); };
    if ((old && lockedFn(old.Period, old.BaseID)) || lockedFn(per, base.BaseID)) throw new Error('تسهیم این ماه با همین مبنا ثبت شده است؛ ابتدا «لغو تسهیم ماه» را بزنید.');
    var now = nowStr_(), id = old ? old.BQID : nextIds_('BQT', 1)[0];
    pr_setRow_('BaseQty', 'BQID', id, {BQID: id, CompanyID: co, BaseID: base.BaseID, ContractID: ctr.ContractID, Period: per, Qty: qty, Notes: tr_(o.Notes), CreatedAt: old ? old.CreatedAt : now, UpdatedAt: now});
    bump_(); return {BQID: id};
  },
  del: function (p, co) {
    var r = cs_own_('BaseQty', 'BQID', p.id, co, 'ردیف');
    var pools = {}; rows_('OhPools').forEach(function (x) { if (x.CompanyID === co && x.BaseID === r.BaseID) pools[x.PoolID] = 1; });
    if (rows_('OhRuns').some(function (x) { return x.CompanyID === co && pools[x.PoolID] && x.Period === r.Period; })) throw new Error('تسهیم این ماه ثبت شده است؛ ابتدا «لغو تسهیم ماه» را بزنید.');
    delWhere_('BaseQty', 1, function (v) { return v === r.BQID; }); bump_(); return {deleted: 1};
  }
};

/* ---------- مقدار واقعی مبنا برای هر قرارداد در یک ماه (مقیاس ۶ رقم اعشار) ---------- */
function cs_baseQty_(co, base, period) {
  var code = String(base.Code), q = {}, add = function (cid, v) { if (cid) q[cid] = (q[cid] || BigInt(0)) + v; }, M6 = BigInt(1000000);
  if (code === 'B1') rows_('Timesheets').forEach(function (r) { if (r.CompanyID === co && r.Period === period && r.HType !== 'idle') add(r.ContractID, cs_s6_(r.Hours)); });
  else if (code === 'B2') rows_('MachLogs').forEach(function (r) { if (r.CompanyID === co && r.Period === period && r.HType === 'work') add(r.ContractID, cs_s6_(r.Hours)); });
  else if (code === 'B3' || code === 'B4') {
    var el = {}; rows_('CostElements').forEach(function (r) { if (r.CompanyID === co) el[r.ElemID] = r; });
    rows_('CostLedger').forEach(function (r) {
      if (r.CompanyID !== co || r.Period !== period || r.Treat !== 'product') return;
      var e = el[r.ElemID] || {};
      if (code === 'B3' ? String(e.Code) === 'E02' : (e.Grp !== 'overhead' && e.Grp !== 'acq' && e.Grp !== 'fulfil' && e.Grp !== 'period')) add(r.ContractID, BigInt(Math.round(Number(r.Amount) || 0)) * M6);
    });
  } else rows_('BaseQty').forEach(function (r) { if (r.CompanyID === co && r.BaseID === base.BaseID && r.Period === period) add(r.ContractID, cs_s6_(r.Qty)); });
  return q;
}
function cs_ohPoolCalc_(co, pool, period, unusedOn) {
  var base = cs_own_('AllocBases', 'BaseID', pool.BaseID, co, 'مبنا'), bq = cs_baseQty_(co, base, period), ctr = {};
  rows_('Contracts').forEach(function (r) { if (r.CompanyID === co) ctr[r.ContractID] = r; });
  var BF = Number(pool.BudgetFixed) || 0, BV = Number(pool.BudgetVar) || 0, BB = String(Number(pool.BudgetBase)), BB6 = cs_s6_(BB), isGa = pool.Kind === 'ga';
  var act = rows_('OhActual').filter(function (r) { return r.CompanyID === co && r.PoolID === pool.PoolID && r.Period === period; })[0];
  var AF = act ? Number(act.Fixed) || 0 : 0, AV = act ? Number(act.Variable) || 0 : 0, money = cs_isMoney_(String(base.Code));
  var res = {PoolID: pool.PoolID, Code: String(pool.Code), Name: pool.Name, Kind: pool.Kind, BaseCode: String(base.Code), BaseName: base.Name, Unit: cs_baseUnit_(String(base.Code)), BudgetFixed: BF, BudgetVar: BV, BudgetBase: BB, ActualFixed: AF, ActualVar: AV, hasActual: !!act, Contracts: [], warnings: []};
  if (!Object.keys(bq).length) res.warnings.push('«' + pool.Name + '»: در این ماه مبنای «' + base.Name + '» برای هیچ قراردادی ثبت/محاسبه نشده است؛ سربار جذب نمی‌شود (ابتدا دستمزد/ماشین/مواد ماه را ثبت کنید).');
  if (!act) res.warnings.push('سربار واقعی این ماه برای «' + pool.Name + '» ثبت نشده است (۰ فرض شد).');
  var T6 = BigInt(0), absF = 0, absV = 0, rows = [];
  Object.keys(bq).forEach(function (cid) {
    var c = ctr[cid]; if (!c || c.Status === 'cancel') return; if (isGa && !cs_b_(c.GaClaim, false)) return;
    var q6 = bq[cid]; if (q6 <= BigInt(0)) return; T6 += q6;
    var qs = cs_f6_(q6), f = BF > 0 ? cs_mulDiv_(qs, BF, BB) : 0, v = BV > 0 ? cs_mulDiv_(qs, BV, BB) : 0; absF += f; absV += v;
    rows.push({ContractID: cid, ContractNo: c.No, Base: qs, Fixed: f, Var: v, Amount: f + v});
  });
  rows.sort(function (a, b) { return a.ContractNo < b.ContractNo ? -1 : 1; });
  res.Contracts = rows; res.BaseTotal = cs_f6_(T6); res.AbsorbedFixed = absF; res.AbsorbedVar = absV; res.Absorbed = absF + absV;
  res.FixedRate = BF > 0 ? cs_divRoundDec_(BF, BB, 4) : '0'; res.VarRate = BV > 0 ? cs_divRoundDec_(BV, BB, 4) : '0';
  /* ظرفیت عادی ماهانه = ظرفیت سالانه ÷ ۱۲؛ بودجه‌ی ثابت ماهانه = بودجه‌ی سالانه ÷ ۱۲ */
  var BFm = cs_mulDiv_(BF, '1', '12');
  res.NormalMonthly = cs_f6_(BB6 / BigInt(12)); res.BudgetFixedMonthly = BFm;
  res.Variance = AF + AV - res.Absorbed;
  res.VolumeVar = BFm - absF;
  res.SpendingVar = (AF + AV) - (BFm + absV);
  res.Unused = 0;
  if (unusedOn && BF > 0 && T6 * BigInt(12) < BB6) {
    res.Unused = cs_mulDiv_(BF, cs_f6_(BB6 - T6 * BigInt(12)), cs_f6_(BB6 * BigInt(12)));
    res.UnusedNote = 'مبنای واقعی ماه (' + res.BaseTotal + ') کمتر از ظرفیت عادی ماهانه (' + res.NormalMonthly + ') است؛ سهم ثابتِ ظرفیت بلااستفاده = ' + BF + ' × (' + BB + ' − ۱۲ × ' + res.BaseTotal + ') ÷ (۱۲ × ' + BB + ') = ' + res.Unused + ' → هزینه دوره، نه بهای قراردادها.';
  }
  res.Formula = 'نرخ ثابت = ' + BF + ' ÷ ' + BB + ' = ' + res.FixedRate + ' ریال هر ' + res.Unit + '؛ نرخ متغیر = ' + BV + ' ÷ ' + BB + ' = ' + res.VarRate + '؛ جذب‌شده‌ی قرارداد = نرخ × مبنای واقعی ماه. سربار واقعی ' + (AF + AV) + ' − جذب‌شده ' + res.Absorbed + ' = ' + res.Variance + (res.Variance > 0 ? ' (کم‌جذب‌شده)' : (res.Variance < 0 ? ' (بیش‌جذب‌شده)' : ''));
  if (isGa) res.Formula += ' | فقط قراردادهای «قابل‌مطالبه» سهم می‌گیرند.';
  return res;
}
/* a ÷ b با d رقم اعشار (فقط برای نمایش نرخ) */
function cs_divRoundDec_(a, b, d) { var x = cs_dec_(a, 'صورت'), y = cs_dec_(b, 'مخرج'), k = cs_pow10_(d); var n = x.n * k * cs_pow10_(y.s), den = y.n * cs_pow10_(x.s); var q = cs_roundDiv_(n, den); return cs_f6_(q * cs_pow10_(6 - d)); }
function cs_ohCalc_(co, period) {
  var unusedOn = cs_rule_(co, 'unused_capacity_excluded'), year = period.slice(0, 4), res = {period: period, pools: [], totals: {absorbed: 0, actual: 0, variance: 0, unused: 0}, warnings: [], unusedOn: unusedOn};
  rows_('OhPools').forEach(function (pool) {
    if (pool.CompanyID !== co || String(pool.Year) !== year || !cs_b_(pool.IsActive, true)) return;
    var r = cs_ohPoolCalc_(co, pool, period, unusedOn); res.pools.push(r); r.warnings.forEach(function (w) { res.warnings.push(w); });
    res.totals.absorbed += r.Absorbed; res.totals.actual += r.ActualFixed + r.ActualVar; res.totals.variance += r.Variance; res.totals.unused += r.Unused;
  });
  return res;
}
function csOhRates_(p) { var co = cs_co_(p); cs_seed_(co); var per = cs_periodOf_(p.period), r = cs_ohCalc_(co, per); r.locked = rows_('OhRuns').some(function (x) { return x.CompanyID === co && x.Period === per; }); return r; }
function csOhRun_(p) {
  var co = cs_co_(p); cs_seed_(co);
  return locked_(function () {
    var per = cs_periodOf_(p.period), end = cs_periodEnd_(per), r = cs_ohCalc_(co, per), n = 0;
    if (!r.pools.length) throw new Error('برای سال این ماه مرکز سربار فعالی تعریف نشده است.');
    r.pools.forEach(function (x) { if (cs_poolYearPosted_(co, x.PoolID)) throw new Error('تعدیل پایان سال برای «' + x.Name + '» ثبت شده است؛ ابتدا آن را لغو کنید.'); });
    r.pools.forEach(function (x) { cs_unput_(co, p, 'OH:' + per + ':' + x.PoolID); });
    rows_('OhRuns').filter(function (x) { return x.CompanyID === co && x.Period === per; }).forEach(function (x) { delWhere_('OhRuns', 1, function (v) { return v === x.RunID; }); });
    r.pools.forEach(function (x) {
      var sid = 'OH:' + per + ':' + x.PoolID, el = x.Kind === 'ga' ? 'E23' : 'E10';
      x.Contracts.forEach(function (c) {
        if (c.Amount <= 0) return;
        cs_put_(co, p, {ContractID: c.ContractID, ElemCode: el, Qty: x.Unit === 'ریال' ? null : c.Base, Rate: '', Amount: c.Amount, SrcType: 'alloc', SrcID: sid, DateJalali: end,
          Inputs: {pool: x.Code, base: x.BaseCode, baseQty: c.Base, budgetFixed: x.BudgetFixed, budgetVar: x.BudgetVar, budgetBase: x.BudgetBase},
          Formula: 'سربار ' + x.Name + ' ' + per + ': ' + c.Base + ' ' + x.Unit + ' × (ثابت ' + x.BudgetFixed + ' + متغیر ' + x.BudgetVar + ') ÷ ' + x.BudgetBase + ' = ' + c.Fixed + ' + ' + c.Var + ' = ' + c.Amount});
        n++;
      });
      var id = nextIds_('OHR', 1)[0];
      appendRows_(sh_('OhRuns'), [pr_arr_('OhRuns', {RunID: id, CompanyID: co, PoolID: x.PoolID, Period: per, BaseTotal: x.BaseTotal, Absorbed: x.Absorbed, ActualFixed: x.ActualFixed, ActualVar: x.ActualVar, Variance: x.Variance, Unused: x.Unused,
        Detail: JSON.stringify({vol: x.VolumeVar, spend: x.SpendingVar, formula: x.Formula, unusedNote: x.UnusedNote || ''}), CreatedAt: nowStr_()})]);
    });
    bump_();
    return {period: per, entries: n, totals: r.totals, warnings: r.warnings};
  });
}
function csOhUndo_(p) {
  var co = cs_co_(p);
  return locked_(function () {
    var per = cs_periodOf_(p.period), n = 0, ids = {};
    var pools = {}; rows_('OhPools').forEach(function (x) { if (x.CompanyID === co) pools[x.PoolID] = 1; });
    Object.keys(pools).forEach(function (pid) { if (cs_poolYearPosted_(co, pid) && rows_('OhRuns').some(function (x) { return x.CompanyID === co && x.PoolID === pid && x.Period === per; })) throw new Error('تعدیل پایان سال ثبت شده است؛ ابتدا آن را لغو کنید.'); });
    rows_('CostLedger').forEach(function (r) { if (r.CompanyID === co && cs_ohRe_(per, 'OH').test(String(r.SrcID))) ids[r.SrcID] = 1; });
    Object.keys(ids).forEach(function (s) { n += cs_unput_(co, p, s); });
    var rr = rows_('OhRuns').filter(function (x) { return x.CompanyID === co && x.Period === per; });
    rr.forEach(function (x) { delWhere_('OhRuns', 1, function (v) { return v === x.RunID; }); });
    bump_(); return {removed: n, runs: rr.length};
  });
}

/* ---------- خلاصه‌ی سالانه و تعدیل کم/بیش‌جذب‌شده ---------- */
function cs_ohYear_(co, year) {
  var policy = cs_rule_(co, 'oh_variance_policy'), unusedOn = cs_rule_(co, 'unused_capacity_excluded'), res = {year: year, policy: policy, pools: [], totals: {actual: 0, absorbed: 0, variance: 0, unused: 0, adjust: 0}};
  var ctr = {}; rows_('Contracts').forEach(function (r) { if (r.CompanyID === co) ctr[r.ContractID] = r; });
  rows_('OhPools').forEach(function (pool) {
    if (pool.CompanyID !== co || String(pool.Year) !== year) return;
    var runs = rows_('OhRuns').filter(function (r) { return r.CompanyID === co && r.PoolID === pool.PoolID; }).sort(function (a, b) { return a.Period < b.Period ? -1 : 1; });
    if (!runs.length) return;
    var x = {PoolID: pool.PoolID, Code: String(pool.Code), Name: pool.Name, Months: runs.length, Actual: 0, Absorbed: 0, Variance: 0, Unused: 0, Adjust: 0, Contracts: [], posted: cs_poolYearPosted_(co, pool.PoolID)};
    runs.forEach(function (r) { x.Actual += (Number(r.ActualFixed) || 0) + (Number(r.ActualVar) || 0); x.Absorbed += Number(r.Absorbed) || 0; x.Variance += Number(r.Variance) || 0; x.Unused += Number(r.Unused) || 0; });
    x.Adjust = x.Variance - (unusedOn ? x.Unused : 0);
    var per = {}, tot = 0; rows_('CostLedger').forEach(function (r) { if (r.CompanyID === co && String(r.SrcID).indexOf('OH:') === 0 && r.SrcID.slice(-pool.PoolID.length) === pool.PoolID) { per[r.ContractID] = (per[r.ContractID] || 0) + (Number(r.Amount) || 0); tot += Number(r.Amount) || 0; } });
    var ids = Object.keys(per).sort(), cum = 0, given = 0;
    ids.forEach(function (cid) { cum += per[cid]; var upto = tot > 0 ? cs_mulDiv_(x.Adjust, String(cum), String(tot)) : 0, a = upto - given; given = upto; x.Contracts.push({ContractID: cid, ContractNo: (ctr[cid] || {}).No || '', Absorbed: per[cid], Adjust: a}); });
    res.pools.push(x); res.totals.actual += x.Actual; res.totals.absorbed += x.Absorbed; res.totals.variance += x.Variance; res.totals.unused += x.Unused; res.totals.adjust += x.Adjust;
  });
  return res;
}
function csOhYear_(p) { var co = cs_co_(p); cs_seed_(co); var y = tr_(fa2en_(p.year)); if (!/^1[34]\d\d$/.test(y)) throw new Error('سال نامعتبر است.'); return cs_ohYear_(co, y); }
function csOhYearPost_(p) {
  var co = cs_co_(p); cs_seed_(co);
  return locked_(function () {
    var y = tr_(fa2en_(p.year)); if (!/^1[34]\d\d$/.test(y)) throw new Error('سال نامعتبر است.');
    if (cs_rule_(co, 'oh_variance_policy') !== 'prorate') throw new Error('قاعده‌ی «سربار کم/بیش‌جذب‌شده» روی «هزینه دوره» است؛ برای تعدیل قراردادها آن را در تنظیمات به «تعدیل در پایان سال» تغییر دهید.');
    var r = cs_ohYear_(co, y), n = 0, end = y + '/12/' + '29';
    r.pools.forEach(function (x) {
      cs_unput_(co, p, 'OHV:' + x.PoolID);
      x.Contracts.forEach(function (c) {
        if (c.Adjust === 0) return;
        cs_put_(co, p, {ContractID: c.ContractID, ElemCode: 'E10', Qty: null, Amount: c.Adjust, SrcType: 'alloc', SrcID: 'OHV:' + x.PoolID, DateJalali: end, Inputs: {pool: x.Code, variance: x.Variance, unused: x.Unused, adjust: x.Adjust, absorbed: c.Absorbed},
          Formula: 'تعدیل سربار کم/بیش‌جذب‌شده ' + x.Name + ' سال ' + y + ': ' + x.Adjust + ' × ' + c.Absorbed + ' ÷ جمع جذب‌شده (تسهیم تجمعی) = ' + c.Adjust});
        n++;
      });
    });
    bump_(); return {year: y, entries: n};
  });
}
function csOhYearUndo_(p) {
  var co = cs_co_(p);
  return locked_(function () {
    var y = tr_(fa2en_(p.year)), n = 0;
    rows_('OhPools').forEach(function (pool) { if (pool.CompanyID === co && String(pool.Year) === y) n += cs_unput_(co, p, 'OHV:' + pool.PoolID); });
    bump_(); return {removed: n};
  });
}
