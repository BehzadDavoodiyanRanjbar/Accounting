import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useCompany } from '../../api/CompanyContext';
import { todayJalali } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import type { Opt } from '../../kit/types';

export const AC_D4: Record<string, string> = { detail: 'تفصیلی عمومی', bank: 'بانک', cash: 'صندوق', imprest: 'تنخواه‌گردان', product: 'کالا' };
export const AC_LV: Record<string, string> = { '': 'ندارد', opt: 'اختیاری', req: 'الزامی' };
export const AC_CATS = ['دارایی', 'بدهی', 'حقوق صاحبان سهام', 'درآمد', 'هزینه', 'حساب‌های اختتامیه', 'انتظامی'];
export const LEVEL_NAME = ['', 'گروه', 'کل', 'معین', 'تفصیلی', 'شخص / مرکز هزینه', 'پروژه'];

export const optsOf = (m: Record<string, string>, skipEmpty = true): Opt[] => Object.entries(m).filter(([k]) => !skipEmpty || k !== '').map(([value, label]) => ({ value, label }));

export interface FyRow {
  sy: number;
  fj: string;
  tj: string;
  title: string;
  status: string;
  vouchers: number;
  dirty?: boolean;
}
export interface FyList {
  rows: FyRow[];
  active: number;
  byDate: number;
}

export const fyKey = (company: string) => `mt_fy_${company}`;
export const getSelectedFy = (company: string): string => {
  try {
    return sessionStorage.getItem(fyKey(company)) ?? '';
  } catch {
    return '';
  }
};
const fyListeners = new Set<() => void>();
export const setSelectedFy = (company: string, sy: string) => {
  try {
    sessionStorage.setItem(fyKey(company), sy);
  } catch {
    /* ignore */
  }
  fyListeners.forEach((fn) => fn());
};
/** سال مالی انتخاب‌شده به‌صورت واکنشی؛ با تغییر آن، صفحه‌ها و نوار پایین به‌روز می‌شوند */
export function useSelectedFy(company: string): string {
  return useSyncExternalStore(
    (cb) => {
      fyListeners.add(cb);
      return () => fyListeners.delete(cb);
    },
    () => getSelectedFy(company),
    () => '',
  );
}

/** سال مالی انتخاب‌شده (یا جاری) و بازهٔ پیش‌فرض گزارش‌ها: از ابتدای سال تا امروز/پایان سال */
export function useFyDefaults() {
  const { company } = useCompany();
  const q = useCsQuery<FyList>('yearList', {});
  const sel = useSelectedFy(company);
  const out = useMemo(() => {
    const d = q.data;
    if (!d) return { from: '', to: '', sy: '', fj: '', tj: '' };
    const y = d.rows.find((r) => String(r.sy) === sel) ?? d.rows.find((r) => r.sy === d.active);
    if (!y) return { from: '', to: '', sy: '', fj: '', tj: '' };
    const t = todayJalali();
    return { from: y.fj, to: t >= y.fj && t <= y.tj ? t : y.tj, sy: String(y.sy), fj: y.fj, tj: y.tj };
  }, [q.data, sel]);
  return { ...out, ready: !q.isLoading, data: q.data };
}

/** نشانگر مانده: «بد» = بدهکار، «بس» = بستانکار */
export const signColor = (s: unknown): 'danger' | 'success' | undefined => (s === 'بس' ? 'danger' : s ? 'success' : undefined);

export interface AccOpt {
  AccID: string;
  Code: string;
  Name: string;
  Det4?: string;
  Det5?: string;
  Det6?: string;
  Post?: boolean;
  IsActive?: boolean;
}
export interface AccOptionsRes {
  accounts: AccOpt[];
  details: Array<{ id: string; Code: string; Name: string; IsActive?: boolean }>;
  employees: Array<{ id: string; Code: string; Name: string; IsActive?: boolean }>;
  projects: Array<{ id: string; Code: string; Name: string; IsActive?: boolean }>;
}

/**
 * بازهٔ سال مالی انتخاب‌شده را یک‌بار (برای هر شرکت/سال) به فیلتر یک فهرست می‌دهد.
 * تا آماده شدن سال مالی false برمی‌گرداند تا فهرست پیش از اعمال بازه خوانده نشود.
 */
export function useFyRange(onInit: (from: string, to: string) => void): boolean {
  const { company } = useCompany();
  const fy = useFyDefaults();
  const [done, setDone] = useState('');
  const cb = useRef(onInit);
  cb.current = onInit;
  const key = fy.ready ? `${company}:${fy.sy}` : '';
  useEffect(() => {
    if (!key || key === done) return;
    cb.current(fy.fj, fy.tj);
    setDone(key);
  }, [key, done, fy.fj, fy.tj]);
  return !!key && key === done;
}
