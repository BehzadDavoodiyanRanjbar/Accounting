import type { Mapping, Sheet, DocKind } from './extract';
import type { AccRole, InsuranceDoc, PaymentsDoc, PayrollDoc, Rates } from './rules';

export interface Emp {
  key: string;
  name: string;
  nationalCode: string;
  /** مانده بدهی باز حقوق (ریال) */
  open: number;
}
export interface Recent {
  DCID: string;
  Kind: DocKind;
  FileName: string;
  CreatedAt: string;
  ConfirmedBy: string;
  PeriodKey: string;
  VID: string;
  No: string;
  Status: string;
  Total: number;
}
export interface DocInit {
  settings: { rates: Rates; acc: Record<AccRole, string> };
  employees: Emp[];
  insuranceOpen: Record<string, number>;
  recent: Recent[];
}
export type QStatus = 'extracting' | 'review' | 'confirmed' | 'rejected' | 'duplicate' | 'error';

/** یک سند در صف بررسی (فقط در حافظهٔ همین نشست نگه داشته می‌شود) */
export interface QItem {
  id: number;
  kind: DocKind;
  fileName: string;
  hash: string;
  status: QStatus;
  error?: string;
  mime: string;
  /** نشانی موقت پیش‌نمایش تصویر (فایل تصویری) */
  url?: string;
  /** صفحه‌های تصویر/PDF خوانده‌شده با OCR (نشانی blob برای پیش‌نمایش) */
  pages?: Array<{ imageUrl: string; origin: 'ocr' | 'pdf-text'; conf: number }>;
  /** متن خام خوانده‌شده و هشدارهای OCR */
  ocrText?: string;
  warnings?: string[];
  /** پیشرفت OCR ۰..۱ و پیام */
  /** سقف اطمینان ردیف‌ها (OCR) هنگام تغییر نگاشت ستون */
  ocrCap?: number;
  progress?: number;
  progressMsg?: string;
  sheets?: Sheet[];
  sheetIdx?: number;
  mapping?: Mapping;
  payroll?: PayrollDoc;
  payments?: PaymentsDoc;
  insurance?: InsuranceDoc;
  /** متن خوانده‌شده برای هر ردیف (فقط متن ساده) */
  src: Record<number, string>;
  extracted: unknown;
  corrections: string[];
  voucherNo?: string;
  dupInfo?: string;
}
