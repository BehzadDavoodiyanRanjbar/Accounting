'use strict';
/* خودآزمایی اتصال و عملکرد SQL Server — فقط روی دیتابیسی اجرا می‌شود که نامش به «Test» ختم شود (جدول‌هایش پاک و دوباره ساخته می‌شود).
   اجرا:  node mssql-selftest.js   (با متغیرهای MSSQL_SERVER ، MSSQL_DATABASE ، MSSQL_USER ، MSSQL_PASSWORD) */
const crypto = require('crypto');

async function runSelfTest(ad, log) {
  log = log || console.log; let fails = 0;
  const ok = (c, m) => { log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; return c; };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const t0 = Date.now(), lap = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
  try {
    await ad.init(); ok(true, 'اتصال و ساخت جدول‌ها');
    const old = await ad.loadAll();
    await ad.apply({ del: old.rows.map(x => x.uid), upd: [], ins: [], props: old.props.map(x => [x[0], undefined]) });
    const e0 = await ad.loadAll(); ok(e0.rows.length === 0 && e0.props.length === 0, 'پاک‌سازی جدول‌های آزمایشی');

    const fa = ['علی', 'مریم‌السادات', 'شرکت «آزمون» ۱۲۳', 'He said "hi" \\ back\\slash', "O'Brien; DROP TABLE rows;--", 'خط\nجدید\tتب', '😀 ✓ ‌نیم‌فاصله', '<tag>&amp;</tag>', '{"a":[1,2,3]}', 'ي ك ۰۱۲۳۴۵۶۷۸۹ ٠١٢٣'];
    const mk = i => [i, fa[i % fa.length], i * 1.5, i % 2 === 0, null, '', 'x'.repeat(i % 50), String(i).padStart(12, '0'), '1405/0' + (1 + i % 9) + '/1' + (i % 9)];
    const N = 5000, ins = []; const sheets = ['Users', 'Companies', 'Invoices', 'Sales', 'Vouchers'];
    for (let i = 0; i < N; i++) ins.push([sheets[i % sheets.length], 1000 + i, mk(i)]);
    const bigRow = ['BIG', 'ب'.repeat(1500000), crypto.randomBytes(300000).toString('base64')]; // حدود ۲٫۳ مگابایت
    ins.push(['Vouchers', 99999, bigRow]);
    await ad.apply({ del: [], upd: [], ins, props: [['AuthSecret', 'abc'], ['LongProp', 'ل'.repeat(100000)], ['SchemaVer', '17']] });
    let d = await ad.loadAll();
    ok(d.rows.length === N + 1, 'ذخیرهٔ ' + (N + 1) + ' ردیف (' + d.rows.length + ' خوانده شد) ' + lap());
    const m = new Map(d.rows.map(x => [x.uid, x]));
    let bad = 0; ins.forEach(x => { const g = m.get(x[1]); if (!g || g.sheet !== x[0] || !same(g.data, x[2])) bad++; });
    ok(bad === 0, 'محتوای همهٔ ردیف‌ها (فارسی، نقل‌قول، بک‌اسلش، ایموجی، ردیف ۲ مگابایتی) دقیقاً برگشت' + (bad ? ' — ' + bad + ' ردیف مغایر' : ''));
    ok(d.props.length === 3 && d.props.some(p => p[0] === 'LongProp' && p[1].length === 100000), 'تنظیمات (از جمله مقدار ۱۰۰ هزار کاراکتری)');
    let sorted = true; for (let i = 1; i < d.rows.length; i++) { const a = d.rows[i - 1], b = d.rows[i]; if (a.sheet > b.sheet || (a.sheet === b.sheet && a.uid > b.uid)) sorted = false; }
    ok(sorted, 'ترتیب خواندن (شیت، سپس شناسه)');

    const upd = [], del = []; for (let i = 0; i < 1000; i++) upd.push([1000 + i, ['U', i, 'ویرایش‌شده ' + fa[i % fa.length]]]);
    for (let i = 4000; i < 4500; i++) del.push(1000 + i);
    await ad.apply({ del, upd, ins: [], props: [['SchemaVer', '18'], ['AuthSecret', undefined]] });
    d = await ad.loadAll(); const m2 = new Map(d.rows.map(x => [x.uid, x]));
    ok(d.rows.length === N + 1 - 500, 'حذف ۵۰۰ ردیف (' + d.rows.length + ' باقی ماند)');
    ok(upd.every(x => m2.has(x[0]) && same(m2.get(x[0]).data, x[1])), 'ویرایش ۱۰۰۰ ردیف');
    ok(!d.props.some(p => p[0] === 'AuthSecret') && d.props.find(p => p[0] === 'SchemaVer')[1] === '18', 'ویرایش و حذف تنظیمات');

    const before = (await ad.loadAll()).rows.length; let threw = false;
    try { await ad.apply({ del: [1000], upd: [[1001, ['SHOULD-NOT-STAY']]], ins: [['Users', 7000001, ['n']], ['Users', 7000001, ['dup']]], props: [['Zed', '1']] }); } catch (e) { threw = true; }
    d = await ad.loadAll();
    ok(threw && d.rows.length === before && d.rows.some(x => x.uid === 1000) && !d.rows.some(x => x.uid === 7000001) && !d.props.some(p => p[0] === 'Zed') && !same((d.rows.find(x => x.uid === 1001) || {}).data, ['SHOULD-NOT-STAY']),
      'در صورت خطا همهٔ تغییرات آن مرحله برگشت می‌خورد (همه یا هیچ)');

    const t1 = Date.now(); const full = await ad.loadAll(); const ms = Date.now() - t1;
    ok(full.rows.length === before, 'سرعت بارگذاری کامل: ' + ms + ' میلی‌ثانیه برای ' + full.rows.length + ' ردیف');
    await ad.apply({ del: full.rows.map(x => x.uid), upd: [], ins: [], props: full.props.map(x => [x[0], undefined]) });
    ok(true, 'پاک‌سازی نهایی جدول‌های آزمایشی');
  } catch (e) { ok(false, 'خطای غیرمنتظره: ' + (e && e.message)); }
  log(fails ? '\nنتیجه: ' + fails + ' مورد ناموفق — پیام‌های بالا را برای پشتیبانی بفرستید.' : '\nنتیجه: همه‌چیز سالم است ✔  (' + lap() + ')');
  return fails;
}
module.exports = { runSelfTest };

if (require.main === module) {
  (async () => {
    const db = String(process.env.MSSQL_DATABASE || '');
    if (!/test$/i.test(db)) { console.error('ایمنی: این آزمون جدول‌های دیتابیس را پاک می‌کند. نام دیتابیس باید به «Test» ختم شود (مثلاً MoinTarazTest). الان: "' + db + '"'); process.exit(2); }
    let ad; try {
      process.env.DB_TYPE = 'mssql'; ad = require('./dbadapter').fromEnv(process.env);
      console.log('SQL Server:', process.env.MSSQL_SERVER, '— دیتابیس:', db, '\n');
      const f = await runSelfTest(ad); await ad.close(); process.exit(f ? 1 : 0);
    } catch (e) { console.error('خطا:', e.message); try { ad && await ad.close(); } catch (x) { } process.exit(1); }
  })();
}
