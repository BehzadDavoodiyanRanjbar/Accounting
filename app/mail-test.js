'use strict';
/* آزمایش ارسال ایمیل با تنظیمات SMTP محیط:  node mail-test.js you@example.com */
const mailer = require('./mailer');
const to = process.argv[2], cfg = mailer.config(process.env);
if (!cfg.enabled) { console.log('ERROR: SMTP_HOST / SMTP_FROM (or SMTP_USER) are not set.'); process.exit(2); }
if (!to) { console.log('Usage: node mail-test.js you@example.com'); process.exit(2); }
console.log('Sending a test e-mail via ' + cfg.host + ':' + cfg.port + (cfg.secure ? ' (SSL)' : ' (STARTTLS if offered)') + ' from ' + cfg.from + ' to ' + to + ' ...');
mailer.send(cfg, { to, subject: 'ایمیل آزمایشی — حسابداری ۶ سطحی معین تراز', text: 'این یک ایمیل آزمایشی است. اگر آن را می‌بینید، تنظیمات ایمیل درست است.', html: '<p dir="rtl">این یک ایمیل آزمایشی است. اگر آن را می‌بینید، تنظیمات ایمیل درست است.</p>' })
  .then(() => { console.log('OK: the server accepted the message. Check the inbox (and the spam folder).'); process.exit(0); })
  .catch(e => { console.log('ERROR: ' + (e && e.message)); process.exit(1); });
