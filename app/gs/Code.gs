/* سامانه ثبت فاکتور خرید معین تراز خوزستان - بک‌اند (Apps Script) */
var APP = 'ثبت فاکتور خرید - معین تراز خوزستان';
var TZ = 'Asia/Tehran';

var H = {
  Companies: ['CompanyID','Name','NationalID','EconomicCode','Notes','IsActive','CreatedAt','UpdatedAt','PersonType','TaxMemoryID','BranchCode','RegNo','Province','City','PostalCode','Address','Phone','KeyID'],
  Suppliers: ['SupplierID','CompanyID','SupplierCode','PersonType','Name','TradeName','CompanyName','NationalID','EconomicCode','RegNo','IdCardNo','NationalCode','Phone','Mobile','Email','Address','Province','City','PostalCode','AccountNo','Sheba','Bank','Notes','IsActive','CreatedAt','UpdatedAt'],
  ProductGroups: ['GroupID','GroupName','IsActive','CompanyID'],
  ProductSubGroups: ['SubGroupID','GroupID','SubGroupName','IsActive','CompanyID'],
  Units: ['UnitID','UnitName','IsActive','MuCode','CompanyID'],
  Customers: ['CustomerID','CompanyID','PersonType','Name','NationalID','EconomicCode','RegNo','PassportNo','Phone','Mobile','Province','City','PostalCode','Address','BranchCode','Notes','IsActive','CreatedAt','UpdatedAt','CustomerCode'],
  Products: ['ProductID','CompanyID','ProductCode','Name','GroupID','SubGroupID','DefaultUnit','Notes','IsActive','CreatedAt','UpdatedAt','SstID','VatRate','OpeningQty','OpeningCost'],
  Services: ['ServiceID','CompanyID','ServiceCode','Name','SstID','DefaultUnit','VatRate','Notes','IsActive','CreatedAt','UpdatedAt'],
  PurchaseInvoices: ['InvoiceID','CompanyID','SupplierID','InvoiceNo','DateJalali','DateGregorian','ItemCount','TotalGross','TotalDiscount','TotalAfterDiscount','TotalVAT','GrandTotal','Source','ImportID','DupKey','CreatedAt','UpdatedAt','TotalCosts','PayableTotal','TotalPaid','Remaining','PayStatus','Notes','DocType','RefInvoiceID'],
  InvoiceCosts: ['CostID','InvoiceID','LineNo','CostType','Payee','Description','Amount','VAT','Total'],
  Payments: ['PaymentID','InvoiceID','LineNo','DateJalali','DateGregorian','Method','Amount','FromAccount','TrackingNo','DestAccount','CardLast4','ChequeNo','SayadNo','ChequeBank','ChequeDueJalali','ChequeDueGregorian','ChequeStatus','Description','AccountID'],
  PurchaseItems: ['ItemID','InvoiceID','LineNo','ProductID','Unit','Quantity','UnitPrice','Gross','Discount','NetAfterDiscount','VAT','LineTotal','Serials'],
  DashboardData: ['Key','Value'],
  Settings: ['Key','Value'],
  ImportLog: ['ImportID','DateTime','FileName','CompanyID','RowsRead','Success','Duplicate','Errors','NewSuppliers','NewProducts','Status'],
  SalesInvoices: ['SaleID','CompanyID','CustomerID','SerialNo','DateJalali','DateGregorian','TimeHM','Inty','Inp','Ins','RefSaleID','RefTaxID','Setm','Cap','Insp','Tprdis','Tdis','Tadis','Tvam','Todam','Tbill','Extra','TaxNo','SendStatus','SendRef','SendError','SentAt','Superseded','ItemCount','Notes','CreatedAt','UpdatedAt'],
  Users: ['UserID','Username','FullName','PasswordHash','Role','Permissions','IsActive','CreatedAt','UpdatedAt','LastLogin','CompanyID','MustChange'],
  Recipes: ['RecipeID','CompanyID','ProductID','Name','OutputQty','Params','IsActive','Notes','StdOverhead','CreatedAt','UpdatedAt'],
  RecipeItems: ['RItemID','RecipeID','LineNo','ProductID','QtyFormula','WastePct','StepNo','Notes'],
  RecipeSteps: ['RStepID','RecipeID','StepNo','Name','WorkCenter','StdMinutes','Instructions','Labor','Checks'],
  ProdOrders: ['OrderID','CompanyID','OrderNo','DateJalali','DateGregorian','RecipeID','ProductID','PlannedQty','ActualQty','Status','SaleID','ParentOrderID','Params','Extra','MaterialCost','LaborCost','OverheadCost','TotalCost','UnitCost','Notes','CreatedAt','UpdatedAt','StartedAt','CompletedAt','DoneDateGregorian','DoneJalali'],
  ProdMaterials: ['PMID','OrderID','LineNo','ProductID','PlannedQty','ActualQty','UnitCost','Cost','StepNo','Notes'],
  ProdSteps: ['PSID','OrderID','StepNo','Name','WorkCenter','Status','StdMinutes','ActualMinutes','StartedAt','DoneAt','Labor','Checks','Notes','Instructions'],
  ProdOverheads: ['POID','OrderID','LineNo','Kind','ExpenseID','Description','Amount'],
  ExpenseInvoices: ['ExpenseID','CompanyID','DocNo','DateJalali','DateGregorian','SupplierID','Payee','Category','Description','Amount','VAT','VATInCost','CostBase','Notes','CreatedAt','UpdatedAt'],
  UserLog: ['LogID','At','Username','FullName','Role','CompanyID','Action','Detail','Result'],
  SalesItems: ['SItemID','SaleID','LineNo','ProductID','Sstid','Sstt','Mu','Am','Fee','Prdis','Dis','Adis','Vra','Vam','Odt','Odr','Odam','Olt','Olr','Olam','Tsstam','Extra']
};
var TEXT = ['FileHash','TrackingNos','PeriodKey','AtfNum','AtfTxt','AtfDate','RefNo','Serials','OrderNo','DocNo','DoneJalali','DoneDateGregorian','Username','ServiceCode','CustomerCode','SerialNo','TaxNo','RefTaxID','TimeHM','SendRef','Sstid','Mu','TaxMemoryID','KeyID','PassportNo','BranchCode','SstID','MuCode','InvoiceNo','DateJalali','DateGregorian','DupKey','SupplierCode','ProductCode','NationalID','EconomicCode','RegNo','IdCardNo','NationalCode','Phone','Mobile','PostalCode','AccountNo','Sheba','CreatedAt','UpdatedAt','Value','FromAccount','TrackingNo','DestAccount','CardLast4','ChequeNo','SayadNo','ChequeDueJalali','ChequeDueGregorian','Code','CardNo','PosNo','SwitchNo','TerminalNo','MerchantNo','Branch','No','Ref','SrcKey','SrcID','DueJalali','DueGregorian','StatusDate','OpeningDate','Time'];
var METHODS = ['نقد','کارت‌به‌کارت','انتقال بانکی','چک','کارتخوان (POS)','تهاتر / تسویه حساب','سایر'];
var CHQ = ['در جریان وصول','پاس شده','برگشتی'];
var KEY = {Customers:'CustomerID',Companies:'CompanyID',Suppliers:'SupplierID',Products:'ProductID',Services:'ServiceID',Users:'UserID',ProductGroups:'GroupID',ProductSubGroups:'SubGroupID',Units:'UnitID'};
var NAMEF = {Customers:'Name',Companies:'Name',Suppliers:'Name',Products:'Name',Services:'Name',Users:'Username',ProductGroups:'GroupName',ProductSubGroups:'SubGroupName',Units:'UnitName'};
var SCOPED_ = ['Suppliers','Products','Services','Customers','ProductGroups','ProductSubGroups','Units'];
var CODEF = {Customers:'CustomerCode',Suppliers:'SupplierCode',Products:'ProductCode'};
var PF = {Customers:'CUS',SalesInvoices:'SIN',SalesItems:'SIT',Companies:'CMP',Suppliers:'SUP',Products:'PRD',Services:'SRV',Users:'USR',ProductGroups:'GRP',ProductSubGroups:'SGR',Units:'UNT',PurchaseInvoices:'INV',PurchaseItems:'ITM'};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index').setTitle(APP)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ===== نصب اولیه: یک بار اجرا شود ===== */
function setupSystem() {
  var ss = SpreadsheetApp.getActive();
  var first = ss.getSheets()[0];
  if (first && !H[first.getName()] && first.getName() !== 'README') first.setName('README');
  var rd = ss.getSheetByName('README');
  if (rd) rd.getRange('A1').setValue('این فایل دیتابیس سامانه است. Sheetها مخفی هستند. لطفاً داده‌ها را مستقیم ویرایش نکنید.');
  ensureSheets_();
  if (getSet_('DefaultVatRate') === '') setSet_('DefaultVatRate', '10');
  if (getSet_('AccessCode') === '') setSet_('AccessCode', '');
  if (getSet_('Units_Seeded') === '') {
    setSet_('Units_Seeded', '1');
  }
  Object.keys(H).forEach(function (n) {
    var s = ss.getSheetByName(n);
    if (s.getProtections(SpreadsheetApp.ProtectionType.SHEET).length === 0) s.protect().setWarningOnly(true);
    s.hideSheet();
  });
  setSet_('SchemaVer', '20');
  Logger.log('نصب با موفقیت انجام شد. حالا Deploy کنید.');
  return 'OK';
}

function ensureSheets_() {
  var ss = SpreadsheetApp.getActive();
  Object.keys(H).forEach(function (n) {
    var s = ss.getSheetByName(n), isNew = !s;
    if (isNew) s = ss.insertSheet(n);
    s.getRange(1, 1, 1, H[n].length).setValues([H[n]]).setFontWeight('bold');
    s.setFrozenRows(1);
    H[n].forEach(function (h, i) {
      if (TEXT.indexOf(h) >= 0) s.getRange(1, i + 1, s.getMaxRows(), 1).setNumberFormat('@');
    });
    if (isNew) { try { s.protect().setWarningOnly(true); s.hideSheet(); } catch (e) {} }
  });
}
function normInv_(r) {
  r.DocType = r.DocType === 'return' ? 'return' : 'purchase';
  var gt = Number(r.GrandTotal) || 0;
  r.TotalCosts = Number(r.TotalCosts) || 0;
  r.PayableTotal = r2_(gt + r.TotalCosts);
  r.TotalPaid = Number(r.TotalPaid) || 0;
  r.Remaining = r2_(r.PayableTotal - r.TotalPaid);
  r.PayStatus = payStatus_(r.PayableTotal, r.TotalPaid);
  return r;
}
function payStatus_(payable, paid) {
  if (payable <= 0.005 || paid >= payable - 0.005) return 'تسویه';
  return paid > 0.005 ? 'بخشی پرداخت' : 'پرداخت‌نشده';
}

/* ===== ابزارهای پایه ===== */
function sh_(n) { return SpreadsheetApp.getActive().getSheetByName(n); }
function nowStr_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function rows_(n) {
  var v = sh_(n).getDataRange().getValues(), h = v[0];
  return v.slice(1).map(function (r) {
    var o = {};
    h.forEach(function (k, i) { var x = r[i]; o[k] = (x instanceof Date) ? x.toISOString() : x; });
    return o;
  });
}
function getSet_(k) {
  var v = sh_('Settings').getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (v[i][0] === k) return String(v[i][1]);
  return '';
}
function setSet_(k, val) {
  var s = sh_('Settings'), v = s.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (v[i][0] === k) { s.getRange(i + 1, 2).setValue(String(val)); return; }
  appendRows_(s, [[k, String(val)]]);
}
function locked_(f) {
  var l = LockService.getScriptLock();
  l.waitLock(30000);
  try { return f(); } finally { l.releaseLock(); }
}
function nextIds_(p, n) {
  var k = 'cnt_' + p, cur = Number(getSet_(k)) || 0, out = [];
  setSet_(k, cur + n);
  for (var i = 1; i <= n; i++) out.push(p + '-' + ('000000' + (cur + i)).slice(-6));
  return out;
}
function findRow_(s, id) {
  var last = s.getLastRow();
  if (last < 2) return 0;
  var f = s.getRange(1, 1, last, 1).createTextFinder(id).matchEntireCell(true).findNext();
  return f ? f.getRow() : 0;
}
function appendRows_(s, rows) {
  if (!rows.length) return;
  var last = s.getLastRow(), need = last + rows.length;
  if (need > s.getMaxRows()) s.insertRowsAfter(s.getMaxRows(), need - s.getMaxRows() + 500);
  s.getRange(last + 1, 1, rows.length, rows[0].length).setValues(rows);
}
function fa2en_(s) {
  return String(s == null ? '' : s).replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 1776; })
    .replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 1632; });
}
function normNo_(s) { return fa2en_(s).replace(/\s+/g, '').toLowerCase(); }
function r2_(x) { return Math.round((x + 1e-9) * 100) / 100; }
function dec2_(x) { return Math.abs(x * 100 - Math.round(x * 100)) < 1e-6; }

/* تاریخ شمسی به میلادی */
function j2g_(jy, jm, jd) {
  jy += 1595;
  var days = -355668 + (365 * jy) + (~~(jy / 33)) * 8 + ~~(((jy % 33) + 3) / 4) + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  var gy = 400 * ~~(days / 146097);
  days %= 146097;
  if (days > 36524) { gy += 100 * ~~(--days / 36524); days %= 36524; if (days >= 365) days++; }
  gy += 4 * ~~(days / 1461);
  days %= 1461;
  if (days > 365) { gy += ~~((days - 1) / 365); days = (days - 1) % 365; }
  var gd = days + 1;
  var sal = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var gm;
  for (gm = 0; gm < 13; gm++) { var v = sal[gm]; if (gd <= v) break; gd -= v; }
  return [gy, gm, gd];
}
function parseJ_(s) {
  var m = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/.exec(fa2en_(s).trim());
  if (!m) return null;
  var y = +m[1], mo = +m[2], d = +m[3];
  if (y < 1300 || y > 1500 || mo < 1 || mo > 12 || d < 1 || d > (mo <= 6 ? 31 : (mo <= 11 ? 30 : 30))) return null;
  var g = j2g_(y, mo, d), p = function (x) { return ('0' + x).slice(-2); };
  return {j: y + '/' + p(mo) + '/' + p(d), g: g[0] + '-' + p(g[1]) + '-' + p(g[2])};
}

/* ===== نقطه ورود API ===== */
function api(token, action, p) {
  try {
    /* احراز هویت در server.js انجام می‌شود */
    if (getSet_('SchemaVer') !== '20') locked_(function () { if (getSet_('SchemaVer') !== '20') { ensureSheets_(); setSet_('SchemaVer', '20'); } });
    p = p || {}; FY_PENDING = [];
    var d, acCo = AC_HOOK[action] ? ac_hintCo_(action, p) : '';
    if (acCo && FY_GUARD[action]) fy_guard_(acCo, action, p);
    switch (action) {
      case 'bootstrap': d = boot_(); break;
      case 'save': if (p.sheet === 'Users') throw new Error('مدیریت کاربران فقط از بخش «کاربران» انجام می‌شود.'); d = saveEntity_(p.sheet, p.obj); break;
      case 'saveInvoice': d = saveInvoice_(p); break;
      case 'getInvoice': d = getInvoice_(p.id); break;
      case 'listInvoices': d = listInvoices_(p); break;
      case 'deleteEntity': d = deleteEntity_(p); break;
      case 'madeGoods': d = madeGoods_(p); break;
      case 'madeDetail': d = madeDetail_(p); break;
      case 'partyReport': d = partyReport_(p); break;
      case 'partyStatement': d = partyStatement_(p); break;
      case 'prodCfgGet': d = prodCfgGet_(p); break;
      case 'prodCfgSave': d = prodCfgSave_(p); break;
      case 'recipeList': d = recipeList_(p); break;
      case 'recipeGet': d = recipeGet_(p); break;
      case 'recipeSave': d = recipeSave_(p); break;
      case 'recipeDelete': d = recipeDelete_(p); break;
      case 'recipePreview': d = recipePreview_(p); break;
      case 'prodList': d = prodList_(p); break;
      case 'prodGet': d = prodGet_(p); break;
      case 'prodCreate': d = prodCreate_(p); break;
      case 'prodSave': d = prodSave_(p); break;
      case 'prodStatus': d = prodStatus_(p); break;
      case 'prodDelete': d = prodDelete_(p); break;
      case 'prodFromSale': d = prodFromSale_(p); break;
      case 'expenseList': d = expenseList_(p); break;
      case 'expenseSave': d = expenseSave_(p); break;
      case 'expenseDelete': d = expenseDelete_(p); break;
      case 'csCfgGet': d = csCfgGet_(p); break;
      case 'csRuleSave': d = csRuleSave_(p); break;
      case 'csList': d = csList_(p); break;
      case 'csSave': d = csSave_(p); break;
      case 'csDelete': d = csDelete_(p); break;
      case 'csCard': d = csCard_(p); break;
      case 'csIssuePreview': d = csIssuePreview_(p); break;
      case 'csLots': d = csLots_(p); break;
      case 'csLaborRates': d = csLaborRates_(p); break;
      case 'csLaborRun': d = csLaborRun_(p); break;
      case 'csLaborUndo': d = csLaborUndo_(p); break;
      case 'csStmtCalc': d = csStmtCalc_(p); break;
      case 'csStmtStatus': d = csStmtStatus_(p); break;
      case 'csMachRates': d = csMachRates_(p); break;
      case 'csMachRun': d = csMachRun_(p); break;
      case 'csMachUndo': d = csMachUndo_(p); break;
      case 'csDeprSched': d = csDeprSched_(p); break;
      case 'csMobRates': d = csMobRates_(p); break;
      case 'csMobRun': d = csMobRun_(p); break;
      case 'csMobUndo': d = csMobUndo_(p); break;
      case 'csOhRates': d = csOhRates_(p); break;
      case 'csOhRun': d = csOhRun_(p); break;
      case 'csOhUndo': d = csOhUndo_(p); break;
      case 'csOhYear': d = csOhYear_(p); break;
      case 'csOhYearPost': d = csOhYearPost_(p); break;
      case 'csOhYearUndo': d = csOhYearUndo_(p); break;
      case 'csProg': d = csProg_(p); break;
      case 'csPostPreview': d = csPostPreview_(p); break;
      case 'csPostRun': d = csPostRun_(p); break;
      case 'csPostUndo': d = csPostUndo_(p); break;
      case 'csPostList': d = csPostList_(p); break;
      case 'csRep6': d = csRep6_(p); break;
      case 'csVerify6': d = csVerify6_(p); break;
      case 'deleteInvoice': d = deleteInvoice_(p.id); break;
      case 'dashboard': d = dashboard_(p); break;
      case 'setSettings': d = setSettings_(p); break;
      case 'import': d = imp_(p); break;
      case 'scanExtract': d = scanExtract_(p); break;
      case 'scanFromJson': d = scanFromJson_(p); break;
      case 'scanPreview': d = scanPreview_(p.company, p.inv, false); break;
      case 'scanCommit': d = scanCommit_(p); break;
      case 'setApiKey': d = setApiKey_(p); break;
      case 'seedTest': d = seedTest_(); break;
      case 'deleteTest': d = deleteTest_(); break;
      case 'saveSale': d = saveSale_(p); break;
      case 'getSale': d = getSale_(p.id); break;
      case 'listSales': d = listSales_(p); break;
      case 'deleteSale': d = deleteSale_(p.id); break;
      case 'saleStatus': d = setSaleStatus_(p); break;
      case 'saleJson': d = saleJson_(p); break;
      case 'saleDefaults': d = sl_defaults_(p); break;
      case 'stock': d = stockReport_(p); break;
      case 'stockDetail': d = stockDetail_(p); break;
      case 'setCompanyKey': d = setCompanyKey_(p); break;
      case 'setCompanyCert': d = setCompanyCert_(p); break;
      case 'autoCodes': d = autoProductCodes_(p); break;
      case 'salesToPurchase': d = salesToPurchase_(p); break;
      case 'bankAccList': d = bankAccList_(p); break;
      case 'bankAccSave': d = bankAccSave_(p); break;
      case 'bankAccDelete': d = bankAccDelete_(p); break;
      case 'bankLedger': d = bankLedger_(p); break;
      case 'bankTxSave': d = bankTxSave_(p); break;
      case 'bankTxDelete': d = bankTxDelete_(p); break;
      case 'transferList': d = transferList_(p); break;
      case 'transferSave': d = transferSave_(p); break;
      case 'transferDelete': d = transferDelete_(p); break;
      case 'chequeList': d = chequeList_(p); break;
      case 'chequeSave': d = chequeSave_(p); break;
      case 'chequeDelete': d = chequeDelete_(p); break;
      case 'chequeStatus': d = chequeStatus_(p); break;
      case 'docPayGet': d = docPayGet_(p); break;
      case 'docPaySave': d = docPaySave_(p); break;
      case 'accTree': d = accTree_(p); break;
      case 'accSave': d = accSave_(p); break;
      case 'accDelete': d = accDelete_(p); break;
      case 'accReseed': d = accReseed_(p); break;
      case 'accDimList': d = accDimList_(p); break;
      case 'accDimSave': d = accDimSave_(p); break;
      case 'accDimDelete': d = accDimDelete_(p); break;
      case 'accOptions': d = accOptions_(p); break;
      case 'docInit': d = docInit_(p); break;
      case 'docSettingsSave': d = docSettingsSave_(p); break;
      case 'docCheck': d = docCheck_(p); break;
      case 'docCommit': d = docCommit_(p); break;
      case 'voucherList': d = voucherList_(p); break;
      case 'voucherGet': d = voucherGet_(p); break;
      case 'voucherSave': d = voucherSave_(p); break;
      case 'voucherDelete': d = voucherDelete_(p); break;
      case 'voucherStatus': d = voucherStatus_(p); break;
      case 'voucherRenumber': d = voucherRenumber_(p); break;
      case 'report': d = report_(p); break;
      case 'yearList': d = yearList_(p); break;
      case 'yearCheck': d = yearCheck_(p); break;
      case 'yearClose': d = yearClose_(p); break;
      case 'yearOpen': d = yearOpen_(p); break;
      case 'yearSave': d = yearSave_(p); break;
      case 'userLog': d = userLog_(p); break;
      case 'accTrial': d = accTrial_(p); break;
      case 'accLedger': d = accLedger_(p); break;
      case 'autoRebuild': d = autoRebuild_(p); break;
      case 'backup': d = backup_(); break;
      default: throw new Error('عملیات نامعتبر است.');
    }
    fy_flushDirty_();
    if (acCo && action !== 'autoRebuild') ac_afterAction_(acCo);
    return {ok: true, data: d};
  } catch (e) { return {ok: false, error: String(e.message || e)}; }
}
function saveEntityX_(p) { return saveEntity_(p.sheet, p.obj); }
function saveUser_(o) {
  if (o.UserID && !o.Username) {
    var u = rows_('Users').filter(function (x) { return x.UserID === o.UserID; })[0];
    if (!u) throw new Error('کاربر پیدا نشد.');
    o.Username = u.Username;
  }
  return saveEntity_('Users', o);
}
function boot_() {
  return {
    companies: rows_('Companies').map(function (r) { r.HasPrivateKey = hasCompanyKey_(r.CompanyID); r.HasCert = hasCompanyCert_(r.CompanyID); return r; }), customers: rows_('Customers'), suppliers: rows_('Suppliers'), products: rows_('Products'), services: rows_('Services'),
    groups: rows_('ProductGroups'), subs: rows_('ProductSubGroups'), units: rows_('Units'),
    vat: Number(getSet_('DefaultVatRate')) || 0, vats: cfgMap_(function (c) { return vat_(c); }), envs: cfgMap_(function (c) { return moEnvOf_(c); }), keys: cfgMap_(function (c) { return !!aiKeyOwn_(c); }),
    hasKey: !!PropertiesService.getScriptProperties().getProperty('ANTHROPIC_KEY'), aiShared: getSet_('AiShared') === '1', globalEnv: getSet_('MoEnv') === 'prod' ? 'prod' : 'sandbox'
  };
}
/* ===== تنظیمات هر شرکت (با پیش‌فرض سراسری) ===== */
function cfgMap_(f) { var o = {}; rows_('Companies').forEach(function (c) { o[c.CompanyID] = f(c.CompanyID); }); return o; }
function vat_(co) { var v = co ? getSet_('DefaultVatRate_' + co) : ''; if (v === '' || v == null) v = getSet_('DefaultVatRate'); return Number(v) || 0; }
function moEnvOf_(co) { var v = co ? getSet_('MoEnv_' + co) : ''; if (v !== 'prod' && v !== 'sandbox') v = getSet_('MoEnv'); return v === 'prod' ? 'prod' : 'sandbox'; }
function aiKeyOwn_(co) { return co ? PropertiesService.getScriptProperties().getProperty('ANTHROPIC_KEY_' + co) : null; }
function aiKeyFor_(co) { var k = aiKeyOwn_(co); if (k) return k; return getSet_('AiShared') === '1' ? PropertiesService.getScriptProperties().getProperty('ANTHROPIC_KEY') : null; }
function setSettings_(p) {
  return locked_(function () {
    if (p.vat !== undefined) {
      var v = Number(fa2en_(p.vat));
      if (isNaN(v) || v < 0 || v > 100) throw new Error('نرخ مالیات نامعتبر است.');
      if (p.global) setSet_('DefaultVatRate', v); else if (p.company) setSet_('DefaultVatRate_' + p.company, v); else throw new Error('شرکت مشخص نیست.');
    }
    if (p.aiShared !== undefined && p.global) setSet_('AiShared', p.aiShared ? '1' : '');
    return boot_();
  });
}
function backup_() {
  var f = DriveApp.getFileById(SpreadsheetApp.getActive().getId());
  var c = f.makeCopy('Backup - ' + f.getName() + ' - ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH-mm'));
  return {name: c.getName(), url: c.getUrl()};
}

/* ===== ثبت و ویرایش موجودیت‌ها ===== */
/* ===== حذف رکورد پایه (مشتری، فروشنده، کالا، خدمت، گروه، واحد، شرکت) =====
   اگر رکورد در جایی استفاده شده باشد حذف نمی‌شود و دلیل دقیق (با تعداد) گفته می‌شود. */
function deleteEntity_(p) {
  var n = p.sheet, id = p.id, OK = ['Customers', 'Suppliers', 'Products', 'Services', 'ProductGroups', 'ProductSubGroups', 'Units', 'Companies'];
  if (OK.indexOf(n) < 0 || !id) throw new Error('نوع رکورد نامعتبر است.');
  return locked_(function () {
    var rec = rows_(n).filter(function (x) { return x[KEY[n]] === id; })[0];
    if (!rec) throw new Error('رکورد پیدا نشد (شاید قبلاً حذف شده است).');
    var co = n === 'Companies' ? id : rec.CompanyID, use = [], name = rec[NAMEF[n]] || id;
    var mv = null, man = function (r) { if (!mv) { mv = {}; rows_('Vouchers').forEach(function (v) { if (String(v.Source) !== 'auto') mv[v.VID] = 1; }); } return !!mv[r.VID]; };
    var cnt = function (sheet, fn) { return rows_(sheet).filter(fn).length; };
    var add = function (c, t) { if (c > 0) use.push(c + ' ' + t); };
    var colHas = function (sheet, col, v) { var x = sl_cols_(sheet, [col])[col], c = 0; for (var i = 0; i < x.length; i++) if (String(x[i]) === v) c++; return c; };
    var textHas = function (sheet, col, needle) { return rows_(sheet).filter(function (r) { return String(r[col] || '').indexOf(needle) >= 0; }).length; };
    if (n === 'Customers') add(cnt('VoucherRows', function (r) { return man(r) && r.PartyType === 'customer' && r.PartyID === id; }), 'ردیف سند حسابداری');
    if (n === 'Suppliers') add(cnt('VoucherRows', function (r) { return man(r) && r.PartyType === 'supplier' && r.PartyID === id; }), 'ردیف سند حسابداری');
    if (n === 'Products') add(cnt('VoucherRows', function (r) { return man(r) && r.DetKind === 'product' && r.DetID === id; }), 'ردیف سند حسابداری');
    if (n === 'Customers') add(cnt('Cheques', function (r) { return r.PartyID === id; }), 'چک');
    if (n === 'Suppliers') add(cnt('Cheques', function (r) { return r.PartyID === id; }), 'چک');
    if (n === 'Customers') add(cnt('SalesInvoices', function (r) { return r.CustomerID === id; }), 'فاکتور فروش');
    if (n === 'Suppliers') {
      add(cnt('PurchaseInvoices', function (r) { return r.SupplierID === id; }), 'فاکتور خرید');
      add(cnt('ExpenseInvoices', function (r) { return r.SupplierID === id; }), 'فاکتور هزینه');
    }
    if (n === 'Products' || n === 'Services') {
      add(colHas('PurchaseItems', 'ProductID', id), 'قلم فاکتور خرید');
      add(colHas('SalesItems', 'ProductID', id), 'قلم فاکتور فروش');
      add(cnt('Recipes', function (r) { return r.ProductID === id; }), 'فرمول ساخت (به‌عنوان محصول)');
      add(cnt('RecipeItems', function (r) { return r.ProductID === id; }), 'ردیف مواد در فرمول ساخت');
      add(cnt('ProdOrders', function (r) { return r.ProductID === id; }), 'سفارش تولید');
      add(cnt('ProdMaterials', function (r) { return r.ProductID === id; }), 'ردیف مواد در سفارش تولید');
      if (n === 'Services') {
        add(textHas('RecipeSteps', 'Labor', '"serviceId":"' + id + '"'), 'مرحله‌ی فرمول ساخت (دستمزد)');
        add(textHas('ProdSteps', 'Labor', '"serviceId":"' + id + '"'), 'مرحله‌ی سفارش تولید (دستمزد)');
      }
    }
    if (n === 'ProductGroups') {
      add(cnt('Products', function (r) { return r.GroupID === id; }), 'کالا');
      add(cnt('ProductSubGroups', function (r) { return r.GroupID === id; }), 'گروه فرعی');
    }
    if (n === 'ProductSubGroups') add(cnt('Products', function (r) { return r.SubGroupID === id; }), 'کالا');
    if (n === 'Units') {
      var un = rec.UnitName;
      add(cnt('Products', function (r) { return r.CompanyID === co && r.DefaultUnit === un; }), 'کالا');
      add(cnt('Services', function (r) { return r.CompanyID === co && r.DefaultUnit === un; }), 'خدمت');
      var pinv = {}; rows_('PurchaseInvoices').forEach(function (r) { if (r.CompanyID === co) pinv[r.InvoiceID] = 1; });
      add(cnt('PurchaseItems', function (r) { return pinv[r.InvoiceID] && r.Unit === un; }), 'قلم فاکتور خرید');
    }
    if (n === 'Companies') {
      ['Customers', 'Suppliers', 'Products', 'Services', 'PurchaseInvoices', 'SalesInvoices', 'Recipes', 'ProdOrders', 'ExpenseInvoices', 'BankAccounts'].forEach(function (sh) {
        var t = {BankAccounts: 'حساب بانک/صندوق/تنخواه', Customers: 'مشتری', Suppliers: 'فروشنده', Products: 'کالا', Services: 'خدمت', PurchaseInvoices: 'فاکتور خرید', SalesInvoices: 'فاکتور فروش', Recipes: 'فرمول ساخت', ProdOrders: 'سفارش تولید', ExpenseInvoices: 'فاکتور هزینه'}[sh];
        add(cnt(sh, function (r) { return r.CompanyID === id; }), t);
      });
    }
    if (use.length) throw new Error('«' + name + '» حذف نمی‌شود، چون در این موارد استفاده شده است: ' + use.join('، ') + '.\nابتدا آن موارد را حذف یا اصلاح کنید؛ یا به‌جای حذف، وضعیت این رکورد را «غیرفعال» کنید.');
    var colOf = function (sheet, f) { return H[sheet].indexOf(f) + 1; };
    if (n === 'Companies') {
      /* واحدها و گروه‌های پیش‌فرض و کاربر ورود همین شرکت هم حذف می‌شود */
      ['Units', 'ProductGroups', 'ProductSubGroups', 'Users'].forEach(function (sh) { delWhere_(sh, colOf(sh, 'CompanyID'), function (v) { return v === id; }); });
    }
    delWhere_(n, 1, function (v) { return v === id; });
    bump_();
    return {deleted: 1, name: name};
  });
}
function saveEntity_(n, o) {
  if (!KEY[n]) throw new Error('نوع رکورد نامعتبر است.');
  if (!String(o[NAMEF[n]] || '').trim()) throw new Error('نام الزامی است.');
  if (SCOPED_.indexOf(n) >= 0 && !o.CompanyID) throw new Error('ابتدا شرکت را انتخاب کنید.');
  if (n === 'Products') {
    ['OpeningQty', 'OpeningCost'].forEach(function (k) {
      if (!o.hasOwnProperty(k)) return;
      var raw = fa2en_(String(o[k] == null ? '' : o[k]).replace(/[٬،,\s]/g, '').replace(/٫/g, '.'));
      if (raw === '') { o[k] = ''; return; }
      var v = Number(raw);
      if (!isFinite(v) || v < 0) throw new Error((k === 'OpeningQty' ? 'موجودی اولیه' : 'بهای واحد موجودی اولیه') + ' باید عدد صفر یا بزرگ‌تر باشد.');
      o[k] = v;
    });
    if (o.OpeningCost !== undefined && o.OpeningCost !== '' && !(Number(o.OpeningQty) > 0)) o.OpeningCost = '';
  }
  if (n === 'ProductSubGroups' && !o.GroupID) throw new Error('گروه اصلی را انتخاب کنید.');
  if (n === 'ProductSubGroups') {
    var pg = rows_('ProductGroups').filter(function (g) { return g.GroupID === o.GroupID; })[0];
    if (!pg || pg.CompanyID !== o.CompanyID) throw new Error('گروه اصلی انتخاب‌شده متعلق به این شرکت نیست.');
  }
  if (o[KEY[n]] && SCOPED_.indexOf(n) >= 0) {
    var cur = rows_(n).filter(function (x) { return x[KEY[n]] === o[KEY[n]]; })[0];
    if (cur && cur.CompanyID && cur.CompanyID !== o.CompanyID) throw new Error('این رکورد متعلق به شرکت دیگری است.');
  }
  return locked_(function () {
    var s = sh_(n), h = H[n], now = nowStr_(), id = o[KEY[n]], row;
    if (id) {
      var r = findRow_(s, id);
      if (!r) throw new Error('رکورد پیدا نشد.');
      var old = s.getRange(r, 1, 1, h.length).getValues()[0];
      row = h.map(function (k, i) { return k === 'UpdatedAt' ? now : (o.hasOwnProperty(k) ? o[k] : old[i]); });
      s.getRange(r, 1, 1, h.length).setValues([row]);
      bump_();
      return o;
    }
    id = nextIds_(PF[n], 1)[0];
    o[KEY[n]] = id;
    if (CODEF[n] && !String(o[CODEF[n]] || '').trim()) o[CODEF[n]] = nextCode_(n, o);
    row = h.map(function (k) {
      if (k === KEY[n]) return id;
      if (k === 'CreatedAt' || k === 'UpdatedAt') return now;
      if (k === 'IsActive') return o.IsActive !== false;
      return o.hasOwnProperty(k) ? o[k] : '';
    });
    appendRows_(s, [row]);
    if (n === 'Companies') seedUnits_(id);
    bump_();
    return o;
  });
}

/* ===== فاکتور ===== */
function saveInvoice_(p) {
  var errs = [];
  if (p.InvoiceID && p.DocType === undefined) {
    var ex0 = rows_('PurchaseInvoices').filter(function (r) { return r.InvoiceID === p.InvoiceID; })[0];
    if (ex0 && ex0.DocType === 'return') { p.DocType = 'return'; p.RefInvoiceID = ex0.RefInvoiceID; }
  }
  if (!p.CompanyID) errs.push('شرکت انتخاب نشده است.');
  if (!p.SupplierID) errs.push('فروشنده انتخاب نشده است.');
  if (!String(p.InvoiceNo || '').trim()) errs.push('شماره فاکتور الزامی است.');
  var dt = parseJ_(p.DateJalali);
  if (!dt) errs.push('تاریخ شمسی نامعتبر است (قالب: 1405/07/09).');
  if (!p.items || !p.items.length) errs.push('حداقل یک ردیف کالا لازم است.');
  var isRet = p.DocType === 'return', refId = isRet ? tr_(p.RefInvoiceID) : '';
  var lines = [], T = {g: 0, d: 0, n: 0, v: 0, t: 0};
  var okIds = {};
  rows_('Products').forEach(function (x) { if (x.CompanyID === p.CompanyID) okIds[x.ProductID] = 1; });
  rows_('Services').forEach(function (x) { if (x.CompanyID === p.CompanyID) okIds[x.ServiceID] = 1; });
  (p.items || []).forEach(function (it, i) {
    var k = 'ردیف ' + (i + 1) + ': ';
    var q = Number(it.Quantity), pr = Number(it.UnitPrice), d = Number(it.Discount || 0), v = Number(it.VAT || 0);
    if (!it.ProductID) errs.push(k + 'کالا یا خدمت انتخاب نشده است.');
    else if (!okIds[it.ProductID] && !(p.dry && it.ProductID === 'NEW')) errs.push(k + 'کالا/خدمت انتخاب‌شده در این شرکت وجود ندارد.');
    if (!(q > 0) || !dec2_(q)) errs.push(k + 'تعداد باید بزرگ‌تر از صفر و حداکثر دو رقم اعشار باشد.');
    if (isNaN(pr) || pr < 0 || !dec2_(pr)) errs.push(k + 'قیمت واحد نامعتبر است.');
    if (isNaN(d) || d < 0 || !dec2_(d)) errs.push(k + 'تخفیف نامعتبر است.');
    if (isNaN(v) || v < 0 || !dec2_(v)) errs.push(k + 'مالیات نامعتبر است.');
    var g = r2_(q * pr);
    if (d > g) errs.push(k + 'تخفیف از مبلغ ناخالص بیشتر است.');
    var n = r2_(g - d), t = r2_(n + v);
    var sers = rp_serials_(it.Serials);
    if (sers.length > q + 1e-9) errs.push(k + 'تعداد شماره سریال‌ها (' + sers.length + ') از تعداد کالا (' + q + ') بیشتر است.');
    var dupS = {}; sers.forEach(function (x) { dupS[x] = (dupS[x] || 0) + 1; });
    Object.keys(dupS).forEach(function (x) { if (dupS[x] > 1) errs.push(k + 'سریال «' + x + '» تکراری وارد شده است.'); });
    lines.push({ProductID: it.ProductID, Unit: it.Unit || '', Quantity: q, UnitPrice: pr, Gross: g, Discount: d, Net: n, VAT: v, Total: t, Serials: sers.join('\n')});
    T.g += g; T.d += d; T.n += n; T.v += v; T.t += t;
  });
  if (isRet && refId) {
    var rf = rows_('PurchaseInvoices').filter(function (r) { return r.InvoiceID === refId; })[0];
    if (!rf) errs.push('فاکتور خرید اصلی پیدا نشد.');
    else if (rf.CompanyID !== p.CompanyID) errs.push('فاکتور خرید اصلی متعلق به شرکت دیگری است.');
    else if (rf.DocType === 'return') errs.push('فاکتور برگشت از خرید را نمی‌توان مرجع قرار داد.');
    else {
      if (rf.SupplierID !== p.SupplierID) errs.push('فروشنده با فروشنده‌ی فاکتور خرید اصلی یکی نیست.');
      var bought = {}, back = {}, pur = {};
      rows_('PurchaseItems').forEach(function (it) { if (it.InvoiceID === refId) bought[it.ProductID] = (bought[it.ProductID] || 0) + Number(it.Quantity); });
      rows_('PurchaseInvoices').forEach(function (r) { if (r.DocType === 'return' && r.RefInvoiceID === refId && r.InvoiceID !== p.InvoiceID) pur[r.InvoiceID] = 1; });
      rows_('PurchaseItems').forEach(function (it) { if (pur[it.InvoiceID]) back[it.ProductID] = (back[it.ProductID] || 0) + Number(it.Quantity); });
      var now_ = {}; lines.forEach(function (l) { now_[l.ProductID] = (now_[l.ProductID] || 0) + l.Quantity; });
      Object.keys(now_).forEach(function (pid) {
        var left = r2_((bought[pid] || 0) - (back[pid] || 0));
        if (now_[pid] > left + 1e-9) errs.push('تعداد برگشتی «' + pidName_(pid) + '» (' + now_[pid] + ') از مانده‌ی قابل برگشت همان فاکتور (' + left + ') بیشتر است.');
      });
    }
  }
  var costs = [], TC = 0;
  (p.costs || []).forEach(function (c, i) {
    var k = 'هزینه ' + (i + 1) + ': ', a = Number(c.Amount), v = Number(c.VAT || 0);
    if (!tr_(c.CostType)) errs.push(k + 'نوع هزینه انتخاب نشده است.');
    if (isNaN(a) || a < 0 || !dec2_(a)) errs.push(k + 'مبلغ نامعتبر است.');
    if (isNaN(v) || v < 0 || !dec2_(v)) errs.push(k + 'مالیات نامعتبر است.');
    if (tr_(c.CostType) === 'سایر' && !tr_(c.Description)) errs.push(k + 'برای نوع «سایر» توضیح لازم است.');
    var tt = r2_(a + v); TC += tt;
    costs.push({t: tr_(c.CostType), payee: tr_(c.Payee), desc: tr_(c.Description), a: a, v: v, tt: tt});
  });
  var payable = r2_(T.t + TC), pays = [], PD = 0;
  (p.payments || []).forEach(function (y, i) {
    var k = 'پرداخت ' + (i + 1) + ': ', d = parseJ_(y.DateJalali), a = Number(y.Amount), m = tr_(y.Method), due = null;
    var cs = tr_(y.ChequeStatus) || CHQ[0];
    if (!d) errs.push(k + 'تاریخ نامعتبر است.');
    if (METHODS.indexOf(m) < 0) errs.push(k + 'روش پرداخت نامعتبر است.');
    if (isNaN(a) || !(a > 0) || !dec2_(a)) errs.push(k + 'مبلغ نامعتبر است.');
    if (m === 'چک') {
      if (!tr_(y.ChequeNo) && !tr_(y.SayadNo)) errs.push(k + 'شماره چک یا شماره صیادی لازم است.');
      due = parseJ_(y.ChequeDueJalali);
      if (!due) errs.push(k + 'تاریخ سررسید چک نامعتبر است.');
      if (CHQ.indexOf(cs) < 0) errs.push(k + 'وضعیت چک نامعتبر است.');
    }
    if (m === 'کارت‌به‌کارت' && tr_(y.CardLast4) && !/^\d{4}$/.test(fa2en_(tr_(y.CardLast4)))) errs.push(k + 'فقط چهار رقم آخر کارت را وارد کنید.');
    if (tr_(y.AccountID) && !rows_('BankAccounts').some(function (x) { return x.AccountID === tr_(y.AccountID) && x.CompanyID === p.CompanyID; })) errs.push(k + 'حساب بانک/صندوق انتخاب‌شده در این شرکت وجود ندارد.');
    if (!(m === 'چک' && cs === 'برگشتی')) PD += a;
    pays.push({y: y, d: d, due: due, m: m, a: a, cs: m === 'چک' ? cs : ''});
  });
  PD = r2_(PD);
  if (PD > payable + 0.005) errs.push('جمع پرداخت‌ها (' + PD + ') از مبلغ قابل پرداخت (' + payable + ') بیشتر است.');
  if (errs.length) throw new Error(errs.join('\n'));
  var dup = normNo_(p.InvoiceNo), dupKey = (isRet ? ['R', p.CompanyID, p.SupplierID, dup] : [p.CompanyID, p.SupplierID, dup]).join('|');
  return locked_(function () {
    var ps = sh_('PurchaseInvoices'), pi = sh_('PurchaseItems'), now = nowStr_();
    var same = rows_('PurchaseInvoices').filter(function (r) { return r.DupKey === dupKey && r.InvoiceID !== p.InvoiceID; });
    if (same.length && !p.force) return {duplicate: true, message: 'فاکتوری با همین شرکت، فروشنده و شماره قبلاً ثبت شده است (' + same[0].DateJalali + '). آیا باز هم ثبت شود؟'};
    if (p.dry) return {dry: true, payable: payable};
    var id = p.InvoiceID, created = now, source = p.Source || 'Manual', importId = '';
    if (id) {
      var r = findRow_(ps, id);
      if (!r) throw new Error('فاکتور پیدا نشد.');
      var old = ps.getRange(r, 1, 1, H.PurchaseInvoices.length).getValues()[0];
      created = old[15]; source = old[12]; importId = old[13];
      deleteItems_(id);
    } else id = nextIds_('INV', 1)[0];
    var ids = nextIds_('ITM', lines.length);
    var items = lines.map(function (l, i) {
      return [ids[i], id, i + 1, l.ProductID, l.Unit, l.Quantity, l.UnitPrice, l.Gross, l.Discount, l.Net, l.VAT, l.Total, l.Serials];
    });
    appendRows_(pi, items);
    if (p.InvoiceID) { delWhere_('InvoiceCosts', 2, function (v) { return v === id; }); delWhere_('Payments', 2, function (v) { return v === id; }); }
    var cids = nextIds_('CST', costs.length), pids = nextIds_('PAY', pays.length);
    appendRows_(sh_('InvoiceCosts'), costs.map(function (c, i) { return [cids[i], id, i + 1, c.t, c.payee, c.desc, c.a, c.v, c.tt]; }));
    appendRows_(sh_('Payments'), pays.map(function (q, i) {
      var y = q.y;
      return [pids[i], id, i + 1, q.d.j, q.d.g, q.m, q.a, tr_(y.FromAccount), tr_(y.TrackingNo), tr_(y.DestAccount), fa2en_(tr_(y.CardLast4)), tr_(y.ChequeNo), tr_(y.SayadNo), tr_(y.ChequeBank), q.due ? q.due.j : '', q.due ? q.due.g : '', q.cs, tr_(y.Description), tr_(y.AccountID)];
    }));
    var head = [id, p.CompanyID, p.SupplierID, String(p.InvoiceNo).trim(), dt.j, dt.g, lines.length, r2_(T.g), r2_(T.d), r2_(T.n), r2_(T.v), r2_(T.t), source, importId, dupKey, created, now, r2_(TC), payable, PD, r2_(payable - PD), payStatus_(payable, PD), tr_(p.Notes), isRet ? 'return' : '', refId];
    var rr = id === p.InvoiceID ? findRow_(ps, id) : 0;
    if (rr) ps.getRange(rr, 1, 1, head.length).setValues([head]); else appendRows_(ps, [head]);
    bk_resyncDoc_(p.CompanyID, 'purchase', id);
    bump_();
    var warn = [];
    if (isRet) {
      var sm = stockMap_(p.CompanyID), nmz = {};
      lines.forEach(function (l) { nmz[l.ProductID] = 1; });
      Object.keys(nmz).forEach(function (pid) {
        var o = sm[pid]; if (!o) return;
        var bal = stBal_(o);
        if (bal < -1e-9) warn.push('موجودی «' + pidName_(pid) + '» پس از این برگشت منفی می‌شود (' + (Math.round(bal * 100) / 100) + ').');
      });
    }
    return {saved: true, InvoiceID: id, total: payable, warnings: warn};
  });
}
function pidName_(pid) {
  var n = '';
  rows_('Products').forEach(function (x) { if (x.ProductID === pid) n = x.Name; });
  if (!n) rows_('Services').forEach(function (x) { if (x.ServiceID === pid) n = x.Name; });
  return n || pid;
}
function deleteItems_(invId) {
  var s = sh_('PurchaseItems'), last = s.getLastRow();
  if (last < 2) return;
  var v = s.getRange(2, 2, last - 1, 1).getValues(), rows = [];
  for (var i = 0; i < v.length; i++) if (v[i][0] === invId) rows.push(i + 2);
  var i2 = rows.length - 1;
  while (i2 >= 0) {
    var end = rows[i2], start = end;
    while (i2 > 0 && rows[i2 - 1] === start - 1) { i2--; start = rows[i2]; }
    s.deleteRows(start, end - start + 1);
    i2--;
  }
}
function deleteInvoice_(id) {
  return locked_(function () {
    var used = rows_('PurchaseInvoices').filter(function (r) { return r.DocType === 'return' && r.RefInvoiceID === id; })[0];
    if (used) throw new Error('برای این فاکتور، فاکتور برگشت از خرید (شماره ' + used.InvoiceNo + ') ثبت شده است؛ ابتدا آن را حذف کنید.');
    var ps = sh_('PurchaseInvoices'), r = findRow_(ps, id);
    if (!r) throw new Error('فاکتور پیدا نشد.');
    deleteItems_(id);
    delWhere_('InvoiceCosts', 2, function (v) { return v === id; });
    bk_dropDoc_('purchase', id);
    delWhere_('Payments', 2, function (v) { return v === id; });
    ps.deleteRow(r);
    bump_();
    return {deleted: true};
  });
}
function getInvoice_(id) {
  var h = rows_('PurchaseInvoices').map(normInv_).filter(function (r) { return r.InvoiceID === id; })[0];
  if (!h) throw new Error('فاکتور پیدا نشد.');
  h.items = rows_('PurchaseItems').filter(function (r) { return r.InvoiceID === id; });
  h.costs = rows_('InvoiceCosts').filter(function (r) { return r.InvoiceID === id; });
  h.payments = rows_('Payments').filter(function (r) { return r.InvoiceID === id; });
  return h;
}

/* ===== فیلتر مشترک بین فهرست و داشبورد ===== */
function query_(f, withItems) {
  f = f || {};
  var g1 = f.from ? parseJ_(f.from) : null, g2 = f.to ? parseJ_(f.to) : null;
  if ((f.from && !g1) || (f.to && !g2)) throw new Error('تاریخ فیلتر نامعتبر است.');
  var hasMin = f.min !== '' && f.min != null, hasMax = f.max !== '' && f.max != null;
  var prods = {};
  rows_('Products').forEach(function (p) { prods[p.ProductID] = p; });
  rows_('Services').forEach(function (p) { prods[p.ServiceID] = {Name: p.Name, svc: true}; });
  var inv = rows_('PurchaseInvoices').map(normInv_).filter(function (r) {
    if (f.pstatus && r.PayStatus !== f.pstatus) return false;
    if (f.doctype && r.DocType !== f.doctype) return false;
    if (f.company && r.CompanyID !== f.company) return false;
    if (f.supplier && r.SupplierID !== f.supplier) return false;
    if (f.invoiceNo && normNo_(r.InvoiceNo).indexOf(normNo_(f.invoiceNo)) < 0) return false;
    if (g1 && r.DateGregorian < g1.g) return false;
    if (g2 && r.DateGregorian > g2.g) return false;
    if (hasMin && r.GrandTotal < Number(fa2en_(f.min))) return false;
    if (hasMax && r.GrandTotal > Number(fa2en_(f.max))) return false;
    return true;
  });
  var itemF = f.product || f.group || f.subgroup, items = null;
  if (itemF || withItems) {
    var map = {};
    inv.forEach(function (r) { map[r.InvoiceID] = r; });
    items = rows_('PurchaseItems').filter(function (it) {
      if (!map[it.InvoiceID]) return false;
      var p = prods[it.ProductID] || {};
      if (f.product && it.ProductID !== f.product) return false;
      if (f.group && p.GroupID !== f.group) return false;
      if (f.subgroup && p.SubGroupID !== f.subgroup) return false;
      return true;
    });
    items = items.map(function (it) {
      if (map[it.InvoiceID].DocType !== 'return') return it;
      var c = {}; Object.keys(it).forEach(function (k) { c[k] = it[k]; });
      ['Quantity', 'Gross', 'Discount', 'NetAfterDiscount', 'VAT', 'LineTotal'].forEach(function (k) { c[k] = -(Number(c[k]) || 0); });
      return c;
    });
    if (itemF) {
      var keep = {};
      items.forEach(function (it) { keep[it.InvoiceID] = 1; });
      inv = inv.filter(function (r) { return keep[r.InvoiceID]; });
    }
  }
  return {inv: inv, items: items, prods: prods};
}
function listInvoices_(f) {
  var q = query_(f, false);
  q.inv.sort(function (a, b) { return a.DateGregorian < b.DateGregorian ? 1 : (a.DateGregorian > b.DateGregorian ? -1 : 0); });
  return {total: q.inv.length, rows: f && f.all ? q.inv : q.inv.slice(0, 500), totals: invTotals_(q.inv)};
}
/* جمع کل فاکتورهای خریدِ منطبق با فیلتر (برگشت از خرید با علامت منفی) */
function invTotals_(a) {
  var T = {count: a.length, purchases: 0, returns: 0, items: 0, gross: 0, discount: 0, afterDiscount: 0, vat: 0, grand: 0, costs: 0, payable: 0, paid: 0, remaining: 0};
  var K = {gross: 'TotalGross', discount: 'TotalDiscount', afterDiscount: 'TotalAfterDiscount', vat: 'TotalVAT', grand: 'GrandTotal', costs: 'TotalCosts', payable: 'PayableTotal', paid: 'TotalPaid', remaining: 'Remaining'};
  a.forEach(function (r) {
    var sg = r.DocType === 'return' ? -1 : 1;
    if (sg < 0) T.returns++; else T.purchases++;
    T.items += Number(r.ItemCount) || 0;
    Object.keys(K).forEach(function (k) { T[k] += sg * (Number(r[K[k]]) || 0); });
  });
  Object.keys(K).forEach(function (k) { T[k] = r2_(T[k]); });
  return T;
}
function dashboard_(f) {
  var cache = CacheService.getScriptCache(), key = 'd:' + getSet_('DataVer') + ':' + md5_(JSON.stringify(f || {}));
  var hit = cache.get(key), res;
  if (hit) res = JSON.parse(hit);
  else { res = dashCalc_(f); var js = JSON.stringify(res); if (js.length < 90000) cache.put(key, js, 600); }
  res.sales = salesDash_(f);   /* فروش همیشه تازه محاسبه می‌شود (کش نمی‌شود) */
  return res;
}
function dashCalc_(f) {
  var q = query_(f, true), sup = {}, grp = {}, sub = {}, mon = {}, prd = {}, invs = {}, sups = {};
  var T = {gross: 0, disc: 0, net: 0, vat: 0, total: 0};
  rows_('Suppliers').forEach(function (s) { sup[s.SupplierID] = s.Name; });
  var gn = {}, sn = {};
  rows_('ProductGroups').forEach(function (g) { gn[g.GroupID] = g.GroupName; });
  rows_('ProductSubGroups').forEach(function (g) { sn[g.SubGroupID] = g.SubGroupName; });
  var invMap = {};
  q.inv.forEach(function (r) { invMap[r.InvoiceID] = r; });
  var acc = {}, bump = function (cat, key, name, it) {
    var m = acc[cat] = acc[cat] || {}, o = m[key] = m[key] || {name: name, qty: 0, gross: 0, disc: 0, net: 0, vat: 0, total: 0, _i: {}};
    o.qty += it.Quantity; o.gross += it.Gross; o.disc += it.Discount; o.net += it.NetAfterDiscount; o.vat += it.VAT; o.total += it.LineTotal;
    o._i[it.InvoiceID] = 1;
  };
  q.items.forEach(function (it) {
    var iv = invMap[it.InvoiceID], p = q.prods[it.ProductID] || {};
    T.gross += it.Gross; T.disc += it.Discount; T.net += it.NetAfterDiscount; T.vat += it.VAT; T.total += it.LineTotal;
    invs[it.InvoiceID] = 1; sups[iv.SupplierID] = 1;
    bump('sup', iv.SupplierID, sup[iv.SupplierID] || '؟', it);
    bump('grp', p.svc ? 'SVC' : (p.GroupID || '-'), p.svc ? 'خدمات' : (gn[p.GroupID] || 'بدون گروه'), it);
    bump('sub', p.svc ? 'SVC' : (p.SubGroupID || '-'), p.svc ? 'خدمات' : (sn[p.SubGroupID] || 'بدون گروه فرعی'), it);
    bump('mon', iv.DateJalali.substring(0, 7), iv.DateJalali.substring(0, 7), it);
    bump('prd', it.ProductID, p.Name || '؟', it);
  });
  var out = function (cat, sortKey, lim) {
    var a = Object.keys(acc[cat] || {}).map(function (k) {
      var o = acc[cat][k];
      return {key: k, name: o.name, count: Object.keys(o._i).length, qty: r2_(o.qty), gross: r2_(o.gross), disc: r2_(o.disc), net: r2_(o.net), vat: r2_(o.vat), total: r2_(o.total)};
    });
    if (sortKey === 'name') a.sort(function (x, y) { return x.name < y.name ? -1 : 1; });
    else a.sort(function (x, y) { return y[sortKey] - x[sortKey]; });
    return lim ? a.slice(0, lim) : a;
  };
  var RC = {n: 0, t: 0};
  q.inv.forEach(function (r) { if (r.DocType === 'return') { RC.n++; RC.t += Number(r.GrandTotal) || 0; } });
  var IT = null;
  if (!(f && (f.product || f.group || f.subgroup))) {
    IT = {costs: 0, payable: 0, paid: 0, remaining: 0};
    q.inv.forEach(function (r) { var sg = r.DocType === 'return' ? -1 : 1; IT.costs += sg * r.TotalCosts; IT.payable += sg * r.PayableTotal; IT.paid += sg * r.TotalPaid; IT.remaining += sg * r.Remaining; });
    Object.keys(IT).forEach(function (k) { IT[k] = r2_(IT[k]); });
  }
  return {
    inv: IT,
    total: {gross: r2_(T.gross), disc: r2_(T.disc), net: r2_(T.net), vat: r2_(T.vat), total: r2_(T.total), invoices: Object.keys(invs).length, suppliers: Object.keys(sups).length, retCount: RC.n, retTotal: r2_(RC.t)},
    bySupplier: out('sup', 'net'), byGroup: out('grp', 'net'), bySub: out('sub', 'net'),
    byMonth: out('mon', 'name'), byProduct: out('prd', 'net', 100)
  };
}

/* ===== Import از Excel ===== */
var SUPF = ['SupplierCode','PersonType','Name','TradeName','CompanyName','NationalID','EconomicCode','RegNo','IdCardNo','NationalCode','Phone','Mobile','Email','Address','Province','City','PostalCode','AccountNo','Sheba','Bank','Notes'];
function nn_(s) { return fa2en_(s).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\u200c/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase(); }
function ns_(x) { var v = fa2en_(String(x == null ? '' : x).replace(/[٬،,\s]/g, '').replace(/٫/g, '.')); return v === '' ? 0 : Number(v); }
function tr_(x) { return String(x == null ? '' : x).trim(); }
/* شماره‌های سریال یک ردیف کالا (هر خط یا با ویرگول/فاصله جدا) */
function rp_serials_(s) { return String(s == null ? '' : s).split(/[\n\r,،;؛\s]+/).map(function (x) { return fa2en_(x).trim().toUpperCase(); }).filter(Boolean); }
function imp_(p) {
  if (p.type === 'sales') return impSales_(p);
  if (p.type === 'returns') p = Object.assign({}, p, {type: 'invoices', ret: true, createNew: false});
  if (['units','groups','suppliers','products','invoices'].indexOf(p.type) < 0) throw new Error('نوع Import نامعتبر است.');
  if (!p.company) throw new Error('شرکت/مشتری را انتخاب کنید.');
  return p.commit ? locked_(function () { return impRun_(p); }) : impRun_(p);
}
function impRun_(p) {
  var t = p.type, co = p.company, rows = p.rows || [], commit = !!p.commit, now = nowStr_();
  var A = {Units: [], ProductGroups: [], ProductSubGroups: [], Suppliers: [], Products: [], PurchaseInvoices: [], PurchaseItems: []};
  var ctr = {}, n = {g: 0, s: 0, u: 0, sup: 0, prd: 0}, S = {read: rows.length, ok: 0, dup: 0, err: 0, blocked: 0}, items = [];
  function nid(pf) { if (ctr[pf] === undefined) ctr[pf] = Number(getSet_('cnt_' + pf)) || 0; ctr[pf]++; return pf + '-' + ('000000' + ctr[pf]).slice(-6); }
  function mk(sh, o) { if (SCOPED_.indexOf(sh) >= 0 && !o.CompanyID) o.CompanyID = co; o[KEY[sh]] = nid(PF[sh]); o.IsActive = true; o.CreatedAt = now; o.UpdatedAt = now; A[sh].push(o); return o[KEY[sh]]; }
  var gm = {}, sm = {}, um = {}, supN = {}, supC = {}, prdN = {}, prdC = {};
  rows_('ProductGroups').forEach(function (g) { if (g.CompanyID === co) gm[nn_(g.GroupName)] = g.GroupID; });
  rows_('ProductSubGroups').forEach(function (s) { if (s.CompanyID === co) sm[s.GroupID + '|' + nn_(s.SubGroupName)] = s.SubGroupID; });
  rows_('Units').forEach(function (u) { if (u.CompanyID === co) um[nn_(u.UnitName)] = u.UnitName; });
  if (t === 'suppliers' || t === 'invoices') rows_('Suppliers').forEach(function (s) {
    if (s.CompanyID !== co) return;
    supN[nn_(s.Name)] = s.SupplierID; if (s.SupplierCode !== '') supC[nn_(s.SupplierCode)] = s.SupplierID;
  });
  if (t === 'products' || t === 'invoices') rows_('Products').forEach(function (s) {
    if (s.CompanyID !== co) return;
    var d = {id: s.ProductID, u: s.DefaultUnit}; prdN[nn_(s.Name)] = d; if (s.ProductCode !== '') prdC[nn_(s.ProductCode)] = d;
  });
  function ensG(x) { var k = nn_(x); if (!gm[k]) { gm[k] = mk('ProductGroups', {GroupName: tr_(x)}); n.g++; } return gm[k]; }
  function ensS(g, x) { var k = g + '|' + nn_(x); if (!sm[k]) { sm[k] = mk('ProductSubGroups', {GroupID: g, SubGroupName: tr_(x)}); n.s++; } return sm[k]; }
  function ensU(x) { var k = nn_(x); if (!um[k]) { um[k] = tr_(x); mk('Units', {UnitName: um[k]}); n.u++; } return um[k]; }
  function out(r, st, m, ex) { S[st]++; var o = {r: r._r, st: st, m: m || ''}; if (ex) for (var k in ex) o[k] = ex[k]; items.push(o); }

  if (t === 'units') rows.forEach(function (r) {
    var x = tr_(r.UnitName);
    if (!x) return out(r, 'err', 'نام واحد خالی است.');
    if (um[nn_(x)]) return out(r, 'dup', 'واحد از قبل وجود دارد.');
    ensU(x); out(r, 'ok');
  });
  if (t === 'groups') rows.forEach(function (r) {
    var g = tr_(r.GroupName), s = tr_(r.SubGroupName);
    if (!g) return out(r, 'err', 'گروه اصلی خالی است.');
    var gid = gm[nn_(g)];
    if (gid && (!s || sm[gid + '|' + nn_(s)])) return out(r, 'dup', 'از قبل وجود دارد.');
    gid = ensG(g); if (s) ensS(gid, s); out(r, 'ok');
  });
  if (t === 'suppliers') rows.forEach(function (r) {
    var nm = tr_(r.Name), cd = tr_(r.SupplierCode), pt = tr_(r.PersonType);
    if (!nm) return out(r, 'err', 'نام فروشنده خالی است.');
    if (pt && pt !== 'حقیقی' && pt !== 'حقوقی') return out(r, 'err', 'نوع شخص باید «حقیقی» یا «حقوقی» باشد.');
    if (supN[nn_(nm)] || (cd && supC[nn_(cd)])) return out(r, 'dup', 'فروشنده تکراری است.');
    var o = {CompanyID: co};
    SUPF.forEach(function (k) { o[k] = tr_(r[k]); });
    var id = mk('Suppliers', o); supN[nn_(nm)] = id; if (cd) supC[nn_(cd)] = id;
    out(r, 'ok');
  });
  if (t === 'products') rows.forEach(function (r) {
    var nm = tr_(r.Name), cd = tr_(r.ProductCode), g = tr_(r.GroupName), s = tr_(r.SubGroupName), u = tr_(r.Unit);
    if (!nm) return out(r, 'err', 'نام کالا خالی است.');
    if (s && !g) return out(r, 'err', 'گروه فرعی بدون گروه اصلی.');
    if (prdN[nn_(nm)] || (cd && prdC[nn_(cd)])) return out(r, 'dup', 'کالا تکراری است.');
    var gid = g ? ensG(g) : '', sid = s ? ensS(gid, s) : '', un = u ? ensU(u) : '';
    var oq = tr_(r.OpeningQty), oc = tr_(r.OpeningCost), oqn = 0, ocn = 0;
    if (oq !== '') { oqn = Number(fa2en_(String(oq).replace(/[٬،,\s]/g, '').replace(/٫/g, '.'))); if (!isFinite(oqn) || oqn < 0) return out(r, 'err', 'موجودی اولیه باید عدد صفر یا بزرگ‌تر باشد.'); }
    if (oc !== '') { ocn = Number(fa2en_(String(oc).replace(/[٬،,\s]/g, '').replace(/٫/g, '.'))); if (!isFinite(ocn) || ocn < 0) return out(r, 'err', 'بهای واحد موجودی اولیه باید عدد صفر یا بزرگ‌تر باشد.'); }
    var id = mk('Products', {CompanyID: co, ProductCode: cd, Name: nm, GroupID: gid, SubGroupID: sid, DefaultUnit: un, Notes: tr_(r.Notes), OpeningQty: oqn > 0 ? oqn : '', OpeningCost: oqn > 0 && ocn > 0 ? ocn : ''});
    var d = {id: id, u: un}; prdN[nn_(nm)] = d; if (cd) prdC[nn_(cd)] = d;
    out(r, 'ok');
  });
  if (t === 'invoices') {
    var pfill = {}, seen = {}, G = {}, order = [], force = {}, impId = p.importId || ('IMP-' + Utilities.formatDate(new Date(), TZ, 'yyyyMMddHHmmss'));
    rows_('PurchaseInvoices').forEach(function (r) { if (r.CompanyID === co) seen[r.DupKey] = 1; });
    (p.force || []).forEach(function (k) { force[k] = 1; });
    var RB = null;
    if (p.ret) {
      RB = {byNo: {}, bought: {}, back: {}};
      var pt = {}, rt = {};
      rows_('PurchaseInvoices').forEach(function (r) {
        if (r.CompanyID !== co) return;
        if (r.DocType === 'return') { if (r.RefInvoiceID) rt[r.InvoiceID] = r.RefInvoiceID; }
        else { pt[r.InvoiceID] = 1; RB.byNo[r.SupplierID + '|' + normNo_(r.InvoiceNo)] = r.InvoiceID; }
      });
      rows_('PurchaseItems').forEach(function (it) {
        var q = Number(it.Quantity) || 0;
        if (pt[it.InvoiceID]) { var b = RB.bought[it.InvoiceID] = RB.bought[it.InvoiceID] || {}; b[it.ProductID] = (b[it.ProductID] || 0) + q; }
        else if (rt[it.InvoiceID]) { var k2 = RB.back[rt[it.InvoiceID]] = RB.back[rt[it.InvoiceID]] || {}; k2[it.ProductID] = (k2[it.ProductID] || 0) + q; }
      });
    }
    rows.forEach(function (r) { if (!G[r._k]) { G[r._k] = []; order.push(r._k); } G[r._k].push(r); });
    order.forEach(function (k) {
      var L = G[k], f = L[0], errs = [], dt = parseJ_(f.DateJalali), no = tr_(f.InvoiceNo), sn = tr_(f.SupplierName), sc = tr_(f.SupplierCode);
      var meta = {key: k, no: no, date: tr_(f.DateJalali), sup: sn || sc, lines: L.length};
      if (!no) errs.push('شماره فاکتور خالی است');
      if (!dt) errs.push('تاریخ نامعتبر');
      var sid = (sc && supC[nn_(sc)]) || (sn && supN[nn_(sn)]) || '';
      if (!sid && !sn) errs.push('نام فروشنده خالی است');
      if (p.ret && !sid && sn) errs.push('فروشنده «' + sn + '» در سامانه ثبت نشده است (برای برگشت از خرید، فروشنده باید از قبل وجود داشته باشد)');
      var lines = [], needNew = !sid, T = {g: 0, d: 0, n: 0, v: 0, t: 0};
      L.forEach(function (r) {
        var q = ns_(r.Quantity), pr = ns_(r.UnitPrice), d = ns_(r.Discount), v = ns_(r.VAT), pn = tr_(r.ProductName), pc = tr_(r.ProductCode), ep = 'ردیف ' + r._r + ': ';
        var pd = (pc && prdC[nn_(pc)]) || (pn && prdN[nn_(pn)]) || null;
        if (!pd && !pn) errs.push(ep + 'نام کالا خالی است');
        if (p.ret && !pd && pn) errs.push(ep + 'کالای «' + pn + '» در سامانه ثبت نشده است');
        if (isNaN(q) || !(q > 0) || !dec2_(q)) errs.push(ep + 'تعداد نامعتبر');
        if (isNaN(pr) || pr < 0 || !dec2_(pr)) errs.push(ep + 'قیمت واحد نامعتبر');
        if (isNaN(d) || d < 0 || !dec2_(d)) errs.push(ep + 'تخفیف نامعتبر');
        if (isNaN(v) || v < 0 || !dec2_(v)) errs.push(ep + 'مالیات نامعتبر');
        var g = r2_(q * pr);
        if (d > g) errs.push(ep + 'تخفیف از ناخالص بیشتر است');
        if (!pd && tr_(r.SubGroupName) && !tr_(r.GroupName)) errs.push(ep + 'گروه فرعی بدون گروه اصلی');
        if (!pd || (!p.ret && tr_(r.Unit) && !um[nn_(r.Unit)])) needNew = true;
        var net = r2_(g - d), tot = r2_(net + v);
        T.g += g; T.d += d; T.n += net; T.v += v; T.t += tot;
        lines.push({r: r, pd: pd, q: q, pr: pr, g: g, d: d, net: net, v: v, tot: tot});
      });
      meta.total = r2_(T.t);
      var refId = '', rno = tr_(f.RefNo);
      if (p.ret && rno && sid && !errs.length) {
        refId = RB.byNo[sid + '|' + normNo_(rno)] || '';
        if (!refId) errs.push('فاکتور خرید اصلی شماره «' + rno + '» برای این فروشنده پیدا نشد');
        else {
          var need = {}; lines.forEach(function (l) { need[l.pd.id] = (need[l.pd.id] || 0) + l.q; });
          Object.keys(need).forEach(function (pid) {
            var left = r2_(((RB.bought[refId] || {})[pid] || 0) - ((RB.back[refId] || {})[pid] || 0));
            if (need[pid] > left + 1e-9) errs.push('تعداد برگشتی «' + pidName_(pid) + '» (' + need[pid] + ') از مانده‌ی قابل برگشت فاکتور ' + rno + ' (' + left + ') بیشتر است');
          });
        }
      }
      if (errs.length) return out(f, 'err', errs.slice(0, 3).join('؛ '), meta);
      var sk = sid || ('new:' + nn_(sn)), dk = (p.ret ? ['R', co, sk, normNo_(no)] : [co, sk, normNo_(no)]).join('|');
      if (seen[dk] && !force[k]) return out(f, 'dup', 'فاکتور تکراری (شرکت + فروشنده + شماره).', meta);
      if (needNew && !p.createNew) return out(f, 'blocked', 'شامل فروشنده، کالا یا واحد جدید است؛ گزینه ایجاد را فعال کنید.', meta);
      if (!sid) { sid = mk('Suppliers', {CompanyID: co, Name: sn, SupplierCode: sc}); supN[nn_(sn)] = sid; if (sc) supC[nn_(sc)] = sid; n.sup++; }
      seen[dk] = 1; dk = (p.ret ? ['R', co, sid, normNo_(no)] : [co, sid, normNo_(no)]).join('|'); seen[dk] = 1;
      if (p.ret && refId) { var bk = RB.back[refId] = RB.back[refId] || {}; lines.forEach(function (l) { bk[l.pd.id] = (bk[l.pd.id] || 0) + l.q; }); }
      var iid = nid('INV');
      A.PurchaseInvoices.push({InvoiceID: iid, CompanyID: co, SupplierID: sid, InvoiceNo: no, DateJalali: dt.j, DateGregorian: dt.g, ItemCount: lines.length, TotalGross: r2_(T.g), TotalDiscount: r2_(T.d), TotalAfterDiscount: r2_(T.n), TotalVAT: r2_(T.v), GrandTotal: r2_(T.t), Source: 'Import', ImportID: impId, DupKey: dk, DocType: p.ret ? 'return' : '', RefInvoiceID: refId, CreatedAt: now, UpdatedAt: now, TotalCosts: 0, PayableTotal: r2_(T.t), TotalPaid: 0, Remaining: r2_(T.t), PayStatus: 'پرداخت‌نشده', Notes: ''});
      lines.forEach(function (l, i) {
        var pd = l.pd, r = l.r, u = tr_(r.Unit);
        if (!pd) {
          var gid = tr_(r.GroupName) ? ensG(r.GroupName) : '', sd = tr_(r.SubGroupName) ? ensS(gid, r.SubGroupName) : '', un = u ? ensU(u) : '';
          pd = {id: mk('Products', {CompanyID: co, ProductCode: tr_(r.ProductCode), Name: tr_(r.ProductName), GroupID: gid, SubGroupID: sd, DefaultUnit: un, SstID: fa2en_(tr_(r.Sstid)).replace(/\s/g, '')}), u: un};
          if (tr_(r.ProductName)) prdN[nn_(r.ProductName)] = pd;
          if (tr_(r.ProductCode)) prdC[nn_(r.ProductCode)] = pd;
          n.prd++;
        } else {
          if (u) ensU(u);
          var xs = fa2en_(tr_(r.Sstid)).replace(/\s/g, ''), xg = tr_(r.GroupName);
          if ((xs || xg) && !pfill[pd.id]) pfill[pd.id] = {s: xs, g: xg ? ensG(xg) : '', b: ''};
          if (xg && tr_(r.SubGroupName) && pfill[pd.id] && !pfill[pd.id].b) pfill[pd.id].b = ensS(pfill[pd.id].g, r.SubGroupName);
        }
        A.PurchaseItems.push({ItemID: nid('ITM'), InvoiceID: iid, LineNo: i + 1, ProductID: pd.id, Unit: u ? um[nn_(u)] : (pd.u || ''), Quantity: l.q, UnitPrice: l.pr, Gross: l.g, Discount: l.d, NetAfterDiscount: l.net, VAT: l.v, LineTotal: l.tot});
      });
      out(f, 'ok', '', meta);
    });
  }
  if (commit) {
    ['Units','ProductGroups','ProductSubGroups','Suppliers','Products','PurchaseInvoices','PurchaseItems'].forEach(function (sh) {
      appendRows_(sh_(sh), A[sh].map(function (o) { return H[sh].map(function (k) { return o[k] === undefined ? '' : o[k]; }); }));
    });
    if (pfill && Object.keys(pfill).length && sh_('Products').getLastRow() >= 2) {
      var pS = sh_('Products'), pl = pS.getLastRow() - 1, hp = H.Products, c1 = hp.indexOf('GroupID') + 1, c2 = hp.indexOf('SubGroupID') + 1, c3 = hp.indexOf('SstID') + 1;
      var pi = pS.getRange(2, 1, pl, 1).getValues(), pg = pS.getRange(2, c1, pl, 1).getValues(), ps2 = pS.getRange(2, c2, pl, 1).getValues(), pt = pS.getRange(2, c3, pl, 1).getValues();
      pi.forEach(function (r, i) { var f = pfill[r[0]]; if (!f) return; if (f.s && !String(pt[i][0] || '')) pt[i][0] = f.s; if (f.g && !String(pg[i][0] || '')) { pg[i][0] = f.g; ps2[i][0] = f.b || ''; } });
      pS.getRange(2, c1, pl, 1).setValues(pg); pS.getRange(2, c2, pl, 1).setValues(ps2); pS.getRange(2, c3, pl, 1).setValues(pt);
    }
    Object.keys(ctr).forEach(function (pf) { setSet_('cnt_' + pf, ctr[pf]); });
    if (co) { codeFill_('Suppliers', co); codeFill_('Products', co); }
    bump_();
    appendRows_(sh_('ImportLog'), [[p.importId || '', now, p.fileName || '', co || '', S.read, S.ok, S.dup, S.err, n.sup, n.prd, 'Done']]);
  }
  var rank = {err: 0, blocked: 1, dup: 2, ok: 3};
  items.sort(function (a, b) { return rank[a.st] - rank[b.st]; });
  return {summary: S, n: n, total: items.length, items: items.slice(0, 300)};
}

/* ===== نسخه داده (برای باطل‌کردن Cache) و داده آزمایشی ===== */
function bump_() { setSet_('DataVer', String(new Date().getTime())); }
function md5_(str) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, str, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2); }).join('');
}
var TP = '[آزمایشی]';
function delRows_(s, rows) {
  var i = rows.length - 1;
  while (i >= 0) {
    var end = rows[i], start = end;
    while (i > 0 && rows[i - 1] === start - 1) { i--; start = rows[i]; }
    s.deleteRows(start, end - start + 1);
    i--;
  }
}
function delWhere_(n, col, fn) {
  var s = sh_(n), last = s.getLastRow();
  if (last < 2) return 0;
  var v = s.getRange(2, col, last - 1, 1).getValues(), rows = [];
  for (var i = 0; i < v.length; i++) if (fn(String(v[i][0]))) rows.push(i + 2);
  delRows_(s, rows);
  return rows.length;
}
function seedTest_() {
  if (rows_('Companies').some(function (c) { return String(c.Name).indexOf(TP) === 0; })) throw new Error('داده آزمایشی قبلاً بارگذاری شده است.');
  var co = saveEntity_('Companies', {Name: TP + ' شرکت نمونه'}).CompanyID, i, j;
  var sup = [];
  for (i = 1; i <= 5; i++) sup.push({_r: i + 1, Name: TP + ' فروشنده ' + i, SupplierCode: 'T' + i, PersonType: i % 2 ? 'حقوقی' : 'حقیقی', City: 'اهواز'});
  imp_({type: 'suppliers', company: co, rows: sup, commit: true});
  var units = ['عدد', 'کیلوگرم', 'متر', 'لیتر', 'بسته'], pr = [];
  for (i = 1; i <= 20; i++) {
    var g = ((i - 1) % 5) + 1;
    pr.push({_r: i + 1, Name: TP + ' کالا ' + i, ProductCode: 'TP' + i, GroupName: TP + ' گروه ' + g, SubGroupName: TP + ' زیرگروه ' + g + '-' + (i % 2 + 1), Unit: units[i % 5]});
  }
  imp_({type: 'products', company: co, rows: pr, commit: true});
  var rows = [], n = 0;
  for (i = 1; i <= 10; i++) {
    for (j = 0; j < 3; j++) {
      n++;
      var p = ((i * 3 + j) % 20) + 1, sn = ((i - 1) % 5) + 1;
      rows.push({_r: n + 1, _k: 'tinv' + i, InvoiceNo: 'T' + (1000 + i), DateJalali: '1405/06/' + ('0' + (9 + i)).slice(-2), SupplierName: TP + ' فروشنده ' + sn, SupplierCode: 'T' + sn,
        ProductName: TP + ' کالا ' + p, ProductCode: 'TP' + p, Unit: units[p % 5], Quantity: String(j + 2), UnitPrice: String(100000 * (p + 1)), Discount: j === 0 ? '5000' : '', VAT: String(10000 * (j + 1))});
    }
  }
  var r = imp_({type: 'invoices', company: co, rows: rows, commit: true, createNew: true});
  return {company: co, invoices: r.summary.ok};
}
function deleteTest_() {
  return locked_(function () {
    var cos = {};
    rows_('Companies').forEach(function (c) { if (String(c.Name).indexOf(TP) === 0) cos[c.CompanyID] = 1; });
    var ids = {};
    rows_('PurchaseInvoices').forEach(function (r) { if (cos[r.CompanyID]) ids[r.InvoiceID] = 1; });
    var out = {
      costs: delWhere_('InvoiceCosts', 2, function (v) { return ids[v]; }),
      pays: delWhere_('Payments', 2, function (v) { return ids[v]; }),
      items: delWhere_('PurchaseItems', 2, function (v) { return ids[v]; }),
      invoices: delWhere_('PurchaseInvoices', 2, function (v) { return cos[v]; }),
      suppliers: delWhere_('Suppliers', 2, function (v) { return cos[v]; }),
      products: delWhere_('Products', 2, function (v) { return cos[v]; })
    };
    ['BankAccounts', 'BankTx', 'Transfers', 'Cheques', 'DocPayments', 'Accounts', 'AccDetails', 'Employees', 'Projects', 'FiscalYears', 'StockAdj', 'Vouchers', 'Contracts', 'CostContracts', 'Machines', 'CostElements', 'CostRules', 'AllocBases', 'CostLedger', 'StockIssues', 'PayRows', 'Timesheets', 'Statements', 'MachLogs', 'MachCosts', 'Mobs', 'OhPools', 'OhActual', 'BaseQty', 'OhRuns', 'CostEst', 'ProgIn', 'Milestones', 'InstallLog', 'ContractCfg', 'CostRuns', 'CostPosts', 'ContractAmend', 'ContractBills', 'DocCaptures'].filter(function (t) { return !!H[t]; }).forEach(function (t) { delWhere_(t, 2, function (v) { return cos[v]; }); });
    delWhere_('VoucherRows', 3, function (v) { return cos[v]; });
    delWhere_('Units', 5, function (v) { return cos[v]; });
    delWhere_('ProductSubGroups', 5, function (v) { return cos[v]; });
    delWhere_('ProductGroups', 4, function (v) { return cos[v]; });
    delWhere_('ProductSubGroups', 3, function (v) { return v.indexOf(TP) === 0; });
    delWhere_('ProductGroups', 2, function (v) { return v.indexOf(TP) === 0; });
    delWhere_('Companies', 2, function (v) { return v.indexOf(TP) === 0; });
    bump_();
    return out;
  });
}

/* ===== ثبت فاکتور از روی اسکن (هوش مصنوعی Claude) ===== */
var HYPER = 'هایپر مارکت', SCAN_LIMIT = 300;
var CT_ = ['باربری','کرایه حمل','بارگیری و تخلیه','بیمه','گمرک و عوارض','بسته‌بندی','نصب و راه‌اندازی','سایر'];
var UNIT_MAP = {'کیلو':'کیلوگرم','کیلوگرم':'کیلوگرم','کیلو گرم':'کیلوگرم','kg':'کیلوگرم','لیتر':'لیتر','لیتری':'لیتر','متر':'متر','عدد':'عدد','تعداد':'عدد','قلم':'عدد','دانه':'عدد','pcs':'عدد','بسته':'بسته','پاکت':'بسته','کارتن':'کارتن','جعبه':'کارتن','دستگاه':'دستگاه','سرویس':'سرویس'};
var PAYMAP = {cash: 'نقد', card_to_card: 'کارت‌به‌کارت', bank_transfer: 'انتقال بانکی', pos: 'کارتخوان (POS)'};
var SCAN_PROMPT = 'You are reading a scanned or photographed purchase invoice (Persian/Iranian, possibly handwritten or low quality; may contain several invoices or several pages of one invoice). ' +
  'Extract EVERYTHING that is printed and return ONLY one JSON object, no markdown, no commentary. Schema:\n' +
  '{"invoices":[{"invoiceNo":string|null,"date":string|null,"seller":{"name":string|null,"tradeName":string|null,"nationalId":string|null,"economicCode":string|null,"phone":string|null,"mobile":string|null,"address":string|null,"city":string|null,"province":string|null,"postalCode":string|null},' +
  '"buyer":{"name":string|null,"nationalId":string|null,"economicCode":string|null},"currency":"rial"|"toman"|null,' +
  '"lines":[{"description":string,"code":string|null,"unit":string|null,"quantity":number|null,"unitPrice":number|null,"grossAmount":number|null,"discount":number|null,"vat":number|null,"lineTotal":number|null}],' +
  '"totalDiscount":number|null,"totalVat":number|null,"printedGrandTotal":number|null,' +
  '"otherCharges":[{"description":string,"amount":number|null,"vat":number|null}],' +
  '"payments":[{"method":"cash"|"card_to_card"|"bank_transfer"|"pos"|"cheque"|"credit"|"other","amount":number|null,"date":string|null,"details":string|null}],"notes":string|null}]}\n' +
  'Rules: (1) Convert all Persian/Arabic digits to Latin digits; numbers must have no thousands separators. (2) Keep the date exactly as printed. (3) "seller" is the party selling the goods, "buyer" the one purchasing. ' +
  '(4) "otherCharges" are extra charges such as freight, transport, insurance, packing, installation that are not goods lines. (5) Put only goods/services in "lines". ' +
  '(6) currency: "toman" only if the invoice clearly states تومان, "rial" if it states ریال, otherwise null. (7) Use null when something is unreadable or absent; never invent values. (8) Ignore product category columns.';
function g2j_(gy, gm, gd) {
  var gdm = [0,31,59,90,120,151,181,212,243,273,304,334], jy;
  if (gy > 1600) { jy = 979; gy -= 1600; } else { jy = 0; gy -= 621; }
  var gy2 = (gm > 2) ? (gy + 1) : gy;
  var days = (365 * gy) + (~~((gy2 + 3) / 4)) - (~~((gy2 + 99) / 100)) + (~~((gy2 + 399) / 400)) - 80 + gd + gdm[gm - 1];
  jy += 33 * (~~(days / 12053)); days %= 12053;
  jy += 4 * (~~(days / 1461)); days %= 1461;
  if (days > 365) { jy += ~~((days - 1) / 365); days = (days - 1) % 365; }
  var jm = (days < 186) ? 1 + ~~(days / 31) : 7 + ~~((days - 186) / 30);
  var jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return [jy, jm, jd];
}
function parseAnyDate_(s) {
  var m = fa2en_(s || '').match(/\d+/g);
  if (!m || m.length < 3) return '';
  var a = +m[0], b = +m[1], c = +m[2], y, mo, d;
  if (m[0].length === 4 || a > 31) { y = a; mo = b; d = c; }
  else if (m[2].length === 4 || c > 31) { y = c; mo = b; d = a; }
  else { y = a; mo = b; d = c; }
  if (y < 100) y += (y < 50 ? 1400 : 1300);
  if (y >= 1700) { if (mo < 1 || mo > 12) return ''; var j = g2j_(y, mo, d); y = j[0]; mo = j[1]; d = j[2]; }
  var p = parseJ_(y + '/' + mo + '/' + d);
  return p ? p.j : '';
}
function alloc_(total, w) {
  var sum = w.reduce(function (a, b) { return a + b; }, 0), out = [], used = 0;
  w.forEach(function (x, i) {
    var v = i === w.length - 1 ? r2_(total - used) : r2_(sum > 0 ? total * x / sum : total / w.length);
    out.push(v); used = r2_(used + v);
  });
  return out;
}
function costType_(d) {
  var x = nn_(d);
  if (/باربری/.test(x)) return 'باربری';
  if (/حمل|کرایه|ارسال|پیک/.test(x)) return 'کرایه حمل';
  if (/بیمه/.test(x)) return 'بیمه';
  if (/گمرک|عوارض/.test(x)) return 'گمرک و عوارض';
  if (/بسته/.test(x)) return 'بسته‌بندی';
  if (/نصب|راه ?اندازی/.test(x)) return 'نصب و راه‌اندازی';
  return 'سایر';
}
function scanNorm_(r, fname, srcLabel) {
  var W = [], toman = String(r.currency || '').toLowerCase() === 'toman', mul = toman ? 10 : 1;
  if (!r.currency) W.push('واحد پول در فاکتور مشخص نبود؛ ریال فرض شد.');
  if (toman) W.push('مبالغ فاکتور به تومان بود و به ریال تبدیل شد (×۱۰).');
  var M = function (x) { var v = ns_(x); return isNaN(v) ? 0 : r2_(v * mul); }, Q = function (x) { var v = ns_(x); return isNaN(v) ? 0 : r2_(v); };
  var dj = parseAnyDate_(r.date);
  if (!dj) W.push('تاریخ فاکتور خوانده نشد یا نامعتبر بود؛ لطفاً دستی وارد کنید.');
  var lines = [];
  (r.lines || []).forEach(function (l, i) {
    var nm = tr_(l.description), q = Q(l.quantity), pr = M(l.unitPrice), gr = M(l.grossAmount), dc = M(l.discount), vt = M(l.vat), lt = M(l.lineTotal), k = 'ردیف ' + (i + 1) + ': ';
    if (!nm && !q && !pr && !gr) return;
    if (!q && gr && pr) q = r2_(gr / pr);
    if (!pr && q && gr) pr = r2_(gr / q);
    if (!q) { q = 1; W.push(k + 'تعداد خوانده نشد؛ ۱ فرض شد.'); }
    if (!pr && !gr && lt) pr = r2_((lt - vt + dc) / q);
    if (gr && Math.abs(r2_(q * pr) - gr) > 1) W.push(k + 'تعداد × قیمت واحد با مبلغ ناخالص فاکتور اختلاف دارد.');
    lines.push({name: nm, code: tr_(l.code), unit: normUnit_(l.unit), qty: q, price: pr, discount: dc, vat: vt});
  });
  if (!lines.length) W.push('هیچ ردیف کالایی در فاکتور پیدا نشد.');
  var td = M(r.totalDiscount), tv = M(r.totalVat);
  var sd = r2_(lines.reduce(function (a, l) { return a + l.discount; }, 0)), sv = r2_(lines.reduce(function (a, l) { return a + l.vat; }, 0));
  if (lines.length && sd < 0.005 && td > 0) { var a1 = alloc_(td, lines.map(function (l) { return l.qty * l.price; })); lines.forEach(function (l, i) { l.discount = a1[i]; }); W.push('تخفیف کلی فاکتور بین ردیف‌ها تقسیم شد.'); }
  else if (td > 0 && Math.abs(sd - td) > 1) W.push('جمع تخفیف ردیف‌ها با تخفیف کل فاکتور اختلاف دارد.');
  if (lines.length && sv < 0.005 && tv > 0) { var a2 = alloc_(tv, lines.map(function (l) { return l.qty * l.price - l.discount; })); lines.forEach(function (l, i) { l.vat = a2[i]; }); W.push('مالیات کل فاکتور بین ردیف‌ها تقسیم شد.'); }
  else if (tv > 0 && Math.abs(sv - tv) > 1) W.push('جمع مالیات ردیف‌ها با مالیات کل فاکتور اختلاف دارد.');
  var costs = (r.otherCharges || []).filter(function (c) { return M(c.amount) > 0; }).map(function (c) {
    var t = costType_(c.description); return {type: t, description: tr_(c.description), amount: M(c.amount), vat: M(c.vat)};
  });
  var pays = [], extra = [];
  (r.payments || []).forEach(function (y) {
    var a = M(y.amount), m = PAYMAP[y.method];
    if (m && a > 0) pays.push({method: m, amount: a, date: parseAnyDate_(y.date) || dj});
    else if (a > 0 || y.details) extra.push('پرداخت (' + tr_(y.method) + ' ' + (a || '') + ' ' + tr_(y.details) + ')');
  });
  if (extra.length) W.push('اطلاعات پرداخت غیرقابل ثبت خودکار (چک/نسیه و ...) در توضیحات آمد؛ در صورت نیاز دستی ثبت کنید.');
  var calc = r2_(lines.reduce(function (a, l) { return a + r2_(l.qty * l.price) - l.discount + l.vat; }, 0) + costs.reduce(function (a, c) { return a + c.amount + c.vat; }, 0));
  var pt = M(r.printedGrandTotal);
  if (pt && Math.abs(calc - pt) > 1) W.push('جمع محاسبه‌شده (' + calc + ') با مبلغ نهایی چاپ‌شده در فاکتور (' + pt + ') اختلاف دارد؛ ردیف‌ها را بررسی کنید.');
  var s = r.seller || {}, b = r.buyer || {};
  return {
    fileName: fname, invoiceNo: tr_(fa2en_(r.invoiceNo)), dateJalali: dj,
    supplier: {name: tr_(s.name), code: '', tradeName: tr_(s.tradeName), nationalId: tr_(fa2en_(s.nationalId)), economicCode: tr_(fa2en_(s.economicCode)), phone: tr_(fa2en_(s.phone)), mobile: tr_(fa2en_(s.mobile)), address: tr_(s.address), city: tr_(s.city), province: tr_(s.province), postalCode: tr_(fa2en_(s.postalCode))},
    buyer: {name: tr_(b.name), nationalId: tr_(fa2en_(b.nationalId)), economicCode: tr_(fa2en_(b.economicCode))},
    lines: lines, costs: costs, payments: pays,
    notes: [tr_(r.notes)].concat(extra).filter(function (x) { return x; }).concat(['ثبت از ' + (srcLabel || 'اسکن') + ': ' + fname]).join(' | '),
    warnings: W, printedTotal: pt
  };
}
function normUnit_(u) { var k = nn_(u); return UNIT_MAP[k] || tr_(u); }
function bigrams_(s) {
  var x = nn_(s).replace(/\s+/g, ''), o = {}, n = 0;
  for (var i = 0; i < x.length - 1; i++) { var g = x.substr(i, 2); o[g] = (o[g] || 0) + 1; n++; }
  return {m: o, n: n};
}
function dice_(a, b) {
  if (!a.n || !b.n) return 0;
  var c = 0;
  for (var k in a.m) if (b.m[k]) c += Math.min(a.m[k], b.m[k]);
  return 2 * c / (a.n + b.n);
}
function scanSuggest_(list, name, thr) {
  var q = bigrams_(name), best = null;
  if (!q.n) return '';
  list.forEach(function (x) {
    var sc = dice_(q, x.bg);
    if (sc >= thr && sc < 0.9999 && (!best || sc > best.sc)) best = {sc: sc, name: x.name};
  });
  return best ? best.name : '';
}
function scanMaps_(co) {
  var M = {sN: {}, sC: {}, sI: {}, sE: {}, pN: {}, pC: {}, g: {}, s: {}, u: {}, sList: [], pList: []}, dg = function (x) { return fa2en_(x).replace(/\D/g, ''); };
  rows_('Suppliers').forEach(function (s) {
    if (s.CompanyID !== co) return;
    M.sList.push({name: s.Name, bg: bigrams_(s.Name)});
    M.sN[nn_(s.Name)] = s.SupplierID; if (s.SupplierCode !== '') M.sC[nn_(s.SupplierCode)] = s.SupplierID;
    var i = dg(s.NationalID), e = dg(s.EconomicCode); if (i.length >= 8) M.sI[i] = s.SupplierID; if (e.length >= 8) M.sE[e] = s.SupplierID;
  });
  rows_('Products').forEach(function (p) {
    if (p.CompanyID !== co) return;
    M.pList.push({name: p.Name, bg: bigrams_(p.Name)});
    var d = {id: p.ProductID, u: p.DefaultUnit}; M.pN[nn_(p.Name)] = d; if (p.ProductCode !== '') M.pC[nn_(p.ProductCode)] = d;
  });
  rows_('ProductGroups').forEach(function (g) { if (g.CompanyID === co) M.g[nn_(g.GroupName)] = g.GroupID; });
  rows_('ProductSubGroups').forEach(function (g) { if (g.CompanyID === co) M.s[g.GroupID + '|' + nn_(g.SubGroupName)] = g.SubGroupID; });
  rows_('Units').forEach(function (u) { if (u.CompanyID === co) M.u[nn_(u.UnitName)] = u.UnitName; });
  return M;
}
function scanFindSup_(M, s) {
  var dg = function (x) { return fa2en_(x).replace(/\D/g, ''); }, i = dg(s.nationalId), e = dg(s.economicCode);
  return (i.length >= 8 && M.sI[i]) || (e.length >= 8 && M.sE[e]) || (tr_(s.code) && M.sC[nn_(s.code)]) || (tr_(s.name) && M.sN[nn_(s.name)]) || '';
}
function scanFindPrd_(M, l) { return (tr_(l.code) && M.pC[nn_(l.code)]) || (tr_(l.name) && M.pN[nn_(l.name)]) || null; }
function scanPack_(co, inv, supId, pids, dry, force) {
  return {
    CompanyID: co, SupplierID: supId, InvoiceNo: inv.invoiceNo, DateJalali: inv.dateJalali, Notes: inv.notes, Source: 'Scan', dry: dry, force: !!force,
    items: inv.lines.map(function (l, i) { return {ProductID: pids[i], Unit: l.unit, Quantity: Number(l.qty), UnitPrice: Number(l.price), Discount: Number(l.discount || 0), VAT: Number(l.vat || 0)}; }),
    costs: (inv.costs || []).map(function (c) { return {CostType: c.type, Payee: '', Description: c.description, Amount: Number(c.amount), VAT: Number(c.vat || 0)}; }),
    payments: (inv.payments || []).map(function (y) { return {DateJalali: y.date || inv.dateJalali, Method: y.method, Amount: Number(y.amount)}; })
  };
}
function scanPreview_(co, inv, force) {
  var M = scanMaps_(co), E = [], W = (inv.warnings || []).slice(), sid = scanFindSup_(M, inv.supplier);
  if (!tr_(inv.supplier.name)) E.push('نام فروشنده خوانده نشد.');
  var pids = inv.lines.map(function (l) { var d = scanFindPrd_(M, l); return d ? d.id : ''; });
  inv.lines.forEach(function (l, i) { if (!tr_(l.name)) E.push('ردیف ' + (i + 1) + ': شرح کالا خالی است.'); });
  var comp = rows_('Companies').filter(function (c) { return c.CompanyID === co; })[0] || {}, dg = function (x) { return fa2en_(x).replace(/\D/g, ''); }, b = inv.buyer || {};
  if (dg(b.nationalId) && dg(comp.NationalID) && dg(b.nationalId) !== dg(comp.NationalID)) W.push('شناسه ملی خریدار در فاکتور با شرکت انتخاب‌شده یکی نیست.');
  if (dg(b.economicCode) && dg(comp.EconomicCode) && dg(b.economicCode) !== dg(comp.EconomicCode)) W.push('کد اقتصادی خریدار در فاکتور با شرکت انتخاب‌شده یکی نیست.');
  var dup = '', payable = 0;
  if (!E.length) {
    try {
      var r = saveInvoice_(scanPack_(co, inv, sid || 'NEW', pids.map(function (x) { return x || 'NEW'; }), true, force));
      if (r.duplicate) dup = r.message; else payable = r.payable;
    } catch (e) { E = E.concat(String(e.message).split('\n')); }
  }
  var sug = sid ? '' : scanSuggest_(M.sList, inv.supplier.name, 0.72);
  var sugL = inv.lines.map(function (l, i) { return pids[i] ? '' : scanSuggest_(M.pList, l.name, 0.8); });
  return {sup: sid ? 'موجود' : 'جدید', lines: pids.map(function (x) { return x ? 'موجود' : 'جدید'; }), errors: E, warnings: W, dup: dup, payable: payable, suggest: sug, sugLines: sugL};
}
function scanFromJson_(p) {
  if (!p.company) throw new Error('شرکت/مشتری را انتخاب کنید.');
  var items = p.items || [];
  if (!items.length) throw new Error('نتیجه‌ای برای بررسی ارسال نشد.');
  if (items.length > 20) throw new Error('در هر بار حداکثر ۲۰ فاکتور بارگذاری کنید.');
  return items.map(function (it) {
    var inv = scanNorm_(it.raw || {}, String(it.fileName || 'OCR').substring(0, 120), 'OCR');
    (it.warnings || []).slice().reverse().forEach(function (w) { inv.warnings.unshift(String(w)); });
    return {inv: inv, view: scanPreview_(p.company, inv, false)};
  });
}
function scanCommit_(p) {
  var co = p.company, inv = p.inv, pv = scanPreview_(co, inv, false);
  if (pv.errors.length) throw new Error(pv.errors.join('\n'));
  if (pv.dup && !p.force) return {duplicate: true, message: pv.dup};
  var M = scanMaps_(co), sid = scanFindSup_(M, inv.supplier), s = inv.supplier;
  if (!sid) sid = saveEntity_('Suppliers', {CompanyID: co, Name: tr_(s.name), SupplierCode: tr_(s.code), TradeName: s.tradeName, NationalID: s.nationalId, EconomicCode: s.economicCode, Phone: s.phone, Mobile: s.mobile, Address: s.address, City: s.city, Province: s.province, PostalCode: s.postalCode}).SupplierID;
  var pids = inv.lines.map(function (l) {
    var d = scanFindPrd_(M, l);
    if (d) return d.id;
    var gk = nn_(HYPER), gid = M.g[gk] || (M.g[gk] = saveEntity_('ProductGroups', {CompanyID: co, GroupName: HYPER}).GroupID);
    var sk = gid + '|' + gk, sg = M.s[sk] || (M.s[sk] = saveEntity_('ProductSubGroups', {CompanyID: co, GroupID: gid, SubGroupName: HYPER}).SubGroupID);
    if (l.unit && !M.u[nn_(l.unit)]) { saveEntity_('Units', {CompanyID: co, UnitName: l.unit}); M.u[nn_(l.unit)] = l.unit; }
    var np = {id: saveEntity_('Products', {CompanyID: co, ProductCode: tr_(l.code), Name: tr_(l.name), GroupID: gid, SubGroupID: sg, DefaultUnit: l.unit || ''}).ProductID, u: l.unit};
    M.pN[nn_(l.name)] = np; if (tr_(l.code)) M.pC[nn_(l.code)] = np;
    return np.id;
  });
  var r = saveInvoice_(scanPack_(co, inv, sid, pids, false, p.force));
  return {saved: true, InvoiceID: r.InvoiceID, total: r.total};
}
function aiExtract_(files, co) {
  var key = aiKeyFor_(co);
  if (!key) throw new Error('کلید API برای این شرکت ثبت نشده است. در «تنظیمات» کلید را ثبت کنید یا از ابزار OCR پایتون و «بارگذاری نتیجه OCR» استفاده کنید.');
  locked_(function () {
    var day = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
    if (getSet_('ScanDay') !== day) { setSet_('ScanDay', day); setSet_('ScanCount', 0); }
    var c = Number(getSet_('ScanCount')) || 0;
    if (c >= SCAN_LIMIT) throw new Error('سقف استخراج روزانه (' + SCAN_LIMIT + ') تمام شده است.');
    setSet_('ScanCount', c + 1);
  });
  var content = files.map(function (f) {
    if (['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'].indexOf(f.mime) < 0) throw new Error('فرمت فایل پشتیبانی نمی‌شود: ' + f.name);
    return {type: f.mime === 'application/pdf' ? 'document' : 'image', source: {type: 'base64', media_type: f.mime, data: f.data}};
  });
  content.push({type: 'text', text: SCAN_PROMPT});
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: {'x-api-key': key, 'anthropic-version': '2023-06-01'},
    payload: JSON.stringify({model: getSet_('AiModel') || 'claude-sonnet-5-5', max_tokens: 8000, messages: [{role: 'user', content: content}]})
  });
  var code = res.getResponseCode(), body = res.getContentText();
  if (code !== 200) { var m; try { m = JSON.parse(body).error.message; } catch (e) { m = body.substring(0, 200); } throw new Error('خطای سرویس هوش مصنوعی (' + code + '): ' + m); }
  var j = JSON.parse(body);
  if (j.stop_reason === 'max_tokens') throw new Error('فاکتور آن‌قدر طولانی است که خروجی کامل نشد؛ فایل را به بخش‌های کوچک‌تر تقسیم کنید.');
  var txt = (j.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('');
  var a = txt.indexOf('{'), b = txt.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('پاسخ قابل‌فهمی از اسکن دریافت نشد.');
  return JSON.parse(txt.substring(a, b + 1));
}
function scanExtract_(p) {
  if (!p.company) throw new Error('شرکت/مشتری را انتخاب کنید.');
  if (!p.files || !p.files.length) throw new Error('فایلی ارسال نشد.');
  var raw = aiExtract_(p.files, p.company), name = p.files.map(function (f) { return f.name; }).join(' + ');
  return (raw.invoices || []).map(function (r) { var inv = scanNorm_(r, name); return {inv: inv, view: scanPreview_(p.company, inv, false)}; });
}
function setApiKey_(p) {
  var k = tr_(p.key), pr = PropertiesService.getScriptProperties(), name = p.global ? 'ANTHROPIC_KEY' : (p.company ? 'ANTHROPIC_KEY_' + p.company : '');
  if (!name) throw new Error('شرکت مشخص نیست.');
  if (!k) pr.deleteProperty(name);
  else { if (k.indexOf('sk-ant-') !== 0) throw new Error('کلید نامعتبر است (باید با sk-ant- شروع شود).'); pr.setProperty(name, k); }
  return boot_();
}
function authorizeServices() {
  UrlFetchApp.fetch('https://api.anthropic.com/', {muteHttpExceptions: true});
  PropertiesService.getScriptProperties().getKeys();
  DriveApp.getRootFolder();
  Logger.log('مجوزها تأیید شد.');
}


/* ===== واحدهای پیش‌فرض هر شرکت ===== */
var DEF_UNITS_ = ['عدد','کیلوگرم','متر','لیتر','بسته','کارتن','دستگاه','سرویس'];
function seedUnits_(co) {
  var have = {};
  rows_('Units').forEach(function (u) { if (u.CompanyID === co) have[nn_(u.UnitName)] = 1; });
  var add = DEF_UNITS_.filter(function (u) { return !have[nn_(u)]; }).map(function (u) { return {CompanyID: co, UnitName: u}; });
  ent_bulk_('Units', add);
}

/* ===== یک‌بار: جداکردن گروه‌ها، گروه‌های فرعی و واحدهای مشترک برای هر شرکت ===== */
function scopeMigrate_() {
  if (getSet_('CompanyScopeV1') === '1') return null;
  var R = {groups: 0, subs: 0, units: 0, products: 0};
  var cos = rows_('Companies').map(function (c) { return c.CompanyID; });
  if (!cos.length) return R;
  var lg = rows_('ProductGroups').filter(function (g) { return !g.CompanyID; });
  var ls = rows_('ProductSubGroups').filter(function (g) { return !g.CompanyID; });
  var lu = rows_('Units').filter(function (g) { return !g.CompanyID; });
  var prods = rows_('Products'), svcs = rows_('Services');
  var usedG = {}, usedS = {}, usedAnyG = {}, usedAnyS = {};
  prods.forEach(function (p) {
    if (p.GroupID) { (usedG[p.GroupID] = usedG[p.GroupID] || {})[p.CompanyID] = 1; usedAnyG[p.GroupID] = 1; }
    if (p.SubGroupID) { (usedS[p.SubGroupID] = usedS[p.SubGroupID] || {})[p.CompanyID] = 1; usedAnyS[p.SubGroupID] = 1; }
  });
  var subOf = {};
  ls.forEach(function (x) { subOf[x.SubGroupID] = x; });
  /* گروه‌هایی که برای هر شرکت لازم‌اند */
  var needG = {};
  var addNeed = function (gid, co) { (needG[gid] = needG[gid] || {})[co] = 1; };
  lg.forEach(function (g) {
    var u = usedG[g.GroupID];
    if (u) Object.keys(u).forEach(function (co) { addNeed(g.GroupID, co); });
  });
  ls.forEach(function (x) {
    var u = usedS[x.SubGroupID];
    if (u) Object.keys(u).forEach(function (co) { addNeed(x.GroupID, co); });
  });
  lg.forEach(function (g) { if (!needG[g.GroupID]) cos.forEach(function (co) { addNeed(g.GroupID, co); }); }); // بدون استفاده: برای همه
  var newG = [], gmap = {};
  lg.forEach(function (g) {
    Object.keys(needG[g.GroupID] || {}).forEach(function (co) { newG.push({CompanyID: co, GroupName: g.GroupName, IsActive: g.IsActive !== false, _old: g.GroupID}); });
  });
  ent_bulk_('ProductGroups', newG).forEach(function (o) { gmap[o.CompanyID + '|' + o._old] = o.GroupID; R.groups++; });
  var newS = [], smap = {};
  ls.forEach(function (x) {
    var u = usedS[x.SubGroupID], cl = u ? Object.keys(u) : Object.keys(needG[x.GroupID] || {});
    cl.forEach(function (co) {
      var ng = gmap[co + '|' + x.GroupID];
      if (ng) newS.push({CompanyID: co, GroupID: ng, SubGroupName: x.SubGroupName, IsActive: x.IsActive !== false, _old: x.SubGroupID});
    });
  });
  ent_bulk_('ProductSubGroups', newS).forEach(function (o) { smap[o.CompanyID + '|' + o._old] = o.SubGroupID; R.subs++; });
  /* واحدها: همه‌ی واحدهای قبلی + واحدهای استفاده‌شده در کالا/خدمات هر شرکت */
  var nu = [], seen = {};
  cos.forEach(function (co) {
    var names = {};
    lu.forEach(function (u) { names[nn_(u.UnitName)] = {n: u.UnitName, mu: u.MuCode}; });
    prods.concat(svcs).forEach(function (p) { if (p.CompanyID === co && tr_(p.DefaultUnit)) names[nn_(p.DefaultUnit)] = names[nn_(p.DefaultUnit)] || {n: tr_(p.DefaultUnit), mu: ''}; });
    rows_('Units').forEach(function (u) { if (u.CompanyID === co) delete names[nn_(u.UnitName)]; });
    Object.keys(names).forEach(function (k) { nu.push({CompanyID: co, UnitName: names[k].n, MuCode: names[k].mu}); });
  });
  ent_bulk_('Units', nu); R.units = nu.length;
  /* بازنویسی گروه و گروه فرعی کالاها */
  var ps = sh_('Products'), last = ps.getLastRow();
  if (last >= 2) {
    var c1 = H.Products.indexOf('GroupID') + 1, c2 = H.Products.indexOf('SubGroupID') + 1, c0 = H.Products.indexOf('CompanyID') + 1;
    var co_ = ps.getRange(2, c0, last - 1, 1).getValues(), gv = ps.getRange(2, c1, last - 1, 1).getValues(), sv = ps.getRange(2, c2, last - 1, 1).getValues();
    co_.forEach(function (r, i) {
      var g = gv[i][0], sb = sv[i][0], co = r[0];
      if (g && gmap[co + '|' + g]) { gv[i][0] = gmap[co + '|' + g]; R.products++; }
      if (sb && smap[co + '|' + sb]) sv[i][0] = smap[co + '|' + sb];
    });
    ps.getRange(2, c1, last - 1, 1).setValues(gv); ps.getRange(2, c2, last - 1, 1).setValues(sv);
  }
  /* ردیف‌های قدیمیِ مشترک غیرفعال می‌شوند (دیگر در هیچ شرکتی دیده نمی‌شوند) */
  [['ProductGroups', lg, 'GroupID'], ['ProductSubGroups', ls, 'SubGroupID'], ['Units', lu, 'UnitID']].forEach(function (x) {
    if (!x[1].length) return;
    var sh = sh_(x[0]), lt = sh.getLastRow(), ia = H[x[0]].indexOf('IsActive') + 1, id = {};
    x[1].forEach(function (r) { id[r[x[2]]] = 1; });
    var ids = sh.getRange(2, 1, lt - 1, 1).getValues(), act = sh.getRange(2, ia, lt - 1, 1).getValues();
    ids.forEach(function (r, i) { if (id[r[0]]) act[i][0] = false; });
    sh.getRange(2, ia, lt - 1, 1).setValues(act);
  });
  setSet_('CompanyScopeV1', '1');
  bump_();
  return R;
}


/* ===== پشتیبان و بازگردانی داده‌های یک شرکت (بدون کلید خصوصی، گواهی و کاربران) ===== */
/* فهرست شیت‌های هر شرکت و شرط تعلق هر ردیف به شرکت؛ شرط‌ها پیش از هر تغییری از روی داده‌ی فعلی ساخته می‌شوند */
function companyScope_(co, R) {
  var byC = function (r) { return r.CompanyID === co; }, out = [];
  var add = function (n, f) { out.push({n: n, f: f}); };
  ['Companies', 'Customers', 'Suppliers', 'Products', 'Services', 'ProductGroups', 'ProductSubGroups', 'Units', 'PurchaseInvoices', 'SalesInvoices'].forEach(function (n) { add(n, byC); });
  var pi = {}, si = {}, rc = {}, po = {};
  R('PurchaseInvoices').forEach(function (r) { if (r.CompanyID === co) pi[r.InvoiceID] = 1; });
  R('SalesInvoices').forEach(function (r) { if (r.CompanyID === co) si[r.SaleID] = 1; });
  R('Recipes').forEach(function (r) { if (r.CompanyID === co) rc[r.RecipeID] = 1; });
  R('ProdOrders').forEach(function (r) { if (r.CompanyID === co) po[r.OrderID] = 1; });
  ['PurchaseItems', 'InvoiceCosts', 'Payments'].forEach(function (n) { add(n, function (r) { return pi[r.InvoiceID]; }); });
  ['Recipes', 'ProdOrders', 'ExpenseInvoices', 'BankAccounts', 'BankTx', 'Transfers', 'Cheques', 'DocPayments', 'Accounts', 'AccDetails', 'Employees', 'Projects', 'FiscalYears', 'StockAdj', 'Vouchers', 'VoucherRows', 'Contracts', 'CostContracts', 'Machines', 'CostElements', 'CostRules', 'AllocBases', 'CostLedger', 'StockIssues', 'PayRows', 'Timesheets', 'Statements', 'MachLogs', 'MachCosts', 'Mobs', 'OhPools', 'OhActual', 'BaseQty', 'OhRuns', 'CostEst', 'ProgIn', 'Milestones', 'InstallLog', 'ContractCfg', 'CostRuns', 'CostPosts', 'ContractAmend', 'ContractBills', 'DocCaptures'].forEach(function (n) { add(n, byC); });
  ['RecipeItems', 'RecipeSteps'].forEach(function (n) { add(n, function (r) { return rc[r.RecipeID]; }); });
  ['ProdMaterials', 'ProdSteps', 'ProdOverheads'].forEach(function (n) { add(n, function (r) { return po[r.OrderID]; }); });
  add('SalesItems', function (r) { return si[r.SaleID]; });
  return out;
}
function companyDumpWith_(co, R) {
  var out = {at: nowStr_(), company: co, note: 'پشتیبان داده‌های یک شرکت؛ شامل کلید خصوصی نیست.', sheets: {}};
  companyScope_(co, R).forEach(function (x) {
    var n = x.n; if (!H[n]) return;
    out.sheets[n] = {header: H[n], rows: R(n).filter(x.f).map(function (r) { return H[n].map(function (k) { return r[k]; }); })};
  });
  return out;
}
function companyDump_(co) { return companyDumpWith_(co, rows_); }
/* استخراج پشتیبان یک شرکت از «پشتیبان کامل سیستم» (a.src = شیت‌ها با ردیف اول سرستون) */
function companyExtract_(a) {
  var src = a.src;
  var R = function (n) {
    var v = src[n]; if (!v || !v.length) return [];
    var h = v[0];
    return v.slice(1).map(function (r) { var o = {}; for (var i = 0; i < h.length; i++) o[h[i]] = r[i]; return o; });
  };
  return companyDumpWith_(a.co, R);
}
/* جایگزینی کامل داده‌های یک شرکت با محتوای فایل پشتیبان؛ فقط شیت‌هایی که در فایل هستند جایگزین می‌شوند */
function companyRestore_(d) {
  var co = d && d.company;
  if (!co || !d.sheets || typeof d.sheets !== 'object') throw new Error('فایل پشتیبان شرکت معتبر نیست.');
  var cur = rows_('Companies').filter(function (r) { return r.CompanyID === co; })[0];
  var plan = [];
  companyScope_(co, rows_).forEach(function (x) {
    var n = x.n, dd = d.sheets[n]; if (!H[n] || !dd || !dd.rows) return;
    var s = sh_(n), v = s.getDataRange().getValues(), h = v[0] || [], del = [];
    for (var i = 1; i < v.length; i++) { var o = {}; for (var j = 0; j < h.length; j++) o[h[j]] = v[i][j]; if (x.f(o)) del.push(i + 1); }
    var hd = dd.header || H[n], idx = {};
    hd.forEach(function (k, i2) { idx[k] = i2; });
    var rows = dd.rows.map(function (r) { return H[n].map(function (k) { var q = idx[k] === undefined ? '' : r[idx[k]]; return q == null ? '' : q; }); });
    if (n === 'Companies' && cur) { var ki = H.Companies.indexOf('KeyID'); rows.forEach(function (r) { r[ki] = cur.KeyID == null ? '' : cur.KeyID; }); }
    plan.push({n: n, s: s, del: del, rows: rows});
  });
  if (!plan.length) throw new Error('فایل پشتیبان داده‌ای برای این شرکت ندارد.');
  var delN = 0, insN = 0;
  plan.forEach(function (p) { delRows_(p.s, p.del); delN += p.del.length; });
  plan.forEach(function (p) { appendRows_(p.s, p.rows); insN += p.rows.length; });
  bump_();
  return {company: co, deleted: delN, inserted: insN, sheets: plan.length};
}
