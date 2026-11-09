import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useCompany } from '../api/CompanyContext';
import { csCall, csDelete, csList, csSave, getCostConfig } from '../api/costService';
import type { Row } from './types';

/** تنظیمات و فهرست‌های انتخاب بهای تمام‌شده (قراردادها، پیمانکاران، ماشین‌ها، عناصر هزینه و ...) */
export function useCostCfg() {
  const { company } = useCompany();
  return useQuery({
    queryKey: ['costCfg', company],
    queryFn: ({ signal }) => getCostConfig(company, signal),
    enabled: !!company,
    staleTime: 60_000,
  });
}

/** فهرست یک نوع رکورد (csList)؛ extra = پارامترهای فیلتر مثل قرارداد یا دوره */
export function useKindList<T = Row>(kind: string, extra: Row = {}, enabled = true) {
  const { company } = useCompany();
  return useQuery({
    queryKey: ['cs', kind, company, extra],
    queryFn: ({ signal }) => csList<T>(company, kind, extra, signal),
    enabled: !!company && enabled,
  });
}

/** ذخیره/حذف یک نوع رکورد؛ بعد از هر تغییر، فهرست‌ها و تنظیمات دوباره خوانده می‌شوند */
export function useKindActions(kind: string) {
  const { company } = useCompany();
  const qc = useQueryClient();
  const refresh = useCallback(async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ['cs'] }), qc.invalidateQueries({ queryKey: ['costCfg', company] }), qc.invalidateQueries({ queryKey: ['contracts', company] })]);
  }, [qc, company]);
  const save = useCallback(
    async (obj: Row) => {
      const r = await csSave(company, kind, obj);
      await refresh();
      return r;
    },
    [company, kind, refresh],
  );
  const remove = useCallback(
    async (id: string) => {
      await csDelete(company, kind, id);
      await refresh();
    },
    [company, kind, refresh],
  );
  return { company, save, remove, refresh };
}

/** فراخوانی یک عملیات سرور به‌صورت پرس‌وجو (گزارش و پیش‌نمایش) */
export function useCsQuery<T = Row>(action: string, extra: Row, enabled = true) {
  const { company } = useCompany();
  return useQuery({
    queryKey: ['csq', action, company, extra],
    queryFn: ({ signal }) => csCall<T>(action, company, extra, signal),
    enabled: !!company && enabled,
  });
}
