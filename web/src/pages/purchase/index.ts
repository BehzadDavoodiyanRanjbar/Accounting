import type { ReactNode } from 'react';
import { createElement } from 'react';
import InvoiceFormPage from './InvoiceFormPage';
import InvoiceListPage from './InvoiceListPage';

/** بخش‌های «خرید» که با کد جدید نوشته شده‌اند (ثبت از روی اسکن هنوز با نسخهٔ قبلی نمایش داده می‌شود) */
export const PURCHASE_PAGES: Record<string, () => ReactNode> = {
  inv: () => createElement(InvoiceFormPage, { key: 'inv', kind: 'purchase' }),
  invret: () => createElement(InvoiceFormPage, { key: 'invret', kind: 'return' }),
  list: () => createElement(InvoiceListPage, { key: 'list' }),
};
