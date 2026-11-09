'use strict';
/* ارسال ایمیل با SMTP (بدون وابستگی بیرونی): TLS مستقیم (پورت ۴۶۵) یا STARTTLS (پورت ۵۸۷) یا ساده (فقط شبکه‌ی داخلی).
   تنظیمات از متغیرهای محیطی: SMTP_HOST، SMTP_PORT، SMTP_SECURE، SMTP_USER، SMTP_PASS، SMTP_FROM، SMTP_FROM_NAME، SMTP_HELO، SMTP_TLS_REJECT_UNAUTH */
const net = require('net'), tls = require('tls'), os = require('os'), crypto = require('crypto');
const flag = (v, d) => v === undefined || v === '' ? d : /^(1|true|yes|on)$/i.test(String(v));

function config(env) {
  const host = String(env.SMTP_HOST || '').trim(), port = Number(env.SMTP_PORT || (flag(env.SMTP_SECURE, false) ? 465 : 587));
  const user = String(env.SMTP_USER || ''), from = String(env.SMTP_FROM || user || '').trim();
  return { enabled: !!(host && from), host, port, secure: flag(env.SMTP_SECURE, port === 465), user, pass: String(env.SMTP_PASS || ''), from, fromName: String(env.SMTP_FROM_NAME || ''), helo: String(env.SMTP_HELO || '').replace(/[^A-Za-z0-9.\-]/g, '') || (os.hostname().replace(/[^A-Za-z0-9.\-]/g, '') || 'localhost'), reject: flag(env.SMTP_TLS_REJECT_UNAUTH, true), timeout: Number(env.SMTP_TIMEOUT_MS || 20000) };
}
const clean = s => { s = String(s == null ? '' : s); if (/[\r\n\0]/.test(s)) throw new Error('مقدار نامعتبر در سرآیند ایمیل'); return s; };
const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const wrap = s => s.replace(/(.{76})/g, '$1\r\n');
const enc = s => /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + b64(s) + '?=';
function build(cfg, o) {
  const to = clean(o.to), subject = clean(o.subject), from = clean(cfg.from), bnd = 'b' + crypto.randomBytes(12).toString('hex');
  const fromHdr = cfg.fromName ? enc(clean(cfg.fromName)) + ' <' + from + '>' : from;
  const dom = (from.split('@')[1] || 'localhost');
  const h = ['From: ' + fromHdr, 'To: ' + to, 'Subject: ' + enc(subject), 'Date: ' + new Date().toUTCString().replace('GMT', '+0000'), 'Message-ID: <' + crypto.randomBytes(12).toString('hex') + '@' + dom + '>', 'MIME-Version: 1.0', 'Content-Type: multipart/alternative; boundary="' + bnd + '"'];
  const part = (type, body) => '--' + bnd + '\r\nContent-Type: ' + type + '; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + wrap(b64(body)) + '\r\n';
  return h.join('\r\n') + '\r\n\r\n' + part('text/plain', o.text || '') + part('text/html', o.html || '') + '--' + bnd + '--\r\n';
}
function send(cfg, o) {
  try { clean(o.to); clean(o.subject); clean(cfg.from); if (!/^[^\s@<>]+@[^\s@<>]+$/.test(o.to) || !/^[^\s@<>]+@[^\s@<>]+$/.test(cfg.from)) throw new Error('نشانی ایمیل نامعتبر است'); } catch (e) { return Promise.reject(e); }
  return new Promise((resolve, reject) => {
    let sock, buf = '', waiters = [], done = false, tlsUp = cfg.secure;
    const fail = e => { if (done) return; done = true; try { sock && sock.destroy(); } catch (x) { } reject(e instanceof Error ? e : new Error(String(e))); };
    const timer = setTimeout(() => fail(new Error('زمان اتصال به سرور ایمیل تمام شد.')), cfg.timeout);
    const finish = () => { if (done) return; done = true; clearTimeout(timer); try { sock.destroy(); } catch (x) { } resolve(true); };
    const feed = d => {
      buf += d.toString('utf8');
      for (; ;) {
        const lines = buf.split('\r\n'); if (lines.length < 2) return;
        let n = -1; for (let i = 0; i < lines.length - 1; i++) if (/^\d{3} /.test(lines[i]) || /^\d{3}$/.test(lines[i])) { n = i; break; }
        if (n < 0) return;
        const reply = lines.slice(0, n + 1); buf = lines.slice(n + 1).join('\r\n');
        const w = waiters.shift(); if (w) w({ code: Number(reply[n].slice(0, 3)), lines: reply });
      }
    };
    const attach = s => { s.on('data', feed); s.on('error', fail); s.on('close', () => { if (!done) fail(new Error('اتصال با سرور ایمیل قطع شد.')); }); };
    const read = () => new Promise(r => waiters.push(r));
    const cmd = async (line, ok) => { sock.write(line + '\r\n'); const r = await read(); if (ok.indexOf(r.code) < 0) throw new Error('سرور ایمیل پاسخ نامعتبر داد: ' + r.lines[r.lines.length - 1].slice(0, 120)); return r; };
    (async () => {
      sock = cfg.secure ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host, rejectUnauthorized: cfg.reject }) : net.connect({ host: cfg.host, port: cfg.port });
      attach(sock);
      let r = await read(); if (r.code !== 220) throw new Error('سرور ایمیل آماده نیست: ' + r.lines[0].slice(0, 120));
      r = await cmd('EHLO ' + cfg.helo, [250]);
      const has = k => r.lines.some(l => new RegExp('^250[ -]' + k, 'i').test(l));
      if (!tlsUp && has('STARTTLS')) {
        await cmd('STARTTLS', [220]);
        sock.removeAllListeners('data'); sock.removeAllListeners('close'); sock.removeAllListeners('error');
        buf = ''; waiters = [];
        sock = tls.connect({ socket: sock, servername: cfg.host, rejectUnauthorized: cfg.reject }); attach(sock); tlsUp = true;
        await new Promise((res, rej) => { sock.once('secureConnect', res); sock.once('error', rej); });
        r = await cmd('EHLO ' + cfg.helo, [250]);
      }
      if (cfg.user) {
        if (!tlsUp && !/^(127\.|localhost$|::1$)/.test(cfg.host)) throw new Error('سرور ایمیل رمزگذاری (TLS) ندارد؛ برای امنیت رمز ارسال نمی‌شود.');
        if (has('AUTH.*PLAIN')) await cmd('AUTH PLAIN ' + b64('\0' + cfg.user + '\0' + cfg.pass), [235]);
        else { await cmd('AUTH LOGIN', [334]); await cmd(b64(cfg.user), [334]); await cmd(b64(cfg.pass), [235]); }
      }
      await cmd('MAIL FROM:<' + clean(cfg.from) + '>', [250]);
      await cmd('RCPT TO:<' + clean(o.to) + '>', [250, 251]);
      await cmd('DATA', [354]);
      const msg = build(cfg, o).replace(/\r\n\./g, '\r\n..');
      sock.write(msg + '\r\n.\r\n'); r = await read(); if (r.code !== 250) throw new Error('سرور ایمیل پیام را نپذیرفت: ' + r.lines[r.lines.length - 1].slice(0, 120));
      try { sock.write('QUIT\r\n'); } catch (x) { }
      finish();
    })().catch(fail);
  });
}
module.exports = { config, send, build };
