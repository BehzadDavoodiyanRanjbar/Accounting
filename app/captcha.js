'use strict';
/* کد امنیتی تصویری (بدون کتابخانه‌ی بیرونی): ۵ رقم که با خطوط برداری رسم می‌شود (متن در SVG نیست تا خواندنش ساده نباشد).
   توکن بدون ذخیره‌ی پاسخ در حافظه امضا می‌شود (HMAC) و فقط یک‌بار قابل‌استفاده است. */
const crypto = require('crypto');
const GL = {
  0: [[[2, 0], [8, 0], [10, 3], [10, 13], [8, 16], [2, 16], [0, 13], [0, 3], [2, 0]]],
  1: [[[2, 4], [5, 0], [5, 16]], [[2, 16], [8, 16]]],
  2: [[[0, 3], [2, 0], [8, 0], [10, 3], [10, 6], [0, 16], [10, 16]]],
  3: [[[0, 2], [2, 0], [8, 0], [10, 3], [8, 7], [4, 8], [8, 9], [10, 13], [8, 16], [2, 16], [0, 14]]],
  4: [[[8, 16], [8, 0], [0, 11], [10, 11]]],
  5: [[[10, 0], [1, 0], [0, 7], [6, 6], [9, 7], [10, 11], [9, 15], [5, 16], [0, 14]]],
  6: [[[9, 1], [4, 0], [0, 5], [0, 13], [3, 16], [8, 16], [10, 13], [10, 10], [8, 8], [3, 8], [0, 10]]],
  7: [[[0, 0], [10, 0], [4, 16]]],
  8: [[[5, 8], [1, 6], [1, 2], [4, 0], [7, 0], [9, 2], [9, 6], [5, 8], [0, 11], [0, 14], [3, 16], [7, 16], [10, 14], [10, 11], [5, 8]]],
  9: [[[1, 15], [6, 16], [10, 11], [10, 3], [7, 0], [2, 0], [0, 3], [0, 6], [2, 8], [7, 8], [10, 6]]]
};
const faToEn = x => String(x == null ? '' : x).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632));
const rnd = (a, b) => a + Math.random() * (b - a);
const COLORS = ['#1f3a5f', '#7a1f3d', '#1b5e3b', '#5b3a8c', '#8a4b0f', '#0f5f73'];

function make(secret, ttlMs) {
  ttlMs = ttlMs || 10 * 60e3;
  const used = new Map();
  setInterval(() => { const n = Date.now(); used.forEach((e, k) => { if (e < n) used.delete(k); }); }, 120e3).unref();
  const mac = (exp, nonce, ans) => crypto.createHmac('sha256', secret).update('cap2|' + exp + '|' + nonce + '|' + ans).digest('hex').slice(0, 32);
  function svg(code) {
    const W = 168, H = 56; let o = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '"><rect width="' + W + '" height="' + H + '" fill="#f4f6fa"/>';
    for (let i = 0; i < 7; i++) o += '<path d="M' + rnd(0, W).toFixed(1) + ' ' + rnd(0, H).toFixed(1) + ' Q' + rnd(0, W).toFixed(1) + ' ' + rnd(0, H).toFixed(1) + ' ' + rnd(0, W).toFixed(1) + ' ' + rnd(0, H).toFixed(1) + '" stroke="' + COLORS[i % COLORS.length] + '" stroke-opacity=".35" stroke-width="1.4" fill="none"/>';
    for (let i = 0; i < 40; i++) o += '<circle cx="' + rnd(0, W).toFixed(1) + '" cy="' + rnd(0, H).toFixed(1) + '" r="' + rnd(.6, 1.4).toFixed(1) + '" fill="#44546a" fill-opacity=".4"/>';
    const n = code.length, cw = W / n;
    for (let i = 0; i < n; i++) {
      const sc = rnd(1.35, 1.8), rot = rnd(-16, 16), cx = cw * i + cw / 2 + rnd(-3, 3), cy = H / 2 + rnd(-3, 3), col = COLORS[Math.floor(Math.random() * COLORS.length)];
      let g = '<g transform="translate(' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ') rotate(' + rot.toFixed(1) + ') scale(' + sc.toFixed(2) + ') translate(-5 -8)" fill="none" stroke="' + col + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">';
      GL[code[i]].forEach(pl => { g += '<polyline points="' + pl.map(p => (p[0] + rnd(-.7, .7)).toFixed(2) + ',' + (p[1] + rnd(-.7, .7)).toFixed(2)).join(' ') + '"/>'; });
      o += g + '</g>';
    }
    for (let i = 0; i < 3; i++) o += '<line x1="' + rnd(0, 20).toFixed(1) + '" y1="' + rnd(8, H - 8).toFixed(1) + '" x2="' + rnd(W - 20, W).toFixed(1) + '" y2="' + rnd(8, H - 8).toFixed(1) + '" stroke="' + COLORS[i] + '" stroke-opacity=".55" stroke-width="1.3"/>';
    return o + '</svg>';
  }
  function gen() {
    let code = ''; for (let i = 0; i < 5; i++) code += crypto.randomInt(0, 10);
    const exp = Date.now() + ttlMs, nonce = crypto.randomBytes(8).toString('hex');
    return { svg: svg(code), tok: exp + '.' + nonce + '.' + mac(exp, nonce, code) };
  }
  /* درست بودن پاسخ؛ توکن در هر حالت مصرف می‌شود (برای پاسخ دیگر باید کد تازه گرفت) */
  function check(tok, ans) {
    const m = /^(\d{10,16})\.([0-9a-f]{16})\.([0-9a-f]{32})$/.exec(String(tok || '')); if (!m || Number(m[1]) < Date.now()) return false;
    if (used.has(m[2])) return false; used.set(m[2], Number(m[1]) + 1000);
    const a = Buffer.from(mac(m[1], m[2], faToEn(ans).replace(/\s/g, ''))), b = Buffer.from(m[3]);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  return { gen, check };
}
module.exports = { make };
