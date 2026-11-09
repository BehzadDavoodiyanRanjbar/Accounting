/* ===================================================================
   ماژول «بهای تمام‌شده خدمات» — مرحله ۱: مدل داده، پیکربندی، دفتر هزینه قرارداد
   - شیء هزینه: «قرارداد» (Contracts) که به «پروژه» (Projects) و خریدار (Customers) وصل است.
   - هر هزینه یک ردیف در «دفتر هزینه قرارداد» (CostLedger) است: قرارداد + عنصر هزینه + دوره + سند مبنا
     + «فرمول و ورودی‌ها» (Audit Trail).
   - هیچ نرخ، درصد یا قاعده‌ی حسابداری در کد ثابت نیست؛ همه در جدول‌های پیکربندی (عناصر هزینه،
     قواعد، مبناهای تسهیم) با برچسب «منبع» و «نیازمند تأیید» نگه‌داری می‌شوند.
   - پول: ریال صحیح (بدون اعشار). ضرب مقدار × نرخ با محاسبه‌ی دقیق عدد صحیح (BigInt) و گرد کردن
     «نیم به بالا» (قدر مطلق) انجام می‌شود؛ هیچ محاسبه‌ی پولی با float گرد نشده‌ای ذخیره نمی‌شود.
   =================================================================== */
var CS_EXT = {};
var CS_KINDS = {
  contract: {sheet: 'Contracts', key: 'ContractID', pf: 'CTR', t: 'قرارداد'},
  cc: {sheet: 'CostContracts', key: 'CCID', pf: 'CCT', t: 'قرارداد هزینه‌ای'},
  machine: {sheet: 'Machines', key: 'MachID', pf: 'MCH', t: 'ماشین‌آلات'},
  elem: {sheet: 'CostElements', key: 'ElemID', pf: 'CEL', t: 'عنصر هزینه'},
  base: {sheet: 'AllocBases', key: 'BaseID', pf: 'ABS', t: 'مبنای تسهیم'},
  ledger: {sheet: 'CostLedger', key: 'CLID', pf: 'CLG', t: 'ردیف هزینه'}
};
H.Contracts = ['ContractID', 'CompanyID', 'ProjID', 'No', 'Title', 'CustomerID', 'StartJ', 'StartG', 'EndJ', 'EndG', 'Amount', 'ProgMethod', 'ValMethod', 'MobAlloc', 'UnitName', 'UnitQty', 'GaClaim', 'Status', 'Notes', 'CreatedAt', 'UpdatedAt'];
H.CostContracts = ['CCID', 'CompanyID', 'ContractID', 'Kind', 'No', 'Title', 'SupplierID', 'StartJ', 'StartG', 'EndJ', 'EndG', 'Amount', 'AdvPct', 'RetPct', 'Deductions', 'RateUnit', 'Rate', 'Operator', 'FuelBy', 'MachID', 'Status', 'Notes', 'CreatedAt', 'UpdatedAt'];
H.Machines = ['MachID', 'CompanyID', 'Code', 'Name', 'Own', 'AssetAccID', 'AccumAccID', 'Cost', 'Salvage', 'LifeYears', 'DeprMethod', 'EstHours', 'InServiceJ', 'InServiceG', 'IsActive', 'Notes', 'CreatedAt', 'UpdatedAt'];
H.CostElements = ['ElemID', 'CompanyID', 'Code', 'Name', 'Grp', 'Treat', 'AccKey', 'IsActive', 'IsSystem', 'Src', 'Verify', 'Notes', 'CreatedAt', 'UpdatedAt'];
H.CostRules = ['RuleID', 'CompanyID', 'Key', 'Label', 'Value', 'Kind', 'Opts', 'Src', 'Verify', 'Locked', 'Notes', 'UpdatedAt'];
H.AllocBases = ['BaseID', 'CompanyID', 'Code', 'Name', 'IsActive', 'IsSystem', 'Src', 'Verify', 'Notes', 'CreatedAt', 'UpdatedAt'];
H.CostLedger = ['CLID', 'CompanyID', 'ContractID', 'ElemID', 'DateJalali', 'DateGregorian', 'Period', 'Qty', 'Rate', 'Amount', 'Treat', 'Abnormal', 'SrcType', 'SrcID', 'Formula', 'Inputs', 'Description', 'VID', 'CreatedAt', 'UpdatedAt'];

var CS_PROG = {cost: 'هزینه‌به‌هزینه (درون‌داد)', hours: 'ساعت کار (درون‌داد)', milestone: 'مراحل / نقاط عطف (برون‌داد)', time: 'گذشت زمان'};
var CS_VAL = {avg: 'میانگین موزون', fifo: 'اولین وارده اولین صادره (FIFO)', specific: 'شناسایی ویژه'};
var CS_MOB = {straight_line: 'تسهیم خط مستقیم طی دوره قرارداد', progress: 'تسهیم بر پایه درصد پیشرفت', manual: 'دستی'};
var CS_CST = {draft: 'پیش‌نویس', active: 'فعال', done: 'تکمیل‌شده', cancel: 'لغو'};
var CS_GRP = {material: 'مواد و مصالح', labor: 'دستمزد', machine: 'ماشین‌آلات و تجهیزات', subcontract: 'پیمانکاران دست‌دوم', site: 'هزینه‌های مستقیم کارگاه', overhead: 'سربار', acq: 'هزینه‌های کسب قرارداد', fulfil: 'هزینه‌های ایفای قرارداد', period: 'هزینه‌های دوره (مستثنیات)'};
var CS_TREAT = {product: 'جزو بهای خدمات', asset: 'دارایی (هزینه قرارداد)', period: 'هزینه دوره'};
var CS_DEPR = {sl: 'خط مستقیم', db: 'نزولی', hours: 'بر مبنای ساعت کارکرد'};
var CS_RATEU = {hour: 'ساعتی', day: 'روزانه', month: 'ماهانه'};
var CS_SRC = {manual: 'سند دستی (شماره یا توضیح مرجع)', purchase: 'فاکتور خرید', expense: 'فاکتور هزینه', voucher: 'سند حسابداری', stockissue: 'حواله مصرف', timesheet: 'برگه ساعت کار', machinelog: 'برگه کارکرد ماشین', statement: 'صورت‌وضعیت پیمانکار', alloc: 'تسهیم سربار / تجهیز کارگاه'};
var CS_MANUAL_SRC = ['manual', 'purchase', 'expense', 'voucher'];

/* ---------- حساب دقیق پول (ریال صحیح) و مقدار ---------- */
function cs_dec_(x, what) {
  var s = fa2en_(String(x == null ? '' : x)).replace(/[,\s٬]/g, '').replace(/٫/g, '.');
  var m = /^([+-]?)(\d*)(?:\.(\d+))?$/.exec(s);
  if (!s || !m || (!m[2] && !m[3])) throw new Error((what || 'مقدار') + ' نامعتبر است.');
  var fr = m[3] || '', ip = m[2] || '0';
  if (fr.length > 6) throw new Error((what || 'مقدار') + ': حداکثر ۶ رقم اعشار مجاز است.');
  var n = BigInt(ip + fr);
  return {n: m[1] === '-' ? -n : n, s: fr.length};
}
function cs_pow10_(k) { var r = BigInt(1); for (var i = 0; i < k; i++) r = r * BigInt(10); return r; }
function cs_toNum_(d) { return Number(d.n) / Number(cs_pow10_(d.s)); }
/* گرد کردن نیم به بالا (قدر مطلق) یک کسر n/den به عدد صحیح */
function cs_roundDiv_(n, den) {
  var neg = n < BigInt(0); if (neg) n = -n;
  var q = (n * BigInt(2) + den) / (den * BigInt(2));
  return neg ? -q : q;
}
/* ضرب دقیق a×b و گرد به ریال صحیح */
function cs_mulRound_(a, b) {
  var x = cs_dec_(a, 'مقدار'), y = cs_dec_(b, 'نرخ');
  return Number(cs_roundDiv_(x.n * y.n, cs_pow10_(x.s + y.s)));
}
/* تقسیم دقیق a÷b با گرد به ریال صحیح؛ مخرج صفر = خطا */
function cs_divRound_(a, b) {
  var x = cs_dec_(a, 'صورت'), y = cs_dec_(b, 'مخرج');
  if (y.n === BigInt(0)) throw new Error('مخرج (مبنای محاسبه) صفر است.');
  return Number(cs_roundDiv_(x.n * cs_pow10_(y.s), y.n * cs_pow10_(x.s)));
}
function cs_int_(x, what, opt) {
  if (x === undefined || x === null || String(x).trim() === '') { if (opt) return 0; throw new Error(what + ' الزامی است.'); }
  var d = cs_dec_(x, what);
  if (d.s > 0 && d.n % cs_pow10_(d.s) !== BigInt(0)) throw new Error(what + ': مبلغ باید ریال صحیح باشد (بدون اعشار).');
  var v = Number(d.n / cs_pow10_(d.s));
  if (v < 0) throw new Error(what + ' نمی‌تواند منفی باشد.');
  if (v > 9e15) throw new Error(what + ' بیش از حد بزرگ است.');
  return v;
}
function cs_qty_(x, what, opt) {
  if (x === undefined || x === null || String(x).trim() === '') { if (opt) return ''; throw new Error(what + ' الزامی است.'); }
  var d = cs_dec_(x, what); if (d.n < BigInt(0)) throw new Error(what + ' نمی‌تواند منفی باشد.');
  return String(cs_toNum_(d));
}
function cs_pct_(x, what) {
  if (x === undefined || x === null || String(x).trim() === '') return '';
  var d = cs_dec_(x, what), v = cs_toNum_(d);
  if (v < 0 || v > 100) throw new Error(what + ' باید بین ۰ تا ۱۰۰ باشد.');
  return String(v);
}
function cs_co_(p) { if (!p || !p.company) throw new Error('شرکت/مشتری را انتخاب کنید.'); return p.company; }
function cs_b_(x, d) { return ac_b_(x, d); }
function cs_kind_(k) { var d = CS_KINDS[k]; if (!d) throw new Error('نوع نامعتبر است.'); return d; }
function cs_date_(s, what, opt) {
  if (!tr_(s)) { if (opt) return {j: '', g: ''}; throw new Error(what + ' الزامی است.'); }
  var d = parseJ_(s); if (!d) throw new Error(what + ' نامعتبر است (مثال ۱۴۰۵/۰۷/۰۹).');
  return d;
}
function cs_choice_(v, map, what, def) { v = tr_(v) || def || ''; if (!Object.prototype.hasOwnProperty.call(map, v)) throw new Error(what + ' نامعتبر است.'); return v; }
function cs_own_(sheet, key, id, co, what, opt) {
  id = tr_(id); if (!id) { if (opt) return null; throw new Error(what + ' الزامی است.'); }
  var r = rows_(sheet).filter(function (x) { return x[key] === id && x.CompanyID === co; })[0];
  if (!r) throw new Error(what + ' پیدا نشد.');
  return r;
}
function cs_accByKey_(co, key) {
  var r = null; ac_accOf_(co).forEach(function (a) { if (a.SysKey === key && Number(a.Level) === 3) r = a; }); return r;
}

/* ---------- داده‌ی اولیه‌ی پیکربندی (قابل ویرایش توسط کاربر؛ نه ثابت در محاسبات) ---------- */
var CS_SEED_ELEM = [
  ['E01', 'مواد و مصالح مستقیم', 'material', 'product', '', 'مبنای تعریف: عناصر بهای تمام‌شده (استاندارد ۸ — بند [نیازمند تأیید])', 1],
  ['E02', 'دستمزد مستقیم', 'labor', 'product', 'exp_wage', 'برگه ساعت کار و جدول حقوق', 0],
  ['E03', 'سربار نیروی کار (سهم کارفرما، عیدی، سنوات و ...)', 'labor', 'product', '', 'ضریب سربار نیروی کار — پیکربندی', 1],
  ['E04', 'ماشین‌آلات خودی (استهلاک و بهره‌برداری)', 'machine', 'product', 'exp_depr', 'استاندارد ۱۱ — استهلاک (بند [نیازمند تأیید])', 1],
  ['E05', 'اجاره ماشین‌آلات و تجهیزات', 'machine', 'product', 'exp_rent', 'قرارداد هزینه‌ای اجاره', 0],
  ['E06', 'پیمانکار دست‌دوم و برون‌سپاری', 'subcontract', 'product', '', 'صورت‌وضعیت پیمانکار', 0],
  ['E07', 'تجهیز و برچیدن کارگاه', 'site', 'product', '', 'تسهیم طی دوره قرارداد — استاندارد ۴۳ (بند [نیازمند تأیید])', 1],
  ['E08', 'هزینه‌های مستقیم کارگاه و پروژه', 'site', 'product', '', 'فهرست هزینه‌های مستقیم پروژه', 0],
  ['E09', 'ابزار و قطعات مصرفی', 'site', 'product', '', 'مصرف واقعی یا تسهیم بر پایه نرخ', 0],
  ['E10', 'سربار غیرمستقیم جذب‌شده', 'overhead', 'product', '', 'نرخ تسهیم از پیش تعیین‌شده — استاندارد ۸', 1],
  ['E11', 'هزینه‌های کسب قرارداد (افزایشی و قابل‌بازیافت)', 'acq', 'asset', '', 'استاندارد ۴۳ — هزینه‌های کسب قرارداد (بند [نیازمند تأیید])', 1],
  ['E12', 'هزینه‌های ایفای قرارداد (دارایی)', 'fulfil', 'asset', '', 'استاندارد ۴۳ — هزینه‌های ایفای قرارداد (بند [نیازمند تأیید])', 1],
  ['E21', 'ضایعات غیرعادی', 'period', 'period', '', 'مستثنیات بهای تمام‌شده — استاندارد ۸ (بند [نیازمند تأیید])', 1],
  ['E22', 'بیکاری و ظرفیت بلااستفاده', 'period', 'period', '', 'مستثنیات بهای تمام‌شده — استاندارد ۸ (بند [نیازمند تأیید])', 1],
  ['E23', 'هزینه‌های عمومی و اداری ستاد', 'period', 'period', '', 'مستثنیات؛ به‌صورت پیش‌فرض جزو بهای خدمات نیست', 1],
  ['E24', 'هزینه‌های فروش و بازاریابی', 'period', 'period', '', 'مستثنیات بهای تمام‌شده', 0],
  ['E25', 'مخارج تأمین مالی', 'period', 'period', 'fin_exp', 'استاندارد ۱۳ — عموماً جزو بهای خدمات نیست (بند [نیازمند تأیید])', 1],
  ['E26', 'جرایم و خسارات', 'period', 'period', '', 'مستثنیات بهای تمام‌شده', 0]
];
var CS_SEED_RULE = [
  ['vat_in_material_cost', 'مالیات ارزش افزوده خرید (فقط اگر غیرقابل‌استرداد است) به بهای مواد اضافه شود', 'bool', '0', '', 'قانون مالیات بر ارزش افزوده — تطبیق با متن قانون', 1],
  ['abnormal_waste_excluded', 'ضایعات غیرعادی از بها خارج و هزینه دوره شود', 'bool', '1', '', 'استاندارد ۸ — بند [نیازمند تأیید]', 1],
  ['idle_labor_excluded', 'ساعات بیکاری و بلااستفاده نیرو از بهای پروژه خارج شود', 'bool', '1', '', 'استاندارد ۸ — بند [نیازمند تأیید]', 1],
  ['idle_machine_excluded', 'هزینه ساعات خواب ماشین‌آلات به پروژه تخصیص نیابد', 'bool', '1', '', 'استاندارد ۸ و ۱۱ — بند [نیازمند تأیید]', 1],
  ['unused_capacity_excluded', 'سربار ثابت ظرفیت بلااستفاده به بهای پروژه تسهیم نشود', 'bool', '1', '', 'استاندارد ۸ — بند [نیازمند تأیید]', 1],
  ['uninstalled_excluded_from_progress', 'مصالح تحویل‌شده ولی نصب‌نشده از محاسبه پیشرفت هزینه‌به‌هزینه حذف شود', 'bool', '1', '', 'استاندارد ۴۳ — اندازه‌گیری پیشرفت (بند [نیازمند تأیید])', 1],
  ['scrap_sale_treatment', 'فروش ضایعات و اسقاط', 'choice', 'reduce_cost', 'reduce_cost:کاهش بها|other_income:درآمد متفرقه', 'استاندارد ۸ — بند [نیازمند تأیید]', 1],
  ['ga_claimable_default', 'هزینه عمومی و اداری ستاد در قراردادهای قابل‌مطالبه جزو بها باشد (پیش‌فرض قراردادها)', 'bool', '0', '', 'متن قرارداد — بررسی هر قرارداد', 1],
  ['guarantee_fee_class', 'طبقه‌بندی کارمزد ضمانت‌نامه‌های مرتبط با قرارداد', 'choice', 'site', 'site:هزینه مستقیم کارگاه|period:هزینه دوره', 'بند [نیازمند تأیید]', 1],
  ['bid_cost_policy', 'هزینه تهیه پیشنهاد/مناقصه (صرف‌نظر از کسب قرارداد)', 'choice', 'period', 'period:هزینه دوره|claimable:قابل‌مطالبه از مشتری (دارایی)', 'استاندارد ۴۳ — بند [نیازمند تأیید]', 1],
  ['acq_practical_expedient_on', 'معافیت عملی هزینه کسب قرارداد با دوره استهلاک کوتاه (هزینه در زمان وقوع)', 'bool', '0', '', 'استاندارد ۴۳ — بند [نیازمند تأیید]', 1],
  ['acq_practical_expedient_months', 'سقف دوره استهلاک برای معافیت عملی (ماه)', 'num', '12', '', 'استاندارد ۴۳ — آستانه [نیازمند تأیید]', 1],
  ['fulfil_asset_test_on', 'آزمون ۳شرطی تبدیل هزینه ایفای قرارداد به دارایی فعال باشد', 'bool', '1', '', 'استاندارد ۴۳ — بندهای [نیازمند تأیید]', 1],
  ['impairment_test_on', 'آزمون کاهش ارزش دارایی‌های هزینه قرارداد فعال باشد', 'bool', '1', '', 'استاندارد ۴۳ — بند [نیازمند تأیید]', 1],
  ['loss_contract_basis', 'مبنای شناسایی قرارداد زیان‌ده', 'choice', 'total_vs_price', 'total_vs_price:برآورد کل هزینه بیش از مبلغ قرارداد', 'استاندارد ۴۳ و ۱۴۲ — مبنای دقیق [نیازمند تأیید]', 1],
  ['financing_cost_in_cost', 'مخارج تأمین مالی جزو بهای خدمات باشد', 'bool', '0', '', 'استاندارد ۱۳ — [نیازمند تأیید]', 1],
  ['rounding_mode', 'قاعده گرد کردن مبالغ (ثابت سیستم)', 'text', 'نیم به بالا (قدر مطلق) به ریال صحیح', '', 'قاعده ثابت نرم‌افزار؛ قابل‌ویرایش نیست', 0]
];
var CS_SEED_BASE = [
  ['B1', 'ساعت کار مستقیم', ''], ['B2', 'ساعت ماشین', ''], ['B3', 'هزینه دستمزد مستقیم', ''], ['B4', 'هزینه مستقیم کل', '']
];

function cs_seed_(co) {
  var now = nowStr_(), any = function (sheet) { return rows_(sheet).some(function (r) { return r.CompanyID === co; }); };
  if (!any('CostElements')) {
    var ids = nextIds_('CEL', CS_SEED_ELEM.length);
    appendRows_(sh_('CostElements'), CS_SEED_ELEM.map(function (e, i) { return pr_arr_('CostElements', {ElemID: ids[i], CompanyID: co, Code: e[0], Name: e[1], Grp: e[2], Treat: e[3], AccKey: e[4], IsActive: true, IsSystem: true, Src: e[5], Verify: !!e[6], CreatedAt: now, UpdatedAt: now}); }));
  }
  if (!any('CostRules')) {
    var ri = nextIds_('CRL', CS_SEED_RULE.length);
    appendRows_(sh_('CostRules'), CS_SEED_RULE.map(function (e, i) { return pr_arr_('CostRules', {RuleID: ri[i], CompanyID: co, Key: e[0], Label: e[1], Kind: e[2], Value: e[3], Opts: e[4], Src: e[5], Verify: !!e[6], Locked: e[0] === 'rounding_mode', UpdatedAt: now}); }));
  }
  if (!any('AllocBases')) {
    var bi = nextIds_('ABS', CS_SEED_BASE.length);
    appendRows_(sh_('AllocBases'), CS_SEED_BASE.map(function (e, i) { return pr_arr_('AllocBases', {BaseID: bi[i], CompanyID: co, Code: e[0], Name: e[1], IsActive: true, IsSystem: true, Src: 'مبنای تسهیم سربار — استاندارد ۸ (بند [نیازمند تأیید])', Verify: true, CreatedAt: now, UpdatedAt: now}); }));
  }
  if (typeof cs_seed2_ === 'function') cs_seed2_(co);
}
/* مقدار یک «قاعده» برای مراحل بعد (و تست): bool → true/false، num → عدد، سایر → رشته */
function cs_rule_(co, key) {
  var r = rows_('CostRules').filter(function (x) { return x.CompanyID === co && x.Key === key; })[0];
  if (!r) throw new Error('قاعده‌ی «' + key + '» تعریف نشده است.');
  if (r.Kind === 'bool') return cs_b_(r.Value, false);
  if (r.Kind === 'num') return Number(r.Value) || 0;
  return String(r.Value);
}

/* ---------- گزینه‌ها و پیکربندی ---------- */
function csCfgGet_(p) {
  var co = cs_co_(p); ac_open_(co); cs_seed_(co);
  var by = function (sheet) { return rows_(sheet).filter(function (r) { return r.CompanyID === co; }); };
  var els = by('CostElements').map(function (r) { var o = Object.assign({}, r); o.IsActive = cs_b_(r.IsActive, true); o.IsSystem = cs_b_(r.IsSystem, false); o.Verify = cs_b_(r.Verify, false); o.Code = String(r.Code); return o; }).sort(ac_cmpCode_);
  var rules = by('CostRules').map(function (r) { var o = Object.assign({}, r); o.Verify = cs_b_(r.Verify, false); o.Locked = cs_b_(r.Locked, false); o.Opts = r.Opts ? String(r.Opts).split('|').map(function (x) { var i = x.indexOf(':'); return {v: x.slice(0, i), t: x.slice(i + 1)}; }) : []; return o; });
  var bases = by('AllocBases').map(function (r) { var o = Object.assign({}, r); o.IsActive = cs_b_(r.IsActive, true); o.IsSystem = cs_b_(r.IsSystem, false); o.Verify = cs_b_(r.Verify, false); o.Code = String(r.Code); return o; }).sort(ac_cmpCode_);
  var nm = function (sheet, key) { return by(sheet).map(function (r) { return {id: r[key], Name: r.Name, Code: String(r.Code || ''), IsActive: cs_b_(r.IsActive, true)}; }); };
  return {elements: els, rules: rules, bases: bases,
    options: {projects: nm('Projects', 'ProjID'), customers: nm('Customers', 'CustomerID'), suppliers: nm('Suppliers', 'SupplierID'),
      machines: by('Machines').map(function (r) { return {id: r.MachID, Name: r.Name, Own: cs_b_(r.Own, false)}; }),
      contracts: by('Contracts').map(function (r) { return {id: r.ContractID, No: r.No, Title: r.Title, ValMethod: r.ValMethod, Status: r.Status}; }),
      products: by('Products').map(function (r) { return {id: r.ProductID, Name: r.Name, Code: String(r.ProductCode || ''), Unit: r.DefaultUnit}; }),
      employees: by('Employees').map(function (r) { return {id: r.EmpID, Name: r.Name, Code: String(r.Code || '')}; }),
      ohk: typeof CS_OHK !== 'undefined' ? CS_OHK : {}, mht: typeof CS_MHT !== 'undefined' ? CS_MHT : {}, mobk: typeof CS_MOBK !== 'undefined' ? CS_MOBK : {}, ht: typeof CS_HT !== 'undefined' ? CS_HT : {}, ik: typeof CS_IK !== 'undefined' ? CS_IK : {}, isrc: typeof CS_ISRC !== 'undefined' ? CS_ISRC : {}, pmode: typeof CS_PMODE !== 'undefined' ? CS_PMODE : {}, umode: typeof CS_UMODE !== 'undefined' ? CS_UMODE : {}, costContracts: by('CostContracts').map(function (r) { return {id: r.CCID, No: r.No, Title: r.Title, Kind: r.Kind, ContractID: r.ContractID}; }),
      acqt: typeof CS_ACQT !== 'undefined' ? CS_ACQT : {}, prog: CS_PROG, val: CS_VAL, mob: CS_MOB, status: CS_CST, grp: CS_GRP, treat: CS_TREAT, depr: CS_DEPR, rateUnit: CS_RATEU, src: CS_SRC}};
}
function csRuleSave_(p) {
  var co = cs_co_(p), o = p.obj || {};
  return locked_(function () {
    cs_seed_(co);
    var r = cs_own_('CostRules', 'RuleID', o.RuleID, co, 'قاعده');
    if (cs_b_(r.Locked, false)) throw new Error('این قاعده ثابت سیستم است و قابل‌ویرایش نیست.');
    var v = o.Value;
    if (r.Kind === 'bool') v = cs_b_(v, false) ? '1' : '0';
    else if (r.Kind === 'num') { var d = cs_dec_(v, 'مقدار'); if (d.n < BigInt(0)) throw new Error('مقدار نمی‌تواند منفی باشد.'); v = String(cs_toNum_(d)); }
    else if (r.Kind === 'choice') { var ok = String(r.Opts || '').split('|').some(function (x) { return x.slice(0, x.indexOf(':')) === String(v); }); if (!ok) throw new Error('گزینه‌ی انتخاب‌شده نامعتبر است.'); v = String(v); }
    else v = tr_(v);
    r.Value = v; r.UpdatedAt = nowStr_();
    pr_setRow_('CostRules', 'RuleID', r.RuleID, r); bump_();
    return {saved: 1};
  });
}

/* ---------- فهرست ---------- */
function csList_(p) {
  var co = cs_co_(p), k = cs_kind_(p.kind); cs_seed_(co);
  if (CS_EXT[p.kind] && CS_EXT[p.kind].list) return CS_EXT[p.kind].list(p, co);
  var all = rows_(k.sheet).filter(function (r) { return r.CompanyID === co; });
  var proj = {}, cus = {}, sup = {}, ctr = {}, el = {}, mach = {};
  rows_('Projects').forEach(function (r) { if (r.CompanyID === co) proj[r.ProjID] = r.Name; });
  rows_('Customers').forEach(function (r) { if (r.CompanyID === co) cus[r.CustomerID] = r.Name; });
  rows_('Suppliers').forEach(function (r) { if (r.CompanyID === co) sup[r.SupplierID] = r.Name; });
  rows_('Contracts').forEach(function (r) { if (r.CompanyID === co) ctr[r.ContractID] = r; });
  rows_('CostElements').forEach(function (r) { if (r.CompanyID === co) el[r.ElemID] = r; });
  rows_('Machines').forEach(function (r) { if (r.CompanyID === co) mach[r.MachID] = r.Name; });
  var out;
  if (p.kind === 'contract') {
    var led = {}, cc = {};
    rows_('CostLedger').forEach(function (r) { if (r.CompanyID === co) led[r.ContractID] = (led[r.ContractID] || 0) + (Number(r.Amount) || 0); });
    rows_('CostContracts').forEach(function (r) { if (r.CompanyID === co) cc[r.ContractID] = (cc[r.ContractID] || 0) + 1; });
    out = all.map(function (r) { var o = Object.assign({}, r); o.ProjName = proj[r.ProjID] || ''; o.CustomerName = cus[r.CustomerID] || ''; o.CostTotal = led[r.ContractID] || 0; o.CCCount = cc[r.ContractID] || 0; o.GaClaim = cs_b_(r.GaClaim, false); o.No = String(r.No); return o; });
    if (tr_(p.status)) out = out.filter(function (r) { return r.Status === p.status; });
  } else if (p.kind === 'cc') {
    out = all.map(function (r) { var o = Object.assign({}, r); o.SupplierName = sup[r.SupplierID] || ''; o.ContractNo = (ctr[r.ContractID] || {}).No || ''; o.MachName = mach[r.MachID] || ''; o.Operator = cs_b_(r.Operator, false); o.No = String(r.No); return o; });
    if (tr_(p.contract)) out = out.filter(function (r) { return r.ContractID === p.contract; });
  } else if (p.kind === 'machine') {
    out = all.map(function (r) { var o = Object.assign({}, r); o.Own = cs_b_(r.Own, false); o.IsActive = cs_b_(r.IsActive, true); o.Code = String(r.Code); return o; }).sort(ac_cmpCode_);
  } else if (p.kind === 'ledger') {
    out = all.map(function (r) { var o = Object.assign({}, r); o.ElemName = (el[r.ElemID] || {}).Name || ''; o.ContractNo = (ctr[r.ContractID] || {}).No || ''; o.Abnormal = cs_b_(r.Abnormal, false); return o; });
    if (tr_(p.contract)) out = out.filter(function (r) { return r.ContractID === p.contract; });
    if (tr_(p.elem)) out = out.filter(function (r) { return r.ElemID === p.elem; });
    if (tr_(p.from)) { var f = cs_date_(p.from, 'از تاریخ'); out = out.filter(function (r) { return r.DateGregorian >= f.g; }); }
    if (tr_(p.to)) { var t = cs_date_(p.to, 'تا تاریخ'); out = out.filter(function (r) { return r.DateGregorian <= t.g; }); }
    out.sort(function (a, b) { return a.DateGregorian < b.DateGregorian ? -1 : a.DateGregorian > b.DateGregorian ? 1 : (a.CLID < b.CLID ? -1 : 1); });
  } else out = all.slice();
  return {rows: out};
}

/* ---------- ثبت ---------- */
function cs_uniq_(list, field, v, key, id, msg) {
  if (list.some(function (r) { return r[key] !== id && String(r[field]) === String(v); })) throw new Error(msg);
}
function cs_dateRange_(o, sw, ew) {
  var a = cs_date_(o.StartJ, sw, true), b = cs_date_(o.EndJ, ew, true);
  if (a.g && b.g && a.g > b.g) throw new Error('تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.');
  return {a: a, b: b};
}
function cs_vContract_(co, o, old, list) {
  var no = tr_(fa2en_(o.No)); if (!no) throw new Error('شماره قرارداد الزامی است.');
  cs_uniq_(list, 'No', no, 'ContractID', o.ContractID, 'شماره قرارداد تکراری است.');
  var title = tr_(o.Title); if (!title) throw new Error('عنوان قرارداد الزامی است.');
  var pj = cs_own_('Projects', 'ProjID', o.ProjID, co, 'پروژه');
  if (!cs_b_(pj.IsActive, true) && (!old || old.ProjID !== o.ProjID)) throw new Error('پروژه‌ی انتخاب‌شده غیرفعال است.');
  cs_own_('Customers', 'CustomerID', o.CustomerID, co, 'خریدار', true);
  var dr = cs_dateRange_(o, 'تاریخ شروع', 'تاریخ پایان');
  var amount = cs_int_(o.Amount, 'مبلغ قرارداد', true), status = cs_choice_(o.Status, CS_CST, 'وضعیت', 'draft');
  if (status === 'active' && !(amount > 0)) throw new Error('برای قرارداد «فعال»، مبلغ قرارداد لازم است.');
  if (status === 'active' && !dr.a.g) throw new Error('برای قرارداد «فعال»، تاریخ شروع لازم است.');
  var mob = cs_choice_(o.MobAlloc, CS_MOB, 'روش تسهیم تجهیز کارگاه', 'straight_line');
  if (mob === 'straight_line' && status === 'active' && !dr.b.g) throw new Error('برای تسهیم خط مستقیم تجهیز کارگاه، تاریخ پایان قرارداد لازم است.');
  return {ProjID: o.ProjID, No: no, Title: title, CustomerID: tr_(o.CustomerID), StartJ: dr.a.j, StartG: dr.a.g, EndJ: dr.b.j, EndG: dr.b.g, Amount: amount,
    ProgMethod: cs_choice_(o.ProgMethod, CS_PROG, 'روش اندازه‌گیری پیشرفت', 'cost'), ValMethod: cs_choice_(o.ValMethod, CS_VAL, 'روش ارزشیابی مواد', 'avg'), MobAlloc: mob,
    UnitName: tr_(o.UnitName), UnitQty: cs_qty_(o.UnitQty, 'مقدار واحد خدمت', true), GaClaim: o.GaClaim === undefined || o.GaClaim === '' ? cs_rule_(co, 'ga_claimable_default') : cs_b_(o.GaClaim, false), Status: status, Notes: tr_(o.Notes)};
}
function cs_vCC_(co, o, old, list) {
  var kind = cs_choice_(o.Kind, {sub: 1, rent: 1}, 'نوع قرارداد هزینه‌ای'), ctr = cs_own_('Contracts', 'ContractID', o.ContractID, co, 'قرارداد اصلی');
  var no = tr_(fa2en_(o.No)); if (!no) throw new Error('شماره قرارداد هزینه‌ای الزامی است.');
  cs_uniq_(list, 'No', no, 'CCID', o.CCID, 'شماره قرارداد هزینه‌ای تکراری است.');
  var title = tr_(o.Title); if (!title) throw new Error('عنوان الزامی است.');
  var sup = cs_own_('Suppliers', 'SupplierID', o.SupplierID, co, 'طرف قرارداد (پیمانکار / موجر)');
  var dr = cs_dateRange_(o, 'تاریخ شروع', 'تاریخ پایان'), r = {ContractID: ctr.ContractID, Kind: kind, No: no, Title: title, SupplierID: sup.SupplierID, StartJ: dr.a.j, StartG: dr.a.g, EndJ: dr.b.j, EndG: dr.b.g, Status: cs_choice_(o.Status, {draft: 1, active: 1, done: 1, cancel: 1}, 'وضعیت', 'draft'), Notes: tr_(o.Notes),
    Amount: '', AdvPct: '', RetPct: '', Deductions: '', RateUnit: '', Rate: '', Operator: false, FuelBy: '', MachID: ''};
  if (kind === 'sub') {
    r.Amount = cs_int_(o.Amount, 'مبلغ قرارداد پیمانکار');
    if (!(r.Amount > 0)) throw new Error('مبلغ قرارداد پیمانکار باید بیشتر از صفر باشد.');
    r.AdvPct = cs_pct_(o.AdvPct, 'درصد پیش‌پرداخت'); r.RetPct = cs_pct_(o.RetPct, 'درصد سپرده حسن انجام کار');
    var ded = o.Deductions; if (typeof ded === 'string') { try { ded = ded ? JSON.parse(ded) : []; } catch (e) { throw new Error('کسورات نامعتبر است.'); } }
    if (!Array.isArray(ded)) ded = [];
    r.Deductions = JSON.stringify(ded.map(function (d, i) {
      var nm = tr_(d.name); if (!nm) throw new Error('کسورات، ردیف ' + (i + 1) + ': نام لازم است.');
      var pc = cs_pct_(d.pct, 'کسورات، ردیف ' + (i + 1) + ': درصد'); if (pc === '') throw new Error('کسورات، ردیف ' + (i + 1) + ': درصد لازم است.');
      return {name: nm, pct: pc, src: tr_(d.src) || '[نیازمند تأیید]', verify: d.verify === undefined ? true : cs_b_(d.verify, true)};
    }));
  } else {
    r.RateUnit = cs_choice_(o.RateUnit, CS_RATEU, 'واحد نرخ اجاره');
    r.Rate = cs_int_(o.Rate, 'نرخ اجاره'); if (!(r.Rate > 0)) throw new Error('نرخ اجاره باید بیشتر از صفر باشد.');
    r.Operator = cs_b_(o.Operator, false); r.FuelBy = cs_choice_(o.FuelBy, {tenant: 1, owner: 1}, 'مسئول سوخت', 'tenant');
    if (tr_(o.MachID)) r.MachID = cs_own_('Machines', 'MachID', o.MachID, co, 'ماشین‌آلات').MachID;
  }
  return r;
}
function cs_vMachine_(co, o, old, list) {
  var code = tr_(fa2en_(o.Code)), name = tr_(o.Name); if (!name) throw new Error('نام ماشین/تجهیز الزامی است.');
  if (!code) { var mx = 0; list.forEach(function (r) { var n = parseInt(fa2en_(String(r.Code)), 10); if (n > mx) mx = n; }); code = ('0000' + (mx + 1)).slice(-4); }
  cs_uniq_(list, 'Code', code, 'MachID', o.MachID, 'این کد قبلاً استفاده شده است.');
  var own = cs_b_(o.Own, false), r = {Code: code, Name: name, Own: own, IsActive: cs_b_(o.IsActive, true), Notes: tr_(o.Notes), AssetAccID: '', AccumAccID: '', Cost: '', Salvage: '', LifeYears: '', DeprMethod: '', EstHours: '', InServiceJ: '', InServiceG: ''};
  if (own) {
    r.Cost = cs_int_(o.Cost, 'بهای تمام‌شده دارایی'); if (!(r.Cost > 0)) throw new Error('بهای تمام‌شده دارایی باید بیشتر از صفر باشد.');
    r.Salvage = cs_int_(o.Salvage, 'ارزش اسقاط', true); if (r.Salvage > r.Cost) throw new Error('ارزش اسقاط نمی‌تواند بیشتر از بهای دارایی باشد.');
    r.DeprMethod = cs_choice_(o.DeprMethod, CS_DEPR, 'روش استهلاک', 'sl');
    if (r.DeprMethod !== 'hours') { r.LifeYears = cs_qty_(o.LifeYears, 'عمر مفید (سال)'); if (!(Number(r.LifeYears) > 0)) throw new Error('عمر مفید باید بیشتر از صفر باشد.'); }
    else r.LifeYears = cs_qty_(o.LifeYears, 'عمر مفید (سال)', true);
    r.EstHours = cs_qty_(o.EstHours, 'ساعت مفید برآوردی', r.DeprMethod !== 'hours');
    if (r.DeprMethod === 'hours' && !(Number(r.EstHours) > 0)) throw new Error('برای استهلاک بر مبنای ساعت، ساعت مفید برآوردی لازم است.');
    if (tr_(o.AssetAccID)) { var a = ac_accOf_(co).filter(function (x) { return x.AccID === o.AssetAccID && Number(x.Level) === 3; })[0]; if (!a) throw new Error('حساب دارایی پیدا نشد.'); r.AssetAccID = a.AccID; }
    if (tr_(o.AccumAccID)) { var b = ac_accOf_(co).filter(function (x) { return x.AccID === o.AccumAccID && Number(x.Level) === 3; })[0]; if (!b) throw new Error('حساب استهلاک انباشته پیدا نشد.'); r.AccumAccID = b.AccID; }
    var ds = cs_date_(o.InServiceJ, 'تاریخ شروع بهره‌برداری', true); r.InServiceJ = ds.j; r.InServiceG = ds.g;
  }
  return r;
}
function cs_vElem_(co, o, old, list) {
  var code = tr_(fa2en_(o.Code)), name = tr_(o.Name); if (!code) throw new Error('کد عنصر هزینه الزامی است.'); if (!name) throw new Error('نام عنصر هزینه الزامی است.');
  cs_uniq_(list, 'Code', code, 'ElemID', o.ElemID, 'این کد قبلاً استفاده شده است.');
  var grp = cs_choice_(o.Grp, CS_GRP, 'گروه'), treat = cs_choice_(o.Treat, CS_TREAT, 'نحوه شناخت');
  if (grp === 'period' && treat !== 'period') throw new Error('عناصر گروه «هزینه‌های دوره» باید «هزینه دوره» باشند.');
  if ((grp === 'acq' || grp === 'fulfil') && treat === 'product') throw new Error('هزینه‌های کسب/ایفای قرارداد «دارایی» یا «هزینه دوره» هستند، نه جزو بهای خدمات.');
  if (['material', 'labor', 'machine', 'subcontract', 'site', 'overhead'].indexOf(grp) >= 0 && treat === 'asset') throw new Error('این گروه نمی‌تواند «دارایی» باشد.');
  var key = tr_(o.AccKey);
  if (key && !cs_accByKey_(co, key)) throw new Error('کلید حساب «' + key + '» در سرفصل‌های این شرکت پیدا نشد.');
  return {Code: code, Name: name, Grp: grp, Treat: treat, AccKey: key, IsActive: cs_b_(o.IsActive, true), Src: tr_(o.Src), Verify: cs_b_(o.Verify, false), Notes: tr_(o.Notes)};
}
function cs_vBase_(co, o, old, list) {
  var code = tr_(fa2en_(o.Code)), name = tr_(o.Name); if (!code) throw new Error('کد مبنا الزامی است.'); if (!name) throw new Error('نام مبنا الزامی است.');
  cs_uniq_(list, 'Code', code, 'BaseID', o.BaseID, 'این کد قبلاً استفاده شده است.');
  return {Code: code, Name: name, IsActive: cs_b_(o.IsActive, true), Src: tr_(o.Src), Verify: cs_b_(o.Verify, false), Notes: tr_(o.Notes)};
}
/* پیدا کردن سند مبنا؛ شناسه‌ی استاندارد را برمی‌گرداند */
function cs_srcRef_(co, type, ref) {
  ref = tr_(ref); if (!ref) throw new Error('سند مبنا (شماره یا توضیح مرجع) الزامی است.');
  if (type === 'manual') return ref;
  var f = function (sheet, keys) { return rows_(sheet).filter(function (r) { return r.CompanyID === co && keys.some(function (k) { return String(r[k]) === ref; }); })[0]; };
  if (type === 'purchase') { var a = f('PurchaseInvoices', ['InvoiceID', 'InvoiceNo']); if (!a) throw new Error('فاکتور خرید «' + ref + '» پیدا نشد.'); return a.InvoiceID; }
  if (type === 'expense') { var b = f('ExpenseInvoices', ['ExpenseID', 'DocNo']); if (!b) throw new Error('فاکتور هزینه «' + ref + '» پیدا نشد.'); return b.ExpenseID; }
  if (type === 'voucher') { var c = f('Vouchers', ['VID', 'No', 'RefNo']); if (!c) throw new Error('سند حسابداری «' + ref + '» پیدا نشد.'); return c.VID; }
  throw new Error('نوع سند مبنا نامعتبر است.');
}
/* ثبت یک ردیف هزینه؛ هم برای ثبت دستی و هم (در مراحل بعد) برای رویدادهای تولیدشده */
function cs_post_(co, o, p, old, internal) {
  var ctr = cs_own_('Contracts', 'ContractID', o.ContractID, co, 'قرارداد');
  if (ctr.Status === 'cancel') throw new Error('روی قرارداد لغوشده هزینه ثبت نمی‌شود.');
  var el = cs_own_('CostElements', 'ElemID', o.ElemID, co, 'عنصر هزینه');
  if (!cs_b_(el.IsActive, true) && (!old || old.ElemID !== o.ElemID)) throw new Error('عنصر هزینه غیرفعال است.');
  var d = cs_date_(o.DateJalali, 'تاریخ');
  if (old) fy_gate_(co, old.DateGregorian, p, 'تاریخ قبلی هزینه');
  fy_gate_(co, d.g, p, 'تاریخ هزینه');
  var qty = cs_qty_(o.Qty, 'مقدار', true), rate = tr_(o.Rate) === '' ? '' : String(cs_int_(o.Rate, 'نرخ')), amount, formula, hasQ = qty !== '', hasR = rate !== '', hasA = tr_(o.Amount) !== '';
  if (hasQ !== hasR) throw new Error('مقدار و نرخ باید با هم وارد شوند (یا فقط مبلغ).');
  if (hasQ && Number(qty) === 0) throw new Error('مقدار نمی‌تواند صفر باشد.');
  if (hasQ) {
    amount = cs_mulRound_(qty, rate);
    if (hasA && cs_int_(o.Amount, 'مبلغ') !== amount) throw new Error('مبلغ با «مقدار × نرخ» (' + amount + ') برابر نیست.');
    formula = 'مقدار × نرخ = ' + qty + ' × ' + rate + ' = ' + amount;
  } else {
    if (!hasA) throw new Error('مبلغ الزامی است.');
    amount = cs_int_(o.Amount, 'مبلغ'); formula = 'مبلغ ثبت‌شده مستقیم = ' + amount;
  }
  if (!(amount > 0)) throw new Error('مبلغ باید بیشتر از صفر باشد.');
  var st = tr_(o.SrcType) || 'manual'; cs_choice_(st, CS_SRC, 'نوع سند مبنا');
  var sid = internal ? tr_(o.SrcID) : cs_srcRef_(co, st, o.SrcID);
  var ab = cs_b_(o.Abnormal, false), treat = ab ? 'period' : el.Treat;
  if (!internal && typeof cs_capCheck_ === 'function') cs_capCheck_(co, st, sid, amount, old);
  return {CompanyID: co, ContractID: ctr.ContractID, ElemID: el.ElemID, DateJalali: d.j, DateGregorian: d.g, Period: d.j.slice(0, 7), Qty: qty, Rate: rate, Amount: amount, Treat: treat, Abnormal: ab, SrcType: st, SrcID: sid,
    Formula: formula + (ab ? ' | غیرعادی: هزینه دوره' : ''), Inputs: JSON.stringify({qty: qty, rate: rate, amount: tr_(o.Amount), element: el.Code, treatByElement: el.Treat}), Description: tr_(o.Description), VID: old ? old.VID : ''};
}

function csSave_(p) {
  var co = cs_co_(p), k = cs_kind_(p.kind), o = p.obj || {};
  if (CS_EXT[p.kind]) return locked_(function () { cs_seed_(co); return CS_EXT[p.kind].save(p, co); });
  return locked_(function () {
    cs_seed_(co);
    var list = rows_(k.sheet).filter(function (r) { return r.CompanyID === co; }), id = o[k.key], old = null;
    if (id) { old = list.filter(function (r) { return r[k.key] === id; })[0]; if (!old) throw new Error(k.t + ' پیدا نشد.'); }
    o[k.key] = id || '';
    var rec;
    if (p.kind === 'contract') rec = cs_vContract_(co, o, old, list);
    else if (p.kind === 'cc') rec = cs_vCC_(co, o, old, list);
    else if (p.kind === 'machine') { rec = cs_vMachine_(co, o, old, list); if (old && typeof cs_machGuard_ === 'function') cs_machGuard_(co, old, rec); }
    else if (p.kind === 'elem') { rec = cs_vElem_(co, o, old, list); if (old && cs_b_(old.IsSystem, false) && (old.Grp !== rec.Grp || old.Treat !== rec.Treat)) throw new Error('گروه و نحوه شناخت عناصر سیستمی قابل‌تغییر نیست؛ در صورت نیاز عنصر جدید بسازید.'); }
    else if (p.kind === 'base') rec = cs_vBase_(co, o, old, list);
    else {
      if (old && typeof cs6_rowLocked_ === 'function' && cs6_rowLocked_(old)) throw new Error('این ردیف در یک «صدور سند» (مرحله ۶) آمده است؛ برای ویرایش ابتدا آخرین صدور را برگردانید.');
      if (old && CS_MANUAL_SRC.indexOf(old.SrcType) < 0) throw new Error('این ردیف از سند مبنا تولید شده و از اینجا قابل‌ویرایش نیست.');
      if (CS_MANUAL_SRC.indexOf(tr_(o.SrcType) || 'manual') < 0) throw new Error('ثبت دستی فقط برای سند مبنا از نوع دستی، فاکتور خرید، فاکتور هزینه یا سند حسابداری مجاز است.');
      rec = cs_post_(co, o, p, old);
    }
    var now = nowStr_(); if (!id) id = nextIds_(k.pf, 1)[0];
    rec.CompanyID = co; rec[k.key] = id; rec.CreatedAt = old ? old.CreatedAt : now; rec.UpdatedAt = now;
    if (old) { ['IsSystem'].forEach(function (f) { if (rec[f] === undefined && old[f] !== undefined) rec[f] = old[f]; }); }
    else if (p.kind === 'elem' || p.kind === 'base') rec.IsSystem = false;
    pr_setRow_(k.sheet, k.key, id, rec);
    bump_();
    var out = {}; out[k.key] = id; return out;
  });
}
function csDelete_(p) {
  var co = cs_co_(p), k = cs_kind_(p.kind);
  if (CS_EXT[p.kind]) return locked_(function () { return CS_EXT[p.kind].del(p, co); });
  return locked_(function () {
    var r = cs_own_(k.sheet, k.key, p.id, co, k.t), n;
    if (p.kind === 'contract') {
      n = rows_('CostLedger').filter(function (x) { return x.ContractID === p.id; }).length;
      if (n) throw new Error('روی این قرارداد ' + n + ' ردیف هزینه ثبت شده است؛ حذف نمی‌شود. می‌توانید آن را «لغو» کنید.');
      ['CostEst', 'Milestones', 'InstallLog', 'ProgIn', 'ContractAmend', 'ContractBills'].forEach(function (sn) { if (H[sn] && rows_(sn).some(function (x) { return x.ContractID === p.id; })) throw new Error('برای این قرارداد برآورد/مرحله/ثبت نصب ثبت شده است؛ ابتدا آن‌ها را حذف کنید (یا قرارداد را «لغو» کنید).'); });
      n = rows_('CostContracts').filter(function (x) { return x.ContractID === p.id; }).length;
      if (n) throw new Error('این قرارداد ' + n + ' قرارداد هزینه‌ای دارد؛ ابتدا آن‌ها را حذف کنید.');
    } else if (p.kind === 'machine') {
      if (typeof cs_machUsed_ === 'function' && (n = cs_machUsed_(co, p.id))) throw new Error('برای این ماشین ' + n + ' برگه کارکرد/هزینه ثبت شده است؛ حذف نمی‌شود. می‌توانید آن را «غیرفعال» کنید.');
      n = rows_('CostContracts').filter(function (x) { return x.MachID === p.id; }).length;
      if (n) throw new Error('این ماشین در ' + n + ' قرارداد هزینه‌ای استفاده شده است؛ حذف نمی‌شود. می‌توانید آن را «غیرفعال» کنید.');
    } else if (p.kind === 'elem' || p.kind === 'base') {
      if (cs_b_(r.IsSystem, false)) throw new Error('موارد سیستمی حذف نمی‌شوند؛ می‌توانید «غیرفعال» کنید.');
      if (p.kind === 'base' && typeof cs_baseUsed_ === 'function' && (n = cs_baseUsed_(co, p.id))) throw new Error('این مبنا در ' + n + ' مرکز سربار/مقدار دستی استفاده شده است؛ حذف نمی‌شود. می‌توانید «غیرفعال» کنید.');
      if (p.kind === 'elem' && rows_('CostLedger').some(function (x) { return x.ElemID === p.id; })) throw new Error('این عنصر در دفتر هزینه استفاده شده است؛ حذف نمی‌شود. می‌توانید «غیرفعال» کنید.');
    } else if (p.kind === 'ledger') {
      if (typeof cs6_rowLocked_ === 'function' && cs6_rowLocked_(r)) throw new Error('این ردیف در یک «صدور سند» (مرحله ۶) آمده است؛ برای حذف ابتدا آخرین صدور را برگردانید.');
      if (CS_MANUAL_SRC.indexOf(r.SrcType) < 0) throw new Error('این ردیف از سند مبنا تولید شده و از اینجا قابل‌حذف نیست.');
      fy_gate_(co, r.DateGregorian, p, 'تاریخ هزینه');
    }
    if (p.kind === 'contract' && H.ContractCfg) delWhere_('ContractCfg', H.ContractCfg.indexOf('ContractID') + 1, function (v) { return v === p.id; });
    delWhere_(k.sheet, 1, function (v) { return v === p.id; });
    bump_();
    return {deleted: 1};
  });
}

/* ---------- کارت بهای تمام‌شده‌ی قرارداد (عناصر × دوره، با مجموع تجمعی) ---------- */
function csCard_(p) {
  var co = cs_co_(p); cs_seed_(co);
  var ctr = cs_own_('Contracts', 'ContractID', p.contract, co, 'قرارداد');
  var fg = tr_(p.from) ? cs_date_(p.from, 'از تاریخ').g : '', tg = tr_(p.to) ? cs_date_(p.to, 'تا تاریخ').g : '';
  var el = {}; rows_('CostElements').forEach(function (r) { if (r.CompanyID === co) el[r.ElemID] = r; });
  var L = rows_('CostLedger').filter(function (r) { return r.CompanyID === co && r.ContractID === ctr.ContractID && (!fg || r.DateGregorian >= fg) && (!tg || r.DateGregorian <= tg); });
  var per = {}, rows = {}, T = {product: 0, asset: 0, period: 0, all: 0};
  L.forEach(function (r) {
    var a = Number(r.Amount) || 0, e = el[r.ElemID] || {Name: '(نامعلوم)', Grp: '', Code: ''};
    per[r.Period] = 1;
    var x = rows[r.ElemID] || (rows[r.ElemID] = {ElemID: r.ElemID, Code: String(e.Code), Name: e.Name, Grp: e.Grp, byPeriod: {}, byTreat: {product: 0, asset: 0, period: 0}, total: 0});
    x.byPeriod[r.Period] = (x.byPeriod[r.Period] || 0) + a; x.total += a; x.byTreat[r.Treat] = (x.byTreat[r.Treat] || 0) + a;
    T[r.Treat] = (T[r.Treat] || 0) + a; T.all += a;
  });
  var periods = Object.keys(per).sort(), list = Object.keys(rows).map(function (k) { return rows[k]; }).sort(function (a, b) { return String(a.Code) < String(b.Code) ? -1 : 1; });
  var cum = 0, pt = periods.map(function (q) { var s = 0; list.forEach(function (x) { s += x.byPeriod[q] || 0; }); cum += s; return {period: q, total: s, cumulative: cum}; });
  var chk = 0; list.forEach(function (x) { chk += x.total; });
  return {contract: {ContractID: ctr.ContractID, No: ctr.No, Title: ctr.Title, Amount: ctr.Amount, Status: ctr.Status}, periods: periods, rows: list, periodTotals: pt, totals: T,
    check: {sumOfElements: chk, ledgerTotal: T.all, equal: chk === T.all}, entries: L.length};
}
