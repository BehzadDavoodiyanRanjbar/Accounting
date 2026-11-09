import type { ReactNode } from 'react';
import { createElement } from 'react';
import CostConfigPage from './CostConfigPage';
import CostContractsPage from './CostContractsPage';
import EstimatePage from './EstimatePage';
import IssuesPage from './IssuesPage';
import LedgerPage from './LedgerPage';
import MachineWorkPage from './MachineWorkPage';
import MachinesPage from './MachinesPage';
import MobilizationPage from './MobilizationPage';
import OverheadPage from './OverheadPage';
import PayrollPage from './PayrollPage';
import PostingPage from './PostingPage';
import ProgressPage from './ProgressPage';
import StatementsPage from './StatementsPage';

/** بخش‌های «بهای تمام‌شدهٔ خدمات» که با کد جدید نوشته شده‌اند (شناسهٔ بخش ← صفحه) */
export const COST_PAGES: Record<string, () => ReactNode> = {
  cs_cc: () => createElement(CostContractsPage),
  cs_mc: () => createElement(MachinesPage),
  cs_is: () => createElement(IssuesPage),
  cs_pay: () => createElement(PayrollPage),
  cs_st: () => createElement(StatementsPage),
  cs_ml: () => createElement(MachineWorkPage),
  cs_mob: () => createElement(MobilizationPage),
  cs_oh: () => createElement(OverheadPage),
  cs_est: () => createElement(EstimatePage),
  cs_prog: () => createElement(ProgressPage),
  cs_post: () => createElement(PostingPage),
  cs_lg: () => createElement(LedgerPage),
  cs_cf: () => createElement(CostConfigPage),
};
