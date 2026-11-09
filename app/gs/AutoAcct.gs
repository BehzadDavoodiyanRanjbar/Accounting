/* ===== صدور خودکار سند حسابداری از روی فاکتورها، تولید، بانک و چک‌ها =====
   اصل کار: «سند خودکار» یک خروجیِ محاسبه‌شده از روی سند مبدأ است (نه چیزی که دستی ویرایش شود).
   بعد از هر عملیات ثبت/ویرایش/حذف، تابع ac_autoSync_ همه‌ی سندهای خودکار شرکت را دوباره از روی داده‌ی مبدأ می‌سازد
   و فقط تفاوت‌ها را اعمال می‌کند (سند جدید، سند اصلاح‌شده با همان شماره، سند حذف‌شده). بنابراین:
   - اصلاح یا حذف یک فاکتور، سند آن را هم اصلاح/حذف می‌کند؛ شماره‌ی سندهای بدون تغییر ثابت می‌ماند؛
   - تغییر بهای کالا (میانگین موزون) خودکار روی «بهای تمام‌شده کالای فروش‌رفته»‌ی فروش‌ها اثر می‌گذارد.
   قوانین حساب‌ها (با کلید سیستمی حساب‌ها در سرفصل استاندارد):
   خرید: بد موجودی (مواد اولیه/کالای ساخته‌شده/کالای تجاری، تفصیلی=کالا) + مالیات خرید + هزینه‌های فاکتور | بس حساب فروشنده (شخص=فروشنده). برگشت از خرید برعکس.
   فروش: بد حساب خریدار | بس فروش کالا/خدمات (ناخالص)، بد تخفیفات فروش، بس مالیات و عوارض ارزش افزوده فروش؛ و بد بهای تمام‌شده / بس موجودی. برگشت از فروش برعکس.
   هزینه: بد حساب هزینه (بر اساس نوع) + مالیات خرید (یا جزو هزینه) | بس حساب فروشنده (یا سایر حساب‌های پرداختنی).
   تولید (فقط سفارش «تکمیل‌شده»): بد موجودی کالای ساخته‌شده | بس مواد مصرفی (هر ماده) + دستمزد مستقیم جذب‌شده + سربار جذب‌شده.
   دریافت/پرداخت فاکتورها (غیر چک): بد/بس بانک، صندوق یا تنخواه (تفصیلی=همان حساب) در برابر حساب خریدار/فروشنده.
   چک دریافتی: ثبت چک (بد اسناد دریافتنی | بس خریدار) ← در جریان وصول (بد اسناد در جریان وصول | بس اسناد دریافتنی) ← وصول (بد بانک | بس اسناد)،
   عودت (بد خریدار | بس اسناد)، خرج (بد فروشنده | بس اسناد)، تنزیل (بد بانک و بد هزینه بهره | بس اسناد).
   چک پرداختی: صدور (بد فروشنده | بس اسناد پرداختنی) ← پاس (بد اسناد پرداختنی | بس بانک) ← برگشتی (بد اسناد پرداختنی | بس فروشنده).
   انتقال: بد حساب مقصد | بس حساب مبدأ (+ بد کارمزد بانکی). دریافت/پرداخت متفرقه بانک: بد/بس بانک در برابر «حساب مقابل» (پیش‌فرض: سایر درآمدها / هزینه‌های متفرقه).
   افتتاحیه: مانده‌ی افتتاحیه‌ی بانک/صندوق و موجودی اولیه‌ی کالا در برابر «تراز افتتاحیه». */

var AC_AUTO_LABEL = {cs6: 'بهای تمام‌شده خدمات (مرحله ۶)', stockadj: 'تعدیل موجودی', openbank: 'افتتاحیه بانک/صندوق', openstock: 'موجودی اولیه کالا', purchase: 'فاکتور خرید', sale: 'فاکتور فروش', salecash: 'دریافت نقدی فروش', expense: 'فاکتور هزینه', prod: 'تولید', pay: 'دریافت/پرداخت', chqreg: 'ثبت چک', chqst: 'وضعیت چک', transfer: 'انتقال', banktx: 'دریافت/پرداخت متفرقه'};
var AC_AUTO_ORD = {stockadj: 2, openbank: 1, openstock: 2, purchase: 3, sale: 4, salecash: 5, expense: 6, prod: 7, pay: 8, chqreg: 9, chqst: 10, transfer: 11, banktx: 12};
/* اقدام‌هایی که ممکن است روی سندهای خودکار اثر بگذارند */
var AC_HOOK = {save: 1, saveInvoice: 1, deleteInvoice: 1, deleteEntity: 1, import: 1, scanCommit: 1, saveSale: 1, deleteSale: 1, saleStatus: 1, salesToPurchase: 1, prodCfgSave: 1, recipeSave: 1, recipeDelete: 1, prodCreate: 1, prodSave: 1, prodStatus: 1, prodDelete: 1, prodFromSale: 1,
  expenseSave: 1, expenseDelete: 1, bankAccSave: 1, bankAccDelete: 1, bankTxSave: 1, bankTxDelete: 1, transferSave: 1, transferDelete: 1, chequeSave: 1, chequeDelete: 1, chequeStatus: 1, docPaySave: 1, accSave: 1, accDelete: 1, accReseed: 1, autoRebuild: 1};

function ac_has_(co) { return !!co && rows_('Accounts').some(function (r) { return r.CompanyID === co; }); }
/* شرکتِ مربوط به یک اقدام (قبل از اجرا صدا زده می‌شود تا برای حذف‌ها هم کار کند) */
function ac_hintCo_(action, p) {
  p = p || {};
  if (p.company) return p.company;
  if (p.CompanyID) return p.CompanyID;
  if (p.obj && p.obj.CompanyID) return p.obj.CompanyID;
  var look = function (sheet, key, id) { var r = id ? rows_(sheet).filter(function (x) { return x[key] === id; })[0] : null; return r ? r.CompanyID : ''; };
  if (action === 'deleteInvoice') return look('PurchaseInvoices', 'InvoiceID', p.id);
  if (action === 'deleteSale' || action === 'saleStatus') return look('SalesInvoices', 'SaleID', p.id);
  if (action === 'deleteEntity') { var k = {Customers: 'CustomerID', Suppliers: 'SupplierID', Products: 'ProductID'}[p.sheet]; return k ? look(p.sheet, k, p.id) : ''; }
  if (action === 'save' && p.obj && p.sheet === 'Products' && p.obj.ProductID) return look('Products', 'ProductID', p.obj.ProductID);
  return '';
}
/* بعد از هر اقدام اثرگذار: همگام‌سازی بی‌صدا؛ هر خطا فقط ثبت می‌شود و اقدام اصلی را خراب نمی‌کند */
function ac_afterAction_(co) {
  try { if (ac_has_(co)) ac_autoSync_(co); }
  catch (e) { try { setSet_('acAutoErr_' + co, JSON.stringify({at: nowStr_(), n: 1, msgs: ['خطای همگام‌سازی: ' + String(e.message || e)]})); } catch (e2) {} }
}

/* ---------- حساب‌های سیستمی ---------- */
function ac_ensureSys_(co) {
  var accs = ac_accOf_(co), std = {}, changed = 0;
  AC_STD_MOEIN.forEach(function (line) { var f = line.split('|'); if (f[5]) std[f[0]] = f[5]; });
  var miss = Object.keys(std).filter(function (c) { return !accs.some(function (a) { return String(a.Code) === c; }); });
  if (miss.length) { ac_seed_(co, true); accs = ac_accOf_(co); changed = 1; }
  accs.forEach(function (a) {
    var k = std[String(a.Code)];
    if (k && !tr_(a.SysKey)) { a.SysKey = k; a.IsSystem = true; pr_setRow_('Accounts', 'AccID', a.AccID, a); changed = 1; }
  });
  if (changed) bump_();
  return accs;
}
function ac_xctx_(co) {
  var X = {co: co, S: {}, c: ac_ctx_(co), errs: [], cls: {}, svc: {}, defCash: '', defBank: ''};
  Object.keys(X.c.accs).forEach(function (id) { var a = X.c.accs[id]; if (tr_(a.SysKey)) X.S[a.SysKey] = a; });
  rows_('Services').forEach(function (r) { if (r.CompanyID === co) X.svc[r.ServiceID] = r; });
  /* طبقه‌بندی کالا برای حساب موجودی: ساخته‌شده / ماده اولیه / تجاری */
  var rec = {}, made = {}, raw = {};
  rows_('Recipes').forEach(function (r) { if (r.CompanyID === co) { rec[r.RecipeID] = 1; if (r.ProductID) made[r.ProductID] = 1; } });
  rows_('RecipeItems').forEach(function (r) { if (rec[r.RecipeID] && r.ProductID) raw[r.ProductID] = 1; });
  Object.keys(X.c.prod).forEach(function (pid) { X.cls[pid] = made[pid] ? 'inv_fg' : (raw[pid] ? 'inv_raw' : 'inventory'); });
  var pick = function (kind) {
    var l = Object.keys(X.c.bank).map(function (k) { return X.c.bank[k]; }).filter(function (a) { return a.Kind === kind && ac_b_(a.IsActive, true); });
    var d = l.filter(function (a) { return ac_b_(a.IsDefault, false); })[0] || l[0];
    return d ? d.AccountID : '';
  };
  X.defCash = pick('cash'); X.defBank = pick('bank');
  X.cm = prCostMap_(co, prCfg_(co).method);
  return X;
}
function ac_n_(x) { return Number(x) || 0; }
/* یک ردیف سند: key = کلید سیستمی حساب */
function ac_r_(X, key, dr, cr, o) {
  o = o || {};
  var a = X.S[key]; if (!a) throw new Error('حساب سیستمی «' + key + '» در سرفصل شما پیدا نشد (آن را از «جدول حساب‌ها ← افزودن حساب‌های استاندارد» بسازید).');
  dr = r2_(dr || 0); cr = r2_(cr || 0);
  return {AccID: a.AccID, DetKind: o.dk || '', DetID: o.did || '', PartyType: o.pt || '', PartyID: o.pid || '', Description: o.desc || '', Debit: dr > 0 ? dr : 0, Credit: cr > 0 ? cr : 0};
}
/* بانک / صندوق / تنخواه */
function ac_bankR_(X, accountId, dr, cr, desc, method) {
  var a = accountId ? X.c.bank[accountId] : null;
  if (!a) {
    var d = (method === 'نقد' ? X.defCash : X.defBank) || X.defCash || X.defBank;
    if (d) a = X.c.bank[d];
  }
  if (!a) return ac_r_(X, 'cash_transit', dr, cr, {desc: desc + (method ? ' (' + method + ')' : '')});
  return ac_r_(X, a.Kind, dr, cr, {dk: a.Kind, did: a.AccountID, desc: desc});
}
function ac_prodR_(X, pid, dr, cr, desc, cogs) {
  return ac_r_(X, cogs ? 'cogs' : X.cls[pid], dr, cr, {dk: 'product', did: pid, desc: desc});
}
function ac_partyKey_(t) { return t === 'supplier' ? 'ap' : 'ar'; }
function ac_partyR_(X, type, pid, dr, cr, desc) {
  if (type === 'customer' && pid && X.c.cus[pid]) return ac_r_(X, 'ar', dr, cr, {pt: 'customer', pid: pid, desc: desc});
  if (type === 'supplier' && pid && X.c.sup[pid]) return ac_r_(X, 'ap', dr, cr, {pt: 'supplier', pid: pid, desc: desc});
  return ac_r_(X, type === 'supplier' ? 'ap' : 'ar', dr, cr, {desc: desc});
}
function ac_pname_(X, type, pid) { var r = type === 'customer' ? X.c.cus[pid] : (type === 'supplier' ? X.c.sup[pid] : null); return r ? r.Name : ''; }
/* افزودن سند به فهرست (با نگهداری خطا برای هر مبدأ) */
function ac_put_(X, out, src, id, dateG, dateJ, desc, rows, no) {
  out.push({src: src, id: String(id), dateG: dateG || '', dateJ: dateJ || '', desc: desc, rows: rows, no: tr_(no)});
}
function ac_try_(X, label, f) { try { f(); } catch (e) { X.errs.push(label + ': ' + String(e.message || e)); } }
function ac_dj_(g, j) { var d = tr_(j) ? parseJ_(j) : null; if (d) return d; var js = tr_(g) ? parseAnyDate_(g) : ''; return js ? parseJ_(js) : null; }

/* ---------- سازنده‌ها ---------- */
function ac_minDate_(X) {
  var m = '';
  var f = function (g) { g = tr_(g); if (g && (!m || g < m)) m = g; };
  rows_('PurchaseInvoices').forEach(function (r) { if (r.CompanyID === X.co) f(r.DateGregorian); });
  rows_('SalesInvoices').forEach(function (r) { if (r.CompanyID === X.co) f(r.DateGregorian); });
  rows_('ExpenseInvoices').forEach(function (r) { if (r.CompanyID === X.co) f(r.DateGregorian); });
  rows_('BankTx').forEach(function (r) { if (r.CompanyID === X.co) f(r.DateGregorian); });
  return m;
}
function ac_bOpen_(X, out) {
  var md = ac_minDate_(X), mj = md ? g2jStr_(md) : '', base = md || '';
  rows_('BankAccounts').forEach(function (a) {
    if (a.CompanyID !== X.co) return;
    var op = ac_n_(a.OpeningAmount); if (Math.abs(op) < 0.005) return;
    ac_try_(X, 'افتتاحیه ' + a.Name, function () {
      var d = a.OpeningDate ? parseJ_(a.OpeningDate) : null, dg = d ? d.g : (base || tr_(a.CreatedAt).substring(0, 10)), dj = d ? d.j : (base ? mj : '');
      if (!dj && dg) dj = g2jStr_(dg);
      var desc = 'افتتاح حساب ' + bk_accName_(a), rows = [ac_bankR_(X, a.AccountID, op > 0 ? op : 0, op < 0 ? -op : 0, desc), ac_r_(X, 'opening', op < 0 ? -op : 0, op > 0 ? op : 0, {desc: desc})];
      ac_put_(X, out, 'openbank', a.AccountID, dg, dj, desc, rows);
    });
  });
  var rows = [], tot = 0;
  rows_('Products').forEach(function (p) {
    if (p.CompanyID !== X.co) return;
    var q = ac_n_(p.OpeningQty), c = ac_n_(p.OpeningCost), v = r2_(q * c);
    if (q > 0 && v > 0) { ac_try_(X, 'موجودی اولیه ' + p.Name, function () { rows.push(ac_prodR_(X, p.ProductID, v, 0, 'موجودی اولیه ' + p.Name)); tot += v; }); }
  });
  if (rows.length) ac_try_(X, 'موجودی اولیه کالا', function () {
    rows.push(ac_r_(X, 'opening', 0, tot, {desc: 'موجودی اولیه کالا'}));
    var dg = base || nowStr_().substring(0, 10);
    ac_put_(X, out, 'openstock', 'all', dg, mj || g2jStr_(dg), 'موجودی اولیه کالاها', rows);
  });
}
function g2jStr_(g) { return parseAnyDate_(g) || ''; }

function ac_bStockAdj_(X, out) {
  rows_('StockAdj').forEach(function (a) {
    if (a.CompanyID !== X.co) return;
    ac_try_(X, 'تعدیل موجودی', function () {
      var q = ac_n_(a.Qty), v = r2_(Math.abs(q) * ac_n_(a.UnitCost)); if (v <= 0 || !X.c.prod[a.ProductID]) return;
      var d = 'تعدیل موجودی ' + ((X.c.prod[a.ProductID] || {}).Name || '') + (tr_(a.Reason) ? ' - ' + a.Reason : '');
      var rows = q > 0 ? [ac_prodR_(X, a.ProductID, v, 0, d), ac_r_(X, 'other_inc', 0, v, {desc: d})] : [ac_r_(X, 'expense_misc', v, 0, {desc: d}), ac_prodR_(X, a.ProductID, 0, v, d)];
      ac_put_(X, out, 'stockadj', a.AdjID, a.DateGregorian, a.DateJalali, d, rows);
    });
  });
}
function ac_bPurchase_(X, out) {
  var items = {}, costs = {};
  rows_('PurchaseItems').forEach(function (r) { (items[r.InvoiceID] = items[r.InvoiceID] || []).push(r); });
  rows_('InvoiceCosts').forEach(function (r) { (costs[r.InvoiceID] = costs[r.InvoiceID] || []).push(r); });
  rows_('PurchaseInvoices').forEach(function (inv) {
    if (inv.CompanyID !== X.co) return;
    ac_try_(X, 'فاکتور خرید ' + inv.InvoiceNo, function () {
      var ret = inv.DocType === 'return', sup = X.c.sup[inv.SupplierID], rows = [], tot = 0, vat = 0;
      var put = function (r) { if (ret) { var t = r.Debit; r.Debit = r.Credit; r.Credit = t; } rows.push(r); };
      var name = (ret ? 'برگشت از خرید ' : 'فاکتور خرید ') + inv.InvoiceNo + (sup ? ' - ' + sup.Name : '');
      (items[inv.InvoiceID] || []).forEach(function (it) {
        var net = r2_(ac_n_(it.NetAfterDiscount)); vat += ac_n_(it.VAT); tot += net + ac_n_(it.VAT);
        if (net <= 0) return;
        if (X.c.prod[it.ProductID]) put(ac_prodR_(X, it.ProductID, net, 0, name));
        else put(ac_r_(X, 'expense_misc', net, 0, {desc: name + ' - ' + ((X.svc[it.ProductID] || {}).Name || 'خدمت')}));
      });
      (costs[inv.InvoiceID] || []).forEach(function (c) {
        var a = r2_(ac_n_(c.Amount)); vat += ac_n_(c.VAT); tot += a + ac_n_(c.VAT);
        if (a <= 0) return;
        put(ac_r_(X, /حمل|بار|ترابری|باربری/.test(String(c.CostType)) ? 'exp_transport' : 'expense_misc', a, 0, {desc: name + ' - هزینه: ' + c.CostType + (c.Payee ? ' (' + c.Payee + ')' : '')}));
      });
      vat = r2_(vat);
      if (vat > 0) put(ac_r_(X, 'vat_in', vat, 0, {desc: name}));
      tot = r2_(tot);
      if (tot <= 0) return;
      put(ac_partyR_(X, 'supplier', inv.SupplierID, 0, tot, name));
      ac_put_(X, out, 'purchase', inv.InvoiceID, inv.DateGregorian, inv.DateJalali, name, rows, inv.InvoiceNo);
    });
  });
}
function ac_bSale_(X, out) {
  var items = {};
  rows_('SalesItems').forEach(function (r) { (items[r.SaleID] = items[r.SaleID] || []).push(r); });
  rows_('SalesInvoices').forEach(function (s) {
    if (s.CompanyID !== X.co || !sl_valid_(s)) return;
    ac_try_(X, 'فاکتور فروش ' + s.SerialNo, function () {
      var ret = Number(s.Ins) === 4, cus = X.c.cus[s.CustomerID], tb = r2_(ac_n_(s.Tbill)), rows = [];
      var name = (ret ? 'برگشت از فروش ' : 'فاکتور فروش ') + s.SerialNo + (cus ? ' - ' + cus.Name : '');
      var put = function (r) { if (ret) { var t = r.Debit; r.Debit = r.Credit; r.Credit = t; } rows.push(r); };
      var G = 0, S = 0, cogs = [];
      (items[s.SaleID] || []).forEach(function (it) {
        var g = ac_n_(it.Prdis);
        if (X.c.prod[it.ProductID]) {
          G += g;
          var u = ac_n_(X.cm[it.ProductID]), v = r2_(ac_n_(it.Am) * u);
          if (v > 0) cogs.push({pid: it.ProductID, v: v});
        } else S += g;
      });
      var tp = r2_(ac_n_(s.Tprdis)); if (tp > 0 && Math.abs(tp - (G + S)) > 0.005) G += tp - (G + S);
      G = r2_(G); S = r2_(S);
      var disc = r2_(ac_n_(s.Tdis)), vat = r2_(ac_n_(s.Tvam)), other = r2_(tb - (G + S - disc) - vat);
      if (tb <= 0 && G + S <= 0) return;
      put(ac_partyR_(X, 'customer', s.CustomerID, tb, 0, name));
      if (G > 0) put(ac_r_(X, ret ? 'sales_ret' : 'sales', 0, G, {desc: name}));
      if (S > 0) put(ac_r_(X, ret ? 'sales_ret' : 'sales_svc', 0, S, {desc: name}));
      if (disc > 0) put(ac_r_(X, 'sales_disc', disc, 0, {desc: name}));
      if (vat > 0) put(ac_r_(X, 'vat_out', 0, vat, {desc: name}));
      if (Math.abs(other) > 0.005) put(ac_r_(X, 'levy_out', other < 0 ? -other : 0, other > 0 ? other : 0, {desc: name}));
      cogs.forEach(function (c) {
        put(ac_prodR_(X, c.pid, c.v, 0, 'بهای تمام‌شده - ' + name, true));
        put(ac_prodR_(X, c.pid, 0, c.v, 'خروج از موجودی - ' + name));
      });
      ac_put_(X, out, 'sale', s.SaleID, s.DateGregorian, s.DateJalali, name, rows, s.SerialNo);
    });
  });
}
function ac_expAcc_(cat) {
  var c = String(cat || '');
  if (/برق|آب|گاز|انرژی|سوخت/.test(c)) return 'exp_util';
  if (/اجاره/.test(c)) return 'exp_rent';
  if (/استهلاک/.test(c)) return 'exp_depr';
  if (/حمل|ترابری|باربری/.test(c)) return 'exp_transport';
  if (/تعمیر|نگهداری/.test(c)) return 'exp_repair';
  if (/حقوق|دستمزد/.test(c)) return 'exp_wage';
  return 'expense_misc';
}
function ac_bExpense_(X, out) {
  rows_('ExpenseInvoices').forEach(function (e) {
    if (e.CompanyID !== X.co) return;
    ac_try_(X, 'فاکتور هزینه ' + e.DocNo, function () {
      var a = r2_(ac_n_(e.Amount)), v = r2_(ac_n_(e.VAT)), vic = String(e.VATInCost) === 'true', sup = X.c.sup[e.SupplierID], rows = [];
      if (a <= 0) return;
      var who = sup ? sup.Name : tr_(e.Payee), name = 'فاکتور هزینه ' + e.DocNo + ' - ' + e.Category + (who ? ' - ' + who : '');
      rows.push(ac_r_(X, ac_expAcc_(e.Category), a + (vic ? v : 0), 0, {desc: name}));
      if (v > 0 && !vic) rows.push(ac_r_(X, 'vat_in', v, 0, {desc: name}));
      if (sup) rows.push(ac_partyR_(X, 'supplier', e.SupplierID, 0, a + v, name));
      else rows.push(ac_r_(X, 'pay_other', 0, a + v, {desc: name}));
      ac_put_(X, out, 'expense', e.ExpenseID, e.DateGregorian, e.DateJalali, name, rows, e.DocNo);
    });
  });
}
function ac_bProd_(X, out) {
  var mats = {};
  rows_('ProdMaterials').forEach(function (m) { (mats[m.OrderID] = mats[m.OrderID] || []).push(m); });
  rows_('ProdOrders').forEach(function (o) {
    if (o.CompanyID !== X.co || o.Status !== PR_ST.done) return;
    ac_try_(X, 'سفارش تولید ' + o.OrderNo, function () {
      if (!X.c.prod[o.ProductID]) return;
      var name = 'تولید - سفارش ' + o.OrderNo + ' - ' + X.c.prod[o.ProductID].Name, rows = [], tot = 0;
      (mats[o.OrderID] || []).forEach(function (m) {
        var c = r2_(ac_n_(m.Cost)); if (c <= 0 || !X.c.prod[m.ProductID]) return;
        rows.push(ac_prodR_(X, m.ProductID, 0, c, 'مصرف ماده - ' + name)); tot += c;
      });
      var lab = r2_(ac_n_(o.LaborCost)), ovh = r2_(ac_n_(o.OverheadCost));
      if (lab > 0) { rows.push(ac_r_(X, 'wage_abs', 0, lab, {desc: name})); tot += lab; }
      if (ovh > 0) { rows.push(ac_r_(X, 'ovh_abs', 0, ovh, {desc: name})); tot += ovh; }
      tot = r2_(tot); if (tot <= 0) return;
      rows.unshift(ac_prodR_(X, o.ProductID, tot, 0, name));
      var d = ac_dj_(o.DoneDateGregorian, o.DoneJalali) || ac_dj_(o.DateGregorian, o.DateJalali);
      ac_put_(X, out, 'prod', o.OrderID, d ? d.g : o.DateGregorian, d ? d.j : o.DateJalali, name, rows, o.OrderNo);
    });
  });
}
/* دریافت/پرداخت‌های غیر چک */
function ac_bPay_(X, out) {
  var pur = {}, sal = {}, exp = {};
  rows_('PurchaseInvoices').forEach(function (r) { if (r.CompanyID === X.co) pur[r.InvoiceID] = r; });
  rows_('SalesInvoices').forEach(function (r) { if (r.CompanyID === X.co && sl_valid_(r)) sal[r.SaleID] = r; });
  rows_('ExpenseInvoices').forEach(function (r) { if (r.CompanyID === X.co) exp[r.ExpenseID] = r; });
  var one = function (id, type, doc, y) {
    if (y.Method === 'چک') return;
    var a = r2_(ac_n_(y.Amount)); if (a <= 0 || !doc) return;
    ac_try_(X, 'پرداخت/دریافت ردیف ' + id, function () {
      var dir, label, pt, pid, who;
      if (type === 'purchase') { var ret = doc.DocType === 'return'; dir = ret ? 'in' : 'out'; label = (ret ? 'برگشت از خرید ' : 'فاکتور خرید ') + doc.InvoiceNo; pt = 'supplier'; pid = doc.SupplierID; }
      else if (type === 'sale') { var r2 = Number(doc.Ins) === 4; dir = r2 ? 'out' : 'in'; label = (r2 ? 'برگشت از فروش ' : 'فاکتور فروش ') + doc.SerialNo; pt = 'customer'; pid = doc.CustomerID; }
      else { dir = 'out'; label = 'فاکتور هزینه ' + doc.DocNo; pt = doc.SupplierID ? 'supplier' : ''; pid = doc.SupplierID; }
      who = pt ? ac_pname_(X, pt, pid) : tr_(doc.Payee);
      var desc = (dir === 'in' ? 'دریافت ' : 'پرداخت ') + label + (who ? ' - ' + who : '') + (tr_(y.Description) ? ' - ' + tr_(y.Description) : '');
      var cp = pt ? function (dr, cr) { return ac_partyR_(X, pt, pid, dr, cr, desc); } : function (dr, cr) { return ac_r_(X, 'pay_other', dr, cr, {desc: desc}); };
      var side;
      if (type === 'sale') {
        /* فاکتور فروش: فقط وقتی دریافت/تعهد/انتقال واقعاً ثبت و ردیف کامل است سند صادر می‌شود (بدون حدس حساب پیش‌فرض) */
        if (!ac_dj_(y.DateGregorian, y.DateJalali)) throw new Error('تاریخ ردیف دریافت/پرداخت ثبت نشده است؛ سند صادر نشد.');
        if (tr_(y.CAcc)) {
          var ca = X.c.accs[y.CAcc]; if (!ca) throw new Error('حساب انتخاب‌شده در ردیف دریافت پیدا نشد؛ سند صادر نشد.');
          side = function (dr, cr) { return {AccID: ca.AccID, DetKind: tr_(y.CDetKind), DetID: tr_(y.CDetID), PartyType: tr_(y.CPartyID) ? tr_(y.CPartyType) : '', PartyID: tr_(y.CPartyID), Description: desc, Debit: dr > 0 ? dr : 0, Credit: cr > 0 ? cr : 0}; };
        } else if (tr_(y.AccountID) && X.c.bank[y.AccountID]) side = function (dr, cr) { return ac_bankR_(X, tr_(y.AccountID), dr, cr, desc, y.Method); };
        else throw new Error('برای این ردیف دریافت/پرداخت، بانک/صندوق یا حساب دیگر انتخاب نشده است؛ سند صادر نشد.');
      } else side = function (dr, cr) { return ac_bankR_(X, tr_(y.AccountID), dr, cr, desc, y.Method); };
      var rows = dir === 'in' ? [side(a, 0), cp(0, a)] : [cp(a, 0), side(0, a)];
      ac_put_(X, out, 'pay', type + ':' + id, y.DateGregorian, y.DateJalali, desc, rows, type === 'purchase' ? doc.InvoiceNo : (type === 'sale' ? doc.SerialNo : doc.DocNo));
    });
  };
  rows_('Payments').forEach(function (y) { if (pur[y.InvoiceID]) one(y.PaymentID, 'purchase', pur[y.InvoiceID], y); });
  rows_('DocPayments').forEach(function (y) {
    if (y.CompanyID !== X.co) return;
    var doc = y.DocType === 'sale' ? sal[y.DocID] : (y.DocType === 'expense' ? exp[y.DocID] : null);
    one(y.DPID, y.DocType, doc, y);
  });
}
function ac_bCheque_(X, out) {
  rows_('Cheques').forEach(function (c) {
    if (c.CompanyID !== X.co) return;
    ac_try_(X, 'چک ' + (c.No || c.SayadNo), function () {
      var amt = r2_(ac_n_(c.Amount)); if (amt <= 0) return;
      var inn = c.Dir === 'in', no = c.No || c.SayadNo, pt = c.PartyType || (inn ? 'customer' : 'supplier'), pid = c.PartyID, who = c.PartyName || ac_pname_(X, pt, pid);
      var base = (inn ? 'چک دریافتی ' : 'چک پرداختی ') + no + (who ? (inn ? ' از ' : ' به ') + who : '');
      var bank = c.AccountID && X.c.bank[c.AccountID] ? c.AccountID : '';
      var bd = function (dr, cr, key, desc) { return ac_r_(X, key, dr, cr, {dk: bank ? 'bank' : '', did: bank, desc: desc}); };
      var st = tr_(c.Status), sd = ac_dj_('', tr_(c.StatusDate)) || ac_dj_(c.DueGregorian, c.DueJalali) || ac_dj_(c.DateGregorian, c.DateJalali);
      var party = function (dr, cr, desc) { return ac_partyR_(X, pt, pid, dr, cr, desc); };
      var reg = function (rows) { ac_put_(X, out, 'chqreg', c.ChequeID, c.DateGregorian, c.DateJalali, base + ' - ثبت', rows, no); };
      var step = function (desc, rows) { ac_put_(X, out, 'chqst', c.ChequeID, sd ? sd.g : c.DateGregorian, sd ? sd.j : c.DateJalali, base + ' - ' + desc, rows, no); };
      if (inn) {
        var nr = function (dr, cr, d) { return ac_r_(X, 'notes_rec', dr, cr, {pt: pt === 'customer' ? 'customer' : '', pid: pt === 'customer' && X.c.cus[pid] ? pid : '', desc: d}); };
        reg([nr(amt, 0, base), party(0, amt, base)]);
        if (st === 'در جریان وصول') step('در جریان وصول', [bd(amt, 0, 'notes_collect', base + ' - در جریان وصول'), nr(0, amt, base)]);
        else if (st === 'وصول شده') step('وصول', [ac_bankR_(X, bank, amt, 0, base + ' - وصول'), nr(0, amt, base)]);
        else if (st === 'عودت شده') step('عودت', [party(amt, 0, base + ' - عودت'), nr(0, amt, base)]);
        else if (st === 'خرج شده') step('خرج', [ac_r_(X, 'ap', amt, 0, {desc: base + ' - خرج چک (طرف‌حساب ثبت نشده)'}), nr(0, amt, base)]);
        else if (st === 'تنزیل شده') {
          var it = Math.min(r2_(ac_n_(c.Interest)), amt), rows = [ac_bankR_(X, bank, amt - it, 0, base + ' - تنزیل'), nr(0, amt, base)];
          if (it > 0) rows.splice(1, 0, ac_r_(X, 'fin_exp', it, 0, {desc: base + ' - بهره و کارمزد تنزیل'}));
          step('تنزیل', rows);
        }
      } else {
        var np = function (dr, cr, d) { return ac_r_(X, 'notes_pay', dr, cr, {dk: bank ? 'bank' : '', did: bank, pt: pt === 'supplier' && X.c.sup[pid] ? 'supplier' : '', pid: pt === 'supplier' && X.c.sup[pid] ? pid : '', desc: d}); };
        reg([party(amt, 0, base), np(0, amt, base)]);
        if (st === 'پاس شده') step('پاس شدن', [np(amt, 0, base), ac_bankR_(X, bank, 0, amt, base + ' - پاس شدن')]);
        else if (st === 'برگشتی') step('برگشت', [np(amt, 0, base), party(0, amt, base + ' - برگشت')]);
      }
    });
  });
}
function ac_bTransfer_(X, out) {
  rows_('Transfers').forEach(function (t) {
    if (t.CompanyID !== X.co) return;
    ac_try_(X, 'انتقال ' + t.No, function () {
      var amt = r2_(ac_n_(t.Amount)), fee = r2_(ac_n_(t.Fee)), f = X.c.bank[t.FromID], to = X.c.bank[t.ToID]; if (amt <= 0 || !f || !to) return;
      var d = 'انتقال شماره ' + t.No + ' از ' + bk_accName_(f) + ' به ' + bk_accName_(to) + (tr_(t.Description) ? ' - ' + t.Description : '');
      var rows = [ac_bankR_(X, t.ToID, amt, 0, d), ac_bankR_(X, t.FromID, 0, amt, d)];
      if (fee > 0) { rows.push(ac_r_(X, 'bank_fee', fee, 0, {desc: 'کارمزد ' + d})); rows.push(ac_bankR_(X, t.FromID, 0, fee, 'کارمزد ' + d)); }
      ac_put_(X, out, 'transfer', t.TransferID, t.DateGregorian, t.DateJalali, d, rows, t.No);
    });
  });
}
function ac_bBankTx_(X, out) {
  rows_('BankTx').forEach(function (t) {
    if (t.CompanyID !== X.co || t.SrcType !== 'manual') return;
    ac_try_(X, 'گردش متفرقه ' + t.DocNo, function () {
      var dr = r2_(ac_n_(t.Debit)), cr = r2_(ac_n_(t.Credit)), a = dr > 0 ? dr : cr; if (a <= 0) return;
      var d = (dr > 0 ? 'دریافت متفرقه - ' : 'پرداخت متفرقه - ') + tr_(t.Description), cnt;
      var ca = tr_(t.CounterAcc) && X.c.accs[t.CounterAcc] ? X.c.accs[t.CounterAcc] : null;
      if (ca) {
        var o = {desc: d}, pp = tr_(t.CounterParty).split(':');
        if (ca.Det5 && pp.length === 2 && ac_partyRec_(X.c, pp[0], pp[1])) { o.pt = pp[0]; o.pid = pp[1]; }
        cnt = {AccID: ca.AccID, DetKind: '', DetID: '', PartyType: o.pt || '', PartyID: o.pid || '', Description: d, Debit: dr > 0 ? 0 : a, Credit: dr > 0 ? a : 0};
      } else cnt = dr > 0 ? ac_r_(X, 'other_inc', 0, a, {desc: d}) : ac_r_(X, 'expense_misc', a, 0, {desc: d});
      ac_put_(X, out, 'banktx', t.TxID, t.DateGregorian, t.DateJalali, d, dr > 0 ? [ac_bankR_(X, t.AccountID, a, 0, d), cnt] : [cnt, ac_bankR_(X, t.AccountID, 0, a, d)], t.DocNo);
    });
  });
}

/* ---------- همگام‌سازی ---------- */
/* عطف (تاریخ / حرفی / عددی) حساب‌هایی که اجباری شده‌اند را از روی سند مبدأ پر می‌کند؛ اگر نشد، توضیح خطا برمی‌گرداند */
function ac_atf_(X, sp) {
  var lab = AC_AUTO_LABEL[sp.src] || '', no = tr_(sp.no), miss = [];
  sp.rows.forEach(function (r) {
    var a = X.c.accs[r.AccID]; if (!a) return;
    if (ac_b_(a.ReqDate, false)) { if (!tr_(r.AtfDate)) r.AtfDate = sp.dateJ; if (!tr_(r.AtfDate)) miss.push('تاریخ عطف'); }
    if (ac_b_(a.ReqTxt, false)) { if (!tr_(r.AtfTxt)) r.AtfTxt = lab; if (!tr_(r.AtfTxt)) miss.push('عطف حرفی'); }
    if (ac_b_(a.ReqNum, false)) { if (!tr_(r.AtfNum)) r.AtfNum = no; if (!tr_(r.AtfNum)) miss.push('عطف عددی (شماره‌ی سند مبدأ)'); }
  });
  return miss.length ? 'برای حساب‌هایی که عطف اجباری دارند مقدار ' + miss.filter(function (x, i) { return miss.indexOf(x) === i; }).join(' و ') + ' از روی سند مبدأ پیدا نشد؛' : '';
}
function ac_sig_(dateG, desc, rows) {
  return JSON.stringify([dateG, desc, rows.map(function (r) { return [r.AccID, r.DetKind || '', r.DetID || '', r.PartyType || '', r.PartyID || '', r.Description || '', r2_(ac_n_(r.Debit)), r2_(ac_n_(r.Credit)), r.AtfDate || '', r.AtfTxt || '', r.AtfNum || '']; })]);
}
function ac_autoSync_(co) {
  return locked_(function () {
    ac_ensureSys_(co); ac_fixRef_(co);
    var X = ac_xctx_(co), out = [];
    [ac_bOpen_, ac_bStockAdj_, ac_bPurchase_, ac_bSale_, ac_bExpense_, ac_bProd_, ac_bPay_, ac_bCheque_, ac_bTransfer_, ac_bBankTx_].forEach(function (b) {
      try { b(X, out); } catch (e) { X.errs.push(String(e.message || e)); }
    });
    var want = {};
    out.forEach(function (sp) {
      sp.rows = sp.rows.filter(function (r) { return r.Debit > 0 || r.Credit > 0; });
      var D = 0, C = 0; sp.rows.forEach(function (r) { D += r.Debit; C += r.Credit; });
      D = r2_(D); C = r2_(C);
      if (!sp.rows.length || (D <= 0 && C <= 0)) return;
      if (Math.abs(D - C) > 0.005) { X.errs.push((AC_AUTO_LABEL[sp.src] || sp.src) + ' «' + sp.desc + '»: سند تراز نیست (بد ' + D + ' / بس ' + C + ') و صادر نشد.'); return; }
      var dd = ac_dj_(sp.dateG, sp.dateJ); if (!dd) { X.errs.push((AC_AUTO_LABEL[sp.src] || sp.src) + ' «' + sp.desc + '»: تاریخ نامعتبر است.'); return; }
      sp.dateG = dd.g; sp.dateJ = dd.j;
      var miss = ac_atf_(X, sp); if (miss) { X.errs.push((AC_AUTO_LABEL[sp.src] || sp.src) + ' «' + sp.desc + '»: ' + miss + ' سند صادر نشد.'); return; }
      sp.D = D; sp.C = C; sp.key = sp.src + '|' + sp.id; sp.sig = ac_sig_(sp.dateG, sp.desc, sp.rows);
      want[sp.key] = sp;
    });
    /* وضع موجود */
    var ex = {}, dels = {}, vids = {};
    rows_('Vouchers').forEach(function (v) {
      if (v.CompanyID !== co || String(v.Source) !== 'auto') return;
      var k = v.SrcType + '|' + v.SrcID;
      if (ex[k]) { dels[v.VID] = 1; return; }
      ex[k] = v; vids[v.VID] = 1;
    });
    var vr = {};
    rows_('VoucherRows').forEach(function (r) { if (r.CompanyID === co && vids[r.VID]) (vr[r.VID] = vr[r.VID] || []).push(r); });
    var created = 0, updated = 0, deleted = 0, news = [], upd = [];
    var clsd = fy_closedFn_(co, true), frozen = 0;
    Object.keys(ex).forEach(function (k) {
      var v = ex[k], sp = want[k];
      if (clsd && clsd(v.DateGregorian)) { /* سال بسته: سند خودکار دست‌نخورده می‌ماند */
        var cur0 = (vr[v.VID] || []).sort(function (a, b) { return Number(a.LineNo) - Number(b.LineNo); });
        if (!sp || ac_sig_(v.DateGregorian, v.Description, cur0) !== sp.sig) { frozen++; X.errs.push('سال بسته: ' + (AC_AUTO_LABEL[v.SrcType] || v.SrcType) + ' «' + v.Description + '» نسبت به سند مبدأ تغییر کرده، ولی چون سال مالی بسته است سند حسابداری آن اصلاح نشد.'); }
        want[k] = null; return;
      }
      if (!sp) { dels[v.VID] = 1; deleted++; return; }
      var cur = (vr[v.VID] || []).sort(function (a, b) { return Number(a.LineNo) - Number(b.LineNo); });
      if (ac_sig_(v.DateGregorian, v.Description, cur) !== sp.sig || v.Status !== 'confirmed') { dels[v.VID] = 1; upd.push({v: v, sp: sp}); updated++; }
    });
    Object.keys(want).forEach(function (k) { if (!ex[k] && want[k]) { if (clsd && clsd(want[k].dateG)) { X.errs.push('سال بسته: ' + (AC_AUTO_LABEL[want[k].src] || want[k].src) + ' «' + want[k].desc + '» در سال مالی بسته است و سند حسابداری برایش صادر نشد.'); return; } news.push(want[k]); } });
    news.sort(function (a, b) { return a.dateG < b.dateG ? -1 : (a.dateG > b.dateG ? 1 : ((AC_AUTO_ORD[a.src] || 0) - (AC_AUTO_ORD[b.src] || 0) || (a.key < b.key ? -1 : 1))); });
    created = news.length;
    if (Object.keys(dels).length) {
      delWhere_('VoucherRows', 2, function (x) { return dels[x]; });
      delWhere_('Vouchers', 1, function (x) { return dels[x]; });
    }
    var all = upd.map(function (u) { return {sp: u.sp, vid: u.v.VID, no: String(u.v.No), ref: String(u.v.RefNo || ''), created: u.v.CreatedAt}; });
    if (news.length) {
      var nid = nextIds_('VCH', news.length), alloc = ac_noAlloc_(co), now0 = nowStr_(), rf = ac_takeRef_(co, news.length);
      news.forEach(function (sp, i) { all.push({sp: sp, vid: nid[i], no: alloc(sp.dateG), ref: rf[i], created: now0}); });
    }
    if (all.length) {
      var now = nowStr_(), nrows = 0; all.forEach(function (a) { nrows += a.sp.rows.length; });
      var rid = nextIds_('VRW', nrows), k = 0, hs = [], rs = [];
      all.forEach(function (a) {
        var sp = a.sp;
        hs.push(pr_arr_('Vouchers', {VID: a.vid, CompanyID: co, No: a.no, RefNo: a.ref, Ref: '', DateJalali: sp.dateJ, DateGregorian: sp.dateG, Time: '', Description: sp.desc, Status: 'confirmed', Source: 'auto', SrcType: sp.src, SrcID: sp.id, ProjID: '', TotalDebit: sp.D, TotalCredit: sp.C, CreatedAt: a.created, UpdatedAt: now}));
        sp.rows.forEach(function (r, i) { rs.push(pr_arr_('VoucherRows', {VRID: rid[k++], VID: a.vid, CompanyID: co, LineNo: i + 1, AccID: r.AccID, DetKind: r.DetKind, DetID: r.DetID, PartyType: r.PartyType, PartyID: r.PartyID, ProjID: '', Description: r.Description, Debit: r.Debit > 0 ? r.Debit : '', Credit: r.Credit > 0 ? r.Credit : '', AtfDate: r.AtfDate || '', AtfTxt: r.AtfTxt || '', AtfNum: r.AtfNum || ''})); });
      });
      appendRows_(sh_('Vouchers'), hs);
      appendRows_(sh_('VoucherRows'), rs);
    }
    if (created || updated || deleted || Object.keys(dels).length) bump_();
    var prev = getSet_('acAutoErr_' + co), msgs = X.errs.slice(0, 30), cur2 = X.errs.length ? JSON.stringify({at: nowStr_(), n: X.errs.length, msgs: msgs}) : '';
    if (cur2 !== prev) setSet_('acAutoErr_' + co, cur2);
    return {created: created, updated: updated, deleted: deleted, total: Object.keys(want).length, errors: X.errs.length, msgs: msgs};
  });
}
function autoRebuild_(p) {
  var co = ac_co_(p); ac_ensureSeed_(co);
  setSet_('acAutoInit_' + co, '1');
  return ac_autoSync_(co);
}
function ac_autoErr_(co) {
  var s = getSet_('acAutoErr_' + co); if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}
/* اولین باری که بخش حسابداری یک شرکت باز می‌شود: همه‌ی سابقه یک‌جا به سند تبدیل می‌شود */
function ac_initAuto_(co) {
  if (getSet_('acAutoInit_' + co) === '1') return;
  setSet_('acAutoInit_' + co, '1');
  try { ac_autoSync_(co); } catch (e) { setSet_('acAutoErr_' + co, JSON.stringify({at: nowStr_(), n: 1, msgs: ['خطای ساخت اولیه: ' + String(e.message || e)]})); }
}
