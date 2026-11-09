import { callApi } from './client';
import type { Bootstrap, Contract, ContractInput, CostConfig } from './types';

/** همهٔ API ها اینجا جمع شده‌اند تا صفحه‌ها مستقیم با نام عملیات سرور کار نداشته باشند. */

export const getBootstrap = (signal?: AbortSignal) => callApi<Bootstrap>('bootstrap', {}, signal);

export const getCostConfig = (company: string, signal?: AbortSignal) => callApi<CostConfig>('csCfgGet', { company }, signal);

/** فهرست قراردادها؛ سرور فعلی همهٔ رکوردها را یک‌جا می‌دهد (صفحه‌بندی در آداپتور انجام می‌شود). */
export const listContracts = async (company: string, signal?: AbortSignal): Promise<Contract[]> => {
  const r = await callApi<{ rows: Contract[] }>('csList', { company, kind: 'contract' }, signal);
  return r.rows;
};

export const saveContract = (company: string, obj: ContractInput) => callApi<unknown>('csSave', { company, kind: 'contract', obj });

export const deleteContract = (company: string, id: string) => callApi<unknown>('csDelete', { company, kind: 'contract', id });

export const changeMyPassword = (old: string, password: string) =>
  callApi<{ token: string; remember: boolean }>('changeMyPassword', { old, password });

/** ذخیره/حذف اطلاعات پایه (مشتری، فروشنده، کالا، خدمت، گروه، واحد) */
export const saveEntity = (sheet: string, obj: Record<string, unknown>) => callApi<Record<string, unknown>>('save', { sheet, obj });
export const deleteEntity = (sheet: string, id: string) => callApi<unknown>('deleteEntity', { sheet, id });

export interface AutoCodeKind {
  toAssign: number;
  total: number;
  sample: Array<{ name: string; code: string }>;
}
export type AutoCodePreview = Record<'Products' | 'Suppliers' | 'Customers', AutoCodeKind>;
export type AutoCodeResult = Record<'Products' | 'Suppliers' | 'Customers', number>;
/** commit=false → پیش‌نمایش؛ commit=true → ثبت کدها و برگرداندن تعداد کدهای داده‌شده */
export const autoCodePreview = (company: string) => callApi<AutoCodePreview>('autoCodes', { company, commit: false });
export const autoCodeCommit = (company: string) => callApi<AutoCodeResult>('autoCodes', { company, commit: true });

/* ---- بهای تمام‌شده خدمات: فهرست/ذخیره/حذف عمومی بر اساس «نوع» رکورد ---- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;
export interface CsListResult<T> {
  rows: T[];
  [k: string]: unknown;
}
export const csList = <T = AnyRow>(company: string, kind: string, extra: AnyRow = {}, signal?: AbortSignal) =>
  callApi<CsListResult<T>>('csList', { company, kind, ...extra }, signal);
export const csSave = (company: string, kind: string, obj: AnyRow) => callApi<AnyRow>('csSave', { company, kind, obj });
export const csDelete = (company: string, kind: string, id: string) => callApi<unknown>('csDelete', { company, kind, id });
/** فراخوانی هر عملیات دلخواه سرور که شرکت می‌گیرد (پیش‌نمایش، محاسبه، گزارش ...) */
export const csCall = <T = AnyRow>(action: string, company: string, extra: AnyRow = {}, signal?: AbortSignal) =>
  callApi<T>(action, { company, ...extra }, signal);
