import { useQueryClient } from '@tanstack/react-query';
import { Alert, Input, Space } from 'antd';
import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { useCompany } from '../../api/CompanyContext';
import { csCall } from '../../api/costService';
import { fmtNum, str } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import type { Opt, Row } from '../../kit/types';

export type BankKind = 'bank' | 'cash' | 'imprest';

export const KIND_LABEL: Record<BankKind, { t: string; tp: string }> = {
  bank: { t: 'بانک', tp: 'بانک‌ها' },
  cash: { t: 'صندوق', tp: 'صندوق‌ها' },
  imprest: { t: 'تنخواه‌گردان', tp: 'تنخواه‌گردان‌ها' },
};

export interface BankAcc {
  AccountID: string;
  Kind: BankKind;
  Code: string;
  Name: string;
  Title: string;
  Branch?: string;
  AccountNo?: string;
  CardNo?: string;
  OwnerName?: string;
  Sheba?: string;
  PosNo?: string;
  Mobile?: string;
  SwitchNo?: string;
  TerminalNo?: string;
  MerchantNo?: string;
  Notes?: string;
  IsActive: boolean | string;
  IsDefault: boolean | string;
  OpeningAmount: number;
  OpeningDate?: string;
  Debit: number;
  Credit: number;
  Balance: number;
  Status: string;
  TxCount: number;
}

export const num = (v: unknown) => Number(String(v ?? '').replace(/,/g, '')) || 0;

/** فهرست بانک‌ها، صندوق‌ها و تنخواه‌گردان‌ها همراه با گردش و مانده */
export function useBankAccounts() {
  return useCsQuery<{ rows: BankAcc[] }>('bankAccList', {});
}

/** فراخوانی یک عملیات بانکداری (ذخیره/حذف/تغییر وضعیت) و تازه‌سازی همهٔ فهرست‌ها */
export function useBankCall() {
  const { company } = useCompany();
  const qc = useQueryClient();
  return useCallback(
    async (action: string, extra: Row): Promise<Row> => {
      const r = await csCall<Row>(action, company, extra);
      await Promise.all([qc.invalidateQueries({ queryKey: ['csq'] }), qc.invalidateQueries({ queryKey: ['cs'] })]);
      return r;
    },
    [company, qc],
  );
}

/** گزینه‌های حساب (برچسب با نوع: «بانک: ملی») */
export function accountOpts(rows: BankAcc[] | undefined, kinds?: BankKind[], keepId?: string): Opt[] {
  return (rows ?? [])
    .filter((a) => (!kinds || kinds.includes(a.Kind)) && (isOn(a.IsActive) || a.AccountID === keepId))
    .map((a) => ({ value: a.AccountID, label: `${KIND_LABEL[a.Kind].t}: ${a.Title || a.Name}` }));
}

export const isOn = (v: unknown): boolean => v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';

/** حساب پیش‌فرض یک نوع (پیش‌فرض‌شده یا نخستین فعال) */
export function defaultAccount(rows: BankAcc[] | undefined, kind: BankKind): string {
  const l = (rows ?? []).filter((a) => a.Kind === kind && isOn(a.IsActive));
  return (l.find((a) => isOn(a.IsDefault)) ?? l[0])?.AccountID ?? '';
}

export const balText = (b: unknown, st: unknown) => `${fmtNum(Math.abs(num(b)))}${st ? ` ${str(st)}` : ''}`;

export const SRC_NAME: Record<string, string> = {
  purchase: 'فاکتور خرید',
  sale: 'فاکتور فروش',
  expense: 'فاکتور هزینه',
  transfer: 'انتقال',
  cheque: 'چک',
  manual: 'ثبت دستی',
  voucher: 'سند حسابداری',
};

/** ورودی تاریخ شمسی ساده برای فیلترها */
export function DateBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <Input style={{ width: 130 }} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value.trim())} allowClear />;
}

export function NeedCompany({ company, children }: { company: string; children: ReactNode }) {
  if (!company) return <Alert type="info" showIcon message="ابتدا شرکت/مشتری را انتخاب کنید." />;
  return <Space direction="vertical" size="middle" style={{ width: '100%' }}>{children}</Space>;
}
