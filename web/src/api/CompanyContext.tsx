import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getBootstrap } from './costService';
import { errorMessage } from './client';
import type { Bootstrap, Company } from './types';

interface Ctx {
  company: string;
  setCompany: (id: string) => void;
  companies: Company[];
  me: Bootstrap['me'] | null;
  /** کل پاسخ bootstrap (اطلاعات پایهٔ همهٔ شرکت‌ها؛ هر صفحه با CompanyID فیلتر می‌کند) */
  data: Bootstrap | undefined;
  /** بعد از ذخیره/حذف اطلاعات پایه صدا زده می‌شود */
  reload: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const CompanyCtx = createContext<Ctx | null>(null);
const KEY = 'mt_v2_company';

const isActive = (c: Company) => c.IsActive !== false && String(c.IsActive).toLowerCase() !== 'false' && c.IsActive !== '0';

/** اطلاعات کاربر و «شرکت فعال». همهٔ پرس‌وجوها با شرکت فعال کلید می‌خورند. */
export function CompanyProvider({ children }: { children: ReactNode }) {
  const q = useQuery({ queryKey: ['bootstrap'], queryFn: ({ signal }) => getBootstrap(signal), staleTime: 5 * 60_000 });
  const companies = useMemo(() => (q.data?.companies ?? []).filter(isActive), [q.data]);
  const [company, setCompanyState] = useState<string>(() => {
    try {
      return localStorage.getItem(KEY) ?? '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    if (!companies.length) return;
    if (!companies.some((c) => c.CompanyID === company)) setCompanyState(companies[0].CompanyID);
  }, [companies, company]);

  const setCompany = (id: string) => {
    setCompanyState(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* ignore */
    }
  };

  const value: Ctx = {
    company,
    setCompany,
    companies,
    me: q.data?.me ?? null,
    data: q.data,
    reload: async () => {
      await q.refetch();
    },
    loading: q.isLoading,
    error: q.error ? errorMessage(q.error) : null,
  };
  return <CompanyCtx.Provider value={value}>{children}</CompanyCtx.Provider>;
}

export function useCompany(): Ctx {
  const c = useContext(CompanyCtx);
  if (!c) throw new Error('useCompany باید داخل CompanyProvider استفاده شود.');
  return c;
}
