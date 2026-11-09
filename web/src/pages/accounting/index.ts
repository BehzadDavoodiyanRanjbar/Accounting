import type { ReactNode } from 'react';
import { createElement } from 'react';
import AccLedgerPage from './AccLedgerPage';
import ChartPage from './ChartPage';
import DimensionsPage from './DimensionsPage';
import FiscalYearPage from './FiscalYearPage';
import TrialBalancePage from './TrialBalancePage';
import VoucherFormPage from './VoucherFormPage';
import VoucherListPage from './VoucherListPage';

/** بخش‌های «حسابداری» که با کد جدید نوشته شده‌اند (شناسهٔ بخش ← صفحه) */
export const ACCOUNTING_PAGES: Record<string, () => ReactNode> = {
  ac_tbl: () => createElement(ChartPage, { key: 'ac_tbl' }),
  ac_dim: () => createElement(DimensionsPage, { key: 'ac_dim' }),
  ac_tb: () => createElement(TrialBalancePage, { key: 'ac_tb' }),
  ac_led: () => createElement(AccLedgerPage, { key: 'ac_led' }),
  ac_fy: () => createElement(FiscalYearPage, { key: 'ac_fy' }),
  ac_list: () => createElement(VoucherListPage, { key: 'ac_list' }),
  ac_new: () => createElement(VoucherFormPage, { key: 'ac_new' }),
};
