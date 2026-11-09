/* ===================================================================
   ماژول «بهای تمام‌شده خدمات» — مرحله ۶: صدور سند حسابداری (پیش‌نویس)، گزارش جامع، فهرست موارد «نیازمند تأیید»
   - هر «صدور» برای یک ماه (دوره) انجام می‌شود و تا چهار سند «پیش‌نویس» می‌سازد:
       rev  = شناسایی درآمد      (بد: دارایی قرارداد / بس: فروش خدمات)
       cos  = بهای خدمات ارائه‌شده (بد: بهای تمام‌شده خدمات / بس: هزینه‌های در جریان یا دارایی قرارداد)
       trf  = انتقال هزینه‌های واقعی دفتر هزینه به حساب‌های بهای قرارداد
       prov = ذخیره‌ی قرارداد زیان‌ده
   - مبلغ هر سند «اختلاف مقدار تجمعی تا پایان ماه با مجموع آنچه قبلاً صادر شده» است (روش Catch-up)؛
     پس اگر ماهی صادر نشود یا ورودی‌ها بعداً اصلاح شود، صدور بعدی خودکار جبران می‌کند.
   - ردیف‌های دفتر هزینه که در یک صدور آمده‌اند با شناسه‌ی صدور (ستون VID) علامت می‌خورند و
     تا برگشتن صدور قابل‌ویرایش/حذف نیستند. برگشت فقط برای «آخرین صدور» و فقط وقتی همه‌ی اسناد آن پیش‌نویس‌اند.
   - سربار کم/بیش‌جذب و ظرفیت بلااستفاده: چون سربار واقعی در حساب‌های طبیعی هزینه مانده و سربار جذب‌شده
     به حساب «هزینه‌های جذب‌شده» (بستانکار) می‌رود، مانده‌ی خالص خودبه‌خود در سود و زیان دوره می‌ماند؛
     برای آن سند جداگانه‌ای صادر نمی‌شود و فقط در گزارش نشان داده می‌شود.
   - هیچ نرخ/درصد قانونی در کد نیست؛ قواعد در «تنظیمات» و با برچسب «نیازمند تأیید» نگه‌داری می‌شوند.
   =================================================================== */
H.CostRuns = ['RunID', 'CompanyID', 'Period', 'Seq', 'DateJalali', 'DateGregorian', 'Vouchers', 'Totals', 'Notes', 'CreatedAt'];
H.CostPosts = ['PostID', 'CompanyID', 'RunID', 'ContractID', 'Kind', 'Amount', 'Detail', 'CreatedAt'];
H.ContractAmend = ['AMID', 'CompanyID', 'ContractID', 'DateJalali', 'DateGregorian', 'Period', 'Delta', 'Notes', 'CreatedAt', 'UpdatedAt'];
H.ContractBills = ['BLID', 'CompanyID', 'ContractID', 'No', 'DateJalali', 'DateGregorian', 'Period', 'Amount', 'Vat', 'Notes', 'VID', 'CreatedAt', 'UpdatedAt'];
CS_KINDS.amend = {sheet: 'ContractAmend', key: 'AMID', pf: 'AMD', t: 'الحاقیه'};
CS_KINDS.bill = {sheet: 'ContractBills', key: 'BLID', pf: 'BIL', t: 'صورت‌وضعیت کارفرما'};

/* حساب‌های سیستمی جدید (برای شرکت‌های قدیمی هم هنگام صدور ساخته می‌شود) */
['1306|دارایی قرارداد (درآمد شناسایی‌شده‌ی مطالبه‌نشده)||opt|opt|cs_unbilled',
 '1506|هزینه‌های قراردادهای خدماتی در جریان اجرا|||opt|cs_wip',
 '1603|هزینه‌های کسب و ایفای قرارداد (دارایی)|||opt|cs_asset',
 '3402|ذخیره‌ی زیان قراردادهای زیان‌ده|||opt|cs_loss_prov',
 '7105|بهای تمام‌شده خدمات ارائه‌شده|||opt|cs_cogs',
 '7106|هزینه‌های جذب‌شده در قراردادها (بستانکار)|||opt|cs_abs',
 '7107|هزینه‌های دوره‌ی قراردادها (ضایعات غیرعادی و ...)|||opt|cs_period',
 '7703|هزینه‌ی ذخیره‌ی زیان قراردادها|||opt|cs_loss_exp'].forEach(function (l) { if (AC_STD_MOEIN.indexOf(l) < 0) AC_STD_MOEIN.push(l); });

CS_SEED_RULE2.push(['cs6_transfer_costs', 'هزینه‌های واقعی هر دوره (دفتر هزینه) در سند «انتقال هزینه» به حساب‌های بهای قرارداد منتقل شود', 'bool', '1', '', 'اگر هزینه‌ها را خودتان با سند دستی به حساب «هزینه‌های قراردادهای در جریان» می‌برید، خاموش کنید تا دوبار ثبت نشود [نیازمند تأیید]', 1]);
CS_SEED_RULE2.push(['cs6_post_provision', 'ذخیره‌ی قرارداد زیان‌ده (زیان کل مورد انتظار منهای زیان شناخته‌شده) در سند صادر شود', 'bool', '1', '', 'استاندارد ۴۳ و استاندارد ذخایر/بدهی‌های احتمالی — قراردادهای زیان‌ده [نیازمند تأیید]', 1]);
CS_SEED_RULE2.push(['cs6_dims', 'در ردیف‌های سند، پروژه‌ی قرارداد (و خریدار برای «دارایی قرارداد») ثبت شود', 'bool', '1', '', 'کنترل داخلی — تفکیک تحلیلی', 0]);

var CS6_KIND = {rev: 'شناسایی درآمد', bill: 'صورت‌وضعیت کارفرما', cos: 'بهای خدمات ارائه‌شده', trf: 'انتقال هزینه‌ها', prov: 'ذخیره‌ی قرارداد زیان‌ده'};
var CS6_ORDER = ['rev', 'bill', 'cos', 'trf', 'prov'];
var CS6_NOTES = [
  'درآمد هر دوره = «مبلغ قرارداد × درصد پیشرفت تجمعی» منهای درآمد صادرشده‌ی قبلی (روش درون‌داد/برون‌داد/زمان طبق انتخاب هر قرارداد) — استاندارد ۴۳ [بند دقیق نیازمند تأیید].',
  'درآمد شناسایی‌شده به حساب «دارایی قرارداد» (بدهکار) و «فروش خدمات» (بستانکار) می‌رود. صورت‌وضعیت کارفرما (تب «الحاقیه و صورت‌وضعیت») به «حساب‌های دریافتنی» بدهکار و به «دارایی قرارداد» (و ارزش افزوده‌ی فروش) بستانکار می‌شود؛ پس درآمد دوبار ثبت نمی‌شود. برای قراردادهایی که با این روش کار می‌کنید، فاکتور فروش جداگانه‌ی همان مبلغ را در بخش فروش ثبت نکنید — تصمیم نهایی با حسابدار/حسابرس [نیازمند تأیید].',
  'الحاقیه (افزایش/کاهش مبلغ قرارداد) از ماه تاریخ اثر در مبلغ قرارداد لحاظ می‌شود؛ اثر آن به‌صورت «جبران تجمعی» (مبلغ جدید × پیشرفت تجمعی منهای درآمد صادرشده) در درآمد همان ماه می‌آید [نیازمند تأیید].',
  'مبلغ ارزش افزوده‌ی صورت‌وضعیت را خودتان وارد می‌کنید (نرخ در برنامه ثابت نیست)؛ بخش ارزش افزوده بستانکار «ارزش افزوده‌ی فروش» می‌شود. سپرده‌ی حسن انجام کار و پیش‌دریافت فعلاً جداگانه مدل نشده است.',
  'بهای خدمات ارائه‌شده = هزینه‌ی انجام‌شده منهای مصالح نصب‌نشده + هزینه‌ی کسب/ایفای قرارداد به نسبت پیشرفت (یا کامل در زمان وقوع اگر «هزینه‌ی دوره» انتخاب شده) [نیازمند تأیید].',
  'هزینه‌ی کسب قرارداد: پیش‌فرض «دارایی و استهلاک متناسب با پیشرفت» مگر در قرارداد انتخاب دیگری شده یا معافیت عملی (مدت کوتاه) برقرار باشد [نیازمند تأیید].',
  'انتقال هزینه: مصالح مصرف‌شده از موجودی/خرید مستقیم از حساب موجودی کالا، و سایر هزینه‌ها (دستمزد، ماشین‌آلات، پیمانکار، سربار تسهیم‌شده و ...) از حساب «هزینه‌های جذب‌شده در قراردادها» (بستانکار) خارج و به «هزینه‌های در جریان اجرا» یا «هزینه‌های کسب و ایفای قرارداد» منتقل می‌شود. فرض: این هزینه‌ها قبلاً در حساب‌های طبیعی هزینه (بدهکار) ثبت شده‌اند [نیازمند تأیید].',
  'ضایعات غیرعادی و هزینه‌های دوره‌ای که از انبار مصرف شده‌اند به حساب «هزینه‌های دوره‌ی قراردادها» می‌روند؛ هزینه‌های دوره‌ای دیگر که پیش‌تر در حساب طبیعی هزینه ثبت شده‌اند سند جدید ندارند.',
  'سربار کم/بیش‌جذب‌شده و ظرفیت بلااستفاده: مانده‌ی خالص (سربار واقعی در حساب‌های طبیعی منهای جذب‌شده) در سود و زیان همان دوره می‌ماند و سند جدا ندارد؛ اگر سیاست «تعدیل در پایان سال» انتخاب شود، مبلغ تعدیل‌شده در دفتر هزینه‌ی قراردادها و در انتقال هزینه می‌آید [نیازمند تأیید].',
  'ذخیره‌ی قرارداد زیان‌ده = زیان کل مورد انتظار منهای زیانی که تا کنون در سود و زیان شناخته شده است؛ مبنا و حساب بدهکار (هزینه‌ی ذخیره) [نیازمند تأیید].',
  'تاریخ همه‌ی اسناد = آخرین روز ماه صدور؛ همه‌ی اسناد «پیش‌نویس» ساخته می‌شوند و تأیید نهایی با حسابدار است.',
  'مبلغ‌ها ریال صحیح و گرد «نیم به بالا» هستند؛ تفاوت‌های گرد شدن در صدورهای بعدی جبران می‌شود.'
];

function cs6_stdMap_() {
  var m = {}; AC_STD_MOEIN.forEach(function (line) { var f = line.split('|'); if (f[5]) m[f[5]] = {code: f[0], name: f[1]}; }); return m;
}
function cs6_accInfo_(co) {
  var m = cs6_stdMap_(); ac_accOf_(co).forEach(function (a) { if (tr_(a.SysKey) && m[a.SysKey]) m[a.SysKey] = {code: String(a.Code), name: a.Name, exists: true}; });
  return m;
}
function cs6_cls_(co) {
  var rec = {}, made = {}, raw = {}, cls = {};
  rows_('Recipes').forEach(function (r) { if (r.CompanyID === co) { rec[r.RecipeID] = 1; if (r.ProductID) made[r.ProductID] = 1; } });
  rows_('RecipeItems').forEach(function (r) { if (rec[r.RecipeID] && r.ProductID) raw[r.ProductID] = 1; });
  rows_('Products').forEach(function (p) { if (p.CompanyID === co) cls[p.ProductID] = made[p.ProductID] ? 'inv_fg' : (raw[p.ProductID] ? 'inv_raw' : 'inventory'); });
  return cls;
}
function cs6_posted_(co) {
  var m = {}; rows_('CostPosts').forEach(function (r) { if (r.CompanyID === co) { var k = r.ContractID + '|' + r.Kind; m[k] = (m[k] || 0) + cs5_money_(r.Amount); } });
  return m;
}
function cs6_runs_(co) {
  return rows_('CostRuns').filter(function (r) { return r.CompanyID === co; }).sort(function (a, b) { return (Number(a.Seq) || 0) - (Number(b.Seq) || 0); });
}
function cs6_per_(p) { return cs_periodOf_(p.period, 'ماه صدور'); }

/* ---------- برنامه‌ی صدور (فقط محاسبه) ---------- */
function cs6_plan_(co, P) {
  var info = cs6_accInfo_(co), warnings = [], posted = cs6_posted_(co), prog = csProg_({company: co, period: P});
  var runs = cs6_runs_(co), last = runs.length ? runs[runs.length - 1] : null;
  var plan = {period: P, contracts: [], vouchers: [], warnings: warnings, lastRun: last ? {RunID: last.RunID, Period: String(last.Period)} : null, noteRows: 0};
  var cus = {}, prj = {}, prod = {}, iss = {}, ctrAll = {};
  rows_('Customers').forEach(function (r) { if (r.CompanyID === co) cus[r.CustomerID] = 1; });
  rows_('Projects').forEach(function (r) { if (r.CompanyID === co) prj[r.ProjID] = 1; });
  rows_('Products').forEach(function (r) { if (r.CompanyID === co) prod[r.ProductID] = r; });
  rows_('StockIssues').forEach(function (r) { if (r.CompanyID === co) iss[r.IssueID] = r; });
  rows_('Contracts').forEach(function (r) { if (r.CompanyID === co) ctrAll[r.ContractID] = r; });
  var dims = cs_rule_(co, 'cs6_dims'), doTrf = cs_rule_(co, 'cs6_transfer_costs'), doProv = cs_rule_(co, 'cs6_post_provision');
  var V = {}; CS6_ORDER.forEach(function (k) { V[k] = []; });
  var line = function (kind, key, dr, cr, desc, c, pid) {
    var o = {key: key, dr: dr > 0 ? dr : 0, cr: cr > 0 ? cr : 0, desc: desc, contractId: c ? c.ContractID : '', productId: pid || ''};
    if (c && dims && c.ProjID && prj[c.ProjID]) o.projId = c.ProjID;
    if (c && (key === 'ar' || (dims && key === 'cs_unbilled')) && c.CustomerID && cus[c.CustomerID]) o.partyId = c.CustomerID;
    V[kind].push(o);
  };
  var pair = function (kind, dKey, cKey, amt, desc, c, pid) { if (!amt) return; if (amt > 0) { line(kind, dKey, amt, 0, desc, c); line(kind, cKey, 0, amt, desc, c, pid); } else { line(kind, dKey, 0, -amt, desc, c); line(kind, cKey, -amt, 0, desc, c, pid); } };
  prog.rows.forEach(function (r) {
    var c = ctrAll[r.ContractID], who = 'قرارداد ' + r.No + ' — ' + r.Title;
    var it = {ContractID: r.ContractID, No: r.No, Title: r.Title, computable: r.computable, held: !r.computable, why: r.computable ? '' : (CS5_WHY[r.why] || 'پیشرفت قابل‌محاسبه نیست.'), items: []};
    if (!r.computable) { warnings.push('قرارداد ' + r.No + ': ' + it.why + ' — درآمد، بها و ذخیره‌ی این قرارداد در این صدور نیامد.'); }
    else {
      var add = function (kind, label, target) {
        var po = posted[r.ContractID + '|' + kind] || 0, d = target - po;
        it.items.push({kind: kind, label: label, target: target, posted: po, delta: d});
        return d;
      };
      var dRev = add('rev', 'درآمد شناسایی‌شده (تجمعی)', r.revCum);
      var dProd = add('cos_prod', 'بهای خدمات ارائه‌شده — از هزینه‌های در جریان', r.comps.productRecognised);
      var dAst = add('cos_asset', 'بهای خدمات ارائه‌شده — از هزینه‌های کسب/ایفای (دارایی)', r.comps.acqRecognised + r.comps.fulRecognised);
      var dPrv = doProv ? add('prov', 'ذخیره‌ی قرارداد زیان‌ده (مانده)', r.provision) : 0;
      pair('rev', 'cs_unbilled', 'sales_svc', dRev, 'درآمد شناسایی‌شده — ' + who, c);
      pair('cos', 'cs_cogs', 'cs_wip', dProd, 'بهای خدمات ارائه‌شده — ' + who, c);
      pair('cos', 'cs_cogs', 'cs_asset', dAst, 'بهای خدمات ارائه‌شده (کسب/ایفای) — ' + who, c);
      pair('prov', 'cs_loss_exp', 'cs_loss_prov', dPrv, 'ذخیره‌ی قرارداد زیان‌ده — ' + who, c);
      if (dRev < 0 || dProd < 0 || dAst < 0) warnings.push('قرارداد ' + r.No + ': درآمد یا بهای تجمعی نسبت به آنچه صادر شده کمتر شده است؛ سند اصلاحی (معکوس) ساخته می‌شود. برآوردها را بررسی کنید.');
    }
    plan.contracts.push(it);
  });
  /* صورت‌وضعیت‌های صادرشده برای کارفرما (هر صورت‌وضعیت: بدهکار حساب‌های دریافتنی، بستانکار دارایی قرارداد و ارزش افزوده) */
  var billRows = [], billTot = 0;
  rows_('ContractBills').filter(function (b) { return b.CompanyID === co && tr_(b.VID) === '' && String(b.Period) <= P && ctrAll[b.ContractID]; })
    .sort(function (a, b) { return a.DateGregorian < b.DateGregorian ? -1 : (a.DateGregorian > b.DateGregorian ? 1 : (a.BLID < b.BLID ? -1 : 1)); }).forEach(function (b) {
      var c = ctrAll[b.ContractID], amt = cs5_money_(b.Amount), vat = cs5_money_(b.Vat), d = 'صورت‌وضعیت ' + b.No + ' کارفرما — قرارداد ' + c.No;
      billRows.push(b.BLID); billTot += amt;
      if (!(c.CustomerID && cus[c.CustomerID])) warnings.push('قرارداد ' + c.No + ': خریدار (کارفرما) ثبت نشده؛ سند صورت‌وضعیت «حساب‌های دریافتنی» بدون شخص ساخته می‌شود و هنگام تأیید سند خطا می‌دهد.');
      line('bill', 'ar', amt + vat, 0, d, c);
      line('bill', 'cs_unbilled', 0, amt, d, c);
      if (vat > 0) line('bill', 'vat_out', 0, vat, d, c);
    });
  plan.billRows = billRows;
  prog.rows.forEach(function (r) { var bc = rows_('ContractBills').filter(function (b) { return b.CompanyID === co && b.ContractID === r.ContractID && String(b.Period) <= P; }).reduce(function (s0, b) { return s0 + cs5_money_(b.Amount); }, 0); if (r.computable && bc > r.revCum) warnings.push('قرارداد ' + r.No + ': مجموع صورت‌وضعیت‌ها (' + bc + ') از درآمد شناسایی‌شده (' + r.revCum + ') بیشتر است؛ مانده‌ی «دارایی قرارداد» منفی (در واقع بدهی قرارداد/پیش‌دریافت) می‌شود و باید در صورت‌های مالی جداگانه نشان داده شود [نیازمند تأیید].'); });
  /* انتقال هزینه‌های واقعی */
  var trfRows = [], groups = {}, noPost = 0, noPostAmt = 0;
  var cls = cs6_cls_(co), elN = {}; rows_('CostElements').forEach(function (e) { if (e.CompanyID === co) elN[e.ElemID] = e; });
  rows_('CostLedger').forEach(function (r) {
    if (r.CompanyID !== co || tr_(r.VID) !== '' || String(r.Period) > P) return;
    var c = ctrAll[r.ContractID]; if (!c) return;
    var amt = cs5_money_(r.Amount), isStock = r.SrcType === 'stockissue';
    trfRows.push(r.CLID);
    if (!doTrf) return;
    var dKey = r.Treat === 'product' ? 'cs_wip' : (r.Treat === 'asset' ? 'cs_asset' : (isStock ? 'cs_period' : ''));
    if (!dKey) { noPost++; noPostAmt += amt; return; }
    var cKey = 'cs_abs', pid = '';
    if (isStock) {
      var is = iss[r.SrcID], rt = is ? (is.Kind === 'issue' ? is : iss[is.RefIssueID]) : null, p0 = is ? is.ProductID : '';
      if (p0 && prod[p0]) { cKey = cls[p0]; pid = p0; } else warnings.push('ردیف هزینه‌ی مصرف مواد (قرارداد ' + c.No + ', ' + (r.Description || r.SrcID) + '): کالای حواله پیدا نشد؛ طرف بستانکار «هزینه‌های جذب‌شده» شد.');
    }
    var k = r.ContractID + '|' + dKey + '|' + cKey + '|' + pid, g = groups[k] || (groups[k] = {c: c, dKey: dKey, cKey: cKey, pid: pid, amt: 0, n: 0});
    g.amt += amt; g.n++;
  });
  Object.keys(groups).sort().forEach(function (k) {
    var g = groups[k]; if (!g.amt) return;
    var label = {cs_wip: 'هزینه‌های در جریان اجرا', cs_asset: 'هزینه‌های کسب/ایفای قرارداد (دارایی)', cs_period: 'هزینه‌ی دوره‌ی قرارداد'}[g.dKey];
    pair('trf', g.dKey, g.cKey, g.amt, 'انتقال هزینه‌ی قرارداد ' + g.c.No + ' به ' + label + ' (' + g.n + ' ردیف دفتر هزینه)', g.c, g.pid);
  });
  if (!doTrf && trfRows.length) warnings.push('انتقال هزینه در تنظیمات خاموش است؛ ' + trfRows.length + ' ردیف دفتر هزینه فقط علامت‌گذاری می‌شود و سندی ندارد.');
  if (noPost) warnings.push(noPost + ' ردیف «هزینه‌ی دوره» (جمع ' + noPostAmt + ' ریال) پیش‌تر در حساب‌های طبیعی هزینه ثبت شده و سند جدید ندارد.');
  plan.trfRows = trfRows; plan.noPost = noPost;
  var titles = {rev: 'شناسایی درآمد قراردادهای خدماتی', bill: 'صورت‌وضعیت‌های کارفرما (قراردادهای خدماتی)', cos: 'بهای تمام‌شده خدمات ارائه‌شده', trf: 'انتقال هزینه‌های قراردادها به حساب‌های بهای قرارداد', prov: 'ذخیره‌ی قراردادهای زیان‌ده'};
  CS6_ORDER.forEach(function (k) {
    var ls = V[k]; if (!ls.length) return;
    var D = 0, C = 0; ls.forEach(function (l) { D += l.dr; C += l.cr; l.code = (info[l.key] || {}).code || ''; l.name = (info[l.key] || {}).name || l.key; });
    plan.vouchers.push({kind: k, title: titles[k] + ' — دوره ' + P + ' [بهای خدمات]', lines: ls, D: D, C: C, balanced: D === C});
  });
  plan.empty = !plan.vouchers.length && !plan.trfRows.length && !plan.billRows.length;
  plan.totals = {vouchers: plan.vouchers.length, D: plan.vouchers.reduce(function (s, v) { return s + v.D; }, 0), rows: plan.trfRows.length + plan.billRows.length};
  var Pend = cs5_pEndG_(P); plan.dateG = Pend; plan.dateJ = Pend ? g2jStr_(Pend) : '';
  plan.accounts = {}; ['cs_unbilled', 'sales_svc', 'ar', 'vat_out', 'cs_cogs', 'cs_wip', 'cs_asset', 'cs_abs', 'cs_period', 'cs_loss_exp', 'cs_loss_prov'].forEach(function (k) { plan.accounts[k] = info[k] || {code: '', name: k}; });
  plan.notes = CS6_NOTES;
  plan.disclaimer = 'اسناد «پیش‌نویس» و کمکی‌اند؛ قواعد و حساب‌ها نیازمند تأیید حسابدار/حسابرس رسمی است.';
  return plan;
}
function csPostPreview_(p) {
  var co = cs_co_(p), P = cs6_per_(p); ac_open_(co); cs_seed_(co);
  var pl = cs6_plan_(co, P); pl.canRun = !pl.empty && (!pl.lastRun || pl.lastRun.Period <= P) && pl.vouchers.every(function (v) { return v.balanced; });
  if (pl.lastRun && pl.lastRun.Period > P) pl.why = 'آخرین صدور برای ماه ' + pl.lastRun.Period + ' است؛ صدور به ترتیب ماه‌هاست (ابتدا آن را برگردانید).';
  else if (pl.empty) pl.why = 'چیزی برای صدور نیست (همه‌ی مبالغ تا این ماه قبلاً صادر شده است).';
  return pl;
}

/* ---------- صدور ---------- */
function csPostRun_(p) {
  var co = cs_co_(p), P = cs6_per_(p); ac_open_(co); cs_seed_(co);
  return locked_(function () {
    ac_ensureSys_(co);
    var pl = cs6_plan_(co, P);
    if (pl.lastRun && pl.lastRun.Period > P) throw new Error('آخرین صدور برای ماه ' + pl.lastRun.Period + ' است؛ صدور به ترتیب ماه‌هاست. ابتدا صدورهای بعدی را برگردانید.');
    if (pl.empty) throw new Error('چیزی برای صدور نیست؛ همه‌ی مبالغ تا ماه ' + P + ' قبلاً صادر شده است.');
    pl.vouchers.forEach(function (v) { if (!v.balanced) throw new Error('سند «' + CS6_KIND[v.kind] + '» تراز نیست (بد ' + v.D + ' / بس ' + v.C + ')؛ صادر نشد.'); });
    var dateG = pl.dateG, dateJ = pl.dateJ; if (!dateG || !dateJ) throw new Error('تاریخ پایان ماه نامعتبر است.');
    fy_gate_(co, dateG, p, 'تاریخ سند');
    var X = ac_xctx_(co), now = nowStr_(), runId = nextIds_('CRN', 1)[0], runs = cs6_runs_(co), seq = (runs.length ? Number(runs[runs.length - 1].Seq) || 0 : 0) + 1;
    var alloc = ac_noAlloc_(co), refs = ac_takeRef_(co, pl.vouchers.length), nrows = 0; pl.vouchers.forEach(function (v) { nrows += v.lines.length; });
    var vids = nextIds_('VCH', pl.vouchers.length), rids = nextIds_('VRW', nrows), k = 0, hs = [], rs = [], vmap = {}, totals = {};
    pl.vouchers.forEach(function (v, i) {
      var rowsV = v.lines.map(function (l) {
        var o = ac_r_(X, l.key, l.dr, l.cr, {desc: l.desc, dk: l.productId ? 'product' : '', did: l.productId, pt: l.partyId ? 'customer' : '', pid: l.partyId});
        o.ProjID = l.projId || ''; return o;
      });
      var D = 0, C = 0; rowsV.forEach(function (r) { D += r.Debit; C += r.Credit; });
      hs.push(pr_arr_('Vouchers', {VID: vids[i], CompanyID: co, No: alloc(dateG), RefNo: refs[i], Ref: '', DateJalali: dateJ, DateGregorian: dateG, Time: '', Description: v.title, Status: 'draft', Source: 'manual', SrcType: 'cs6', SrcID: runId + ':' + v.kind, ProjID: '', TotalDebit: D, TotalCredit: C, CreatedAt: now, UpdatedAt: now}));
      rowsV.forEach(function (r, j) { rs.push(pr_arr_('VoucherRows', {VRID: rids[k++], VID: vids[i], CompanyID: co, LineNo: j + 1, AccID: r.AccID, DetKind: r.DetKind, DetID: r.DetID, PartyType: r.PartyType, PartyID: r.PartyID, ProjID: r.ProjID, Description: r.Description, Debit: r.Debit > 0 ? r.Debit : '', Credit: r.Credit > 0 ? r.Credit : '', AtfDate: '', AtfTxt: '', AtfNum: ''})); });
      vmap[v.kind] = vids[i]; totals[v.kind] = D;
    });
    if (hs.length) { appendRows_(sh_('Vouchers'), hs); appendRows_(sh_('VoucherRows'), rs); }
    var postRows = [], needP = 0; pl.contracts.forEach(function (c) { c.items.forEach(function (it) { if (it.delta) needP++; }); });
    var pids = needP ? nextIds_('CPS', needP) : [], pk = 0;
    pl.contracts.forEach(function (c) {
      c.items.forEach(function (it) {
        if (!it.delta) return;
        postRows.push(pr_arr_('CostPosts', {PostID: pids[pk++], CompanyID: co, RunID: runId, ContractID: c.ContractID, Kind: it.kind, Amount: it.delta, Detail: JSON.stringify({target: it.target, posted: it.posted, label: it.label}), CreatedAt: now}));
      });
    });
    if (postRows.length) appendRows_(sh_('CostPosts'), postRows);
    var markB = {}; pl.billRows.forEach(function (id) { markB[id] = 1; });
    rows_('ContractBills').forEach(function (b) { if (markB[b.BLID]) { b.VID = runId; pr_setRow_('ContractBills', 'BLID', b.BLID, b); } });
    var mark = {}; pl.trfRows.forEach(function (id) { mark[id] = 1; });
    rows_('CostLedger').forEach(function (r) { if (mark[r.CLID]) { r.VID = runId; pr_setRow_('CostLedger', 'CLID', r.CLID, r); } });
    appendRows_(sh_('CostRuns'), [pr_arr_('CostRuns', {RunID: runId, CompanyID: co, Period: P, Seq: seq, DateJalali: dateJ, DateGregorian: dateG, Vouchers: JSON.stringify(vmap), Totals: JSON.stringify({vouchers: totals, ledgerRows: pl.trfRows.length, billRows: pl.billRows.length, noPost: pl.noPost}), Notes: '', CreatedAt: now})]);
    bump_();
    return {RunID: runId, Period: P, vouchers: pl.vouchers.map(function (v) { return {kind: v.kind, VID: vmap[v.kind], total: totals[v.kind]}; }), ledgerRows: pl.trfRows.length, billRows: pl.billRows.length, warnings: pl.warnings};
  });
}

/* ---------- برگشت آخرین صدور ---------- */
function csPostUndo_(p) {
  var co = cs_co_(p), id = tr_(p.runId);
  return locked_(function () {
    var runs = cs6_runs_(co), run = runs.filter(function (r) { return r.RunID === id; })[0];
    if (!run) throw new Error('صدور پیدا نشد.');
    if (runs[runs.length - 1].RunID !== run.RunID) throw new Error('فقط «آخرین صدور» قابل برگشت است (ابتدا صدورهای بعد از آن را برگردانید).');
    var vs = rows_('Vouchers').filter(function (v) { return v.CompanyID === co && v.SrcType === 'cs6' && String(v.SrcID).indexOf(run.RunID + ':') === 0; });
    vs.forEach(function (v) { if (v.Status === 'confirmed') throw new Error('سند شماره ' + v.No + ' «تأیید شده» است؛ ابتدا آن را به پیش‌نویس برگردانید.'); });
    vs.forEach(function (v) { fy_gate_(co, v.DateGregorian, p, 'سند'); });
    var dels = {}; vs.forEach(function (v) { dels[v.VID] = 1; });
    if (vs.length) { delWhere_('VoucherRows', 2, function (x) { return dels[x]; }); delWhere_('Vouchers', 1, function (x) { return dels[x]; }); }
    delWhere_('CostPosts', H.CostPosts.indexOf('RunID') + 1, function (x) { return x === run.RunID; });
    rows_('CostLedger').forEach(function (r) { if (r.CompanyID === co && tr_(r.VID) === run.RunID) { r.VID = ''; pr_setRow_('CostLedger', 'CLID', r.CLID, r); } });
    rows_('ContractBills').forEach(function (b) { if (b.CompanyID === co && tr_(b.VID) === run.RunID) { b.VID = ''; pr_setRow_('ContractBills', 'BLID', b.BLID, b); } });
    delWhere_('CostRuns', 1, function (x) { return x === run.RunID; });
    bump_();
    return {undone: run.RunID, vouchers: vs.length};
  });
}

/* ---------- فهرست صدورها ---------- */
function csPostList_(p) {
  var co = cs_co_(p), runs = cs6_runs_(co), vch = {};
  rows_('Vouchers').forEach(function (v) { if (v.CompanyID === co && v.SrcType === 'cs6') vch[v.SrcID] = v; });
  var ctr = {}; rows_('Contracts').forEach(function (c) { if (c.CompanyID === co) ctr[c.ContractID] = c; });
  var posts = {}; rows_('CostPosts').forEach(function (r) { if (r.CompanyID === co) posts[r.RunID] = (posts[r.RunID] || 0) + 1; });
  var out = runs.map(function (r, i) {
    var map = {}; try { map = JSON.parse(r.Vouchers || '{}'); } catch (e) {}
    var vs = CS6_ORDER.filter(function (k) { return map[k]; }).map(function (k) {
      var v = vch[r.RunID + ':' + k]; return {kind: k, label: CS6_KIND[k], VID: map[k], exists: !!v, No: v ? String(v.No) : '', Status: v ? v.Status : 'missing', Total: v ? Number(v.TotalDebit) || 0 : 0};
    });
    var last = i === runs.length - 1;
    return {RunID: r.RunID, Period: String(r.Period), Seq: Number(r.Seq), DateJalali: r.DateJalali, CreatedAt: r.CreatedAt, vouchers: vs, posts: posts[r.RunID] || 0,
      canUndo: last && vs.every(function (v) { return v.Status !== 'confirmed'; }), isLast: last, confirmed: vs.filter(function (v) { return v.Status === 'confirmed'; }).length, drafts: vs.filter(function (v) { return v.Status === 'draft'; }).length, missing: vs.filter(function (v) { return !v.exists; }).length};
  });
  out.reverse();
  return {rows: out};
}

/* ---------- گزارش جامع دوره ---------- */
function csRep6_(p) {
  var co = cs_co_(p), P = cs6_per_(p); cs_seed_(co);
  var prog = csProg_({company: co, period: P}), posted = cs6_posted_(co), info = cs6_accInfo_(co);
  var billed = {}, billedPend = {};
  rows_('ContractBills').forEach(function (b) { if (b.CompanyID !== co || String(b.Period) > P) return; billed[b.ContractID] = (billed[b.ContractID] || 0) + cs5_money_(b.Amount); if (tr_(b.VID) === '') billedPend[b.ContractID] = (billedPend[b.ContractID] || 0) + cs5_money_(b.Amount); });
  var rows = prog.rows.map(function (r) {
    var po = function (k) { return posted[r.ContractID + '|' + k] || 0; };
    var pRev = po('rev'), pCos = po('cos_prod') + po('cos_asset'), pPrv = po('prov');
    return {ContractID: r.ContractID, No: r.No, Title: r.Title, Status: r.Status, ProgMethod: r.ProgMethod, computable: r.computable, why: r.computable ? '' : (CS5_WHY[r.why] || ''), progressPct: r.progressPct, Amount: r.Amount,
      revCum: r.revCum, rev: r.rev, costCum: r.costCum, cost: r.cost, gpCum: r.gpCum, gp: r.gp, wipBalance: Math.max(0, r.comps.product - r.comps.productRecognised), assetBalance: Math.max(0, (r.assetBalance === undefined ? (r.comps.acqIncurred + r.comps.fulIncurred - r.comps.acqRecognised - r.comps.fulRecognised) : r.assetBalance)),
      loss: r.loss, lossLower: r.lossLower, provision: r.provision, expectedMargin: r.expectedMargin, BaseAmount: r.BaseAmount, amendTotal: r.amendTotal,
      billed: billed[r.ContractID] || 0, billedPending: billedPend[r.ContractID] || 0, unbilled: Math.max(0, r.revCum - (billed[r.ContractID] || 0)), contractLiab: Math.max(0, (billed[r.ContractID] || 0) - r.revCum),
      posted: {rev: pRev, cost: pCos, prov: pPrv}, pending: {rev: r.computable ? r.revCum - pRev : null, cost: r.computable ? r.costCum - pCos : null, prov: r.computable ? r.provision - pPrv : null}};
  });
  var T = {billed: 0, unbilled: 0, liab: 0, amount: 0, revCum: 0, rev: 0, costCum: 0, cost: 0, gpCum: 0, gp: 0, wip: 0, asset: 0, loss: 0, provision: 0, pRev: 0, pCost: 0, pProv: 0};
  rows.forEach(function (r) { T.billed += r.billed; T.unbilled += r.unbilled; T.liab += r.contractLiab; T.amount += r.Amount; T.revCum += r.revCum; T.rev += r.rev; T.costCum += r.costCum; T.cost += r.cost; T.gpCum += r.gpCum; T.gp += r.gp; T.wip += r.wipBalance; T.asset += r.assetBalance; T.loss += r.loss; T.provision += r.provision; T.pRev += r.posted.rev; T.pCost += r.posted.cost; T.pProv += r.posted.prov; });
  /* هزینه‌های دوره‌ای (خارج از بها) به تفکیک عنصر */
  var el = {}; rows_('CostElements').forEach(function (e) { if (e.CompanyID === co) el[e.ElemID] = e; });
  var pc = {}; rows_('CostLedger').forEach(function (r) {
    if (r.CompanyID !== co || r.Treat !== 'period' || String(r.Period) > P) return;
    var e = el[r.ElemID] || {}, k = String(e.Code || r.ElemID), o = pc[k] || (pc[k] = {Code: String(e.Code || ''), Name: e.Name || '', period: 0, cum: 0});
    var a = cs5_money_(r.Amount); o.cum += a; if (String(r.Period) === P) o.period += a;
  });
  var periodCosts = Object.keys(pc).sort().map(function (k) { return pc[k]; });
  var overhead = null;
  try {
    var oh = cs_ohCalc_(co, P);
    overhead = {policy: cs_rule_(co, 'oh_variance_policy'), unusedOn: oh.unusedOn, totals: oh.totals, warnings: oh.warnings, pools: oh.pools.map(function (x) { return {Code: x.Code, Name: x.Name, Kind: x.Kind, Absorbed: x.Absorbed, Actual: x.ActualFixed + x.ActualVar, Variance: x.Variance, VolumeVar: x.VolumeVar, SpendingVar: x.SpendingVar, Unused: x.Unused, hasActual: x.hasActual}; })};
  } catch (e) { overhead = {error: String(e.message || e)}; }
  /* وضعیت صدورها و کنترل‌ها */
  var runs = csPostList_({company: co}).rows, unposted = 0, unpostedAmt = 0, draftN = 0;
  rows_('CostLedger').forEach(function (r) { if (r.CompanyID === co && tr_(r.VID) === '' && String(r.Period) <= P) { unposted++; unpostedAmt += cs5_money_(r.Amount); } });
  runs.forEach(function (r) { draftN += r.drafts; });
  var checks = [];
  var pend = rows.filter(function (r) { return r.computable && (r.pending.rev !== 0 || r.pending.cost !== 0 || r.pending.prov !== 0); }).length;
  checks.push({ok: pend === 0, text: pend === 0 ? 'همه‌ی درآمد، بها و ذخیره‌ی قراردادهای قابل‌محاسبه تا این ماه صادر شده است.' : pend + ' قرارداد هنوز مبلغ صادرنشده دارد (صدور ماه ' + P + ' را انجام دهید).'});
  checks.push({ok: unposted === 0, text: unposted === 0 ? 'همه‌ی ردیف‌های دفتر هزینه تا این ماه در یک صدور آمده‌اند.' : unposted + ' ردیف دفتر هزینه (جمع ' + unpostedAmt + ' ریال) هنوز در صدوری نیامده است.'});
  var bad = 0; runs.forEach(function (r) { r.vouchers.forEach(function (v) { if (!v.exists) bad++; }); });
  checks.push({ok: bad === 0, text: bad === 0 ? 'همه‌ی اسناد صدورها موجودند.' : bad + ' سند از صدورها حذف شده است؛ آخرین صدور را برگردانید و دوباره صادر کنید.'});
  checks.push({ok: draftN === 0, text: draftN === 0 ? 'سند پیش‌نویس تأییدنشده‌ای از این بخش نمانده است.' : draftN + ' سند پیش‌نویس هنوز تأیید نشده است (تا تأیید در تراز آزمایشی نمی‌آید مگر «شامل پیش‌نویس» انتخاب شود).', info: true});
  var unB = 0; rows_('ContractBills').forEach(function (b) { if (b.CompanyID === co && tr_(b.VID) === '' && String(b.Period) <= P) unB++; });
  checks.push({ok: unB === 0, text: unB === 0 ? 'همه‌ی صورت‌وضعیت‌های کارفرما تا این ماه در صدوری آمده‌اند.' : unB + ' صورت‌وضعیت کارفرما هنوز در صدوری نیامده است.'});
  var amt = {rev: T.revCum - T.pRev, cost: T.costCum - T.pCost};
  var warnings = prog.warnings.slice(0, 60);
  if (!rows.length) warnings.push('قراردادی با فعالیت تا این ماه پیدا نشد.');
  return {period: P, rows: rows, totals: T, periodCosts: periodCosts, overhead: overhead, runs: runs.slice(0, 12), checks: checks, warnings: warnings, counts: prog.counts, accounts: info, pending: amt,
    disclaimer: 'گزارش کمکی است؛ مبناها نیازمند تأیید حسابدار/حسابرس رسمی است و رأی قطعی مالیاتی یا حسابرسی نیست.'};
}

/* ---------- فهرست جامع موارد «نیازمند تأیید» ---------- */
function csVerify6_(p) {
  var co = cs_co_(p); ac_open_(co); cs_seed_(co);
  var items = [], by = function (s) { return rows_(s).filter(function (r) { return r.CompanyID === co; }); };
  by('CostRules').forEach(function (r) {
    if (!cs_b_(r.Verify, false)) return;
    var val = r.Value; if (r.Kind === 'bool') val = cs_b_(r.Value, false) ? 'بله' : 'خیر';
    else if (r.Kind === 'choice') { var o = String(r.Opts || '').split('|').filter(function (x) { return x.slice(0, x.indexOf(':')) === String(r.Value); })[0]; if (o) val = o.slice(o.indexOf(':') + 1); }
    items.push({type: 'قاعده', code: r.Key, title: r.Label, value: String(val), source: r.Src || ''});
  });
  by('CostElements').forEach(function (r) { if (cs_b_(r.Verify, false)) items.push({type: 'عنصر هزینه', code: String(r.Code), title: r.Name + ' (' + (CS_GRP[r.Grp] || r.Grp) + ' — ' + (CS_TREAT[r.Treat] || r.Treat) + ')', value: cs_b_(r.IsActive, true) ? 'فعال' : 'غیرفعال', source: r.Src || ''}); });
  by('AllocBases').forEach(function (r) { if (cs_b_(r.Verify, false)) items.push({type: 'مبنای تسهیم', code: String(r.Code), title: r.Name, value: cs_b_(r.IsActive, true) ? 'فعال' : 'غیرفعال', source: r.Src || ''}); });
  CS6_NOTES.forEach(function (t, i) { items.push({type: 'مبنای صدور سند', code: 'S6-' + (i + 1), title: t, value: '', source: 'مرحله ۶'}); });
  var ctr = by('Contracts').filter(function (c) { return c.Status !== 'cancel'; }).length;
  return {items: items, counts: {rules: items.filter(function (x) { return x.type === 'قاعده'; }).length, elems: items.filter(function (x) { return x.type === 'عنصر هزینه'; }).length, bases: items.filter(function (x) { return x.type === 'مبنای تسهیم'; }).length, notes: CS6_NOTES.length}, contracts: ctr,
    disclaimer: 'هیچ نرخ، ضریب یا قاعده‌ای در این سیستم «قطعی» فرض نشده است؛ فهرست بالا باید پیش از بهره‌برداری رسمی توسط حسابدار/حسابرس رسمی با آخرین قوانین، استانداردها و بخشنامه‌های سال مربوط تطبیق و امضا شود.'};
}

/* ---------- قفل ردیف‌های صادرشده (برای حذف/ویرایش) ---------- */
function cs6_rowLocked_(r) { return !!r && tr_(r.VID) !== '' && /^CRN-/.test(String(r.VID)); }

/* ---------- الحاقیه‌ی قرارداد (افزایش/کاهش مبلغ) ---------- */
function cs6_signedInt_(x, what) {
  var t = fa2en_(String(x == null ? '' : x)).replace(/[,\s٬]/g, ''), neg = false;
  if (t.charAt(0) === '-') { neg = true; t = t.slice(1); } else if (t.charAt(0) === '+') t = t.slice(1);
  var v = cs_int_(t, what); if (!v) throw new Error(what + ' نمی‌تواند صفر باشد.');
  return neg ? -v : v;
}
CS_EXT.amend = {
  list: function (p, co) {
    var ctr = {}; rows_('Contracts').forEach(function (r) { if (r.CompanyID === co) ctr[r.ContractID] = r; });
    var out = rows_('ContractAmend').filter(function (r) { return r.CompanyID === co && (!tr_(p.contract) || r.ContractID === p.contract); }).map(function (r) { var o = Object.assign({}, r); o.ContractNo = String((ctr[r.ContractID] || {}).No || ''); o.Delta = cs5_money_(r.Delta); return o; });
    out.sort(function (a, b) { return a.DateGregorian < b.DateGregorian ? -1 : (a.DateGregorian > b.DateGregorian ? 1 : (a.AMID < b.AMID ? -1 : 1)); });
    var tot = {}; out.forEach(function (r) { tot[r.ContractID] = (tot[r.ContractID] || 0) + r.Delta; });
    return {rows: out, totals: tot, contracts: Object.keys(ctr).map(function (k) { return {ContractID: k, No: String(ctr[k].No), Title: ctr[k].Title, BaseAmount: cs5_money_(ctr[k].Amount), amend: tot[k] || 0, Effective: cs5_money_(ctr[k].Amount) + (tot[k] || 0)}; })};
  },
  save: function (p, co) {
    var o = p.obj || {}, ctr = cs5_ownContract_(co, o.ContractID), old = null;
    if (o.AMID) { old = rows_('ContractAmend').filter(function (r) { return r.CompanyID === co && r.AMID === o.AMID; })[0]; if (!old) throw new Error('الحاقیه پیدا نشد.'); }
    if (ctr.Status === 'cancel') throw new Error('برای قرارداد لغوشده الحاقیه ثبت نمی‌شود.');
    var d = cs_date_(o.DateJalali, 'تاریخ اثر الحاقیه'), delta = cs6_signedInt_(o.Delta, 'مبلغ تغییر');
    var tot = 0; rows_('ContractAmend').forEach(function (r) { if (r.CompanyID === co && r.ContractID === ctr.ContractID && (!old || r.AMID !== old.AMID)) tot += cs5_money_(r.Delta); });
    if (cs5_money_(ctr.Amount) + tot + delta <= 0) throw new Error('با این الحاقیه مبلغ قرارداد صفر یا منفی می‌شود (مبلغ فعلی با الحاقیه‌ها: ' + (cs5_money_(ctr.Amount) + tot) + ').');
    var now = nowStr_(), id = old ? old.AMID : nextIds_('AMD', 1)[0];
    pr_setRow_('ContractAmend', 'AMID', id, {AMID: id, CompanyID: co, ContractID: ctr.ContractID, DateJalali: d.j, DateGregorian: d.g, Period: d.j.slice(0, 7), Delta: delta, Notes: tr_(o.Notes), CreatedAt: old ? old.CreatedAt : now, UpdatedAt: now});
    bump_(); return {AMID: id};
  },
  del: function (p, co) {
    var r = cs_own_('ContractAmend', 'AMID', p.id, co, 'الحاقیه'), ctr = cs5_ownContract_(co, r.ContractID), tot = 0;
    rows_('ContractAmend').forEach(function (x) { if (x.CompanyID === co && x.ContractID === r.ContractID && x.AMID !== r.AMID) tot += cs5_money_(x.Delta); });
    if (cs5_money_(ctr.Amount) + tot <= 0) throw new Error('با حذف این الحاقیه مبلغ قرارداد صفر یا منفی می‌شود.');
    delWhere_('ContractAmend', 1, function (v) { return v === r.AMID; }); bump_(); return {deleted: 1};
  }
};

/* ---------- صورت‌وضعیت کارفرما ---------- */
CS_EXT.bill = {
  list: function (p, co) {
    var ctr = {}; rows_('Contracts').forEach(function (r) { if (r.CompanyID === co) ctr[r.ContractID] = r; });
    var out = rows_('ContractBills').filter(function (r) { return r.CompanyID === co && (!tr_(p.contract) || r.ContractID === p.contract); }).map(function (r) { var o = Object.assign({}, r); o.ContractNo = String((ctr[r.ContractID] || {}).No || ''); o.No = String(r.No); o.Amount = cs5_money_(r.Amount); o.Vat = cs5_money_(r.Vat); o.Posted = tr_(r.VID) !== ''; return o; });
    out.sort(function (a, b) { return a.DateGregorian < b.DateGregorian ? -1 : (a.DateGregorian > b.DateGregorian ? 1 : (a.BLID < b.BLID ? -1 : 1)); });
    var tot = {a: 0, v: 0}; out.forEach(function (r) { tot.a += r.Amount; tot.v += r.Vat; });
    return {rows: out, totals: tot};
  },
  save: function (p, co) {
    var o = p.obj || {}, ctr = cs5_ownContract_(co, o.ContractID), old = null;
    if (o.BLID) { old = rows_('ContractBills').filter(function (r) { return r.CompanyID === co && r.BLID === o.BLID; })[0]; if (!old) throw new Error('صورت‌وضعیت پیدا نشد.'); if (tr_(old.VID) !== '') throw new Error('این صورت‌وضعیت در یک «صدور سند» آمده است؛ برای ویرایش ابتدا آخرین صدور را برگردانید.'); }
    if (ctr.Status === 'cancel') throw new Error('برای قرارداد لغوشده صورت‌وضعیت ثبت نمی‌شود.');
    var d = cs_date_(o.DateJalali, 'تاریخ صورت‌وضعیت'); fy_gate_(co, d.g, p, 'تاریخ صورت‌وضعیت');
    var amt = cs_int_(o.Amount, 'مبلغ صورت‌وضعیت (بدون ارزش افزوده)'); if (!(amt > 0)) throw new Error('مبلغ صورت‌وضعیت باید بیشتر از صفر باشد.');
    var vat = cs_int_(o.Vat, 'ارزش افزوده', true), no = tr_(fa2en_(o.No));
    if (!no) no = cs_nextNo_(co, 'ContractBills');
    if (rows_('ContractBills').some(function (r) { return r.CompanyID === co && r.ContractID === ctr.ContractID && String(r.No) === no && (!old || r.BLID !== old.BLID); })) throw new Error('شماره‌ی صورت‌وضعیت «' + no + '» برای این قرارداد قبلاً ثبت شده است.');
    var now = nowStr_(), id = old ? old.BLID : nextIds_('BIL', 1)[0];
    pr_setRow_('ContractBills', 'BLID', id, {BLID: id, CompanyID: co, ContractID: ctr.ContractID, No: no, DateJalali: d.j, DateGregorian: d.g, Period: d.j.slice(0, 7), Amount: amt, Vat: vat, Notes: tr_(o.Notes), VID: '', CreatedAt: old ? old.CreatedAt : now, UpdatedAt: now});
    bump_(); return {BLID: id, No: no};
  },
  del: function (p, co) {
    var r = cs_own_('ContractBills', 'BLID', p.id, co, 'صورت‌وضعیت');
    if (tr_(r.VID) !== '') throw new Error('این صورت‌وضعیت در یک «صدور سند» آمده است؛ برای حذف ابتدا آخرین صدور را برگردانید.');
    fy_gate_(co, r.DateGregorian, p, 'تاریخ صورت‌وضعیت');
    delWhere_('ContractBills', 1, function (v) { return v === r.BLID; }); bump_(); return {deleted: 1};
  }
};
