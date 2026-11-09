'use strict';
/* انتقال داده از فایل xlsx (دانلود از Google Sheets) به PostgreSQL */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { Store, makeGlobals } = require('./shim'), { readXlsx } = require('./xlsx');
async function migrate(db, file, log) {
  log = log || console.log;
  const store = new Store(db); await store.load();
  const ctx = vm.createContext(makeGlobals(store));
  ['Code.gs', 'Sales.gs', 'Prod.gs'].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, 'gs', f), 'utf8'), ctx));
  const H = vm.runInContext('H', ctx), TEXT = vm.runInContext('TEXT', ctx);
  const wb = readXlsx(file, 210);
  const names = Object.keys(H).filter(n => wb[n]);
  if (!names.length) throw new Error('در این فایل هیچ‌کدام از شیت‌های سامانه پیدا نشد (فایل درست را دانلود کنید).');
  for (const n of names) {
    const src = wb[n], hd = (src[0] || []).map(x => String(x).trim()), map = H[n].map(h => hd.indexOf(h));
    const s = store.sheet_(n); if (s.rows.length) s.deleteRows(1, s.rows.length);
    H[n].forEach((h, i) => { if (TEXT.indexOf(h) >= 0) s.textCols[i + 1] = true; });
    const out = [H[n]];
    for (let r = 1; r < src.length; r++) { const row = src[r]; if (!row || !row.length || row.every(x => x === '')) continue;
      out.push(H[n].map((h, i) => { let v = map[i] < 0 ? '' : row[map[i]]; if (v === undefined || v === null) v = ''; if (typeof v === 'number' && TEXT.indexOf(h) >= 0) v = String(v); return v; })); }
    for (let i = 0; i < out.length; i += 5000) s.getRange(i + 1, 1, Math.min(5000, out.length - i), H[n].length).setValues(out.slice(i, i + 5000));
    log(n + ': ' + (out.length - 1) + ' ردیف');
  }
  vm.runInContext("setSet_('SchemaVer','4');setSet_('CompanyScopeV1','');bump_()", ctx);
  await store.flush();
  return names.length;
}
module.exports = { migrate };
if (require.main === module) {
  const { Pool } = require('pg');
  const f = process.argv[2];
  if (!f || !fs.existsSync(f)) { console.error('فایل پیدا نشد: ' + f); process.exit(1); }
  migrate(new Pool({ connectionString: process.env.DATABASE_URL }), f).then(n => { console.log('انجام شد؛ ' + n + ' جدول منتقل شد.'); process.exit(0); }).catch(e => { console.error('خطا: ' + e.message); process.exit(1); });
}
