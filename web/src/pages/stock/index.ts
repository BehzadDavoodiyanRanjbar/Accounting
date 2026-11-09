import type { ReactNode } from 'react';
import { createElement } from 'react';
import MadeGoodsPage from './MadeGoodsPage';
import PartyReportPage from './PartyReportPage';
import StockPage from './StockPage';

/** بخش‌های «انبار» که با کد جدید نوشته شده‌اند */
export const STOCK_PAGES: Record<string, () => ReactNode> = {
  stock: () => createElement(StockPage, { key: 'stock' }),
  mg: () => createElement(MadeGoodsPage, { key: 'mg' }),
  acc: () => createElement(PartyReportPage, { key: 'acc' }),
};
