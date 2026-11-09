'use strict';
/* ورود فایل پشتیبان کامل (backup-....json.gz) به پایگاه‌داده‌ی خالی — برای انتقال از نسخه‌ی Docker/PostgreSQL به SQL Server.
   فقط وقتی جدول‌ها خالی باشند اجرا می‌شود (مگر --replace). پس از ورود، همه‌ی ردیف‌ها دوباره خوانده و یک‌به‌یک با فایل مقایسه می‌شوند. */
const fs = require('fs'), zlib = require('zlib');

function readBackup(file) {
  const raw = fs.readFileSync(file); let buf;
  try { buf = zlib.gunzipSync(raw); } catch (e) { buf = raw; }
  let o; try { o = JSON.parse(buf.toString('utf8')); } catch (e) { throw new Error('فایل پشتیبان خوانده نشد (خراب است یا فایل درستی نیست).'); }
  if (!o || typeof o.sheets !== 'object' || typeof o.props !== 'object' || !o.sheets || !o.props) throw new Error('این فایل، پشتیبان کامل سیستم نیست (پشتیبان یک شرکت را نمی‌توان اینجا وارد کرد).');
  Object.keys(o.sheets).forEach(n => { if (!Array.isArray(o.sheets[n])) throw new Error('ساختار شیت ' + n + ' درست نیست.'); });
  return o;
}
const canon = r => JSON.stringify(JSON.parse(JSON.stringify(r)));

async function importBackup(adapter, o, opt) {
  opt = opt || {}; const log = opt.log || console.log;
  await adapter.init();
  const cur = await adapter.loadAll();
  if ((cur.rows.length || cur.props.length) && !opt.replace)
    throw new Error('پایگاه‌داده‌ی مقصد خالی نیست (' + cur.rows.length + ' ردیف). برای جایگزینی کامل، گزینه‌ی --replace را بدهید (اطلاعات فعلی مقصد پاک می‌شود).');
  const del = cur.rows.map(x => x.uid), props = [];
  cur.props.forEach(x => props.push([x[0], undefined]));
  const ins = []; let uid = 1; const names = Object.keys(o.sheets), want = {};
  names.forEach(n => { want[n] = []; o.sheets[n].forEach(r => { ins.push([n, uid++, r]); want[n].push(canon(r)); }); });
  Object.keys(o.props).forEach(k => { const i = props.findIndex(p => p[0] === k); const e = [k, String(o.props[k])]; if (i >= 0) props[i] = e; else props.push(e); });
  log('ورود ' + ins.length + ' ردیف از ' + names.length + ' شیت و ' + Object.keys(o.props).length + ' تنظیم...');
  await adapter.apply({ del, upd: [], ins, props });
  log('بازخوانی و مقایسه...');
  const back = await adapter.loadAll(), got = {}, bad = [];
  back.rows.forEach(x => { (got[x.sheet] = got[x.sheet] || []).push([x.uid, canon(x.data)]); });
  names.forEach(n => {
    const g = (got[n] || []).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    if (g.length !== want[n].length) bad.push(n + ': تعداد ردیف ' + g.length + ' (باید ' + want[n].length + ' باشد)');
    else for (let i = 0; i < g.length; i++) if (g[i] !== want[n][i]) { bad.push(n + ': ردیف ' + (i + 1) + ' با فایل یکی نیست'); break; }
  });
  Object.keys(got).forEach(n => { if (!want[n]) bad.push(n + ': شیت اضافه در مقصد'); });
  const gp = {}; back.props.forEach(x => { gp[x[0]] = x[1]; });
  Object.keys(o.props).forEach(k => { if (gp[k] !== String(o.props[k])) bad.push('تنظیم ' + k + ' یکی نیست'); });
  if (Object.keys(gp).length !== Object.keys(o.props).length) bad.push('تعداد تنظیمات یکی نیست');
  const rep = { rows: ins.length, sheets: names.length, props: Object.keys(o.props).length, ok: bad.length === 0, problems: bad };
  log(rep.ok ? 'مقایسه کامل: همه‌چیز دقیقاً یکی است ✔' : 'مغایرت پیدا شد:\n - ' + bad.join('\n - '));
  return rep;
}
module.exports = { readBackup, importBackup };

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2), file = args.find(a => !a.startsWith('--')), replace = args.includes('--replace');
    if (!file) { console.log('نحوه‌ی استفاده:  node import-backup.js <فایل-پشتیبان.json.gz> [--replace]'); process.exit(2); }
    let ad;
    try { const o = readBackup(file); ad = require('./dbadapter').fromEnv(process.env);
      console.log('مقصد:', ad.kind === 'mssql' ? 'SQL Server — ' + process.env.MSSQL_SERVER + ' / ' + process.env.MSSQL_DATABASE : 'PostgreSQL');
      console.log('زمان تهیه‌ی پشتیبان:', o.at || '؟');
      const r = await importBackup(ad, o, { replace });
      await ad.close(); process.exit(r.ok ? 0 : 1);
    } catch (e) { console.error('خطا:', e.message); try { ad && await ad.close(); } catch (x) { } process.exit(1); }
  })();
}
