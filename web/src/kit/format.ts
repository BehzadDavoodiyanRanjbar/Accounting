import type { Opt } from './types';

export const str = (v: unknown): string => (v == null ? '' : String(v));

/** جداکنندهٔ سه‌رقمی؛ پیش‌فرض بدون اعشار (مبالغ). برای مقدار کالا از fmtQty استفاده شود. منفی‌ها برای نمایش درست در متن راست‌به‌چپ ایزوله می‌شوند. */
export const fmtNum = (v: unknown, digits = 0): string => {
  if (v === '' || v == null) return '';
  const n = Number(String(v).replace(/,/g, ''));
  if (!Number.isFinite(n)) return str(v);
  const s = n.toLocaleString('en-US', { maximumFractionDigits: digits });
  if (/^-0(\.0*)?$/.test(s)) return '0';
  return s.startsWith('-') ? `\u2066${s}\u2069` : s;
};

/** مقدار کالا (تا ۳ رقم اعشار در صورت لزوم) */
export const fmtQty = (v: unknown): string => fmtNum(v, 3);

export const toOpts = (m?: Record<string, string>): Opt[] => Object.entries(m ?? {}).map(([value, label]) => ({ value, label }));

export const JALALI = /^\d{4}\/\d{2}\/\d{2}$/;

/** میلادی ← شمسی */
export function toJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + gdm[gm - 1];
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
}

const p2 = (n: number) => String(n).padStart(2, '0');

/** تاریخ امروز شمسی به شکل 1405/08/10 */
export function todayJalali(): string {
  const d = new Date();
  const [y, m, day] = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return `${y}/${p2(m)}/${p2(day)}`;
}

/** دورهٔ جاری شمسی به شکل 1405/08 */
export const thisPeriod = (): string => todayJalali().slice(0, 7);
