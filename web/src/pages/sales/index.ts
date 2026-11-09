import type { ReactNode } from 'react';
import { createElement } from 'react';
import SaleFormPage from './SaleFormPage';
import SaleListPage from './SaleListPage';

/** بخش‌های «فروش» که با کد جدید نوشته شده‌اند */
export const SALES_PAGES: Record<string, () => ReactNode> = {
  sale: () => createElement(SaleFormPage, { key: 'sale' }),
  sales: () => createElement(SaleListPage, { key: 'sales' }),
};
