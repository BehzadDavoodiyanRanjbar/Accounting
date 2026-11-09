'use strict';
/* احراز هویت: رمز با scrypt، نشست با توکن امضاشده (HMAC) بدون ذخیره در حافظه */
const crypto = require('crypto');

const hashPassword = (pw) => { const salt = crypto.randomBytes(16); const h = crypto.scryptSync(String(pw), salt, 64); return 's1$' + salt.toString('base64') + '$' + h.toString('base64'); };
const DUMMY = hashPassword('dummy-password-for-timing');
function verifyPassword(pw, stored) {
  try {
    const p = String(stored || DUMMY).split('$'); if (p[0] !== 's1' || p.length !== 3) return false;
    const salt = Buffer.from(p[1], 'base64'), want = Buffer.from(p[2], 'base64');
    const got = crypto.scryptSync(String(pw), salt, want.length);
    return crypto.timingSafeEqual(got, want) && !!stored;
  } catch (e) { return false; }
}
const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const pwTag = stored => crypto.createHash('sha256').update(String(stored || '')).digest('hex').slice(0, 10);

function signToken(secret, user, ttlMs) {
  const body = b64u(JSON.stringify({ u: user.UserID, e: Date.now() + ttlMs, p: pwTag(user.PasswordHash) }));
  const mac = b64u(crypto.createHmac('sha256', secret).update(body).digest());
  return body + '.' + mac;
}
/* برمی‌گرداند: { userId, pwTag } یا null */
function readToken(secret, token) {
  const parts = String(token || '').split('.'); if (parts.length !== 2) return null;
  const mac = b64u(crypto.createHmac('sha256', secret).update(parts[0]).digest());
  const a = Buffer.from(mac), b = Buffer.from(parts[1]); if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let o; try { o = JSON.parse(fromB64u(parts[0]).toString('utf8')); } catch (e) { return null; }
  if (!o || !o.u || !(o.e > Date.now())) return null;
  return { userId: o.u, pwTag: o.p };
}

/* محدودیت تلاش ناموفق ورود */
const fails = new Map();
const LIM = 6, LOCK = 10 * 60 * 1000;
function lockLeft(key) { const f = fails.get(key); if (!f) return 0; if (f.until && f.until > Date.now()) return f.until - Date.now(); if (f.until && f.until <= Date.now()) fails.delete(key); return 0; }
function noteFail(key) { const f = fails.get(key) || { n: 0 }; f.n++; if (f.n >= LIM) { f.until = Date.now() + LOCK; f.n = 0; } fails.set(key, f); }
function clearFails(key) { fails.delete(key); }

/* محدودیت تعداد درخواست در بازه‌ی زمانی (مثلاً برای هر IP). true یعنی از حد گذشته است. */
const hits = new Map();
function rate(key, max, windowMs) {
  const now = Date.now(); let a = hits.get(key); if (!a) { a = []; hits.set(key, a); }
  while (a.length && a[0] <= now - windowMs) a.shift();
  if (a.length >= max) return true; a.push(now); return false;
}
setInterval(() => { const now = Date.now(); hits.forEach((a, k) => { if (!a.length || a[a.length - 1] < now - 3600e3) hits.delete(k); }); }, 600e3).unref();

function checkPasswordRule(pw) {
  pw = String(pw || '');
  if (pw.length < 8) return 'رمز عبور باید حداقل ۸ کاراکتر باشد.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'رمز عبور باید هم حرف انگلیسی و هم عدد داشته باشد.';
  return '';
}
module.exports = { hashPassword, verifyPassword, signToken, readToken, pwTag, lockLeft, noteFail, clearFails, rate, checkPasswordRule };
