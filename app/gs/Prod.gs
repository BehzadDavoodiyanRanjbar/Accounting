/* ===================================================================
   ماژول تولید — عمومی و مستقل از صنعت
   هیچ منطقی مخصوص یک صنعت در این فایل نیست؛ همه‌چیز با «فرمول ساخت»، «مراحل»،
   «کنترل‌های کیفی»، «فیلدهای اختصاصی» و «تنظیمات» هر شرکت تعریف می‌شود.

   مفاهیم:
   - فرمول ساخت (Recipe): محصول خروجی + مقدار پایه + فهرست مواد (مقدار هر ماده یک «فرمول» است)
     + مراحل (هرکدام با دستمزد از «خدمات» و کنترل‌های کیفی دلخواه).
   - سفارش تولید (Order): پیش‌نویس ← در حال تولید ← (تأیید دستی) تکمیل‌شده. فقط با تکمیل‌شدن
     موجودی تغییر می‌کند: مواد مصرفی کم و محصول به موجودی اضافه می‌شود.
   - فاکتور هزینه: هزینه‌های غیرمستقیم (برق، اجاره، ...) که به‌عنوان سربار بین سفارش‌ها تقسیم می‌شود.
   =================================================================== */
var PR_ST = {draft: 'پیش‌نویس', run: 'در حال تولید', done: 'تکمیل‌شده', cancel: 'لغو'};
var PR_CATS = ['برق', 'آب', 'گاز', 'اجاره', 'استهلاک', 'حمل و نقل', 'نگهداری و تعمیرات', 'حقوق غیرمستقیم', 'سایر'];

/* ---------- ابزارهای کوچک ---------- */
function pr_num_(x) { var v = Number(fa2en_(String(x == null ? '' : x)).replace(/[,\s٬]/g, '').replace(/٫/g, '.')); return isNaN(v) ? 0 : v; }
function pr_json_(s, d) { if (s && typeof s === 'object') return s; try { return s ? JSON.parse(s) : d; } catch (e) { return d; } }
function pr_arr_(sheet, o) { return H[sheet].map(function (k) { return o[k] === undefined || o[k] === null ? '' : o[k]; }); }
function pr_r6_(x) { return Math.round((Number(x) + 1e-12) * 1e6) / 1e6; }
function pr_by_(sheet, field, id) { return rows_(sheet).filter(function (r) { return r[field] === id; }); }
function pr_today_() {
  var g = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd').split('-').map(Number), j = g2j_(g[0], g[1], g[2]), p = function (x) { return ('0' + x).slice(-2); };
  return j[0] + '/' + p(j[1]) + '/' + p(j[2]);
}
function pr_setRow_(sheet, keyField, id, obj) {
  var s = sh_(sheet), r = findRow_(s, id), arr = pr_arr_(sheet, obj);
  if (r) s.getRange(r, 1, 1, arr.length).setValues([arr]); else appendRows_(s, [arr]);
}
function pr_replace_(sheet, field, id, objs) {
  delWhere_(sheet, H[sheet].indexOf(field) + 1, function (v) { return v === id; });
  appendRows_(sh_(sheet), objs.map(function (o) { return pr_arr_(sheet, o); }));
}
function pr_find_(sheet, key, id, co, what) {
  var r = rows_(sheet).filter(function (x) { return x[key] === id; })[0];
  if (!r || (co && r.CompanyID !== co)) throw new Error((what || 'مورد') + ' پیدا نشد.');
  return r;
}
function pr_prod_(co, pid, what) {
  var r = rows_('Products').filter(function (x) { return x.ProductID === pid && x.CompanyID === co; })[0];
  if (!r) throw new Error((what || 'کالا') + ' برای این شرکت پیدا نشد.');
  return r;
}

/* ---------- تنظیمات هر شرکت ---------- */
function prCfg_(co) {
  var c = pr_json_(getSet_('prodcfg_' + co), {});
  return {
    method: c.method === 'last' ? 'last' : 'avg',
    prefix: String(c.prefix || 'PO').replace(/[^A-Za-z0-9\-_]/g, '').substring(0, 10) || 'PO',
    strictSteps: c.strictSteps !== false,
    vatInCost: !!c.vatInCost,
    fields: Array.isArray(c.fields) ? c.fields : [],
    categories: Array.isArray(c.categories) && c.categories.length ? c.categories : PR_CATS
  };
}
function prodCfgGet_(p) { return prCfg_(p.company); }
function prodCfgSave_(p) {
  var c = p.cfg || {}, keys = {}, fields = [];
  (c.fields || []).forEach(function (f, i) {
    var label = String(f.label || '').trim(); if (!label) return;
    var type = ['text', 'number', 'date', 'choice'].indexOf(f.type) >= 0 ? f.type : 'text', key = String(f.key || ('f' + (i + 1))).replace(/[^A-Za-z0-9_]/g, '') || ('f' + (i + 1));
    if (keys[key]) key = key + '_' + (i + 1); keys[key] = 1;
    fields.push({key: key, label: label, type: type, options: type === 'choice' ? String(f.options || '').split(/[,،\n]/).map(function (x) { return x.trim(); }).filter(Boolean) : [], required: !!f.required});
  });
  var cats = (c.categories || []).map(function (x) { return String(x).trim(); }).filter(Boolean);
  var out = {method: c.method === 'last' ? 'last' : 'avg', prefix: String(c.prefix || 'PO').replace(/[^A-Za-z0-9\-_]/g, '').substring(0, 10) || 'PO', strictSteps: c.strictSteps !== false, vatInCost: !!c.vatInCost, fields: fields, categories: cats.length ? cats : PR_CATS};
  setSet_('prodcfg_' + p.company, JSON.stringify(out));
  return prCfg_(p.company);
}

/* ---------- موتور فرمول (امن؛ بدون eval) ----------
   عملگرها: + - * / ^ ( )  مقایسه: < > <= >= == !=
   توابع: min max ceil floor round abs sqrt pow if(شرط، مقدار۱، مقدار۲)
   متغیرها: Q (مقدار سفارش) و هر پارامتری که در فرمول ساخت تعریف شده است (نام فارسی یا انگلیسی). */
function fx_norm_(s) {
  return fa2en_(String(s == null ? '' : s)).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, '').replace(/٫/g, '.').replace(/×/g, '*').replace(/÷/g, '/').replace(/،/g, ',').replace(/[–—−]/g, '-');
}
function fx_eval_(src, vars) {
  var s = fx_norm_(src), pos = 0, V = {};
  Object.keys(vars || {}).forEach(function (k) { V[fx_norm_(k)] = Number(vars[k]); });
  if (!s.trim()) throw new Error('فرمول خالی است.');
  var ws = function () { while (pos < s.length && /\s/.test(s.charAt(pos))) pos++; };
  var eat = function (t) { ws(); if (s.substr(pos, t.length) === t) { pos += t.length; return true; } return false; };
  var fail = function (m) { throw new Error(m); };
  var FN = {
    min: function (a) { return Math.min.apply(null, a); }, max: function (a) { return Math.max.apply(null, a); },
    ceil: function (a) { return Math.ceil(a[0] - 1e-9); }, floor: function (a) { return Math.floor(a[0] + 1e-9); },
    round: function (a) { var k = Math.pow(10, a.length > 1 ? a[1] : 0); return Math.round(a[0] * k + 1e-9) / k; },
    abs: function (a) { return Math.abs(a[0]); }, sqrt: function (a) { if (a[0] < 0) fail('جذر عدد منفی ممکن نیست.'); return Math.sqrt(a[0]); },
    pow: function (a) { return Math.pow(a[0], a[1]); }
  };
  function cmp() {
    var a = add(); ws();
    var m = /^(<=|>=|==|!=|<|>)/.exec(s.substr(pos));
    if (!m) return a;
    pos += m[1].length; var b = add();
    switch (m[1]) { case '<': return a < b ? 1 : 0; case '>': return a > b ? 1 : 0; case '<=': return a <= b ? 1 : 0; case '>=': return a >= b ? 1 : 0; case '==': return a === b ? 1 : 0; default: return a !== b ? 1 : 0; }
  }
  function add() { var a = mul(); for (;;) { if (eat('+')) a += mul(); else if (eat('-')) a -= mul(); else return a; } }
  function mul() {
    var a = una();
    for (;;) {
      if (eat('*')) a *= una();
      else if (eat('/')) { var b = una(); if (b === 0) fail('تقسیم بر صفر در فرمول.'); a /= b; }
      else return a;
    }
  }
  function una() { if (eat('-')) return -una(); if (eat('+')) return una(); return pw(); }
  function pw() { var a = atom(); if (eat('^')) return Math.pow(a, una()); return a; }
  function atom() {
    ws();
    if (eat('(')) { var v = cmp(); if (!eat(')')) fail('پرانتز بسته نشده است.'); return v; }
    var m = /^\d+(\.\d+)?/.exec(s.substr(pos));
    if (m) { pos += m[0].length; return Number(m[0]); }
    m = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(s.substr(pos));
    if (!m) fail(pos >= s.length ? 'فرمول ناقص است.' : 'کاراکتر نامعتبر در فرمول: «' + s.charAt(pos) + '»');
    pos += m[0].length;
    var id = m[0];
    if (eat('(')) {
      var args = [];
      if (!eat(')')) { do { args.push(cmp()); } while (eat(',')); if (!eat(')')) fail('پرانتز تابع بسته نشده است.'); }
      var low = id.toLowerCase();
      if (low === 'if') { if (args.length !== 3) fail('تابع if سه ورودی می‌خواهد.'); return args[0] ? args[1] : args[2]; }
      if (!FN[low]) fail('تابع «' + id + '» وجود ندارد.');
      if (!args.length) fail('تابع «' + id + '» ورودی ندارد.');
      return FN[low](args);
    }
    if (id === 'pi') return Math.PI;
    if (!V.hasOwnProperty(id) || isNaN(V[id])) fail('متغیر «' + id + '» تعریف نشده است.');
    return V[id];
  }
  var r = cmp(); ws();
  if (pos < s.length) fail('در فرمول کاراکتر اضافه است: «' + s.substr(pos, 6) + '»');
  if (!isFinite(r)) fail('نتیجه‌ی فرمول عدد معتبر نیست.');
  return r;
}
function fx_vars_(params, values, Q) {
  var v = {Q: Q};
  (params || []).forEach(function (pm) { var k = String(pm.key || ''); if (!k) return; var x = values && values[k] !== undefined && values[k] !== '' ? pr_num_(values[k]) : pr_num_(pm['default']); v[k] = x; });
  return v;
}

/* ---------- فرمول ساخت ---------- */
function prLoadRecipe_(co, id, needActive) {
  var r = pr_find_('Recipes', 'RecipeID', id, co, 'فرمول ساخت');
  if (needActive && String(r.IsActive) === 'false') throw new Error('این فرمول ساخت غیرفعال است.');
  var items = pr_by_('RecipeItems', 'RecipeID', id).sort(function (a, b) { return a.LineNo - b.LineNo; }),
      steps = pr_by_('RecipeSteps', 'RecipeID', id).sort(function (a, b) { return a.StepNo - b.StepNo; });
  return {recipe: r, params: pr_json_(r.Params, []), items: items, steps: steps.map(function (s) { s.Labor = pr_json_(s.Labor, []); s.Checks = pr_json_(s.Checks, []); return s; })};
}
function prRecipeFor_(co, pid) {
  var a = rows_('Recipes').filter(function (r) { return r.CompanyID === co && r.ProductID === pid && String(r.IsActive) !== 'false'; });
  a.sort(function (x, y) { return String(y.UpdatedAt) < String(x.UpdatedAt) ? -1 : 1; });
  return a[0] || null;
}
/* محاسبه‌ی مواد و دستمزد برنامه‌ریزی‌شده برای Q واحد خروجی */
function prPlan_(rec, Q, values) {
  var base = pr_num_(rec.recipe.OutputQty) || 1, vars = fx_vars_(rec.params, values, Q), k = Q / base, errs = [];
  var mats = rec.items.map(function (it, i) {
    var per = 0;
    try { per = fx_eval_(it.QtyFormula, vars); if (per < 0) throw new Error('مقدار منفی شد.'); } catch (e) { errs.push({line: i + 1, msg: e.message}); }
    var w = pr_num_(it.WastePct);
    return {ProductID: it.ProductID, PlannedQty: pr_r6_(per * k * (1 + w / 100)), StepNo: Number(it.StepNo) || 0, Notes: it.Notes || ''};
  });
  var steps = rec.steps.map(function (st, i) {
    var labor = (st.Labor || []).map(function (l, j) {
      var q = 0;
      try { q = fx_eval_(l.qty === undefined || l.qty === '' ? '0' : l.qty, vars); if (q < 0) throw new Error('مقدار منفی شد.'); } catch (e) { errs.push({line: 'مرحله ' + (i + 1) + ' - دستمزد ' + (j + 1), msg: e.message}); }
      return {serviceId: l.serviceId, qty: pr_r6_(q * k), rate: pr_num_(l.rate), desc: l.desc || ''};
    });
    return {StepNo: i + 1, Name: st.Name, WorkCenter: st.WorkCenter || '', StdMinutes: pr_num_(st.StdMinutes) * k, Instructions: st.Instructions || '', Labor: labor, Checks: (st.Checks || []).map(function (c) { var o = {}; Object.keys(c).forEach(function (x) { o[x] = c[x]; }); o.value = ''; return o; })};
  });
  return {materials: mats, steps: steps, errors: errs};
}

function prCheckRecipe_(co, p, forPreview) {
  var errs = [], out = {};
  var prod = null;
  try { prod = pr_prod_(co, p.ProductID, 'محصول خروجی'); } catch (e) { errs.push(e.message); }
  var base = pr_num_(p.OutputQty);
  if (!(base > 0)) errs.push('مقدار پایه‌ی خروجی باید بزرگ‌تر از صفر باشد.');
  var params = [], seen = {Q: 1};
  (p.Params || []).forEach(function (x, i) {
    var key = fx_norm_(String(x.key || '').trim());
    if (!key && !String(x.label || '').trim()) return;
    if (!key) key = fx_norm_(String(x.label).trim());
    if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(key)) { errs.push('نام متغیر ' + (i + 1) + ' فقط می‌تواند حرف، عدد و _ باشد (بدون فاصله).'); return; }
    if (seen[key]) { errs.push('نام متغیر «' + key + '» تکراری یا رزرو است (Q رزرو است).'); return; }
    seen[key] = 1; params.push({key: key, label: String(x.label || key), 'default': pr_num_(x['default']), unit: String(x.unit || '')});
  });
  var items = [], seenP = {};
  (p.items || []).forEach(function (x, i) {
    if (!x.ProductID && !String(x.QtyFormula || '').trim()) return;
    try { var pd = pr_prod_(co, x.ProductID, 'ماده‌ی ردیف ' + (i + 1)); if (x.ProductID === p.ProductID) errs.push('ردیف ' + (i + 1) + ': محصول خروجی نمی‌تواند ماده‌ی خودش باشد.'); } catch (e) { errs.push(e.message); }
    if (seenP[x.ProductID]) errs.push('ردیف ' + (i + 1) + ': این ماده قبلاً در فرمول آمده است؛ یک ردیف کافی است.'); seenP[x.ProductID] = 1;
    var w = pr_num_(x.WastePct); if (w < 0 || w > 1000) errs.push('ردیف ' + (i + 1) + ': درصد ضایعات نامعتبر است.');
    items.push({ProductID: x.ProductID, QtyFormula: String(x.QtyFormula || '').trim(), WastePct: w, StepNo: Number(x.StepNo) || 0, Notes: String(x.Notes || '')});
  });
  if (!items.length) errs.push('حداقل یک ماده برای فرمول لازم است.');
  var svc = {}; rows_('Services').forEach(function (s) { if (s.CompanyID === co) svc[s.ServiceID] = s.Name; });
  var ck = 0, steps = (p.steps || []).filter(function (s) { return String(s.Name || '').trim(); }).map(function (s, i) {
    var labor = (s.Labor || []).filter(function (l) { return l.serviceId || String(l.qty || '').trim(); }).map(function (l, j) {
      if (!svc[l.serviceId]) errs.push('مرحله ' + (i + 1) + ' - دستمزد ' + (j + 1) + ': خدمت انتخاب‌شده پیدا نشد.');
      return {serviceId: l.serviceId, qty: String(l.qty === undefined || l.qty === '' ? '1' : l.qty).trim(), rate: pr_num_(l.rate), desc: String(l.desc || '')};
    });
    var keys = {};
    var checks = (s.Checks || []).filter(function (c) { return String(c.label || '').trim(); }).map(function (c, j) {
      var type = ['number', 'yesno', 'choice', 'text'].indexOf(c.type) >= 0 ? c.type : 'number', key = String(c.key || ('c' + (++ck))).replace(/[^A-Za-z0-9_]/g, '') || ('c' + (++ck));
      if (keys[key]) key += '_' + j; keys[key] = 1;
      var o = {key: key, label: String(c.label).trim(), type: type, required: !!c.required, blocking: !!c.blocking, unit: String(c.unit || '')};
      if (type === 'number') { o.min = String(c.min === undefined || c.min === null ? '' : c.min).trim(); o.max = String(c.max === undefined || c.max === null ? '' : c.max).trim(); if ((o.min !== '' && isNaN(pr_num_(o.min))) || (o.max !== '' && isNaN(pr_num_(o.max)))) errs.push('مرحله ' + (i + 1) + ': حدود کنترل «' + o.label + '» عدد نیست.'); if (o.min !== '' && o.max !== '' && pr_num_(o.min) > pr_num_(o.max)) errs.push('مرحله ' + (i + 1) + ': کمینه‌ی «' + o.label + '» از بیشینه بزرگ‌تر است.'); }
      if (type === 'choice') { o.options = Array.isArray(c.options) ? c.options : String(c.options || '').split(/[,،\n]/).map(function (x) { return x.trim(); }).filter(Boolean); o.failOptions = Array.isArray(c.failOptions) ? c.failOptions : String(c.failOptions || '').split(/[,،\n]/).map(function (x) { return x.trim(); }).filter(Boolean); if (o.options.length < 2) errs.push('مرحله ' + (i + 1) + ': «' + o.label + '» باید حداقل دو گزینه داشته باشد.'); }
      return o;
    });
    return {Name: String(s.Name).trim(), WorkCenter: String(s.WorkCenter || '').trim(), StdMinutes: pr_num_(s.StdMinutes), Instructions: String(s.Instructions || ''), Labor: labor, Checks: checks};
  });
  items.forEach(function (it) { if (it.StepNo > steps.length) it.StepNo = 0; });
  out = {recipe: {ProductID: p.ProductID, Name: String(p.Name || (prod ? prod.Name : '')).trim(), OutputQty: base, IsActive: p.IsActive === false || p.IsActive === 'false' ? 'false' : 'true', Notes: String(p.Notes || ''), StdOverhead: pr_num_(p.StdOverhead)}, params: params, items: items, steps: steps};
  /* آزمون فرمول‌ها با مقدار پایه */
  if (!errs.length || forPreview) {
    var rec = {recipe: {OutputQty: base || 1}, params: params, items: items, steps: steps.map(function (s) { return {Name: s.Name, Labor: s.Labor, Checks: s.Checks}; })};
    var pl = prPlan_(rec, base || 1, {});
    pl.errors.forEach(function (e) { errs.push('خطای فرمول (' + e.line + '): ' + e.msg); });
  }
  return {errors: errs, data: out};
}
/* جلوگیری از فرمول بازگشتی (محصولی که برای ساخت خودش لازم باشد) */
function prCycle_(co, outPid, itemPids, exceptRecipe) {
  var g = {}, seen = {}, hit = false;
  rows_('Recipes').forEach(function (r) { if (r.CompanyID === co && r.RecipeID !== exceptRecipe && String(r.IsActive) !== 'false') (g[r.ProductID] = g[r.ProductID] || []).push(r.RecipeID); });
  var comp = {}; rows_('RecipeItems').forEach(function (it) { (comp[it.RecipeID] = comp[it.RecipeID] || []).push(it.ProductID); });
  var walk = function (pid, d) {
    if (hit || d > 12 || seen[pid]) return;
    seen[pid] = 1;
    if (pid === outPid) { hit = true; return; }
    (g[pid] || []).forEach(function (rid) { (comp[rid] || []).forEach(function (c) { walk(c, d + 1); }); });
  };
  itemPids.forEach(function (c) { seen = {}; walk(c, 0); });
  return hit;
}
function recipeSave_(p) {
  var co = p.company;
  return locked_(function () {
    var chk = prCheckRecipe_(co, p, false);
    if (chk.errors.length) throw new Error(chk.errors.join('\n'));
    var d = chk.data, id = p.RecipeID, now = nowStr_(), created = now;
    if (id) { var old = pr_find_('Recipes', 'RecipeID', id, co, 'فرمول ساخت'); created = old.CreatedAt || now; } else id = nextIds_('RCP', 1)[0];
    if (prCycle_(co, d.recipe.ProductID, d.items.map(function (x) { return x.ProductID; }), id)) throw new Error('فرمول بازگشتی است: یکی از مواد، خودش (به‌طور مستقیم یا با فرمول‌های دیگر) از همین محصول ساخته می‌شود.');
    var rec = {RecipeID: id, CompanyID: co, ProductID: d.recipe.ProductID, Name: d.recipe.Name, OutputQty: d.recipe.OutputQty, Params: JSON.stringify(d.params), IsActive: d.recipe.IsActive, Notes: d.recipe.Notes, StdOverhead: d.recipe.StdOverhead, CreatedAt: created, UpdatedAt: now};
    pr_setRow_('Recipes', 'RecipeID', id, rec);
    var ii = nextIds_('RIT', d.items.length), si = nextIds_('RST', d.steps.length);
    pr_replace_('RecipeItems', 'RecipeID', id, d.items.map(function (x, i) { return {RItemID: ii[i], RecipeID: id, LineNo: i + 1, ProductID: x.ProductID, QtyFormula: x.QtyFormula, WastePct: x.WastePct, StepNo: x.StepNo, Notes: x.Notes}; }));
    pr_replace_('RecipeSteps', 'RecipeID', id, d.steps.map(function (x, i) { return {RStepID: si[i], RecipeID: id, StepNo: i + 1, Name: x.Name, WorkCenter: x.WorkCenter, StdMinutes: x.StdMinutes, Instructions: x.Instructions, Labor: JSON.stringify(x.Labor), Checks: JSON.stringify(x.Checks)}; }));
    bump_();
    return {RecipeID: id};
  });
}
function recipeGet_(p) {
  var rec = prLoadRecipe_(p.company, p.id, false);
  return {recipe: rec.recipe, params: rec.params, items: rec.items, steps: rec.steps};
}
function recipeList_(p) {
  var co = p.company, prods = {}, n = {}, st = {}, used = {};
  rows_('Products').forEach(function (x) { if (x.CompanyID === co) prods[x.ProductID] = x; });
  rows_('RecipeItems').forEach(function (x) { n[x.RecipeID] = (n[x.RecipeID] || 0) + 1; });
  rows_('RecipeSteps').forEach(function (x) { st[x.RecipeID] = (st[x.RecipeID] || 0) + 1; });
  rows_('ProdOrders').forEach(function (x) { if (x.CompanyID === co) used[x.RecipeID] = (used[x.RecipeID] || 0) + 1; });
  var rows = rows_('Recipes').filter(function (r) { return r.CompanyID === co; }).map(function (r) {
    var pr = prods[r.ProductID] || {};
    return {RecipeID: r.RecipeID, Name: r.Name, ProductID: r.ProductID, Product: pr.Name || '؟', Unit: pr.DefaultUnit || '', OutputQty: Number(r.OutputQty) || 1, Active: String(r.IsActive) !== 'false', items: n[r.RecipeID] || 0, steps: st[r.RecipeID] || 0, orders: used[r.RecipeID] || 0, UpdatedAt: r.UpdatedAt};
  });
  rows.sort(function (a, b) { return String(a.Product) < String(b.Product) ? -1 : 1; });
  return {rows: rows};
}
function recipeDelete_(p) {
  return locked_(function () {
    pr_find_('Recipes', 'RecipeID', p.id, p.company, 'فرمول ساخت');
    if (pr_by_('ProdOrders', 'RecipeID', p.id).length) throw new Error('برای این فرمول سفارش تولید ثبت شده است و حذف نمی‌شود؛ آن را «غیرفعال» کنید.');
    delWhere_('RecipeItems', 2, function (v) { return v === p.id; });
    delWhere_('RecipeSteps', 2, function (v) { return v === p.id; });
    delWhere_('Recipes', 1, function (v) { return v === p.id; });
    bump_();
    return {deleted: 1};
  });
}

/* ---------- بهای مواد: میانگین موزون یا آخرین خرید (خرید + تولید داخلی) ---------- */
function prCostMap_(co, method) {
  var inv = {}, agg = {}, put = function (pid, q, c, d) {
    if (!pid || !(q > 0)) return;
    var a = agg[pid] || (agg[pid] = {q: 0, c: 0, d: '', u: 0});
    a.q += q; a.c += c;
    if (d >= a.d) { a.d = d; a.u = c / q; }
  };
  rows_('PurchaseInvoices').forEach(function (r) { if (r.CompanyID === co && r.DocType !== 'return') inv[r.InvoiceID] = String(r.DateGregorian || ''); });
  var pi = sl_cols_('PurchaseItems', ['InvoiceID', 'ProductID', 'Quantity', 'NetAfterDiscount']);
  for (var i = 0; i < pi.InvoiceID.length; i++) if (inv[pi.InvoiceID[i]] !== undefined) put(pi.ProductID[i], Number(pi.Quantity[i]) || 0, Number(pi.NetAfterDiscount[i]) || 0, inv[pi.InvoiceID[i]]);
  rows_('ProdOrders').forEach(function (o) { if (o.CompanyID === co && o.Status === PR_ST.done) put(o.ProductID, Number(o.ActualQty) || 0, Number(o.TotalCost) || 0, String(o.DoneDateGregorian || '')); });
  /* موجودی اولیه با بهای واحد مشخص‌شده در میانگین موزون حساب می‌شود (بدون بها = نادیده) */
  rows_('Products').forEach(function (pr) { if (pr.CompanyID === co) { var q = Number(pr.OpeningQty) || 0, c = Number(pr.OpeningCost) || 0; if (q > 0 && c > 0) put(pr.ProductID, q, q * c, ''); } });
  var m = {};
  Object.keys(agg).forEach(function (k) { m[k] = method === 'last' ? agg[k].u : agg[k].c / agg[k].q; });
  return m;
}
function prCostOrder_(co, mats, steps, ovh, cfg, cm) {
  cm = cm || prCostMap_(co, cfg.method);
  var mc = 0, lc = 0, oc = 0, missing = [];
  var lines = mats.map(function (m) {
    var qty = m.ActualQty === '' || m.ActualQty === undefined || m.ActualQty === null ? Number(m.PlannedQty) || 0 : Number(m.ActualQty) || 0, u = cm[m.ProductID];
    if (u === undefined) { u = 0; if (qty > 0) missing.push(m.ProductID); }
    var c = r2_(qty * u); mc += c;
    return {ProductID: m.ProductID, UnitCost: u, Cost: c};
  });
  steps.forEach(function (s) { (s.Labor || []).forEach(function (l) { lc += (Number(l.qty) || 0) * (Number(l.rate) || 0); }); });
  (ovh || []).forEach(function (o) { oc += Number(o.Amount) || 0; });
  return {lines: lines, material: r2_(mc), labor: r2_(lc), overhead: r2_(oc), total: r2_(mc + lc + oc), missing: missing};
}

/* ---------- فاکتور هزینه (سربار) ---------- */
function prExpAlloc_(co) {
  var open = {}, ord = {};
  rows_('ProdOrders').forEach(function (o) { if (o.CompanyID === co && o.Status !== PR_ST.cancel) ord[o.OrderID] = o; });
  var a = {};
  rows_('ProdOverheads').forEach(function (x) { if (x.ExpenseID && ord[x.OrderID]) a[x.ExpenseID] = (a[x.ExpenseID] || 0) + (Number(x.Amount) || 0); });
  return a;
}
function expenseList_(p) {
  var co = p.company, al = prExpAlloc_(co), sup = {}, g1 = p.from ? parseJ_(p.from) : null, g2 = p.to ? parseJ_(p.to) : null;
  rows_('Suppliers').forEach(function (s) { if (s.CompanyID === co) sup[s.SupplierID] = s.Name; });
  var pm = bk_paidMap_(co, 'expense');
  var rows = rows_('ExpenseInvoices').filter(function (r) {
    if (r.CompanyID !== co) return false;
    if (p.category && r.Category !== p.category) return false;
    if (g1 && r.DateGregorian < g1.g) return false;
    if (g2 && r.DateGregorian > g2.g) return false;
    return true;
  }).map(function (r) {
    var base = Number(r.CostBase) || 0, a = r2_(al[r.ExpenseID] || 0);
    return {ExpenseID: r.ExpenseID, DocNo: r.DocNo, DateJalali: r.DateJalali, SupplierID: r.SupplierID, Supplier: sup[r.SupplierID] || '', Payee: r.Payee, Category: r.Category, Description: r.Description, Amount: Number(r.Amount) || 0, VAT: Number(r.VAT) || 0, VATInCost: String(r.VATInCost) === 'true', CostBase: base, Allocated: a, Remaining: r2_(base - a), Notes: r.Notes, DateGregorian: r.DateGregorian, Paid: pm[r.ExpenseID] || 0, PayRemain: r2_((Number(r.Amount) || 0) + (Number(r.VAT) || 0) - (pm[r.ExpenseID] || 0))};
  });
  if (p.open) rows = rows.filter(function (r) { return r.Remaining > 0.005; });
  rows.sort(function (a, b) { return a.DateGregorian < b.DateGregorian ? 1 : (a.DateGregorian > b.DateGregorian ? -1 : 0); });
  var T = {count: rows.length, amount: 0, base: 0, allocated: 0, remaining: 0};
  rows.forEach(function (r) { T.amount += r.Amount; T.base += r.CostBase; T.allocated += r.Allocated; T.remaining += r.Remaining; });
  Object.keys(T).forEach(function (k) { T[k] = r2_(T[k]); });
  return {rows: rows, totals: T};
}
function expenseSave_(p) {
  var co = p.company;
  return locked_(function () {
    var j = parseJ_(p.DateJalali); if (!j) throw new Error('تاریخ شمسی نامعتبر است (قالب: 1405/07/09).');
    var amount = pr_num_(p.Amount), vat = pr_num_(p.VAT), cat = String(p.Category || '').trim();
    if (!(amount > 0)) throw new Error('مبلغ هزینه باید بزرگ‌تر از صفر باشد.');
    if (vat < 0) throw new Error('مالیات نامعتبر است.');
    if (!cat) throw new Error('نوع هزینه را انتخاب کنید.');
    if (!String(p.DocNo || '').trim()) throw new Error('شماره فاکتور هزینه الزامی است.');
    if (p.SupplierID) pr_find_('Suppliers', 'SupplierID', p.SupplierID, co, 'فروشنده');
    var vic = p.VATInCost === true || p.VATInCost === 'true', base = r2_(amount + (vic ? vat : 0)), id = p.ExpenseID, now = nowStr_(), created = now;
    var dup = rows_('ExpenseInvoices').filter(function (r) { return r.CompanyID === co && normNo_(r.DocNo) === normNo_(p.DocNo) && String(r.SupplierID || '') === String(p.SupplierID || '') && String(r.Payee || '') === String(p.Payee || '').trim() && r.ExpenseID !== id; });
    if (dup.length) throw new Error('فاکتور هزینه با همین شماره و طرف‌حساب قبلاً ثبت شده است.');
    if (id) {
      var old = pr_find_('ExpenseInvoices', 'ExpenseID', id, co, 'فاکتور هزینه'); created = old.CreatedAt || now;
      var al = prExpAlloc_(co)[id] || 0;
      var pd = bk_paidMap_(co, 'expense')[id] || 0;
      if (amount + vat + 0.005 < pd) throw new Error('مبلغ فاکتور (با مالیات) نمی‌تواند کمتر از پرداخت‌های ثبت‌شده (' + Math.round(pd) + ') باشد؛ ابتدا پرداخت‌ها را اصلاح کنید.');
      if (base + 1e-9 < al) throw new Error('از این فاکتور ' + Math.round(al) + ' ریال به سفارش‌های تولید تخصیص داده شده است؛ مبلغ مبنای هزینه نمی‌تواند کمتر از آن باشد.');
    } else id = nextIds_('EXP', 1)[0];
    pr_setRow_('ExpenseInvoices', 'ExpenseID', id, {ExpenseID: id, CompanyID: co, DocNo: String(p.DocNo).trim(), DateJalali: j.j, DateGregorian: j.g, SupplierID: p.SupplierID || '', Payee: String(p.Payee || '').trim(), Category: cat, Description: String(p.Description || '').trim(), Amount: amount, VAT: vat, VATInCost: vic ? 'true' : 'false', CostBase: base, Notes: String(p.Notes || ''), CreatedAt: created, UpdatedAt: now});
    if (p.ExpenseID && rows_('DocPayments').some(function (y) { return y.DocType === 'expense' && y.DocID === id; })) bk_resyncDoc_(co, 'expense', id);
    bump_();
    return {ExpenseID: id};
  });
}
function expenseDelete_(p) {
  return locked_(function () {
    pr_find_('ExpenseInvoices', 'ExpenseID', p.id, p.company, 'فاکتور هزینه');
    if ((prExpAlloc_(p.company)[p.id] || 0) > 0) throw new Error('بخشی از این فاکتور به سفارش تولید تخصیص داده شده است؛ ابتدا آن را از سفارش بردارید.');
    bk_dropDoc_('expense', p.id);
    delWhere_('ExpenseInvoices', 1, function (v) { return v === p.id; });
    bump_();
    return {deleted: 1};
  });
}

/* ---------- موجودی، کمبود و پیش‌بینی ---------- */
function stBal_(o) { return (o.opening || 0) + o.purchased - (o.retPurch || 0) - o.sold + o.returned + (o.produced || 0) - (o.consumed || 0) + (o.adj || 0) - (o.issued || 0) + (o.issueRet || 0); }
function prIncoming_(co) {
  var m = {};
  rows_('ProdOrders').forEach(function (o) { if (o.CompanyID === co && (o.Status === PR_ST.draft || o.Status === PR_ST.run)) m[o.ProductID] = (m[o.ProductID] || 0) + (Number(o.PlannedQty) || 0); });
  return m;
}
function prOpenOrderNos_(co, pid, saleId) {
  return rows_('ProdOrders').filter(function (o) { return o.CompanyID === co && o.ProductID === pid && (o.Status === PR_ST.draft || o.Status === PR_ST.run) && (!saleId || o.SaleID === saleId); }).map(function (o) { return o.OrderNo; });
}
/* کمبود محصولاتی که فرمول ساخت دارند؛ items=[{ProductID, qty}] و موجودی فعلی شامل همین فروش است */
function prShortage_(co, items) {
  var need = {};
  items.forEach(function (l) { if (l.ProductID) need[l.ProductID] = (need[l.ProductID] || 0) + (Number(l.qty) || 0); });
  var pids = Object.keys(need);
  if (!pids.length) return [];
  var withRec = {};
  rows_('Recipes').forEach(function (r) { if (r.CompanyID === co && String(r.IsActive) !== 'false') withRec[r.ProductID] = r; });
  pids = pids.filter(function (x) { return withRec[x]; });
  if (!pids.length) return [];
  var m = stockMap_(co), inc = prIncoming_(co), names = {};
  rows_('Products').forEach(function (x) { if (x.CompanyID === co) names[x.ProductID] = x; });
  var out = [];
  pids.forEach(function (pid) {
    var bal = m[pid] ? stBal_(m[pid]) : 0, short = Math.min(need[pid], -bal - (inc[pid] || 0));
    if (short > 1e-9) out.push({ProductID: pid, Name: (names[pid] || {}).Name || pid, Unit: (names[pid] || {}).DefaultUnit || '', need: pr_r6_(need[pid]), balance: pr_r6_(bal), incoming: pr_r6_(inc[pid] || 0), short: pr_r6_(short), RecipeID: withRec[pid].RecipeID, RecipeName: withRec[pid].Name});
  });
  return out;
}
function prSaleShortage_(co, items, ins) {
  if (Number(ins) !== 1 && Number(ins) !== 2) return [];
  try { return prShortage_(co, (items || []).map(function (l) { return {ProductID: l.ProductID, qty: sl_n_(l.Am)}; })); } catch (e) { return []; }
}

/* ---------- سفارش تولید ---------- */
function prNextNo_(co, cfg) {
  var k = 'ordno_' + co, n = (Number(getSet_(k)) || 0) + 1;
  setSet_(k, n);
  return cfg.prefix + '-' + ('0000' + n).slice(-4);
}
function prCreate_(co, a, depth, chain) {
  var cfg = prCfg_(co), rec = prLoadRecipe_(co, a.recipeId, true), Q = pr_num_(a.qty);
  if (!(Q > 0)) throw new Error('مقدار تولید باید بزرگ‌تر از صفر باشد.');
  var d = a.date ? parseJ_(a.date) : parseJ_(pr_today_());
  if (!d) throw new Error('تاریخ شمسی نامعتبر است.');
  var plan = prPlan_(rec, Q, a.params || {});
  if (plan.errors.length) throw new Error('خطا در فرمول ساخت: ' + plan.errors.map(function (e) { return e.line + ': ' + e.msg; }).join(' | '));
  var id = nextIds_('ORD', 1)[0], no = prNextNo_(co, cfg), now = nowStr_();
  var defOvh = pr_num_(rec.recipe.StdOverhead) * Q, ovh = [];
  if (defOvh > 0) ovh.push({Kind: 'manual', ExpenseID: '', Description: 'سربار استاندارد فرمول', Amount: r2_(defOvh)});
  var cost = prCostOrder_(co, plan.materials, plan.steps, ovh, cfg);
  var head = {OrderID: id, CompanyID: co, OrderNo: no, DateJalali: d.j, DateGregorian: d.g, RecipeID: a.recipeId, ProductID: rec.recipe.ProductID, PlannedQty: Q, ActualQty: '', Status: PR_ST.draft, SaleID: a.saleId || '', ParentOrderID: a.parentId || '', Params: JSON.stringify(a.params || {}), Extra: JSON.stringify(a.extra || {}), MaterialCost: cost.material, LaborCost: cost.labor, OverheadCost: cost.overhead, TotalCost: cost.total, UnitCost: r2_(cost.total / Q), Notes: a.notes || '', CreatedAt: now, UpdatedAt: now, StartedAt: '', CompletedAt: '', DoneDateGregorian: '', DoneJalali: ''};
  pr_setRow_('ProdOrders', 'OrderID', id, head);
  var mi = nextIds_('PMT', plan.materials.length), si = nextIds_('PST', plan.steps.length), oi = nextIds_('POH', ovh.length);
  pr_replace_('ProdMaterials', 'OrderID', id, plan.materials.map(function (m, i) { return {PMID: mi[i], OrderID: id, LineNo: i + 1, ProductID: m.ProductID, PlannedQty: m.PlannedQty, ActualQty: '', UnitCost: cost.lines[i].UnitCost, Cost: cost.lines[i].Cost, StepNo: m.StepNo, Notes: m.Notes}; }));
  pr_replace_('ProdSteps', 'OrderID', id, plan.steps.map(function (s, i) { return {PSID: si[i], OrderID: id, StepNo: i + 1, Name: s.Name, WorkCenter: s.WorkCenter, Status: 'در انتظار', StdMinutes: r2_(s.StdMinutes), ActualMinutes: '', StartedAt: '', DoneAt: '', Labor: JSON.stringify(s.Labor), Checks: JSON.stringify(s.Checks), Notes: '', Instructions: s.Instructions}; }));
  pr_replace_('ProdOverheads', 'OrderID', id, ovh.map(function (o, i) { return {POID: oi[i], OrderID: id, LineNo: i + 1, Kind: o.Kind, ExpenseID: o.ExpenseID, Description: o.Description, Amount: o.Amount}; }));
  var res = {OrderID: id, OrderNo: no, children: []};
  /* نیمه‌ساخته‌های کم‌موجودی: سفارش زیرمجموعه (چندسطحی) */
  chain = (chain || []).concat([rec.recipe.ProductID]);
  if ((depth || 0) < 5 && a.children !== false) {
    var m = stockMap_(co), inc = prIncoming_(co);
    plan.materials.forEach(function (mt) {
      if (chain.indexOf(mt.ProductID) >= 0) return;
      var sub = prRecipeFor_(co, mt.ProductID);
      if (!sub) return;
      var bal = m[mt.ProductID] ? stBal_(m[mt.ProductID]) : 0, short = mt.PlannedQty - Math.max(0, bal) - (inc[mt.ProductID] || 0);
      if (short > 1e-9) { var ch = prCreate_(co, {recipeId: sub.RecipeID, qty: pr_r6_(short), parentId: id, saleId: a.saleId, date: d.j}, (depth || 0) + 1, chain); res.children.push(ch); inc[mt.ProductID] = (inc[mt.ProductID] || 0) + short; }
    });
  }
  return res;
}
function prodCreate_(p) {
  return locked_(function () { var r = prCreate_(p.company, p, 0, []); bump_(); return r; });
}
function prodFromSale_(p) {
  var co = p.company;
  return locked_(function () {
    var sale = pr_find_('SalesInvoices', 'SaleID', p.saleId, co, 'فاکتور فروش');
    var items = pr_by_('SalesItems', 'SaleID', p.saleId).map(function (it) { return {ProductID: it.ProductID, qty: Number(it.Am) || 0}; });
    var sh = prShortage_(co, items), out = {created: [], skipped: []};
    sh.forEach(function (x) {
      var r = prCreate_(co, {recipeId: x.RecipeID, qty: x.short, saleId: p.saleId}, 0, []);
      out.created.push({OrderID: r.OrderID, OrderNo: r.OrderNo, ProductID: x.ProductID, Name: x.Name, qty: x.short, children: r.children.length});
    });
    bump_();
    out.serial = sale.SerialNo;
    return out;
  });
}
function prChecksEval_(checks) {
  /* وضعیت هر کنترل: ok / fail / missing */
  return (checks || []).map(function (c) {
    var v = c.value === undefined || c.value === null ? '' : String(c.value).trim(), st = 'ok';
    if (v === '') st = c.required ? 'missing' : 'empty';
    else if (c.type === 'number') {
      var n = pr_num_(v);
      if (isNaN(n)) st = 'fail';
      else if ((String(c.min) !== '' && c.min !== undefined && n < pr_num_(c.min)) || (String(c.max) !== '' && c.max !== undefined && n > pr_num_(c.max))) st = 'fail';
    } else if (c.type === 'yesno') st = v === 'yes' ? 'ok' : 'fail';
    else if (c.type === 'choice') st = (c.failOptions || []).indexOf(v) >= 0 ? 'fail' : 'ok';
    var o = {}; Object.keys(c).forEach(function (k) { o[k] = c[k]; }); o.state = st; return o;
  });
}
function prLoadOrder_(co, id) {
  var o = pr_find_('ProdOrders', 'OrderID', id, co, 'سفارش تولید');
  var mats = pr_by_('ProdMaterials', 'OrderID', id).sort(function (a, b) { return a.LineNo - b.LineNo; }),
      steps = pr_by_('ProdSteps', 'OrderID', id).sort(function (a, b) { return a.StepNo - b.StepNo; }).map(function (s) { s.Labor = pr_json_(s.Labor, []); s.Checks = pr_json_(s.Checks, []); return s; }),
      ovh = pr_by_('ProdOverheads', 'OrderID', id).sort(function (a, b) { return a.LineNo - b.LineNo; });
  return {order: o, mats: mats, steps: steps, ovh: ovh};
}
function prodGet_(p) {
  var co = p.company, L = prLoadOrder_(co, p.id), cfg = prCfg_(co), o = L.order;
  var prods = {}, svc = {}, exp = {}, m = stockMap_(co);
  rows_('Products').forEach(function (x) { if (x.CompanyID === co) prods[x.ProductID] = x; });
  rows_('Services').forEach(function (x) { if (x.CompanyID === co) svc[x.ServiceID] = x.Name; });
  rows_('ExpenseInvoices').forEach(function (x) { if (x.CompanyID === co) exp[x.ExpenseID] = x; });
  var editable = o.Status === PR_ST.draft || o.Status === PR_ST.run;
  var cost = prCostOrder_(co, L.mats, L.steps, L.ovh, cfg);
  var isDone = o.Status === PR_ST.done;
  var mats = L.mats.map(function (x, i) {
    var pr = prods[x.ProductID] || {}, bal = m[x.ProductID] ? stBal_(m[x.ProductID]) : 0, need = x.ActualQty === '' ? Number(x.PlannedQty) || 0 : Number(x.ActualQty) || 0, rc = prRecipeFor_(co, x.ProductID);
    /* در سفارش تکمیل‌شده موجودی فعلی شامل مصرف همین سفارش است؛ برای نمایش کمبود، مصرف آن را برمی‌گردانیم */
    var avail = isDone ? bal + need : bal;
    return {ProductID: x.ProductID, Name: pr.Name || '؟', Unit: pr.DefaultUnit || '', PlannedQty: Number(x.PlannedQty) || 0, ActualQty: x.ActualQty === '' ? '' : Number(x.ActualQty), StepNo: Number(x.StepNo) || 0, Notes: x.Notes, UnitCost: isDone ? Number(x.UnitCost) || 0 : cost.lines[i].UnitCost, Cost: isDone ? Number(x.Cost) || 0 : cost.lines[i].Cost, balance: pr_r6_(avail), short: editable && avail < need - 1e-9 ? pr_r6_(need - avail) : 0, hasRecipe: !!rc, recipeId: rc ? rc.RecipeID : ''};
  });
  var steps = L.steps.map(function (s) {
    var labor = (s.Labor || []).map(function (l) { return {serviceId: l.serviceId, name: svc[l.serviceId] || '؟', qty: Number(l.qty) || 0, rate: Number(l.rate) || 0, desc: l.desc || '', cost: r2_((Number(l.qty) || 0) * (Number(l.rate) || 0))}; });
    return {StepNo: Number(s.StepNo), Name: s.Name, WorkCenter: s.WorkCenter, Status: s.Status, StdMinutes: Number(s.StdMinutes) || 0, ActualMinutes: s.ActualMinutes === '' ? '' : Number(s.ActualMinutes), StartedAt: s.StartedAt, DoneAt: s.DoneAt, Instructions: s.Instructions, Notes: s.Notes, Labor: labor, Checks: prChecksEval_(s.Checks)};
  });
  var ovh = L.ovh.map(function (x) { var e = exp[x.ExpenseID]; return {Kind: x.Kind, ExpenseID: x.ExpenseID, Description: x.Description, Amount: Number(x.Amount) || 0, DocNo: e ? e.DocNo : '', Category: e ? e.Category : ''}; });
  var rec = null; try { rec = prLoadRecipe_(co, o.RecipeID, false); } catch (e) {}
  var children = rows_('ProdOrders').filter(function (x) { return x.CompanyID === co && x.ParentOrderID === o.OrderID; }).map(function (x) { return {OrderID: x.OrderID, OrderNo: x.OrderNo, Product: (prods[x.ProductID] || {}).Name || '', Qty: Number(x.PlannedQty) || 0, Status: x.Status}; });
  var parent = o.ParentOrderID ? rows_('ProdOrders').filter(function (x) { return x.OrderID === o.ParentOrderID; })[0] : null;
  var sale = o.SaleID ? rows_('SalesInvoices').filter(function (x) { return x.SaleID === o.SaleID; })[0] : null;
  var pr0 = prods[o.ProductID] || {};
  return {
    order: {OrderID: o.OrderID, OrderNo: o.OrderNo, DateJalali: o.DateJalali, RecipeID: o.RecipeID, RecipeName: rec ? rec.recipe.Name : '', ProductID: o.ProductID, Product: pr0.Name || '؟', Unit: pr0.DefaultUnit || '', PlannedQty: Number(o.PlannedQty) || 0, ActualQty: o.ActualQty === '' ? '' : Number(o.ActualQty), Status: o.Status, SaleID: o.SaleID, SaleSerial: sale ? sale.SerialNo : '', ParentOrderID: o.ParentOrderID, ParentNo: parent ? parent.OrderNo : '', Params: pr_json_(o.Params, {}), Extra: pr_json_(o.Extra, {}), Notes: o.Notes, StartedAt: o.StartedAt, CompletedAt: o.CompletedAt, DoneJalali: o.DoneJalali, editable: editable},
    recipeParams: rec ? rec.params : [], materials: mats, steps: steps, overheads: ovh, children: children, cfg: cfg,
    cost: isDone ? {material: Number(o.MaterialCost) || 0, labor: Number(o.LaborCost) || 0, overhead: Number(o.OverheadCost) || 0, total: Number(o.TotalCost) || 0, unit: Number(o.UnitCost) || 0, missing: []} : {material: cost.material, labor: cost.labor, overhead: cost.overhead, total: cost.total, unit: r2_(cost.total / ((o.ActualQty !== '' && Number(o.ActualQty) > 0) ? Number(o.ActualQty) : (Number(o.PlannedQty) || 1))), missing: cost.missing.map(function (id) { return (prods[id] || {}).Name || id; })}
  };
}
function prodList_(p) {
  var co = p.company, prods = {}, sale = {}, par = {}, g1 = p.from ? parseJ_(p.from) : null, g2 = p.to ? parseJ_(p.to) : null;
  rows_('Products').forEach(function (x) { if (x.CompanyID === co) prods[x.ProductID] = x; });
  rows_('SalesInvoices').forEach(function (x) { if (x.CompanyID === co) sale[x.SaleID] = x.SerialNo; });
  var all = rows_('ProdOrders').filter(function (o) { return o.CompanyID === co; });
  all.forEach(function (o) { par[o.OrderID] = o.OrderNo; });
  var stc = {}, tot = {draft: 0, run: 0, done: 0, cancel: 0, doneQty: 0, doneCost: 0}, totSteps = {}, doneSteps = {};
  rows_('ProdSteps').forEach(function (s) { totSteps[s.OrderID] = (totSteps[s.OrderID] || 0) + 1; if (s.Status === 'انجام شد') doneSteps[s.OrderID] = (doneSteps[s.OrderID] || 0) + 1; });
  all.forEach(function (o) { var k = o.Status === PR_ST.draft ? 'draft' : o.Status === PR_ST.run ? 'run' : o.Status === PR_ST.done ? 'done' : 'cancel'; tot[k]++; });
  var q = nn_(p.q || '');
  var rows = all.filter(function (o) {
    if (p.status && o.Status !== p.status) return false;
    if (p.product && o.ProductID !== p.product) return false;
    if (p.saleId && o.SaleID !== p.saleId) return false;
    if (g1 && o.DateGregorian < g1.g) return false;
    if (g2 && o.DateGregorian > g2.g) return false;
    if (q && nn_(o.OrderNo + ' ' + ((prods[o.ProductID] || {}).Name || '')).indexOf(q) < 0) return false;
    return true;
  }).map(function (o) {
    var pr = prods[o.ProductID] || {};
    return {OrderID: o.OrderID, OrderNo: o.OrderNo, DateJalali: o.DateJalali, Product: pr.Name || '؟', Unit: pr.DefaultUnit || '', PlannedQty: Number(o.PlannedQty) || 0, ActualQty: o.ActualQty === '' ? '' : Number(o.ActualQty), Status: o.Status, steps: totSteps[o.OrderID] || 0, stepsDone: doneSteps[o.OrderID] || 0, UnitCost: Number(o.UnitCost) || 0, TotalCost: Number(o.TotalCost) || 0, SaleSerial: sale[o.SaleID] || '', ParentNo: par[o.ParentOrderID] || '', DateGregorian: o.DateGregorian};
  });
  rows.sort(function (a, b) { return a.DateGregorian < b.DateGregorian ? 1 : (a.DateGregorian > b.DateGregorian ? -1 : (a.OrderNo < b.OrderNo ? 1 : -1)); });
  rows.forEach(function (r) { if (r.Status === PR_ST.done) { tot.doneQty += Number(r.ActualQty) || 0; tot.doneCost += r.TotalCost; } });
  tot.doneCost = r2_(tot.doneCost);
  return {rows: rows, kpi: tot, shown: rows.length};
}

function prodSave_(p) {
  var co = p.company;
  return locked_(function () {
    var L = prLoadOrder_(co, p.OrderID), o = L.order, cfg = prCfg_(co);
    if (o.Status !== PR_ST.draft && o.Status !== PR_ST.run) throw new Error('سفارش «' + o.Status + '» قابل ویرایش نیست.');
    var d = parseJ_(p.DateJalali || o.DateJalali); if (!d) throw new Error('تاریخ شمسی نامعتبر است.');
    var planned = pr_num_(p.PlannedQty === undefined ? o.PlannedQty : p.PlannedQty);
    if (!(planned > 0)) throw new Error('مقدار برنامه‌ریزی‌شده باید بزرگ‌تر از صفر باشد.');
    var actual = p.ActualQty === undefined ? o.ActualQty : p.ActualQty;
    if (actual !== '' && actual !== null && !(pr_num_(actual) >= 0)) throw new Error('مقدار تولید واقعی نامعتبر است.');
    var params = p.Params || pr_json_(o.Params, {}), extra = p.Extra || pr_json_(o.Extra, {});
    var recipeChanged = false, mats, steps;
    if (p.recompute) {
      var rec = prLoadRecipe_(co, o.RecipeID, false), pl = prPlan_(rec, planned, params);
      if (pl.errors.length) throw new Error('خطا در فرمول ساخت: ' + pl.errors.map(function (e) { return e.line + ': ' + e.msg; }).join(' | '));
      mats = pl.materials.map(function (m, i) { return {ProductID: m.ProductID, PlannedQty: m.PlannedQty, ActualQty: '', StepNo: m.StepNo, Notes: m.Notes}; });
      var oldSteps = {}; L.steps.forEach(function (s) { oldSteps[s.StepNo] = s; });
      steps = pl.steps.map(function (s, i) {
        var prev = oldSteps[i + 1];
        return {StepNo: i + 1, Name: s.Name, WorkCenter: s.WorkCenter, Status: prev ? prev.Status : 'در انتظار', StdMinutes: r2_(s.StdMinutes), ActualMinutes: prev ? prev.ActualMinutes : '', StartedAt: prev ? prev.StartedAt : '', DoneAt: prev ? prev.DoneAt : '', Labor: s.Labor, Checks: s.Checks.map(function (c) { var pc = prev && prev.Checks.filter(function (x) { return x.key === c.key; })[0]; if (pc) c.value = pc.value; return c; }), Notes: prev ? prev.Notes : '', Instructions: s.Instructions};
      });
    } else {
      var ids = {}; L.mats.forEach(function (m) { ids[m.ProductID] = 1; });
      mats = (p.materials || L.mats).map(function (m, i) {
        pr_prod_(co, m.ProductID, 'ماده‌ی ردیف ' + (i + 1));
        var pq = pr_num_(m.PlannedQty), aq = m.ActualQty === '' || m.ActualQty === null || m.ActualQty === undefined ? '' : pr_num_(m.ActualQty);
        if (pq < 0 || (aq !== '' && aq < 0)) throw new Error('مقدار ماده‌ی ردیف ' + (i + 1) + ' نامعتبر است.');
        return {ProductID: m.ProductID, PlannedQty: pr_r6_(pq), ActualQty: aq === '' ? '' : pr_r6_(aq), StepNo: Number(m.StepNo) || 0, Notes: String(m.Notes || '')};
      });
      if (!mats.length) throw new Error('حداقل یک ماده‌ی مصرفی لازم است.');
      steps = (p.steps || L.steps).map(function (s, i) {
        var st = ['در انتظار', 'در حال انجام', 'انجام شد'].indexOf(s.Status) >= 0 ? s.Status : 'در انتظار';
        var labor = (s.Labor || []).map(function (l, j) {
          if (l.serviceId) pr_find_('Services', 'ServiceID', l.serviceId, co, 'خدمت');
          var q = pr_num_(l.qty), r = pr_num_(l.rate); if (q < 0 || r < 0) throw new Error('مرحله ' + (i + 1) + ' - دستمزد ' + (j + 1) + ': مقدار یا نرخ منفی است.');
          return {serviceId: l.serviceId || '', qty: pr_r6_(q), rate: r, desc: String(l.desc || '')};
        });
        var checks = prChecksEval_(s.Checks || []);
        if (st === 'انجام شد') checks.forEach(function (c) { if (c.state === 'missing') throw new Error('مرحله ' + (i + 1) + ' (' + s.Name + '): کنترل «' + c.label + '» الزامی است و مقدار ندارد.'); });
        var now = nowStr_(), prev = L.steps.filter(function (x) { return Number(x.StepNo) === Number(s.StepNo); })[0] || {};
        var startedAt = prev.StartedAt || (st !== 'در انتظار' ? now : ''), doneAt = st === 'انجام شد' ? (prev.DoneAt || now) : '';
        return {StepNo: i + 1, Name: String(s.Name || ''), WorkCenter: String(s.WorkCenter || ''), Status: st, StdMinutes: pr_num_(s.StdMinutes), ActualMinutes: s.ActualMinutes === '' || s.ActualMinutes === undefined ? '' : pr_num_(s.ActualMinutes), StartedAt: startedAt, DoneAt: doneAt, Labor: labor, Checks: checks.map(function (c) { delete c.state; return c; }), Notes: String(s.Notes || ''), Instructions: String(s.Instructions || '')};
      });
    }
    var ovh = [], expAvail = {};
    var al = prExpAlloc_(co), mine = {};
    L.ovh.forEach(function (x) { if (x.ExpenseID) mine[x.ExpenseID] = (mine[x.ExpenseID] || 0) + (Number(x.Amount) || 0); });
    var expRows = {}; rows_('ExpenseInvoices').forEach(function (x) { if (x.CompanyID === co) expRows[x.ExpenseID] = x; });
    var used = {};
    (p.overheads === undefined ? L.ovh : p.overheads).forEach(function (x, i) {
      var amt = pr_num_(x.Amount);
      if (!(amt > 0)) return;
      var kind = x.ExpenseID ? 'expense' : 'manual';
      if (kind === 'expense') {
        var e = expRows[x.ExpenseID]; if (!e) throw new Error('سربار ' + (i + 1) + ': فاکتور هزینه پیدا نشد.');
        used[x.ExpenseID] = (used[x.ExpenseID] || 0) + amt;
        var free = (Number(e.CostBase) || 0) - ((al[x.ExpenseID] || 0) - (mine[x.ExpenseID] || 0));
        if (used[x.ExpenseID] > free + 1e-6) throw new Error('سربار ' + (i + 1) + ': از فاکتور هزینه‌ی ' + e.DocNo + ' فقط ' + Math.round(free) + ' ریال قابل تخصیص مانده است.');
      }
      ovh.push({Kind: kind, ExpenseID: kind === 'expense' ? x.ExpenseID : '', Description: String(x.Description || ''), Amount: r2_(amt)});
    });
    var cost = prCostOrder_(co, mats, steps, ovh, cfg);
    var qdiv = actual !== '' && pr_num_(actual) > 0 ? pr_num_(actual) : planned;
    var now2 = nowStr_();
    var head = Object.assign({}, o, {DateJalali: d.j, DateGregorian: d.g, PlannedQty: planned, ActualQty: actual === '' || actual === null ? '' : pr_num_(actual), Params: JSON.stringify(params), Extra: JSON.stringify(extra), Notes: p.Notes === undefined ? o.Notes : String(p.Notes || ''), MaterialCost: cost.material, LaborCost: cost.labor, OverheadCost: cost.overhead, TotalCost: cost.total, UnitCost: r2_(cost.total / qdiv), UpdatedAt: now2});
    pr_setRow_('ProdOrders', 'OrderID', o.OrderID, head);
    var mi = nextIds_('PMT', mats.length), si = nextIds_('PST', steps.length), oi = nextIds_('POH', ovh.length);
    pr_replace_('ProdMaterials', 'OrderID', o.OrderID, mats.map(function (m, i) { return {PMID: mi[i], OrderID: o.OrderID, LineNo: i + 1, ProductID: m.ProductID, PlannedQty: m.PlannedQty, ActualQty: m.ActualQty, UnitCost: cost.lines[i].UnitCost, Cost: cost.lines[i].Cost, StepNo: m.StepNo, Notes: m.Notes}; }));
    pr_replace_('ProdSteps', 'OrderID', o.OrderID, steps.map(function (s, i) { return {PSID: si[i], OrderID: o.OrderID, StepNo: i + 1, Name: s.Name, WorkCenter: s.WorkCenter, Status: s.Status, StdMinutes: s.StdMinutes, ActualMinutes: s.ActualMinutes, StartedAt: s.StartedAt, DoneAt: s.DoneAt, Labor: JSON.stringify(s.Labor), Checks: JSON.stringify(s.Checks), Notes: s.Notes, Instructions: s.Instructions}; }));
    pr_replace_('ProdOverheads', 'OrderID', o.OrderID, ovh.map(function (x, i) { return {POID: oi[i], OrderID: o.OrderID, LineNo: i + 1, Kind: x.Kind, ExpenseID: x.ExpenseID, Description: x.Description, Amount: x.Amount}; }));
    /* سفارش در حال تولید با اولین مرحله‌ی انجام‌شده/جاری */
    bump_();
    return {saved: 1, cost: {material: cost.material, labor: cost.labor, overhead: cost.overhead, total: cost.total}, missing: cost.missing.length};
  });
}

function prodStatus_(p) {
  var co = p.company;
  return locked_(function () {
    var L = prLoadOrder_(co, p.id), o = L.order, to = p.to, now = nowStr_(), cfg = prCfg_(co), warns = [];
    var setHead = function (patch) { pr_setRow_('ProdOrders', 'OrderID', o.OrderID, Object.assign({}, o, patch, {UpdatedAt: now})); };
    if (to === 'start') {
      if (o.Status !== PR_ST.draft) throw new Error('فقط سفارش «پیش‌نویس» شروع می‌شود.');
      setHead({Status: PR_ST.run, StartedAt: now});
    } else if (to === 'cancel') {
      if (o.Status !== PR_ST.draft && o.Status !== PR_ST.run) throw new Error('فقط سفارش پیش‌نویس یا در حال تولید لغو می‌شود (سفارش تکمیل‌شده را ابتدا «بازگشایی» کنید).');
      setHead({Status: PR_ST.cancel});
    } else if (to === 'reopen') {
      if (o.Status === PR_ST.done) {
        setHead({Status: PR_ST.run, CompletedAt: '', DoneDateGregorian: '', DoneJalali: ''});
      } else if (o.Status === PR_ST.cancel) setHead({Status: PR_ST.draft});
      else throw new Error('این سفارش بازگشایی نمی‌شود.');
    } else if (to === 'complete') {
      if (o.Status !== PR_ST.draft && o.Status !== PR_ST.run) throw new Error('این سفارش قابل تکمیل نیست.');
      var q = o.ActualQty === '' ? pr_num_(p.ActualQty) : pr_num_(o.ActualQty);
      if (p.ActualQty !== undefined && p.ActualQty !== '') q = pr_num_(p.ActualQty);
      if (!(q > 0)) throw new Error('مقدار تولید واقعی را وارد کنید (باید بزرگ‌تر از صفر باشد).');
      var open = L.steps.filter(function (s) { return s.Status !== 'انجام شد'; });
      if (open.length && cfg.strictSteps && !p.force) throw new Error('STEPS:' + open.length + ' مرحله هنوز «انجام شد» نیست.');
      if (open.length) warns.push(open.length + ' مرحله انجام‌نشده بود و با تأیید شما تکمیل شد.');
      var blocked = [];
      L.steps.forEach(function (s) { prChecksEval_(s.Checks).forEach(function (c) { if (c.blocking && c.state === 'fail') blocked.push(s.Name + ' ← ' + c.label); else if (c.required && c.state === 'missing' && s.Status === 'انجام شد') blocked.push(s.Name + ' ← ' + c.label + ' (بدون مقدار)'); }); });
      if (blocked.length) throw new Error('کنترل کیفی رد شده است و تولید تکمیل نمی‌شود: ' + blocked.join('؛ ') + '. نتیجه‌ی کنترل را اصلاح کنید.');
      var dj = parseJ_(p.doneDate || pr_today_()); if (!dj) throw new Error('تاریخ تکمیل نامعتبر است.');
      var mats = L.mats.map(function (m) { return {ProductID: m.ProductID, PlannedQty: Number(m.PlannedQty) || 0, ActualQty: m.ActualQty === '' ? Number(m.PlannedQty) || 0 : Number(m.ActualQty) || 0}; });
      var cost = prCostOrder_(co, mats, L.steps, L.ovh, cfg);
      if (cost.missing.length) { var pn = {}; rows_('Products').forEach(function (x) { pn[x.ProductID] = x.Name; }); warns.push('بهای خرید مشخص نیست (فاکتور خرید ثبت نشده) برای: ' + cost.missing.map(function (id) { return pn[id] || id; }).join('، ') + ' — بهای آن‌ها صفر محاسبه شد.'); }
      var kidsOpen = rows_('ProdOrders').filter(function (x) { return x.CompanyID === co && x.ParentOrderID === o.OrderID && (x.Status === PR_ST.draft || x.Status === PR_ST.run); });
      if (kidsOpen.length) warns.push(kidsOpen.length + ' سفارش نیمه‌ساخته‌ی زیرمجموعه هنوز تکمیل نشده است (موجودی آن‌ها ممکن است منفی شود).');
      pr_replace_('ProdMaterials', 'OrderID', o.OrderID, L.mats.map(function (m, i) { return {PMID: m.PMID, OrderID: o.OrderID, LineNo: m.LineNo, ProductID: m.ProductID, PlannedQty: m.PlannedQty, ActualQty: mats[i].ActualQty, UnitCost: cost.lines[i].UnitCost, Cost: cost.lines[i].Cost, StepNo: m.StepNo, Notes: m.Notes}; }));
      setHead({Status: PR_ST.done, ActualQty: q, MaterialCost: cost.material, LaborCost: cost.labor, OverheadCost: cost.overhead, TotalCost: cost.total, UnitCost: r2_(cost.total / q), CompletedAt: now, DoneDateGregorian: dj.g, DoneJalali: dj.j, StartedAt: o.StartedAt || now});
    } else throw new Error('عملیات نامعتبر است.');
    bump_();
    return {status: to, warnings: warns};
  });
}
function prodDelete_(p) {
  return locked_(function () {
    var o = pr_find_('ProdOrders', 'OrderID', p.id, p.company, 'سفارش تولید');
    if (o.Status !== PR_ST.draft && o.Status !== PR_ST.cancel) throw new Error('فقط سفارش «پیش‌نویس» یا «لغو» حذف می‌شود.');
    ['ProdMaterials', 'ProdSteps', 'ProdOverheads'].forEach(function (n) { delWhere_(n, 2, function (v) { return v === p.id; }); });
    rows_('ProdOrders').forEach(function (x) { if (x.ParentOrderID === p.id) pr_setRow_('ProdOrders', 'OrderID', x.OrderID, Object.assign({}, x, {ParentOrderID: ''})); });
    delWhere_('ProdOrders', 1, function (v) { return v === p.id; });
    bump_();
    return {deleted: 1};
  });
}

/* ---------- پیش‌نمایش فرمول (بدون ذخیره) ---------- */
function recipePreview_(p) {
  var co = p.company, chk = prCheckRecipe_(co, p, true), d = chk.data, Q = pr_num_(p.qty) || d.recipe.OutputQty || 1;
  var cfg = prCfg_(co), rec = {recipe: {OutputQty: d.recipe.OutputQty || 1, StdOverhead: d.recipe.StdOverhead}, params: d.params, items: d.items, steps: d.steps.map(function (s) { return {Name: s.Name, Labor: s.Labor, Checks: s.Checks, StdMinutes: s.StdMinutes}; })};
  var pl = prPlan_(rec, Q, p.values || {});
  var prods = {}, m = stockMap_(co), cm = prCostMap_(co, cfg.method), svc = {};
  rows_('Products').forEach(function (x) { if (x.CompanyID === co) prods[x.ProductID] = x; });
  rows_('Services').forEach(function (x) { if (x.CompanyID === co) svc[x.ServiceID] = x.Name; });
  var mc = 0, lc = 0, missing = 0;
  var mats = pl.materials.map(function (x) {
    var pr = prods[x.ProductID] || {}, u = cm[x.ProductID];
    if (u === undefined) { u = 0; missing++; }
    var c = r2_(x.PlannedQty * u); mc += c;
    return {ProductID: x.ProductID, Name: pr.Name || '؟', Unit: pr.DefaultUnit || '', qty: x.PlannedQty, unitCost: u, cost: c, balance: pr_r6_(m[x.ProductID] ? stBal_(m[x.ProductID]) : 0), StepNo: x.StepNo};
  });
  var labor = [];
  pl.steps.forEach(function (s) { s.Labor.forEach(function (l) { var c = r2_(l.qty * l.rate); lc += c; labor.push({step: s.Name, name: svc[l.serviceId] || '؟', qty: l.qty, rate: l.rate, cost: c}); }); });
  var oc = r2_((d.recipe.StdOverhead || 0) * Q);
  return {errors: chk.errors, formulaErrors: pl.errors, materials: mats, labor: labor, qty: Q, cost: {material: r2_(mc), labor: r2_(lc), overhead: oc, total: r2_(mc + lc + oc), unit: Q > 0 ? r2_((mc + lc + oc) / Q) : 0}, missingCost: missing};
}

/* ---------- کالای ساخته‌شده (جدا از مواد اولیه) ---------- */
/* کالای «ساخته‌شده» = کالایی که فرمول ساخت دارد یا سفارش تولید تکمیل‌شده دارد */
function prMadeSet_(co) {
  var m = {};
  rows_('Recipes').forEach(function (r) { if (r.CompanyID === co) m[r.ProductID] = 1; });
  rows_('ProdOrders').forEach(function (o) { if (o.CompanyID === co && o.Status === PR_ST.done) m[o.ProductID] = 1; });
  return m;
}
function madeGoods_(p) {
  var co = p.company, made = prMadeSet_(co), sm = stockMap_(co), prods = {}, agg = {}, nrec = {};
  rows_('Products').forEach(function (x) { if (x.CompanyID === co) prods[x.ProductID] = x; });
  rows_('Recipes').forEach(function (r) { if (r.CompanyID === co && String(r.IsActive) !== 'false') nrec[r.ProductID] = (nrec[r.ProductID] || 0) + 1; });
  rows_('ProdOrders').forEach(function (o) {
    if (o.CompanyID !== co || o.Status !== PR_ST.done) return;
    var a = agg[o.ProductID] || (agg[o.ProductID] = {qty: 0, cost: 0, n: 0, last: '', lastG: '', lastUnit: 0});
    var q = Number(o.ActualQty) || 0; a.qty += q; a.cost += Number(o.TotalCost) || 0; a.n++;
    var g = o.DoneDateGregorian || o.DateGregorian || '';
    if (g >= a.lastG) { a.lastG = g; a.last = o.DoneJalali || o.DateJalali; a.lastUnit = q > 0 ? (Number(o.TotalCost) || 0) / q : 0; }
  });
  var rows = [], T = {count: 0, produced: 0, value: 0, negative: 0, batches: 0};
  Object.keys(made).forEach(function (pid) {
    var pr = prods[pid]; if (!pr) return;
    var o = sm[pid] || {purchased: 0, sold: 0, returned: 0, retPurch: 0, produced: 0, consumed: 0}, a = agg[pid] || {qty: 0, cost: 0, n: 0, last: '', lastUnit: 0};
    var bal = pr_r6_(stBal_(o)), oq = Number(o.opening) || 0, oc = Number(o.openingCost) || 0, aq = a.qty + (oc > 0 ? oq : 0), avg = aq > 0 ? r2_((a.cost + (oc > 0 ? oq * oc : 0)) / aq) : 0, val = bal > 0 ? r2_(bal * avg) : 0;
    rows.push({ProductID: pid, Name: pr.Name, Code: pr.ProductCode, Unit: pr.DefaultUnit, GroupID: pr.GroupID, hasRecipe: !!nrec[pid], opening: pr_r6_(oq), produced: pr_r6_(o.produced || 0), sold: pr_r6_(o.sold), returned: pr_r6_(o.returned), purchased: pr_r6_(o.purchased - (o.retPurch || 0)), consumed: pr_r6_(o.consumed || 0), balance: bal, avgCost: avg, lastCost: r2_(a.lastUnit), value: val, batches: a.n, lastDate: a.last});
    T.count++; T.produced += o.produced || 0; T.value += val; T.batches += a.n; if (bal < -1e-9) T.negative++;
  });
  rows.sort(function (x, y) { return String(x.Name) < String(y.Name) ? -1 : 1; });
  T.produced = pr_r6_(T.produced); T.value = r2_(T.value);
  return {rows: rows, totals: T};
}
function madeDetail_(p) {
  var co = p.company, pid = p.product;
  pr_prod_(co, pid, 'کالا');
  var d = stockDetail_({company: co, product: pid}), batches = [], used = [], ord = {};
  rows_('ProdOrders').forEach(function (o) { if (o.CompanyID === co) ord[o.OrderID] = o; });
  Object.keys(ord).forEach(function (k) {
    var o = ord[k]; if (o.ProductID !== pid || o.Status !== PR_ST.done) return;
    var q = Number(o.ActualQty) || 0;
    batches.push({id: o.OrderID, no: o.OrderNo, date: o.DoneJalali || o.DateJalali, qty: q, unitCost: q > 0 ? r2_((Number(o.TotalCost) || 0) / q) : 0, total: r2_(Number(o.TotalCost) || 0), material: r2_(Number(o.MaterialCost) || 0), labor: r2_(Number(o.LaborCost) || 0), overhead: r2_(Number(o.OverheadCost) || 0)});
  });
  batches.sort(function (a, b) { return String(b.date) < String(a.date) ? -1 : 1; });
  rows_('ProdMaterials').forEach(function (x) {
    var o = ord[x.OrderID]; if (!o || x.ProductID !== pid || o.Status !== PR_ST.done) return;
    used.push({id: o.OrderID, no: o.OrderNo, date: o.DoneJalali || o.DateJalali, qty: Number(x.ActualQty === '' ? x.PlannedQty : x.ActualQty) || 0});
  });
  d.batches = batches; d.usedIn = used;
  return d;
}
