import { str } from '../../kit/format';
import type { Row } from '../../kit/types';
import { openPrintWindow, PRINT_VOUCHER_BOOT } from '../print/legacyPrint';

const ONES = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه', 'ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const HUND = ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
const SCALE = ['', 'هزار', 'میلیون', 'میلیارد', 'هزار میلیارد'];

function below1000(n: number): string {
  const p: string[] = [];
  if (n >= 100) p.push(HUND[Math.floor(n / 100)]);
  n %= 100;
  if (n >= 20) {
    p.push(TENS[Math.floor(n / 10)]);
    if (n % 10) p.push(ONES[n % 10]);
  } else if (n > 0) p.push(ONES[n]);
  return p.join(' و ');
}

/** عدد ← حروف فارسی (برای مبلغ کل سند) */
export function words(v: number): string {
  let n = Math.round(Math.abs(v));
  if (!n) return 'صفر';
  const parts: string[] = [];
  let i = 0;
  while (n > 0 && i < SCALE.length) {
    const g = n % 1000;
    if (g) parts.unshift(`${below1000(g)}${SCALE[i] ? ' ' + SCALE[i] : ''}`);
    n = Math.floor(n / 1000);
    i++;
  }
  return parts.join(' و ');
}

/** چاپ یک یا چند سند حسابداری (افقی/عمودی) در یک پنجره: همان قالب قبلی با «جمع تا صفحه»، سربرگ گردشده و صفحه‌بندی هوشمند؛ هر سند از صفحهٔ جدید شروع می‌شود */
export function printVouchers(docs: Row[], orient: 'L' | 'P', companyName: string, w?: Window | null): boolean {
  const H: Row = docs[0]?.head ?? {};
  return openPrintWindow({
    w,
    title: docs.length === 1 ? `سند ${str(H.No)}` : `چاپ ${docs.length} سند`,
    landscape: orient === 'L',
    data: { docs: docs.map((r) => ({ head: r.head ?? {}, rows: r.rows ?? [] })), L: orient === 'L', co: companyName },
    boot: PRINT_VOUCHER_BOOT,
  });
}

export const printVoucher = (r: Row, orient: 'L' | 'P', companyName: string): boolean => printVouchers([r], orient, companyName);
