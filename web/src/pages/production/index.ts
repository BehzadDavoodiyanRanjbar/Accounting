import type { ReactNode } from 'react';
import { createElement } from 'react';
import OrdersRoute from './OrdersRoute';
import RecipesPage from './RecipesPage';
import ExpensePage from './ExpensePage';
import ProductionConfigPage from './ProductionConfigPage';

/** بخش‌های «تولید» که با کد جدید نوشته شده‌اند */
export const PRODUCTION_PAGES: Record<string, () => ReactNode> = {
  po: () => createElement(OrdersRoute, { key: 'po' }),
  rcp: () => createElement(RecipesPage, { key: 'rcp' }),
  exp: () => createElement(ExpensePage, { key: 'exp' }),
  pcfg: () => createElement(ProductionConfigPage, { key: 'pcfg' }),
};
