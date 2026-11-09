/* ===================================================================
   «ثبت از روی اسکن ← حقوق، پرداخت و بیمه»
   - سه جریان: شناسایی هزینهٔ حقوق (payroll)، پرداخت به کارکنان (payment)، پرداخت حق بیمه (insurance)
   - خروجی همیشه «پیش‌نویس» سند حسابداری است؛ هرگز سند قطعی ساخته نمی‌شود و تأیید نهایی با انسان است.
   - هر ثبت در جدول DocCaptures نگه داشته می‌شود (نام فایل، هش SHA-256، داده‌ی بررسی‌شده، اصلاحات، کاربر تأییدکننده)
     تا: ۱) فایل تکراری مسدود شود، ۲) شماره‌ی پیگیری تکراری هشدار بدهد، ۳) مانده‌ی بدهی هر کارمند و بیمه‌ی هر دوره
     برای جریان‌های بعدی محاسبه شود. اگر سند پیش‌نویس حذف شود، اثر آن ثبت از مانده‌ها برداشته می‌شود.
   - مبالغ سند را رابط (توابع خالص آزمون‌شده) می‌سازد؛ سرور دوباره تراز بودن، اعتبار حساب‌ها/کارکنان و مانده‌ها را می‌سنجد.
   =================================================================== */
H.DocCaptures = ['DCID', 'CompanyID', 'Kind', 'FileName', 'FileHash', 'TrackingNos', 'PeriodKey', 'VID', 'Payload', 'Extracted', 'Corrections', 'ConfirmedBy', 'CreatedAt'];

var DOC_KINDS = {payroll: 'شناسایی هزینه حقوق', payment: 'پرداخت به کارکنان', insurance: 'پرداخت حق بیمه'};
/* نقش حساب ← کد حساب معین پیش‌فرض در کدینگ استاندارد (قابل تغییر در تنظیمات هر شرکت) */
var DOC_DEF_CODE = {wageExp: '7201', erExp: '7202', wagePay: '3201', insPay: '3202', taxPay: '3203', advance: '1401', penalty: '7702'};
var DOC_BANK_SYS = {bank: 'bank', cash: 'cash', imprest: 'imprest'};
var DOC_DEF_RATES = {employee: 7, employer: 20, unemployment: 3};

function doc_cfg_(co) {
  var cfg = {}; try { cfg = JSON.parse(getSet_('docCfg_' + co) || '{}') || {}; } catch (e) { cfg = {}; }
  var rates = {employee: DOC_DEF_RATES.employee, employer: DOC_DEF_RATES.employer, unemployment: DOC_DEF_RATES.unemployment};
  if (cfg.rates) ['employee', 'employer', 'unemployment'].forEach(function (k) { var v = Number(cfg.rates[k]); if (isFinite(v) && v >= 0 && v <= 100) rates[k] = v; });
  var byCode = {}; ac_accOf_(co).forEach(function (a) { if (Number(a.Level) === 3) byCode[String(a.Code)] = a.AccID; });
  var acc = {}; Object.keys(DOC_DEF_CODE).forEach(function (r) { acc[r] = (cfg.acc && cfg.acc[r] && ac_voucherAcc_(co, cfg.acc[r])) ? cfg.acc[r] : (byCode[DOC_DEF_CODE[r]] || ''); });
  return {rates: rates, acc: acc};
}
function ac_voucherAcc_(co, id) { var a = null; ac_accOf_(co).forEach(function (x) { if (x.AccID === id && Number(x.Level) === 3) a = x; }); return a; }

/* مانده‌ی بدهی باز: فقط ثبت‌هایی که سند پیش‌نویسشان هنوز وجود دارد اثر دارند */
function doc_live_(co) {
  var vids = {}; rows_('Vouchers').forEach(function (v) { if (v.CompanyID === co) vids[v.VID] = v; });
  var list = []; rows_('DocCaptures').forEach(function (r) { if (r.CompanyID === co && vids[r.VID]) list.push({rec: r, v: vids[r.VID]}); });
  return list;
}
function doc_payload_(r) { try { return JSON.parse(r.Payload || '{}') || {}; } catch (e) { return {}; } }
function doc_payables_(co) {
  var emp = {}, ins = {};
  doc_live_(co).forEach(function (x) {
    var pl = doc_payload_(x.rec);
    if (x.rec.Kind === 'payroll') {
      (pl.employees || []).forEach(function (e) { if (e.empId) emp[e.empId] = (emp[e.empId] || 0) + (Number(e.net) || 0); });
      if (x.rec.PeriodKey) ins[x.rec.PeriodKey] = (ins[x.rec.PeriodKey] || 0) + (Number(pl.insurance) || 0);
    } else if (x.rec.Kind === 'payment') {
      (pl.items || []).forEach(function (e) { if (e.empId) emp[e.empId] = (emp[e.empId] || 0) - (Number(e.applied) || 0); });
    } else if (x.rec.Kind === 'insurance') {
      if (x.rec.PeriodKey) ins[x.rec.PeriodKey] = (ins[x.rec.PeriodKey] || 0) - (Number(pl.principal) || 0);
    }
  });
  return {emp: emp, ins: ins};
}

function docInit_(p) {
  var co = ac_co_(p); ac_open_(co);
  var pay = doc_payables_(co), cfg = doc_cfg_(co);
  var emps = rows_('Employees').filter(function (e) { return e.CompanyID === co && ac_b_(e.IsActive, true); }).map(function (e) {
    return {key: e.EmpID, name: e.Name, nationalCode: String(e.NationalID || ''), open: Math.max(0, Math.round(pay.emp[e.EmpID] || 0))};
  });
  var ins = {}; Object.keys(pay.ins).forEach(function (k) { ins[k] = Math.round(pay.ins[k]); });
  var vs = {}; rows_('Vouchers').forEach(function (v) { if (v.CompanyID === co) vs[v.VID] = v; });
  var recent = rows_('DocCaptures').filter(function (r) { return r.CompanyID === co; }).sort(function (a, b) { return a.CreatedAt < b.CreatedAt ? 1 : -1; }).slice(0, 100).map(function (r) {
    var v = vs[r.VID];
    return {DCID: r.DCID, Kind: r.Kind, FileName: r.FileName, CreatedAt: r.CreatedAt, ConfirmedBy: r.ConfirmedBy, PeriodKey: r.PeriodKey, VID: v ? r.VID : '', No: v ? String(v.No) : '', Status: v ? v.Status : 'deleted', Total: v ? v.TotalDebit : 0};
  });
  return {settings: cfg, employees: emps, insuranceOpen: ins, recent: recent};
}

function docSettingsSave_(p) {
  var co = ac_co_(p), s = p.settings || {}, out = {rates: {}, acc: {}};
  ['employee', 'employer', 'unemployment'].forEach(function (k) {
    var v = Number(s.rates && s.rates[k]);
    if (!isFinite(v) || v < 0 || v > 100) throw new Error('درصد بیمه باید بین ۰ و ۱۰۰ باشد.');
    out.rates[k] = v;
  });
  Object.keys(DOC_DEF_CODE).forEach(function (r) {
    var id = s.acc && s.acc[r];
    if (id) { var a = ac_voucherAcc_(co, id); if (!a) throw new Error('حساب انتخاب‌شده برای «' + r + '» پیدا نشد.'); out.acc[r] = id; }
  });
  return locked_(function () { setSet_('docCfg_' + co, JSON.stringify(out)); bump_(); return doc_cfg_(co); });
}

/* هش تکراری = مسدود؛ شماره‌ی پیگیری تکراری = هشدار (در ثبت‌های این بخش، پرداخت‌های بانکی و فاکتورها) */
function docCheck_(p) {
  var co = ac_co_(p), hash = tr_(p.hash), live = doc_live_(co), dupFile = null, dupTrack = [];
  live.forEach(function (x) { if (hash && x.rec.FileHash === hash && !dupFile) dupFile = {DCID: x.rec.DCID, Kind: x.rec.Kind, FileName: x.rec.FileName, CreatedAt: x.rec.CreatedAt, No: String(x.v.No)}; });
  var want = {}; (p.trackingNos || []).forEach(function (t) { t = tr_(fa2en_(t)); if (t) want[t] = 1; });
  if (Object.keys(want).length) {
    live.forEach(function (x) { String(x.rec.TrackingNos || '').split('|').forEach(function (t) { if (t && want[t]) dupTrack.push({no: t, where: 'ثبت از روی اسکن (' + (DOC_KINDS[x.rec.Kind] || '') + ') - سند ' + x.v.No}); }); });
    rows_('DocPayments').forEach(function (r) { var t = tr_(fa2en_(r.TrackingNo)); if (r.CompanyID === co && t && want[t]) dupTrack.push({no: t, where: 'پرداخت/دریافت فاکتور'}); });
    rows_('BankTx').forEach(function (r) { var t = tr_(fa2en_(r.TrackingNo)); if (r.CompanyID === co && t && want[t]) dupTrack.push({no: t, where: 'تراکنش بانکی'}); });
  }
  return {dupFile: dupFile, dupTrack: dupTrack};
}

/* ---------- ثبت پیش‌نویس ---------- */
function doc_int_(x, what) {
  var n = Number(x);
  if (!isFinite(n) || n < 0 || Math.abs(n - Math.round(n)) > 1e-9) throw new Error(what + ' باید عدد صحیح (ریال) و نامنفی باشد.');
  return Math.round(n);
}
function docCommit_(p) {
  var co = ac_co_(p), kind = p.kind;
  if (!DOC_KINDS[kind]) throw new Error('نوع سند نامعتبر است.');
  ac_open_(co);
  var hash = tr_(p.hash), fileName = tr_(p.fileName) || 'ورود دستی';
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('هش فایل نامعتبر است.');
  var chk = docCheck_({company: co, hash: hash, trackingNos: []});
  if (chk.dupFile) throw new Error('این فایل قبلاً ثبت شده است (سند شماره ' + chk.dupFile.No + '، ' + chk.dupFile.CreatedAt + ').');
  var d = ac_dateReq_(p.date, 'تاریخ سند');
  var lines = p.lines || [];
  if (!lines.length) throw new Error('سند خالی است.');
  var cfg = doc_cfg_(co), pl = p.payload || {}, c = ac_ctx_(co);
  /* کارکنان: «new:...» ساخته (یا با نام/کد ملی موجود تطبیق) می‌شود؛ بقیه باید در همین شرکت باشند */
  var empOf = {}, created = [];
  var needEmp = function (pe) {
    var key = pe.key;
    if (empOf[key]) return empOf[key];
    if (String(key).indexOf('new:') === 0) {
      var nm = tr_(pe.name), nc = tr_(fa2en_(pe.nationalCode || ''));
      if (!nm) throw new Error('نام کارمند خالی است.');
      var ex = null;
      rows_('Employees').forEach(function (e) { if (e.CompanyID === co && (nn_(e.Name) === nn_(nm) || (nc && String(e.NationalID) === nc))) ex = e; });
      if (ex) empOf[key] = ex.EmpID;
      else { var r = accDimSave_({company: co, kind: 'emp', obj: {Name: nm, NationalID: nc, Position: ''}}); empOf[key] = r.EmpID; created.push(nm); c.emp[r.EmpID] = {EmpID: r.EmpID, Name: nm}; }
    } else {
      if (!c.emp[key]) throw new Error('کارمند انتخاب‌شده پیدا نشد.');
      empOf[key] = key;
    }
    return empOf[key];
  };
  var bankAcc = null, bankSys = '';
  if (tr_(p.bankAccId)) {
    bankAcc = c.bank[p.bankAccId];
    if (!bankAcc) throw new Error('حساب بانک/صندوق پیدا نشد.');
    bankSys = DOC_BANK_SYS[bankAcc.Kind] || 'bank';
  }
  var D = 0, C = 0, rows = [];
  lines.forEach(function (l, i) {
    var role = l.role, w = 'ردیف ' + (i + 1) + ': ';
    var deb = doc_int_(l.debit, w + 'بدهکار'), cre = doc_int_(l.credit, w + 'بستانکار');
    if ((deb > 0) === (cre > 0)) throw new Error(w + 'هر ردیف فقط یکی از بدهکار یا بستانکار را دارد.');
    var accId = '', detId = '';
    if (role === 'bank') {
      if (!bankAcc) throw new Error('حساب بانک/صندوق را انتخاب کنید.');
      var ba = null; ac_accOf_(co).forEach(function (a) { if (a.SysKey === bankSys && Number(a.Level) === 3) ba = a; });
      if (!ba) throw new Error('حساب معین بانک/صندوق در کدینگ شرکت پیدا نشد.');
      accId = ba.AccID; detId = bankAcc.AccountID;
    } else {
      accId = cfg.acc[role];
      if (!DOC_DEF_CODE[role] || !accId) throw new Error('حساب مربوط به «' + role + '» در تنظیمات مشخص نشده است.');
    }
    var row = {AccID: accId, DetID: detId, Description: tr_(l.description), Debit: deb || '', Credit: cre || ''};
    if (l.person && l.person.key) { row.PartyType = 'employee'; row.PartyID = needEmp(l.person); }
    D += deb; C += cre; rows.push(row);
  });
  if (D <= 0 || D !== C) throw new Error('سند متوازن نیست: جمع بدهکار ' + fmtNum_(D) + ' و جمع بستانکار ' + fmtNum_(C) + '.');
  /* بازبینی مانده‌ها در سرور (برای پرداخت به کارکنان) */
  var items = [];
  if (kind === 'payroll') {
    pl.employees = (pl.employees || []).map(function (e) { return {empId: needEmp({key: e.key, name: e.name, nationalCode: e.nationalCode}), name: tr_(e.name), net: doc_int_(e.net, 'خالص پرداختنی')}; });
    pl.insurance = doc_int_(pl.insurance || 0, 'بیمه پرداختنی');
    if (!/^\d{4}\/\d{2}$/.test(tr_(p.periodKey))) throw new Error('دوره‌ی حقوق (مثلاً 1405/08) نامعتبر است.');
  } else if (kind === 'payment') {
    var pay = doc_payables_(co), used = {};
    items = (pl.items || []).map(function (e) {
      var id = needEmp({key: e.key, name: e.name}), ap = doc_int_(e.applied, 'مبلغ تسویه‌شده');
      used[id] = (used[id] || 0) + ap;
      return {empId: id, name: tr_(e.name), applied: ap, excess: doc_int_(e.excess || 0, 'اضافه‌پرداخت'), trackingNo: tr_(fa2en_(e.trackingNo || ''))};
    });
    Object.keys(used).forEach(function (id) { if (used[id] > Math.max(0, Math.round(pay.emp[id] || 0)) + 0.5) throw new Error('بدهی باز «' + (c.emp[id] ? c.emp[id].Name : id) + '» از مبلغ تسویه کمتر است؛ صفحه را تازه کنید و دوباره بررسی کنید.'); });
    pl.items = items;
  } else {
    pl.principal = doc_int_(pl.principal || 0, 'اصل بیمه');
    if (tr_(p.periodKey) && !/^\d{4}\/\d{2}$/.test(tr_(p.periodKey))) throw new Error('دوره‌ی بیمه نامعتبر است.');
  }
  var track = []; (p.trackingNos || []).forEach(function (t) { t = tr_(fa2en_(t)); if (t) track.push(t); });
  if (p.unit !== 'rial' && p.unit !== 'toman') throw new Error('واحد مبلغ مشخص نیست.');
  var vr = voucherSave_({company: co, obj: {DateJalali: d.j, Description: tr_(p.description) || DOC_KINDS[kind], Status: 'draft', rows: rows}});
  return locked_(function () {
    var id = nextIds_('DCP', 1)[0], extracted = JSON.stringify(p.extracted || null);
    if (extracted.length > 200000) extracted = extracted.substring(0, 200000);
    pr_setRow_('DocCaptures', 'DCID', id, {DCID: id, CompanyID: co, Kind: kind, FileName: fileName, FileHash: hash, TrackingNos: track.join('|'), PeriodKey: tr_(p.periodKey), VID: vr.VID, Payload: JSON.stringify(pl), Extracted: extracted, Corrections: JSON.stringify(p.corrections || []).substring(0, 100000), ConfirmedBy: tr_(p._who) || 'کاربر', CreatedAt: nowStr_()});
    var v = ac_voucher_(co, vr.VID); v.SrcType = 'doc'; v.SrcID = id; pr_setRow_('Vouchers', 'VID', vr.VID, v);
    bump_();
    return {DCID: id, VID: vr.VID, No: vr.No, RefNo: vr.RefNo, totalDebit: D, createdEmployees: created};
  });
}
