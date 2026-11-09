/* ===== حسابداری: سرفصل حساب‌ها (۶ سطح)، سند حسابداری دستی، لیست اسناد، تراز آزمایشی و دفتر معین =====
   ساختار حساب‌ها مثل نرم‌افزارهای حسابداری ایران:
   - سطح ۱ «گروه» (۱ رقم)، سطح ۲ «کل» (کد گروه + ۱ رقم)، سطح ۳ «معین» (کد کل + ۲ رقم) = درخت ثابت (جدول Accounts).
     سند فقط روی «معین» ثبت می‌شود.
   - سطح ۴ «تفصیلی» (شناور): بسته به نوع تفصیلیِ معین از یکی از این منبع‌ها انتخاب می‌شود:
       تفصیلی عمومی (AccDetails)، بانک/صندوق/تنخواه‌گردان (BankAccounts)، کالا (Products).
   - سطح ۵ «شخص / مرکز هزینه» (شناور): خریدار (Customers)، فروشنده (Suppliers)، کارمند (Employees).
   - سطح ۶ «پروژه» (شناور): جدول Projects.
   هر معین مشخص می‌کند سطح ۴ ندارد/دارد (نوع منبع، الزامی)، سطح ۵ و ۶: ندارد/اختیاری/الزامی.
   سند (Vouchers + VoucherRows): دستی یا خودکار (Source)؛ وضعیت: پیش‌نویس یا تأییدشده. تأیید فقط وقتی مجموع بدهکار = بستانکار. */
var AC_CATS = ['دارایی', 'بدهی', 'حقوق صاحبان سهام', 'درآمد', 'هزینه', 'حساب‌های اختتامیه', 'انتظامی'];
var AC_DET4 = {detail: 'تفصیلی عمومی', bank: 'بانک', cash: 'صندوق', imprest: 'تنخواه‌گردان', product: 'کالا'};
var AC_PARTY = {customer: 'خریدار', supplier: 'فروشنده', employee: 'کارمند'};
var AC_DIM = {
  detail: {sheet: 'AccDetails', key: 'DetID', pf: 'DTL', t: 'تفصیلی'},
  emp: {sheet: 'Employees', key: 'EmpID', pf: 'EMP', t: 'کارمند'},
  proj: {sheet: 'Projects', key: 'ProjID', pf: 'PRJ', t: 'پروژه'}
};
H.Accounts = ['AccID', 'CompanyID', 'Level', 'ParentID', 'Code', 'Name', 'Cat', 'Det4', 'Det5', 'Det6', 'Post', 'SysKey', 'IsSystem', 'IsActive', 'Notes', 'CreatedAt', 'UpdatedAt', 'ReqDate', 'ReqTxt', 'ReqNum'];
H.AccDetails = ['DetID', 'CompanyID', 'Code', 'Name', 'IsActive', 'Notes', 'CreatedAt', 'UpdatedAt'];
H.Employees = ['EmpID', 'CompanyID', 'Code', 'Name', 'NationalID', 'Position', 'IsActive', 'Notes', 'CreatedAt', 'UpdatedAt'];
H.Projects = ['ProjID', 'CompanyID', 'Code', 'Name', 'IsActive', 'Notes', 'CreatedAt', 'UpdatedAt'];
H.Vouchers = ['VID', 'CompanyID', 'No', 'Ref', 'DateJalali', 'DateGregorian', 'Time', 'Description', 'Status', 'Source', 'SrcType', 'SrcID', 'ProjID', 'TotalDebit', 'TotalCredit', 'CreatedAt', 'UpdatedAt', 'RefNo'];
H.VoucherRows = ['VRID', 'VID', 'CompanyID', 'LineNo', 'AccID', 'DetKind', 'DetID', 'PartyType', 'PartyID', 'ProjID', 'Description', 'Debit', 'Credit', 'AtfDate', 'AtfTxt', 'AtfNum'];

/* ---------- کدینگ استاندارد (برای هر شرکت یک نسخه‌ی مستقل ساخته می‌شود) ---------- */
var AC_STD_GROUPS = [['1', 'دارایی‌های جاری', 'دارایی'], ['2', 'دارایی‌های غیرجاری', 'دارایی'], ['3', 'بدهی‌های جاری', 'بدهی'], ['4', 'بدهی‌های غیرجاری', 'بدهی'], ['5', 'حقوق صاحبان سهام', 'حقوق صاحبان سهام'], ['6', 'درآمدها', 'درآمد'], ['7', 'بهای تمام‌شده و هزینه‌ها', 'هزینه'], ['8', 'حساب‌های اختتامیه', 'حساب‌های اختتامیه'], ['9', 'حساب‌های انتظامی', 'انتظامی']];
var AC_STD_KOLS = [['11', 'موجودی نقد و بانک'], ['12', 'سرمایه‌گذاری‌های کوتاه‌مدت'], ['13', 'حساب‌ها و اسناد دریافتنی تجاری'], ['14', 'سایر حساب‌ها و اسناد دریافتنی'], ['15', 'موجودی مواد و کالا'], ['16', 'پیش‌پرداخت‌ها'], ['17', 'مالیات و عوارض ارزش افزوده خرید'],
  ['21', 'دارایی‌های ثابت مشهود'], ['22', 'استهلاک انباشته'], ['23', 'دارایی‌های نامشهود'], ['24', 'سایر دارایی‌ها'],
  ['31', 'حساب‌ها و اسناد پرداختنی تجاری'], ['32', 'سایر حساب‌ها و اسناد پرداختنی'], ['33', 'پیش‌دریافت‌ها'], ['34', 'ذخایر'], ['35', 'مالیات و عوارض ارزش افزوده فروش'], ['36', 'سود سهام پرداختنی'], ['37', 'تسهیلات مالی دریافتی کوتاه‌مدت'],
  ['41', 'تسهیلات مالی بلندمدت'], ['42', 'ذخیره مزایای پایان خدمت کارکنان'],
  ['51', 'سرمایه'], ['52', 'اندوخته‌ها'], ['53', 'سود (زیان) انباشته'], ['54', 'جاری شرکا / سهامداران'],
  ['61', 'فروش'], ['62', 'برگشت از فروش و تخفیفات'], ['63', 'سایر درآمدها'],
  ['71', 'بهای تمام‌شده کالای فروش‌رفته'], ['72', 'هزینه حقوق و دستمزد'], ['73', 'هزینه‌های اداری و عمومی'], ['74', 'هزینه‌های فروش و توزیع'], ['75', 'هزینه‌های مالی'], ['76', 'هزینه استهلاک'], ['77', 'سایر هزینه‌ها'], ['78', 'مالیات'],
  ['81', 'خلاصه سود و زیان'], ['82', 'تراز افتتاحیه و اختتامیه'], ['91', 'حساب‌های انتظامی']];
/* کد | نام | تفصیلی(det4) | شخص(det5: opt/req) | پروژه(det6) | کلید سیستمی (برای اسناد خودکار بعدی) */
var AC_STD_MOEIN = [
  '1101|صندوق|cash||opt|cash', '1102|تنخواه‌گردان|imprest||opt|imprest', '1103|بانک‌ها|bank||opt|bank', '1104|وجوه در راه|||opt|cash_transit',
  '1201|سپرده‌های کوتاه‌مدت بانکی|bank||opt|', '1202|سرمایه‌گذاری در سهام و اوراق بهادار|||opt|',
  '1301|حساب‌های دریافتنی (خریداران)||req|opt|ar', '1302|اسناد دریافتنی (چک‌های نزد صندوق)||req|opt|notes_rec', '1303|اسناد در جریان وصول|bank|opt|opt|notes_collect', '1304|ذخیره مطالبات مشکوک‌الوصول|||opt|',
  '1401|وام و مساعده کارکنان||req|opt|', '1402|سپرده‌های دریافتنی (نزد دیگران)||opt|opt|', '1403|پیش‌پرداخت مالیات (علی‌الحساب)|||opt|', '1404|سایر حساب‌های دریافتنی||opt|opt|',
  '1501|موجودی مواد اولیه|product||opt|inv_raw', '1502|موجودی کالای در جریان ساخت|product||opt|wip', '1503|موجودی کالای ساخته‌شده|product||opt|inv_fg', '1504|موجودی کالای خریداری‌شده (تجاری)|product||opt|inventory', '1505|کالای در راه|product||opt|',
  '1601|پیش‌پرداخت خرید||req|opt|prepay_buy', '1602|پیش‌پرداخت هزینه‌ها (اجاره، بیمه و ...)|||opt|',
  '1701|مالیات بر ارزش افزوده خرید|||opt|vat_in', '1702|عوارض ارزش افزوده خرید|||opt|levy_in',
  '2101|زمین|||opt|', '2102|ساختمان|||opt|', '2103|ماشین‌آلات و تجهیزات|||opt|', '2104|وسایل نقلیه|||opt|', '2105|اثاثیه و منصوبات|||opt|',
  '2201|استهلاک انباشته ساختمان|||opt|', '2202|استهلاک انباشته ماشین‌آلات و تجهیزات|||opt|', '2203|استهلاک انباشته وسایل نقلیه|||opt|', '2204|استهلاک انباشته اثاثیه و منصوبات|||opt|',
  '2301|نرم‌افزار و حق امتیاز|||opt|', '2302|سرقفلی|||opt|', '2401|سپرده‌ها و ودیعه‌های بلندمدت||opt|opt|', '2402|سایر دارایی‌ها|||opt|',
  '3101|حساب‌های پرداختنی (فروشندگان)||req|opt|ap', '3102|اسناد پرداختنی (چک‌های پرداختی)|bank|opt|opt|notes_pay',
  '3201|حقوق و دستمزد پرداختنی||req|opt|salary_pay', '3202|حق بیمه پرداختنی|||opt|', '3203|مالیات حقوق پرداختنی|||opt|', '3204|سایر حساب‌های پرداختنی||opt|opt|pay_other', '3205|سپرده‌های پرداختنی (از دیگران)||opt|opt|',
  '3301|پیش‌دریافت فروش||req|opt|prepay_sell',
  '3401|ذخیره مالیات عملکرد|||opt|tax_prov',
  '3501|مالیات بر ارزش افزوده فروش|||opt|vat_out', '3502|عوارض ارزش افزوده فروش|||opt|levy_out',
  '3601|سود سهام پرداختنی||opt||',
  '3701|تسهیلات مالی کوتاه‌مدت|bank||opt|loan_short',
  '4101|تسهیلات مالی بلندمدت|bank||opt|', '4201|ذخیره مزایای پایان خدمت کارکنان||opt||',
  '5101|سرمایه||opt||capital', '5201|اندوخته قانونی||||', '5301|سود (زیان) انباشته||||retained', '5401|جاری شرکا / سهامداران||req||partners',
  '6101|فروش کالا|||opt|sales', '6102|فروش خدمات|||opt|sales_svc', '6103|فروش ضایعات|||opt|',
  '6201|برگشت از فروش|||opt|sales_ret', '6202|تخفیفات فروش|||opt|sales_disc',
  '6301|درآمد سود سپرده بانکی|||opt|', '6302|سود ناشی از فروش دارایی|||opt|', '6303|سایر درآمدهای غیرعملیاتی|||opt|other_inc',
  '7101|بهای تمام‌شده کالای فروش‌رفته|product||opt|cogs', '7102|برگشت از خرید و تخفیفات خرید|||opt|purch_ret', '7103|سربار تولید جذب‌شده (بستانکار)|||opt|ovh_abs', '7104|دستمزد مستقیم تولید جذب‌شده (بستانکار)|||opt|wage_abs',
  '7201|حقوق و دستمزد||opt|opt|exp_wage', '7202|بیمه سهم کارفرما||opt|opt|', '7203|عیدی و پاداش||opt|opt|', '7204|بازخرید سنوات و مرخصی||opt|opt|',
  '7301|اجاره|||opt|exp_rent', '7302|آب، برق و گاز|||opt|exp_util', '7303|تلفن و اینترنت|||opt|', '7304|ملزومات مصرفی|||opt|', '7305|تعمیر و نگهداری|||opt|exp_repair', '7306|حمل و نقل و ایاب و ذهاب|||opt|exp_transport', '7307|بیمه|||opt|', '7308|حق‌الزحمه حسابرسی و خدمات مشاوره||opt|opt|', '7309|هزینه‌های متفرقه|||opt|expense_misc',
  '7401|حمل و ارسال کالای فروش‌رفته|||opt|', '7402|تبلیغات و بازاریابی|||opt|',
  '7501|کارمزد بانکی|||opt|bank_fee', '7502|سود و کارمزد تسهیلات|||opt|fin_exp',
  '7601|هزینه استهلاک|||opt|exp_depr',
  '7701|زیان ناشی از فروش دارایی|||opt|', '7702|جرایم و خسارات|||opt|',
  '7801|مالیات عملکرد|||opt|tax_exp',
  '8101|خلاصه حساب سود و زیان||||pl_summary', '8201|تراز افتتاحیه||||opening', '8202|تراز اختتامیه||||closing',
  '9101|اسناد تضمینی نزد دیگران||opt||', '9102|طرف حساب اسناد تضمینی نزد دیگران||opt||', '9103|اسناد تضمینی دیگران نزد ما||opt||', '9104|طرف حساب اسناد تضمینی دیگران نزد ما||opt||'
];

/* ---------- ابزارها ---------- */
function ac_open_(co) { ac_ensureSeed_(co); ac_initAuto_(co); ac_fixRef_(co); }
function ac_co_(p) { if (!p || !p.company) throw new Error('شرکت/مشتری را انتخاب کنید.'); return p.company; }
function ac_b_(x, d) { if (x === undefined || x === null || x === '') return d; return x === true || x === 1 || String(x) === 'true' || String(x) === 'TRUE' || String(x) === '1'; }
function ac_cmpCode_(a, b) { a = String(a.Code); b = String(b.Code); return a < b ? -1 : (a > b ? 1 : 0); }
function ac_dateReq_(s, what) { var d = parseJ_(s); if (!d) throw new Error((what || 'تاریخ') + ' نامعتبر است (قالب: 1405/07/25).'); return d; }
function ac_accOf_(co) { return rows_('Accounts').filter(function (r) { return r.CompanyID === co; }); }
function ac_usedAcc_(co) { var u = {}; rows_('VoucherRows').forEach(function (r) { if (r.CompanyID === co && r.AccID) u[r.AccID] = (u[r.AccID] || 0) + 1; }); return u; }
function ac_accOut_(r, used) {
  var o = Object.assign({}, r);
  o.Level = Number(r.Level); o.Post = ac_b_(r.Post, false); o.IsSystem = ac_b_(r.IsSystem, false); o.IsActive = ac_b_(r.IsActive, true);
  o.Code = String(r.Code); o.Used = used ? (used[r.AccID] || 0) : 0;
  return o;
}

/* ---------- ساخت کدینگ استاندارد ---------- */
function ac_seed_(co, onlySys) {
  var have = {}, byCode = {}, now = nowStr_(), need = [];
  ac_accOf_(co).forEach(function (r) { have[String(r.Code)] = 1; byCode[String(r.Code)] = r.AccID; });
  var cat = {};
  var wantK = {}, wantG = {};
  if (onlySys) AC_STD_MOEIN.forEach(function (line) { var f = line.split('|'); if (f[5] && !have[f[0]]) { wantK[f[0].substring(0, 2)] = 1; wantG[f[0].charAt(0)] = 1; } });
  AC_STD_GROUPS.forEach(function (g) { cat[g[0]] = g[2]; if (!have[g[0]] && (!onlySys || wantG[g[0]])) need.push({code: g[0], level: 1, name: g[1], cat: g[2], parent: '', det4: '', det5: '', det6: '', sys: '', post: false}); });
  AC_STD_KOLS.forEach(function (k) { if (!have[k[0]] && (!onlySys || wantK[k[0]])) need.push({code: k[0], level: 2, name: k[1], cat: cat[k[0].charAt(0)], parent: k[0].charAt(0), det4: '', det5: '', det6: '', sys: '', post: false}); });
  AC_STD_MOEIN.forEach(function (line) {
    var f = line.split('|'), c = f[0];
    if (!have[c] && (!onlySys || f[5])) need.push({code: c, level: 3, name: f[1], cat: cat[c.charAt(0)], parent: c.substring(0, 2), det4: f[2] || '', det5: f[3] || '', det6: f[4] || '', sys: f[5] || '', post: true});
  });
  if (!need.length) return 0;
  var ids = nextIds_('ACT', need.length);
  need.forEach(function (n, i) { byCode[n.code] = ids[i]; });
  appendRows_(sh_('Accounts'), need.map(function (n, i) {
    return pr_arr_('Accounts', {AccID: ids[i], CompanyID: co, Level: n.level, ParentID: n.parent ? byCode[n.parent] : '', Code: n.code, Name: n.name, Cat: n.cat, Det4: n.det4, Det5: n.det5, Det6: n.det6, Post: n.post, SysKey: n.sys, IsSystem: !!n.sys, IsActive: true, Notes: '', CreatedAt: now, UpdatedAt: now});
  }));
  return need.length;
}
function ac_ensureSeed_(co) {
  if (rows_('Accounts').some(function (r) { return r.CompanyID === co; })) return;
  locked_(function () { if (!rows_('Accounts').some(function (r) { return r.CompanyID === co; })) { ac_seed_(co); bump_(); } });
}

/* ---------- سرفصل حساب‌ها ---------- */
function accTree_(p) {
  var co = ac_co_(p); ac_open_(co);
  var used = ac_usedAcc_(co);
  var list = ac_accOf_(co).map(function (r) { return ac_accOut_(r, used); }).sort(ac_cmpCode_);
  return {rows: list, cats: AC_CATS};
}
function ac_nextCode_(all, parent, level) {
  var kids = all.filter(function (r) { return (parent ? r.ParentID === parent.AccID : Number(r.Level) === 1); });
  var have = {}; all.forEach(function (r) { have[String(r.Code)] = 1; });
  var c;
  if (!parent) { var mx = 0; kids.forEach(function (r) { var n = parseInt(r.Code, 10); if (n > mx) mx = n; }); c = String(mx + 1); }
  else {
    var pc = String(parent.Code), pad = level === 2 ? 1 : 2, mxn = 0, len = pc.length + pad;
    kids.forEach(function (r) { var cs = String(r.Code), n = parseInt(cs.substring(pc.length), 10); if (!isNaN(n) && n > mxn) mxn = n; if (cs.length > len) len = cs.length; });
    var tail = String(mxn + 1); while (tail.length < len - pc.length) tail = '0' + tail;
    c = pc + tail;
  }
  while (have[c]) c = String(Number(c) + 1);
  return c;
}
function accSave_(p) {
  var co = ac_co_(p), o = p.obj || {};
  return locked_(function () {
    var all = ac_accOf_(co), id = o.AccID, old = null, parent = null, level, i;
    var name = tr_(o.Name); if (!name) throw new Error('نام حساب الزامی است.');
    var byId = function (x) { return all.filter(function (r) { return r.AccID === x; })[0]; };
    if (id) {
      old = byId(id); if (!old) throw new Error('حساب پیدا نشد.');
      level = Number(old.Level); parent = old.ParentID ? byId(old.ParentID) : null;
    } else if (o.ParentID) {
      parent = byId(o.ParentID); if (!parent) throw new Error('حساب مرجع پیدا نشد.');
      level = Number(parent.Level) + 1;
      if (level > 3) throw new Error('زیر «معین» حساب جدید ساخته نمی‌شود؛ برای جزئیات از «تفصیلی»، «شخص / مرکز هزینه» و «پروژه» استفاده کنید.');
    } else level = 1;
    var pid = parent ? parent.AccID : '';
    if (all.some(function (r) { return (r.ParentID || '') === pid && r.AccID !== id && nn_(r.Name) === nn_(name); })) throw new Error('در همین گروه، حسابی با نام «' + name + '» وجود دارد.');
    var code = tr_(fa2en_(o.Code));
    if (code && !/^\d{1,8}$/.test(code)) throw new Error('کد حساب فقط عدد (حداکثر ۸ رقم) است.');
    if (!code) code = old ? String(old.Code) : ac_nextCode_(all, parent, level);
    if (old && code !== String(old.Code)) {
      if (ac_b_(old.IsSystem, false)) throw new Error('کد حساب‌های سیستمی قابل تغییر نیست.');
      if (all.some(function (r) { return r.ParentID === id; })) throw new Error('این حساب زیرمجموعه دارد؛ کد آن قابل تغییر نیست.');
    }
    if (all.some(function (r) { return r.AccID !== id && String(r.Code) === code; })) throw new Error('کد «' + code + '» قبلاً استفاده شده است.');
    if (parent && (code.indexOf(String(parent.Code)) !== 0 || code.length <= String(parent.Code).length)) throw new Error('کد این حساب باید با کد حساب مرجع («' + parent.Code + '») شروع شود و از آن بلندتر باشد.');
    if (level === 1 && code.length > 2) throw new Error('کد «گروه» حداکثر ۲ رقم است.');
    var cat = level === 1 ? tr_(o.Cat) : parent.Cat;
    if (level === 1) { if (!cat && old) cat = old.Cat; if (AC_CATS.indexOf(cat) < 0) throw new Error('نوع گروه حساب را انتخاب کنید.'); }
    var det4 = '', det5 = '', det6 = '', post = false, sys = old ? ac_b_(old.IsSystem, false) : false, rqd = false, rqt = false, rqn = false;
    if (level === 3) {
      det4 = tr_(o.Det4); det5 = tr_(o.Det5); det6 = tr_(o.Det6);
      if (det4 && !AC_DET4[det4]) throw new Error('نوع تفصیلی نامعتبر است.');
      if (['', 'opt', 'req'].indexOf(det5) < 0 || ['', 'opt', 'req'].indexOf(det6) < 0) throw new Error('گزینه‌ی شخص/پروژه نامعتبر است.');
      post = ac_b_(o.Post, true);
      var fl = function (k) { return o[k] === undefined ? (old ? ac_b_(old[k], false) : false) : ac_b_(o[k], false); };
      rqd = fl('ReqDate'); rqt = fl('ReqTxt'); rqn = fl('ReqNum');
      if (old && sys) det4 = old.Det4 || '';
      if (old && (old.Det4 || '') !== det4 && ac_usedAcc_(co)[id]) throw new Error('این حساب در سند استفاده شده است؛ نوع «تفصیلی» آن قابل تغییر نیست.');
    }
    var act = ac_b_(o.IsActive, true);
    if (old && sys && !act) throw new Error('حساب‌های سیستمی را نمی‌توان غیرفعال کرد.');
    var now = nowStr_(); if (!id) id = nextIds_('ACT', 1)[0];
    pr_setRow_('Accounts', 'AccID', id, {AccID: id, CompanyID: co, Level: level, ParentID: pid, Code: code, Name: name, Cat: cat, Det4: det4, Det5: det5, Det6: det6, Post: post, SysKey: old ? old.SysKey : '', IsSystem: sys, IsActive: act, Notes: tr_(o.Notes), CreatedAt: old ? old.CreatedAt : now, UpdatedAt: now, ReqDate: rqd, ReqTxt: rqt, ReqNum: rqn});
    if (old && level < 3) { /* نوع گروه به زیرمجموعه‌ها منتقل می‌شود */
      if (level === 1 && old.Cat !== cat) all.forEach(function (r) { if (String(r.Code).charAt(0) === String(old.Code).charAt(0) && r.AccID !== id && r.Cat !== cat && String(r.Code).indexOf(String(old.Code)) === 0) { r.Cat = cat; pr_setRow_('Accounts', 'AccID', r.AccID, r); } });
    }
    bump_();
    return {AccID: id, Code: code};
  });
}
function accDelete_(p) {
  var co = ac_co_(p);
  return locked_(function () {
    var all = ac_accOf_(co), a = all.filter(function (r) { return r.AccID === p.id; })[0];
    if (!a) throw new Error('حساب پیدا نشد.');
    if (ac_b_(a.IsSystem, false)) throw new Error('«' + a.Name + '» حساب سیستمی است و حذف نمی‌شود (در صورت نیاز می‌توانید نامش را ویرایش کنید).');
    if (all.some(function (r) { return r.ParentID === a.AccID; })) throw new Error('«' + a.Name + '» زیرمجموعه دارد؛ ابتدا زیرمجموعه‌ها را حذف کنید.');
    var n = ac_usedAcc_(co)[a.AccID] || 0;
    if (n) throw new Error('«' + a.Name + '» در ' + n + ' ردیف سند استفاده شده است؛ حذف نمی‌شود. به‌جای حذف می‌توانید آن را «غیرفعال» کنید.');
    delWhere_('Accounts', 1, function (v) { return v === a.AccID; });
    bump_();
    return {deleted: 1};
  });
}
function accReseed_(p) {
  var co = ac_co_(p);
  return locked_(function () { var n = ac_seed_(co); bump_(); return {added: n}; });
}

/* ---------- تفصیلی‌های عمومی، کارکنان، پروژه‌ها ---------- */
function ac_dim_(k) { var d = AC_DIM[k]; if (!d) throw new Error('نوع نامعتبر است.'); return d; }
function ac_dimUsed_(co, k) {
  var u = {};
  if (k === 'detail') rows_('VoucherRows').forEach(function (r) { if (r.CompanyID === co && r.DetKind === 'detail' && r.DetID) u[r.DetID] = (u[r.DetID] || 0) + 1; });
  else if (k === 'emp') rows_('VoucherRows').forEach(function (r) { if (r.CompanyID === co && r.PartyType === 'employee' && r.PartyID) u[r.PartyID] = (u[r.PartyID] || 0) + 1; });
  else {
    rows_('VoucherRows').forEach(function (r) { if (r.CompanyID === co && r.ProjID) u[r.ProjID] = (u[r.ProjID] || 0) + 1; });
    rows_('Vouchers').forEach(function (r) { if (r.CompanyID === co && r.ProjID) u[r.ProjID] = (u[r.ProjID] || 0) + 1; });
  }
  return u;
}
function accDimList_(p) {
  var co = ac_co_(p), d = ac_dim_(p.kind), used = ac_dimUsed_(co, p.kind);
  var l = rows_(d.sheet).filter(function (r) { return r.CompanyID === co; }).map(function (r) { var o = Object.assign({}, r); o.IsActive = ac_b_(r.IsActive, true); o.Code = String(r.Code); o.Used = used[r[d.key]] || 0; return o; });
  l.sort(ac_cmpCode_);
  return {rows: l};
}
function accDimSave_(p) {
  var co = ac_co_(p), d = ac_dim_(p.kind), o = p.obj || {};
  var name = tr_(o.Name); if (!name) throw new Error('نام ' + d.t + ' الزامی است.');
  return locked_(function () {
    var list = rows_(d.sheet).filter(function (r) { return r.CompanyID === co; }), id = o[d.key], old = null;
    if (id) { old = list.filter(function (r) { return r[d.key] === id; })[0]; if (!old) throw new Error(d.t + ' پیدا نشد.'); }
    if (list.some(function (r) { return r[d.key] !== id && nn_(r.Name) === nn_(name); })) throw new Error('«' + name + '» قبلاً ثبت شده است.');
    var code = tr_(fa2en_(o.Code));
    if (code && list.some(function (r) { return r[d.key] !== id && String(r.Code) === code; })) throw new Error('این کد قبلاً استفاده شده است.');
    if (!code) {
      if (old && old.Code) code = String(old.Code);
      else { var mx = 0; list.forEach(function (r) { var n = parseInt(fa2en_(String(r.Code)), 10); if (n > mx) mx = n; }); code = ('0000' + (mx + 1)).slice(-4); }
    }
    var now = nowStr_(); if (!id) id = nextIds_(d.pf, 1)[0];
    var rec = {CompanyID: co, Code: code, Name: name, IsActive: ac_b_(o.IsActive, true), Notes: tr_(o.Notes), CreatedAt: old ? old.CreatedAt : now, UpdatedAt: now};
    rec[d.key] = id;
    if (p.kind === 'emp') { rec.NationalID = tr_(fa2en_(o.NationalID)); rec.Position = tr_(o.Position); }
    pr_setRow_(d.sheet, d.key, id, rec);
    bump_();
    var out = {Code: code}; out[d.key] = id; return out;
  });
}
function accDimDelete_(p) {
  var co = ac_co_(p), d = ac_dim_(p.kind);
  return locked_(function () {
    var r = pr_find_(d.sheet, d.key, p.id, co, d.t), n = ac_dimUsed_(co, p.kind)[p.id] || 0;
    if (n) throw new Error('«' + r.Name + '» در ' + n + ' مورد (سند حسابداری) استفاده شده است؛ حذف نمی‌شود. به‌جای حذف می‌توانید آن را «غیرفعال» کنید.');
    delWhere_(d.sheet, 1, function (v) { return v === p.id; });
    bump_();
    return {deleted: 1};
  });
}

/* ---------- فهرست‌های لازم برای فرم سند ---------- */
function accOptions_(p) {
  var co = ac_co_(p); ac_open_(co);
  var all = ac_accOf_(co), by = {}; all.forEach(function (r) { by[r.AccID] = r; });
  var accounts = all.filter(function (r) { return Number(r.Level) === 3; }).map(function (r) {
    var kol = by[r.ParentID] || {}, grp = by[kol.ParentID] || {};
    return {AccID: r.AccID, Code: String(r.Code), Name: r.Name, Det4: r.Det4 || '', Det5: r.Det5 || '', Det6: r.Det6 || '', ReqDate: ac_b_(r.ReqDate, false), ReqTxt: ac_b_(r.ReqTxt, false), ReqNum: ac_b_(r.ReqNum, false), Post: ac_b_(r.Post, false), IsActive: ac_b_(r.IsActive, true), Path: (grp.Name || '') + ' ◂ ' + (kol.Name || ''), Cat: r.Cat};
  }).sort(ac_cmpCode_);
  var mk = function (k) { var d = AC_DIM[k]; return rows_(d.sheet).filter(function (r) { return r.CompanyID === co; }).map(function (r) { return {id: r[d.key], Code: String(r.Code), Name: r.Name, IsActive: ac_b_(r.IsActive, true)}; }).sort(ac_cmpCode_); };
  return {accounts: accounts, details: mk('detail'), employees: mk('emp'), projects: mk('proj')};
}

/* ---------- بررسی و نرمال‌سازی ردیف‌های سند ---------- */
function ac_ctx_(co) {
  var c = {accs: {}, det: {}, bank: {}, prod: {}, cus: {}, sup: {}, emp: {}, proj: {}};
  ac_accOf_(co).forEach(function (r) { c.accs[r.AccID] = r; });
  rows_('AccDetails').forEach(function (r) { if (r.CompanyID === co) c.det[r.DetID] = r; });
  rows_('BankAccounts').forEach(function (r) { if (r.CompanyID === co) c.bank[r.AccountID] = r; });
  rows_('Products').forEach(function (r) { if (r.CompanyID === co) c.prod[r.ProductID] = r; });
  rows_('Customers').forEach(function (r) { if (r.CompanyID === co) c.cus[r.CustomerID] = r; });
  rows_('Suppliers').forEach(function (r) { if (r.CompanyID === co) c.sup[r.SupplierID] = r; });
  rows_('Employees').forEach(function (r) { if (r.CompanyID === co) c.emp[r.EmpID] = r; });
  rows_('Projects').forEach(function (r) { if (r.CompanyID === co) c.proj[r.ProjID] = r; });
  return c;
}
function ac_detRec_(c, kind, id) {
  if (kind === 'detail') return c.det[id];
  if (kind === 'product') return c.prod[id];
  var b = c.bank[id]; return (b && b.Kind === kind) ? b : null;
}
function ac_detName_(c, kind, id) {
  var r = ac_detRec_(c, kind, id); if (!r) return '';
  if (kind === 'bank' || kind === 'cash' || kind === 'imprest') return bk_accName_(r);
  var code = kind === 'product' ? r.ProductCode : r.Code;
  return (code ? code + ' - ' : '') + r.Name;
}
function ac_partyRec_(c, type, id) { return type === 'customer' ? c.cus[id] : (type === 'supplier' ? c.sup[id] : (type === 'employee' ? c.emp[id] : null)); }
function ac_partyName_(c, type, id) { var r = ac_partyRec_(c, type, id); return r ? (AC_PARTY[type] + ': ' + r.Name) : ''; }
function ac_accTitle_(a) { return a ? (a.Code + ' - ' + a.Name) : ''; }

/* strict=true: برای سند تأییدشده؛ false: پیش‌نویس (فقط ساختار) */
function ac_validate_(c, rowsIn, strict) {
  var out = [], D = 0, C = 0;
  rowsIn.forEach(function (r, i) {
    var ln = i + 1, w = 'ردیف ' + ln + ': ';
    var deb = pr_num_(r.Debit), cre = pr_num_(r.Credit);
    if (deb < 0 || cre < 0) throw new Error(w + 'مبلغ نمی‌تواند منفی باشد.');
    deb = r2_(deb); cre = r2_(cre);
    if (deb > 0 && cre > 0) throw new Error(w + 'در یک ردیف فقط یکی از «بدهکار» یا «بستانکار» باید مبلغ داشته باشد.');
    var a = r.AccID ? c.accs[r.AccID] : null;
    if (r.AccID && !a) throw new Error(w + 'حساب پیدا نشد.');
    if (strict) {
      if (!a) throw new Error(w + 'حساب را انتخاب کنید.');
      if (deb <= 0 && cre <= 0) throw new Error(w + 'مبلغ بدهکار یا بستانکار را وارد کنید.');
    }
    if (a && strict) {
      if (Number(a.Level) !== 3 || !ac_b_(a.Post, false)) throw new Error(w + 'روی حساب «' + a.Name + '» سند ثبت نمی‌شود (فقط حساب «معین» با اجازه‌ی ثبت سند).');
      if (!ac_b_(a.IsActive, true)) throw new Error(w + 'حساب «' + a.Name + '» غیرفعال است.');
    }
    var detKind = '', detId = tr_(r.DetID), pt = tr_(r.PartyType), pid = tr_(r.PartyID), prj = tr_(r.ProjID);
    if (a && a.Det4) {
      detKind = a.Det4;
      if (detId) { if (!ac_detRec_(c, detKind, detId)) throw new Error(w + 'تفصیلی انتخاب‌شده برای حساب «' + a.Name + '» معتبر نیست (باید از نوع «' + AC_DET4[detKind] + '» باشد).'); }
      else if (strict) throw new Error(w + 'برای حساب «' + a.Name + '» انتخاب «' + AC_DET4[detKind] + '» (تفصیلی) الزامی است.');
    } else if (detId) { if (strict) throw new Error(w + 'حساب «' + (a ? a.Name : '') + '» تفصیلی ندارد.'); detId = ''; }
    if (pid) {
      if (!AC_PARTY[pt] || !ac_partyRec_(c, pt, pid)) throw new Error(w + 'شخص انتخاب‌شده معتبر نیست.');
      if (a && !a.Det5 && strict) throw new Error(w + 'حساب «' + a.Name + '» شخص / مرکز هزینه ندارد.');
    } else { pt = ''; if (a && a.Det5 === 'req' && strict) throw new Error(w + 'برای حساب «' + a.Name + '» انتخاب شخص / مرکز هزینه (خریدار، فروشنده یا کارمند) الزامی است.'); }
    if (prj) {
      if (!c.proj[prj]) throw new Error(w + 'پروژه پیدا نشد.');
      if (a && !a.Det6 && strict) throw new Error(w + 'حساب «' + a.Name + '» پروژه ندارد.');
    } else if (a && a.Det6 === 'req' && strict) throw new Error(w + 'برای حساب «' + a.Name + '» انتخاب پروژه الزامی است.');
    var ad = tr_(r.AtfDate), at = tr_(r.AtfTxt), an = tr_(fa2en_(r.AtfNum));
    if (ad) { var pd = parseJ_(fa2en_(ad)); if (!pd) throw new Error(w + 'تاریخ عطف نامعتبر است.'); ad = pd.j; }
    if (a && strict) {
      if (ac_b_(a.ReqDate, false) && !ad) throw new Error(w + 'برای حساب «' + a.Name + '» «تاریخ عطف» الزامی است.');
      if (ac_b_(a.ReqTxt, false) && !at) throw new Error(w + 'برای حساب «' + a.Name + '» «عطف حرفی» الزامی است.');
      if (ac_b_(a.ReqNum, false) && !an) throw new Error(w + 'برای حساب «' + a.Name + '» «عطف عددی» الزامی است.');
    }
    D += deb; C += cre;
    out.push({AccID: r.AccID || '', DetKind: detId ? detKind : '', DetID: detId, PartyType: pt, PartyID: pid, ProjID: prj, Description: tr_(r.Description), Debit: deb > 0 ? deb : '', Credit: cre > 0 ? cre : '', AtfDate: ad, AtfTxt: at, AtfNum: an});
  });
  return {rows: out, D: r2_(D), C: r2_(C)};
}
function ac_blank_(r) { return !tr_(r.AccID) && !pr_num_(r.Debit) && !pr_num_(r.Credit) && !tr_(r.Description) && !tr_(r.DetID) && !tr_(r.PartyID); }

/* ---------- شماره ارجاع (دائمی) و شماره سند (موقت) ----------
   RefNo: با ساخت سند داده می‌شود، هرگز عوض نمی‌شود و بعد از حذف سند هم دوباره استفاده نمی‌شود (شمارنده acRefSeq_<co>).
   No: شماره‌ی موقت؛ با «مرتب‌سازی» بر اساس تاریخ از ۱ دوباره شماره‌گذاری می‌شود. */
function ac_takeRef_(co, n) {
  var mx = 0; rows_('Vouchers').forEach(function (r) { if (r.CompanyID === co) { var x = parseInt(String(r.RefNo), 10); if (x > mx) mx = x; } });
  var st = Math.max(mx, parseInt(getSet_('acRefSeq_' + co), 10) || 0), out = [];
  for (var i = 1; i <= n; i++) out.push(String(st + i));
  if (n > 0) setSet_('acRefSeq_' + co, String(st + n));
  return out;
}
/* بازنویسی دسته‌ای سردر چند سند (حذف و افزودن مجدد؛ ردیف‌ها دست نمی‌خورند) */
function ac_rewriteHeads_(list) {
  if (!list.length) return;
  var m = {}; list.forEach(function (v) { m[v.VID] = 1; });
  delWhere_('Vouchers', 1, function (x) { return m[x]; });
  appendRows_(sh_('Vouchers'), list.map(function (v) { return pr_arr_('Vouchers', v); }));
  bump_();
}
/* سندهای قدیمی که هنوز شماره‌ی ارجاع ندارند: ارجاع = شماره‌ی سند فعلی (یک‌بار) */
function ac_fixRef_(co) {
  var need = rows_('Vouchers').filter(function (v) { return v.CompanyID === co && !tr_(v.RefNo); });
  if (!need.length) return;
  locked_(function () {
    need = rows_('Vouchers').filter(function (v) { return v.CompanyID === co && !tr_(v.RefNo); });
    if (!need.length) return;
    var used = {}, mx = 0;
    rows_('Vouchers').forEach(function (v) { if (v.CompanyID === co && tr_(v.RefNo)) { used[String(v.RefNo)] = 1; var x = parseInt(String(v.RefNo), 10); if (x > mx) mx = x; } });
    need.sort(function (a, b) { return (Number(a.No) - Number(b.No)) || (a.VID < b.VID ? -1 : 1); });
    var rest = [];
    need.forEach(function (v) { var n = String(parseInt(String(v.No), 10)); if (/^\d+$/.test(n) && !used[n]) { used[n] = 1; v.RefNo = n; var x = parseInt(n, 10); if (x > mx) mx = x; } else rest.push(v); });
    var seq = Math.max(mx, parseInt(getSet_('acRefSeq_' + co), 10) || 0);
    rest.forEach(function (v) { seq++; v.RefNo = String(seq); });
    setSet_('acRefSeq_' + co, String(Math.max(seq, mx)));
    ac_rewriteHeads_(need);
  });
}
function voucherRenumber_(p) {
  var co = ac_co_(p); ac_open_(co);
  return locked_(function () { return ac_renumber_(co, false); });
}
/* ---------- سند حسابداری ---------- */
function ac_voucher_(co, id) { return pr_find_('Vouchers', 'VID', id, co, 'سند'); }
function ac_isAuto_(v) { return String(v.Source) === 'auto'; }
function ac_noSys_(v) { if (String(v.Source) === 'sys') throw new Error('این سند را سیستم هنگام بستن سال مالی ساخته است و دستی ویرایش، حذف یا تغییر وضعیت نمی‌شود. برای تغییر، سال مالی را «باز کردن مجدد» کنید (فقط مدیر سیستم).'); }
function voucherSave_(p) {
  var co = ac_co_(p), o = p.obj || {};
  var d = ac_dateReq_(o.DateJalali, 'تاریخ سند');
  var status = o.Status === 'draft' ? 'draft' : 'confirmed', strict = status === 'confirmed';
  var rowsIn = (o.rows || []).filter(function (r) { return !ac_blank_(r); });
  if (!rowsIn.length) throw new Error('حداقل یک ردیف سند وارد کنید.');
  if (strict && rowsIn.length < 2) throw new Error('سند تأییدشده باید حداقل دو ردیف داشته باشد.');
  return locked_(function () {
    var c = ac_ctx_(co), id = o.VID, old = null, v;
    if (id) { old = ac_voucher_(co, id); if (ac_isAuto_(old)) throw new Error('سند خودکار را نمی‌توان دستی ویرایش کرد.'); ac_noSys_(old); fy_gate_(co, old.DateGregorian, p, 'سند'); }
    fy_gate_(co, d.g, p, 'تاریخ سند');
    v = ac_validate_(c, rowsIn, strict);
    if (strict) {
      if (v.D <= 0) throw new Error('جمع مبالغ سند صفر است.');
      if (Math.abs(v.D - v.C) > 0.005) throw new Error('سند تراز نیست: جمع بدهکار ' + fmtNum_(v.D) + ' و جمع بستانکار ' + fmtNum_(v.C) + ' (اختلاف ' + fmtNum_(r2_(Math.abs(v.D - v.C))) + ' ریال).');
    }
    var prj = tr_(o.ProjID); if (prj && !c.proj[prj]) throw new Error('پروژه‌ی سند پیدا نشد.');
    var no = tr_(fa2en_(o.No));
    if (no && !/^\d{1,9}$/.test(no)) throw new Error('شماره‌ی سند باید عدد باشد.');
    var fyR = fy_of_(co, d.g);
    if (no && rows_('Vouchers').some(function (r) { return r.CompanyID === co && r.VID !== id && String(r.No) === no && r.DateGregorian >= fyR.fg && r.DateGregorian <= fyR.tg; })) throw new Error('شماره‌ی سند «' + no + '» قبلاً استفاده شده است.');
    if (!no) no = old && old.DateGregorian >= fyR.fg && old.DateGregorian <= fyR.tg ? String(old.No) : ac_nextNo_(co, d.g);
    var desc = tr_(o.Description);
    if (!desc && strict) throw new Error('شرح سند را وارد کنید.');
    var now = nowStr_(), tm = tr_(o.Time) || now.substring(11, 16);
    var refNo = old && tr_(old.RefNo) ? String(old.RefNo) : ac_takeRef_(co, 1)[0];
    if (!id) id = nextIds_('VCH', 1)[0];
    pr_setRow_('Vouchers', 'VID', id, {VID: id, CompanyID: co, No: no, RefNo: refNo, Ref: tr_(o.Ref), DateJalali: d.j, DateGregorian: d.g, Time: tm, Description: desc, Status: status, Source: 'manual', SrcType: old && old.SrcType === 'cs6' ? 'cs6' : '', SrcID: old && old.SrcType === 'cs6' ? old.SrcID : '', ProjID: prj, TotalDebit: v.D, TotalCredit: v.C, CreatedAt: old ? old.CreatedAt : now, UpdatedAt: now});
    var ids = nextIds_('VRW', v.rows.length);
    pr_replace_('VoucherRows', 'VID', id, v.rows.map(function (r, i) { return Object.assign({VRID: ids[i], VID: id, CompanyID: co, LineNo: i + 1}, r); }));
    bump_();
    return {VID: id, No: no, RefNo: refNo, Status: status, TotalDebit: v.D, TotalCredit: v.C};
  });
}
function fmtNum_(x) { return String(Math.round(x * 100) / 100).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function voucherGet_(p) {
  var co = ac_co_(p), v = ac_voucher_(co, p.id), c = ac_ctx_(co);
  var rows = rows_('VoucherRows').filter(function (r) { return r.VID === v.VID; }).sort(function (a, b) { return Number(a.LineNo) - Number(b.LineNo); }).map(function (r) {
    var a = c.accs[r.AccID], kl = a ? c.accs[a.ParentID] : null, dr = r.DetID ? ac_detRec_(c, r.DetKind, r.DetID) : null, pr = r.PartyID ? ac_partyRec_(c, r.PartyType, r.PartyID) : null, pj = r.ProjID ? c.proj[r.ProjID] : null;
    return {KolCode: kl ? String(kl.Code) : '', KolName: kl ? kl.Name : '', MoeinCode: a ? String(a.Code) : '', MoeinName: a ? a.Name : '',
      DetCode: dr ? String((r.DetKind === 'product' ? dr.ProductCode : dr.Code) || '') : '', DetOnly: dr ? (r.DetKind === 'bank' || r.DetKind === 'cash' || r.DetKind === 'imprest' ? bk_accName_(dr) : dr.Name) : '',
      PartyCode: pr ? String(pr.CustomerCode || pr.SupplierCode || pr.Code || '') : '', ProjCode: pj ? String(pj.Code || '') : '',
      AccID: r.AccID, AccTitle: ac_accTitle_(a), Det4: a ? a.Det4 || '' : '', Det5: a ? a.Det5 || '' : '', Det6: a ? a.Det6 || '' : '', DetKind: r.DetKind || '', DetID: r.DetID || '', DetName: r.DetID ? ac_detName_(c, r.DetKind, r.DetID) : '', PartyType: r.PartyType || '', PartyID: r.PartyID || '', PartyName: r.PartyID ? ac_partyName_(c, r.PartyType, r.PartyID) : '', ProjID: r.ProjID || '', ProjName: r.ProjID && c.proj[r.ProjID] ? c.proj[r.ProjID].Name : '', Description: r.Description || '', Debit: Number(r.Debit) || 0, Credit: Number(r.Credit) || 0,
      AtfDate: r.AtfDate || '', AtfTxt: r.AtfTxt || '', AtfNum: r.AtfNum || '', ReqDate: a ? ac_b_(a.ReqDate, false) : false, ReqTxt: a ? ac_b_(a.ReqTxt, false) : false, ReqNum: a ? ac_b_(a.ReqNum, false) : false};
  });
  return {head: Object.assign({}, v, {No: String(v.No), TotalDebit: Number(v.TotalDebit) || 0, TotalCredit: Number(v.TotalCredit) || 0, ProjName: v.ProjID && c.proj[v.ProjID] ? c.proj[v.ProjID].Name : ''}), rows: rows};
}
function voucherList_(p) {
  var co = ac_co_(p); ac_open_(co); var proj = {}, cnt = {};
  rows_('Projects').forEach(function (r) { if (r.CompanyID === co) proj[r.ProjID] = r.Name; });
  rows_('VoucherRows').forEach(function (r) { if (r.CompanyID === co) cnt[r.VID] = (cnt[r.VID] || 0) + 1; });
  var f = tr_(p.from) ? ac_dateReq_(p.from, 'از تاریخ').g : '', t = tr_(p.to) ? ac_dateReq_(p.to, 'تا تاریخ').g : '', q = nn_(p.q || ''), fyM = fy_month_(co);
  if (tr_(p.fy)) { var FR = fy_range_(co, parseInt(p.fy, 10), fyM); if (!f || f < FR.fg) f = FR.fg; if (!t || t > FR.tg) t = FR.tg; }
  var list = rows_('Vouchers').filter(function (r) {
    if (r.CompanyID !== co) return false;
    if (f && r.DateGregorian < f) return false; if (t && r.DateGregorian > t) return false;
    if (p.status && r.Status !== p.status) return false;
    if (p.source && r.Source !== p.source) return false;
    if (q && nn_(String(r.No) + ' ' + r.RefNo + ' ' + r.Ref + ' ' + r.Description).indexOf(q) < 0) return false;
    return true;
  }).map(function (r) {
    return {VID: r.VID, No: String(r.No), RefNo: String(r.RefNo || ''), Ref: r.Ref || '', DateJalali: r.DateJalali, DateGregorian: r.DateGregorian, Time: r.Time || '', Description: r.Description || '', Status: r.Status, Source: r.Source || 'manual', SrcType: r.SrcType || '', SrcLabel: String(r.Source) === 'auto' ? (AC_AUTO_LABEL[r.SrcType] || r.SrcType || '') : (String(r.Source) === 'sys' ? (FY_SYS_LABEL[r.SrcType] || '') : ''), ProjID: r.ProjID || '', ProjName: proj[r.ProjID] || '', TotalDebit: Number(r.TotalDebit) || 0, TotalCredit: Number(r.TotalCredit) || 0, Rows: cnt[r.VID] || 0};
  });
  list.forEach(function (r) { r.FY = fy_of_(co, r.DateGregorian, fyM).sy; });
  list.sort(function (a, b) { return (b.FY - a.FY) || (Number(b.No) - Number(a.No)) || (a.VID < b.VID ? 1 : -1); });
  var T = {n: list.length, draft: 0, confirmed: 0, amount: 0};
  list.forEach(function (r) { if (r.Status === 'draft') T.draft++; else T.confirmed++; T.amount += r.TotalDebit; });
  T.amount = r2_(T.amount);
  return {rows: list, totals: T, nextNo: ac_nextNo_(co, tr_(p.fy) ? fy_range_(co, parseInt(p.fy, 10), fyM).fg : undefined), fyMonth: fyM, autoErr: ac_autoErr_(co), sorted: ac_isSorted_(co)};
}
function voucherDelete_(p) {
  var co = ac_co_(p);
  return locked_(function () {
    var v = ac_voucher_(co, p.id);
    if (ac_isAuto_(v)) throw new Error('سند خودکار را نمی‌توان دستی حذف کرد.');
    if (v.SrcType === 'cs6') throw new Error('این سند را «صدور سند بهای خدمات» (مرحله ۶) ساخته است؛ برای حذف، آخرین صدور را از همان صفحه برگردانید.');
    ac_noSys_(v); fy_gate_(co, v.DateGregorian, p, 'سند');
    delWhere_('VoucherRows', 2, function (x) { return x === v.VID; });
    delWhere_('Vouchers', 1, function (x) { return x === v.VID; });
    bump_();
    return {deleted: 1};
  });
}
function voucherStatus_(p) {
  var co = ac_co_(p), status = p.status === 'draft' ? 'draft' : 'confirmed';
  return locked_(function () {
    var v = ac_voucher_(co, p.id);
    if (ac_isAuto_(v)) throw new Error('وضعیت سند خودکار را نمی‌توان دستی تغییر داد.');
    ac_noSys_(v); fy_gate_(co, v.DateGregorian, p, 'سند');
    if (status === 'confirmed') {
      var c = ac_ctx_(co), rr = rows_('VoucherRows').filter(function (r) { return r.VID === v.VID; });
      if (rr.length < 2) throw new Error('سند تأییدشده باید حداقل دو ردیف داشته باشد.');
      var x = ac_validate_(c, rr, true);
      if (x.D <= 0 || Math.abs(x.D - x.C) > 0.005) throw new Error('سند تراز نیست (جمع بدهکار ' + fmtNum_(x.D) + '، جمع بستانکار ' + fmtNum_(x.C) + ')؛ ابتدا آن را اصلاح کنید.');
      if (!tr_(v.Description)) throw new Error('شرح سند خالی است؛ ابتدا سند را ویرایش کنید.');
    }
    v.Status = status; v.UpdatedAt = nowStr_(); pr_setRow_('Vouchers', 'VID', v.VID, v);
    bump_();
    return {Status: status};
  });
}

/* ---------- گزارش‌ها: تراز آزمایشی و دفتر معین ---------- */
function ac_sign_(x) { return x > 0.005 ? 'بد' : (x < -0.005 ? 'بس' : ''); }
function ac_vFilter_(co, p) {
  var f = tr_(p.from) ? ac_dateReq_(p.from, 'از تاریخ').g : '', t = tr_(p.to) ? ac_dateReq_(p.to, 'تا تاریخ').g : '', all = ac_b_(p.includeDraft, false), m = {}, Z = fy_ctx_(co, p, 'all', true, true);
  rows_('Vouchers').forEach(function (v) {
    if (v.CompanyID !== co || !(all || v.Status === 'confirmed') || (t && v.DateGregorian > t)) return;
    if (!fy_ok_(Z, v)) return;
    m[v.VID] = v;
  });
  return {f: f, t: t, m: m};
}
function accTrial_(p) {
  var co = ac_co_(p); ac_open_(co); var lv = String(p.level || '3'), vf = ac_vFilter_(co, p), c = ac_ctx_(co);
  var accs = c.accs, grp = {};
  var anc = function (a, n) { var x = a; while (x && Number(x.Level) > n) x = accs[x.ParentID]; return x; };
  var agg = {};
  rows_('VoucherRows').forEach(function (r) {
    var v = vf.m[r.VID]; if (!v || r.CompanyID !== co) return;
    var a = accs[r.AccID]; if (!a) return;
    var key, title, code, level;
    if (lv === '1' || lv === '2') { var n = anc(a, Number(lv)); if (!n) return; key = n.AccID; code = String(n.Code); title = n.Name; level = Number(lv); }
    else {
      key = a.AccID; code = String(a.Code); title = a.Name; level = 3;
      if (lv === '4') { if (!r.DetID) { key += '|-'; title += ' / (بدون تفصیلی)'; } else { key += '|' + r.DetKind + r.DetID; title += ' / ' + ac_detName_(c, r.DetKind, r.DetID); } level = 4; }
      else if (lv === '5') { if (!r.PartyID) { key += '|-'; title += ' / (بدون شخص)'; } else { key += '|' + r.PartyType + r.PartyID; title += ' / ' + ac_partyName_(c, r.PartyType, r.PartyID); } level = 5; }
      else if (lv === '6') { if (!r.ProjID) { key += '|-'; title += ' / (بدون پروژه)'; } else { key += '|' + r.ProjID; title += ' / ' + (c.proj[r.ProjID] ? c.proj[r.ProjID].Name : r.ProjID); } level = 6; }
    }
    var o = agg[key] = agg[key] || {Code: code, Name: title, Level: level, pd: 0, pc: 0, d: 0, c: 0, AccID: a.AccID};
    var D = Number(r.Debit) || 0, C = Number(r.Credit) || 0;
    if (vf.f && v.DateGregorian < vf.f) { o.pd += D; o.pc += C; } else { o.d += D; o.c += C; }
  });
  var out = [], T = {od: 0, oc: 0, d: 0, c: 0, ed: 0, ec: 0};
  Object.keys(agg).forEach(function (k) {
    var o = agg[k], open = o.pd - o.pc, end = open + o.d - o.c;
    var row = {Code: o.Code, Name: o.Name, Level: o.Level, AccID: o.AccID, OpenDebit: r2_(Math.max(open, 0)), OpenCredit: r2_(Math.max(-open, 0)), Debit: r2_(o.d), Credit: r2_(o.c), EndDebit: r2_(Math.max(end, 0)), EndCredit: r2_(Math.max(-end, 0))};
    if (p.hideZero && !row.OpenDebit && !row.OpenCredit && !row.Debit && !row.Credit && !row.EndDebit && !row.EndCredit) return;
    out.push(row);
    if (lv !== '1' && lv !== '2' || true) { T.od += row.OpenDebit; T.oc += row.OpenCredit; T.d += row.Debit; T.c += row.Credit; T.ed += row.EndDebit; T.ec += row.EndCredit; }
  });
  out.sort(function (a, b) { return a.Code < b.Code ? -1 : (a.Code > b.Code ? 1 : (a.Name < b.Name ? -1 : 1)); });
  Object.keys(T).forEach(function (k) { T[k] = r2_(T[k]); });
  return {rows: out, totals: T, level: lv};
}
function accLedger_(p) {
  var co = ac_co_(p); ac_open_(co); var c = ac_ctx_(co), a = c.accs[p.acc];
  if (!a) throw new Error('حساب را انتخاب کنید.');
  var vf = ac_vFilter_(co, p), list = [], carry = 0, under = {};
  Object.keys(c.accs).forEach(function (id) { var x = c.accs[id]; if (Number(x.Level) !== 3) return; while (x && Number(x.Level) > Number(a.Level)) x = c.accs[x.ParentID]; if (x && x.AccID === a.AccID) under[id] = 1; });
  rows_('VoucherRows').forEach(function (r) {
    if (r.CompanyID !== co || !under[r.AccID]) return;
    var v = vf.m[r.VID]; if (!v) return;
    if (p.det && !(r.DetID === p.det)) return;
    if (p.party && !(r.PartyID === p.party)) return;
    if (p.proj && !(r.ProjID === p.proj)) return;
    var D = Number(r.Debit) || 0, C = Number(r.Credit) || 0;
    if (vf.f && v.DateGregorian < vf.f) { carry += D - C; return; }
    list.push({VID: v.VID, No: String(v.No), RefNo: String(v.RefNo || ''), DateJalali: v.DateJalali, DateGregorian: v.DateGregorian, Status: v.Status, VDesc: v.Description || '', Description: r.Description || '', Det: r.DetID ? ac_detName_(c, r.DetKind, r.DetID) : '', Party: r.PartyID ? ac_partyName_(c, r.PartyType, r.PartyID) : '', Proj: r.ProjID && c.proj[r.ProjID] ? c.proj[r.ProjID].Name : '', Debit: D, Credit: C, LineNo: Number(r.LineNo)});
  });
  list.sort(function (x, y) { return x.DateGregorian < y.DateGregorian ? -1 : (x.DateGregorian > y.DateGregorian ? 1 : (Number(x.RefNo) - Number(y.RefNo)) || (x.LineNo - y.LineNo)); });
  var bal = carry, Td = 0, Tc = 0;
  var rows = list.map(function (x) { bal += x.Debit - x.Credit; Td += x.Debit; Tc += x.Credit; x.Balance = r2_(bal); x.Sign = ac_sign_(bal); return x; });
  return {account: {AccID: a.AccID, Code: String(a.Code), Name: a.Name}, carry: r2_(carry), carrySign: ac_sign_(carry), rows: rows, totals: {debit: r2_(Td), credit: r2_(Tc), balance: r2_(bal), sign: ac_sign_(bal)}};
}
