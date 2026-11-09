import type { ReactNode } from 'react';
import { createElement } from 'react';
import AccountsPage from './AccountsPage';
import ChequesPage from './ChequesPage';
import TransfersPage from './TransfersPage';

/** بخش‌های «بانکداری» که با کد جدید نوشته شده‌اند (شناسهٔ بخش ← صفحه) */
export const BANK_PAGES: Record<string, () => ReactNode> = {
  bk_bank: () => createElement(AccountsPage, { key: 'bk_bank', kind: 'bank' }),
  bk_cash: () => createElement(AccountsPage, { key: 'bk_cash', kind: 'cash' }),
  bk_imp: () => createElement(AccountsPage, { key: 'bk_imp', kind: 'imprest' }),
  bk_trf: () => createElement(TransfersPage, { key: 'bk_trf' }),
  bk_trl: () => createElement(TransfersPage, { key: 'bk_trl' }),
  bk_chi: () => createElement(ChequesPage, { key: 'bk_chi', dir: 'in' }),
  bk_cho: () => createElement(ChequesPage, { key: 'bk_cho', dir: 'out' }),
};
