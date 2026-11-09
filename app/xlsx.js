'use strict';
/* خواندن ساده فایل xlsx بدون هیچ کتابخانه خارجی */
const zlib = require('zlib'), fs = require('fs');
function unzip(buf) {
  let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('فایل xlsx معتبر نیست.');
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16); const out = {};
  for (let i = 0; i < n; i++) {
    const m = buf.readUInt16LE(p + 10), cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nl).toString('utf8'); p += 46 + nl + xl + cl;
    const ln = buf.readUInt16LE(lo + 26), lx = buf.readUInt16LE(lo + 28), ds = lo + 30 + ln + lx, raw = buf.slice(ds, ds + cs);
    out[name] = { get: () => (m === 0 ? raw : zlib.inflateRawSync(raw)).toString('utf8') };
  }
  return out;
}
const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (m, d) => String.fromCodePoint(parseInt(d, 16))).replace(/&amp;/g, '&');
const colNo = s => s.split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0);
function textOf(x) { let o = ''; const re = /<t[^>]*>([\s\S]*?)<\/t>|<t\/>/g; let m; while ((m = re.exec(x))) o += unesc(m[1] || ''); return o; }
const BUILTIN_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
function readXlsx(file, tzOffsetMin) {
  const z = unzip(Buffer.isBuffer(file) ? file : fs.readFileSync(file)), g = n => z[n] ? z[n].get() : '';
  const sst = []; { const x = g('xl/sharedStrings.xml'); const re = /<si>([\s\S]*?)<\/si>|<si\/>/g; let m; while ((m = re.exec(x))) sst.push(textOf(m[1] || '')); }
  const dateXf = []; { const x = g('xl/styles.xml'); const nf = {}; let m; const r1 = /<numFmt [^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g;
    while ((m = r1.exec(x))) nf[m[1]] = unesc(m[2]).replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');
    const cx = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(x); if (cx) { const r2 = /<xf [^>]*?numFmtId="(\d+)"/g; let k = 0; while ((m = r2.exec(cx[1]))) { const id = +m[1]; dateXf[k++] = BUILTIN_DATE.has(id) || (nf[id] !== undefined && /[ymdhs]/i.test(nf[id])); } } }
  const wb = g('xl/workbook.xml'), rels = g('xl/_rels/workbook.xml.rels'), rel = {}; let m;
  const rr = /<Relationship [^>]*>/g; while ((m = rr.exec(rels))) { const a = /Id="([^"]+)"/.exec(m[0]), t = /Target="([^"]+)"/.exec(m[0]); if (a && t) rel[a[1]] = t[1].replace(/^\//, '').replace(/^(?!xl\/)/, 'xl/'); }
  const out = {}; const rs = /<sheet [^>]*>/g;
  while ((m = rs.exec(wb))) {
    const nm = /name="([^"]*)"/.exec(m[0]), id = /r:id="([^"]+)"/.exec(m[0]); if (!nm || !id) continue;
    const x = g(rel[id[1]]), rows = []; const rre = /<row [^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g; let r;
    while ((r = rre.exec(x))) {
      const rn = +(/r="(\d+)"/.exec(r[0]) || [0, rows.length + 1])[1], arr = []; const cre = /<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g; let c;
      while ((c = cre.exec(r[1] || ''))) {
        const at = c[1], ref = /r="([A-Z]+)\d+"/.exec(at); if (!ref) continue; const ci = colNo(ref[1]) - 1, t = (/t="(\w+)"/.exec(at) || [])[1], s = +((/s="(\d+)"/.exec(at) || [0, 0])[1]), body = c[2] || '';
        const v = /<v>([\s\S]*?)<\/v>/.exec(body); let val = '';
        if (t === 'inlineStr') val = textOf(body); else if (v) { const raw = unesc(v[1]);
          if (t === 's') val = sst[+raw] || ''; else if (t === 'str' || t === 'e') val = raw; else if (t === 'b') val = raw === '1';
          else { const num = Number(raw); val = num;
            if (dateXf[s]) { const ms = (num - 25569) * 86400000 - (tzOffsetMin || 0) * 60000; val = new Date(Math.round(ms)).toISOString(); } } }
        arr[ci] = val;
      }
      for (let i = 0; i < arr.length; i++) if (arr[i] === undefined) arr[i] = '';
      while (rows.length < rn - 1) rows.push([]); rows[rn - 1] = arr;
    }
    out[unesc(nm[1])] = rows;
  }
  return out;
}
module.exports = { readXlsx };
