/* ===================================================================
   ماژول «بهای تمام‌شده خدمات» — مرحله ۵: برآورد تکمیل (EAC)، درصد پیشرفت، درآمد قابل‌شناسایی،
   بهای خدمات ارائه‌شده، هزینه‌های کسب قرارداد و قرارداد زیان‌ده
   - این مرحله «فقط محاسبه و گزارش» است؛ هیچ سند حسابداری یا ردیف دفتر هزینه‌ای نمی‌نویسد (سند: مرحله ۶).
   - برآورد کل هزینه (EAC) = هزینه‌ی واقعی تا پایان ماه + برآورد باقی‌مانده‌ی هر عنصر که کاربر برای همان ماه وارد می‌کند.
   - روش‌های پیشرفت (ProgMethod قرارداد): هزینه‌به‌هزینه، ساعت کار، مراحل/نقاط عطف، گذشت زمان.
   - هیچ نرخ یا قاعده‌ای در کد ثابت نیست؛ قواعد در «تنظیمات بهای خدمات» با برچسب «نیازمند تأیید» قابل‌ویرایش‌اند.
   - همه‌ی تقسیم‌ها با عدد صحیح BigInt و گرد کردن نیم‌به‌بالا انجام می‌شود (بدون float).
   =================================================================== */
H.CostEst = ['EID', 'CompanyID', 'ContractID', 'Period', 'ElemID', 'Remaining', 'Notes', 'CreatedAt', 'UpdatedAt'];
H.ProgIn = ['PGID', 'CompanyID', 'ContractID', 'Period', 'RemHours', 'Notes', 'CreatedAt', 'UpdatedAt'];
H.Milestones = ['MSID', 'CompanyID', 'ContractID', 'Title', 'Weight', 'DueJ', 'DueG', 'DoneJ', 'DoneG', 'Notes', 'CreatedAt', 'UpdatedAt'];
H.InstallLog = ['ILID', 'CompanyID', 'ContractID', 'IssueID', 'DateJalali', 'DateGregorian', 'Period', 'Amount', 'Notes', 'CreatedAt', 'UpdatedAt'];
H.ContractCfg = ['CFID', 'CompanyID', 'ContractID', 'AcqTreat', 'Notes', 'CreatedAt', 'UpdatedAt'];
CS_KINDS.est = {sheet: 'CostEst', key: 'EID', pf: 'CES', t: 'برآورد باقی‌مانده'};
CS_KINDS.ms = {sheet: 'Milestones', key: 'MSID', pf: 'MLS', t: 'مرحله / نقطه عطف'};
CS_KINDS.inst = {sheet: 'InstallLog', key: 'ILID', pf: 'INL', t: 'ثبت نصب مصالح'};
CS_KINDS.ccfg = {sheet: 'ContractCfg', key: 'CFID', pf: 'CCF', t: 'تنظیم قرارداد'};
var CS_ACQT = {'': 'پیش‌فرض شرکت (طبق قواعد)', asset: 'دارایی؛ استهلاک متناسب با پیشرفت', expense: 'هزینه‌ی دوره در زمان وقوع'};
CS_SEED_RULE2.push(['acq_treat_default', 'پیش‌فرض شناخت هزینه‌های کسب قرارداد (در صورت نبود انتخاب برای قرارداد)', 'choice', 'asset', 'asset:دارایی و استهلاک متناسب با پیشرفت|expense:هزینه‌ی دوره در زمان وقوع', 'استاندارد ۴۳ — هزینه‌های کسب قرارداد [نیازمند تأیید]', 1]);
CS_SEED_RULE2.push(['loss_include_asset_costs', 'هزینه‌های کسب/ایفای قرارداد در آزمون قرارداد زیان‌ده جزو کل هزینه‌ی مورد انتظار حساب شود', 'bool', '1', '', 'استاندارد ۴۳ و ۱۴۲ — [نیازمند تأیید]', 1]);

/* ---------- ابزارهای تاریخ/دوره ---------- */
function cs5_perAdd_(q, n) { var i = cs_idx_(q) + n, y = Math.floor(i / 12), m = i % 12 + 1; return y + '/' + ('0' + m).slice(-2); }
function cs5_dayNum_(g) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(g)); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : NaN; }
function cs5_pEndG_(q) {
  var n = parseJ_(cs5_perAdd_(q, 1) + '/01'); if (!n) return '';
  var d = new Date((cs5_dayNum_(n.g) - 1) * 86400000);
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}
function cs5_pct_(num, den) { return Number(cs_roundDiv_(num * BigInt(1000000), den)) / 10000; }
function cs5_money_(x) { return Math.round(Number(x) || 0); }
function cs5_ownContract_(co, id) { var c = cs_own_('Contracts', 'ContractID', id, co, 'قرارداد'); return c; }
function cs5_cfg_(co, cid) { return rows_('ContractCfg').filter(function (r) { return r.CompanyID === co && r.ContractID === cid; })[0] || null; }
function cs5_term_(ctr) {
  var a = String(ctr.StartJ || ''), b = String(ctr.EndJ || ''); if (!a || !b) return 0;
  return cs_idx_(b.slice(0, 7)) - cs_idx_(a.slice(0, 7)) + 1;
}
function cs5_acqTreat_(co, ctr, cfg) {
  var t = cfg ? String(cfg.AcqTreat || '') : '';
  if (t === 'asset' || t === 'expense') return {t: t, why: 'انتخاب همین قرارداد'};
  if (cs_rule_(co, 'acq_practical_expedient_on')) {
    var m = cs5_term_(ctr), lim = cs_rule_(co, 'acq_practical_expedient_months');
    if (m > 0 && m <= lim) return {t: 'expense', why: 'معافیت عملی: مدت قرارداد ' + m + ' ماه ≤ سقف ' + lim + ' ماه [نیازمند تأیید]'};
  }
  return {t: cs_rule_(co, 'acq_treat_default') === 'expense' ? 'expense' : 'asset', why: 'پیش‌فرض شرکت [نیازمند تأیید]'};
}

/* ---------- داده‌های یک قرارداد (یک‌بار خوانده می‌شود) ---------- */
function cs5_ctx_(co, ctr) {
  var cid = ctr.ContractID, ctx = {co: co, ctr: ctr, el: {}, iss: {}, led: [], est: {}, pin: [], ts: [], ms: [], inst: [], amend: []};
  rows_('CostElements').forEach(function (r) { if (r.CompanyID === co) ctx.el[r.ElemID] = r; });
  rows_('StockIssues').forEach(function (r) { if (r.CompanyID === co) ctx.iss[r.IssueID] = r; });
  rows_('CostLedger').forEach(function (r) { if (r.CompanyID === co && r.ContractID === cid) ctx.led.push({per: String(r.Period), amt: cs5_money_(r.Amount), treat: r.Treat, elem: r.ElemID, src: r.SrcType, sid: r.SrcID}); });
  rows_('CostEst').forEach(function (r) { if (r.CompanyID === co && r.ContractID === cid) (ctx.est[r.ElemID] || (ctx.est[r.ElemID] = [])).push({per: String(r.Period), rem: cs5_money_(r.Remaining)}); });
  rows_('ProgIn').forEach(function (r) { if (r.CompanyID === co && r.ContractID === cid) ctx.pin.push({per: String(r.Period), h: cs_s6_(r.RemHours)}); });
  rows_('Timesheets').forEach(function (r) { if (r.CompanyID === co && r.ContractID === cid && r.HType !== 'idle') ctx.ts.push({per: String(r.Period), h: cs_s6_(r.Hours)}); });
  rows_('Milestones').forEach(function (r) { if (r.CompanyID === co && r.ContractID === cid) ctx.ms.push({w: cs_s6_(r.Weight), doneG: String(r.DoneG || '')}); });
  if (H.ContractAmend) rows_('ContractAmend').forEach(function (r) { if (r.CompanyID === co && r.ContractID === cid) ctx.amend.push({g: String(r.DateGregorian), d: cs5_money_(r.Delta)}); });
  rows_('InstallLog').forEach(function (r) { if (r.CompanyID === co && r.ContractID === cid) ctx.inst.push({per: String(r.Period), issue: r.IssueID, amt: cs5_money_(r.Amount)}); });
  return ctx;
}
/* مصالح تحویل‌شده ولی نصب‌نشده تا پایان ماه q */
function cs5_uninst_(ctx, q) {
  var sum = {}, inst = {}, t = 0, det = [];
  ctx.led.forEach(function (r) {
    if (r.per > q || r.treat !== 'product' || r.src !== 'stockissue') return;
    var is = ctx.iss[r.sid]; if (!is) return;
    var root = is.Kind === 'issue' ? is : ctx.iss[is.RefIssueID];
    if (!root || root.ContractID !== ctx.ctr.ContractID || cs_b_(root.Installed, true)) return;
    sum[root.IssueID] = (sum[root.IssueID] || 0) + r.amt;
  });
  ctx.inst.forEach(function (x) { if (x.per <= q) inst[x.issue] = (inst[x.issue] || 0) + x.amt; });
  Object.keys(sum).forEach(function (k) { var u = Math.max(0, sum[k] - (inst[k] || 0)); if (u > 0) { t += u; det.push({IssueID: k, No: String(ctx.iss[k].No), amount: u}); } });
  return {total: t, rows: det};
}
/* برآورد باقی‌مانده‌ی یک عنصر در پایان ماه q: دقیق (همان ماه) / مشتق‌شده (آخرین برآورد منهای هزینه‌ی بعد از آن) / ندارد */
function cs5_remElem_(ctx, eid, q) {
  var best = null;
  (ctx.est[eid] || []).forEach(function (e) { if (e.per <= q && (!best || e.per > best.per)) best = e; });
  if (!best) return {rem: 0, mode: 'none'};
  if (best.per === q) return {rem: best.rem, mode: 'exact', from: q};
  var spent = 0; ctx.led.forEach(function (r) { if (r.elem === eid && r.treat !== 'period' && r.per > best.per && r.per <= q) spent += r.amt; });
  return {rem: Math.max(0, best.rem - spent), mode: 'derived', from: best.per};
}
function cs5_remHours_(ctx, q) {
  var best = null;
  ctx.pin.forEach(function (e) { if (e.per <= q && (!best || e.per > best.per)) best = e; });
  if (!best) return null;
  if (best.per === q) return {h: best.h, mode: 'exact', from: q};
  var spent = BigInt(0); ctx.ts.forEach(function (t) { if (t.per > best.per && t.per <= q) spent += t.h; });
  var r = best.h - spent; return {h: r < BigInt(0) ? BigInt(0) : r, mode: 'derived', from: best.per};
}

/* ---------- محاسبه‌ی وضعیت قرارداد در پایان ماه q ---------- */
function cs5_at_(ctx, q) {
  var co = ctx.co, ctr = ctx.ctr, baseAmount = cs5_money_(ctr.Amount), method = String(ctr.ProgMethod || 'cost'), pe0 = cs5_pEndG_(q), amendTot = 0;
  (ctx.amend || []).forEach(function (m) { if (m.g && m.g <= pe0) amendTot += m.d; });
  var amount = baseAmount + amendTot;
  var A = {product: 0, acq: 0, ful: 0, period: 0}, act = {};
  ctx.led.forEach(function (r) {
    if (r.per > q) return;
    var e = ctx.el[r.elem] || {};
    if (r.treat === 'product') A.product += r.amt; else if (r.treat === 'asset') { if (e.Grp === 'acq') A.acq += r.amt; else A.ful += r.amt; } else A.period += r.amt;
    if (r.treat !== 'period') act[r.elem] = (act[r.elem] || 0) + r.amt;
  });
  var hasEst = false, anyExact = false, rem = {prod: 0, acq: 0, ful: 0}, lines = [], missing = [], derivedN = 0;
  Object.keys(ctx.est).forEach(function (eid) { ctx.est[eid].forEach(function (e) { if (e.per <= q) { hasEst = true; if (e.per === q) anyExact = true; } }); });
  Object.keys(ctx.el).forEach(function (eid) {
    var e = ctx.el[eid]; if (e.Treat === 'period') return;
    var a = act[eid] || 0, has = (ctx.est[eid] || []).length > 0; if (!a && !has) return;
    var rr = hasEst ? cs5_remElem_(ctx, eid, q) : {rem: 0, mode: 'none'};
    if (rr.mode === 'derived') derivedN++;
    if (rr.mode === 'none' && hasEst && a) missing.push(String(e.Code) + ' ' + e.Name);
    if (e.Treat === 'product') rem.prod += rr.rem; else if (e.Grp === 'acq') rem.acq += rr.rem; else rem.ful += rr.rem;
    lines.push({ElemID: eid, Code: String(e.Code), Name: e.Name, Grp: e.Grp, Treat: e.Treat, actual: a, remaining: rr.rem, total: a + rr.rem, mode: rr.mode, from: rr.from || ''});
  });
  lines.sort(function (a, b) { return a.Code < b.Code ? -1 : 1; });
  var estStatus = !hasEst ? 'none' : (anyExact ? 'exact' : 'derived');
  var U = cs5_uninst_(ctx, q), uninst = Math.max(0, Math.min(U.total, A.product));
  var pe = cs5_pEndG_(q), prog = null, why = '', basis = '';
  if (method === 'cost') {
    if (!hasEst) why = 'no_estimate';
    else {
      var num = A.product - uninst, den = A.product + rem.prod;
      if (!(den > 0)) why = 'no_basis'; else { if (num < 0) num = 0; if (num > den) num = den; prog = {num: BigInt(num), den: BigInt(den)}; basis = 'هزینه‌ی انجام‌شده ' + num + ' ÷ برآورد کل هزینه ' + den; }
    }
  } else if (method === 'hours') {
    var hd = BigInt(0); ctx.ts.forEach(function (t) { if (t.per <= q) hd += t.h; });
    var rh = cs5_remHours_(ctx, q);
    if (!rh) why = 'no_hours';
    else { var dh = hd + rh.h; if (!(dh > BigInt(0))) why = 'no_basis'; else { prog = {num: hd, den: dh}; basis = 'ساعت انجام‌شده ' + cs_f6_(hd) + ' ÷ (انجام‌شده + باقی‌مانده) ' + cs_f6_(dh); } }
  } else if (method === 'time') {
    var s = cs5_dayNum_(ctr.StartG), e2 = cs5_dayNum_(ctr.EndG), pd = cs5_dayNum_(pe);
    if (isNaN(s) || isNaN(e2) || e2 < s) why = 'no_dates';
    else { var tot = e2 - s + 1, el = Math.max(0, Math.min(pd, e2) - s + 1); prog = {num: BigInt(el), den: BigInt(tot)}; basis = 'روز سپری‌شده ' + el + ' ÷ کل روزهای قرارداد ' + tot; }
  } else if (method === 'milestone') {
    var tw = BigInt(0), dw = BigInt(0); ctx.ms.forEach(function (m) { tw += m.w; if (m.doneG && m.doneG <= pe) dw += m.w; });
    if (!(tw > BigInt(0))) why = 'no_milestones'; else { prog = {num: dw, den: tw}; basis = 'وزن مراحل تکمیل‌شده ' + cs_f6_(dw) + ' ÷ وزن کل ' + cs_f6_(tw); }
  } else why = 'no_basis';
  var rev = 0;
  if (prog && amount > 0) rev = Number(cs_roundDiv_(BigInt(amount) * prog.num, prog.den));
  var at = cs5_acqTreat_(co, ctr, cs5_cfg_(co, ctr.ContractID)), acqRec = 0, fulRec = 0;
  if (at.t === 'expense') acqRec = A.acq; else if (prog) acqRec = Number(cs_roundDiv_(BigInt(A.acq) * prog.num, prog.den));
  if (prog) fulRec = Number(cs_roundDiv_(BigInt(A.ful) * prog.num, prog.den));
  var prodRec = A.product - uninst, cost = prodRec + acqRec + fulRec;
  var inclAsset = cs_rule_(co, 'loss_include_asset_costs');
  var known = A.product + (inclAsset ? A.acq + A.ful : 0), expTotal = hasEst ? known + rem.prod + (inclAsset ? rem.acq + rem.ful : 0) : null;
  var loss = 0, lossLower = 0;
  if (amount > 0) { if (expTotal !== null) loss = Math.max(0, expTotal - amount); lossLower = Math.max(0, known - amount); }
  var gp = rev - cost, recognisedLoss = Math.max(0, -gp), provision = loss > 0 ? Math.max(0, loss - recognisedLoss) : 0;
  var assetBal = (at.t === 'expense' ? 0 : A.acq - acqRec) + (A.ful - fulRec), impair = false;
  if (cs_rule_(co, 'impairment_test_on') && hasEst && amount > 0 && assetBal > 0 && assetBal > (amount - rev) - (rem.prod + uninst)) impair = true;
  return {period: q, method: method, computable: !!prog, why: why, basis: basis, progressPct: prog ? cs5_pct_(prog.num, prog.den) : null, progNum: prog ? String(prog.num) : '', progDen: prog ? String(prog.den) : '',
    amount: amount, baseAmount: baseAmount, amendTotal: amendTot, revCum: rev, costCum: cost, gpCum: gp, comps: {product: A.product, uninstalled: uninst, productRecognised: prodRec, acqIncurred: A.acq, acqRecognised: acqRec, fulIncurred: A.ful, fulRecognised: fulRec, periodCosts: A.period},
    acqTreat: at.t, acqWhy: at.why, estStatus: estStatus, derivedElems: derivedN, missingElems: missing, remaining: {product: rem.prod, acq: rem.acq, fulfil: rem.ful}, eacProduct: A.product + rem.prod,
    expectedTotal: expTotal, expectedMargin: expTotal === null || !(amount > 0) ? null : amount - expTotal, loss: loss, lossLower: lossLower, recognisedLoss: recognisedLoss, provision: provision, impairment: impair, assetBalance: assetBal,
    uninstRows: U.rows, lines: lines};
}
/* روند ماه‌به‌ماه تا ماه P (تجمعی و دوره‌ای) */
function cs5_sched_(ctx, P) {
  var first = P; ctx.led.forEach(function (r) { if (r.per < first) first = r.per; });
  var sp = String(ctx.ctr.StartJ || '').slice(0, 7); if (sp && sp < first) first = sp;
  if (cs_idx_(P) - cs_idx_(first) > 119) first = cs5_perAdd_(P, -119);
  var out = [], pr = 0, pc = 0, pg = 0, carry = 0, prevPct = null;
  for (var q = first; q <= P; q = cs5_perAdd_(q, 1)) {
    var a = cs5_at_(ctx, q), rc = a.computable ? a.revCum : carry; carry = rc;
    var row = {period: q, computable: a.computable, why: a.why, progressPct: a.progressPct, revCum: rc, rev: rc - pr, costCum: a.costCum, cost: a.costCum - pc, gpCum: rc - a.costCum, gp: (rc - a.costCum) - pg,
      uninstalled: a.comps.uninstalled, estStatus: a.estStatus, decreased: prevPct !== null && a.progressPct !== null && a.progressPct < prevPct - 1e-9};
    if (a.computable) prevPct = a.progressPct;
    pr = rc; pc = a.costCum; pg = rc - a.costCum; out.push(row);
  }
  return out;
}
var CS5_WHY = {no_estimate: 'برآورد باقی‌مانده‌ی هزینه برای این ماه (یا ماه‌های قبل) ثبت نشده است؛ درصد پیشرفت قابل‌محاسبه نیست.', no_hours: 'برآورد ساعت باقی‌مانده ثبت نشده است؛ درصد پیشرفت قابل‌محاسبه نیست.',
  no_dates: 'تاریخ شروع/پایان قرارداد معتبر نیست؛ پیشرفت زمانی قابل‌محاسبه نیست.', no_milestones: 'مرحله‌ای (با وزن) برای قرارداد تعریف نشده است.', no_basis: 'مبنای محاسبه‌ی پیشرفت صفر است (هزینه یا ساعت ثبت نشده).'};
function cs5_summary_(ctx, a, sched) {
  var ctr = ctx.ctr, w = [], last = sched.length ? sched[sched.length - 1] : null, n = {};
  if (!a.computable) w.push(CS5_WHY[a.why] || 'پیشرفت قابل‌محاسبه نیست.');
  if (!(a.amount > 0)) w.push('مبلغ قرارداد ثبت نشده است؛ درآمد قابل‌شناسایی محاسبه نمی‌شود.');
  if (a.amendTotal) w.push('مبلغ قرارداد با الحاقیه‌ها ' + (a.amendTotal > 0 ? '+' : '') + a.amendTotal + ' ریال تغییر کرده است (مبلغ پایه ' + a.baseAmount + ')؛ اثر تغییر به‌صورت «جبران تجمعی» در درآمد ماه الحاقیه می‌آید [نیازمند تأیید].');
  if (a.estStatus === 'derived') w.push('برای این ماه برآورد باقی‌مانده وارد نشده؛ برآورد آخرین ماه ثبت‌شده منهای هزینه‌های بعد از آن به‌کار رفت.');
  else if (a.derivedN) w.push('برآورد باقی‌مانده‌ی ' + a.derivedN + ' عنصر برای این ماه ثبت نشده و از ماه قبل مشتق شد.');
  if (a.missingElems.length) w.push('برای عناصر «' + a.missingElems.join('، ') + '» هزینه‌ی واقعی هست ولی برآورد باقی‌مانده ثبت نشده (صفر فرض شد).');
  if (last && last.decreased) w.push('درصد پیشرفت نسبت به ماه قبل کاهش یافته است؛ برآوردها را بررسی کنید.');
  if (a.computable && a.progressPct >= 100 && ctr.Status === 'active') w.push('پیشرفت ۱۰۰٪ محاسبه شده ولی قرارداد هنوز «فعال» است؛ برآورد باقی‌مانده را بررسی کنید یا قرارداد را «تکمیل‌شده» کنید.');
  if (a.comps.uninstalled > 0) w.push('مصالح تحویل‌شده ولی نصب‌نشده: ' + a.comps.uninstalled + ' ریال (از پیشرفت و بهای خدمات ارائه‌شده کنار گذاشته شد).');
  if (a.acqIncurred !== 0 && !a.computable && a.acqTreat === 'asset') w.push('هزینه‌ی کسب قرارداد (دارایی) تا زمان محاسبه‌ی پیشرفت استهلاک نمی‌شود.');
  if (a.loss > 0) w.push('قرارداد زیان‌ده: برآورد کل هزینه (' + a.expectedTotal + ') از مبلغ قرارداد (' + a.amount + ') بیشتر است؛ زیان کل مورد انتظار ' + a.loss + ' ریال [مبنای شناسایی نیازمند تأیید].');
  else if (a.lossLower > 0) w.push('هزینه‌ی واقعی تا امروز (' + (a.expectedTotal === null ? a.costCum : '') + ') از مبلغ قرارداد بیشتر شده است؛ قرارداد قطعاً زیان‌ده است (حداقل ' + a.lossLower + ' ریال).');
  if (a.impairment) w.push('نشانه‌ی کاهش ارزش دارایی‌های هزینه قرارداد: مانده‌ی دارایی ' + a.assetBalance + ' ریال از مبلغ قابل‌بازیافت بیشتر است [نیازمند تأیید].');
  return w;
}
function cs5_row_(ctx, P, withSched) {
  var ctr = ctx.ctr, a = cs5_at_(ctx, P), sched = cs5_sched_(ctx, P), last = sched[sched.length - 1] || {};
  var warnings = cs5_summary_(ctx, a, sched);
  var o = {ContractID: ctr.ContractID, No: String(ctr.No), Title: ctr.Title, Status: ctr.Status, ProgMethod: a.method, Amount: a.amount, BaseAmount: a.baseAmount, amendTotal: a.amendTotal, computable: a.computable, why: a.why, basis: a.basis, progressPct: a.progressPct, estStatus: a.estStatus,
    revCum: last.revCum || 0, rev: last.rev || 0, costCum: a.costCum, cost: last.cost || 0, gpCum: (last.revCum || 0) - a.costCum, gp: last.gp || 0,
    eac: {actual: a.comps.product + a.comps.acqIncurred + a.comps.fulIncurred, remaining: a.remaining.product + a.remaining.acq + a.remaining.fulfil, total: a.expectedTotal},
    expectedMargin: a.expectedMargin, loss: a.loss, lossLower: a.lossLower, provision: a.provision, comps: a.comps, acqTreat: a.acqTreat, acqWhy: a.acqWhy, impairment: a.impairment, warnings: warnings};
  o.revCum = last.revCum || 0; o.gpCum = o.revCum - o.costCum;
  if (withSched) {
    o.schedule = sched; o.lines = a.lines; o.uninstRows = a.uninstRows; o.remaining = a.remaining; o.eacProduct = a.eacProduct; o.assetBalance = a.assetBalance;
    o.check = {costParts: a.comps.productRecognised + a.comps.acqRecognised + a.comps.fulRecognised, costCum: a.costCum, equal: a.comps.productRecognised + a.comps.acqRecognised + a.comps.fulRecognised === a.costCum,
      periodSumRev: sched.reduce(function (s, r) { return s + r.rev; }, 0), periodSumCost: sched.reduce(function (s, r) { return s + r.cost; }, 0)};
    o.check.revEqual = o.check.periodSumRev === o.revCum || sched.length === 120; o.check.costEqual = o.check.periodSumCost === o.costCum || sched.length === 120;
  }
  return o;
}
/* گزارش: یک قرارداد (جزئیات) یا همه‌ی قراردادها (مقایسه) در پایان یک ماه */
function csProg_(p) {
  var co = cs_co_(p); cs_seed_(co);
  var P = cs_periodOf_(p.period, 'ماه گزارش'), out = {period: P, rows: [], totals: {amount: 0, revCum: 0, rev: 0, costCum: 0, cost: 0, gpCum: 0, gp: 0, loss: 0, provision: 0, uninstalled: 0}, warnings: [], disclaimer: 'محاسبه‌ی کمکی؛ قواعد و برآوردها نیازمند تأیید حسابدار/حسابرس رسمی است.'};
  if (tr_(p.contract)) {
    var c1 = cs5_ownContract_(co, p.contract); out.detail = cs5_row_(cs5_ctx_(co, c1), P, true); out.rows = [out.detail];
  } else {
    var act = {};
    ['CostLedger', 'CostEst', 'ProgIn', 'Milestones', 'Timesheets'].forEach(function (s) { rows_(s).forEach(function (r) { if (r.CompanyID === co) act[r.ContractID] = 1; }); });
    rows_('Contracts').filter(function (r) { return r.CompanyID === co && r.Status !== 'cancel' && (act[r.ContractID] || r.Status === 'active'); })
      .sort(function (a, b) { return String(a.No) < String(b.No) ? -1 : 1; })
      .forEach(function (c) { out.rows.push(cs5_row_(cs5_ctx_(co, c), P, false)); });
  }
  out.rows.forEach(function (r) {
    var T = out.totals; T.amount += r.Amount; T.revCum += r.revCum; T.rev += r.rev; T.costCum += r.costCum; T.cost += r.cost; T.gpCum += r.gpCum; T.gp += r.gp; T.loss += r.loss; T.provision += r.provision; T.uninstalled += r.comps.uninstalled;
    r.warnings.forEach(function (w) { out.warnings.push('قرارداد ' + r.No + ': ' + w); });
  });
  out.counts = {contracts: out.rows.length, incomplete: out.rows.filter(function (r) { return !r.computable; }).length, lossContracts: out.rows.filter(function (r) { return r.loss > 0 || r.lossLower > 0; }).length};
  return out;
}

/* ---------- برآورد باقی‌مانده (EAC): شبکه‌ی ورود برای یک قرارداد و ماه ---------- */
CS_EXT.est = {
  list: function (p, co) {
    if (!tr_(p.contract) || !tr_(p.period)) {
      var all = rows_('CostEst').filter(function (r) { return r.CompanyID === co; });
      if (tr_(p.contract)) all = all.filter(function (r) { return r.ContractID === p.contract; });
      return {rows: all.map(function (r) { return Object.assign({}, r); })};
    }
    var ctr = cs5_ownContract_(co, p.contract), P = cs_periodOf_(p.period), ctx = cs5_ctx_(co, ctr), prev = cs5_perAdd_(P, -1), grid = [];
    var cur = {}; rows_('CostEst').forEach(function (r) { if (r.CompanyID === co && r.ContractID === ctr.ContractID && String(r.Period) === P) cur[r.ElemID] = r; });
    var actP = {}, actAll = {}; ctx.led.forEach(function (r) { if (r.treat === 'period') return; if (r.per <= P) actAll[r.elem] = (actAll[r.elem] || 0) + r.amt; });
    Object.keys(ctx.el).map(function (k) { return ctx.el[k]; }).filter(function (e) { return e.Treat !== 'period' && (cs_b_(e.IsActive, true) || cur[e.ElemID] || actAll[e.ElemID]); })
      .sort(function (a, b) { return String(a.Code) < String(b.Code) ? -1 : 1; }).forEach(function (e) {
        var pv = cs5_remElem_(ctx, e.ElemID, prev), dv = cs5_remElem_(ctx, e.ElemID, P);
        grid.push({ElemID: e.ElemID, Code: String(e.Code), Name: e.Name, Grp: e.Grp, Treat: e.Treat, actual: actAll[e.ElemID] || 0, prevRem: pv.mode === 'none' ? '' : pv.rem, suggested: dv.mode === 'none' ? '' : dv.rem, suggestedFrom: dv.from || '',
          EID: cur[e.ElemID] ? cur[e.ElemID].EID : '', rem: cur[e.ElemID] ? cs5_money_(cur[e.ElemID].Remaining) : '', Notes: cur[e.ElemID] ? cur[e.ElemID].Notes : ''});
      });
    var hd = BigInt(0); ctx.ts.forEach(function (t) { if (t.per <= P) hd += t.h; });
    var pin = rows_('ProgIn').filter(function (r) { return r.CompanyID === co && r.ContractID === ctr.ContractID && String(r.Period) === P; })[0], hs = cs5_remHours_(ctx, P);
    return {contract: {ContractID: ctr.ContractID, No: String(ctr.No), Title: ctr.Title, Amount: ctr.Amount, ProgMethod: ctr.ProgMethod, Status: ctr.Status}, period: P, grid: grid, hours: {done: cs_f6_(hd), rem: pin ? String(pin.RemHours) : '', suggested: hs ? cs_f6_(hs.h) : '', suggestedFrom: hs ? hs.from : ''}};
  },
  save: function (p, co) {
    var o = p.obj || {}, ctr = cs5_ownContract_(co, o.ContractID);
    if (ctr.Status === 'cancel') throw new Error('برای قرارداد لغوشده برآورد ثبت نمی‌شود.');
    var P = cs_periodOf_(o.Period), now = nowStr_(), n = 0, items = Array.isArray(o.rows) ? o.rows : [];
    if (!items.length && o.RemHours === undefined) throw new Error('ردیفی برای ثبت نیست.');
    var seen = {}, prepared = items.map(function (it) {
      var el = cs_own_('CostElements', 'ElemID', it.ElemID, co, 'عنصر هزینه');
      if (seen[el.ElemID]) throw new Error('عنصر «' + el.Name + '» تکراری است.'); seen[el.ElemID] = 1;
      if (el.Treat === 'period') throw new Error('برای «' + el.Name + '» (هزینه‌ی دوره) برآورد باقی‌مانده ثبت نمی‌شود؛ جزو بهای قرارداد نیست.');
      var blank = tr_(it.Remaining) === '';
      return {el: el, blank: blank, rem: blank ? 0 : cs_int_(it.Remaining, 'برآورد باقی‌مانده‌ی «' + el.Name + '»'), notes: tr_(it.Notes)};
    });
    prepared.forEach(function (it) {
      var old = rows_('CostEst').filter(function (r) { return r.CompanyID === co && r.ContractID === ctr.ContractID && String(r.Period) === P && r.ElemID === it.el.ElemID; })[0];
      if (it.blank) { if (old) { delWhere_('CostEst', 1, function (v) { return v === old.EID; }); n++; } return; }
      var id = old ? old.EID : nextIds_('CES', 1)[0];
      pr_setRow_('CostEst', 'EID', id, {EID: id, CompanyID: co, ContractID: ctr.ContractID, Period: P, ElemID: it.el.ElemID, Remaining: it.rem, Notes: it.notes, CreatedAt: old ? old.CreatedAt : now, UpdatedAt: now}); n++;
    });
    if (o.RemHours !== undefined) {
      var oldH = rows_('ProgIn').filter(function (r) { return r.CompanyID === co && r.ContractID === ctr.ContractID && String(r.Period) === P; })[0];
      if (tr_(o.RemHours) === '') { if (oldH) { delWhere_('ProgIn', 1, function (v) { return v === oldH.PGID; }); n++; } }
      else {
        var hv = cs_qty_(o.RemHours, 'ساعت باقی‌مانده'), pid = oldH ? oldH.PGID : nextIds_('PGI', 1)[0];
        pr_setRow_('ProgIn', 'PGID', pid, {PGID: pid, CompanyID: co, ContractID: ctr.ContractID, Period: P, RemHours: hv, Notes: '', CreatedAt: oldH ? oldH.CreatedAt : now, UpdatedAt: now}); n++;
      }
    }
    bump_(); return {saved: n};
  },
  del: function (p, co) {
    var r = cs_own_('CostEst', 'EID', p.id, co, 'برآورد');
    delWhere_('CostEst', 1, function (v) { return v === r.EID; }); bump_(); return {deleted: 1};
  }
};

/* ---------- مراحل / نقاط عطف (برای روش پیشرفت «برون‌داد») ---------- */
CS_EXT.ms = {
  list: function (p, co) {
    var ctr = {}; rows_('Contracts').forEach(function (r) { if (r.CompanyID === co) ctr[r.ContractID] = r; });
    var out = rows_('Milestones').filter(function (r) { return r.CompanyID === co && (!tr_(p.contract) || r.ContractID === p.contract); }).map(function (r) { var o = Object.assign({}, r); o.ContractNo = String((ctr[r.ContractID] || {}).No || ''); o.Done = !!r.DoneG; return o; });
    out.sort(function (a, b) { return a.ContractNo < b.ContractNo ? -1 : a.ContractNo > b.ContractNo ? 1 : (a.MSID < b.MSID ? -1 : 1); });
    var sum = {}; out.forEach(function (r) { sum[r.ContractID] = (sum[r.ContractID] || BigInt(0)) + cs_s6_(r.Weight); });
    out.forEach(function (r) { var t = sum[r.ContractID]; r.Share = t > BigInt(0) ? cs5_pct_(cs_s6_(r.Weight), t) : 0; });
    return {rows: out};
  },
  save: function (p, co) {
    var o = p.obj || {}, ctr = cs5_ownContract_(co, o.ContractID), old = null;
    if (o.MSID) { old = rows_('Milestones').filter(function (r) { return r.CompanyID === co && r.MSID === o.MSID; })[0]; if (!old) throw new Error('مرحله پیدا نشد.'); }
    var title = tr_(o.Title); if (!title) throw new Error('عنوان مرحله الزامی است.');
    var w = cs_qty_(o.Weight, 'وزن مرحله'); if (!(Number(w) > 0)) throw new Error('وزن مرحله باید بیشتر از صفر باشد.');
    var due = cs_date_(o.DueJ, 'تاریخ برنامه‌ریزی', true), done = cs_date_(o.DoneJ, 'تاریخ تکمیل', true);
    var now = nowStr_(), id = old ? old.MSID : nextIds_('MLS', 1)[0];
    pr_setRow_('Milestones', 'MSID', id, {MSID: id, CompanyID: co, ContractID: ctr.ContractID, Title: title, Weight: w, DueJ: due.j, DueG: due.g, DoneJ: done.j, DoneG: done.g, Notes: tr_(o.Notes), CreatedAt: old ? old.CreatedAt : now, UpdatedAt: now});
    bump_(); return {MSID: id};
  },
  del: function (p, co) {
    var r = cs_own_('Milestones', 'MSID', p.id, co, 'مرحله');
    delWhere_('Milestones', 1, function (v) { return v === r.MSID; }); bump_(); return {deleted: 1};
  }
};

/* ---------- ثبت نصب مصالحِ تحویل‌شده (از «نصب‌نشده» خارج می‌شود) ---------- */
function cs5_issueNet_(co, ctr, issueId) {
  var iss = {}; rows_('StockIssues').forEach(function (r) { if (r.CompanyID === co) iss[r.IssueID] = r; });
  var s = 0; rows_('CostLedger').forEach(function (r) {
    if (r.CompanyID !== co || r.ContractID !== ctr || r.Treat !== 'product' || r.SrcType !== 'stockissue') return;
    var is = iss[r.SrcID]; if (!is) return; var root = is.Kind === 'issue' ? is : iss[is.RefIssueID];
    if (root && root.IssueID === issueId) s += cs5_money_(r.Amount);
  });
  return s;
}
CS_EXT.inst = {
  list: function (p, co) {
    var ctrs = {}; rows_('Contracts').forEach(function (r) { if (r.CompanyID === co) ctrs[r.ContractID] = r; });
    var logs = rows_('InstallLog').filter(function (r) { return r.CompanyID === co && (!tr_(p.contract) || r.ContractID === p.contract); });
    var done = {}; rows_('InstallLog').forEach(function (r) { if (r.CompanyID === co) done[r.IssueID] = (done[r.IssueID] || 0) + cs5_money_(r.Amount); });
    var issues = rows_('StockIssues').filter(function (r) { return r.CompanyID === co && r.Kind === 'issue' && !cs_b_(r.Installed, true) && (!tr_(p.contract) || r.ContractID === p.contract); }).map(function (r) {
      var net = cs5_issueNet_(co, r.ContractID, r.IssueID), d = done[r.IssueID] || 0;
      return {IssueID: r.IssueID, No: String(r.No), DateJalali: r.DateJalali, ContractID: r.ContractID, ContractNo: String((ctrs[r.ContractID] || {}).No || ''), Amount: net, Installed: d, Remaining: Math.max(0, net - d)};
    });
    return {rows: logs.map(function (r) { var o = Object.assign({}, r); o.ContractNo = String((ctrs[r.ContractID] || {}).No || ''); return o; }), issues: issues};
  },
  save: function (p, co) {
    var o = p.obj || {}; if (o.ILID) throw new Error('رکورد نصب قابل‌ویرایش نیست؛ آن را حذف و دوباره ثبت کنید.');
    var is = cs_own_('StockIssues', 'IssueID', o.IssueID, co, 'حواله'); if (is.Kind !== 'issue' || cs_b_(is.Installed, true)) throw new Error('فقط برای حواله‌ی مصرفِ «نصب‌نشده» می‌توان نصب ثبت کرد.');
    var d = cs_date_(o.DateJalali, 'تاریخ نصب'); if (d.g < is.DateGregorian) throw new Error('تاریخ نصب نمی‌تواند قبل از تاریخ حواله باشد.');
    var amt = cs_int_(o.Amount, 'مبلغ نصب‌شده'); if (!(amt > 0)) throw new Error('مبلغ نصب‌شده باید بیشتر از صفر باشد.');
    var net = cs5_issueNet_(co, is.ContractID, is.IssueID), done = 0; rows_('InstallLog').forEach(function (r) { if (r.CompanyID === co && r.IssueID === is.IssueID) done += cs5_money_(r.Amount); });
    if (done + amt > net) throw new Error('مجموع مبلغ نصب‌شده (' + (done + amt) + ') از بهای باقی‌مانده‌ی حواله (' + net + ') بیشتر می‌شود.');
    var now = nowStr_(), id = nextIds_('INL', 1)[0];
    pr_setRow_('InstallLog', 'ILID', id, {ILID: id, CompanyID: co, ContractID: is.ContractID, IssueID: is.IssueID, DateJalali: d.j, DateGregorian: d.g, Period: d.j.slice(0, 7), Amount: amt, Notes: tr_(o.Notes), CreatedAt: now, UpdatedAt: now});
    bump_(); return {ILID: id};
  },
  del: function (p, co) {
    var r = cs_own_('InstallLog', 'ILID', p.id, co, 'رکورد نصب');
    delWhere_('InstallLog', 1, function (v) { return v === r.ILID; }); bump_(); return {deleted: 1};
  }
};
function cs5_issueGuard_(co, issueId) { return rows_('InstallLog').filter(function (r) { return r.CompanyID === co && r.IssueID === issueId; }).length; }

/* ---------- تنظیم هزینه‌ی کسب قرارداد برای هر قرارداد ---------- */
CS_EXT.ccfg = {
  list: function (p, co) {
    var out = rows_('Contracts').filter(function (r) { return r.CompanyID === co && r.Status !== 'cancel' && (!tr_(p.contract) || r.ContractID === p.contract); }).sort(function (a, b) { return String(a.No) < String(b.No) ? -1 : 1; }).map(function (c) {
      var cfg = cs5_cfg_(co, c.ContractID), eff = cs5_acqTreat_(co, c, cfg), acq = 0, elA = {};
      rows_('CostElements').forEach(function (e) { if (e.CompanyID === co && e.Grp === 'acq') elA[e.ElemID] = 1; });
      rows_('CostLedger').forEach(function (r) { if (r.CompanyID === co && r.ContractID === c.ContractID && elA[r.ElemID] && r.Treat !== 'period') acq += cs5_money_(r.Amount); });
      return {ContractID: c.ContractID, No: String(c.No), Title: c.Title, ProgMethod: c.ProgMethod, AcqTreat: cfg ? String(cfg.AcqTreat || '') : '', CFID: cfg ? cfg.CFID : '', Effective: eff.t, EffectiveWhy: eff.why, AcqTotal: acq};
    });
    return {rows: out};
  },
  save: function (p, co) {
    var o = p.obj || {}, ctr = cs5_ownContract_(co, o.ContractID), t = tr_(o.AcqTreat);
    if (t !== '' && t !== 'asset' && t !== 'expense') throw new Error('نحوه‌ی شناخت هزینه کسب قرارداد نامعتبر است.');
    var old = cs5_cfg_(co, ctr.ContractID), now = nowStr_(), id = old ? old.CFID : nextIds_('CCF', 1)[0];
    pr_setRow_('ContractCfg', 'CFID', id, {CFID: id, CompanyID: co, ContractID: ctr.ContractID, AcqTreat: t, Notes: tr_(o.Notes), CreatedAt: old ? old.CreatedAt : now, UpdatedAt: now});
    bump_(); return {CFID: id};
  },
  del: function (p, co) {
    var r = cs_own_('ContractCfg', 'CFID', p.id, co, 'تنظیم'); delWhere_('ContractCfg', 1, function (v) { return v === r.CFID; }); bump_(); return {deleted: 1};
  }
};
