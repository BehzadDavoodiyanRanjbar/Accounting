'use strict';
/* لایه سازگاری: SpreadsheetApp و ... را روی حافظه + PostgreSQL شبیه‌سازی می‌کند */
const cp = require('child_process');

class Store {
  constructor(db) {
    const { PgAdapter } = require('./dbadapter');
    this.db = db; this.a = db && db.kind && typeof db.apply === 'function' ? db : new PgAdapter(db);
    this.sheets = {}; this.order = []; this.props = {}; this.nextUid = 1; this.colText = {}; this.dirtyP = {};
    this.sec = require('./secrets').make(process.env);
  }
  async load() {
    await this.a.init();
    const d = await this.a.loadAll();
    d.rows.forEach(x => {
      const s = this.sheet_(x.sheet);
      s.rows.push(x.data); s.uids.push(x.uid);
      if (x.uid >= this.nextUid) this.nextUid = x.uid + 1;
    });
    d.props.forEach(x => {
      this.props[x[0]] = this.sec.unwrap(x[0], x[1]);
      if (this.sec.enabled && this.sec.isSensitive(x[0]) && !String(x[1]).startsWith('enc1:')) this.dirtyP[x[0]] = 1; // مقدار قدیمیِ رمزگذاری‌نشده در اولین ذخیره رمز می‌شود
    });
    // ستون‌های متنی از روی سربرگ‌ها دوباره ساخته می‌شود (setupSystem)
  }
  sheet_(n) { if (!this.sheets[n]) { this.sheets[n] = new Sheet(this, n); this.order.push(n); } return this.sheets[n]; }
  async flush() {
    const ins = [], upd = [], del = [];
    for (const n of this.order) {
      const s = this.sheets[n];
      for (const u of s.delSet) del.push(u);
      for (const u of s.updSet) { if (!s.addSet.has(u)) upd.push([u, s.byUid(u)]); }
      for (const u of s.addSet) ins.push([n, u, s.byUid(u)]);
      s.addSet = new Set(); s.updSet = new Set(); s.delSet = new Set(); s.added = []; s._idx = null;
    }
    const pk = Object.keys(this.dirtyP); this.dirtyP = {};
    if (!ins.length && !upd.length && !del.length && !pk.length) return;
    await this.a.apply({ del, upd, ins, props: pk.map(k => [k, this.sec.wrap(k, this.props[k])]) });
  }
}

const NUM = /^-?(0|[1-9]\d{0,14})(\.\d+)?$/;
class Sheet {
  constructor(st, n) { this.st = st; this.n = n; this.rows = []; this.uids = []; this.addSet = new Set(); this.updSet = new Set(); this.delSet = new Set(); this.added = []; this.textCols = {}; this._idx = null; }
  byUid(u) { if (!this._idx) { this._idx = new Map(); this.uids.forEach((x, i) => this._idx.set(x, i)); } return this.rows[this._idx.get(u)]; }
  getName() { return this.n; }
  setName(n) { throw new Error('rename not supported'); }
  getLastRow() { return this.rows.length; }
  getMaxRows() { return 1e9; }
  getLastColumn() { return this.rows.length ? this.rows[0].length : 0; }
  insertRowsAfter() {}
  setFrozenRows() { return this; }
  hideSheet() { return this; }
  getProtections() { return []; }
  protect() { return { setWarningOnly() { return this; } }; }
  setFontWeight() { return this; }
  getDataRange() { return new Range(this, 1, 1, this.rows.length, this.rows.reduce((m, r) => Math.max(m, r.length), 0)); }
  getRange(r, c, nr, nc) {
    if (typeof r === 'string') { const m = /^([A-Z]+)(\d+)$/.exec(r); r = Number(m[2]); c = m[1].split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0); }
    return new Range(this, r, c, nr || 1, nc || 1);
  }
  deleteRows(start, cnt) {
    const rm = this.uids.splice(start - 1, cnt); this.rows.splice(start - 1, cnt); this._idx = null;
    rm.forEach(u => { if (this.addSet.has(u)) this.addSet.delete(u); else this.delSet.add(u); this.updSet.delete(u); });
  }
  deleteRow(r) { this.deleteRows(r, 1); }
}
class Range {
  constructor(s, r, c, nr, nc) { this.s = s; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
  getRow() { return this.r; }
  getValues() {
    const out = []; for (let i = 0; i < this.nr; i++) { const row = this.s.rows[this.r - 1 + i] || []; const o = []; for (let j = 0; j < this.nc; j++) { const v = row[this.c - 1 + j]; o.push(v === undefined || v === null ? '' : v); } out.push(o); }
    return out;
  }
  coerce_(col, v) {
    if (typeof v === 'string' && !this.s.textCols[col] && v !== '' && NUM.test(v) && this.s.rows.length > 0) return Number(v);
    if (v === undefined || v === null) return '';
    if (v instanceof Date) return v.toISOString();
    return v;
  }
  setValues(vals) {
    const s = this.s;
    for (let i = 0; i < vals.length; i++) {
      const ri = this.r - 1 + i;
      while (s.rows.length <= ri) { const u = s.st.nextUid++; s.rows.push([]); s.uids.push(u); s.addSet.add(u); s._idx = null; }
      const row = s.rows[ri], u = s.uids[ri];
      for (let j = 0; j < vals[i].length; j++) { const col = this.c + j; row[col - 1] = (ri === 0) ? vals[i][j] : this.coerce_(col, vals[i][j]); }
      for (let j = 0; j < row.length; j++) if (row[j] === undefined) row[j] = '';
      if (!s.addSet.has(u)) s.updSet.add(u);
    }
    return this;
  }
  setValue(v) { return this.setValues([[v]]); }
  setNumberFormat(f) { if (f === '@') for (let j = 0; j < this.nc; j++) this.s.textCols[this.c + j] = true; return this; }
  setFontWeight() { return this; }
  createTextFinder(t) {
    const rg = this; let whole = false;
    const o = { matchEntireCell(b) { whole = b; return o; }, findNext() {
      for (let i = 0; i < rg.nr; i++) { const row = rg.s.rows[rg.r - 1 + i]; for (let j = 0; j < rg.nc; j++) { const v = row && row[rg.c - 1 + j]; if (v !== undefined && v !== null && (whole ? String(v) === String(t) : String(v).indexOf(t) >= 0)) return { getRow() { return rg.r + i; } }; } }
      return null;
    } };
    return o;
  }
}

function pad(n, l) { return String(n).padStart(l || 2, '0'); }
function formatDate(d, tz, fmt) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = {}; f.formatToParts(d).forEach(x => { p[x.type] = x.value; });
  return fmt.replace(/yyyy/g, p.year).replace(/MM/g, p.month).replace(/dd/g, p.day).replace(/HH/g, p.hour).replace(/mm/g, p.minute).replace(/ss/g, p.second);
}
const crypto = require('crypto');
function makeGlobals(store, hooks) {
  const ss = {
    getSheetByName: n => store.sheets[n] || null,
    insertSheet: n => store.sheet_(n),
    getSheets: () => store.order.map(n => store.sheets[n]),
    getId: () => 'local'
  };
  const props = { getProperty: k => (store.props[k] === undefined ? null : store.props[k]), setProperty: (k, v) => { store.props[k] = String(v); store.dirtyP[k] = 1; }, deleteProperty: k => { delete store.props[k]; store.dirtyP[k] = 1; }, getKeys: () => Object.keys(store.props) };
  const cache = new Map();
  return {
    console, JSON, Math, Date, Number, String, Object, Array, RegExp, Error, isNaN, parseInt, parseFloat, BigInt, Map, Set, Intl, encodeURIComponent, decodeURIComponent,
    SpreadsheetApp: { getActive: () => ss, ProtectionType: { SHEET: 'SHEET' } },
    PropertiesService: { getScriptProperties: () => props },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: k => { const e = cache.get(k); return e && e.x > Date.now() ? e.v : null; }, put: (k, v, t) => { cache.set(k, { v, x: Date.now() + (t || 600) * 1000 }); }, remove: k => cache.delete(k) }) },
    Logger: { log: (...a) => console.log(...a) },
    DriveApp: { getRootFolder() {}, getFileById() { throw new Error('در نسخه Docker از دکمه پشتیبان‌گیری سرور استفاده می‌شود.'); } },
    Utilities: {
      formatDate,
      DigestAlgorithm: { MD5: 'md5', SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, str) => Array.from(crypto.createHash(alg).update(String(str), 'utf8').digest()).map(b => b > 127 ? b - 256 : b)
    },
    UrlFetchApp: {
      fetch(url, o) {
        o = o || {};
        const script = 'const i=JSON.parse(require("fs").readFileSync(0,"utf8"));(async()=>{try{const r=await fetch(i.url,{method:(i.o.method||"get").toUpperCase(),headers:Object.assign(i.o.contentType?{"content-type":i.o.contentType}:{},i.o.headers||{}),body:i.o.payload});process.stdout.write(JSON.stringify({c:r.status,t:await r.text()}))}catch(e){process.stdout.write(JSON.stringify({c:0,t:String(e.message)}))}})()';
        const out = JSON.parse(cp.execFileSync(process.execPath, ['-e', script], { input: JSON.stringify({ url, o }), maxBuffer: 256 * 1024 * 1024, timeout: 120000 }).toString());
        return { getResponseCode: () => out.c, getContentText: () => out.t };
      }
    }
  };
}
module.exports = { Store, makeGlobals };
