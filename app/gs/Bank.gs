/* ===== پنل بانکداری: بانک‌ها، صندوق‌ها، تنخواه‌گردان‌ها، انتقال، چک‌ها و دریافت/پرداخت فاکتورها =====
   - هر حساب (بانک/صندوق/تنخواه) یک «گردش» دارد: دریافتی‌ها ستون بدهکار، پرداختی‌ها ستون بستانکار؛ تراز = تفاضل؛ وضعیت: بد (مانده بدهکار) / بس (مانده بستانکار)
   - پرداخت‌های فاکتور خرید (جدول Payments)، دریافت‌های فاکتور فروش و پرداخت‌های فاکتور هزینه (جدول DocPayments)، انتقال‌ها و چک‌ها همه خودکار در گردش حساب می‌نشینند. */
var BK_KINDS = {bank: 'بانک', cash: 'صندوق', imprest: 'تنخواه‌گردان'};
var CHQ_IN = ['عادی', 'در جریان وصول', 'وصول شده', 'عودت شده', 'خرج شده', 'تنزیل شده'];
var CHQ_OUT = ['عادی', 'پاس شده', 'برگشتی'];
H.BankAccounts = ['AccountID', 'CompanyID', 'Kind', 'Code', 'Name', 'IsActive', 'IsDefault', 'Branch', 'CardNo', 'OwnerName', 'AccountNo', 'Sheba', 'PosNo', 'Mobile', 'SwitchNo', 'TerminalNo', 'MerchantNo', 'Currency', 'Notes', 'OpeningAmount', 'OpeningDate', 'CreatedAt', 'UpdatedAt'];
H.BankTx = ['TxID', 'CompanyID', 'AccountID', 'DateJalali', 'DateGregorian', 'DocNo', 'Description', 'Debit', 'Credit', 'Ref', 'SrcType', 'SrcID', 'CreatedAt', 'CounterAcc', 'CounterParty'];
H.Transfers = ['TransferID', 'CompanyID', 'No', 'DateJalali', 'DateGregorian', 'FromID', 'ToID', 'Amount', 'Fee', 'Description', 'Ref', 'CreatedAt', 'UpdatedAt'];
H.Cheques = ['ChequeID', 'CompanyID', 'Dir', 'No', 'SayadNo', 'DateJalali', 'DateGregorian', 'DueJalali', 'DueGregorian', 'Amount', 'PartyType', 'PartyID', 'PartyName', 'BankName', 'Branch', 'AccountID', 'Status', 'StatusDate', 'Interest', 'Description', 'SrcType', 'SrcID', 'SrcKey', 'CreatedAt', 'UpdatedAt'];
H.DocPayments = ['DPID', 'CompanyID', 'DocType', 'DocID', 'LineNo', 'DateJalali', 'DateGregorian', 'Method', 'Amount', 'AccountID', 'TrackingNo', 'ChequeNo', 'SayadNo', 'ChequeBank', 'ChequeDueJalali', 'ChequeDueGregorian', 'ChequeStatus', 'Description', 'CAcc', 'CDetKind', 'CDetID', 'CPartyType', 'CPartyID'];

/* ---------- ابزارها ---------- */
function bk_co_(p) { if (!p || !p.company) throw new Error('شرکت/مشتری را انتخاب کنید.'); return p.company; }
function bk_acct_(co, id) { return pr_find_('BankAccounts', 'AccountID', id, co, 'حساب'); }
function bk_today_() { return parseJ_(pr_today_()); }
function bk_dateReq_(s, what) { var d = parseJ_(s); if (!d) throw new Error((what || 'تاریخ') + ' نامعتبر است (قالب: 1405/07/23).'); return d; }
function bk_digits_(s) { return fa2en_(tr_(s)).replace(/[\s\-]/g, ''); }
function bk_accName_(a) { return a ? ((a.Code ? a.Code + ' - ' : '') + a.Name) : ''; }
function bk_sign_(x) { return x > 0.005 ? 'بد' : (x < -0.005 ? 'بس' : ''); }
function bk_sortTx_(a, b) { return a.DateGregorian < b.DateGregorian ? -1 : (a.DateGregorian > b.DateGregorian ? 1 : (a.TxID < b.TxID ? -1 : 1)); }

/* مانده‌ی همه‌ی حساب‌های یک شرکت */
/* گردش‌های مجازیِ ناشی از «سند حسابداری دستی» (تأییدشده) روی حساب‌های بانک/صندوق/تنخواه: هر ردیف سند که تفصیلی آن یک حساب بانکی است */
function bk_vTx_(co) {
  var vs = {}, ok = {bank: 1, cash: 1, imprest: 1}, out = [];
  rows_('Vouchers').forEach(function (v) { if (v.CompanyID === co && v.Status === 'confirmed' && String(v.Source) !== 'auto' && String(v.Source) !== 'sys') vs[v.VID] = v; });
  rows_('VoucherRows').forEach(function (r) {
    if (r.CompanyID !== co) return; var v = vs[r.VID]; if (!v || !r.DetID || !ok[r.DetKind]) return;
    var d = Number(r.Debit) || 0, c = Number(r.Credit) || 0; if (!d && !c) return;
    out.push({TxID: 'V-' + r.VRID, CompanyID: co, AccountID: r.DetID, DateJalali: v.DateJalali, DateGregorian: v.DateGregorian, DocNo: 'سند ' + v.No, Description: r.Description || v.Description || '', Debit: d || '', Credit: c || '', Ref: v.Ref || '', SrcType: 'voucher', SrcID: v.VID, CounterAcc: '', CounterParty: ''});
  });
  return out;
}
function bk_allTx_(co) { return rows_('BankTx').filter(function (t) { return t.CompanyID === co; }).concat(bk_vTx_(co)); }
function bk_balances_(co) {
  var m = {};
  bk_allTx_(co).forEach(function (t) {
    if (t.CompanyID !== co) return;
    var o = m[t.AccountID] = m[t.AccountID] || {d: 0, c: 0, n: 0};
    o.d += Number(t.Debit) || 0; o.c += Number(t.Credit) || 0; o.n++;
  });
  return m;
}
function bk_accOut_(r, bal) {
  var o = Object.assign({}, r), b = bal[r.AccountID] || {d: 0, c: 0, n: 0}, op = Number(r.OpeningAmount) || 0;
  o.IsActive = r.IsActive !== false && String(r.IsActive) !== 'false';
  o.IsDefault = r.IsDefault === true || String(r.IsDefault) === 'true';
  o.OpeningAmount = op;
  o.Debit = r2_(b.d + (op > 0 ? op : 0)); o.Credit = r2_(b.c + (op < 0 ? -op : 0));
  o.Balance = r2_(op + b.d - b.c); o.Status = bk_sign_(o.Balance); o.TxCount = b.n;
  o.Title = bk_accName_(r);
  return o;
}

/* ---------- حساب‌ها (بانک / صندوق / تنخواه‌گردان) ---------- */
function bankAccList_(p) {
  var co = bk_co_(p), bal = bk_balances_(co);
  var rows = rows_('BankAccounts').filter(function (r) { return r.CompanyID === co && (!p.kind || r.Kind === p.kind); })
    .map(function (r) { return bk_accOut_(r, bal); });
  rows.sort(function (a, b) { return String(a.Code) < String(b.Code) ? -1 : (String(a.Code) > String(b.Code) ? 1 : 0); });
  return {rows: rows};
}
function bk_nextCode_(co, kind) {
  var mx = 0;
  rows_('BankAccounts').forEach(function (r) { if (r.CompanyID === co && r.Kind === kind) { var n = parseInt(fa2en_(String(r.Code)), 10); if (n > mx) mx = n; } });
  return ('0000' + (mx + 1)).slice(-4);
}
function bankAccSave_(p) {
  var co = bk_co_(p), o = p.obj || {};
  var kind = o.Kind; if (!BK_KINDS[kind]) throw new Error('نوع حساب نامعتبر است.');
  var name = tr_(o.Name); if (!name) throw new Error('نام ' + BK_KINDS[kind] + ' الزامی است.');
  var card = bk_digits_(o.CardNo), sheba = bk_digits_(o.Sheba).toUpperCase();
  if (card && !/^\d{16}$/.test(card)) throw new Error('شماره کارت باید ۱۶ رقم باشد.');
  if (sheba && !/^IR\d{24}$/.test(sheba)) throw new Error('شماره شبا باید با IR شروع شود و بعد از آن ۲۴ رقم باشد.');
  var op = pr_num_(o.OpeningAmount), od = tr_(o.OpeningDate) ? bk_dateReq_(o.OpeningDate, 'تاریخ افتتاح') : null;
  return locked_(function () {
    var list = rows_('BankAccounts').filter(function (r) { return r.CompanyID === co; }), id = o.AccountID, old = null;
    if (id) { old = bk_acct_(co, id); if (old.Kind !== kind) throw new Error('نوع حساب قابل تغییر نیست.'); }
    if (list.some(function (r) { return r.Kind === kind && r.AccountID !== id && nn_(r.Name) === nn_(name); })) throw new Error('«' + name + '» قبلاً ثبت شده است.');
    var code = tr_(fa2en_(o.Code));
    if (code && list.some(function (r) { return r.Kind === kind && r.AccountID !== id && String(r.Code) === code; })) throw new Error('این کد حسابداری قبلاً استفاده شده است.');
    if (!code) code = old && old.Code ? old.Code : bk_nextCode_(co, kind);
    var now = nowStr_(), act = !(o.IsActive === false || String(o.IsActive) === 'false'), def = o.IsDefault === true || String(o.IsDefault) === 'true';
    if (!id) id = nextIds_('ACC', 1)[0];
    if (def) list.forEach(function (r) { if (r.Kind === kind && r.AccountID !== id && (r.IsDefault === true || String(r.IsDefault) === 'true')) { r.IsDefault = false; pr_setRow_('BankAccounts', 'AccountID', r.AccountID, r); } });
    pr_setRow_('BankAccounts', 'AccountID', id, {AccountID: id, CompanyID: co, Kind: kind, Code: code, Name: name, IsActive: act, IsDefault: def, Branch: tr_(o.Branch), CardNo: card, OwnerName: tr_(o.OwnerName), AccountNo: bk_digits_(o.AccountNo), Sheba: sheba, PosNo: tr_(o.PosNo), Mobile: bk_digits_(o.Mobile), SwitchNo: tr_(o.SwitchNo), TerminalNo: tr_(o.TerminalNo), MerchantNo: tr_(o.MerchantNo), Currency: 'IRR', Notes: tr_(o.Notes), OpeningAmount: op || '', OpeningDate: od ? od.j : '', CreatedAt: old ? old.CreatedAt : now, UpdatedAt: now});
    bump_();
    return {AccountID: id, Code: code};
  });
}
function bankAccDelete_(p) {
  var co = bk_co_(p);
  return locked_(function () {
    var a = bk_acct_(co, p.id), use = [];
    var n1 = rows_('BankTx').filter(function (t) { return t.CompanyID === co && t.AccountID === a.AccountID; }).length;
    var n2 = rows_('Transfers').filter(function (t) { return t.CompanyID === co && (t.FromID === a.AccountID || t.ToID === a.AccountID); }).length;
    var n3 = rows_('Cheques').filter(function (t) { return t.CompanyID === co && t.AccountID === a.AccountID; }).length;
    var n4 = rows_('Payments').filter(function (t) { return t.AccountID === a.AccountID; }).length + rows_('DocPayments').filter(function (t) { return t.CompanyID === co && t.AccountID === a.AccountID; }).length;
    var mvb = {}; rows_('Vouchers').forEach(function (v) { if (String(v.Source) !== 'auto') mvb[v.VID] = 1; });
    var n5 = rows_('VoucherRows').filter(function (t) { return mvb[t.VID] && t.CompanyID === co && t.DetID === a.AccountID && (t.DetKind === 'bank' || t.DetKind === 'cash' || t.DetKind === 'imprest'); }).length;
    if (n5) use.push(n5 + ' ردیف سند حسابداری');
    if (n1) use.push(n1 + ' ردیف گردش'); if (n2) use.push(n2 + ' انتقال'); if (n3) use.push(n3 + ' چک'); if (n4) use.push(n4 + ' پرداخت/دریافت فاکتور');
    if (use.length) throw new Error('«' + a.Name + '» حذف نمی‌شود، چون در این موارد استفاده شده است: ' + use.join('، ') + '.\nبه‌جای حذف می‌توانید آن را «غیرفعال» کنید.');
    delWhere_('BankAccounts', 1, function (v) { return v === a.AccountID; });
    bump_();
    return {deleted: 1};
  });
}

/* ---------- ردیف‌های گردش ---------- */
function bk_delTx_(srcType, srcId) {
  var s = sh_('BankTx'), last = s.getLastRow(); if (last < 2) return 0;
  var c = H.BankTx.indexOf('SrcType') + 1, v = s.getRange(2, c, last - 1, 2).getValues(), rows = [];
  for (var i = 0; i < v.length; i++) if (String(v[i][0]) === srcType && String(v[i][1]) === srcId) rows.push(i + 2);
  delRows_(s, rows);
  return rows.length;
}
function bk_putTx_(co, srcType, srcId, list) {
  list = list.filter(function (t) { return (Number(t.Debit) || 0) > 0 || (Number(t.Credit) || 0) > 0; });
  if (!list.length) return;
  var ids = nextIds_('BTX', list.length), now = nowStr_();
  appendRows_(sh_('BankTx'), list.map(function (t, i) {
    return pr_arr_('BankTx', {TxID: ids[i], CompanyID: co, AccountID: t.AccountID, DateJalali: t.DateJalali, DateGregorian: t.DateGregorian, DocNo: t.DocNo || '', Description: t.Description || '', Debit: (Number(t.Debit) || 0) > 0 ? r2_(Number(t.Debit)) : '', Credit: (Number(t.Credit) || 0) > 0 ? r2_(Number(t.Credit)) : '', Ref: t.Ref || '', SrcType: srcType, SrcID: srcId, CreatedAt: now, CounterAcc: t.CounterAcc || '', CounterParty: t.CounterParty || ''});
  }));
}

/* گردش حساب: p = {company, account, from, to} */
function bankLedger_(p) {
  var co = bk_co_(p), a = bk_acct_(co, p.account), bal0 = bk_balances_(co);
  var g1 = tr_(p.from) ? bk_dateReq_(p.from, 'تاریخ شروع') : null, g2 = tr_(p.to) ? bk_dateReq_(p.to, 'تاریخ پایان') : null;
  var tx = bk_allTx_(co).filter(function (t) { return t.AccountID === a.AccountID; }).sort(bk_sortTx_);
  var op = Number(a.OpeningAmount) || 0, od = parseJ_(a.OpeningDate), rows = [], bal = 0, T = {debit: 0, credit: 0};
  var add = function (r) {
    bal += (r.Debit || 0) - (r.Credit || 0); r.Balance = r2_(bal); r.Status = bk_sign_(bal);
    T.debit += r.Debit || 0; T.credit += r.Credit || 0; rows.push(r);
  };
  var carry = 0, showOp = true;
  if (g1 && od && od.g < g1.g) { carry += op; showOp = false; }
  else if (g1 && !od) { /* افتتاح بدون تاریخ: همیشه اول گردش */ }
  if (g1) tx.forEach(function (t) { if (t.DateGregorian < g1.g) carry += (Number(t.Debit) || 0) - (Number(t.Credit) || 0); });
  if (g1 && Math.abs(carry) > 0.005) add({Kind: 'carry', DateJalali: g1.j, DocNo: '', Description: 'مانده از قبل از ' + g1.j, Debit: carry > 0 ? carry : 0, Credit: carry < 0 ? -carry : 0, Ref: ''});
  if (showOp && Math.abs(op) > 0.005) add({Kind: 'open', DateJalali: a.OpeningDate || '', DocNo: '', Description: 'افتتاح حساب - ' + a.Name, Debit: op > 0 ? op : 0, Credit: op < 0 ? -op : 0, Ref: ''});
  tx.forEach(function (t) {
    if (g1 && t.DateGregorian < g1.g) return;
    if (g2 && t.DateGregorian > g2.g) return;
    add({Kind: 'tx', TxID: t.TxID, DateJalali: t.DateJalali, DocNo: t.DocNo, Description: t.Description, Debit: Number(t.Debit) || 0, Credit: Number(t.Credit) || 0, Ref: t.Ref, SrcType: t.SrcType, SrcID: t.SrcID, CounterAcc: t.CounterAcc || '', CounterParty: t.CounterParty || ''});
  });
  T.debit = r2_(T.debit); T.credit = r2_(T.credit); T.balance = r2_(bal); T.status = bk_sign_(bal);
  return {account: bk_accOut_(a, bal0), rows: rows, totals: T};
}

/* ثبت دستی دریافت/پرداخت در گردش (متفرقه) */
function bankTxSave_(p) {
  var co = bk_co_(p), o = p.obj || {};
  var a = bk_acct_(co, o.AccountID), d = bk_dateReq_(o.DateJalali), amt = pr_num_(o.Amount), dir = o.Dir === 'out' ? 'out' : 'in';
  if (!(amt > 0) || !dec2_(amt)) throw new Error('مبلغ نامعتبر است.');
  if (!tr_(o.Description)) throw new Error('شرح را بنویسید.');
  var ca = null, cp = '';
  if (tr_(o.CounterAcc)) {
    ca = rows_('Accounts').filter(function (x) { return x.CompanyID === co && x.AccID === o.CounterAcc; })[0];
    if (!ca) throw new Error('حساب مقابل پیدا نشد.');
    if (Number(ca.Level) !== 3 || !ac_b_(ca.Post, false)) throw new Error('حساب مقابل باید یک «معین» با اجازه‌ی ثبت سند باشد.');
    var pp = tr_(o.CounterParty).split(':');
    if (pp.length === 2 && ca.Det5) { var okp = pp[0] === 'customer' ? rows_('Customers').some(function (x) { return x.CompanyID === co && x.CustomerID === pp[1]; }) : (pp[0] === 'supplier' ? rows_('Suppliers').some(function (x) { return x.CompanyID === co && x.SupplierID === pp[1]; }) : (pp[0] === 'employee' ? rows_('Employees').some(function (x) { return x.CompanyID === co && x.EmpID === pp[1]; }) : false)); if (!okp) throw new Error('شخص مقابل معتبر نیست.'); cp = o.CounterParty; }
  }
  return locked_(function () {
    var id = o.TxID, no = tr_(o.DocNo);
    if (id) {
      var old = pr_find_('BankTx', 'TxID', id, co, 'ردیف گردش');
      if (old.SrcType !== 'manual') throw new Error('این ردیف از فاکتور، انتقال یا چک ساخته شده است و از همان‌جا اصلاح می‌شود.');
      delWhere_('BankTx', 1, function (v) { return v === id; });
      no = no || old.DocNo;
    }
    if (!no) { var mx = 0; rows_('BankTx').forEach(function (t) { if (t.CompanyID === co && t.SrcType === 'manual') { var n = parseInt(fa2en_(String(t.DocNo)), 10); if (n > mx) mx = n; } }); no = String(mx + 1); }
    var sid = id || ('M' + nextIds_('BKM', 1)[0]);
    var ids = id ? [id] : null, rowsT = [{AccountID: a.AccountID, DateJalali: d.j, DateGregorian: d.g, DocNo: no, Description: tr_(o.Description), Debit: dir === 'in' ? amt : 0, Credit: dir === 'out' ? amt : 0, Ref: tr_(o.Ref), CounterAcc: ca ? ca.AccID : '', CounterParty: cp}];
    bk_putTx_(co, 'manual', sid, rowsT);
    bump_();
    return {saved: 1};
  });
}
function bankTxDelete_(p) {
  var co = bk_co_(p);
  return locked_(function () {
    var t = pr_find_('BankTx', 'TxID', p.id, co, 'ردیف گردش');
    if (t.SrcType !== 'manual') throw new Error('این ردیف از فاکتور، انتقال یا چک ساخته شده است؛ از همان‌جا حذف یا اصلاح کنید.');
    delWhere_('BankTx', 1, function (v) { return v === p.id; });
    bump_();
    return {deleted: 1};
  });
}

/* ---------- انتقال بین بانک / صندوق / تنخواه ---------- */
function bk_transferTx_(co, t) {
  bk_delTx_('transfer', t.TransferID);
  var f = bk_acct_(co, t.FromID), to = bk_acct_(co, t.ToID), amt = Number(t.Amount) || 0, fee = Number(t.Fee) || 0, desc = tr_(t.Description);
  var base = {DateJalali: t.DateJalali, DateGregorian: t.DateGregorian, DocNo: String(t.No), Ref: t.Ref || ''};
  var L = [
    Object.assign({AccountID: f.AccountID, Credit: amt, Description: 'انتقال وجه به ' + bk_accName_(to) + (desc ? ' - ' + desc : '')}, base),
    Object.assign({AccountID: to.AccountID, Debit: amt, Description: 'انتقال وجه از ' + bk_accName_(f) + (desc ? ' - ' + desc : '')}, base)
  ];
  if (fee > 0) L.push(Object.assign({AccountID: f.AccountID, Credit: fee, Description: 'کارمزد خدمات بانکی - انتقال شماره ' + t.No}, base));
  bk_putTx_(co, 'transfer', t.TransferID, L);
}
function transferSave_(p) {
  var co = bk_co_(p), o = p.obj || {};
  var f = bk_acct_(co, o.FromID), to = bk_acct_(co, o.ToID), d = bk_dateReq_(o.DateJalali), amt = pr_num_(o.Amount), fee = pr_num_(o.Fee);
  if (f.AccountID === to.AccountID) throw new Error('مبدأ و مقصد انتقال نباید یکی باشد.');
  if (!(amt > 0) || !dec2_(amt)) throw new Error('مبلغ انتقال نامعتبر است.');
  if (fee < 0 || !dec2_(fee)) throw new Error('کارمزد نامعتبر است.');
  return locked_(function () {
    var id = o.TransferID, now = nowStr_(), no = Number(fa2en_(String(o.No || ''))) || 0, created = now;
    var all = rows_('Transfers').filter(function (t) { return t.CompanyID === co; });
    if (id) { var old = pr_find_('Transfers', 'TransferID', id, co, 'انتقال'); created = old.CreatedAt; no = no || Number(old.No); }
    if (!no) { all.forEach(function (t) { if (Number(t.No) > no) no = Number(t.No); }); no++; }
    if (all.some(function (t) { return t.TransferID !== id && Number(t.No) === no; })) throw new Error('شماره انتقال تکراری است.');
    if (!id) id = nextIds_('TRF', 1)[0];
    var rec = {TransferID: id, CompanyID: co, No: no, DateJalali: d.j, DateGregorian: d.g, FromID: f.AccountID, ToID: to.AccountID, Amount: amt, Fee: fee > 0 ? fee : '', Description: tr_(o.Description), Ref: tr_(o.Ref), CreatedAt: created, UpdatedAt: now};
    pr_setRow_('Transfers', 'TransferID', id, rec);
    bk_transferTx_(co, rec);
    bump_();
    return {TransferID: id, No: no};
  });
}
function transferDelete_(p) {
  var co = bk_co_(p);
  return locked_(function () {
    pr_find_('Transfers', 'TransferID', p.id, co, 'انتقال');
    bk_delTx_('transfer', p.id);
    delWhere_('Transfers', 1, function (v) { return v === p.id; });
    bump_();
    return {deleted: 1};
  });
}
function transferList_(p) {
  var co = bk_co_(p), g1 = tr_(p.from) ? bk_dateReq_(p.from) : null, g2 = tr_(p.to) ? bk_dateReq_(p.to) : null, nm = {};
  rows_('BankAccounts').forEach(function (a) { if (a.CompanyID === co) nm[a.AccountID] = a; });
  var rows = rows_('Transfers').filter(function (t) {
    if (t.CompanyID !== co) return false;
    if (g1 && t.DateGregorian < g1.g) return false;
    if (g2 && t.DateGregorian > g2.g) return false;
    if (p.account && t.FromID !== p.account && t.ToID !== p.account) return false;
    return true;
  }).map(function (t) {
    var o = Object.assign({}, t); o.Amount = Number(t.Amount) || 0; o.Fee = Number(t.Fee) || 0; o.No = Number(t.No);
    o.From = bk_accName_(nm[t.FromID]); o.To = bk_accName_(nm[t.ToID]); o.FromKind = nm[t.FromID] ? nm[t.FromID].Kind : ''; o.ToKind = nm[t.ToID] ? nm[t.ToID].Kind : '';
    return o;
  });
  rows.sort(function (a, b) { return a.DateGregorian < b.DateGregorian ? 1 : (a.DateGregorian > b.DateGregorian ? -1 : b.No - a.No); });
  var T = {count: rows.length, amount: 0, fee: 0};
  rows.forEach(function (r) { T.amount += r.Amount; T.fee += r.Fee; });
  T.amount = r2_(T.amount); T.fee = r2_(T.fee);
  return {rows: rows, totals: T};
}

/* ---------- چک‌ها ---------- */
function bk_chqStatuses_(dir) { return dir === 'in' ? CHQ_IN : CHQ_OUT; }
function bk_chqFinal_(c) { return (c.Dir === 'in' && (c.Status === 'وصول شده' || c.Status === 'تنزیل شده')) || (c.Dir === 'out' && c.Status === 'پاس شده'); }
/* تبدیل وضعیت چک فاکتور خرید (سه‌حالته) به وضعیت چک و برعکس */
function bk_chqFromPurchase_(dir, st) {
  var m = dir === 'out' ? {'در جریان وصول': 'عادی', 'پاس شده': 'پاس شده', 'برگشتی': 'برگشتی'} : {'در جریان وصول': 'در جریان وصول', 'پاس شده': 'وصول شده', 'برگشتی': 'عودت شده'};
  return m[st] || (dir === 'out' ? 'عادی' : 'در جریان وصول');
}
function bk_chqToPurchase_(st) {
  return {'پاس شده': 'پاس شده', 'وصول شده': 'پاس شده', 'تنزیل شده': 'پاس شده', 'برگشتی': 'برگشتی', 'عودت شده': 'برگشتی'}[st] || 'در جریان وصول';
}
/* ردیف‌های گردشِ یک چک بر اساس وضعیت فعلی‌اش */
function bk_chqTx_(co, c) {
  bk_delTx_('cheque', c.ChequeID);
  if (!bk_chqFinal_(c) || !c.AccountID) return;
  bk_acct_(co, c.AccountID);
  var d = parseJ_(c.StatusDate) || parseJ_(c.DueJalali) || bk_today_(), amt = Number(c.Amount) || 0, no = c.No || c.SayadNo, who = c.PartyName ? (c.Dir === 'in' ? ' از ' : ' به ') + c.PartyName : '';
  var base = {AccountID: c.AccountID, DateJalali: d.j, DateGregorian: d.g, DocNo: tr_(c.No), Ref: c.SayadNo || ''}, L = [];
  if (c.Dir === 'in') {
    L.push(Object.assign({Debit: amt, Description: (c.Status === 'تنزیل شده' ? 'تنزیل چک شماره ' : 'وصول چک شماره ') + no + who}, base));
    var it = Number(c.Interest) || 0;
    if (c.Status === 'تنزیل شده' && it > 0) L.push(Object.assign({Credit: it, Description: 'بهره و کارمزد تنزیل چک شماره ' + no}, base));
  } else L.push(Object.assign({Credit: amt, Description: 'پاس شدن چک شماره ' + no + who}, base));
  bk_putTx_(co, 'cheque', c.ChequeID, L);
}
function bk_chqRow_(c) { return pr_arr_('Cheques', c); }
function bk_chqPut_(c) { pr_setRow_('Cheques', 'ChequeID', c.ChequeID, c); }
function chequeList_(p) {
  var co = bk_co_(p), dir = p.dir === 'out' ? 'out' : 'in', tg = bk_today_().g, g1 = tr_(p.from) ? bk_dateReq_(p.from) : null, g2 = tr_(p.to) ? bk_dateReq_(p.to) : null, q = nn_(p.q || ''), nm = {};
  rows_('BankAccounts').forEach(function (a) { if (a.CompanyID === co) nm[a.AccountID] = a; });
  var all = rows_('Cheques').filter(function (c) { return c.CompanyID === co && c.Dir === dir; }).map(function (c) {
    var o = Object.assign({}, c); o.Amount = Number(c.Amount) || 0; o.Interest = Number(c.Interest) || 0;
    o.Overdue = (c.Status === 'عادی' || c.Status === 'در جریان وصول') && c.DueGregorian && c.DueGregorian < tg;
    o.Account = bk_accName_(nm[c.AccountID]); o.Manual = c.SrcType === 'manual';
    return o;
  });
  var tabs = {all: all.length, overdue: all.filter(function (c) { return c.Overdue; }).length};
  bk_chqStatuses_(dir).forEach(function (s) { tabs[s] = all.filter(function (c) { return c.Status === s; }).length; });
  var rows = all.filter(function (c) {
    if (p.status === 'overdue') { if (!c.Overdue) return false; } else if (p.status && p.status !== 'all' && c.Status !== p.status) return false;
    if (p.account && c.AccountID !== p.account) return false;
    if (g1 && c.DueGregorian < g1.g) return false;
    if (g2 && c.DueGregorian > g2.g) return false;
    if (q && nn_([c.No, c.SayadNo, c.PartyName, c.BankName, c.Branch, c.Description].join(' ')).indexOf(q) < 0) return false;
    return true;
  });
  rows.sort(function (a, b) { return a.DueGregorian < b.DueGregorian ? -1 : (a.DueGregorian > b.DueGregorian ? 1 : 0); });
  var T = {count: rows.length, amount: 0};
  rows.forEach(function (r) { T.amount += r.Amount; }); T.amount = r2_(T.amount);
  return {rows: rows, totals: T, tabs: tabs, statuses: bk_chqStatuses_(dir)};
}
function chequeSave_(p) {
  var co = bk_co_(p), o = p.obj || {}, dir = o.Dir === 'out' ? 'out' : 'in';
  var d = bk_dateReq_(o.DateJalali, 'تاریخ چک'), due = bk_dateReq_(o.DueJalali, 'تاریخ سررسید'), amt = pr_num_(o.Amount);
  if (!(amt > 0) || !dec2_(amt)) throw new Error('مبلغ چک نامعتبر است.');
  var no = tr_(fa2en_(o.No)), sayad = bk_digits_(o.SayadNo);
  if (!no && !sayad) throw new Error('شماره چک یا شماره صیادی را وارد کنید.');
  if (sayad && !/^\d{16}$/.test(sayad)) throw new Error('شماره صیادی باید ۱۶ رقم باشد.');
  var acc = tr_(o.AccountID) ? bk_acct_(co, o.AccountID) : null;
  if (acc && acc.Kind !== 'bank') throw new Error('حساب چک باید یک «بانک» باشد.');
  var party = tr_(o.PartyName), pt = '', pid = '';
  if (tr_(o.PartyID)) {
    if (dir === 'in') { var c1 = pr_find_('Customers', 'CustomerID', o.PartyID, co, 'مشتری'); pt = 'customer'; pid = c1.CustomerID; party = party || c1.Name; }
    else { var s1 = pr_find_('Suppliers', 'SupplierID', o.PartyID, co, 'فروشنده'); pt = 'supplier'; pid = s1.SupplierID; party = party || s1.Name; }
  }
  return locked_(function () {
    var id = o.ChequeID, old = null, now = nowStr_();
    if (id) { old = pr_find_('Cheques', 'ChequeID', id, co, 'چک'); if (old.SrcType !== 'manual') throw new Error('این چک از فاکتور ساخته شده و فقط از خودِ فاکتور اصلاح می‌شود (وضعیت آن را می‌توانید همین‌جا تغییر دهید).'); if (old.Dir !== dir) throw new Error('نوع چک قابل تغییر نیست.'); }
    var dupe = rows_('Cheques').filter(function (c) { return c.CompanyID === co && c.Dir === dir && c.ChequeID !== id && ((sayad && c.SayadNo === sayad) || (!sayad && no && c.No === no && nn_(c.BankName) === nn_(o.BankName))); })[0];
    if (dupe) throw new Error('چک با همین شماره قبلاً ثبت شده است.');
    if (!id) id = nextIds_('CHQ', 1)[0];
    var rec = {ChequeID: id, CompanyID: co, Dir: dir, No: no, SayadNo: sayad, DateJalali: d.j, DateGregorian: d.g, DueJalali: due.j, DueGregorian: due.g, Amount: amt, PartyType: pt, PartyID: pid, PartyName: party, BankName: tr_(o.BankName), Branch: tr_(o.Branch), AccountID: acc ? acc.AccountID : '', Status: old ? old.Status : 'عادی', StatusDate: old ? old.StatusDate : '', Interest: old ? old.Interest : '', Description: tr_(o.Description), SrcType: 'manual', SrcID: '', SrcKey: '', CreatedAt: old ? old.CreatedAt : now, UpdatedAt: now};
    bk_chqPut_(rec); bk_chqTx_(co, rec); bump_();
    return {ChequeID: id};
  });
}
function chequeDelete_(p) {
  var co = bk_co_(p);
  return locked_(function () {
    var c = pr_find_('Cheques', 'ChequeID', p.id, co, 'چک');
    if (c.SrcType !== 'manual') throw new Error('این چک از فاکتور ساخته شده است؛ برای حذف، پرداخت/دریافت مربوط را در فاکتور حذف کنید.');
    bk_delTx_('cheque', c.ChequeID);
    delWhere_('Cheques', 1, function (v) { return v === c.ChequeID; });
    bump_();
    return {deleted: 1};
  });
}
/* تغییر وضعیت چک: p = {company, id, status, date, account, interest} */
function chequeStatus_(p) {
  var co = bk_co_(p);
  return locked_(function () {
    var c = pr_find_('Cheques', 'ChequeID', p.id, co, 'چک'), st = tr_(p.status);
    if (bk_chqStatuses_(c.Dir).indexOf(st) < 0) throw new Error('وضعیت نامعتبر است.');
    var d = tr_(p.date) ? bk_dateReq_(p.date, 'تاریخ') : bk_today_(), acc = tr_(p.account) ? bk_acct_(co, p.account) : null, it = pr_num_(p.interest);
    var rec = Object.assign({}, c);
    rec.Status = st; rec.StatusDate = d.j; rec.UpdatedAt = nowStr_();
    var fin = bk_chqFinal_(rec);
    if (fin) {
      if (!acc) acc = c.AccountID ? bk_acct_(co, c.AccountID) : null;
      if (!acc) throw new Error('برای این وضعیت، حساب بانکی را انتخاب کنید.');
      if (acc.Kind !== 'bank') throw new Error('حساب باید یک «بانک» باشد.');
      rec.AccountID = acc.AccountID;
    } else if (acc) rec.AccountID = acc.AccountID;
    rec.Interest = st === 'تنزیل شده' && it > 0 ? it : '';
    if (st === 'تنزیل شده' && it > (Number(c.Amount) || 0)) throw new Error('بهره از مبلغ چک بیشتر است.');
    bk_chqPut_(rec);
    /* همگام‌سازی با ردیف پرداخت/دریافتِ فاکتور مبدأ */
    if (c.SrcType === 'purchase' || c.SrcType === 'sale' || c.SrcType === 'expense') bk_writeBackChq_(co, rec);
    bk_chqTx_(co, rec);
    bump_();
    return {saved: 1};
  });
}
function bk_writeBackChq_(co, c) {
  var tbl = c.SrcType === 'purchase' ? 'Payments' : 'DocPayments', keyCol = c.SrcType === 'purchase' ? 'InvoiceID' : 'DocID';
  var s = sh_(tbl), H_ = H[tbl], list = rows_(tbl);
  var iSt = H_.indexOf('ChequeStatus') + 1, iAc = H_.indexOf('AccountID') + 1;
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    if (r[keyCol] !== c.SrcID || (c.SrcType !== 'purchase' && r.DocType !== c.SrcType)) continue;
    if (tr_(r.ChequeNo) + '|' + tr_(r.SayadNo) !== c.SrcKey) continue;
    s.getRange(i + 2, iSt).setValue(c.SrcType === 'purchase' ? bk_chqToPurchase_(c.Status) : c.Status);
    if (c.AccountID) s.getRange(i + 2, iAc).setValue(c.AccountID);
    return;
  }
}

/* ---------- اتصال فاکتورها: خرید (Payments)، فروش و هزینه (DocPayments) ---------- */
function bk_docInfo_(co, type, id) {
  var n = function (x) { return Number(x) || 0; };
  if (type === 'purchase') {
    var r = pr_find_('PurchaseInvoices', 'InvoiceID', id, co, 'فاکتور خرید'), s = rows_('Suppliers').filter(function (x) { return x.SupplierID === r.SupplierID; })[0], ret = r.DocType === 'return';
    return {type: type, id: id, no: r.InvoiceNo, label: (ret ? 'برگشت از خرید ' : 'فاکتور خرید ') + r.InvoiceNo, party: s ? s.Name : '', partyType: 'supplier', partyId: r.SupplierID || '', dir: ret ? 'in' : 'out', total: r2_(n(r.GrandTotal) + n(r.TotalCosts)), dateJ: r.DateJalali};
  }
  if (type === 'sale') {
    var h = pr_find_('SalesInvoices', 'SaleID', id, co, 'فاکتور فروش'), c = rows_('Customers').filter(function (x) { return x.CustomerID === h.CustomerID; })[0], rt = Number(h.Ins) === 4;
    if (Number(h.Ins) === 3 || String(h.Superseded) === '1') throw new Error('برای صورتحساب ابطالی یا جایگزین‌شده، دریافت ثبت نمی‌شود.');
    return {type: type, id: id, no: h.SerialNo, label: (rt ? 'برگشت از فروش ' : 'فاکتور فروش ') + h.SerialNo, party: c ? c.Name : 'مشتری خرد', partyType: 'customer', partyId: h.CustomerID || '', dir: rt ? 'out' : 'in', total: r2_(n(h.Tbill)), dateJ: h.DateJalali};
  }
  if (type === 'expense') {
    var e = pr_find_('ExpenseInvoices', 'ExpenseID', id, co, 'فاکتور هزینه'), sp = e.SupplierID ? rows_('Suppliers').filter(function (x) { return x.SupplierID === e.SupplierID; })[0] : null;
    return {type: type, id: id, no: e.DocNo, label: 'فاکتور هزینه ' + e.DocNo, party: sp ? sp.Name : tr_(e.Payee), partyType: sp ? 'supplier' : '', partyId: e.SupplierID || '', dir: 'out', total: r2_(n(e.Amount) + n(e.VAT)), dateJ: e.DateJalali};
  }
  throw new Error('نوع سند نامعتبر است.');
}
function bk_payRows_(type, id) {
  if (type === 'purchase') return rows_('Payments').filter(function (r) { return r.InvoiceID === id; });
  return rows_('DocPayments').filter(function (r) { return r.DocType === type && r.DocID === id; });
}
/* بازسازی گردش و چک‌های یک سند از روی ردیف‌های پرداخت/دریافتش (باید داخل قفل صدا زده شود) */
function bk_resyncDoc_(co, type, id) {
  var info = bk_docInfo_(co, type, id), pays = bk_payRows_(type, id), L = [], now = nowStr_();
  var verb = info.dir === 'in' ? 'دریافت ' : 'پرداخت ';
  pays.forEach(function (y) {
    if (y.Method === 'چک' || !tr_(y.AccountID)) return;
    var a = Number(y.Amount) || 0; if (!(a > 0)) return;
    bk_acct_(co, y.AccountID);
    L.push({AccountID: y.AccountID, DateJalali: y.DateJalali, DateGregorian: y.DateGregorian, DocNo: info.no, Description: verb + info.label + (info.party ? ' - ' + info.party : '') + (tr_(y.Description) ? ' - ' + tr_(y.Description) : ''), Debit: info.dir === 'in' ? a : 0, Credit: info.dir === 'out' ? a : 0, Ref: y.TrackingNo || ''});
  });
  bk_delTx_(type, id);
  bk_putTx_(co, type, id, L);
  var old = rows_('Cheques').filter(function (c) { return c.CompanyID === co && c.SrcType === type && c.SrcID === id; }), used = {};
  pays.forEach(function (y) {
    if (y.Method !== 'چک') return;
    var a = Number(y.Amount) || 0; if (!(a > 0)) return;
    var key = tr_(y.ChequeNo) + '|' + tr_(y.SayadNo), ex = old.filter(function (c) { return c.SrcKey === key && !used[c.ChequeID]; })[0];
    var st = type === 'purchase' ? bk_chqFromPurchase_(info.dir, y.ChequeStatus) : (bk_chqStatuses_(info.dir).indexOf(y.ChequeStatus) >= 0 ? y.ChequeStatus : bk_chqStatuses_(info.dir)[0]);
    var acc = tr_(y.AccountID); if (acc) bk_acct_(co, acc);
    var rec = {ChequeID: ex ? ex.ChequeID : nextIds_('CHQ', 1)[0], CompanyID: co, Dir: info.dir, No: tr_(y.ChequeNo), SayadNo: tr_(y.SayadNo), DateJalali: y.DateJalali, DateGregorian: y.DateGregorian, DueJalali: y.ChequeDueJalali, DueGregorian: y.ChequeDueGregorian, Amount: a, PartyType: info.partyType, PartyID: info.partyId, PartyName: info.party, BankName: tr_(y.ChequeBank), Branch: ex ? ex.Branch : '', AccountID: acc || (ex ? ex.AccountID : ''), Status: st, StatusDate: ex && ex.Status === st ? ex.StatusDate : '', Interest: ex && ex.Status === st ? ex.Interest : '', Description: 'بابت ' + info.label, SrcType: type, SrcID: id, SrcKey: key, CreatedAt: ex ? ex.CreatedAt : now, UpdatedAt: now};
    if (!rec.StatusDate && (st === 'وصول شده' || st === 'تنزیل شده' || st === 'پاس شده')) rec.StatusDate = rec.DueJalali;
    used[rec.ChequeID] = 1;
    bk_chqPut_(rec); bk_chqTx_(co, rec);
  });
  old.forEach(function (c) { if (!used[c.ChequeID]) { bk_delTx_('cheque', c.ChequeID); delWhere_('Cheques', 1, function (v) { return v === c.ChequeID; }); } });
  return info;
}
/* حذف همه‌ی اثرِ بانکیِ یک سند (هنگام حذف فاکتور) */
function bk_dropDoc_(type, id) {
  var cs = rows_('Cheques').filter(function (c) { return c.SrcType === type && c.SrcID === id; });
  cs.forEach(function (c) { bk_delTx_('cheque', c.ChequeID); });
  if (cs.length) { var m = {}; cs.forEach(function (c) { m[c.ChequeID] = 1; }); delWhere_('Cheques', 1, function (v) { return m[v]; }); }
  bk_delTx_(type, id);
  if (type !== 'purchase') delWhere_('DocPayments', 4, function (v) { return v === id; });
}
/* جمع پرداخت/دریافتِ هر سند (چک برگشتی/عودتی حساب نمی‌شود) */
function bk_paidMap_(co, type) {
  var m = {};
  rows_('DocPayments').forEach(function (r) {
    if (r.CompanyID !== co || r.DocType !== type) return;
    if (r.Method === 'چک' && (r.ChequeStatus === 'عودت شده' || r.ChequeStatus === 'برگشتی')) return;
    m[r.DocID] = r2_((m[r.DocID] || 0) + (Number(r.Amount) || 0));
  });
  return m;
}
/* دریافت‌ها/پرداخت‌های یک فاکتور فروش یا هزینه */
function docPayGet_(p) {
  var co = bk_co_(p), info = bk_docInfo_(co, p.type, p.id), pays = bk_payRows_(p.type, p.id), paid = 0;
  pays.forEach(function (r) { if (!(r.Method === 'چک' && (r.ChequeStatus === 'عودت شده' || r.ChequeStatus === 'برگشتی'))) paid += Number(r.Amount) || 0; });
  return {doc: info, payments: pays.map(function (r) { return Object.assign({}, r); }), paid: r2_(paid), remain: r2_(info.total - paid), statuses: bk_chqStatuses_(info.dir)};
}
function docPaySave_(p) {
  var co = bk_co_(p), type = p.type;
  if (type !== 'sale' && type !== 'expense') throw new Error('نوع سند نامعتبر است.');
  var info = bk_docInfo_(co, type, p.id), errs = [], list = [], sum = 0, sts = bk_chqStatuses_(info.dir), CX = null;
  (p.payments || []).forEach(function (y, i) {
    var k = (info.dir === 'in' ? 'دریافت ' : 'پرداخت ') + (i + 1) + ': ', d = parseJ_(y.DateJalali), a = pr_num_(y.Amount), m = tr_(y.Method), due = null, cs = tr_(y.ChequeStatus) || sts[0];
    if (!d) errs.push(k + 'تاریخ نامعتبر است.');
    if (METHODS.indexOf(m) < 0) errs.push(k + 'روش نامعتبر است.');
    if (!(a > 0) || !dec2_(a)) errs.push(k + 'مبلغ نامعتبر است.');
    if (m === 'چک') {
      if (!tr_(y.ChequeNo) && !tr_(y.SayadNo)) errs.push(k + 'شماره چک یا شماره صیادی لازم است.');
      due = parseJ_(y.ChequeDueJalali); if (!due) errs.push(k + 'تاریخ سررسید چک نامعتبر است.');
      if (sts.indexOf(cs) < 0) errs.push(k + 'وضعیت چک نامعتبر است.');
    }
    var acc = tr_(y.AccountID), ca = null;
    if (acc) { try { bk_acct_(co, acc); } catch (e) { errs.push(k + 'حساب انتخاب‌شده پیدا نشد.'); } }
    if (tr_(y.CAcc)) {
      /* دریافت از طریق «حساب دیگر» (تعهد دیگران، سپرده، تسویه با حساب دیگر): بدهکار = این حساب/شخص، بستانکار = طرف فاکتور */
      if (type !== 'sale') errs.push(k + 'انتخاب حساب دیگر فقط برای فاکتور فروش است.');
      else if (m === 'چک') errs.push(k + 'برای چک، حساب دیگر انتخاب نمی‌شود.');
      else {
        CX = CX || ac_ctx_(co);
        var A = CX.accs[tr_(y.CAcc)], dk = '', di = '', pt = '', pi = '';
        if (!A) errs.push(k + 'حساب انتخاب‌شده پیدا نشد.');
        else if (Number(A.Level) !== 3 || !ac_b_(A.Post, false) || !ac_b_(A.IsActive, true)) errs.push(k + 'روی حساب «' + A.Name + '» سند ثبت نمی‌شود.');
        else if (A.Det4 === 'bank' || A.Det4 === 'cash' || A.Det4 === 'imprest') errs.push(k + 'برای بانک، صندوق و تنخواه از فیلد «بانک / صندوق / تنخواه» استفاده کن، نه «حساب دیگر».');
        else {
          if (A.Det4) { di = tr_(y.CDetID); dk = A.Det4; if (!di || !ac_detRec_(CX, dk, di)) errs.push(k + 'برای حساب «' + A.Name + '» انتخاب «' + AC_DET4[A.Det4] + '» (تفصیلی) الزامی است.'); }
          pi = tr_(y.CPartyID); pt = tr_(y.CPartyType);
          if (pi) { if (!AC_PARTY[pt] || !ac_partyRec_(CX, pt, pi)) errs.push(k + 'شخص انتخاب‌شده معتبر نیست.'); if (!A.Det5) { pi = ''; pt = ''; } }
          else { pt = ''; if (A.Det5 === 'req') errs.push(k + 'برای حساب «' + A.Name + '» انتخاب شخص الزامی است.'); }
          ca = {acc: A.AccID, dk: dk, di: di, pt: pt, pi: pi}; acc = '';
        }
      }
    }
    if (m === 'چک' && (cs === 'وصول شده' || cs === 'تنزیل شده' || cs === 'پاس شده') && !acc) errs.push(k + 'برای این وضعیت چک، حساب بانکی را انتخاب کنید.');
    if (!(m === 'چک' && (cs === 'عودت شده' || cs === 'برگشتی'))) sum += a;
    list.push({y: y, d: d, due: due, m: m, a: a, cs: m === 'چک' ? cs : '', acc: acc, ca: ca});
  });
  sum = r2_(sum);
  if (sum > info.total + 0.005) errs.push('جمع ' + (info.dir === 'in' ? 'دریافت‌ها' : 'پرداخت‌ها') + ' (' + sum + ') از مبلغ فاکتور (' + info.total + ') بیشتر است.');
  if (errs.length) throw new Error(errs.join('\n'));
  return locked_(function () {
    delWhere_('DocPayments', 4, function (v) { return v === p.id; });
    var ids = nextIds_('DPY', list.length);
    appendRows_(sh_('DocPayments'), list.map(function (q, i) {
      var y = q.y;
      return pr_arr_('DocPayments', {DPID: ids[i], CompanyID: co, DocType: type, DocID: p.id, LineNo: i + 1, DateJalali: q.d.j, DateGregorian: q.d.g, Method: q.m, Amount: q.a, AccountID: q.acc, TrackingNo: tr_(y.TrackingNo), ChequeNo: tr_(y.ChequeNo), SayadNo: bk_digits_(y.SayadNo), ChequeBank: tr_(y.ChequeBank), ChequeDueJalali: q.due ? q.due.j : '', ChequeDueGregorian: q.due ? q.due.g : '', ChequeStatus: q.cs, Description: tr_(y.Description), CAcc: q.ca ? q.ca.acc : '', CDetKind: q.ca ? q.ca.dk : '', CDetID: q.ca ? q.ca.di : '', CPartyType: q.ca ? q.ca.pt : '', CPartyID: q.ca ? q.ca.pi : ''});
    }));
    bk_resyncDoc_(co, type, p.id);
    bump_();
    return {saved: 1, paid: sum, remain: r2_(info.total - sum)};
  });
}
