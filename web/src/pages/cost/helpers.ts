import type { CostConfig } from '../../api/types';
import { str } from '../../kit/format';
import type { Opt, Row } from '../../kit/types';

export const isTrue = (v: unknown): boolean => v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';

/** «شماره - عنوان» قراردادها برای انتخاب */
export const contractOpts = (cfg?: CostConfig, withCancelled = true): Opt[] =>
  (cfg?.options.contracts ?? [])
    .filter((c) => withCancelled || c.Status !== 'cancel')
    .map((c) => ({ value: c.id, label: `${c.No} - ${c.Title}` }));

export const supplierOpts = (cfg?: CostConfig): Opt[] => (cfg?.options.suppliers ?? []).map((c) => ({ value: c.id, label: c.Name }));

export const machineOpts = (cfg?: CostConfig): Opt[] =>
  (cfg?.options.machines ?? []).map((c) => ({ value: c.id, label: c.Name + (c.Own ? ' (خودی)' : ' (اجاره‌ای)') }));

export const productOpts = (cfg?: CostConfig): Opt[] =>
  (cfg?.options.products ?? []).map((p) => ({ value: p.id, label: (p.Code ? `${p.Code} - ` : '') + p.Name }));

export const employeeOpts = (cfg?: CostConfig): Opt[] =>
  (cfg?.options.employees ?? []).map((p) => ({ value: p.id, label: (p.Code ? `${p.Code} - ` : '') + p.Name }));

export const labelOf = (map: Record<string, string> | undefined, key: unknown): string => (map ? map[str(key)] ?? str(key) : str(key));

/** مقدار رشته‌ای برای فرم (ورودی‌های متنی همیشه رشته‌اند) */
export const formStr = (row: Row | null, keys: string[]): Row => {
  const o: Row = {};
  for (const k of keys) o[k] = row && row[k] != null ? str(row[k]) : undefined;
  return o;
};
