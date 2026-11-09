import { str } from '../../kit/format';
import type { Row } from '../../kit/types';

export const SLP: Record<string, string> = { '1': 'فروش', '2': 'فروش ارز', '4': 'قرارداد پیمانکاری', '5': 'قبوض خدماتی', '6': 'بلیط هواپیما', '8': 'بارنامه', '11': 'بورس اوراق بهادار (مبتنی بر کالا)', '13': 'فروش خدمات بیمه‌ای' };
export const SLS: Record<string, string> = { '1': 'اصلی', '2': 'اصلاحی', '3': 'ابطالی', '4': 'برگشت از فروش' };
export const SLT: Record<string, string> = { '1': 'نوع یک', '2': 'نوع دوم', '3': 'نوع سوم' };
export const SLM: Record<string, string> = { '1': 'نقدی', '2': 'نسیه', '3': 'نقدی/نسیه' };
export const SLST = ['پیش‌نویس', 'آماده ارسال', 'ارسال‌شده', 'تأییدشده', 'ردشده'];
export const SLCQ: Record<'in' | 'out', string[]> = { in: ['عادی', 'در جریان وصول', 'وصول شده', 'عودت شده', 'خرج شده', 'تنزیل شده'], out: ['عادی', 'پاس شده', 'برگشتی'] };

type XField = [string, string, ('sel' | undefined)?, Array<[string, string]>?];
/** فیلدهای اضافهٔ هر الگوی صورتحساب (نام، برچسب، نوع، گزینه‌ها) */
export const SLX: Record<string, XField[]> = {
  '4': [['crn', 'شماره قرارداد پیمانکاری *']],
  '5': [['billid', 'شماره اشتراک/شناسه قبض *']],
  '6': [['ft', 'نوع پرواز *', 'sel', [['1', 'داخلی'], ['2', 'خارجی']]], ['bpn', 'شماره گذرنامه مسافر'], ['tinc', 'کد اقتصادی آژانس']],
  '8': [['lno', 'شماره بارنامه *'], ['lrno', 'شماره بارنامه مرجع'], ['ocu', 'کشور مبدأ *'], ['oci', 'شهر مبدأ'], ['dco', 'کشور مقصد *'], ['dci', 'شهر مقصد'], ['tid', 'شناسه/شماره ملی فرستنده *'], ['rid', 'شناسه/شماره ملی گیرنده *'], ['lt', 'نوع بارنامه/حمل *'], ['cno', 'شماره ناوگان *'], ['did', 'شماره ملی راننده (جاده‌ای)']],
  '11': [['asn', 'شماره اعلامیه فروش بورس *'], ['asd', 'تاریخ اعلامیه فروش بورس *']],
  '13': [['in', 'شناسه یکتای بیمه‌نامه *'], ['an', 'شناسه یکتای الحاقیه']],
};

export const num = (v: unknown) => Number(str(v).replace(/,/g, '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))) || 0;
export const r2 = (n: number) => Math.round(n * 100) / 100;

/** گرد کردن به سمت صفر (مثل سامانهٔ مؤدیان) */
export const slTr = (x: number) => {
  const y = Math.round(x * 1e4) / 1e4;
  return y >= 0 ? Math.floor(y + 1e-9) : Math.ceil(y - 1e-9);
};

export interface SaleLine {
  k: number;
  ProductID: string;
  Sstid: string;
  Sstt: string;
  unit: string;
  Mu: string;
  Am: string;
  Fee: string;
  Dis: string;
  Vra: string;
  Odt: string;
  Odr: string;
  Odam: string;
  Olt: string;
  Olr: string;
  Olam: string;
  cut: string;
  cfee: string;
  exr: string;
  cpr: string;
  sovat: string;
  serials: string;
}

let uid = 1;
export const newSaleLine = (vat: number): SaleLine => ({ k: uid++, ProductID: '', Sstid: '', Sstt: '', unit: '', Mu: '', Am: '', Fee: '', Dis: '', Vra: String(vat || 0), Odt: '', Odr: '', Odam: '', Olt: '', Olr: '', Olam: '', cut: '', cfee: '', exr: '', cpr: '', sovat: '', serials: '' });

/** تبدیل ردیف دریافتی از سرور به ردیف فرم */
export const lineFromServer = (i: Row, vat: number): SaleLine => {
  const o = newSaleLine(vat) as unknown as Record<string, unknown>;
  Object.keys(o).forEach((k) => {
    if (k !== 'k' && i[k] != null) o[k] = String(i[k]);
  });
  return o as unknown as SaleLine;
};

export function slCalc(inp: number, l: SaleLine) {
  const am = num(l.Am);
  const fee = num(l.Fee);
  const dis = slTr(num(l.Dis));
  const vra = num(l.Vra);
  const pr = inp === 2 ? slTr(num(l.cfee) * num(l.exr)) : inp === 6 ? slTr(fee) : slTr(am * fee);
  const ad = pr - dis;
  const vam = inp === 2 ? slTr((num(l.sovat) * vra) / 100) : slTr((ad * vra) / 100);
  const od = l.Odam !== '' ? slTr(num(l.Odam)) : slTr((ad * num(l.Odr)) / 100);
  const ol = l.Olam !== '' ? slTr(num(l.Olam)) : slTr((ad * num(l.Olr)) / 100);
  return { pr, dis, ad, vam, od: od + ol, t: ad + vam + od + ol };
}

export interface DocPay {
  k: number;
  DateJalali: string;
  Method: string;
  Amount: string;
  AccountID: string;
  TrackingNo: string;
  ChequeNo: string;
  SayadNo: string;
  ChequeBank: string;
  ChequeDueJalali: string;
  ChequeStatus: string;
  Description: string;
  CAcc: string;
  CDetKind: string;
  CDetID: string;
  CPartyType: string;
  CPartyID: string;
}
export const newDocPay = (date: string, amount: string, accountId: string): DocPay => ({
  k: uid++, DateJalali: date, Method: 'نقد', Amount: amount, AccountID: accountId, TrackingNo: '', ChequeNo: '', SayadNo: '', ChequeBank: '', ChequeDueJalali: '', ChequeStatus: '', Description: '', CAcc: '', CDetKind: '', CDetID: '', CPartyType: '', CPartyID: '',
});
export const docPayFromServer = (p: Row): DocPay => ({
  k: uid++, DateJalali: str(p.DateJalali), Method: str(p.Method), Amount: str(p.Amount), AccountID: str(p.AccountID), TrackingNo: str(p.TrackingNo), ChequeNo: str(p.ChequeNo), SayadNo: str(p.SayadNo), ChequeBank: str(p.ChequeBank), ChequeDueJalali: str(p.ChequeDueJalali), ChequeStatus: str(p.ChequeStatus), Description: str(p.Description), CAcc: str(p.CAcc), CDetKind: str(p.CDetKind), CDetID: str(p.CDetID), CPartyType: str(p.CPartyType), CPartyID: str(p.CPartyID),
});
export const docPayToServer = ({ k: _k, ...p }: DocPay): Row => p;
