import { Result } from 'antd';
import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useCompany } from '../api/CompanyContext';
import { canView, firstView, isKnownView } from '../layout/menu';
import { ACCOUNTING_PAGES } from './accounting';
import { BANK_PAGES } from './bank';
import { COST_PAGES } from './cost';
import RestorePage from './admin/RestorePage';
import DocCapturePage from './scan/DocCapturePage';
import CompanyUsersPage from './users/CompanyUsersPage';
import DashboardPage from './dashboard/DashboardPage';
import PortalAccountsPage from './sales/PortalAccountsPage';
import ContractsPage from './ContractsPage';
import EntityPage from './entities/EntityPage';
import { ENTITIES } from './entities/config';
import GroupsPage from './GroupsPage';
import { LegacyFramePage } from './LegacyFramePage';
import { PRODUCTION_PAGES } from './production';
import { PURCHASE_PAGES } from './purchase';
import { SALES_PAGES } from './sales';
import { STOCK_PAGES } from './stock';

/**
 * جدول بخش‌هایی که به کد جدید منتقل شده‌اند (شناسهٔ بخش ← صفحه).
 * هر بخشی که اینجا نباشد، با نسخهٔ فعلی داخل قالب جدید نمایش داده می‌شود.
 */
const NATIVE: Record<string, () => ReactNode> = {
  ...COST_PAGES,
  ...BANK_PAGES,
  ...ACCOUNTING_PAGES,
  ...PURCHASE_PAGES,
  ...SALES_PAGES,
  ...STOCK_PAGES,
  ...PRODUCTION_PAGES,
  dash: () => <DashboardPage />,
  portal_acc: () => <PortalAccountsPage />,
  restore: () => <RestorePage />,
  scan_doc: () => <DocCapturePage />,
  scan: () => <DocCapturePage initialTab="other" />,
  co_users: () => <CompanyUsersPage />,
  cs_ct: () => <ContractsPage />,
  Customers: () => <EntityPage key="Customers" config={ENTITIES.Customers} />,
  Suppliers: () => <EntityPage key="Suppliers" config={ENTITIES.Suppliers} />,
  Products: () => <EntityPage key="Products" config={ENTITIES.Products} />,
  Services: () => <EntityPage key="Services" config={ENTITIES.Services} />,
  groups: () => <GroupsPage />,
};

export default function ViewRoute() {
  const { view = 'dash' } = useParams();
  const { company, me } = useCompany();
  if (!isKnownView(view)) return <Navigate to="/p/dash" replace />;
  if (!canView(view, me ?? undefined)) {
    const first = firstView(me ?? undefined);
    if (view === 'dash' && first && first !== 'dash') return <Navigate to={`/p/${first}`} replace />;
    return <Result status="403" title="دسترسی ندارید" subTitle={view === 'users' || view === 'restore' ? 'این بخش فقط برای مدیر سیستم است.' : 'به این بخش دسترسی ندارید؛ در صورت نیاز از مدیر شرکت بخواهید دسترسی شما را تغییر دهد.'} />;
  }
  const native = NATIVE[view];
  return native ? <>{native()}</> : <LegacyFramePage view={view} company={company} />;
}
