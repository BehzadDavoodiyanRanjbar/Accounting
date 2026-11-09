import type { ReactNode } from 'react';

/** یک رکورد عمومی (پاسخ سرور) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export interface Opt {
  value: string;
  label: string;
}

export type FieldType = 'text' | 'money' | 'number' | 'date' | 'select' | 'check' | 'textarea' | 'items';

/** ستون یک «لیست قابل‌ویرایش» داخل فرم (مثل ردیف‌های کسورات) */
export interface ItemColumn {
  name: string;
  label: string;
  type?: 'text' | 'money' | 'select';
  options?: Opt[];
  width?: number;
}

export interface FieldDef {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  options?: Opt[] | ((values: Row) => Opt[]);
  placeholder?: string;
  help?: string;
  /** عرض در شبکهٔ ۲۴ ستونی (روی موبایل همیشه کامل) */
  span?: 6 | 8 | 12 | 16 | 24;
  visible?: (values: Row) => boolean;
  disabled?: boolean;
  /** فقط برای type = items */
  items?: ItemColumn[];
  addLabel?: string;
}

export interface ColSpec<T> {
  id: string;
  label: string;
  /** مقدار برای مرتب‌سازی، فیلتر و نمایش پیش‌فرض */
  get: (r: T) => string | number | null | undefined;
  /** نمایش سفارشی سلول */
  render?: (r: T) => ReactNode;
  type?: 'text' | 'number' | 'select';
  options?: Opt[];
  width?: number;
}

export interface FormSpec {
  title: string;
  fields: FieldDef[];
  initial: Row;
  width?: number;
}
