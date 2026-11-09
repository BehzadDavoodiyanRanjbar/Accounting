/**
 * نرمال‌سازی داده‌های استخراج‌شده از اسناد فارسی (توابع خالص و آزمون‌شده).
 * هر متن استخراج‌شده «داده نامعتبر تا تأیید انسان» است.
 */
import { toJalali } from '../../kit/format';

export type Unit = 'rial' | 'toman' | 'unknown';

const P = '۰۱۲۳۴۵۶۷۸۹';
const A = '٠١٢٣٤٥٦٧٨٩';

/** ارقام فارسی و عربی-هندی ← ASCII */
export function faToEn(s: unknown): string {
  return String(s ?? '').replace(/[۰-۹٠-٩]/g, (c) => {
    const i = P.indexOf(c);
    return String(i >= 0 ? i : A.indexOf(c));
  });
}

/** برای مقایسهٔ نام‌ها: ي→ی، ك→ک، حذف نیم‌فاصله و کشیده، ارقام ASCII، فاصلهٔ یکنواخت */
export function normName(s: unknown): string {
  return faToEn(s)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌‍ـً-ْ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** رشتهٔ مبلغ ← عدد. «٬» و «,» همیشه جداکنندهٔ هزارگان‌اند؛ «.» فقط وقتی هزارگان است که همهٔ گروه‌ها سه‌رقمی باشند؛ «٫» اعشار است. نامعتبر = null */
export function parseAmount(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const src = faToEn(raw);
  const persianDec = /٫/.test(src);
  let s = src.replace(/[\s\u200c\u00a0]/g, '').replace(/[٬,،']/g, '').replace(/٫/g, '.');
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith('-')) {
    neg = !neg;
    s = s.slice(1);
  }
  // «۱.۲۳۴.۵۶۷» یا «۱.۲۳۴» (گروه‌های سه‌رقمی) هزارگان است نه اعشار، مگر اعشار فارسی «٫» به‌کار رفته یا با صفر شروع شود
  if (!persianDec && /^[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

/** گرد کردن «نیم به بالا» به ریال صحیح (برای مقادیر مثبت و منفی متقارن) */
export const roundHalfUp = (n: number): number => (n < 0 ? -Math.round(-n + 1e-9) : Math.round(n + 1e-9));

/** تومان ← ریال فقط بعد از انتخاب صریح کاربر (×۱۰)؛ واحد نامشخص = خطا */
export function toRial(amount: number, unit: Unit): number {
  if (unit === 'unknown') throw new Error('واحد مبلغ مشخص نیست.');
  return roundHalfUp(unit === 'toman' ? amount * 10 : amount);
}

/* ---------- تاریخ شمسی ---------- */
const MONTHS: Record<string, number> = {
  فروردین: 1, اردیبهشت: 2, خرداد: 3, تیر: 4, مرداد: 5, شهریور: 6, مهر: 7, آبان: 8, آذر: 9, دی: 10, بهمن: 11, اسفند: 12,
};

/** شمسی ← میلادی (الگوریتم استاندارد jalaali) */
export function jalaliToGregorian(jy0: number, jm: number, jd: number): [number, number, number] {
  const jy = jy0 + 1595;
  let days = -355668 + 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 0; gm < 13 && gd > sal[gm]; gm++) gd -= sal[gm];
  return [gy, gm, gd];
}

const p2 = (n: number) => String(n).padStart(2, '0');

export interface ParsedDate {
  /** 1405/08/16 */
  j: string;
  /** 2026-11-07 */
  iso: string;
}

/** ۱۴۰۵/۰۸/۱۶، 1405-08-16، ۱۶ آبان ۱۴۰۵ ← تاریخ؛ تاریخ ناممکن = null */
export function parseJalaliDate(raw: unknown): ParsedDate | null {
  const s = normName(raw);
  let y = 0;
  let m = 0;
  let d = 0;
  let x = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(s);
  if (x) [y, m, d] = [Number(x[1]), Number(x[2]), Number(x[3])];
  else {
    x = /^(\d{1,2})\s+(\S+)\s+(\d{4})$/.exec(s);
    if (!x || !MONTHS[x[2]]) return null;
    [d, m, y] = [Number(x[1]), MONTHS[x[2]], Number(x[3])];
  }
  if (y < 1200 || y > 1600 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const [gy, gm, gd] = jalaliToGregorian(y, m, d);
  const back = toJalali(gy, gm, gd);
  if (back[0] !== y || back[1] !== m || back[2] !== d) return null; // مثلاً ۳۰ اسفند در سال کبیسه‌نبودن
  return { j: `${y}/${p2(m)}/${p2(d)}`, iso: `${gy}-${p2(gm)}-${p2(gd)}` };
}

/** دورهٔ حقوق «مهر ۱۴۰۵» یا «1405/07» ← 1405/07 */
export function parsePeriod(raw: unknown): string | null {
  const s = normName(raw);
  let x = /^(\d{4})[/\-.](\d{1,2})$/.exec(s);
  if (x) return Number(x[2]) >= 1 && Number(x[2]) <= 12 ? `${x[1]}/${p2(Number(x[2]))}` : null;
  x = /^(\S+)\s+(\d{4})$/.exec(s);
  if (x && MONTHS[x[1]]) return `${x[2]}/${p2(MONTHS[x[1]])}`;
  x = /^(\d{4})\s+(\S+)$/.exec(s);
  if (x && MONTHS[x[2]]) return `${x[1]}/${p2(MONTHS[x[2]])}`;
  return null;
}

/* ---------- شبا و کد ملی ---------- */
/** IR + ۲۴ رقم با کنترل mod-97 (ISO 7064) */
export function isValidIban(raw: unknown): boolean {
  const s = faToEn(raw).replace(/[\s-]/g, '').toUpperCase();
  if (!/^IR\d{24}$/.test(s)) return false;
  const r = s.slice(4) + s.slice(0, 4);
  const digits = r.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (let i = 0; i < digits.length; i += 7) rem = Number(String(rem) + digits.slice(i, i + 7)) % 97;
  return rem === 1;
}

/** کد ملی ۱۰ رقمی با رقم کنترل */
export function isValidNationalCode(raw: unknown): boolean {
  const s = faToEn(raw).replace(/\s/g, '');
  if (!/^\d{10}$/.test(s) || /^(\d)\1{9}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(s[i]) * (10 - i);
  const r = sum % 11;
  const c = Number(s[9]);
  return r < 2 ? c === r : c === 11 - r;
}

/* ---------- تطبیق نام ---------- */
function lev(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= n; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[n];
}

/** شباهت ۰ تا ۱ بین دو نام (پس از نرمال‌سازی) */
export function similarity(a: string, b: string): number {
  const x = normName(a);
  const y = normName(b);
  if (!x && !y) return 1;
  const L = Math.max(x.length, y.length);
  return L ? 1 - lev(x, y) / L : 1;
}

export interface Person {
  key: string;
  name: string;
  nationalCode?: string;
  iban?: string;
}
export type MatchHow = 'exact' | 'nationalCode' | 'iban' | 'fuzzy';
export interface Match {
  person: Person;
  how: MatchHow;
  /** فقط تطبیق دقیق به‌صورت خودکار تأییدشده است؛ تطبیق تقریبی همیشه نیاز به تأیید انسان دارد */
  auto: boolean;
}

/** نام کامل ← کد ملی ← شبا ← تطبیق تقریبی (شباهت ≥ ۰٫۸۵، هرگز خودکار تأیید نمی‌شود) */
export function matchPerson(q: { name?: string; nationalCode?: string; iban?: string }, people: Person[]): Match | null {
  const nm = normName(q.name);
  if (nm) {
    const e = people.find((p) => normName(p.name) === nm);
    if (e) return { person: e, how: 'exact', auto: true };
  }
  const nc = faToEn(q.nationalCode).replace(/\s/g, '');
  if (nc) {
    const e = people.find((p) => p.nationalCode && faToEn(p.nationalCode).replace(/\s/g, '') === nc);
    if (e) return { person: e, how: 'nationalCode', auto: true };
  }
  const ib = faToEn(q.iban).replace(/[\s-]/g, '').toUpperCase();
  if (ib) {
    const e = people.find((p) => p.iban && faToEn(p.iban).replace(/[\s-]/g, '').toUpperCase() === ib);
    if (e) return { person: e, how: 'iban', auto: true };
  }
  if (nm) {
    let best: Person | null = null;
    let bs = 0;
    for (const p of people) {
      const sc = similarity(nm, p.name);
      if (sc > bs) {
        bs = sc;
        best = p;
      }
    }
    if (best && bs >= 0.85) return { person: best, how: 'fuzzy', auto: false };
  }
  return null;
}
