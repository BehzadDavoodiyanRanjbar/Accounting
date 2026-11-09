'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');
const { Store, makeGlobals } = require('./shim');

const PORT = Number(process.env.PORT || 3000);
const BK = process.env.BACKUP_DIR || '/backups';
const flag = v => /^(1|true|yes|on)$/i.test(String(v || ''));
const BIND = process.env.BIND || '0.0.0.0';                     // پشت پروکسی: 127.0.0.1
const TRUST_PROXY = flag(process.env.TRUST_PROXY);              // فقط وقتی پشت Caddy/IIS هستید
const HTTPS_ONLY = flag(process.env.HTTPS_ONLY);                // HSTS + هدایت http به https (با TRUST_PROXY)
const ALLOW_REG = flag(process.env.ALLOW_REGISTRATION);         // ثبت‌نام آزاد (با تأیید مدیر)
const MAX_BODY = Math.max(1, Number(process.env.MAX_BODY_MB || 600)) * 1e6;
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdnjs.cloudflare.com blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' data:; worker-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";
const GS = ['Code.gs', 'Sales.gs', 'Prod.gs', 'Bank.gs', 'Acct.gs', 'AutoAcct.gs', 'Fiscal.gs', 'Reports.gs', 'Cost.gs', 'Cost2.gs', 'Cost3.gs', 'Cost4.gs', 'Cost5.gs', 'Cost6.gs', 'Doc.gs'];

const VERIFY_HTML = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تأیید ایمیل</title><style>body{font-family:Tahoma,Arial,sans-serif;background:#f4f6fa;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center}.c{background:#fff;border-radius:14px;box-shadow:0 4px 24px #0002;padding:32px;max-width:440px;width:92%;text-align:center;line-height:1.9}button{background:#1f3a5f;color:#fff;border:0;border-radius:8px;padding:11px 28px;font-size:16px;cursor:pointer}button:disabled{opacity:.6}.e{color:#b00020}.o{color:#1b5e3b}</style></head><body><div class="c"><h2>تأیید ایمیل ثبت‌نام</h2><p id="m">برای تکمیل ثبت‌نام، دکمه‌ی زیر را بزنید.</p><button id="b">تأیید ایمیل</button><p><a href="/" id="h" style="display:none">رفتن به صفحه‌ی ورود</a></p></div><script>
var t=new URLSearchParams(location.search).get('t')||'';var b=document.getElementById('b'),m=document.getElementById('m');
if(!t){m.className='e';m.textContent='پیوند ناقص است.';b.style.display='none'}
b.onclick=function(){b.disabled=true;fetch('/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({a:'verifyEmail',p:{token:t}})}).then(function(r){return r.json()}).then(function(r){b.style.display='none';if(!r.ok){m.className='e';m.textContent=r.error;document.getElementById('h').style.display='inline';return}m.className='o';m.textContent=r.data.approved?'ایمیل شما تأیید شد و ثبت‌نام کامل شد. اکنون می‌توانید وارد شوید.':'ایمیل شما تأیید شد. ثبت‌نام شما پس از بررسی و تأیید مدیر فعال می‌شود؛ بعد از آن می‌توانید با نام کاربری و رمز خود وارد شوید.';document.getElementById('h').style.display='inline'}).catch(function(){b.disabled=false;m.className='e';m.textContent='ارتباط با سرور برقرار نشد؛ دوباره امتحان کنید.'})};
</script></body></html>`;
const INVITE_HTML = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>پذیرش دعوت</title><style>body{font-family:Tahoma,Arial,sans-serif;background:#f4f6fa;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center}.c{background:#fff;border-radius:14px;box-shadow:0 4px 24px #0002;padding:32px;max-width:440px;width:92%;line-height:1.9}label{display:block;margin-top:12px;font-size:14px}input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #c8d0dc;border-radius:8px;font-size:15px;direction:ltr;text-align:left}button{background:#1f3a5f;color:#fff;border:0;border-radius:8px;padding:11px 28px;font-size:16px;cursor:pointer;margin-top:18px;width:100%}button:disabled{opacity:.6}.e{color:#b00020}.o{color:#1b5e3b}small{color:#666}</style></head><body><div class="c"><h2 style="text-align:center">دعوت به نرم‌افزار حسابداری</h2><p id="m">در حال بررسی دعوت…</p><form id="f" style="display:none"><label>نام کاربری (انگلیسی، ۳ تا ۳۲ کاراکتر)<input id="u" autocomplete="username" required></label><label>رمز عبور<input id="p" type="password" autocomplete="new-password" required></label><label>تکرار رمز عبور<input id="q" type="password" autocomplete="new-password" required></label><small>رمز باید قوی باشد (حداقل ۸ کاراکتر شامل حرف و عدد).</small><button id="b">ساخت حساب</button></form><p><a href="/" id="h" style="display:none">رفتن به صفحهٔ ورود</a></p></div><script>
var t=new URLSearchParams(location.search).get('t')||'';var m=document.getElementById('m'),f=document.getElementById('f'),b=document.getElementById('b');
function call(a,p){return fetch('/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({a:a,p:p})}).then(function(r){return r.json()})}
if(!t){m.className='e';m.textContent='پیوند ناقص است.'}else call('inviteInfo',{t:t}).then(function(r){if(!r.ok){m.className='e';m.textContent=r.error;return}m.textContent=r.data.fullName+' عزیز، شما به «'+r.data.company+'» با نقش «'+r.data.role+'» دعوت شده‌اید. نام کاربری و رمز عبور خود را انتخاب کنید.';f.style.display='block'}).catch(function(){m.className='e';m.textContent='ارتباط با سرور برقرار نشد.'});
f.onsubmit=function(e){e.preventDefault();var p=document.getElementById('p').value;if(p!==document.getElementById('q').value){m.className='e';m.textContent='تکرار رمز با رمز یکسان نیست.';return}b.disabled=true;call('inviteAccept',{t:t,username:document.getElementById('u').value,password:p}).then(function(r){if(!r.ok){b.disabled=false;m.className='e';m.textContent=r.error;return}f.style.display='none';m.className='o';m.textContent='حساب شما ساخته شد. اکنون می‌توانید وارد شوید.';document.getElementById('h').style.display='inline'}).catch(function(){b.disabled=false;m.className='e';m.textContent='ارتباط با سرور برقرار نشد.'})};
</script></body></html>`;
async function start(db, opts) {
  opts = opts || {};
  const store = new Store(db);
  await store.load();
  const ctx = vm.createContext(makeGlobals(store));
  GS.forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, 'gs', f), 'utf8'), ctx, { filename: f }));
  const run = c => vm.runInContext(c, ctx);
  const fix = () => { // ستون‌های متنی و نصب اولیه
    const H = run('H'), TEXT = run('TEXT');
    Object.keys(H).forEach(n => { const s = store.sheets[n]; if (s) H[n].forEach((h, i) => { if (TEXT.indexOf(h) >= 0) s.textCols[i + 1] = true; }); });
  };
  if (!store.sheets.Settings) { run('setupSystem()'); await store.flush(); }
  else { run('ensureSheets_()'); }
  fix(); await store.flush();
  /* یک‌بار: جداکردن گروه‌ها/واحدهای مشترک برای هر شرکت (پیش از آن پشتیبان گرفته می‌شود) */
  if (run("getSet_('CompanyScopeV1')") !== '1' && run("rows_('Companies').length") > 0) {
    try { fs.mkdirSync(BK, { recursive: true }); fs.writeFileSync(path.join(BK, 'backup-premigrate-' + new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16) + '.json.gz'), dump()); } catch (e) { console.error('premigrate backup', e.message); }
    const r = run('scopeMigrate_()'); fix(); await store.flush(); console.log('scope migration', JSON.stringify(r));
  }

  let chain = Promise.resolve();
  const serial = fn => { const p = chain.then(fn); chain = p.catch(() => {}); return p; };
  const tx = fn => serial(async () => { try { return await fn(); } finally { await store.flush(); } });
  const gs = (name, arg) => { ctx.__a = arg; return vm.runInContext(name + '(__a)', ctx); };
  /* ===== احراز هویت و کاربران =====
     نقش‌ها: admin = مدیر سیستم (همه‌ی شرکت‌ها و تنظیمات) ؛ company = کاربرِ یک شرکت/مشتری (فقط همان شرکت) */
  const au = require('./auth');
  const props = () => run("PropertiesService.getScriptProperties()");
  let SECRET = props().getProperty('AuthSecret');
  if (!SECRET) { SECRET = require('crypto').randomBytes(32).toString('hex'); props().setProperty('AuthSecret', SECRET); await store.flush(); }
  const users = () => gs('rows_', 'Users');
  const yes = x => x === true || x === 'TRUE' || x === 'true' || x === 1 || x === '1';
  const CAP_ON = !/^(0|false|off|no)$/i.test(String(process.env.CAPTCHA == null || process.env.CAPTCHA === '' ? '1' : process.env.CAPTCHA));
  const cap = require('./captcha').make(SECRET);
  const mailer = require('./mailer'), mailCfg = mailer.config(process.env);
  const sendMail = opts.sendMail || (o => mailer.send(mailCfg, o));
  const MAIL_OK = !!opts.sendMail || mailCfg.enabled;
  const AUTO_APPROVE = flag(process.env.REG_AUTO_APPROVE);        // پس از تأیید ایمیل بدون تأیید مدیر فعال شود (پیش‌فرض: خاموش)
  const PUBLIC_URL = String(process.env.PUBLIC_URL || '').replace(/\/+$/, '');
  const isOn = u => yes(u.IsActive);
  const coName = id => { const c = gs('rows_', 'Companies').find(x => x.CompanyID === id); return c ? c.Name : ''; };
  const roleOf = u => u.Role === 'admin' ? 'admin' : (u.Role === 'customer' ? 'customer' : (u.CompanyID ? 'company' : 'none'));
  const pub = u => { const st = staffOf(u); return { id: u.UserID, username: u.Username, fullName: u.FullName || '', role: roleOf(u), companyId: u.CompanyID || '', companyName: u.CompanyID ? coName(u.CompanyID) : '', mustChange: yes(u.MustChange), active: isOn(u), lastLogin: u.LastLogin || '', owner: roleOf(u) === 'company' && !st, staff: !!st, staffRole: st ? st.r : '', perms: effPerms(u) }; };
  const authUser = t => {
    const r = au.readToken(SECRET, t); if (!r) return null;
    const u = users().find(x => x.UserID === r.userId);
    if (!u || !isOn(u) || au.pwTag(u.PasswordHash) !== r.pwTag) return null;
    return u;
  };
  const deny = () => { throw new Error('دسترسی شما برای این عملیات کافی نیست.'); };
  const normUser = x => String(x || '').trim().toLowerCase();
  const userRule = x => (/^[\p{L}\p{N}._-]{3,32}$/u.test(x) ? '' : 'نام کاربری باید ۳ تا ۳۲ کاراکتر (حرف، عدد، نقطه، خط تیره یا زیرخط) و بدون فاصله باشد.');
  const nowStr = () => new Date().toISOString();
  const session = (u, remember) => ({ token: au.signToken(SECRET, u, remember ? 30 * 864e5 : 14 * 36e5), remember: !!remember, me: pub(u) });
  const adminsLeft = (list, exceptId) => list.filter(x => isOn(x) && x.Role === 'admin' && x.UserID !== exceptId).length;
  const companyTaken = (list, co, exceptId) => list.some(x => x.CompanyID === co && x.UserID !== exceptId && !staffOf(x)); // سقف «یک مدیر» برای هر شرکت؛ کارکنان محدود نیستند


  /* ----- کارکنان شرکت: مدیر شرکت (کاربر اصلی، Permissions=own-company) کارکنان را دعوت و حدود دسترسی‌شان را تعیین می‌کند.
     دسترسی کارمند: Permissions = 'staff:{"r":نقش,"s":{بخش:"r"|"w"}}' ؛ r = فقط مشاهده، w = مشاهده و ثبت/ویرایش/حذف. هر عملیات ناشناخته برای کارمند ممنوع است. ----- */
  const SECS = { dash: 'داشبورد', base: 'اطلاعات پایه (مشتریان، فروشندگان، کالاها، گروه‌ها)', buy: 'خرید و اسکن فاکتور خرید', sale: 'فروش و مؤدیان', stock: 'انبار و گزارش حساب خریداران/فروشندگان', prod: 'تولید', bank: 'بانکداری', acc: 'حسابداری و گزارش‌ها', cs: 'بهای تمام‌شده خدمات', scan: 'ثبت از روی اسکن (حقوق، پرداخت، بیمه)' };
  const ROLE_PRESETS = {
    accountant: { name: 'حسابدار', s: { dash: 'r', base: 'w', buy: 'w', sale: 'w', stock: 'r', bank: 'w', acc: 'w', scan: 'w', prod: 'r', cs: 'r' } },
    sales: { name: 'کارشناس فروش', s: { dash: 'r', base: 'w', sale: 'w', stock: 'r' } },
    purchaser: { name: 'کارشناس خرید', s: { base: 'w', buy: 'w', stock: 'r' } },
    storekeeper: { name: 'انباردار', s: { base: 'r', stock: 'w' } },
    production: { name: 'مسئول تولید', s: { base: 'r', buy: 'r', stock: 'w', prod: 'w' } },
    costing: { name: 'مسئول بهای تمام‌شده خدمات', s: { base: 'r', acc: 'r', cs: 'w' } },
    cashier: { name: 'مسئول بانک و صندوق', s: { base: 'r', bank: 'w' } },
    viewer: { name: 'فقط مشاهده (همهٔ بخش‌ها)', s: { dash: 'r', base: 'r', buy: 'r', sale: 'r', stock: 'r', prod: 'r', bank: 'r', acc: 'r', cs: 'r', scan: 'r' } },
    custom: { name: 'سفارشی', s: {} },
  };
  const SEC_ACTS = {
    dash: 'dashboard', base: 'save deleteEntity autoCodes',
    buy: 'listInvoices saveInvoice getInvoice deleteInvoice salesToPurchase scanExtract scanFromJson scanPreview scanCommit',
    sale: 'listSales saleDefaults saveSale getSale deleteSale saleStatus saleJson moSend moInquire',
    stock: 'stock stockDetail partyReport partyStatement madeGoods madeDetail',
    prod: 'prodCfgGet prodCfgSave recipeList recipeGet recipeSave recipeDelete recipePreview prodList prodGet prodCreate prodSave prodStatus prodDelete prodFromSale expenseList expenseSave expenseDelete',
    bank: 'bankAccList bankAccSave bankAccDelete bankLedger bankTxSave bankTxDelete transferList transferSave transferDelete chequeList chequeSave chequeDelete chequeStatus',
    acc: 'accTree accSave accDelete accReseed accDimList accDimSave accDimDelete accOptions voucherList voucherGet voucherSave voucherDelete voucherStatus voucherRenumber report yearList yearCheck yearClose yearSave accTrial accLedger autoRebuild',
    scan: 'docInit docSettingsSave docCheck docCommit docParseXlsx',
  };
  const ACT_SEC = {}; Object.keys(SEC_ACTS).forEach(k => SEC_ACTS[k].split(' ').forEach(a => { ACT_SEC[a] = k; }));
  const OWNER_ONLY = new Set('import setCompanyKey setCompanyCert moProbe moPub moGen moInfo moSetEnv backupCompany setSettings setApiKey portalAccList portalAccSave'.split(' '));
  /* فقط عملیات «خواندنی» که بررسی شده و هیچ‌چیز را نمی‌نویسند؛ هرچه اینجا نیست برای دسترسی «مشاهده» ممنوع است */
  const READ_ACTS = new Set('dashboard listInvoices partyReport partyStatement listSales saleDefaults stock stockDetail getInvoice getSale saleJson prodCfgGet recipeList recipeGet recipePreview prodList prodGet madeGoods madeDetail expenseList bankAccList bankLedger transferList chequeList docInit docCheck accTree accDimList accOptions voucherList voucherGet report yearList yearCheck accTrial accLedger docPayGet csCfgGet csList csCard csIssuePreview csLots csProg csPostPreview csPostList csRep6 csVerify6 csDeprSched scanPreview'.split(' '));
  const cleanPerms = x => { const o = {}; Object.keys(SECS).forEach(k => { if (x && (x[k] === 'r' || x[k] === 'w')) o[k] = x[k]; }); return o; };
  const staffOf = u => {
    const t = String(u.Permissions || '');
    if (u.Role === 'admin' || u.Role === 'customer' || t.indexOf('staff:') !== 0) return null;
    try { const o = JSON.parse(t.slice(6)); return { r: ROLE_PRESETS[o.r] ? o.r : 'custom', s: cleanPerms(o.s) }; } catch (e) { return { r: 'custom', s: {} }; }
  };
  const effPerms = u => { if (u.Role === 'admin' || (u.Role === 'company' && !staffOf(u))) { const o = {}; Object.keys(SECS).forEach(k => { o[k] = 'w'; }); return o; } const st = staffOf(u); return st ? st.s : {}; };
  const staffStr = (r, x) => 'staff:' + JSON.stringify({ r: ROLE_PRESETS[r] ? r : 'custom', s: cleanPerms(x) });
  const staffCheck = (st, a, p) => {
    if (a === 'bootstrap' || a === 'changeMyPassword' || a === 'moTest' || a === 'ocrStatus') return;
    if (a === 'ocrImage') { if (!st.s.buy && !st.s.scan && !st.s.bank && !st.s.acc) throw new Error('به بخش اسناد دسترسی ندارید.'); return; }
    if (OWNER_ONLY.has(a) || /^co(User|Invite)/.test(a)) throw new Error('این بخش فقط برای مدیر شرکت است.');
    let sec = /^cs[A-Z]/.test(a) ? 'cs' : ACT_SEC[a];
    if (a === 'docPaySave' || a === 'docPayGet') sec = { sale: 'sale', purchase: 'buy', expense: 'prod' }[p.type];
    if (a === 'save' && p.sheet === 'Companies') throw new Error('ویرایش پروفایل شرکت فقط برای مدیر شرکت است.');
    if (!sec) deny();
    const lvl = st.s[sec]; if (!lvl) throw new Error('به بخش «' + SECS[sec] + '» دسترسی ندارید.');
    if (lvl === 'r' && !READ_ACTS.has(a)) throw new Error('در بخش «' + SECS[sec] + '» فقط دسترسی «مشاهده» دارید.');
  };
  /* ----- سطح دسترسی: کاربر شرکت فقط به داده‌ی شرکت خودش (اعمال سمت سرور) ----- */
  const CO_ACT = { // نوع بررسی هر عملیات برای کاربر شرکت؛ هرچه اینجا نیست = فقط مدیر
    bootstrap: 'boot', dashboard: 'co', listInvoices: 'co', partyReport: 'co', partyStatement: 'co', listSales: 'co', saleDefaults: 'co', stock: 'co', stockDetail: 'co', autoCodes: 'co',
    import: 'co', scanExtract: 'co', scanFromJson: 'co', scanPreview: 'co', scanCommit: 'co', setCompanyKey: 'co', setCompanyCert: 'co',
    moProbe: 'co', moPub: 'co', moGen: 'co', moInfo: 'co', moSetEnv: 'co', backupCompany: 'co', setSettings: 'co', setApiKey: 'co', moTest: 'any', changeMyPassword: 'any',
    prodCfgGet: 'pm', prodCfgSave: 'pm', recipeList: 'pm', recipeGet: 'pm', recipeSave: 'pm', recipeDelete: 'pm', recipePreview: 'pm', prodList: 'pm', prodGet: 'pm', prodCreate: 'pm', prodSave: 'pm', prodStatus: 'pm', prodDelete: 'pm', prodFromSale: 'pm', madeGoods: 'pm', madeDetail: 'pm', deleteEntity: 'del', expenseList: 'pm', expenseSave: 'pm', expenseDelete: 'pm',
    salesToPurchase: 'co+sales', moSend: 'sales', moInquire: 'sales',
    saveInvoice: 'inv', getInvoice: 'invid', deleteInvoice: 'invid', saveSale: 'sale', getSale: 'saleid', deleteSale: 'saleid', saleStatus: 'saleid', saleJson: 'saleid',
    bankAccList: 'bank', bankAccSave: 'bank', bankAccDelete: 'bank', bankLedger: 'bank', bankTxSave: 'bank', bankTxDelete: 'bank', transferList: 'bank', transferSave: 'bank', transferDelete: 'bank', chequeList: 'bank', chequeSave: 'bank', chequeDelete: 'bank', chequeStatus: 'bank',
    docInit: 'bank', docSettingsSave: 'bank', docCheck: 'bank', docCommit: 'bank', docParseXlsx: 'co',
    docPayGet: 'doc', docPaySave: 'doc', portalAccList: 'co', portalAccSave: 'co',
    accTree: 'bank', accSave: 'bank', accDelete: 'bank', accReseed: 'bank', accDimList: 'bank', accDimSave: 'bank', accDimDelete: 'bank', accOptions: 'bank', voucherList: 'bank', voucherGet: 'bank', voucherSave: 'bank', voucherDelete: 'bank', voucherStatus: 'bank', voucherRenumber: 'bank', report: 'bank', yearList: 'bank', yearCheck: 'bank', yearClose: 'bank', yearSave: 'bank', accTrial: 'bank', accLedger: 'bank', autoRebuild: 'bank',
    csCfgGet: 'cs', csRuleSave: 'cs', csList: 'cs', csSave: 'cs', csDelete: 'cs', csCard: 'cs', csIssuePreview: 'cs', csLots: 'cs', csLaborRates: 'cs', csLaborRun: 'cs', csLaborUndo: 'cs', csStmtCalc: 'cs', csStmtStatus: 'cs', csMachRates: 'cs', csMachRun: 'cs', csMachUndo: 'cs', csDeprSched: 'cs', csMobRates: 'cs', csMobRun: 'cs', csMobUndo: 'cs', csOhRates: 'cs', csOhRun: 'cs', csOhUndo: 'cs', csOhYear: 'cs', csOhYearPost: 'cs', csOhYearUndo: 'cs', csProg: 'cs', csPostPreview: 'cs', csPostRun: 'cs', csPostUndo: 'cs', csPostList: 'cs', csRep6: 'cs', csVerify6: 'cs',
    save: 'save',
    ocrStatus: 'any', ocrImage: 'any', coUsers: 'any', coInvite: 'any', coInviteCancel: 'any', coInviteResend: 'any', coUserSave: 'any', coUserPassword: 'any'
  };
  const SAVE_OK = ['Customers', 'Suppliers', 'Products', 'Services', 'ProductGroups', 'ProductSubGroups', 'Units', 'Companies'];
  const guard = (me, b) => {
    const p = b.p || {}; delete p._adm; p._who = String(me.FullName || me.Username || '');
    if (me.Role === 'admin') { p._adm = true; return p; }
    const my = me.CompanyID; if (!my) deny();
    const kind = CO_ACT[b.a]; if (!kind) deny();
    const st0 = staffOf(me); if (st0) staffCheck(st0, b.a, p);
    const own = (sheet, key, id) => { const r = gs('rows_', sheet).find(x => x[key] === id); return !r || r.CompanyID === my; }; // رکورد ناموجود: خود تابع خطا می‌دهد
    const ownSet = (sheet, key) => { const m = {}; gs('rows_', sheet).forEach(x => { m[x[key]] = x.CompanyID; }); return m; };
    if (kind === 'any' || kind === 'boot') return p;
    if (kind === 'co' || kind === 'co+sales') { p.company = my; delete p.global; }
    if (kind === 'sales' || kind === 'co+sales') { const m = ownSet('SalesInvoices', 'SaleID'); (p.ids || []).forEach(id => { if (m[id] !== undefined && m[id] !== my) deny(); }); }
    if (kind === 'bank') { p.company = my; delete p.global; if (p.obj) { p.obj.CompanyID = my; } }
    if (kind === 'cs') { // بهای تمام‌شده خدمات: شرکت از نشست؛ هر شناسه‌ی ارجاعی باید متعلق به همین شرکت باشد
      p.company = my; delete p.global; if (p.obj) p.obj.CompanyID = my;
      const CK = { ContractID: ['Contracts', 'ContractID'], CCID: ['CostContracts', 'CCID'], MachID: ['Machines', 'MachID'], ElemID: ['CostElements', 'ElemID'], CLID: ['CostLedger', 'CLID'], RuleID: ['CostRules', 'RuleID'], BaseID: ['AllocBases', 'BaseID'], ProjID: ['Projects', 'ProjID'], CustomerID: ['Customers', 'CustomerID'], SupplierID: ['Suppliers', 'SupplierID'], AssetAccID: ['Accounts', 'AccID'], AccumAccID: ['Accounts', 'AccID'], IssueID: ['StockIssues', 'IssueID'], RefIssueID: ['StockIssues', 'IssueID'], ToContractID: ['Contracts', 'ContractID'], PayID: ['PayRows', 'PayID'], TSID: ['Timesheets', 'TSID'], STID: ['Statements', 'STID'], LogID: ['MachLogs', 'LogID'], MCID: ['MachCosts', 'MCID'], MobID: ['Mobs', 'MobID'], PoolID: ['OhPools', 'PoolID'], OAID: ['OhActual', 'OAID'], BQID: ['BaseQty', 'BQID'], EmpID: ['Employees', 'EmpID'], ProductID: ['Products', 'ProductID'] };
      [p, p.obj || {}].forEach(src => Object.keys(CK).forEach(k => { if (src[k] && !own(CK[k][0], CK[k][1], src[k])) deny(); }));
      const KM = { contract: ['Contracts', 'ContractID'], cc: ['CostContracts', 'CCID'], machine: ['Machines', 'MachID'], elem: ['CostElements', 'ElemID'], base: ['AllocBases', 'BaseID'], ledger: ['CostLedger', 'CLID'], issue: ['StockIssues', 'IssueID'], pay: ['PayRows', 'PayID'], ts: ['Timesheets', 'TSID'], stmt: ['Statements', 'STID'], mlog: ['MachLogs', 'LogID'], mcost: ['MachCosts', 'MCID'], mob: ['Mobs', 'MobID'], pool: ['OhPools', 'PoolID'], oact: ['OhActual', 'OAID'], bqty: ['BaseQty', 'BQID'] };
      if (p.kind !== undefined && !KM[p.kind]) deny();
      if (p.id && p.kind && !own(KM[p.kind][0], KM[p.kind][1], p.id)) deny();
      if (p.contract && !own('Contracts', 'ContractID', p.contract)) deny();
      if (p.elem && !own('CostElements', 'ElemID', p.elem)) deny();
      if (p.cc && !own('CostContracts', 'CCID', p.cc)) deny();
      if (p.emp && !own('Employees', 'EmpID', p.emp)) deny();
      if (p.mach && (!own('Machines', 'MachID', p.mach) || !own('CostContracts', 'CCID', p.mach))) deny();
      if (p.product && !own('Products', 'ProductID', p.product)) deny();
      [p, p.obj || {}].forEach(src => { if (src.ItemID) { const it = gs('rows_', 'PurchaseItems').find(x => x.ItemID === src.ItemID); if (it && !own('PurchaseInvoices', 'InvoiceID', it.InvoiceID)) deny(); } });
      if (p.id && p.kind === 'ledger') { /* ok */ }
    }
    if (kind === 'doc') {
      p.company = my; delete p.global;
      const DT = { sale: ['SalesInvoices', 'SaleID'], expense: ['ExpenseInvoices', 'ExpenseID'], purchase: ['PurchaseInvoices', 'InvoiceID'] }[p.type]; if (!DT) deny();
      if (!own(DT[0], DT[1], p.id)) deny();
    }
    if (kind === 'pm') {
      p.company = my; delete p.global;
      const PM = { prodGet: ['ProdOrders', 'OrderID', 'id'], prodStatus: ['ProdOrders', 'OrderID', 'id'], prodDelete: ['ProdOrders', 'OrderID', 'id'], prodSave: ['ProdOrders', 'OrderID', 'OrderID'], recipeGet: ['Recipes', 'RecipeID', 'id'], recipeDelete: ['Recipes', 'RecipeID', 'id'], recipeSave: ['Recipes', 'RecipeID', 'RecipeID'], expenseDelete: ['ExpenseInvoices', 'ExpenseID', 'id'], expenseSave: ['ExpenseInvoices', 'ExpenseID', 'ExpenseID'], prodFromSale: ['SalesInvoices', 'SaleID', 'saleId'], prodCreate: ['Recipes', 'RecipeID', 'recipeId'], madeDetail: ['Products', 'ProductID', 'product'] }[b.a];
      if (PM && p[PM[2]] && !own(PM[0], PM[1], p[PM[2]])) deny();
    }
    if (kind === 'del') {
      const DK = { Customers: 'CustomerID', Suppliers: 'SupplierID', Products: 'ProductID', Services: 'ServiceID', ProductGroups: 'GroupID', ProductSubGroups: 'SubGroupID', Units: 'UnitID' };
      if (!DK[p.sheet] || !p.id) deny();
      const r = gs('rows_', p.sheet).find(x => x[DK[p.sheet]] === p.id);
      if (r && r.CompanyID !== my) deny();
    }
    if (kind === 'invid') { if (!own('PurchaseInvoices', 'InvoiceID', p.id)) deny(); }
    if (kind === 'saleid') { if (!own('SalesInvoices', 'SaleID', p.id)) deny(); }
    if (kind === 'inv' || kind === 'sale') {
      p.CompanyID = my;
      const sup = ownSet('Suppliers', 'SupplierID'), cus = ownSet('Customers', 'CustomerID'), prd = ownSet('Products', 'ProductID'), svc = ownSet('Services', 'ServiceID');
      const okP = id => !id || id === 'NEW' || prd[id] === my || svc[id] === my;
      if (kind === 'inv') { if (p.InvoiceID && !own('PurchaseInvoices', 'InvoiceID', p.InvoiceID)) deny(); if (p.RefInvoiceID && !own('PurchaseInvoices', 'InvoiceID', p.RefInvoiceID)) deny(); if (p.SupplierID && sup[p.SupplierID] !== my) deny(); }
      else { if (p.SaleID && !own('SalesInvoices', 'SaleID', p.SaleID)) deny(); if (p.RefSaleID && !own('SalesInvoices', 'SaleID', p.RefSaleID)) deny(); if (p.CustomerID && cus[p.CustomerID] !== my) deny(); }
      (p.items || []).forEach(l => { if (!okP(l.ProductID)) deny(); });
    }
    if (kind === 'save') {
      if (SAVE_OK.indexOf(p.sheet) < 0 || !p.obj) deny();
      if (p.sheet === 'Companies') { if (p.obj.CompanyID !== my) deny(); }
      else p.obj.CompanyID = my;
    }
    return p;
  };
  /* ----- لاگ کاربران: فقط عملیات ثبت/ویرایش/حذف ----- */
  const LOGGED = new Set(Object.keys(run('LOG_LABEL')).filter(k => k !== 'login'));
  const logDetail = (a, p, out) => {
    const d = (out && out.data) || {}, o = p.obj || {};
    switch (a) {
      case 'saveInvoice': return 'فاکتور خرید شماره ' + (p.InvoiceNo || '') + (p.DocType === 'return' ? ' (برگشت از خرید)' : '') + (p.InvoiceID ? ' — ویرایش' : '');
      case 'saveSale': return 'سریال ' + (p.SerialNo || '') + (p.SaleID ? ' — ویرایش' : '');
      case 'voucherSave': return 'تاریخ ' + (o.DateJalali || '') + (d.RefNo ? ' — ارجاع ' + d.RefNo : '') + (o.VID ? ' — ویرایش' : '');
      case 'save': return (p.sheet || '') + ': ' + (o.Name || o.GroupName || o.UnitName || '');
      case 'deleteEntity': return (p.sheet || '') + ' ' + (p.id || '');
      case 'csSave': return (p.kind || '') + ': ' + (o.No || o.Code || o.Name || o.Title || o.Period || o.DateJalali || '') + (((o.ContractID && p.kind === 'contract') || (o.CCID && p.kind === 'cc') || o.MachID || o.ElemID || o.BaseID || o.CLID || o.IssueID || o.PayID || o.TSID || o.STID || o.LogID || o.MCID || o.MobID || o.PoolID || o.OAID || o.BQID) ? ' — ویرایش' : '');
      case 'csDelete': return (p.kind || '') + ' ' + (p.id || '');
      case 'csRuleSave': return 'قاعده ' + (o.RuleID || '') + ' ← ' + String(o.Value);
      case 'coInvite': return 'دعوت کارمند ' + (p.email || '');
      case 'coUserSave': return 'ویرایش دسترسی کارمند ' + (p.id || '');
      case 'coUserPassword': return 'تعیین رمز موقت برای ' + (p.id || '');
      case 'coInviteCancel': case 'coInviteResend': return 'دعوت ' + (p.id || '');
      case 'saveUser': return p.id ? 'ویرایش ' + p.id : 'کاربر جدید ' + (p.username || '');
      default: return [p.id, p.type, p.sheet, p.status].filter(x => x && typeof x === 'string').join(' ');
    }
  };
  const writeLog = async (me, b, p, out) => {
    if (!LOGGED.has(b.a) || !me) return;
    try {
      const ok = out && out.ok !== false;
      await tx(() => { gs('log_', { Username: me.Username, FullName: me.FullName || '', Role: roleOf(me), CompanyID: (p && (p.company || p.CompanyID || (p.obj && p.obj.CompanyID))) || me.CompanyID || '', Action: b.a, Detail: String(logDetail(b.a, p || {}, out)).slice(0, 300), Result: ok ? 'موفق' : ('ناموفق: ' + String((out && out.error) || '').slice(0, 150)) }); });
    } catch (e) { console.error('log', e.message); }
  };
  const filterBoot = (me, d) => {
    if (me.Role === 'admin') return d; const my = me.CompanyID;
    ['vats', 'envs', 'keys'].forEach(k => { const o = {}; if (d[k] && d[k][my] !== undefined) o[my] = d[k][my]; d[k] = o; }); d.sharedKey = !!(d.aiShared && d.hasKey); delete d.hasKey; delete d.aiShared; delete d.globalEnv;
    ['companies', 'customers', 'suppliers', 'products', 'services', 'groups', 'subs', 'units'].forEach(k => { d[k] = (d[k] || []).filter(r => r.CompanyID === my); });
    return d;
  };

  /* ----- ثبت‌نام آزاد با تأیید مدیر: درخواست‌ها در تنظیم RegReqs نگه‌داری می‌شود؛ کاربر تا تأیید مدیر «غیرفعال و بدون شرکت» است ----- */
  const regReqs = () => { try { const a = JSON.parse(props().getProperty('RegReqs') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  const setRegReqs = a => props().setProperty('RegReqs', JSON.stringify(a));
  const en = x => String(x == null ? '' : x).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632));
  const faNum = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  /* ----- تأیید ایمیل: ثبت‌نام‌های تأییدنشده در تنظیم RegPend (۲۴ ساعت اعتبار) نگه‌داری می‌شود و تا تأیید ایمیل کاربری ساخته نمی‌شود؛
     ایمیل‌های استفاده‌شده در RegEmails می‌ماند تا هر ایمیل فقط یک‌بار ثبت‌نام کند ----- */
  const jarr = k => { try { const a = JSON.parse(props().getProperty(k) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  const livePend = () => jarr('RegPend').filter(x => x && Date.now() - x.at < 24 * 36e5);
  const setPend = a => props().setProperty('RegPend', JSON.stringify(a));
  const usedEmails = () => jarr('RegEmails'), setUsedEmails = a => props().setProperty('RegEmails', JSON.stringify(a));
  const tokHash = t => require('crypto').createHash('sha256').update(String(t)).digest('hex');
  const emailKey = e => { let [l, d] = String(e).toLowerCase().trim().split('@'); l = String(l || '').split('+')[0]; d = d || ''; if (d === 'gmail.com' || d === 'googlemail.com') { l = l.replace(/\./g, ''); d = 'gmail.com'; } return l + '@' + d; };
  const baseUrl = req => {
    if (PUBLIC_URL) return PUBLIC_URL;
    const h = String((req && req.headers && req.headers.host) || ''); if (!/^[A-Za-z0-9.\-]+(:\d{1,5})?$/.test(h)) throw new Error('نشانی سرور برای ساخت پیوند تأیید مشخص نیست (PUBLIC_URL را تنظیم کنید).');
    const sec = TRUST_PROXY && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
    return (sec ? 'https://' : 'http://') + h;
  };
  const verifyMail = (to, name, link) => ({ to, subject: 'تأیید ایمیل ثبت‌نام — حسابداری ۶ سطحی معین تراز',
    text: (name || '') + ' عزیز،\n\nبرای تکمیل ثبت‌نام در «حسابداری ۶ سطحی معین تراز»، پیوند زیر را باز کنید و دکمه‌ی «تأیید ایمیل» را بزنید (۲۴ ساعت اعتبار دارد):\n' + link + '\n\nاگر شما ثبت‌نام نکرده‌اید، این ایمیل را نادیده بگیرید.',
    html: '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9"><p>' + esc(name || '') + ' عزیز،</p><p>برای تکمیل ثبت‌نام در «حسابداری ۶ سطحی معین تراز»، روی دکمه‌ی زیر بزنید و در صفحه‌ی باز‌شده «تأیید ایمیل» را انتخاب کنید (۲۴ ساعت اعتبار دارد):</p><p><a href="' + esc(link) + '" style="background:#1f3a5f;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;display:inline-block">تأیید ایمیل</a></p><p style="color:#666;font-size:13px">اگر دکمه کار نکرد، این نشانی را در مرورگر باز کنید:<br><span dir="ltr">' + esc(link) + '</span></p><p style="color:#666;font-size:13px">اگر شما ثبت‌نام نکرده‌اید، این ایمیل را نادیده بگیرید.</p></div>' });
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /* فعال‌کردن درخواست تأییدشده: ساخت شرکت با نام اعلام‌شده، اتصال کاربر و فعال‌کردن حساب (باید داخل tx صدا شود) */
  const doApprove = id => {
    const rq = regReqs(), r = rq.find(x => x.id === id), t = r && users().find(x => x.UserID === r.id);
    if (!r || !t) throw new Error('این درخواست پیدا نشد (شاید قبلاً رسیدگی شده است).');
    const co = gs('saveEntityX_', { sheet: 'Companies', obj: { Name: r.company, Phone: r.phone, Notes: 'ثبت‌نام آزاد' + (r.email ? ' — ' + r.email : '') } });
    gs('saveUser_', { UserID: t.UserID, CompanyID: co.CompanyID, Role: 'company', Permissions: 'own-company', IsActive: true });
    setRegReqs(rq.filter(x => x.id !== r.id));
    return { ok: true, companyId: co.CompanyID };
  };

  const pubApi = {
    async authStatus(p, b) { const u = authUser(b.t); return { hasUsers: users().length > 0, me: u ? pub(u) : null, canRegister: ALLOW_REG && MAIL_OK, regMailOff: ALLOW_REG && !MAIL_OK, captcha: CAP_ON }; },
    async login(p, b, ip) {
      if (au.rate('login:' + ip, 40, 10 * 60e3)) throw new Error('تلاش‌های ورود از این آدرس بیش از حد بوده است؛ چند دقیقه بعد دوباره امتحان کنید.');
      if (CAP_ON && !cap.check(p.capTok, p.capAns)) throw new Error('کد امنیتی درست نیست یا منقضی شده است؛ کد تازه را وارد کنید.');
      const name = normUser(p.username), key = 'u:' + name;
      const left = au.lockLeft(key); if (left) throw new Error('به‌دلیل تلاش‌های ناموفق، ورود تا ' + Math.ceil(left / 60000) + ' دقیقهٔ دیگر مسدود است.');
      const u = users().find(x => normUser(x.Username) === name);
      const okPw = au.verifyPassword(p.password, u && u.PasswordHash);
      if (!u || !okPw) { au.noteFail(key); await tx(() => { gs('log_', { Username: name.slice(0, 40), FullName: u ? u.FullName || '' : '', Role: u ? roleOf(u) : '', CompanyID: u ? u.CompanyID || '' : '', Action: 'login', Detail: '', Result: 'ناموفق: رمز یا نام کاربری نادرست' }); }); throw new Error('نام کاربری یا رمز عبور درست نیست.'); }
      if (!isOn(u)) throw new Error(regReqs().some(r => r.id === u.UserID) ? 'درخواست ثبت‌نام شما در انتظار تأیید مدیر است؛ پس از تأیید می‌توانید وارد شوید.' : 'این حساب غیرفعال شده است؛ با مدیر تماس بگیرید.');
      if (roleOf(u) === 'none') throw new Error('این حساب به هیچ شرکتی متصل نیست؛ با مدیر سیستم تماس بگیرید.');
      if (u.Role === 'customer' && !p.portal) throw new Error('این حساب مخصوص «پنل مشتری» است؛ از آدرس /portal وارد شوید.');
      if (p.portal && u.Role !== 'customer') throw new Error('این صفحه فقط برای حساب‌های پنل مشتری است؛ کاربران شرکت از صفحهٔ اصلی وارد شوند.');
      au.clearFails(key);
      await tx(() => { gs('saveUser_', { UserID: u.UserID, LastLogin: nowStr() }); gs('log_', { Username: u.Username, FullName: u.FullName || '', Role: roleOf(u), CompanyID: u.CompanyID || '', Action: 'login', Detail: '', Result: 'موفق' }); });
      return session(u, p.remember);
    },
    async captcha() { return cap.gen(); },
    async register(p, b, ip, req) {
      if (!ALLOW_REG) throw new Error('ثبت‌نام آزاد در این سرور غیرفعال است.');
      if (!MAIL_OK) throw new Error('ارسال ایمیل در این سرور تنظیم نشده است؛ ثبت‌نام موقتاً ممکن نیست. با مدیر سیستم تماس بگیرید.');
      if (au.rate('reg:' + ip, 15, 3600e3)) throw new Error('تعداد درخواست ثبت‌نام از این آدرس زیاد بوده است؛ بعداً دوباره امتحان کنید.');
      if (p.website) throw new Error('درخواست نامعتبر است.');
      if (!cap.check(p.capTok, p.capAns)) throw new Error('کد امنیتی درست نیست یا منقضی شده است؛ کد تازه را وارد کنید.');
      const name = String(p.username || '').trim(), fullName = String(p.fullName || '').trim(), coN = String(p.companyName || '').trim().slice(0, 100),
        phone = en(p.phone).replace(/[\s\-]/g, ''), email = String(p.email || '').trim().toLowerCase().slice(0, 120);
      const e1 = userRule(name) || au.checkPasswordRule(p.password); if (e1) throw new Error(e1);
      if (fullName.length < 3 || fullName.length > 80) throw new Error('نام و نام خانوادگی را کامل وارد کنید.');
      if (coN.length < 3) throw new Error('نام شرکت/کسب‌وکار را وارد کنید.');
      if (!/^0\d{9,10}$/.test(phone)) throw new Error('شماره تلفن همراه یا ثابت (با صفر اول) را درست وارد کنید.');
      if (!email) throw new Error('ایمیل را وارد کنید؛ پیوند تأیید ثبت‌نام به آن ارسال می‌شود.');
      if (!/^[^\s@,;<>()"']+@[^\s@,;<>()"']+\.[A-Za-z]{2,}$/.test(email)) throw new Error('ایمیل درست نیست.');
      const base = baseUrl(req), token = require('crypto').randomBytes(24).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      await tx(() => {
        const list = users(), rq = regReqs(), pd = livePend(), ek = emailKey(email);
        if (rq.length + pd.length >= 300) throw new Error('ظرفیت درخواست‌های در انتظار تکمیل است؛ لطفاً بعداً امتحان کنید.');
        if (list.some(x => normUser(x.Username) === normUser(name)) || pd.some(x => normUser(x.username) === normUser(name))) throw new Error('این نام کاربری قبلاً ثبت شده است.');
        if (usedEmails().indexOf(ek) >= 0) throw new Error('با این ایمیل قبلاً ثبت‌نام انجام شده است و هر ایمیل فقط یک‌بار می‌تواند ثبت‌نام کند.');
        if (pd.some(x => x.ek === ek)) throw new Error('برای این ایمیل قبلاً پیوند تأیید ارسال شده است؛ ایمیل (و پوشه‌ی هرزنامه) را ببینید یا گزینه‌ی «ارسال مجدد پیوند تأیید» را بزنید.');
        if (au.rate('regok:' + ip, 5, 864e5)) throw new Error('از این آدرس امروز چند ثبت‌نام انجام شده است؛ لطفاً فردا یا با هماهنگی مدیر اقدام کنید.');
        pd.push({ th: tokHash(token), username: name, fullName, ph: au.hashPassword(p.password), company: coN, phone, email, ek, at: Date.now(), ip });
        setPend(pd);
      });
      try { await sendMail(verifyMail(email, fullName, base + '/verify?t=' + token)); }
      catch (e) {
        console.error('ارسال ایمیل تأیید ناموفق:', e && e.message);
        await tx(() => { setPend(livePend().filter(x => x.th !== tokHash(token))); });
        throw new Error('ارسال ایمیل ناموفق بود؛ نشانی ایمیل را بررسی کنید یا بعداً دوباره امتحان کنید.');
      }
      return { ok: true, email };
    },
    async resendVerify(p, b, ip, req) {
      if (!ALLOW_REG || !MAIL_OK) throw new Error('ثبت‌نام آزاد در این سرور فعال نیست.');
      const email = String(p.email || '').trim().toLowerCase().slice(0, 120); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('ایمیل درست نیست.');
      const ek = emailKey(email);
      if (au.rate('resend:' + ek, 3, 3600e3) || au.rate('resendip:' + ip, 10, 3600e3)) throw new Error('تعداد دفعات ارسال مجدد زیاد بوده است؛ یک ساعت بعد دوباره امتحان کنید.');
      const base = baseUrl(req), token = require('crypto').randomBytes(24).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      let target = null;
      await tx(() => { const pd = livePend(), x = pd.find(y => y.ek === ek); if (x) { x.th = tokHash(token); x.at = Date.now(); target = x; setPend(pd); } });
      if (target) { try { await sendMail(verifyMail(target.email, target.fullName, base + '/verify?t=' + token)); } catch (e) { console.error('ارسال مجدد ناموفق:', e && e.message); throw new Error('ارسال ایمیل ناموفق بود؛ بعداً دوباره امتحان کنید.'); } }
      return { ok: true }; // پاسخ یکسان (وجود یا نبود درخواست فاش نمی‌شود)
    },
    async verifyEmail(p, b, ip) {
      if (au.rate('verify:' + ip, 20, 3600e3)) throw new Error('تعداد تلاش‌ها زیاد بوده است؛ بعداً دوباره امتحان کنید.');
      const th = tokHash(String(p.token || ''));
      return tx(() => {
        const pd = livePend(), x = pd.find(y => y.th === th);
        if (!x) throw new Error('این پیوند نامعتبر است یا منقضی شده یا قبلاً استفاده شده است. اگر هنوز ثبت‌نام را کامل نکرده‌اید، دوباره ثبت‌نام کنید یا «ارسال مجدد پیوند تأیید» را بزنید.');
        const list = users();
        if (list.some(y => normUser(y.Username) === normUser(x.username))) { setPend(pd.filter(y => y !== x)); throw new Error('این نام کاربری در این فاصله ثبت شده است؛ دوباره با نام کاربری دیگری ثبت‌نام کنید.'); }
        if (usedEmails().indexOf(x.ek) >= 0) { setPend(pd.filter(y => y !== x)); throw new Error('با این ایمیل قبلاً ثبت‌نام انجام شده است.'); }
        const o = { Username: x.username, FullName: x.fullName, PasswordHash: x.ph, Role: 'company', Permissions: 'own-company', IsActive: false, MustChange: false };
        gs('saveUser_', o);
        const rq = regReqs(), r = { id: o.UserID, company: x.company, phone: x.phone, email: x.email, at: nowStr(), ip: x.ip, verified: true };
        rq.push(r); setRegReqs(rq); setPend(pd.filter(y => y !== x)); setUsedEmails(usedEmails().concat([x.ek]));
        if (AUTO_APPROVE) { doApprove(r.id); return { ok: true, approved: true }; }
        return { ok: true, approved: false };
      });
    },
    async inviteInfo(p, b, ip) {
      if (au.rate('invi:' + ip, 60, 3600e3)) throw new Error('تعداد تلاش‌ها زیاد بوده است؛ بعداً دوباره امتحان کنید.');
      const th = tokHash(String(p.t || '')), x = staffInvites().find(i => i.th === th);
      if (!x || !gs('rows_', 'Companies').some(c => c.CompanyID === x.co)) throw new Error('این دعوت نامعتبر است، منقضی شده یا قبلاً استفاده شده است. از مدیر شرکت بخواهید دعوت تازه‌ای بفرستد.');
      return { company: coName(x.co), fullName: x.fullName, role: ROLE_PRESETS[x.r] ? ROLE_PRESETS[x.r].name : 'سفارشی' };
    },
    async inviteAccept(p, b, ip) {
      if (au.rate('inva:' + ip, 20, 3600e3)) throw new Error('تعداد تلاش‌ها زیاد بوده است؛ بعداً دوباره امتحان کنید.');
      const th = tokHash(String(p.t || '')), name = String(p.username || '').trim();
      const e1 = userRule(name) || au.checkPasswordRule(p.password); if (e1) throw new Error(e1);
      return tx(() => {
        const all = staffInvites(), x = all.find(i => i.th === th);
        if (!x || !gs('rows_', 'Companies').some(c => c.CompanyID === x.co)) throw new Error('این دعوت نامعتبر است، منقضی شده یا قبلاً استفاده شده است.');
        if (users().some(y => normUser(y.Username) === normUser(name))) throw new Error('این نام کاربری قبلاً ثبت شده است؛ نام دیگری انتخاب کنید.');
        gs('saveUser_', { Username: name, FullName: x.fullName, PasswordHash: au.hashPassword(p.password), Role: 'company', Permissions: staffStr(x.r, x.s), IsActive: true, CompanyID: x.co, MustChange: false });
        setStaffInvites(all.filter(i => i !== x));
        return { ok: true };
      });
    },
    async setupAdmin(p) {
      return tx(() => {
        if (users().length) throw new Error('مدیر قبلاً ساخته شده است؛ وارد شوید.');
        const name = String(p.username || '').trim(), e1 = userRule(name) || au.checkPasswordRule(p.password);
        if (e1) throw new Error(e1);
        if (!String(p.fullName || '').trim()) throw new Error('نام و نام خانوادگی را وارد کنید.');
        const o = { Username: name, FullName: String(p.fullName).trim(), PasswordHash: au.hashPassword(p.password), Role: 'admin', Permissions: '*', IsActive: true, LastLogin: nowStr(), MustChange: false };
        gs('saveUser_', o);
        return session(users().find(x => x.UserID === o.UserID), true);
      });
    }
  };
  const newCompanyUser = (list, co, name, fullName, password) => {
    const e1 = userRule(name) || au.checkPasswordRule(password); if (e1) throw new Error(e1);
    if (list.some(x => normUser(x.Username) === normUser(name))) throw new Error('این نام کاربری قبلاً ثبت شده است.');
    if (companyTaken(list, co)) throw new Error('این شرکت از قبل کاربر دارد (هر شرکت فقط یک کاربر دارد).');
    const o = { Username: name, FullName: String(fullName || coName(co) || name).trim(), PasswordHash: au.hashPassword(password), Role: 'company', Permissions: 'own-company', IsActive: true, CompanyID: co, MustChange: true };
    gs('saveUser_', o); return o;
  };
  const custPerm = (co, cu) => 'customer:' + co + ':' + cu;
  const INV_DAYS = 7;
  const staffInvites = () => jarr('StaffInv').filter(x => x && Date.now() - x.at < INV_DAYS * 864e5);
  const setStaffInvites = a => props().setProperty('StaffInv', JSON.stringify(a));
  const newToken = () => require('crypto').randomBytes(24).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const needOwner = u => { if (u.Role !== 'company' || !u.CompanyID || staffOf(u)) deny(); };
  const inviteMail = (to, name, co, link) => ({ to, subject: 'دعوت به «حسابداری ۶ سطحی معین تراز» — ' + co,
    text: (name || '') + ' عزیز،\n\nمدیر «' + co + '» شما را برای استفاده از نرم‌افزار حسابداری دعوت کرده است. برای ساخت نام کاربری و رمز عبور، پیوند زیر را باز کنید (۷ روز اعتبار دارد):\n' + link + '\n\nاگر این دعوت را انتظار نداشتید، ایمیل را نادیده بگیرید.',
    html: '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9"><p>' + esc(name || '') + ' عزیز،</p><p>مدیر «' + esc(co) + '» شما را برای استفاده از نرم‌افزار حسابداری دعوت کرده است. برای ساخت نام کاربری و رمز عبور روی دکمهٔ زیر بزنید (۷ روز اعتبار دارد):</p><p><a href="' + esc(link) + '" style="background:#1f3a5f;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;display:inline-block">پذیرش دعوت</a></p><p style="color:#666;font-size:13px">اگر دکمه کار نکرد، این نشانی را در مرورگر باز کنید:<br>' + esc(link) + '</p><p style="color:#666;font-size:13px">اگر این دعوت را انتظار نداشتید، ایمیل را نادیده بگیرید.</p></div>' });
  const ocrEngine = require('./ocr');
  const userApi = {
    async ocrStatus() { return ocrEngine.status(); },
    async ocrImage(p, me) { // OCR تصویر یک صفحه با Tesseractِ نصب‌شده روی همین سرور
      if (au.rate('ocr:' + (me.UserID || me.Username), 90, 60e3)) throw new Error('درخواست‌های OCR زیاد است؛ کمی صبر کنید.');
      const b64 = String(p.img || ''); if (b64.length < 200 || b64.length > 40e6) throw new Error('اندازهٔ تصویر مجاز نیست.');
      return ocrEngine.recognize(Buffer.from(b64, 'base64'), p.psm);
    },
    async listRegRequests(p, u) {
      if (u.Role !== 'admin') deny(); const list = users();
      return regReqs().map(r => { const x = list.find(y => y.UserID === r.id); return x ? { id: r.id, username: x.Username, fullName: x.FullName || '', company: r.company, phone: r.phone, email: r.email || '', at: r.at, ip: r.ip || '' } : null; }).filter(Boolean);
    },
    async approveReg(p, u) { // ساخت شرکت با نام اعلام‌شده، اتصال کاربر به آن و فعال‌کردن حساب
      if (u.Role !== 'admin') deny();
      return tx(() => doApprove(p.id));
    },
    async rejectReg(p, u) {
      if (u.Role !== 'admin') deny();
      return tx(() => {
        const rq = regReqs(), r = rq.find(x => x.id === p.id); if (!r) throw new Error('این درخواست پیدا نشد.');
        const t = users().find(x => x.UserID === r.id);
        if (t && !t.CompanyID && !isOn(t) && t.Role !== 'admin') { ctx.__id = r.id; run("delWhere_('Users', H.Users.indexOf('UserID') + 1, function (v) { return v === __id; })"); }
        setRegReqs(rq.filter(x => x.id !== r.id));
        if (r.email) setUsedEmails(usedEmails().filter(k => k !== emailKey(r.email))); // ردشده: ایمیل دوباره آزاد می‌شود
        return { ok: true };
      });
    },
    /* ---- مدیر شرکت: دعوت و مدیریت کارکنان همان شرکت ---- */
    async coUsers(p, u) {
      needOwner(u);
      return {
        mail: MAIL_OK, sections: Object.keys(SECS).map(k => ({ key: k, label: SECS[k] })), roles: Object.keys(ROLE_PRESETS).map(k => ({ key: k, name: ROLE_PRESETS[k].name, perms: ROLE_PRESETS[k].s })),
        users: users().filter(x => x.CompanyID === u.CompanyID && x.Role !== 'admin' && x.Role !== 'customer').map(pub),
        invites: staffInvites().filter(i => i.co === u.CompanyID).map(i => ({ id: i.id, fullName: i.fullName, email: i.email, role: i.r, perms: i.s, at: i.at, expires: i.at + INV_DAYS * 864e5 })),
      };
    },
    async coInvite(p, u, req) {
      needOwner(u);
      const fullName = String(p.fullName || '').trim(), email = String(p.email || '').trim().toLowerCase().slice(0, 120), r = ROLE_PRESETS[p.role] ? p.role : 'custom';
      if (fullName.length < 3 || fullName.length > 80) throw new Error('نام و نام خانوادگی کارمند را کامل وارد کنید.');
      if (!/^[^\s@,;<>()"']+@[^\s@,;<>()"']+\.[A-Za-z]{2,}$/.test(email)) throw new Error('ایمیل درست نیست.');
      const perms = cleanPerms(p.perms || (ROLE_PRESETS[r] ? ROLE_PRESETS[r].s : {}));
      if (!Object.keys(perms).length) throw new Error('دست‌کم به یک بخش دسترسی بدهید.');
      const base = baseUrl(req), token = newToken(); let id;
      await tx(() => {
        const all = staffInvites(), mine = all.filter(i => i.co === u.CompanyID);
        if (users().filter(x => x.CompanyID === u.CompanyID).length + mine.length >= 200) throw new Error('تعداد کاربران و دعوت‌های این شرکت به سقف رسیده است.');
        const rest = all.filter(i => !(i.co === u.CompanyID && i.email === email)); id = require('crypto').randomBytes(6).toString('hex');
        rest.push({ id, th: tokHash(token), co: u.CompanyID, fullName, email, r, s: perms, at: Date.now(), by: u.Username }); setStaffInvites(rest);
      });
      const link = base + '/invite?t=' + token; let mailed = false, mailError = '';
      if (MAIL_OK) { try { await sendMail(inviteMail(email, fullName, coName(u.CompanyID), link)); mailed = true; } catch (e) { mailError = 'ارسال ایمیل ناموفق بود'; console.error('ارسال دعوت ناموفق:', e && e.message); } } else mailError = 'ایمیل در این سرور تنظیم نشده است';
      return { id, link, mailed, mailError };
    },
    async coInviteResend(p, u, req) {
      needOwner(u); const token = newToken(); let target = null;
      await tx(() => { const all = staffInvites(), x = all.find(i => i.id === p.id && i.co === u.CompanyID); if (!x) throw new Error('این دعوت پیدا نشد یا منقضی شده است.'); x.th = tokHash(token); x.at = Date.now(); target = x; setStaffInvites(all); });
      const link = baseUrl(req) + '/invite?t=' + token; let mailed = false;
      if (MAIL_OK) { try { await sendMail(inviteMail(target.email, target.fullName, coName(u.CompanyID), link)); mailed = true; } catch (e) { console.error('ارسال دعوت ناموفق:', e && e.message); } }
      return { id: target.id, link, mailed };
    },
    async coInviteCancel(p, u) { needOwner(u); return tx(() => { setStaffInvites(staffInvites().filter(i => !(i.id === p.id && i.co === u.CompanyID))); return { ok: true }; }); },
    async coUserSave(p, u) {
      needOwner(u);
      return tx(() => {
        const t = users().find(x => x.UserID === p.id && x.CompanyID === u.CompanyID && x.UserID !== u.UserID);
        if (!t || !staffOf(t)) throw new Error('این کاربر پیدا نشد یا قابل ویرایش نیست (حساب مدیر شرکت را فقط مدیر سیستم تغییر می‌دهد).');
        const fullName = String(p.fullName || '').trim(); if (fullName.length < 3 || fullName.length > 80) throw new Error('نام و نام خانوادگی را کامل وارد کنید.');
        const r = ROLE_PRESETS[p.role] ? p.role : 'custom', perms = cleanPerms(p.perms || (ROLE_PRESETS[r] ? ROLE_PRESETS[r].s : {}));
        gs('saveUser_', { UserID: t.UserID, FullName: fullName, Permissions: staffStr(r, perms), IsActive: p.active !== false });
        return pub(users().find(x => x.UserID === t.UserID));
      });
    },
    async coUserPassword(p, u) {
      needOwner(u);
      return tx(() => {
        const t = users().find(x => x.UserID === p.id && x.CompanyID === u.CompanyID && x.UserID !== u.UserID);
        if (!t || !staffOf(t)) throw new Error('این کاربر پیدا نشد یا قابل ویرایش نیست.');
        const e1 = au.checkPasswordRule(p.password); if (e1) throw new Error(e1);
        gs('saveUser_', { UserID: t.UserID, PasswordHash: au.hashPassword(p.password), MustChange: true });
        return { ok: true };
      });
    },
    async listUsers(p, u) { if (u.Role !== 'admin') deny(); return users().map(pub); },
    async saveCompanyWithUser(p, u) { // ثبت شرکت جدید + ساخت کاربرش در یک مرحله (فقط مدیر)
      if (u.Role !== 'admin') deny();
      return tx(() => {
        const list = users(), name = String(p.username || '').trim();
        if (p.obj.CompanyID) throw new Error('این عملیات فقط برای شرکت جدید است.');
        const e1 = userRule(name) || au.checkPasswordRule(p.password); if (e1) throw new Error(e1);
        if (list.some(x => normUser(x.Username) === normUser(name))) throw new Error('این نام کاربری قبلاً ثبت شده است.');
        const co = gs('saveEntityX_', { sheet: 'Companies', obj: p.obj });
        newCompanyUser(list, co.CompanyID, name, p.fullName, p.password);
        return co;
      });
    },
    async saveUser(p, u) {
      if (u.Role !== 'admin') deny();
      return tx(() => {
        const list = users(); let o;
        if (!p.id) {
          const name = String(p.username || '').trim();
          if (p.role === 'admin') {
            const e1 = userRule(name) || au.checkPasswordRule(p.password); if (e1) throw new Error(e1);
            if (list.some(x => normUser(x.Username) === normUser(name))) throw new Error('این نام کاربری قبلاً ثبت شده است.');
            if (!String(p.fullName || '').trim()) throw new Error('نام و نام خانوادگی را وارد کنید.');
            o = { Username: name, FullName: String(p.fullName).trim(), PasswordHash: au.hashPassword(p.password), Role: 'admin', Permissions: '*', IsActive: true, MustChange: true };
            gs('saveUser_', o);
          } else {
            if (!p.company || !gs('rows_', 'Companies').some(c => c.CompanyID === p.company)) throw new Error('شرکت/مشتری را انتخاب کنید.');
            o = newCompanyUser(list, p.company, name, p.fullName, p.password);
          }
          return pub(users().find(x => x.UserID === o.UserID));
        }
        const t = list.find(x => x.UserID === p.id); if (!t) throw new Error('کاربر پیدا نشد.');
        const active = p.active !== false;
        if (t.UserID === u.UserID && !active) throw new Error('نمی‌توانید حساب خودتان را غیرفعال کنید.');
        if (!active && isOn(t) && t.Role === 'admin' && adminsLeft(list, t.UserID) < 1) throw new Error('باید دست‌کم یک مدیر فعال باقی بماند.');
        if (!String(p.fullName || '').trim()) throw new Error('نام و نام خانوادگی را وارد کنید.');
        o = { UserID: t.UserID, FullName: String(p.fullName).trim(), IsActive: active };
        if (t.Role !== 'admin' && t.Role !== 'customer' && !t.CompanyID && p.company) { // اتصال کاربرِ بدون شرکت به یک شرکت
          if (companyTaken(list, p.company, t.UserID)) throw new Error('این شرکت از قبل کاربر دارد.');
          o.CompanyID = p.company; o.Role = 'company'; o.Permissions = 'own-company';
        }
        gs('saveUser_', o); return pub(users().find(x => x.UserID === t.UserID));
      });
    },
    async setPassword(p, u) {
      if (u.Role !== 'admin') deny();
      return tx(() => {
        const t = users().find(x => x.UserID === p.id); if (!t) throw new Error('کاربر پیدا نشد.');
        const e1 = au.checkPasswordRule(p.password); if (e1) throw new Error(e1);
        const self = t.UserID === u.UserID;
        gs('saveUser_', { UserID: t.UserID, PasswordHash: au.hashPassword(p.password), MustChange: !self });
        const nu = users().find(x => x.UserID === t.UserID);
        return self ? session(nu, true) : { ok: true };
      });
    },
    async changeMyPassword(p, u) {
      const key = 'p:' + u.UserID, left = au.lockLeft(key); if (left) throw new Error('تلاش‌های ناموفق زیاد بود؛ چند دقیقه بعد دوباره امتحان کنید.');
      if (!au.verifyPassword(p.old, u.PasswordHash)) { au.noteFail(key); throw new Error('رمز فعلی درست نیست.'); }
      au.clearFails(key);
      const e1 = au.checkPasswordRule(p.password); if (e1) throw new Error(e1);
      if (p.password === p.old) throw new Error('رمز جدید باید با رمز فعلی فرق داشته باشد.');
      return tx(() => { gs('saveUser_', { UserID: u.UserID, PasswordHash: au.hashPassword(p.password), MustChange: false }); return session(users().find(x => x.UserID === u.UserID), true); });
    },
    /* ----- مدیریت حساب‌های «پنل مشتری» (مدیر سیستم یا کاربر همان شرکت) ----- */
    async portalAccList(p, u) {
      const co = p.company; if (!co || (u.Role !== 'admin' && u.CompanyID !== co)) deny();
      const list = users();
      return gs('rows_', 'Customers').filter(c => c.CompanyID === co).map(c => {
        const a = list.find(x => x.Role === 'customer' && x.Permissions === custPerm(co, c.CustomerID));
        return { customerId: c.CustomerID, code: c.CustomerCode || '', name: c.Name, hasAccount: !!a, username: a ? a.Username : '', accountActive: a ? isOn(a) : false, mustChange: a ? yes(a.MustChange) : false, lastLogin: a ? a.LastLogin || '' : '' };
      });
    },
    async portalAccSave(p, u) {
      const co = p.company; if (!co || (u.Role !== 'admin' && u.CompanyID !== co)) deny();
      return tx(() => {
        const cust = gs('rows_', 'Customers').find(x => x.CustomerID === p.customerId && x.CompanyID === co); if (!cust) throw new Error('خریدار پیدا نشد.');
        const list = users(), perm = custPerm(co, cust.CustomerID), acc = list.find(x => x.Role === 'customer' && x.Permissions === perm);
        if (!acc) {
          const name = String(p.username || '').trim(), e1 = userRule(name) || au.checkPasswordRule(p.password); if (e1) throw new Error(e1);
          if (list.some(x => normUser(x.Username) === normUser(name))) throw new Error('این نام کاربری قبلاً ثبت شده است.');
          gs('saveUser_', { Username: name, FullName: cust.Name, PasswordHash: au.hashPassword(p.password), Role: 'customer', Permissions: perm, IsActive: true, CompanyID: '', MustChange: true });
          return { created: true };
        }
        const o = { UserID: acc.UserID };
        if (p.password) { const e1 = au.checkPasswordRule(p.password); if (e1) throw new Error(e1); o.PasswordHash = au.hashPassword(p.password); o.MustChange = true; }
        if (p.active !== undefined) o.IsActive = !!p.active;
        gs('saveUser_', o);
        return { created: false };
      });
    }
  };

  /* ----- پنل مشتری: فقط داده‌ی خودِ خریدار؛ هر خروجی صراحتاً فیلدبه‌فیلد ساخته می‌شود (هیچ ردیف خامی بیرون نمی‌رود) ----- */
  const num0 = x => Number(x) || 0, r2n = x => Math.round(num0(x) * 100) / 100;
  const portalCtx = u => {
    const m = /^customer:([^:]+):([^:]+)$/.exec(String(u.Permissions || ''));
    if (u.Role !== 'customer' || !m) throw new Error('حساب مشتری کامل نیست؛ با شرکت تماس بگیرید.');
    const cust = gs('rows_', 'Customers').find(x => x.CustomerID === m[2] && x.CompanyID === m[1]);
    if (!cust) throw new Error('پروندهٔ خریدار پیدا نشد؛ با شرکت تماس بگیرید.');
    return { co: m[1], cu: m[2], cust };
  };
  const myInvoices = (c, f) => gs('listSales_', { company: c.co, customer: c.cu, all: true, from: (f && f.from) || '', to: (f && f.to) || '' }).rows
    .filter(s => s.CompanyID === c.co && s.CustomerID === c.cu && String(s.Superseded) !== '1' && Number(s.Ins) !== 3 && s.SendStatus !== 'ردشده' && s.SendStatus !== 'پیش‌نویس');
  const invOut = s => { const ret = Number(s.Ins) === 4; return { id: s.SaleID, no: s.SerialNo, date: s.DateJalali, ret, kind: ret ? 'برگشت از فروش' : 'فاکتور فروش', total: r2n(s.Tbill), received: ret ? null : r2n(s.Received), remain: ret ? null : r2n(s.Remain) }; };
  const myParty = (c, from, to) => {
    const rep = gs('partyReport_', { company: c.co, kind: 'cus', party: c.cu, from: from || '', to: to || '' }), cus = rep.cus || { rows: [], ledger: {} };
    const row = (cus.rows || []).find(r => r.id === c.cu) || null, all = (cus.ledger && cus.ledger[c.cu]) || [];
    const R = row ? { opening: r2n(row.opening), sales: r2n(row.a), returns: r2n(row.b), received: r2n(row.c), closing: r2n(row.closing) } : { opening: 0, sales: 0, returns: 0, received: 0, closing: 0 };
    /* فاکتورهای پیش‌نویس برای خریدار دیده نمی‌شوند: ردیف آن‌ها از صورت‌حساب حذف و مانده‌ها دوباره محاسبه می‌شود */
    const drafts = new Set(gs('rows_', 'SalesInvoices').filter(x => x.CompanyID === c.co && x.CustomerID === c.cu && x.SendStatus === 'پیش‌نویس').map(x => String(x.SerialNo)));
    let bal = R.opening; const lines = [];
    all.forEach(l => {
      if (drafts.has(String(l.no)) && l.kind !== 'دریافت') { if (Number(l.inc) > 0) { R.sales = r2n(R.sales - num0(l.inc)); } if (Number(l.dec) > 0) { R.returns = r2n(R.returns - num0(l.dec)); } return; }
      bal = r2n(bal + num0(l.inc) - num0(l.dec));
      lines.push({ date: l.j, kind: l.kind, no: l.no, desc: l.desc, inc: r2n(l.inc), dec: r2n(l.dec), bal });
    });
    R.closing = lines.length ? bal : R.opening;
    return { row: R, lines };
  };
  const myCheques = c => { const tg = gs('bk_today_').g; return gs('rows_', 'Cheques').filter(x => x.CompanyID === c.co && x.Dir === 'in' && x.PartyID === c.cu).map(x => ({ no: x.No || '', sayad: x.SayadNo || '', date: x.DateJalali, due: x.DueJalali, dueG: x.DueGregorian, amount: r2n(x.Amount), bank: x.BankName || '', branch: x.Branch || '', status: x.Status, statusDate: x.StatusDate || '', overdue: (x.Status === 'عادی' || x.Status === 'در جریان وصول') && !!x.DueGregorian && x.DueGregorian < tg })).sort((a, b) => (a.dueG < b.dueG ? 1 : -1)).map(x => { const o = Object.assign({}, x); delete o.dueG; return o; }); };
  const portalApi = {
    async portalMe(p, u) { const c = portalCtx(u); return { fullName: u.FullName || c.cust.Name, customer: c.cust.Name, company: coName(c.co) }; },
    async portalOverview(p, u) {
      const c = portalCtx(u), inv = myInvoices(c), pt = myParty(c), ch = myCheques(c);
      let sales = 0, returns = 0, received = 0, unpaidN = 0, unpaid = 0; const mon = {};
      inv.forEach(s => {
        const o = invOut(s), k = String(s.DateJalali).substring(0, 7);
        if (o.ret) { returns += o.total; mon[k] = (mon[k] || 0) - o.total; return; }
        sales += o.total; received += Math.min(o.received, o.total); mon[k] = (mon[k] || 0) + o.total;
        if (o.remain > 0.5) { unpaidN++; unpaid += o.remain; }
      });
      const months = Object.keys(mon).sort().slice(-12).map(k => ({ m: k, total: r2n(mon[k]) }));
      const st = {}; ch.forEach(x => { st[x.status] = (st[x.status] || 0) + 1; });
      const last = inv.slice().sort((a, b) => (a.DateGregorian < b.DateGregorian ? 1 : -1)).slice(0, 5).map(invOut);
      return { customer: c.cust.Name, company: coName(c.co), balance: pt.row.closing, sales: r2n(sales), returns: r2n(returns), received: r2n(received), invoices: inv.length, unpaidCount: unpaidN, unpaidSum: r2n(unpaid), settledPct: sales > 0 ? Math.round((received / sales) * 1000) / 10 : null, months, cheques: { total: ch.length, byStatus: st, pendingSum: r2n(ch.filter(x => x.status === 'عادی' || x.status === 'در جریان وصول').reduce((t, x) => t + x.amount, 0)), overdue: ch.filter(x => x.overdue).length }, last };
    },
    async portalInvoices(p, u) {
      const c = portalCtx(u), rows = myInvoices(c, p).map(invOut);
      const t = { count: rows.length, sales: 0, returns: 0, remain: 0 };
      rows.forEach(o => { if (o.ret) t.returns += o.total; else { t.sales += o.total; t.remain += Math.max(0, o.remain); } });
      Object.keys(t).forEach(k => { t[k] = r2n(t[k]); }); t.count = rows.length;
      return { rows: rows.sort((a, b) => (a.date < b.date ? 1 : -1)), totals: t };
    },
    async portalInvoice(p, u) {
      const c = portalCtx(u), h = gs('rows_', 'SalesInvoices').find(x => x.SaleID === String(p.id || ''));
      if (!h || h.CompanyID !== c.co || h.CustomerID !== c.cu || h.SendStatus === 'پیش‌نویس' || h.SendStatus === 'ردشده' || String(h.Superseded) === '1' || Number(h.Ins) === 3) throw new Error('فاکتور پیدا نشد.');
      const full = gs('sl_load_', h.SaleID), pn = {}; gs('rows_', 'Products').forEach(x => { if (x.CompanyID === c.co) pn[x.ProductID] = x; });
      const pm = gs('rows_', 'DocPayments').filter(y => y.DocType === 'sale' && y.DocID === h.SaleID && y.CompanyID === c.co);
      const o = invOut(Object.assign({}, h, { Received: 0, Remain: 0 })), all = myInvoices(c).find(s => s.SaleID === h.SaleID);
      if (all) { o.received = invOut(all).received; o.remain = invOut(all).remain; }
      return { head: o, items: (full.items || []).map(i => ({ name: (pn[i.ProductID] && pn[i.ProductID].Name) || i.Sstt || '', qty: num0(i.Am), unit: (pn[i.ProductID] && pn[i.ProductID].DefaultUnit) || '', fee: r2n(i.Fee), discount: r2n(i.Dis), vat: r2n(i.Vam), total: r2n(i.Tsstam) })), payments: pm.map(y => ({ date: y.DateJalali, method: y.Method || '', amount: r2n(y.Amount), chequeNo: y.ChequeNo || '', chequeStatus: y.ChequeStatus || '' })) };
    },
    async portalStatement(p, u) { return myParty(portalCtx(u), p.from, p.to); },
    async portalCheques(p, u) {
      const rows = myCheques(portalCtx(u)), t = { count: rows.length, pending: 0, cleared: 0, returned: 0 };
      rows.forEach(x => { if (x.status === 'عادی' || x.status === 'در جریان وصول') t.pending += x.amount; else if (x.status === 'وصول شده' || x.status === 'تنزیل شده') t.cleared += x.amount; else if (/برگشت|عودت/.test(x.status)) t.returned += x.amount; });
      Object.keys(t).forEach(k => { if (k !== 'count') t[k] = r2n(t[k]); });
      return { rows, totals: t };
    }
  };

  const mo = require('./moodian');
  const profOf = (hasCert) => { try { const p = JSON.parse(run("getSet_('MoProfile')")); if (p && p.x5c && p.x5c === 'cert' && hasCert) return p; } catch (e) {} return { x5c: 'cert', extra: true }; };
  const env = (co) => gs('moEnvOf_', co || '');
  const creds = (co) => {
    const c = gs('rows_', 'Companies').find(x => x.CompanyID === co); if (!c) throw new Error('شرکت پیدا نشد.');
    const md = run("getSet_('KeyMode_" + co + "')"), key = gs('getCompanyKey_', co), cert = gs('getCompanyCert_', co);
    if (!c.TaxMemoryID) throw new Error('شناسه حافظه مالیاتی شرکت «' + c.Name + '» ثبت نشده است.');
    if (!key) throw new Error('کلید خصوصی شرکت «' + c.Name + '» ثبت نشده است.');
    return { memId: String(c.TaxMemoryID).toUpperCase(), key, cert, name: c.Name, keyId: /without/.test(md) ? '' : String(c.KeyID || '').trim(), style: /^v1/.test(md) ? 'v1' : 'obj' };
  };
  const native = {
    /* خواندن Excel برای «ثبت از روی اسکن»: ورودی base64، خروجی ردیف‌های هر برگه (حداکثر ۵۰۰۰ ردیف) */
    async docParseXlsx(p) {
      const data = String(p.data || ''); if (!data) throw new Error('فایلی ارسال نشد.'); if (data.length > 14e6) throw new Error('حجم فایل بیش از ۱۰ مگابایت است.');
      let sheets; try { sheets = require('./xlsx').readXlsx(Buffer.from(data, 'base64'), 0); } catch (e) { throw new Error('فایل Excel خوانده نشد (فقط xlsx پشتیبانی می‌شود): ' + e.message); }
      return { sheets: Object.keys(sheets).map(n => ({ name: n, rows: sheets[n].slice(0, 5000).map(r => r.slice(0, 40)) })) };
    },
    async moInfo(p) { return { env: env(p.company), globalEnv: env('') }; },
    async moSetEnv(p) { if (['sandbox', 'prod'].indexOf(p.env) < 0) throw new Error('محیط نامعتبر است.'); const key = p.global ? 'MoEnv' : (p.company ? 'MoEnv_' + p.company : ''); if (!key) throw new Error('شرکت مشخص نیست.'); await tx(() => { run("setSet_('" + key + "','" + p.env + "')"); }); return { env: p.env }; },
    async backupCompany(p) { if (!p.company) throw new Error('شرکت مشخص نیست.'); const d = await tx(() => gs('companyDump_', p.company)); return dumpCompanyFile(p.company, d); },
    /* ===== بازگردانی پشتیبان (فقط مدیر سیستم) ===== */
    async backupList() {
      const out = [], add = (kind, dir, re) => { try { fs.readdirSync(dir).filter(x => re.test(x)).forEach(x => { const st = fs.statSync(path.join(dir, x)); if (st.isFile()) out.push({ file: kind + '/' + x, kind, name: x, size: st.size, mtime: st.mtime.toISOString() }); }); } catch (e) { /* پوشه هنوز ساخته نشده */ } };
      add('full', BK, /^(backup|restore-safety)-.*\.json\.gz$/); add('company', path.join(BK, 'company'), /^company-.*\.json\.gz$/); add('upload', path.join(BK, 'uploads'), /^upload-.*\.bak$/);
      return out.sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
    },
    async restorePreview(p) {
      const bk = readBackupFile(p.file), cos = await tx(() => {
        const cur = {}; gs('rows_', 'Companies').forEach(c => { cur[c.CompanyID] = c; });
        return bk.ids.map(id => {
          const d = bk.dumpOf(id), n = Object.keys(d.sheets).reduce((a, k) => a + d.sheets[k].rows.length, 0), c = cur[id];
          let now = 0; if (c) { const cd = gs('companyDump_', id); now = Object.keys(cd.sheets).reduce((a, k) => a + cd.sheets[k].rows.length, 0); }
          return { id, name: bk.names[id] || id, records: n, exists: !!c, currentName: c ? c.Name : '', currentRecords: now };
        });
      });
      return { type: bk.type, at: bk.at, companies: cos };
    },
    async restoreRun(p) {
      const ids = Array.isArray(p.companies) ? p.companies.map(String) : []; if (!ids.length) throw new Error('هیچ شرکتی انتخاب نشده است.');
      const bk = readBackupFile(p.file); ids.forEach(id => { if (bk.ids.indexOf(id) < 0) throw new Error('شرکت ' + id + ' در این فایل نیست.'); });
      return tx(async () => {
        const dumps = ids.map(id => bk.dumpOf(id));
        const safety = doBackup('restore-safety'), results = [], exist = {}; gs('rows_', 'Companies').forEach(c => { exist[c.CompanyID] = 1; });
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i], snap = exist[id] ? gs('companyDump_', id) : null;
          try { const r = gs('companyRestore_', dumps[i]); results.push({ id, ok: true, deleted: r.deleted, inserted: r.inserted, created: !exist[id] }); }
          catch (e) {
            let back = false; if (snap) { try { gs('companyRestore_', snap); back = true; } catch (e2) { /* بازگشت ناموفق: پشتیبان خودکار موجود است */ } }
            results.push({ id, ok: false, error: String(e.message || e), rolledBack: back });
          }
        }
        return { safety, results };
      });
    },
    async moTest() { return mo.netTestV1(); },
    async moProbe(p) {
      const co = p.company || (gs('rows_', 'Companies')[0] || {}).CompanyID, cr = creds(co);
      const res = await new mo.ClientV1(env(co), cr.memId, cr.key, String((gs('rows_', 'Companies').find(x => x.CompanyID === co) || {}).KeyID || '').trim()).probe(), win = res.filter(x => x.ok)[0];
      const tok = res.filter(x => x.ok && /توکن/.test(x.label))[0];
      if (tok) { const m = (tok.style === 'v1' ? 'v1' : 'obj') + '|' + (tok.withKey ? 'with' : 'without'); await tx(() => { run("setSet_('KeyMode_" + co + "','" + m + "')"); }); }
      return { results: res, chosen: tok ? tok.label : null, env: env(co), name: cr.name, memId: cr.memId, fp: require('crypto').createHash('sha256').update(require('crypto').createPublicKey(cr.key).export({ type: 'spki', format: 'der' })).digest('hex').toUpperCase().slice(0, 16) };
    },
    async moPub(p) {
      const co = p.company || (gs('rows_', 'Companies')[0] || {}).CompanyID, cr = creds(co), c = require('crypto');
      const pub = c.createPublicKey(cr.key), der = pub.export({ type: 'spki', format: 'der' });
      return { name: cr.name, memId: cr.memId, keyId: cr.keyId, pem: pub.export({ type: 'spki', format: 'pem' }), fp: c.createHash('sha256').update(der).digest('hex').toUpperCase().match(/.{2}/g).join(':') };
    },
    async moGen(p) {
      const co = p.company || (gs('rows_', 'Companies')[0] || {}).CompanyID; if (!co) throw new Error('شرکت مشخص نیست.');
      const c = require('crypto'), kp = c.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
      await tx(() => { gs('setCompanyKey_', { company: co, key: kp.privateKey }); run("setSet_('KeyMode_" + co + "','')"); });
      return { pem: kp.publicKey };
    },
    async moDiag() { return { header: mo.DIAG.hdr, log: mo.DIAG.log.slice() }; },
    async setCompanyCert(p) {
      if (!p.remove) {
        if (/CERTIFICATE REQUEST/.test(p.cert || '')) throw new Error('این فایل «درخواست گواهی» (CSR) است، نه خود گواهی. گواهی امضا را (پس از تأیید CSR) از پورتال/مرجع صدور گواهی دریافت کنید؛ فایل .crt یا .cer یا .pem.');
        let x; const pem = /BEGIN/.test(p.cert || '') ? p.cert : '-----BEGIN CERTIFICATE-----\n' + String(p.cert || '').replace(/\s+/g, '') + '\n-----END CERTIFICATE-----';
        try { x = new (require('crypto').X509Certificate)(pem); } catch (e) { throw new Error('فایل گواهی قابل خواندن نیست؛ باید فایل .crt/.cer/.pem گواهی باشد.'); }
        if (new Date(x.validTo) < new Date()) throw new Error('این گواهی منقضی شده است (' + x.validTo + ').');
        const key = p.company && gs('getCompanyKey_', p.company);
        if (key) { try { const pub = require('crypto').createPublicKey(key).export({ type: 'spki', format: 'der' }); if (!pub.equals(x.publicKey.export({ type: 'spki', format: 'der' }))) throw new Error('x'); } catch (e) { if (e.message === 'x') throw new Error('این گواهی با کلید خصوصی ثبت‌شده برای این شرکت جفت نیست.'); } }
        p.cert = pem;
      }
      return tx(() => gs('setCompanyCert_', p));
    },
    async moSend(p) {
      const ids = (p.ids || []).slice(0, 200), res = {}, jobs = {};
      if (ids.length > 5) { try { doBackup(); } catch (e) { console.error('backup before send', e.message); } }
      await tx(() => {
        ids.forEach(id => {
          try {
            const h = gs('sl_load_', id); if (!h) throw new Error('صورتحساب پیدا نشد.');
            if (h.SendStatus !== 'آماده ارسال') throw new Error('وضعیت صورتحساب «' + h.SendStatus + '» است؛ فقط «آماده ارسال» ارسال می‌شود.');
            const sj = gs('saleJson_', { id }); if (sj.errors.length) throw new Error(sj.errors[0]);
            const cr = creds(h.CompanyID); sj.json.header.taxid = mo.taxId(cr.memId, h.DateGregorian, h.SerialNo, h.TimeHM);
            (jobs[h.CompanyID] = jobs[h.CompanyID] || { cr, list: [] }).list.push({ id, json: sj.json, tax: sj.json.header.taxid });
          } catch (e) { res[id] = { ok: false, error: e.message, keep: true }; }
        });
      });
      for (const co of Object.keys(jobs)) {
        const J = jobs[co], cl = new mo.ClientV1(env(co), J.cr.memId, J.cr.key, J.cr.keyId, J.cr.style);
        try {
          for (let i = 0; i < J.list.length; i += 50) {
            const part = J.list.slice(i, i + 50), out = await cl.submit(part);
            out.forEach(o => { const j = part.find(x => x.id === o.id); res[o.id] = o.error && !o.ref ? { ok: false, error: o.error, keep: !!o.transport, tax: j.tax } : { ok: true, tax: j.tax, ref: o.ref, warn: o.error }; });
          }
        } catch (e) { J.list.forEach(j => { if (!res[j.id]) res[j.id] = { ok: false, error: e.message, keep: true }; }); }
      }
      await tx(() => {
        Object.keys(res).forEach(id => { const r = res[id];
          try {
            if (r.ok) gs('setSaleStatus_', { id, status: 'ارسال‌شده', taxNo: r.tax, ref: r.ref, error: r.warn || '' });
            else if (!r.keep) gs('setSaleStatus_', { id, status: 'ردشده', taxNo: r.tax, error: String(r.error).slice(0, 900) });
            else if (r.error) gs('setSaleStatus_', { id, status: 'آماده ارسال', error: String(r.error).slice(0, 900) });
          } catch (e) { r.error = (r.error ? r.error + ' | ' : '') + e.message; }
        });
      });
      const sum = { sent: 0, failed: 0, kept: 0 }; Object.keys(res).forEach(id => { const r = res[id]; if (r.ok) sum.sent++; else if (r.keep) sum.kept++; else sum.failed++; });
      return { results: res, summary: sum, env: env(p.company) };
    },
    async moInquire(p) {
      const ids = (p.ids || []).slice(0, 200), res = {}, jobs = {};
      await tx(() => ids.forEach(id => { try {
        const h = gs('sl_load_', id); if (!h) throw new Error('پیدا نشد.');
        if (h.SendStatus !== 'ارسال‌شده') throw new Error('در وضعیت «' + h.SendStatus + '» استعلام لازم نیست.');
        const cr = creds(h.CompanyID); (jobs[h.CompanyID] = jobs[h.CompanyID] || { cr, list: [] }).list.push({ id, ref: h.SendRef, tax: h.TaxNo });
      } catch (e) { res[id] = { state: 'skip', msg: e.message }; } }));
      for (const co of Object.keys(jobs)) {
        const J = jobs[co], cl = new mo.ClientV1(env(co), J.cr.memId, J.cr.key, J.cr.keyId, J.cr.style);
        try { (await cl.inquire(J.list)).forEach(o => { res[o.id] = o; }); } catch (e) { J.list.forEach(j => { res[j.id] = { state: 'unknown', msg: e.message }; }); }
      }
      await tx(() => Object.keys(res).forEach(id => { const r = res[id], j = Object.keys(jobs).map(c => jobs[c].list.find(x => x.id === id)).filter(Boolean)[0];
        try {
          if (r.state === 'ok') gs('setSaleStatus_', { id, status: 'تأییدشده', taxNo: j.tax, error: '' });
          else if (r.state === 'fail') gs('setSaleStatus_', { id, status: 'ردشده', error: String(r.msg).slice(0, 900) });
        } catch (e) { r.msg = e.message; } }));
      return { results: res };
    }
  };

  /* مسیر امن فایل پشتیبان: kind/name  با kind یکی از full | company | upload */
  const bkPath = file => {
    const m = /^(full|company|upload)\/([\w.\-]+)$/.exec(String(file || '')); if (!m) throw new Error('فایل پشتیبان نامعتبر است.');
    const f = path.join(m[1] === 'full' ? BK : path.join(BK, m[1] === 'company' ? 'company' : 'uploads'), path.basename(m[2]));
    if (!fs.existsSync(f)) throw new Error('فایل پشتیبان پیدا نشد.'); return f;
  };
  /* خواندن و تشخیص نوع فایل: «کامل سیستم» یا «یک شرکت»؛ dumpOf(id) پشتیبان آن شرکت را می‌سازد */
  const readBackupFile = file => {
    const raw = fs.readFileSync(bkPath(file)); let buf; try { buf = zlib.gunzipSync(raw); } catch (e) { buf = raw; }
    let o; try { o = JSON.parse(buf.toString('utf8')); } catch (e) { throw new Error('فایل خوانده نشد (خراب است یا فایل پشتیبان نیست).'); }
    if (o && o.company && o.sheets && typeof o.sheets === 'object' && !o.props) {
      if (!/^CMP-\d+$/.test(String(o.company))) throw new Error('شناسه‌ی شرکت در فایل نامعتبر است.');
      const c = o.sheets.Companies, nm = c && c.rows && c.rows[0] ? c.rows[0][(c.header || []).indexOf('Name')] : '';
      return { type: 'company', at: o.at, ids: [o.company], names: { [o.company]: nm || '' }, dumpOf: () => o };
    }
    if (o && o.sheets && o.props && Array.isArray(o.sheets.Companies)) {
      const h = o.sheets.Companies[0] || [], ii = h.indexOf('CompanyID'), ni = h.indexOf('Name'), ids = [], names = {};
      if (ii < 0) throw new Error('ساختار فایل پشتیبان کامل درست نیست (شیت شرکت‌ها).');
      o.sheets.Companies.slice(1).forEach(r => { const id = String(r[ii] || ''); if (/^CMP-\d+$/.test(id)) { ids.push(id); names[id] = r[ni] || ''; } });
      return { type: 'full', at: o.at, ids, names, dumpOf: id => gs('companyExtract_', { co: id, src: o.sheets }) };
    }
    throw new Error('این فایل، پشتیبان معتبر معین تراز نیست.');
  };
  function dump() {
    const o = { at: new Date().toISOString(), props: store.props, sheets: {} };
    store.order.forEach(n => { o.sheets[n] = store.sheets[n].rows; });
    return zlib.gzipSync(JSON.stringify(o));
  }
  function dumpCompanyFile(co, d) {
    const dir = path.join(BK, 'company'); fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16), name = 'company-' + co + '-' + stamp + '.json.gz';
    fs.writeFileSync(path.join(dir, name), zlib.gzipSync(JSON.stringify(d)));
    fs.readdirSync(dir).filter(x => x.startsWith('company-' + co + '-')).sort().slice(0, -5).forEach(x => fs.unlinkSync(path.join(dir, x)));
    return { name, url: '/backup/company/' + name };
  }
  /* pre = 'restore-safety' برای پشتیبان خودکارِ پیش از بازگردانی (نام جدا تا هرگز روی فایل مبدأ نیفتد؛ ۱۰ نسخهٔ آخر نگه داشته می‌شود) */
  function doBackup(pre) {
    fs.mkdirSync(BK, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:T]/g, '-'), name = (pre || 'backup') + '-' + stamp.slice(0, pre ? 19 : 16) + '.json.gz';
    fs.writeFileSync(path.join(BK, name), dump());
    const re = new RegExp('^' + (pre || 'backup') + '-.*\\.json\\.gz$');
    fs.readdirSync(BK).filter(x => re.test(x)).sort().slice(0, pre ? -10 : -30).forEach(x => fs.unlinkSync(path.join(BK, x)));
    return name;
  }
  setInterval(() => serial(async () => { try { doBackup(); } catch (e) { console.error('backup', e.message); } }), 24 * 3600 * 1000).unref();

  const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html')), landing = fs.readFileSync(path.join(__dirname, 'public', 'landing.html'));
  const clientIp = req => {
    let ip = req.socket.remoteAddress || '';
    if (TRUST_PROXY) { const x = String(req.headers['x-forwarded-for'] || '').split(',').map(v => v.trim()).filter(Boolean); if (x.length) ip = x[x.length - 1]; }
    return ip.replace(/^::ffff:/, '').slice(0, 64) || '?';
  };
  const V2 = path.join(__dirname, 'public', 'v2');
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json', '.mjs': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm', '.gz': 'application/octet-stream' };
  const serveV2 = (pathname, res) => {
    if (pathname === '/v2') { res.writeHead(301, { location: '/v2/' }); return res.end(); }
    let rel; try { rel = decodeURIComponent(pathname.slice(3)); } catch (e) { res.writeHead(400); return res.end('bad path'); }
    if (rel === '' || rel === '/') rel = '/index.html';
    let f = path.resolve(V2, '.' + rel);
    if (f !== V2 && !f.startsWith(V2 + path.sep)) { res.writeHead(403); return res.end('forbidden'); }
    if (!fs.existsSync(path.join(V2, 'index.html'))) { res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }); return res.end('<!doctype html><meta charset="utf-8"><body dir="rtl" style="font-family:Tahoma;padding:24px">نسخهٔ جدید رابط کاربری هنوز نصب نشده است. <a href="/app">بازگشت به برنامه</a></body>'); }
    if (!fs.existsSync(f) || !fs.statSync(f).isFile()) {
      if (path.extname(rel)) { res.writeHead(404); return res.end('not found'); }
      f = path.join(V2, 'index.html');
    }
    const ext = path.extname(f).toLowerCase(), asset = f.startsWith(path.join(V2, 'assets') + path.sep), font = f.startsWith(path.join(V2, 'fonts') + path.sep) || f.startsWith(path.join(V2, 'ocr') + path.sep);
    // assets: نام فایل شامل هش است (همیشه تازه)؛ فونت‌ها نام ثابت دارند، پس فقط یک روز در مرورگر بمانند (و آدرس با ?v=... نسخه می‌شود)
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': asset ? 'public, max-age=31536000, immutable' : font ? 'public, max-age=86400' : 'no-store' });
    res.end(fs.readFileSync(f));
  };
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'), ip = clientIp(req), secure = TRUST_PROXY && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
    if (HTTPS_ONLY && TRUST_PROXY && !secure && u.pathname !== '/health') { res.writeHead(301, { location: 'https://' + String(req.headers.host || '') + req.url }); return res.end(); }
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'SAMEORIGIN'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), payment=()'); res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    if (!flag(process.env.CSP_OFF)) res.setHeader('Content-Security-Policy', CSP);
    if (HTTPS_ONLY || secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    const page = (b) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(b); };
    if (req.method === 'GET' && u.pathname === '/') return page(landing);
    if (req.method === 'GET' && u.pathname === '/app') {
      // رابط جدید پیش‌فرض است (وقتی نصب شده باشد). نسخهٔ قبلی: /app?legacy=1 ؛ حالت درون‌قالب (embed=1) همیشه نسخهٔ قبلی را می‌دهد.
      const newUi = !flag(process.env.LEGACY_DEFAULT) && fs.existsSync(path.join(V2, 'index.html'));
      if (newUi && u.searchParams.get('embed') !== '1' && u.searchParams.get('legacy') !== '1') { res.writeHead(302, { location: '/v2/', 'cache-control': 'no-store' }); return res.end(); }
      return page(html);
    }
    if (req.method === 'GET' && u.pathname === '/index.html') { res.writeHead(302, { location: '/app' }); return res.end(); }
    if (req.method === 'GET' && u.pathname === '/verify') return page(VERIFY_HTML);
    if (req.method === 'GET' && u.pathname === '/invite') return page(INVITE_HTML);
    if (req.method === 'GET' && u.pathname === '/health') { res.writeHead(200); return res.end('ok'); }
    if (req.method === 'GET' && (u.pathname === '/portal' || u.pathname === '/portal/')) return serveV2('/v2/portal.html', res);
    /* رابط کاربری جدید (React + Ant Design) — فایل‌های build در public/v2 */
    if (req.method === 'GET' && (u.pathname === '/v2' || u.pathname.startsWith('/v2/'))) return serveV2(u.pathname, res);
    if (req.method === 'POST' && u.pathname === '/backup/upload') {
      const bu = authUser(u.searchParams.get('t'));
      if (!bu || bu.Role !== 'admin') { res.writeHead(403); return res.end('forbidden'); }
      const chunks = []; let size = 0, dead = false;
      req.on('data', c => { size += c.length; if (size > MAX_BODY) { dead = true; if (!res.headersSent) { res.writeHead(413); res.end('too large'); } req.destroy(); } else chunks.push(c); });
      req.on('end', () => {
        if (dead) return;
        try {
          const dir = path.join(BK, 'uploads'); fs.mkdirSync(dir, { recursive: true });
          const name = 'upload-' + new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19) + '-' + require('crypto').randomBytes(3).toString('hex') + '.bak';
          fs.writeFileSync(path.join(dir, name), Buffer.concat(chunks));
          fs.readdirSync(dir).filter(x => /^upload-.*\.bak$/.test(x)).sort().slice(0, -10).forEach(x => fs.unlinkSync(path.join(dir, x)));
          res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, file: 'upload/' + name, size }));
        } catch (e) { res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: String(e.message || e) })); }
      });
      return;
    }
    if (req.method === 'GET' && u.pathname.startsWith('/backup/company/')) {
      const bu = authUser(u.searchParams.get('t')), nm = path.basename(u.pathname), m = /^company-(CMP-\d+)-/.exec(nm), f = path.join(BK, 'company', nm);
      if (!bu || bu.Role === 'customer' || !m || (bu.Role !== 'admin' && (bu.CompanyID !== m[1] || staffOf(bu)))) { res.writeHead(403); return res.end('forbidden'); }
      if (!fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'content-type': 'application/gzip', 'content-disposition': 'attachment; filename="' + nm + '"' }); return res.end(fs.readFileSync(f));
    }
    if (req.method === 'GET' && u.pathname.startsWith('/backup/')) {
      serial(async () => {
        const bu = authUser(u.searchParams.get('t')); if (!bu || bu.Role !== 'admin') { res.writeHead(403); return res.end('forbidden'); }
        const f = path.join(BK, path.basename(u.pathname));
        if (!fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'content-type': 'application/gzip', 'content-disposition': 'attachment; filename="' + path.basename(f) + '"' }); res.end(fs.readFileSync(f));
      }); return;
    }
    if (req.method === 'POST' && u.pathname === '/api') {
      const chunks = []; let size = 0;
      req.on('data', c => { size += c.length; if (size > MAX_BODY) { if (!res.headersSent) { res.writeHead(413); res.end('too large'); } req.destroy(); } else chunks.push(c); });
      req.on('end', () => {
        let b; try { b = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { res.writeHead(400); return res.end('bad json'); }
        (async () => {
          let out, me0 = null, p0 = null;
          try {
            if (pubApi[b.a]) { if (au.rate('pub:' + ip, 120, 60e3)) throw new Error('درخواست‌های زیاد از این آدرس؛ کمی صبر کنید.'); out = { ok: true, data: await pubApi[b.a](b.p || {}, b, ip, req) }; }
            else {
              const me = authUser(b.t); me0 = me;
              if (!me) out = { ok: false, error: 'NEEDCODE' };
              else if (yes(me.MustChange) && b.a !== 'changeMyPassword') out = { ok: false, error: 'MUSTCHANGE' };
              else if (me.Role === 'customer') { // حساب پنل مشتری: فقط عملیات پنل و تغییر رمز؛ هرگز وارد guard/عملیات شرکت نمی‌شود
                if (portalApi[b.a]) out = { ok: true, data: await portalApi[b.a](b.p || {}, me) };
                else if (b.a === 'changeMyPassword') out = { ok: true, data: await userApi.changeMyPassword(b.p || {}, me) };
                else deny();
              }
              else {
                const p = guard(me, b); p0 = p;
                if (userApi[b.a]) out = { ok: true, data: await userApi[b.a](p, me, req) };
                else if (native[b.a]) { if (me.Role !== 'admin' && !CO_ACT[b.a]) deny(); const nd = await native[b.a](p); if (me.Role !== 'admin' && nd && typeof nd === 'object') delete nd.globalEnv; out = { ok: true, data: nd }; }
                else out = await tx(async () => {
                  if (b.a === 'backup') { if (me.Role !== 'admin') deny(); const n = doBackup(); return { ok: true, data: { name: n, url: '/backup/' + n + '?t=' + encodeURIComponent(String(b.t || '')) } }; }
                  const r = await Promise.resolve(vm.runInContext('api', ctx)(b.t, b.a, p));
                  if (r && r.ok && r.data && (b.a === 'bootstrap' || b.a === 'setSettings' || b.a === 'setApiKey')) { filterBoot(me, r.data); r.data.me = pub(me); if (me.Role === 'admin' && b.a === 'bootstrap') { const cu = {}; users().forEach(u => { if (roleOf(u) === 'company' && u.CompanyID && !staffOf(u)) cu[u.CompanyID] = { username: u.Username, active: isOn(u), mustChange: yes(u.MustChange) }; }); r.data.companyUsers = cu; } }
                  return r;
                });
              }
            }
          } catch (e) { out = { ok: false, error: String(e && e.message || e) }; }
          if (me0 && out && out.error !== 'MUSTCHANGE') await writeLog(me0, b, p0, out);
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(out));
        })();
      });
      return;
    }
    res.writeHead(404); res.end('not found');
  });
  srv.requestTimeout = 0; srv.headersTimeout = 60000;
  await new Promise(r => srv.listen(PORT, BIND, r));
  console.log('listening on', BIND + ':' + PORT, '| ثبت‌نام آزاد:', ALLOW_REG ? 'روشن' : 'خاموش', '| رمزگذاری کلیدها:', store.sec.enabled ? 'روشن' : 'خاموش');
  return { srv, store, run };
}
module.exports = { start };
if (require.main === module) {
  const pool = require('./dbadapter').fromEnv(process.env);
  const tryStart = async n => { try { await start(pool); } catch (e) { console.error(e.message); if (n > 0) setTimeout(() => tryStart(n - 1), 3000); else process.exit(1); } };
  tryStart(20);
}
