'use strict';
/* رمزگذاری «در حالت ذخیره» برای مقدارهای حساس (کلید خصوصی/گواهی شرکت‌ها، کلید هوش مصنوعی، راز نشست).
   با تنظیم DATA_KEY (۶۴ نویسه‌ی هگز = ۳۲ بایت) فعال می‌شود؛ الگوریتم AES-256-GCM. بدون DATA_KEY مقدارها مثل قبل ذخیره می‌شوند. */
const crypto = require('crypto');
const SENS = /^(PK_|CERT_|ANTHROPIC_KEY|AuthSecret$)/, PFX = 'enc1:';
function keyFrom(env) {
  const h = String((env || process.env).DATA_KEY || '').trim(); if (!h) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(h)) throw new Error('DATA_KEY باید دقیقاً ۶۴ نویسه‌ی هگز (۰-۹ و a-f) باشد.');
  return Buffer.from(h, 'hex');
}
function make(env) {
  const key = keyFrom(env);
  return {
    enabled: !!key, isSensitive: k => SENS.test(k),
    wrap(k, v) {
      if (!key || v === undefined || !SENS.test(k) || String(v).startsWith(PFX)) return v;
      const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key, iv); c.setAAD(Buffer.from(k));
      const ct = Buffer.concat([c.update(String(v), 'utf8'), c.final()]);
      return PFX + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
    },
    unwrap(k, v) {
      if (typeof v !== 'string' || !v.startsWith(PFX)) return v;
      if (!key) throw new Error('اطلاعات حساس در پایگاه‌داده رمزگذاری شده‌اند ولی DATA_KEY تنظیم نشده است. کلید درست را در تنظیمات سرویس بگذارید (بدون آن برنامه عمداً بالا نمی‌آید).');
      try {
        const b = Buffer.from(v.slice(PFX.length), 'base64'), d = crypto.createDecipheriv('aes-256-gcm', key, b.subarray(0, 12)); d.setAAD(Buffer.from(k)); d.setAuthTag(b.subarray(12, 28));
        return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
      } catch (e) { throw new Error('رمزگشایی «' + k + '» ناموفق بود؛ DATA_KEY با کلید زمان رمزگذاری یکی نیست.'); }
    }
  };
}
module.exports = { make };
