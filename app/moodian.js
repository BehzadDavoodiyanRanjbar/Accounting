'use strict';
/* ارسال صورتحساب به سامانه مودیان (API نسخه ۲) - پروتکل: RC_TICS.IS v1.6
   توجه: این پیاده‌سازی بر پایه مستندات منتشرشده است و باید روی محیط آزمایشی (Sandbox) راستی‌آزمایی شود. */
const crypto = require('crypto');
const BASES = { sandbox: process.env.MO_SANDBOX_URL || 'https://sandboxrc.tax.gov.ir/requestsmanager', prod: process.env.MO_PROD_URL || 'https://tp.tax.gov.ir/requestsmanager' };
const b64u = b => Buffer.from(b).toString('base64url');
const DIAG = { log: [], hdr: '' };
const note = (m, u, r) => { DIAG.log.push(new Date().toISOString().slice(11, 19) + ' ' + m + ' ' + u.replace(/\?.*$/, '') + ' -> ' + (r.status != null ? r.status : r) + (r.text ? ' ' + String(r.text).slice(0, 300).replace(/\s+/g, ' ') : '')); if (DIAG.log.length > 40) DIAG.log.shift(); };

/* ---------- شماره مالیاتی (۲۲ کاراکتر) ---------- */
const D = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const P = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
const INV = [0,4,3,2,1,5,6,7,8,9];
function verhoeff(s) { let c = 0; const r = s.split('').reverse(); for (let i = 0; i < r.length; i++) c = D[c][P[(i + 1) % 8][+r[i]]]; return INV[c]; }
function taxId(memId, gIso, serial, hm) {
  memId = String(memId || '').toUpperCase();
  /* مطابق SDK رسمی: روزِ یونیکسِ لحظه صدور (UTC)؛ ساعت به وقت تهران UTC+03:30 */
  const pr = gIso.split('-'), t = String(hm || '12:00').split(':'), ms = Date.UTC(+pr[0], +pr[1] - 1, +pr[2], +t[0] || 0, +t[1] || 0, 0) - 3.5 * 3600e3, days = Math.floor(ms / 864e5), sn = BigInt(serial);
  const dec = memId.split('').map(ch => /\d/.test(ch) ? ch : String(ch.charCodeAt(0))).join('');
  const ctl = dec + String(days).padStart(6, '0') + sn.toString().padStart(12, '0');
  return memId + days.toString(16).toUpperCase().padStart(5, '0') + sn.toString(16).toUpperCase().padStart(10, '0') + verhoeff(ctl);
}

/* ---------- گواهی و کلید ---------- */
function certB64(pem) { return String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''); }
function jws(payloadStr, keyPem, cert, prof) {
  prof = prof || { x5c: 'cert', extra: true };
  if (prof.x5c === 'cert' && !cert) throw new Error('گواهی امضای الکترونیکی شرکت ثبت نشده است. طبق SDK رسمی سازمان امور مالیاتی، امضای فاکتور بدون گواهی (فایل .crt/.cer صادرشده توسط شرکت‌های گواهی) پذیرفته نمی‌شود.');
  const hdr = { crit: ['sigT'], sigT: new Date().toISOString().replace(/\.\d+Z$/, 'Z') };
  if (prof.x5c === 'cert' && cert) hdr.x5c = [certB64(cert)]; else if (prof.x5c === 'empty') hdr.x5c = [];
  hdr.alg = 'RS256';
  if (prof.extra) { hdr.typ = 'jose'; hdr.cty = 'text/plain'; }
  DIAG.hdr = JSON.stringify(Object.assign({}, hdr, hdr.x5c ? { x5c: hdr.x5c.map(x => x.slice(0, 20) + '...') } : {}));
  const si = b64u(JSON.stringify(hdr)) + '.' + b64u(payloadStr);
  return si + '.' + crypto.sign('RSA-SHA256', Buffer.from(si, 'ascii'), keyPem).toString('base64url');
}
function jwe(compact, pub, kid) {
  const prot = b64u(JSON.stringify({ alg: 'RSA-OAEP-256', enc: 'A256GCM', kid: kid }));
  const cek = crypto.randomBytes(32), iv = crypto.randomBytes(12);
  const ek = crypto.publicEncrypt({ key: pub, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, cek);
  const c = crypto.createCipheriv('aes-256-gcm', cek, iv); c.setAAD(Buffer.from(prot, 'ascii'));
  const ct = Buffer.concat([c.update(compact, 'utf8'), c.final()]);
  return [prot, ek.toString('base64url'), iv.toString('base64url'), ct.toString('base64url'), c.getAuthTag().toString('base64url')].join('.');
}
function parsePub(k) {
  k = String(k || '').trim(); const tries = [];
  if (/-----BEGIN/.test(k)) tries.push(() => crypto.createPublicKey(k));
  else { const der = Buffer.from(k, 'base64'); tries.push(() => crypto.createPublicKey({ key: der, format: 'der', type: 'spki' }), () => crypto.createPublicKey(new crypto.X509Certificate(der).publicKey)); }
  for (const t of tries) { try { return t(); } catch (e) {} }
  throw new Error('کلید عمومی سرور مودیان قابل خواندن نیست.');
}

/* ---------- HTTP ---------- */
async function http(url, o) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), (o && o.timeout) || 45000);
  try {
    const r = await fetch(url, Object.assign({ signal: ac.signal }, o)); const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch (e) {}
    note((o && o.method) || 'GET', url, { status: r.status, text: r.status === 200 && url.indexOf('invoice') < 0 ? '' : text });
    return { status: r.status, text, json: j };
  } catch (e) {
    const c = e.cause && (e.cause.code || e.cause.message) || e.message;
    note((o && o.method) || 'GET', url, 'ERR ' + c);
    throw new Error('اتصال به سامانه مودیان برقرار نشد (' + c + ')');
  } finally { clearTimeout(t); }
}
const errText = r => { const e = r.json && (r.json.errors || r.json.error); return Array.isArray(e) ? e.map(x => (x.code ? x.code + ': ' : '') + (x.message || x.detail || JSON.stringify(x))).join(' | ') : (r.text || '').slice(0, 300); };

class Client {
  constructor(env, memId, keyPem, cert, prof) { this.base = (BASES[env] || BASES.sandbox) + '/api/v2/'; this.env = env; this.memId = memId; this.key = keyPem; this.cert = cert; this.prof = prof; }
  async nonce() { let r; for (let i = 0; i < 4; i++) { r = await http(this.base + 'nonce?timeToLive=30'); if (![502, 503, 504].includes(r.status)) break; await new Promise(z => setTimeout(z, 2000 * (i + 1))); } if (r.status !== 200 || !r.json || !r.json.nonce) throw new Error('دریافت nonce ناموفق بود (HTTP ' + r.status + '): ' + errText(r)); return r.json.nonce; }
  async auth() { const n = await this.nonce(); return 'Bearer ' + jws(JSON.stringify({ nonce: n, clientId: this.memId }), this.key, this.cert, this.prof); }
  async get(path) { const r = await http(this.base + path, { headers: { authorization: await this.auth() } }); return r; }
  /* تشخیص خودکار شکل هدر امضا: چند حالت را روی server-information (فقط‌خواندنی) امتحان می‌کند */
  static profiles(hasCert) {
    const out = [];
    if (hasCert) out.push({ x5c: 'cert', extra: true }, { x5c: 'cert', extra: false });
    return out;
  }
  async probe(hasCert) {
    const res = [];
    for (const p of Client.profiles(hasCert)) {
      this.prof = p; let r;
      try { r = await this.get('server-information'); } catch (e) { res.push({ prof: p, ok: false, msg: e.message }); continue; }
      const ok = r.status === 200 && !!r.json; res.push({ prof: p, ok, status: r.status, msg: ok ? '' : errText(r).slice(0, 200) });
      if (ok) break;
    }
    return res;
  }
  async serverKey() {
    if (Client.sk && Client.sk.env === this.env && Date.now() - Client.sk.at < 3600e3) return Client.sk;
    const r = await this.get('server-information');
    if (r.status !== 200 || !r.json) throw new Error('دریافت کلید سرور مودیان ناموفق (HTTP ' + r.status + '): ' + errText(r));
    const ks = r.json.publicKeys || (r.json.data && r.json.data.publicKeys) || []; const k = ks[0];
    if (!k) throw new Error('کلید عمومی در پاسخ server-information پیدا نشد.');
    Client.sk = { env: this.env, at: Date.now(), kid: k.id || k.kid, pub: parsePub(k.key) }; return Client.sk;
  }
  /* packets: [{id, json}] -> نتیجه هر فاکتور */
  async submit(packets) {
    const sk = await this.serverKey(), out = [];
    const body = packets.map(p => ({ payload: jwe(jws(JSON.stringify(p.json), this.key, this.cert, this.prof), sk.pub, sk.kid), header: { requestTraceId: crypto.randomUUID(), fiscalId: this.memId } }));
    const r = await http(this.base + 'invoice', { method: 'POST', headers: { authorization: await this.auth(), 'content-type': 'application/json' }, body: JSON.stringify(body), timeout: 120000 });
    if (r.status !== 200 || !r.json) { const m = 'HTTP ' + r.status + ': ' + errText(r); return packets.map(p => ({ id: p.id, error: m, transport: r.status >= 500 || r.status === 0 })); }
    const res = r.json.result || r.json.data || [];
    packets.forEach((p, i) => { const x = res[i] || {}; const d = x.data; const em = (d && d.error && d.error.length) ? JSON.stringify(d.error) : '';
      if (!x.uid && !x.referenceNumber) out.push({ id: p.id, error: em || 'پاسخ نامعتبر از سامانه: ' + r.text.slice(0, 300) });
      else out.push({ id: p.id, uid: x.uid, ref: x.referenceNumber || x.uid, error: em }); });
    return out;
  }
  async inquire(refs) { /* refs: [{id, ref, uid}] */
    const out = [];
    for (const f of refs) {
      const q = f.ref ? 'inquiry-by-reference-id?referenceIds=' + encodeURIComponent(f.ref) : 'inquiry-by-uid?uidList=' + encodeURIComponent(f.uid) + '&fiscalId=' + encodeURIComponent(this.memId);
      const r = await this.get(q);
      if (r.status !== 200 || !r.json) { out.push({ id: f.id, state: 'unknown', msg: 'HTTP ' + r.status + ': ' + errText(r) }); continue; }
      const a = Array.isArray(r.json) ? r.json[0] : (Array.isArray(r.json.result) ? r.json.result[0] : (r.json.data ? [].concat(r.json.data)[0] : r.json)) || {};
      const d = a.data || a, st = String(a.status || d.status || '').toUpperCase(); const errs = d.error || d.errors || [];
      if (st === 'SUCCESS' || (d.success === true)) out.push({ id: f.id, state: 'ok' });
      else if (st === 'FAILED' || (d.success === false) || (Array.isArray(errs) && errs.length)) out.push({ id: f.id, state: 'fail', msg: JSON.stringify(errs).slice(0, 500) });
      else out.push({ id: f.id, state: 'wait', msg: st });
    }
    return out;
  }
}
async function netTest() {
  const out = {};
  for (const env of ['sandbox', 'prod']) {
    const t = Date.now();
    try { const r = await http(BASES[env] + '/api/v2/nonce?timeToLive=30', { timeout: 20000 }); out[env] = { ok: r.status === 200 && !!(r.json && r.json.nonce), status: r.status, ms: Date.now() - t, note: r.status === 200 ? '' : (r.text || '').slice(0, 150) }; }
    catch (e) { out[env] = { ok: false, ms: Date.now() - t, note: e.message }; }
  }
  return out;
}

/* =====================================================================
   پروتکل SDK رسمی «self-tsp» (نسخه 0.0.58): فقط با کلید خصوصی، بدون گواهی امضا
   لایه انتقال: امضای بسته با نرمال‌سازی کلید-مقدار؛ رمزنگاری AES-GCM + XOR + RSA-OAEP(SHA-256)
   ===================================================================== */
const V1_BASES = {
  sandbox: [process.env.MO_V1_SANDBOX_URL, 'https://sandboxrc.tax.gov.ir/req/api/self-tsp', 'https://sandboxrc.tax.gov.ir/requestsmanager/api/self-tsp'].filter(Boolean),
  prod: [process.env.MO_V1_PROD_URL, 'https://tp.tax.gov.ir/req/api/self-tsp', 'https://tp.tax.gov.ir/requestsmanager/api/self-tsp'].filter(Boolean)
};
const H_FIELDS = ['indati2m','indatim','inty','ft','inno','irtaxid','scln','setm','tins','cap','bid','insp','tvop','bpc','tax17','taxid','inp','scc','ins','billid','tprdis','tdis','tadis','tvam','todam','tbill','tob','tinb','sbc','bbc','bpn','crn','cdcn','lno','lrno','ocu','oci','dco','dci','tid','rid','lt','cno','did','sg','asn','asd','in','an','insr','nti1','nti2','cdcd','tonw','torv','tocv','tinc'];
const B_FIELDS = ['sstid','sstt','mu','am','fee','cfee','cut','exr','prdis','dis','adis','vra','vam','odt','odr','odam','olt','olr','olam','consfee','spro','bros','tcpbs','cop','bsrn','vop','tsstam','nw','ssrv','sscv','cui','hs','cpr','sovat','vba'];
const P_FIELDS = ['iinn','acn','trmn','trn','pcn','pid','vatpid','vatbid','pdt','pv','pmt'];
const nz = v => (v === undefined || v === '' ? null : v);
const fullObj = (o, fields) => { const r = {}; fields.forEach(f => { let v = nz(o && o[f]); if (typeof v === 'number' && !Number.isInteger(v)) v = Number(v.toFixed(6)); r[f] = v; }); return r; };
function fullInvoice(j) {
  return { header: (() => { const h = fullObj(j.header, H_FIELDS); if (Array.isArray(j.header && j.header.sg)) h.sg = j.header.sg; return h; })(),
    body: (j.body || []).map(b => fullObj(b, B_FIELDS)),
    payments: j.payments && j.payments.length ? j.payments.map(p => fullObj(p, P_FIELDS)) : null,
    extension: null };
}
const collate = (a, b) => { const x = a.toLowerCase(), y = b.toLowerCase(); if (x < y) return -1; if (x > y) return 1; return a === b ? 0 : (a > b ? -1 : 1); };
function numStr(n) { if (Number.isInteger(n)) return String(n); return String(n); }
function flat(out, root, v) {
  if (Array.isArray(v)) { v.forEach((e, i) => flat(out, (root ? root + '.' : '') + 'E' + i, e)); }
  else if (v && typeof v === 'object') { Object.keys(v).forEach(k => flat(out, (root ? root + '.' : '') + k, v[k])); }
  else out[root] = v;
}
/* نرمال‌سازی ObjectNormalizer در SDK */
function normalize(data, headers) {
  const map = {};
  if (data !== null && data !== undefined) { if (Array.isArray(data)) map.packets = data; else Object.keys(data).forEach(k => { map[k] = data[k]; }); }
  if (headers) Object.keys(headers).forEach(k => { map[k] = (k === 'Authorization' && headers[k] && headers[k].length > 7) ? headers[k].substring(7) : headers[k]; });
  const res = {}; flat(res, '', map);
  const keys = Object.keys(res).sort(collate);
  return keys.map(k => { const v = res[k]; if (v === null || v === undefined) return '#'; const t = typeof v === 'number' ? numStr(v) : String(v); return t === '' ? '#' : t.replace(/#/g, '##'); }).join('#');
}
const signText = (text, keyPem) => crypto.sign('RSA-SHA256', Buffer.from(text, 'utf8'), keyPem).toString('base64');
function xorBlocks(sm, big) { const out = Buffer.alloc(big.length), bs = Math.ceil(big.length / sm.length); for (let i = 0; i < bs; i++) for (let j = 0; j < sm.length; j++) { if (i * sm.length + j >= big.length) break; out[i * sm.length + j] = sm[j] ^ big[i * sm.length + j]; } return out; }
function xorTrim(b1, b2) { const o = b1.length < b2.length ? xorBlocks(b1, b2) : xorBlocks(b2, b1); let n = o.length; while (n > 0 && o[n - 1] === 0) n--; return n < o.length ? o.slice(0, n) : o; }
/* رمزنگاری یک دسته بسته با یک کلید AES مشترک (همان DefaultEncrypter) */
function encryptPackets(packets, pub, kid) {
  const aes = crypto.randomBytes(32), iv = crypto.randomBytes(16);
  const sym = crypto.publicEncrypt({ key: pub, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(aes.toString('hex'), 'utf8')).toString('base64');
  packets.forEach(p => {
    p.iv = iv.toString('hex'); p.encryptionKeyId = kid; p.symmetricKey = sym;
    const text = Buffer.from(typeof p.data === 'string' ? p.data : JSON.stringify(p.data), 'utf8');
    const c = crypto.createCipheriv('aes-256-gcm', aes, iv);
    p.data = Buffer.concat([c.update(xorTrim(text, aes)), c.final(), c.getAuthTag()]).toString('base64');
  });
}
const V1 = { found: {} };
class ClientV1 {
  constructor(env, memId, keyPem, keyId, style) { this.env = env; this.memId = memId; this.key = keyPem; this.keyId = keyId || null; this.style = style === 'v1' ? 'v1' : 'obj'; this.token = null; }
  basesToTry() { const f = V1.found[this.env]; return f ? [f] : V1_BASES[this.env || 'sandbox'].map(b => b); }
  mkPacket(type, data, extra) { return Object.assign({ uid: crypto.randomUUID(), packetType: type, retry: false, data: data === undefined ? null : data, encryptionKeyId: null, symmetricKey: null, iv: null, fiscalId: this.memId, dataSignature: null }, extra || {}); }
  async post(url, body, headers, timeout) {
    const r = await http(url, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json; charset=utf-8' }, headers), body: typeof body === 'string' ? body : JSON.stringify(body), timeout: timeout || 60000 });
    return r;
  }
  hdrs(auth) { const h = { requestTraceId: crypto.randomUUID(), timestamp: String(Date.now()) }; if (auth && this.token) h.Authorization = 'Bearer ' + this.token.token; return h; }
  /* بسته همگام (sync) */
  v1sign(bodyStr, headers) {
    const sig = signText(bodyStr + (headers.Authorization || '') + headers.requestTraceId + headers.timestamp, this.key);
    headers.signature = sig; if (this.keyId) headers.signatureKeyId = this.keyId; return headers;
  }
  async sync(base, packet, auth) {
    const headers = this.hdrs(auth);
    if (this.style === 'v1') {
      const bodyStr = JSON.stringify({ signature: null, signatureKeyId: null, packet: Object.assign({}, packet, { signatureKeyId: packet.signatureKeyId || null }) });
      this.v1sign(bodyStr, headers);
      let r; for (let i = 0; i < 3; i++) { r = await this.post(base + '/v1/sync/' + packet.packetType, bodyStr, headers); if (![502, 503, 504].includes(r.status)) break; await new Promise(z => setTimeout(z, 2000 * (i + 1))); }
      return r;
    }
    const kid = this.keyId, pk = kid ? Object.assign({}, packet, { signatureKeyId: kid }) : packet;
    const sig = signText(normalize(pk, headers), this.key);
    const body = { signature: sig, packet: Object.assign({ signatureKeyId: null }, pk) }; if (kid) body.signatureKeyId = kid;
    let r; for (let i = 0; i < 3; i++) { r = await this.post(base + '/sync/' + packet.packetType, body, headers); if (![502, 503, 504].includes(r.status)) break; await new Promise(z => setTimeout(z, 2000 * (i + 1))); }
    return r;
  }
  parseSync(r) {
    if (!r.json) throw new Error('پاسخ نامعتبر از سامانه (HTTP ' + r.status + ')' + (/<html/i.test(r.text || '') ? '؛ سرور موقتاً در دسترس نیست.' : ': ' + (r.text || '').slice(0, 200)));
    if (r.json.errors && r.json.errors.length) throw Object.assign(new Error(r.json.errors.map(e => (e.code ? e.code + ': ' : '') + e.message).join(' | ')), { status: r.status });
    if (r.status !== 200) throw Object.assign(new Error('HTTP ' + r.status + ': ' + (r.text || '').slice(0, 200)), { status: r.status });
    return (r.json.result || {}).data;
  }
  async init(force) {
    if (this.sk && !force) return;
    let lastErr = null;
    for (const base of this.basesToTry()) {
      let r; try { r = await this.sync(base, this.mkPacket('GET_SERVER_INFORMATION', null), false); } catch (e) { lastErr = e; continue; }
      let d; try { d = this.parseSync(r); } catch (e) { lastErr = e; if (r.status === 404) continue; throw e; }
      const k = d && d.publicKeys && d.publicKeys[0]; if (!k) { lastErr = new Error('کلید عمومی سازمان در پاسخ نبود.'); continue; }
      V1.found[this.env] = base; this.base = base;
      this.sk = { kid: k.id, pub: crypto.createPublicKey({ key: Buffer.from(k.key, 'base64'), format: 'der', type: 'spki' }) };
      return;
    }
    throw lastErr || new Error('اتصال به سامانه مودیان برقرار نشد.');
  }
  async getToken(force) {
    if (this.token && !force && this.token.exp > Date.now() + 30000) return;
    await this.init();
    const r = await this.sync(this.base, this.mkPacket('GET_TOKEN', { username: this.memId }), false);
    const d = this.parseSync(r); if (!d || !d.token) throw new Error('توکن دریافت نشد.');
    this.token = { token: d.token, exp: Date.now() + Math.max(60, Number(d.expiresIn) || 600) * 1000 };
  }
  async probe() {
    const orig = this.keyId, ostyle = this.style, all = [];
    const keyVars = orig ? [orig, null] : [null];
    for (const st of ['obj', 'v1']) for (const v of keyVars) {
      this.style = st; this.keyId = v; this.token = null; this.sk = null;
      const r = await this.probe1();
      r.forEach(x => { x.label = (st === 'v1' ? '[روش A] ' : '[روش B] ') + (v ? '[با شناسه کلید] ' : '[بدون شناسه کلید] ') + x.label; x.style = st; x.withKey = !!v; });
      all.push(...r);
      if (r.some(x => x.ok && /توکن/.test(x.label))) return all;
    }
    this.keyId = orig; this.style = ostyle; return all;
  }
  async probe1() {
    const res = [];
    for (const base of V1_BASES[this.env || 'sandbox']) {
      let r; try { r = await this.sync(base, this.mkPacket('GET_SERVER_INFORMATION', null), false); } catch (e) { res.push({ label: base, ok: false, msg: e.message }); continue; }
      let ok = false, msg = ''; try { const d = this.parseSync(r); ok = !!(d && d.publicKeys); if (!ok) msg = 'پاسخ بدون کلید عمومی'; } catch (e) { msg = e.message; }
      res.push({ label: base, ok, status: r.status, msg });
      if (ok) { V1.found[this.env] = base; try { await this.getToken(true); res.push({ label: 'دریافت توکن دسترسی', ok: true }); } catch (e) { res.push({ label: 'دریافت توکن دسترسی', ok: false, msg: e.message }); } break; }
    }
    return res;
  }
  async submit(items) { /* items: [{id, json}] */
    try { await this.getToken(); } catch (e) { return items.map(p => ({ id: p.id, error: e.message, transport: true })); }
    const v1 = this.style === 'v1';
    const packets = items.map(p => { const inv = fullInvoice(p.json); const pk = this.mkPacket('INVOICE.V01', v1 ? JSON.stringify(inv) : inv); pk.dataSignature = v1 ? signText(pk.data, this.key) : signText(normalize(inv, null), this.key); pk.signatureKeyId = this.keyId || null; p.uid = pk.uid; return pk; });
    encryptPackets(packets, this.sk.pub, this.sk.kid);
    const headers = this.hdrs(true);
    const kid = this.keyId;
    if (v1) {
      const w = packets.map(p => { const o = {}; ['uid', 'packetType', 'retry', 'data', 'encryptionKeyId', 'symmetricKey', 'iv', 'fiscalId', 'dataSignature', 'signatureKeyId'].forEach(k => { o[k] = p[k] === undefined ? null : p[k]; }); o.signatureKeyId = kid || null; return o; });
      const bodyStr = JSON.stringify({ signature: null, signatureKeyId: null, packets: w });
      this.v1sign(bodyStr, headers);
      let r1; try { r1 = await this.post(this.base + '/v1/async/normal-enqueue', bodyStr, headers, 120000); } catch (e) { return items.map(p => ({ id: p.id, error: e.message, transport: true })); }
      return this.asyncResult(items, r1);
    }
    const wrapped = packets.map(p => { const o = {}; ['uid', 'packetType', 'retry', 'data', 'encryptionKeyId', 'symmetricKey', 'iv', 'fiscalId', 'dataSignature'].forEach(k => { o[k] = p[k]; }); if (kid) o.signatureKeyId = kid; return o; });
    const sig = signText(normalize(wrapped, headers), this.key);
    const body = { signature: sig, packets: wrapped.map(o => Object.assign({ signatureKeyId: null }, o)) }; if (kid) body.signatureKeyId = kid;
    let r; try { r = await this.post(this.base + '/async/normal-enqueue', body, headers, 120000); } catch (e) { return items.map(p => ({ id: p.id, error: e.message, transport: true })); }
    return this.asyncResult(items, r);
  }
  asyncResult(items, r) {
    if (r.status === 401) { this.token = null; return items.map(p => ({ id: p.id, error: 'توکن منقضی شد؛ دوباره تلاش کنید (HTTP 401).', transport: true })); }
    if (!r.json) return items.map(p => ({ id: p.id, error: 'HTTP ' + r.status + (/<html/i.test(r.text || '') ? ': سرور موقتاً در دسترس نیست.' : ': ' + (r.text || '').slice(0, 200)), transport: r.status >= 500 || r.status === 0 }));
    if (r.json.errors && r.json.errors.length) { const m = r.json.errors.map(e => (e.code ? e.code + ': ' : '') + e.message).join(' | '); return items.map(p => ({ id: p.id, error: m, transport: r.status >= 500 })); }
    const res = r.json.result || [];
    return items.map(p => { const x = res.find(z => z.uid === p.uid) || res[items.indexOf(p)] || {};
      if (x.errorCode || (!x.referenceNumber && !x.uid)) return { id: p.id, uid: p.uid, error: (x.errorCode ? x.errorCode + ': ' : '') + (x.errorDetail || 'پاسخ نامعتبر از سامانه: ' + (r.text || '').slice(0, 200)) };
      return { id: p.id, uid: p.uid, ref: x.referenceNumber || x.uid, error: '' }; });
  }
  async inquire(refs) { /* refs: [{id, ref, uid}] */
    const out = [];
    try { await this.getToken(); } catch (e) { return refs.map(f => ({ id: f.id, state: 'unknown', msg: e.message })); }
    for (const f of refs) {
      let d; try {
        const pk = f.ref ? this.mkPacket('INQUIRY_BY_REFERENCE_NUMBER', { referenceNumber: [f.ref] }) : this.mkPacket('INQUIRY_BY_UID', [{ uid: f.uid, fiscalId: this.memId }]);
        d = this.parseSync(await this.sync(this.base, pk, true));
      } catch (e) { out.push({ id: f.id, state: 'unknown', msg: e.message }); continue; }
      const a = (Array.isArray(d) ? d[0] : d) || {}, dd = a.data || {}, st = String(a.status || '').toUpperCase(); const errs = dd.error || [];
      if (st === 'SUCCESS' || (dd.success === true && st !== 'FAILED' && !errs.length && st !== 'PENDING' && st)) out.push({ id: f.id, state: 'ok' });
      else if (st === 'FAILED' || (Array.isArray(errs) && errs.length) || dd.success === false) out.push({ id: f.id, state: 'fail', msg: JSON.stringify(errs).slice(0, 500) });
      else out.push({ id: f.id, state: 'wait', msg: st });
    }
    return out;
  }
}
async function netTestV1() {
  const out = {};
  for (const env of ['sandbox', 'prod']) {
    const t = Date.now(); let ok = false, status = 0; const lines = [];
    const cands = V1_BASES[env].map(b => b + '/sync/GET_SERVER_INFORMATION');
    for (const u of cands) {
      try { const r = await http(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', timeout: 20000 }); status = r.status; lines.push(u.replace('/sync/GET_SERVER_INFORMATION', '') + ' → HTTP ' + r.status); if (![404, 502, 503, 504].includes(r.status)) { ok = true; break; } }
      catch (e) { lines.push(u.replace('/sync/GET_SERVER_INFORMATION', '') + ' → ' + e.message); }
    }
    out[env] = { ok, status, ms: Date.now() - t, note: ok ? '' : (lines.join(' | ') + ' — اگر 503 است، سرور سازمان موقتاً/برای این مسیر در دسترس نیست؛ شبکه شما مشکلی ندارد.') };
  }
  return out;
}

module.exports = { ClientV1, netTestV1, normalize, encryptPackets, fullInvoice, signText, DIAG, taxId, verhoeff, Client, netTest, jws, jwe, BASES, certB64 };
