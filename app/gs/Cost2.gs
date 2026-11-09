/* ===================================================================
   ماژول «بهای تمام‌شده خدمات» — مرحله ۲: مواد و مصالح، دستمزد، پیمانکاران دست‌دوم
   همه‌ی هزینه‌ها در «دفتر هزینه قرارداد» (CostLedger) ثبت می‌شوند و فرمول/ورودی هر عدد روی همان ردیف می‌ماند.
   هیچ نرخ یا درصدی ثابت نیست؛ درصدها از قرارداد/جدول حقوق و قواعد از «تنظیمات بهای خدمات» می‌آیند.
   =================================================================== */
H.StockIssues = ['IssueID', 'CompanyID', 'No', 'DateJalali', 'DateGregorian', 'ContractID', 'ToContractID', 'Kind', 'Source', 'ProductID', 'ItemID', 'RefIssueID', 'Qty', 'AbnormalQty', 'Installed', 'Amount', 'UnitCost', 'Formula', 'Description', 'CreatedAt', 'UpdatedAt'];
H.PayRows = ['PayID', 'CompanyID', 'EmpID', 'Period', 'Mode', 'Gross', 'Employer', 'Bonus', 'Seniority', 'Other', 'HourlyDirect', 'UsefulMode', 'UsefulHours', 'Notes', 'CreatedAt', 'UpdatedAt'];
H.Timesheets = ['TSID', 'CompanyID', 'EmpID', 'DateJalali', 'DateGregorian', 'Period', 'ContractID', 'HType', 'Hours', 'Notes', 'CreatedAt', 'UpdatedAt'];
H.Statements = ['STID', 'CompanyID', 'CCID', 'No', 'DateJalali', 'DateGregorian', 'Gross', 'AdvDeduct', 'Retention', 'Deductions', 'DedTotal', 'Net', 'Status', 'Notes', 'CreatedAt', 'UpdatedAt'];
CS_KINDS.issue = {sheet: 'StockIssues', key: 'IssueID', pf: 'ISS', t: 'حواله مصرف'};
CS_KINDS.pay = {sheet: 'PayRows', key: 'PayID', pf: 'PAY', t: 'حقوق ماهانه'};
CS_KINDS.ts = {sheet: 'Timesheets', key: 'TSID', pf: 'TSH', t: 'برگه ساعت کار'};
CS_KINDS.stmt = {sheet: 'Statements', key: 'STID', pf: 'STM', t: 'صورت‌وضعیت'};
var CS_HT = {normal: 'عادی', overtime: 'اضافه‌کار', holiday: 'تعطیل‌کاری', night: 'شب‌کاری', mission: 'ماموریت', idle: 'بیکاری (بلااستفاده)'};
var CS_IK = {issue: 'حواله مصرف', return: 'برگشت از قرارداد به انبار', transfer: 'انتقال بین قراردادها'};
var CS_ISRC = {stock: 'از موجودی انبار', direct: 'خرید مستقیم برای قرارداد'};
var CS_PMODE = {monthly: 'حقوق ماهانه', hourly: 'نرخ ساعتی مستقیم (روزمزد / کارمزدی)'};
var CS_UMODE = {timesheet: 'از برگه ساعت کار همان ماه', fixed: 'عدد ثابت ماهانه'};

/* ---------- حساب دقیق ---------- */
function cs_mulDiv_(a, b, c) {
  var x = cs_dec_(a, 'مقدار'), y = cs_dec_(b, 'مقدار'), z = cs_dec_(c, 'مقسوم‌علیه');
  if (z.n === BigInt(0)) throw new Error('مخرج (مبنای محاسبه) صفر است.');
  var num = x.n * y.n * cs_pow10_(z.s), den = z.n * cs_pow10_(x.s + y.s);
  if (den < BigInt(0)) { num = -num; den = -den; }
  return Number(cs_roundDiv_(num, den));
}
function cs_s6_(x, what) { var d = cs_dec_(x, what || 'ساعت'); return d.n * cs_pow10_(6 - d.s); }
function cs_f6_(n) {
  var neg = n < BigInt(0); if (neg) n = -n;
  var s = String(n); while (s.length < 7) s = '0' + s;
  var ip = s.slice(0, -6), fp = s.slice(-6).replace(/0+$/, '');
  return (neg ? '-' : '') + ip + (fp ? '.' + fp : '');
}
function cs_money_(x) { return String(Math.round(Number(x) || 0)); }
function cs_periodOf_(s, what) {
  var m = /^(\d{4})[\/\-](\d{1,2})$/.exec(fa2en_(tr_(s)));
  if (!m) throw new Error((what || 'دوره') + ' نامعتبر است (مثال ۱۴۰۵/۰۷).');
  var mo = +m[2]; if (+m[1] < 1300 || +m[1] > 1500 || mo < 1 || mo > 12) throw new Error((what || 'دوره') + ' نامعتبر است.');
  return m[1] + '/' + ('0' + mo).slice(-2);
}
function cs_periodEnd_(period) { var mo = +period.slice(5, 7); return period + '/' + (mo <= 6 ? '31' : (mo <= 11 ? '30' : '29')); }
function cs_nextNo_(co, sheet) { var mx = 0; rows_(sheet).forEach(function (r) { if (r.CompanyID === co) { var n = parseInt(fa2en_(String(r.No)), 10); if (n > mx) mx = n; } }); return String(mx + 1); }

/* ---------- قواعد تکمیلی (برای شرکت‌های جدید و قدیمی) ---------- */
var CS_SEED_RULE2 = [
  ['labor_rate_divisor', 'مبنای ساعت در نرخ ساعتی نیروی کار', 'choice', 'capacity', 'capacity:ساعت مفید ظرفیت (کار + بیکاری ثبت‌شده)؛ هزینه بیکاری به هزینه دوره می‌رود|worked:فقط ساعت کار انجام‌شده؛ هزینه کل روی قراردادها می‌رود', 'استاندارد ۸ — «ساعت مفید» (تعریف دقیق [نیازمند تأیید])', 1]
];
function cs_seed2_(co) {
  var rs = rows_('CostRules').filter(function (r) { return r.CompanyID === co; });
  if (!rs.length) return;
  var now = nowStr_();
  /* انتقال قاعده‌ی مالیات ارزش افزوده به معنای دقیق‌تر (پیش‌فرض: اضافه نشود) */
  var old = rs.filter(function (r) { return r.Key === 'vat_nonrecoverable_in_cost'; })[0];
  if (old) {
    var nw = rs.filter(function (r) { return r.Key === 'vat_in_material_cost'; })[0];
    if (!nw) { old.Key = 'vat_in_material_cost'; old.Label = 'مالیات ارزش افزوده خرید (فقط اگر غیرقابل‌استرداد است) به بهای مواد اضافه شود'; old.Value = '0'; old.UpdatedAt = now; pr_setRow_('CostRules', 'RuleID', old.RuleID, old); }
    else delWhere_('CostRules', 1, function (v) { return v === old.RuleID; });
  }
  var have = {}; rs.forEach(function (r) { have[r.Key] = 1; });
  var add = CS_SEED_RULE2.filter(function (e) { return !have[e[0]]; });
  if (add.length) {
    var ids = nextIds_('CRL', add.length);
    appendRows_(sh_('CostRules'), add.map(function (e, i) { return pr_arr_('CostRules', {RuleID: ids[i], CompanyID: co, Key: e[0], Label: e[1], Kind: e[2], Value: e[3], Opts: e[4], Src: e[5], Verify: !!e[6], Locked: false, UpdatedAt: now}); }));
  }
}

/* ---------- نوشتن ردیف در دفتر هزینه (داخلی؛ مبلغ می‌تواند منفی باشد: برگشت/انتقال) ---------- */
function cs_elemByCode_(co, code) {
  var el = rows_('CostElements').filter(function (x) { return x.CompanyID === co && String(x.Code) === code; })[0];
  if (!el) throw new Error('عنصر هزینه‌ی «' + code + '» پیدا نشد؛ در «تنظیمات بهای خدمات» بررسی کنید.');
  return el;
}
function cs_put_(co, p, r) {
  var ctr = cs_own_('Contracts', 'ContractID', r.ContractID, co, 'قرارداد');
  if (ctr.Status === 'cancel') throw new Error('روی قرارداد لغوشده هزینه ثبت نمی‌شود.');
  var el = cs_elemByCode_(co, r.ElemCode), d = cs_date_(r.DateJalali, 'تاریخ');
  fy_gate_(co, d.g, p, 'تاریخ هزینه');
  var id = nextIds_('CLG', 1)[0], now = nowStr_(), ab = !!r.Abnormal;
  appendRows_(sh_('CostLedger'), [pr_arr_('CostLedger', {CLID: id, CompanyID: co, ContractID: ctr.ContractID, ElemID: el.ElemID, DateJalali: d.j, DateGregorian: d.g, Period: d.j.slice(0, 7), Qty: r.Qty == null ? '' : r.Qty, Rate: r.Rate == null ? '' : r.Rate, Amount: r.Amount,
    Treat: ab ? 'period' : el.Treat, Abnormal: ab, SrcType: r.SrcType, SrcID: r.SrcID, Formula: r.Formula, Inputs: JSON.stringify(r.Inputs || {}), Description: r.Description || '', VID: '', CreatedAt: now, UpdatedAt: now})]);
  return id;
}
function cs_unput_(co, p, srcId) {
  var gs = [];
  rows_('CostLedger').forEach(function (r) { if (r.CompanyID === co && r.SrcID === srcId) { if (typeof cs6_rowLocked_ === 'function' && cs6_rowLocked_(r)) throw new Error('بخشی از این هزینه‌ها در یک «صدور سند» (مرحله ۶) آمده است؛ ابتدا آخرین صدور را برگردانید.'); gs.push(r.DateGregorian); } });
  gs.forEach(function (g) { fy_gate_(co, g, p, 'تاریخ هزینه'); });
  var n = gs.length;
  if (n) delWhere_('CostLedger', H.CostLedger.indexOf('SrcID') + 1, function (v) { return v === srcId; });
  return n;
}

/* ===================================================================
   ۱) مواد و مصالح: ورودی‌ها/خروجی‌ها، ارزشیابی، حواله مصرف
   =================================================================== */
function cs_flows_(co, pid) {
  var vat = cs_rule_(co, 'vat_in_material_cost'), inv = {}, costs = {}, sumNet = {}, rec = [], out = [];
  rows_('PurchaseInvoices').forEach(function (r) { if (r.CompanyID === co) inv[r.InvoiceID] = r; });
  rows_('InvoiceCosts').forEach(function (c) { if (inv[c.InvoiceID]) { var o = costs[c.InvoiceID] || (costs[c.InvoiceID] = {amt: 0, vat: 0}); o.amt += Number(c.Amount) || 0; o.vat += Number(c.VAT) || 0; } });
  var pi = sl_cols_('PurchaseItems', ['ItemID', 'InvoiceID', 'ProductID', 'Quantity', 'NetAfterDiscount', 'VAT']), i;
  for (i = 0; i < pi.InvoiceID.length; i++) if (inv[pi.InvoiceID[i]]) sumNet[pi.InvoiceID[i]] = (sumNet[pi.InvoiceID[i]] || 0) + (Number(pi.NetAfterDiscount[i]) || 0);
  for (i = 0; i < pi.InvoiceID.length; i++) {
    var iv = inv[pi.InvoiceID[i]]; if (!iv || pi.ProductID[i] !== pid) continue;
    var q = Number(pi.Quantity[i]) || 0, net = Number(pi.NetAfterDiscount[i]) || 0, c = costs[iv.InvoiceID] || {amt: 0, vat: 0}, sn = sumNet[iv.InvoiceID] || 0, cost = net;
    if (sn > 0 && net > 0) { cost += cs_mulDiv_(c.amt, net, sn); if (vat) cost += (Number(pi.VAT[i]) || 0) + cs_mulDiv_(c.vat, net, sn); }
    else if (vat) cost += Number(pi.VAT[i]) || 0;
    cost = Math.round(cost);
    var e = {g: String(iv.DateGregorian || ''), q: q, cost: cost, ref: pi.ItemID[i], inv: iv.InvoiceNo, invId: iv.InvoiceID};
    if (iv.DocType === 'return') out.push({g: e.g, q: q, who: '', cost: cost, ret: true}); else rec.push(e);
  }
  rows_('ProdOrders').forEach(function (o) { if (o.CompanyID === co && o.ProductID === pid && o.Status === 'تکمیل‌شده') rec.push({g: String(o.DoneDateGregorian || o.DateGregorian || ''), q: Number(o.ActualQty) || 0, cost: Math.round(Number(o.TotalCost) || 0), ref: 'PO:' + o.OrderID, inv: 'تولید ' + o.OrderNo}); });
  var pr = rows_('Products').filter(function (x) { return x.CompanyID === co && x.ProductID === pid; })[0];
  if (pr && Number(pr.OpeningQty) > 0 && Number(pr.OpeningCost) > 0) rec.push({g: '', q: Number(pr.OpeningQty), cost: cs_mulRound_(pr.OpeningQty, pr.OpeningCost), ref: 'OPEN', inv: 'موجودی اولیه'});
  rows_('StockAdj').forEach(function (a) { if (a.CompanyID === co && a.ProductID === pid) { var q = Number(a.Qty) || 0; if (q > 0) rec.push({g: String(a.DateGregorian || ''), q: q, cost: Math.round(q * (Number(a.UnitCost) || 0)), ref: 'ADJ:' + a.AdjID, inv: 'تعدیل'}); else if (q < 0) out.push({g: String(a.DateGregorian || ''), q: -q, who: ''}); } });
  var sales = {}; rows_('SalesInvoices').forEach(function (s) { if (s.CompanyID === co && String(s.Superseded) !== '1' && (Number(s.Ins) === 1 || Number(s.Ins) === 2)) sales[s.SaleID] = s.DateGregorian; });
  var si = sl_cols_('SalesItems', ['SaleID', 'ProductID', 'Am']);
  for (i = 0; i < si.SaleID.length; i++) if (si.ProductID[i] === pid && sales[si.SaleID[i]] !== undefined) out.push({g: String(sales[si.SaleID[i]]), q: Number(si.Am[i]) || 0, who: ''});
  var done = {}; rows_('ProdOrders').forEach(function (o) { if (o.CompanyID === co && o.Status === 'تکمیل‌شده') done[o.OrderID] = String(o.DoneDateGregorian || o.DateGregorian || ''); });
  rows_('ProdMaterials').forEach(function (x) { if (x.ProductID === pid && done[x.OrderID] !== undefined) out.push({g: done[x.OrderID], q: Number(x.ActualQty === '' ? x.PlannedQty : x.ActualQty) || 0, who: ''}); });
  rows_('StockIssues').forEach(function (x) { if (x.CompanyID === co && x.ProductID === pid && (x.Kind === 'issue' || x.Kind === 'return')) out.push({g: String(x.DateGregorian), q: x.Kind === 'issue' ? Number(x.Qty) : -Number(x.Qty), who: x.IssueID}); });
  rec.sort(function (a, b) { return a.g < b.g ? -1 : a.g > b.g ? 1 : (String(a.ref) < String(b.ref) ? -1 : 1); });
  return {rec: rec, out: out};
}
function cs_lot_(co, itemId) {
  var it = rows_('PurchaseItems').filter(function (x) { return x.ItemID === itemId; })[0];
  if (!it) throw new Error('ردیف فاکتور خرید (لات) پیدا نشد.');
  var iv = rows_('PurchaseInvoices').filter(function (x) { return x.InvoiceID === it.InvoiceID && x.CompanyID === co; })[0];
  if (!iv) throw new Error('ردیف فاکتور خرید متعلق به این شرکت نیست.');
  if (iv.DocType === 'return') throw new Error('برای برگشت از خرید نمی‌توان مصرف ثبت کرد.');
  var fl = cs_flows_(co, it.ProductID), e = fl.rec.filter(function (x) { return x.ref === itemId; })[0];
  var used = 0; rows_('StockIssues').forEach(function (x) { if (x.CompanyID === co && x.ItemID === itemId) used += x.Kind === 'issue' ? Number(x.Qty) : (x.Kind === 'return' ? -Number(x.Qty) : 0); });
  return {item: it, inv: iv, qty: Number(it.Quantity) || 0, cost: e ? e.cost : 0, used: Math.round(used * 1e6) / 1e6, avail: Math.round(((Number(it.Quantity) || 0) - used) * 1e6) / 1e6, productId: it.ProductID};
}
/* بهای مقدار q از کالای pid در تاریخ g با روش method */
function cs_costOf_(co, method, pid, g, q, itemId) {
  var fl = cs_flows_(co, pid), s, i;
  if (itemId) {
    var lot = cs_lot_(co, itemId);
    if (lot.productId !== pid) throw new Error('لات انتخاب‌شده مربوط به این کالا نیست.');
    if (lot.avail + 1e-9 < q) throw new Error('مقدار بیش از باقیمانده‌ی لات (' + lot.avail + ') است.');
    if (!(lot.cost > 0) || !(lot.qty > 0)) throw new Error('بهای لات قابل‌محاسبه نیست.');
    var am = cs_mulDiv_(q, lot.cost, lot.qty);
    return {amount: am, formula: 'شناسایی ویژه (فاکتور ' + lot.inv.InvoiceNo + '): ' + q + ' × ' + lot.cost + ' ÷ ' + lot.qty + ' = ' + am, method: 'specific', lot: itemId};
  }
  if (method === 'avg') {
    var Q = BigInt(0), C = 0, qs = '0';
    var sq = BigInt(0);
    fl.rec.forEach(function (e) { if (e.g <= g) { sq += cs_s6_(e.q, 'مقدار'); C += e.cost; } });
    fl.out.forEach(function (o) { if (o.ret && o.g <= g) { sq -= cs_s6_(o.q, 'مقدار'); C -= o.cost; } });
    qs = cs_f6_(sq);
    if (!(Number(qs) > 0) || !(C > 0)) throw new Error('بهای میانگین مواد قابل‌محاسبه نیست (ورودی دارای بها تا این تاریخ وجود ندارد).');
    var a1 = cs_mulDiv_(q, C, qs);
    return {amount: a1, formula: 'میانگین موزون: ' + q + ' × ' + C + ' ÷ ' + qs + ' = ' + a1, method: 'avg'};
  }
  /* FIFO: خروجی‌های قبلی (همه‌ی انواع) اولین لایه‌ها را مصرف کرده‌اند */
  var before = BigInt(0);
  fl.out.forEach(function (o) { if (o.g <= g) before += cs_s6_(o.q, 'مقدار'); });
  var need = cs_s6_(q, 'مقدار'), total = 0, parts = [];
  for (i = 0; i < fl.rec.length && need > BigInt(0); i++) {
    var L = fl.rec[i]; if (L.g > g) break;
    var lq = cs_s6_(L.q, 'مقدار'); if (lq <= BigInt(0)) continue;
    if (before >= lq) { before -= lq; continue; }
    var avail = lq - before, take = avail < need ? avail : need, part = cs_mulDiv_(cs_f6_(take), L.cost, L.q);
    parts.push(cs_f6_(take) + '×' + L.cost + '÷' + L.q + '=' + part); total += part; need -= take; before = BigInt(0);
  }
  if (need > BigInt(0)) throw new Error('لایه‌های ورودی تا این تاریخ برای تأمین مقدار درخواستی (روش FIFO) کافی نیست.');
  return {amount: total, formula: 'FIFO: ' + parts.join(' + ') + ' = ' + total, method: 'fifo'};
}
function cs_stockBal_(co, pid, g) { var m = stockMap_(co, '', g), o = m[pid]; return o ? Math.round(stBal_(o) * 1e6) / 1e6 : 0; }

/* محاسبه‌ی یک حواله (بدون نوشتن) */
function cs_issueCalc_(co, o, p) {
  var kind = cs_choice_(o.Kind, CS_IK, 'نوع حواله', 'issue'), d = cs_date_(o.DateJalali, 'تاریخ'), ctr = cs_own_('Contracts', 'ContractID', o.ContractID, co, 'قرارداد');
  if (ctr.Status === 'cancel') throw new Error('روی قرارداد لغوشده حواله ثبت نمی‌شود.');
  var qty = cs_qty_(o.Qty, 'مقدار'); if (!(Number(qty) > 0)) throw new Error('مقدار باید بیشتر از صفر باشد.');
  var r = {Kind: kind, DateJalali: d.j, DateGregorian: d.g, ContractID: ctr.ContractID, ToContractID: '', Source: '', ProductID: '', ItemID: '', RefIssueID: '', Qty: qty, AbnormalQty: '0', Installed: cs_b_(o.Installed, true), Amount: 0, UnitCost: '', Formula: '', Description: tr_(o.Description), ctr: ctr};
  if (kind === 'issue') {
    var pid = tr_(o.ProductID); cs_own_('Products', 'ProductID', pid, co, 'کالا'); r.ProductID = pid;
    r.Source = cs_choice_(o.Source, CS_ISRC, 'منبع مصرف', 'stock');
    var ab = cs_qty_(o.AbnormalQty, 'ضایعات غیرعادی', true) || '0';
    if (Number(ab) > Number(qty)) throw new Error('ضایعات غیرعادی نمی‌تواند از کل مقدار بیشتر باشد.');
    r.AbnormalQty = ab;
    var lotId = tr_(o.ItemID), method = ctr.ValMethod || 'avg';
    if (r.Source === 'direct' && !lotId) throw new Error('برای خرید مستقیم، ردیف فاکتور خرید (لات) را انتخاب کنید.');
    if (r.Source === 'stock' && method === 'specific' && !lotId) throw new Error('روش ارزشیابی این قرارداد «شناسایی ویژه» است؛ لات (ردیف فاکتور خرید) را انتخاب کنید.');
    var bal = cs_stockBal_(co, pid, d.g);
    if (Number(qty) > bal + 1e-9) throw new Error('مصرف بیش از موجودی انبار است (موجودی در این تاریخ: ' + bal + ').');
    var balAll = cs_stockBal_(co, pid, '9999-12-31');
    if (Number(qty) > balAll + 1e-9) throw new Error('مصرف باعث منفی شدن موجودی نهایی انبار می‌شود (موجودی فعلی: ' + balAll + ').');
    var c = cs_costOf_(co, method, pid, d.g, qty, (r.Source === 'direct' || method === 'specific') ? lotId : '');
    r.ItemID = (r.Source === 'direct' || method === 'specific') ? lotId : ''; r.Amount = c.amount; r.Formula = c.formula;
  } else {
    var ref = cs_own_('StockIssues', 'IssueID', o.RefIssueID, co, 'حواله مرجع');
    if (ref.Kind !== 'issue' || ref.ContractID !== ctr.ContractID) throw new Error('حواله مرجع باید یک حواله‌ی مصرف از همین قرارداد باشد.');
    r.ProductID = ref.ProductID; r.Source = ref.Source; r.ItemID = ref.ItemID || ''; r.RefIssueID = ref.IssueID;
    var abAmt = Number(ref.AbnormalQty) > 0 ? cs_mulDiv_(ref.AbnormalQty, ref.Amount, ref.Qty) : 0, normQty = cs_f6_(cs_s6_(ref.Qty, 'مقدار') - cs_s6_(ref.AbnormalQty || '0', 'مقدار')), normAmt = Number(ref.Amount) - abAmt;
    var done = BigInt(0); rows_('StockIssues').forEach(function (x) { if (x.CompanyID === co && x.RefIssueID === ref.IssueID) done += cs_s6_(x.Qty, 'مقدار'); });
    var remain = cs_s6_(normQty, 'مقدار') - done;
    if (cs_s6_(qty, 'مقدار') > remain) throw new Error('مقدار بیش از باقیمانده‌ی قابل‌برگشت/انتقال این حواله (' + cs_f6_(remain) + ') است.');
    r.Amount = cs_mulDiv_(qty, normAmt, normQty);
    r.Formula = (kind === 'return' ? 'برگشت به انبار' : 'انتقال') + ' به بهای حواله ' + (ref.No || ref.IssueID) + ': ' + qty + ' × ' + normAmt + ' ÷ ' + normQty + ' = ' + r.Amount;
    if (kind === 'transfer') {
      var to = cs_own_('Contracts', 'ContractID', o.ToContractID, co, 'قرارداد مقصد'); if (to.ContractID === ctr.ContractID) throw new Error('قرارداد مقصد باید با مبدأ متفاوت باشد.');
      if (to.Status === 'cancel') throw new Error('قرارداد مقصد لغو شده است.');
      r.ToContractID = to.ContractID;
    }
  }
  r.UnitCost = Number(qty) > 0 ? String(Math.round(r.Amount / Number(qty) * 10000) / 10000) : '';
  return r;
}
function csIssuePreview_(p) {
  var co = cs_co_(p); cs_seed_(co);
  var r = cs_issueCalc_(co, p.obj || {}, p), ab = 0;
  if (r.Kind === 'issue' && Number(r.AbnormalQty) > 0 && cs_rule_(co, 'abnormal_waste_excluded')) ab = cs_mulDiv_(r.AbnormalQty, r.Amount, r.Qty);
  return {Amount: r.Amount, UnitCost: r.UnitCost, Formula: r.Formula, AbnormalAmount: ab, NormalAmount: r.Amount - ab, ProductID: r.ProductID, ItemID: r.ItemID, Source: r.Source};
}
CS_EXT.issue = {
  list: function (p, co) {
    var ctr = {}, prd = {}, usr = {};
    rows_('Contracts').forEach(function (r) { if (r.CompanyID === co) ctr[r.ContractID] = r; });
    rows_('Products').forEach(function (r) { if (r.CompanyID === co) prd[r.ProductID] = r; });
    var out = rows_('StockIssues').filter(function (r) { return r.CompanyID === co; }).map(function (r) { var o = Object.assign({}, r); o.ContractNo = (ctr[r.ContractID] || {}).No || ''; o.ToContractNo = (ctr[r.ToContractID] || {}).No || ''; o.ProductName = (prd[r.ProductID] || {}).Name || ''; o.Unit = (prd[r.ProductID] || {}).DefaultUnit || ''; o.Installed = cs_b_(r.Installed, true); o.No = String(r.No); return o; });
    if (tr_(p.contract)) out = out.filter(function (r) { return r.ContractID === p.contract || r.ToContractID === p.contract; });
    out.sort(function (a, b) { return a.DateGregorian < b.DateGregorian ? -1 : a.DateGregorian > b.DateGregorian ? 1 : (a.IssueID < b.IssueID ? -1 : 1); });
    return {rows: out};
  },
  save: function (p, co) {
    var o = p.obj || {};
    if (o.IssueID) throw new Error('حواله‌های ثبت‌شده قابل‌ویرایش نیستند (بهای آن‌ها هنگام ثبت قطعی شده است). برای اصلاح، برگشت یا حواله‌ی جدید ثبت کنید، یا آخرین حواله‌ی همان کالا را حذف کنید.');
    var r = cs_issueCalc_(co, o, p); fy_gate_(co, r.DateGregorian, p, 'تاریخ حواله');
    var id = nextIds_('ISS', 1)[0], no = tr_(fa2en_(o.No)) || cs_nextNo_(co, 'StockIssues'), now = nowStr_();
    if (rows_('StockIssues').some(function (x) { return x.CompanyID === co && String(x.No) === no; })) throw new Error('شماره حواله تکراری است.');
    var rec = {IssueID: id, CompanyID: co, No: no, DateJalali: r.DateJalali, DateGregorian: r.DateGregorian, ContractID: r.ContractID, ToContractID: r.ToContractID, Kind: r.Kind, Source: r.Source, ProductID: r.ProductID, ItemID: r.ItemID, RefIssueID: r.RefIssueID, Qty: r.Qty, AbnormalQty: r.AbnormalQty, Installed: r.Installed, Amount: r.Amount, UnitCost: r.UnitCost, Formula: r.Formula, Description: r.Description, CreatedAt: now, UpdatedAt: now};
    var inp = {product: r.ProductID, qty: r.Qty, abnormalQty: r.AbnormalQty, source: r.Source, lot: r.ItemID, method: r.ctr.ValMethod, installed: r.Installed, issue: no};
    var src = {SrcType: 'stockissue', SrcID: id, Inputs: inp, Description: r.Description, DateJalali: r.DateJalali};
    if (r.Kind === 'issue') {
      var ab = Number(r.AbnormalQty) > 0 && cs_rule_(co, 'abnormal_waste_excluded') ? cs_mulDiv_(r.AbnormalQty, r.Amount, r.Qty) : 0;
      if (r.Amount - ab > 0) cs_put_(co, p, Object.assign({ContractID: r.ContractID, ElemCode: 'E01', Qty: cs_f6_(cs_s6_(r.Qty) - (ab ? cs_s6_(r.AbnormalQty) : BigInt(0))), Rate: '', Amount: r.Amount - ab, Formula: 'حواله مصرف ' + no + ' — ' + r.Formula}, src));
      if (ab > 0) cs_put_(co, p, Object.assign({ContractID: r.ContractID, ElemCode: 'E21', Qty: r.AbnormalQty, Rate: '', Amount: ab, Abnormal: true, Formula: 'ضایعات غیرعادی (هزینه دوره): ' + r.AbnormalQty + ' × ' + r.Amount + ' ÷ ' + r.Qty + ' = ' + ab}, src));
    } else if (r.Kind === 'return') {
      cs_put_(co, p, Object.assign({ContractID: r.ContractID, ElemCode: 'E01', Qty: '-' + r.Qty, Amount: -r.Amount, Formula: 'برگشت از قرارداد — ' + r.Formula}, src));
    } else {
      cs_put_(co, p, Object.assign({ContractID: r.ContractID, ElemCode: 'E01', Qty: '-' + r.Qty, Amount: -r.Amount, Formula: 'انتقال به قرارداد دیگر — ' + r.Formula}, src));
      cs_put_(co, p, Object.assign({ContractID: r.ToContractID, ElemCode: 'E01', Qty: r.Qty, Amount: r.Amount, Formula: 'انتقال از قرارداد ' + r.ctr.No + ' — ' + r.Formula}, src));
    }
    appendRows_(sh_('StockIssues'), [pr_arr_('StockIssues', rec)]);
    bump_();
    return {IssueID: id, No: no, Amount: r.Amount};
  },
  del: function (p, co) {
    var r = cs_own_('StockIssues', 'IssueID', p.id, co, 'حواله');
    if (typeof cs5_issueGuard_ === 'function' && cs5_issueGuard_(co, r.IssueID)) throw new Error('برای این حواله «نصب مصالح» ثبت شده است؛ ابتدا رکوردهای نصب را حذف کنید.');
    if (rows_('StockIssues').some(function (x) { return x.CompanyID === co && x.RefIssueID === r.IssueID; })) throw new Error('روی این حواله برگشت یا انتقال ثبت شده است؛ ابتدا آن‌ها را حذف کنید.');
    if (rows_('StockIssues').some(function (x) { return x.CompanyID === co && x.ProductID === r.ProductID && x.IssueID > r.IssueID; })) throw new Error('فقط آخرین حواله‌ی هر کالا قابل‌حذف است (تا بهای حواله‌های بعدی بهم نریزد).');
    fy_gate_(co, r.DateGregorian, p, 'تاریخ حواله');
    cs_unput_(co, p, r.IssueID);
    delWhere_('StockIssues', 1, function (v) { return v === r.IssueID; });
    bump_();
    return {deleted: 1};
  }
};
/* لات‌های قابل‌استفاده برای شناسایی ویژه / خرید مستقیم */
function csLots_(p) {
  var co = cs_co_(p), pid = tr_(p.product); cs_own_('Products', 'ProductID', pid, co, 'کالا');
  var inv = {}; rows_('PurchaseInvoices').forEach(function (r) { if (r.CompanyID === co && r.DocType !== 'return') inv[r.InvoiceID] = r; });
  var out = [];
  rows_('PurchaseItems').forEach(function (it) { if (it.ProductID === pid && inv[it.InvoiceID]) { var l = cs_lot_(co, it.ItemID); out.push({ItemID: it.ItemID, InvoiceNo: inv[it.InvoiceID].InvoiceNo, DateJalali: inv[it.InvoiceID].DateJalali, Qty: l.qty, Used: l.used, Avail: l.avail, Cost: l.cost}); } });
  return {rows: out, balance: cs_stockBal_(co, pid, '9999-12-31')};
}

/* ===================================================================
   ۲) دستمزد: جدول حقوق ماهانه، برگه ساعت کار، نرخ ساعتی، محاسبه‌ی ماه
   =================================================================== */
function cs_laborLocked_(co, period) {
  var pre = 'LAB:' + period + ':';
  return rows_('CostLedger').some(function (r) { return r.CompanyID === co && String(r.SrcID).indexOf(pre) === 0; });
}
function cs_emp_(co, id) { return cs_own_('Employees', 'EmpID', id, co, 'کارمند'); }
CS_EXT.pay = {
  list: function (p, co) {
    var emp = {}; rows_('Employees').forEach(function (r) { if (r.CompanyID === co) emp[r.EmpID] = r.Name; });
    var out = rows_('PayRows').filter(function (r) { return r.CompanyID === co; }).map(function (r) { var o = Object.assign({}, r); o.EmpName = emp[r.EmpID] || ''; return o; });
    if (tr_(p.period)) { var pe = cs_periodOf_(p.period); out = out.filter(function (r) { return r.Period === pe; }); }
    out.sort(function (a, b) { return a.Period < b.Period ? 1 : a.Period > b.Period ? -1 : 0; });
    return {rows: out};
  },
  save: function (p, co) {
    var o = p.obj || {}, old = null, list = rows_('PayRows').filter(function (r) { return r.CompanyID === co; });
    if (o.PayID) { old = list.filter(function (r) { return r.PayID === o.PayID; })[0]; if (!old) throw new Error('ردیف حقوق پیدا نشد.'); }
    var emp = cs_emp_(co, o.EmpID), per = cs_periodOf_(o.Period);
    if (list.some(function (r) { return r.PayID !== o.PayID && r.EmpID === emp.EmpID && r.Period === per; })) throw new Error('برای این کارمند در این ماه قبلاً حقوق ثبت شده است.');
    if (old && cs_laborLocked_(co, old.Period)) throw new Error('دستمزد ماه ' + old.Period + ' محاسبه شده است؛ ابتدا «لغو محاسبه ماه» را بزنید.');
    if (cs_laborLocked_(co, per)) throw new Error('دستمزد ماه ' + per + ' محاسبه شده است؛ ابتدا «لغو محاسبه ماه» را بزنید.');
    fy_gate_(co, cs_date_(cs_periodEnd_(per), 'ماه').g, p, 'ماه حقوق');
    var mode = cs_choice_(o.Mode, CS_PMODE, 'نوع حقوق', 'monthly'), um = cs_choice_(o.UsefulMode, CS_UMODE, 'منبع ساعت مفید', 'timesheet');
    var rec = {EmpID: emp.EmpID, Period: per, Mode: mode, Gross: cs_int_(o.Gross, 'حقوق و مزایا', true), Employer: cs_int_(o.Employer, 'سهم کارفرما', true), Bonus: cs_int_(o.Bonus, 'عیدی و پاداش', true), Seniority: cs_int_(o.Seniority, 'حق سنوات', true), Other: cs_int_(o.Other, 'سایر ذخایر', true), HourlyDirect: '', UsefulMode: um, UsefulHours: '', Notes: tr_(o.Notes)};
    if (mode === 'hourly') { rec.HourlyDirect = cs_int_(o.HourlyDirect, 'نرخ ساعتی مستقیم'); if (!(rec.HourlyDirect > 0)) throw new Error('نرخ ساعتی مستقیم باید بیشتر از صفر باشد.'); rec.Gross = 0; }
    else if (!(rec.Gross > 0)) throw new Error('حقوق و مزایا باید بیشتر از صفر باشد.');
    if (um === 'fixed') { rec.UsefulHours = cs_qty_(o.UsefulHours, 'ساعت مفید ماهانه'); if (!(Number(rec.UsefulHours) > 0)) throw new Error('ساعت مفید ماهانه باید بیشتر از صفر باشد.'); if (Number(rec.UsefulHours) > 744) throw new Error('ساعت مفید ماهانه نمی‌تواند از ۷۴۴ ساعت بیشتر باشد.'); }
    var now = nowStr_(), id = old ? old.PayID : nextIds_('PAY', 1)[0];
    rec.PayID = id; rec.CompanyID = co; rec.CreatedAt = old ? old.CreatedAt : now; rec.UpdatedAt = now;
    pr_setRow_('PayRows', 'PayID', id, rec); bump_();
    return {PayID: id};
  },
  del: function (p, co) {
    var r = cs_own_('PayRows', 'PayID', p.id, co, 'ردیف حقوق');
    if (cs_laborLocked_(co, r.Period)) throw new Error('دستمزد این ماه محاسبه شده است؛ ابتدا «لغو محاسبه ماه» را بزنید.');
    fy_gate_(co, cs_date_(cs_periodEnd_(r.Period), 'ماه').g, p, 'ماه حقوق');
    delWhere_('PayRows', 1, function (v) { return v === r.PayID; }); bump_(); return {deleted: 1};
  }
};
CS_EXT.ts = {
  list: function (p, co) {
    var emp = {}, ctr = {}; rows_('Employees').forEach(function (r) { if (r.CompanyID === co) emp[r.EmpID] = r.Name; }); rows_('Contracts').forEach(function (r) { if (r.CompanyID === co) ctr[r.ContractID] = r.No; });
    var out = rows_('Timesheets').filter(function (r) { return r.CompanyID === co; }).map(function (r) { var o = Object.assign({}, r); o.EmpName = emp[r.EmpID] || ''; o.ContractNo = ctr[r.ContractID] || ''; return o; });
    if (tr_(p.period)) { var pe = cs_periodOf_(p.period); out = out.filter(function (r) { return r.Period === pe; }); }
    if (tr_(p.emp)) out = out.filter(function (r) { return r.EmpID === p.emp; });
    out.sort(function (a, b) { return a.DateGregorian < b.DateGregorian ? -1 : a.DateGregorian > b.DateGregorian ? 1 : 0; });
    return {rows: out, locked: tr_(p.period) ? cs_laborLocked_(co, cs_periodOf_(p.period)) : false};
  },
  save: function (p, co) {
    var o = p.obj || {}, old = null, list = rows_('Timesheets').filter(function (r) { return r.CompanyID === co; });
    if (o.TSID) { old = list.filter(function (r) { return r.TSID === o.TSID; })[0]; if (!old) throw new Error('ردیف برگه ساعت پیدا نشد.'); }
    var emp = cs_emp_(co, o.EmpID), d = cs_date_(o.DateJalali, 'تاریخ'), per = d.j.slice(0, 7), ht = cs_choice_(o.HType, CS_HT, 'نوع ساعت', 'normal');
    var hrs = cs_qty_(o.Hours, 'ساعت'); if (!(Number(hrs) > 0)) throw new Error('ساعت باید بیشتر از صفر باشد.'); if (Number(hrs) > 24) throw new Error('ساعت یک روز نمی‌تواند از ۲۴ بیشتر باشد.');
    var cid = tr_(o.ContractID);
    if (ht !== 'idle') { var c = cs_own_('Contracts', 'ContractID', cid, co, 'قرارداد'); if (c.Status === 'cancel') throw new Error('قرارداد لغو شده است.'); }
    else if (cid) cs_own_('Contracts', 'ContractID', cid, co, 'قرارداد');
    if (old && cs_laborLocked_(co, old.Period)) throw new Error('دستمزد ماه ' + old.Period + ' محاسبه شده است؛ ابتدا «لغو محاسبه ماه» را بزنید.');
    if (cs_laborLocked_(co, per)) throw new Error('دستمزد ماه ' + per + ' محاسبه شده است؛ ابتدا «لغو محاسبه ماه» را بزنید.');
    fy_gate_(co, d.g, p, 'تاریخ برگه ساعت');
    var day = cs_s6_(hrs); list.forEach(function (r) { if (r.EmpID === emp.EmpID && r.DateGregorian === d.g && r.TSID !== o.TSID) day += cs_s6_(r.Hours); });
    if (day > cs_s6_('24')) throw new Error('جمع ساعت این کارمند در این روز از ۲۴ ساعت بیشتر می‌شود.');
    var now = nowStr_(), id = old ? old.TSID : nextIds_('TSH', 1)[0];
    var rec = {TSID: id, CompanyID: co, EmpID: emp.EmpID, DateJalali: d.j, DateGregorian: d.g, Period: per, ContractID: ht === 'idle' ? cid : cid, HType: ht, Hours: hrs, Notes: tr_(o.Notes), CreatedAt: old ? old.CreatedAt : now, UpdatedAt: now};
    pr_setRow_('Timesheets', 'TSID', id, rec); bump_();
    return {TSID: id};
  },
  del: function (p, co) {
    var r = cs_own_('Timesheets', 'TSID', p.id, co, 'ردیف برگه ساعت');
    if (cs_laborLocked_(co, r.Period)) throw new Error('دستمزد این ماه محاسبه شده است؛ ابتدا «لغو محاسبه ماه» را بزنید.');
    fy_gate_(co, r.DateGregorian, p, 'تاریخ برگه ساعت');
    delWhere_('Timesheets', 1, function (v) { return v === r.TSID; }); bump_(); return {deleted: 1};
  }
};
/* محاسبه‌ی دستمزد یک ماه برای همه‌ی کارکنانِ دارای ردیف حقوق (بدون نوشتن) */
function cs_laborCalc_(co, period) {
  var div = cs_rule_(co, 'labor_rate_divisor'), emp = {}, ctr = {};
  rows_('Employees').forEach(function (r) { if (r.CompanyID === co) emp[r.EmpID] = r.Name; });
  rows_('Contracts').forEach(function (r) { if (r.CompanyID === co) ctr[r.ContractID] = r; });
  var pays = rows_('PayRows').filter(function (r) { return r.CompanyID === co && r.Period === period; }), ts = rows_('Timesheets').filter(function (r) { return r.CompanyID === co && r.Period === period; });
  var res = [], totals = {contracts: 0, period: 0, all: 0}, warns = [];
  pays.forEach(function (pr) {
    var worked = BigInt(0), idle = BigInt(0), byC = {}, order = [];
    ts.forEach(function (t) { if (t.EmpID !== pr.EmpID) return; var h = cs_s6_(t.Hours); if (t.HType === 'idle') idle += h; else { worked += h; if (!byC[t.ContractID]) { byC[t.ContractID] = BigInt(0); order.push(t.ContractID); } byC[t.ContractID] += h; } });
    var fixed = pr.UsefulMode === 'fixed', Hn;
    if (fixed) { Hn = cs_s6_(pr.UsefulHours); if (Hn < worked + idle) throw new Error('کارمند «' + (emp[pr.EmpID] || pr.EmpID) + '»: ساعت مفید ثابت (' + cs_f6_(Hn) + ') کمتر از ساعات ثبت‌شده در برگه (' + cs_f6_(worked + idle) + ') است.'); }
    else Hn = div === 'worked' ? worked : worked + idle;
    var Hs = cs_f6_(Hn), total, gross = Number(pr.Gross) || 0, others = (Number(pr.Employer) || 0) + (Number(pr.Bonus) || 0) + (Number(pr.Seniority) || 0) + (Number(pr.Other) || 0), notes = [];
    if (pr.Mode === 'hourly') { if (!(Hn > BigInt(0))) { gross = 0; } else gross = cs_mulRound_(Hs, pr.HourlyDirect); }
    total = gross + others;
    var row = {EmpID: pr.EmpID, EmpName: emp[pr.EmpID] || '', Mode: pr.Mode, Gross: gross, Employer: Number(pr.Employer) || 0, Bonus: Number(pr.Bonus) || 0, Seniority: Number(pr.Seniority) || 0, Other: Number(pr.Other) || 0, Total: total, WorkedHours: cs_f6_(worked), IdleHours: cs_f6_(idle), UsefulHours: Hs, Divisor: fixed ? 'fixed' : div, Rate: 0, Contracts: [], PeriodAmt: 0, Formula: ''};
    if (!(Hn > BigInt(0))) {
      if (total > 0 && (fixed || div === 'capacity')) { row.PeriodAmt = total; row.Formula = 'هیچ ساعتی ثبت نشده است؛ کل هزینه ماه هزینه دوره (ظرفیت بلااستفاده) است.'; warns.push('«' + row.EmpName + '»: ساعتی ثبت نشده؛ کل مبلغ هزینه دوره شد.'); }
      else if (total > 0) throw new Error('کارمند «' + row.EmpName + '»: ساعت مفید صفر است؛ نرخ ساعتی قابل‌محاسبه نیست.');
    } else {
      row.Rate = cs_divRound_(total, Hs);
      var sumG = 0, sumO = 0;
      order.forEach(function (cid) {
        var c = ctr[cid]; if (!c) throw new Error('قرارداد برگه ساعت پیدا نشد.'); if (c.Status === 'cancel') throw new Error('در برگه ساعت، قرارداد لغوشده (' + c.No + ') وجود دارد.');
        var hs = cs_f6_(byC[cid]), e02 = cs_mulDiv_(gross, hs, Hs), e03 = cs_mulDiv_(others, hs, Hs);
        sumG += e02; sumO += e03; row.Contracts.push({ContractID: cid, ContractNo: c.No, Hours: hs, E02: e02, E03: e03});
      });
      row.PeriodAmt = (gross - sumG) + (others - sumO);
      row.Formula = 'نرخ ساعتی = ' + total + ' ÷ ' + Hs + ' = ' + row.Rate + ' ریال؛ هزینه قرارداد = جزء مبلغ × ساعت قرارداد ÷ ' + Hs + '؛ باقیمانده (بیکاری/ظرفیت بلااستفاده/گرد) = ' + row.PeriodAmt + ' → هزینه دوره';
    }
    var chk = row.PeriodAmt; row.Contracts.forEach(function (c) { chk += c.E02 + c.E03; });
    if (chk !== total) throw new Error('خطای داخلی: جمع تخصیص دستمزد با کل مبلغ برابر نیست.');
    row.Contracts.forEach(function (c) { totals.contracts += c.E02 + c.E03; }); totals.period += row.PeriodAmt; totals.all += total;
    res.push(row);
  });
  return {period: period, employees: res, totals: totals, warnings: warns, divisor: div};
}
function csLaborRates_(p) { var co = cs_co_(p); cs_seed_(co); var per = cs_periodOf_(p.period); var r = cs_laborCalc_(co, per); r.locked = cs_laborLocked_(co, per); return r; }
function csLaborRun_(p) {
  var co = cs_co_(p); cs_seed_(co);
  return locked_(function () {
    var per = cs_periodOf_(p.period), end = cs_periodEnd_(per), r = cs_laborCalc_(co, per);
    if (!r.employees.length) throw new Error('برای این ماه ردیف حقوقی ثبت نشده است.');
    r.employees.forEach(function (e) { cs_unput_(co, p, 'LAB:' + per + ':' + e.EmpID); });
    var n = 0;
    r.employees.forEach(function (e) {
      var sid = 'LAB:' + per + ':' + e.EmpID, base = {SrcType: 'timesheet', SrcID: sid, DateJalali: end};
      e.Contracts.forEach(function (c) {
        var inp = {emp: e.EmpID, period: per, hours: c.Hours, usefulHours: e.UsefulHours, total: e.Total, divisor: e.Divisor};
        if (c.E02 > 0) { cs_put_(co, p, Object.assign({ContractID: c.ContractID, ElemCode: 'E02', Qty: c.Hours, Rate: String(e.Rate), Amount: c.E02, Inputs: inp, Formula: 'دستمزد ' + e.EmpName + ' ' + per + ': ' + e.Gross + ' × ' + c.Hours + ' ÷ ' + e.UsefulHours + ' = ' + c.E02}, base)); n++; }
        if (c.E03 > 0) { cs_put_(co, p, Object.assign({ContractID: c.ContractID, ElemCode: 'E03', Qty: c.Hours, Rate: String(e.Rate), Amount: c.E03, Inputs: inp, Formula: 'سربار نیروی کار ' + e.EmpName + ' ' + per + ': ' + (e.Total - e.Gross) + ' × ' + c.Hours + ' ÷ ' + e.UsefulHours + ' = ' + c.E03}, base)); n++; }
      });
      if (e.PeriodAmt !== 0 && r.employees.length) {
        /* هزینه دوره باید به یک قرارداد وصل شود تا در دفتر دیده شود؛ قراردادی که بیشترین ساعت را دارد، و اگر ساعتی نیست اولین قرارداد فعال */
        var host = e.Contracts.slice().sort(function (a, b) { return Number(b.Hours) - Number(a.Hours); })[0], hid = host ? host.ContractID : '';
        if (!hid) { var t0 = rows_('Timesheets').filter(function (t) { return t.CompanyID === co && t.EmpID === e.EmpID && t.Period === per && t.ContractID; })[0]; hid = t0 ? t0.ContractID : ''; }
        if (!hid) throw new Error('برای ثبت هزینه دوره (بیکاری/ظرفیت بلااستفاده) «' + e.EmpName + '» حداقل یک ردیف برگه ساعت با قرارداد لازم است.');
        cs_put_(co, p, Object.assign({ContractID: hid, ElemCode: 'E22', Qty: e.IdleHours, Amount: e.PeriodAmt, Inputs: {emp: e.EmpID, period: per, idle: e.IdleHours}, Formula: e.Formula}, base)); n++;
      }
    });
    bump_();
    return {period: per, entries: n, totals: r.totals, employees: r.employees.length};
  });
}
function csLaborUndo_(p) {
  var co = cs_co_(p);
  return locked_(function () {
    var per = cs_periodOf_(p.period), n = 0;
    rows_('PayRows').forEach(function (r) { if (r.CompanyID === co && r.Period === per) n += cs_unput_(co, p, 'LAB:' + per + ':' + r.EmpID); });
    var ids = {}; rows_('CostLedger').forEach(function (r) { if (r.CompanyID === co && String(r.SrcID).indexOf('LAB:' + per + ':') === 0) ids[r.SrcID] = 1; });
    Object.keys(ids).forEach(function (s) { n += cs_unput_(co, p, s); });
    bump_();
    return {removed: n};
  });
}

/* ===================================================================
   ۳) صورت‌وضعیت پیمانکار دست‌دوم
   =================================================================== */
function cs_stmtCalc_(co, o, old) {
  var cc = cs_own_('CostContracts', 'CCID', o.CCID, co, 'قرارداد هزینه‌ای');
  if (cc.Kind !== 'sub') throw new Error('صورت‌وضعیت فقط برای قرارداد پیمانکار دست‌دوم است.');
  if (cc.Status === 'cancel') throw new Error('قرارداد هزینه‌ای لغو شده است.');
  var d = cs_date_(o.DateJalali, 'تاریخ'), gross = cs_int_(o.Gross, 'مبلغ ناخالص کار انجام‌شده'); if (!(gross > 0)) throw new Error('مبلغ ناخالص باید بیشتر از صفر باشد.');
  var all = rows_('Statements').filter(function (r) { return r.CompanyID === co && r.CCID === cc.CCID && (!old || r.STID !== old.STID); });
  var grossSum = gross, advSum = 0; all.forEach(function (r) { grossSum += Number(r.Gross) || 0; advSum += Number(r.AdvDeduct) || 0; });
  var amount = Number(cc.Amount) || 0;
  if (grossSum > amount) throw new Error('جمع صورت‌وضعیت‌ها (' + grossSum + ') از مبلغ قرارداد پیمانکار (' + amount + ') بیشتر می‌شود.');
  var pool = tr_(cc.AdvPct) !== '' && Number(cc.AdvPct) > 0 ? cs_mulDiv_(amount, cc.AdvPct, 100) : 0, remainPool = pool - advSum;
  var adv = tr_(o.AdvDeduct) === '' ? Math.min(remainPool, tr_(cc.AdvPct) !== '' && Number(cc.AdvPct) > 0 ? cs_mulDiv_(gross, cc.AdvPct, 100) : 0) : cs_int_(o.AdvDeduct, 'کسر پیش‌پرداخت');
  if (adv > remainPool) throw new Error('کسر پیش‌پرداخت (' + adv + ') از باقیمانده‌ی پیش‌پرداخت قرارداد (' + remainPool + ') بیشتر است.');
  var ret = tr_(cc.RetPct) !== '' && Number(cc.RetPct) > 0 ? cs_mulDiv_(gross, cc.RetPct, 100) : 0, ded = [], dedTotal = 0, list = [];
  try { list = cc.Deductions ? JSON.parse(cc.Deductions) : []; } catch (e) { list = []; }
  list.forEach(function (x) { var a = cs_mulDiv_(gross, x.pct, 100); dedTotal += a; ded.push({name: x.name, pct: x.pct, amount: a, src: x.src, verify: x.verify}); });
  var net = gross - adv - ret - dedTotal;
  if (net < 0) throw new Error('خالص پرداختنی منفی می‌شود (مبلغ ناخالص کمتر از جمع کسورات است).');
  return {cc: cc, d: d, Gross: gross, AdvDeduct: adv, Retention: ret, Deductions: ded, DedTotal: dedTotal, Net: net, grossSum: grossSum, contractAmount: amount, advPool: pool, advRemain: remainPool - adv,
    Formula: 'خالص = ' + gross + ' − پیش‌پرداخت ' + adv + ' − سپرده ' + ret + ' − کسورات ' + dedTotal + ' = ' + net};
}
function csStmtCalc_(p) { var co = cs_co_(p); cs_seed_(co); var r = cs_stmtCalc_(co, p.obj || {}, null); delete r.cc; delete r.d; return r; }
CS_EXT.stmt = {
  list: function (p, co) {
    var cc = {}, ctr = {}, sup = {};
    rows_('CostContracts').forEach(function (r) { if (r.CompanyID === co) cc[r.CCID] = r; }); rows_('Contracts').forEach(function (r) { if (r.CompanyID === co) ctr[r.ContractID] = r; }); rows_('Suppliers').forEach(function (r) { if (r.CompanyID === co) sup[r.SupplierID] = r.Name; });
    var out = rows_('Statements').filter(function (r) { return r.CompanyID === co; }).map(function (r) { var c = cc[r.CCID] || {}, o = Object.assign({}, r); o.CCNo = c.No || ''; o.CCTitle = c.Title || ''; o.ContractNo = (ctr[c.ContractID] || {}).No || ''; o.SupplierName = sup[c.SupplierID] || ''; o.No = String(r.No); return o; });
    if (tr_(p.cc)) out = out.filter(function (r) { return r.CCID === p.cc; });
    out.sort(function (a, b) { return a.DateGregorian < b.DateGregorian ? -1 : a.DateGregorian > b.DateGregorian ? 1 : (a.STID < b.STID ? -1 : 1); });
    return {rows: out};
  },
  save: function (p, co) {
    var o = p.obj || {}, old = null;
    if (o.STID) { old = rows_('Statements').filter(function (r) { return r.CompanyID === co && r.STID === o.STID; })[0]; if (!old) throw new Error('صورت‌وضعیت پیدا نشد.'); if (old.Status === 'approved') throw new Error('صورت‌وضعیت تأییدشده قابل‌ویرایش نیست؛ ابتدا تأیید را برگردانید.'); o.CCID = old.CCID; }
    var r = cs_stmtCalc_(co, o, old), no = tr_(fa2en_(o.No)) || cs_nextNo_(co, 'Statements');
    if (rows_('Statements').some(function (x) { return x.CompanyID === co && x.CCID === r.cc.CCID && String(x.No) === no && (!old || x.STID !== old.STID); })) throw new Error('شماره صورت‌وضعیت برای این قرارداد تکراری است.');
    var now = nowStr_(), id = old ? old.STID : nextIds_('STM', 1)[0];
    pr_setRow_('Statements', 'STID', id, {STID: id, CompanyID: co, CCID: r.cc.CCID, No: no, DateJalali: r.d.j, DateGregorian: r.d.g, Gross: r.Gross, AdvDeduct: r.AdvDeduct, Retention: r.Retention, Deductions: JSON.stringify(r.Deductions), DedTotal: r.DedTotal, Net: r.Net, Status: 'draft', Notes: tr_(o.Notes), CreatedAt: old ? old.CreatedAt : now, UpdatedAt: now});
    bump_();
    return {STID: id, Net: r.Net};
  },
  del: function (p, co) {
    var r = cs_own_('Statements', 'STID', p.id, co, 'صورت‌وضعیت');
    if (r.Status === 'approved') throw new Error('صورت‌وضعیت تأییدشده حذف نمی‌شود؛ ابتدا تأیید را برگردانید.');
    delWhere_('Statements', 1, function (v) { return v === r.STID; }); bump_(); return {deleted: 1};
  }
};
function csStmtStatus_(p) {
  var co = cs_co_(p); cs_seed_(co);
  return locked_(function () {
    var r = cs_own_('Statements', 'STID', p.id, co, 'صورت‌وضعیت'), to = cs_choice_(p.status, {approved: 1, draft: 1}, 'وضعیت');
    if (r.Status === to) return {status: to};
    var cc = cs_own_('CostContracts', 'CCID', r.CCID, co, 'قرارداد هزینه‌ای');
    if (to === 'approved') {
      var c = cs_stmtCalc_(co, {CCID: r.CCID, DateJalali: r.DateJalali, Gross: r.Gross, AdvDeduct: r.AdvDeduct}, r);
      var sumA = Number(r.Gross) || 0; rows_('Statements').forEach(function (x) { if (x.CompanyID === co && x.CCID === r.CCID && x.STID !== r.STID && x.Status === 'approved') sumA += Number(x.Gross) || 0; });
      if (sumA > (Number(cc.Amount) || 0)) throw new Error('جمع صورت‌وضعیت‌های تأییدشده از مبلغ قرارداد بیشتر می‌شود.');
      cs_put_(co, p, {ContractID: cc.ContractID, ElemCode: 'E06', Qty: null, Amount: Number(r.Gross), SrcType: 'statement', SrcID: r.STID, DateJalali: r.DateJalali, Inputs: {cc: cc.No, statement: r.No, gross: r.Gross, adv: r.AdvDeduct, retention: r.Retention, deductions: r.DedTotal, net: r.Net}, Description: 'صورت‌وضعیت ' + r.No + ' — ' + cc.Title,
        Formula: 'صورت‌وضعیت ' + r.No + ' پیمانکار: مبلغ ناخالص کار انجام‌شده = ' + r.Gross + ' (خالص پرداختنی ' + r.Net + ' پس از کسر پیش‌پرداخت ' + r.AdvDeduct + '، سپرده ' + r.Retention + ' و کسورات ' + r.DedTotal + ')'});
    } else { cs_unput_(co, p, r.STID); }
    r.Status = to; r.UpdatedAt = nowStr_(); pr_setRow_('Statements', 'STID', r.STID, r); bump_();
    return {status: to};
  });
}
