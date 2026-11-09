/**
 * استخراج فیلدهای فیش/لیست بیمه از «متن» خوانده‌شده (OCR یا لایهٔ متنی PDF) با الگوهای کلیدواژه‌ای.
 * هیچ مقداری قطعی نیست: اطمینان همیشه زیر ۰٫۸۵ است تا کاربر بررسی کند. الگوها با نمونه‌های واقعی تنظیم می‌شوند.
 */
import type { InsuranceDoc } from '../rules';
import { faToEn, parseAmount, parseJalaliDate, parsePeriod, similarity } from '../normalize';
import type { Unit } from '../normalize';

const MONTHS = 'فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند';
/** نشانه‌های جهت‌نمای نامرئی که OCR/PDF بین کلمه‌ها می‌گذارد (RLM, LRM, embedding ها) */
export const BIDI = /[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/g;
const NUM = /\d[\d,٬.]*\d|\d/g;

const lineNumbers = (line: string): number[] =>
  (line.match(NUM) ?? []).map((t) => parseAmount(t)).filter((n): n is number => n !== null && n >= 0);

/* ---- مبلغ به حروف (مثلاً «سیصد و سی و شش میلیون و ...») ← عدد؛ برای تطبیق با مبلغ عددی ---- */
const W_UNITS: Record<string, number> = { صفر: 0, یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, هفت: 7, هشت: 8, نه: 9, ده: 10, یازده: 11, دوازده: 12, سیزده: 13, چهارده: 14, پانزده: 15, پونزده: 15, شانزده: 16, شونزده: 16, هفده: 17, هیجده: 18, هجده: 18, نوزده: 19 };
const W_TENS: Record<string, number> = { بیست: 20, سی: 30, چهل: 40, پنجاه: 50, شصت: 60, هفتاد: 70, هشتاد: 80, نود: 90 };
const W_HUNDREDS: Record<string, number> = { صد: 100, یکصد: 100, دویست: 200, سیصد: 300, چهارصد: 400, پانصد: 500, پانصد_: 500, ششصد: 600, هفتصد: 700, هشتصد: 800, نهصد: 900 };
const W_MULT: Record<string, number> = { هزار: 1e3, میلیون: 1e6, میلیارد: 1e9, بیلیون: 1e9, تریلیون: 1e12 };
const W_ALL = [...Object.keys(W_UNITS), ...Object.keys(W_TENS), ...Object.keys(W_HUNDREDS), ...Object.keys(W_MULT)].filter((k) => !k.endsWith('_'));
const W_FIX: Record<string, string> = { بکصد: 'یکصد', یکصد: 'یکصد', پونصد: 'پانصد', پانسد: 'پانصد', هشتسد: 'هشتصد', ششسد: 'ششصد', هفتسد: 'هفتصد', سیسد: 'سیصد', نهسد: 'نهصد', چهارسد: 'چهارصد', میلیبن: 'میلیون', میلبون: 'میلیون', میلیین: 'میلیون', هزارر: 'هزار' };
const isExact = (t: string) => t in W_UNITS || t in W_TENS || t in W_HUNDREDS || t in W_MULT;
/** خروجی OCR گاهی «و» را به کلمهٔ بعد می‌چسباند (وسی، وشش) یا یک حرف را اشتباه می‌خواند؛ هر توکن به کلمهٔ عددی نزدیک نرمال می‌شود */
function normWordTok(t: string): string[] {
  if (t === 'و' || isExact(t)) return [t];
  if (W_FIX[t]) return [W_FIX[t]];
  if (t.length > 2 && t[0] === 'و') {
    const rest = normWordTok(t.slice(1));
    if (rest.length === 1 && isExact(rest[0])) return ['و', rest[0]];
  }
  if (t.length >= 4) {
    let best = '';
    let bs = 0;
    for (const w of W_ALL) {
      const sc = similarity(t, w);
      if (sc > bs) { bs = sc; best = w; }
    }
    if (bs >= 0.8) return [best];
  }
  return [t];
}
const isWordTok = isExact;

export function wordsToNumber(tokens: string[]): number | null {
  let total = 0;
  let cur = 0;
  let any = false;
  for (const t of tokens) {
    if (t === 'و') continue;
    if (t in W_UNITS) cur += W_UNITS[t];
    else if (t in W_TENS) cur += W_TENS[t];
    else if (t in W_HUNDREDS) cur += W_HUNDREDS[t];
    else if (t in W_MULT) {
      total += (cur || 1) * W_MULT[t];
      cur = 0;
    } else return null;
    any = true;
  }
  return any ? total + cur : null;
}

/** طولانی‌ترین رشتهٔ پیوسته از کلمه‌های عددی را پیدا می‌کند و به عدد برمی‌گرداند (هر دو ترتیب خواندن: چپ‌به‌راست و برعکس) */
export function amountRuns(text: string): Array<{ value: number; n: number; rev: boolean }> {
  const toks = text.replace(/[،,:؛()]/g, ' ').split(/\s+/).filter(Boolean).flatMap(normWordTok);
  const runs: string[][] = [];
  let cur: string[] = [];
  for (const t of toks) {
    if (isWordTok(t) || (t === 'و' && cur.length)) cur.push(t);
    else {
      if (cur.length) runs.push(cur);
      cur = [];
    }
  }
  if (cur.length) runs.push(cur);
  const out: Array<{ value: number; n: number; rev: boolean }> = [];
  for (const r of runs) {
    const run = r.filter((_, i) => !(r[i] === 'و' && (i === 0 || i === r.length - 1)));
    const n = run.filter((t) => t !== 'و').length;
    if (n < 3) continue;
    [wordsToNumber(run), wordsToNumber([...run].reverse())].forEach((v, k) => { if (v !== null && v >= 1000) out.push({ value: v, n, rev: k === 1 }); });
  }
  return out;
}
export const amountsInWords = (text: string): number[] => amountRuns(text).map((r) => r.value);


/** عدد ← کلمه‌های فارسی (بدون «و»)؛ برای سنجش شباهت با مبلغ حروفیِ خوانده‌شده */
export function numberToWordTokens(n: number): string[] {
  const U = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه', 'ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
  const T = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
  const H = ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
  const grp = (g: number): string[] => {
    const out: string[] = [];
    if (H[Math.floor(g / 100)]) out.push(H[Math.floor(g / 100)]);
    const r = g % 100;
    if (r < 20) { if (U[r]) out.push(U[r]); } else { out.push(T[Math.floor(r / 10)]); if (U[r % 10]) out.push(U[r % 10]); }
    return out;
  };
  const parts: Array<[number, string]> = [[1e9, 'میلیارد'], [1e6, 'میلیون'], [1e3, 'هزار'], [1, '']];
  const out: string[] = [];
  let rest = Math.floor(n);
  for (const [v, name] of parts) {
    const g = Math.floor(rest / v) % 1000;
    rest -= g * v;
    if (!g) continue;
    out.push(...(g === 1 && name === 'هزار' ? [] : grp(g)), ...(name ? [name] : []));
  }
  return out;
}

/** چند درصد از کلمه‌های درستِ مبلغ در متن حروفی پیدا می‌شود (با تحمل غلط OCR) */
export function wordsMatchScore(n: number, text: string): number {
  const need = numberToWordTokens(n);
  if (!need.length) return 0;
  const have = text.replace(/[،,:؛()]/g, ' ').split(/\s+/).filter(Boolean).flatMap(normWordTok).filter((t) => t !== 'و');
  let pos = 0;
  let hit = 0;
  for (const w of need) {
    const i = have.findIndex((h, k) => k >= pos && (h === w || (h.length >= 3 && similarity(h, w) >= 0.75)));
    if (i >= 0) { pos = i + 1; hit++; }
  }
  return hit / need.length;
}

/** عددی که نزدیک برچسب آمده (در همان خط یا دو خط بعد) */
function numberNear(lines: string[], label: RegExp, min = 1000): number | null {
  for (let i = 0; i < lines.length; i++) {
    if (!label.test(lines[i])) continue;
    for (let k = i; k <= Math.min(i + 2, lines.length - 1); k++) {
      const n = lineNumbers(k === i ? lines[i].replace(label, ' ') : lines[k]).filter((x) => x >= min);
      if (n.length) return n[0];
    }
  }
  return null;
}

export interface FoundFields {
  amount: boolean;
  trackingNo: boolean;
  date: boolean;
  period: boolean;
}

export function insuranceFromText(raw: string): { doc: InsuranceDoc; found: FoundFields } {
  const text = faToEn(raw).replace(BIDI, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\u200d\u0640]/g, '').replace(/[ \t]+/g, ' ');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  /* مبلغ: ۱) عدد کنار «مبلغ حق بیمه پرداخت‌شده / مبلغ قابل پرداخت»؛ ۲) مبلغ به حروف؛ هرگز «بزرگ‌ترین عدد» یا «جمع دستمزد» حدس زده نمی‌شود */
  const LABEL = /(?:مبلغ\s*(?:کل\s*)?(?:حق\s*بیمه\s*)?(?:پرداخت\s*شده|پرداختی|قابل\s*پرداخت|واریز(?:ی|شده)?)\s*(?:به\s*عدد)?|مبلغ\s*حق\s*بیمه)[\s:]*/;
  const amountLines = lines.filter((l) => !/(حروف|دستمزد|مزایا|جریمه|دیرکرد)/.test(l) || /به\s*عدد/.test(l));
  const digits =
    numberNear(amountLines, /به\s*عدد/, 10000) ??
    numberNear(amountLines, LABEL, 10000) ??
    (() => { const l = amountLines.find((x) => /پرداخت\s*شده/.test(x) && !/حروف/.test(x)); return l ? (lineNumbers(l).find((n) => n >= 10000) ?? null) : null; })();
  const runs = amountRuns(text);
  const words = runs.map((r) => r.value);
  const wordLines = lines.some((l) => /حروف/.test(l))
    ? lines.map((l, i) => (/حروف/.test(l) ? [l, lines[i + 1] ?? ''].join(' ') : '')).filter(Boolean).join(' ')
    : text;
  let amount = 0;
  let agree = false;
  let clash = false;
  if (digits) {
    amount = digits;
    // مبلغ حروفیِ کاملاً خوانده‌شده که عدد دیگری بدهد = ناهمخوانی (مثلاً یک رقم اشتباه)
    const other = words.filter((w) => w !== digits && w > digits / 10 && w < digits * 10 && wordsMatchScore(w, wordLines) >= 0.9);
    if (words.includes(digits)) agree = true;
    else if (other.length) clash = true;
    else agree = wordsMatchScore(digits, wordLines) >= 0.8;
    if (!agree && words.length) {
      // گاهی ترتیب ارقام در لایهٔ متنی PDF وارونه است؛ اگر وارونهٔ آن با مبلغ حروفی بخواند، همان درست است
      const rev = Number(String(digits).split('').reverse().join(''));
      if (words.includes(rev)) {
        amount = rev;
        agree = true;
        clash = false;
      }
    }
  } else if (runs.length) {
    amount = [...runs].sort((x, y) => y.n - x.n || Number(x.rev) - Number(y.rev))[0].value;
  }

  let penalty = 0;
  for (const l of lines) {
    if (/(جریمه|دیرکرد|خسارت)/.test(l)) {
      const n = lineNumbers(l).filter((x) => x >= 1000);
      if (n.length) penalty = Math.max(penalty, ...n);
    }
  }

  const rc = /(?:رسید\s*دیجیتال(?:\s*پرداخت)?|شماره\s*رسید)[^\d\n]{0,25}(\d{4,})/.exec(text);
  const trk = rc ?? /(?:پیگیری|مرجع|ارجاع|رهگیری)(?!\s*لیست)[^\d\n]{0,25}(\d{5,})/.exec(text);
  const trackingNo = trk ? trk[1] : '';

  const lst = /(?:پیگیری\s*لیست|کد\s*لیست|شماره\s*لیست)[^\d\n]{0,15}(\d{3,12})/.exec(text) ?? /لیست[^\d\n]{0,12}(\d{1,9})/.exec(text);
  const listNo = lst ? lst[1] : '';

  let date = '';
  const pd = /تاریخ\s*(?:پرداخت|واریز)[^\d\n]{0,15}(\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})/.exec(text);
  if (pd) date = parseJalaliDate(pd[1])?.j ?? '';
  if (!date) for (const m of text.matchAll(/(\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})/g)) {
    const d = parseJalaliDate(m[1]);
    if (d) {
      date = d.j;
      break;
    }
  }
  if (!date) {
    const m = new RegExp(`(\\d{1,2})\\s+(${MONTHS})\\s+(\\d{4})`).exec(text);
    const d = m ? parseJalaliDate(`${m[1]} ${m[2]} ${m[3]}`) : null;
    if (d) date = d.j;
  }

  let period = '';
  const MW = `(${MONTHS})`;
  const pm = new RegExp(`(?:^|[\\s:])${MW}\\s*(?:ماه)?\\s*(\\d{4})(?!\\d)`).exec(text);
  if (pm) period = parsePeriod(`${pm[1]} ${pm[2]}`) ?? '';
  if (!period) {
    // «ماه: مهر» یا «مهر :ماه»؛ سال از همان خط یا خط «سال» یا تاریخ پرداخت
    const ml = lines.find((l) => new RegExp(`(?:^|[\\s:])ماه\\s*:?\\s*${MW}(?=[\\s:]|$)|(?:^|[\\s:])${MW}\\s*:?\\s*ماه(?=[\\s:]|$)`).test(l));
    const mm = ml ? new RegExp(`(?:^|[\\s:])${MW}(?=[\\s:]|$)`).exec(ml.replace(/ماه/g, ' ')) : null;
    const yearIn = (l?: string) => (l ? /(?<!\d)(1[34]\d\d)(?!\d)/.exec(l)?.[1] : undefined);
    const yy = yearIn(ml) ?? yearIn(lines.find((l) => /سال/.test(l))) ?? (date ? date.slice(0, 4) : undefined);
    if (mm && yy) period = parsePeriod(`${mm[1]} ${yy}`) ?? '';
  }
  if (!period) {
    // سرستون‌ها ممکن است در خط‌های جدا خوانده شوند
    const flat = text.replace(/\n/g, ' ');
    const m1 = new RegExp(`ماه\\s*:?\\s*${MW}(?=[\\s:]|$)`).exec(flat) ?? new RegExp(`(?:^|[\\s:])${MW}\\s*:?\\s*ماه(?=[\\s:]|$)`).exec(flat);
    const y1 = /سال\s*:?\s*(1[34]\d\d)/.exec(flat)?.[1] ?? /(1[34]\d\d)\s*:?\s*سال/.exec(flat)?.[1] ?? (date ? date.slice(0, 4) : undefined);
    if (m1 && y1) period = parsePeriod(`${m1[1]} ${y1}`) ?? '';
  }
  if (!period) {
    const q = /(?:ماه|دوره)[^\d\n]{0,12}(\d{1,2})[^\d\n]{1,8}(\d{4})/.exec(text);
    if (q) period = parsePeriod(`${q[2]}/${q[1]}`) ?? '';
  }

  const pay = /(?:نام\s*کارگاه|نام\s*کارفرما|پرداخت\s*کننده|کارفرما|کارگاه)[:\s]+([^\n\d]{3,60})/.exec(text);
  const payerName = (pay ? pay[1] : '').replace(/کد\s*کارگاه.*$/, '').replace(/[:\s]+$/, '').trim();

  const rial = /ریال/.test(text);
  const toman = /تومان/.test(text);
  const unit: Unit = rial && !toman ? 'rial' : toman && !rial ? 'toman' : 'unknown';

  const found: FoundFields = { amount: amount > 0, trackingNo: !!trackingNo, date: !!date, period: !!period };
  const conf = !found.amount ? 0.3 : clash ? 0.5 : !found.trackingNo ? 0.55 : agree ? 0.84 : 0.7;
  return { doc: { payerName, amount, penalty, date, trackingNo, listNo, periodMonth: period, unit, conf, confirmed: false, diffMode: 'payable' }, found };
}
