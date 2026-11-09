import { Button, Card, Col, Input, Row as GridRow, Select, Space, Statistic, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useCompany } from '../../api/CompanyContext';
import { fmtNum, str } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import type { Opt, Row } from '../../kit/types';
import { accountOpts, defaultAccount, isOn, useBankAccounts } from '../bank/common';
import { AC_D4 } from '../accounting/common';
import type { AccOptionsRes } from '../accounting/common';
import { PAY_METHODS } from '../purchase/common';
import { newDocPay, num, r2 } from './constants';
import type { DocPay } from './constants';
import { NumInput } from '../../kit/NumInput';

const act = (r: Row) => r.IsActive === undefined || isOn(r.IsActive);
const cl = (c: unknown, n: unknown) => `${c ? `${str(c)} - ` : ''}${str(n)}`;

interface Props {
  payments: DocPay[];
  onChange: (p: DocPay[]) => void;
  statuses: string[];
  total: number;
  /** in = دریافت، out = پرداخت */
  dir: 'in' | 'out';
  label: string;
  defaultDate: string;
  /** نمایش «حساب دیگر» (فقط برای فاکتور فروش) */
  allowOther?: boolean;
}

/** ردیف‌های دریافت/پرداخت یک سند (فاکتور فروش) با امکان «حساب دیگر» */
export function DocPayments({ payments, onChange, statuses, total, dir, label, defaultDate, allowOther = true }: Props) {
  const { company, data } = useCompany();
  const bank = useBankAccounts();
  const acc = useCsQuery<AccOptionsRes>('accOptions', {});
  const rows = bank.data?.rows;
  const w = dir === 'in' ? 'دریافت' : 'پرداخت';

  const otherAccs = useMemo<Opt[]>(
    () => (acc.data?.accounts ?? []).filter((a) => a.IsActive !== false && a.Post !== false && !['bank', 'cash', 'imprest'].includes(a.Det4 ?? '')).map((a) => ({ value: a.AccID, label: `${a.Code} - ${a.Name}` })),
    [acc.data],
  );
  const accById = useMemo(() => Object.fromEntries((acc.data?.accounts ?? []).map((a) => [a.AccID, a])), [acc.data]);
  const detOpts = (kind: string): Opt[] => {
    if (kind === 'detail') return (acc.data?.details ?? []).filter(act).map((d) => ({ value: d.id, label: cl(d.Code, d.Name) }));
    if (kind === 'product') return (data?.products ?? []).filter((p) => p.CompanyID === company && act(p)).map((p) => ({ value: str(p.ProductID), label: cl(p.ProductCode, p.Name) }));
    return (rows ?? []).filter((a) => a.Kind === kind && isOn(a.IsActive)).map((a) => ({ value: a.AccountID, label: a.Name }));
  };
  const partyOpts = useMemo<Opt[]>(() => {
    const mine = (a?: Row[]) => (a ?? []).filter((r) => r.CompanyID === company && act(r));
    return [
      ...mine(data?.customers as Row[]).map((c) => ({ value: `customer:${str(c.CustomerID)}`, label: `خریدار: ${cl(c.CustomerCode, c.Name)}` })),
      ...mine(data?.suppliers as Row[]).map((c) => ({ value: `supplier:${str(c.SupplierID)}`, label: `فروشنده: ${cl(c.SupplierCode, c.Name)}` })),
      ...(acc.data?.employees ?? []).filter(act).map((c) => ({ value: `employee:${c.id}`, label: `کارمند: ${cl(c.Code, c.Name)}` })),
    ];
  }, [data, company, acc.data]);

  const paid = r2(payments.reduce((s, p) => s + (p.Method === 'چک' && (p.ChequeStatus === 'عودت شده' || p.ChequeStatus === 'برگشتی') ? 0 : num(p.Amount)), 0));
  const rem = r2(total - paid);

  const set = (k: number, p: Partial<DocPay>) => onChange(payments.map((x) => (x.k === k ? { ...x, ...p } : x)));
  const setMethod = (x: DocPay, v: string) => {
    const p: Partial<DocPay> = { Method: v };
    if (v === 'چک') {
      if (!x.ChequeStatus) p.ChequeStatus = statuses[0];
      const isBank = (rows ?? []).some((a) => a.AccountID === x.AccountID && a.Kind === 'bank');
      p.AccountID = isBank ? x.AccountID : defaultAccount(rows, 'bank');
    } else if (v === 'نقد') p.AccountID = defaultAccount(rows, 'cash');
    else if (v === 'تهاتر / تسویه حساب' || v === 'سایر') p.AccountID = '';
    else p.AccountID = defaultAccount(rows, 'bank');
    set(x.k, p);
  };
  const setOther = (x: DocPay, v: string) => {
    const p: Partial<DocPay> = { CAcc: v, CDetKind: '', CDetID: '', CPartyType: '', CPartyID: '' };
    if (v) p.AccountID = '';
    else if (x.Method === 'نقد') p.AccountID = defaultAccount(rows, 'cash');
    else if (x.Method && x.Method !== 'تهاتر / تسویه حساب' && x.Method !== 'سایر') p.AccountID = defaultAccount(rows, 'bank');
    set(x.k, p);
  };

  const field = (label2: string, node: ReactNode, span = 6) => (
    <Col xs={24} md={span}>
      <div style={{ marginBottom: 4 }}>{label2}</div>
      {node}
    </Col>
  );

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        هر ردیف در گردش حساب بانک/صندوق انتخاب‌شده ثبت می‌شود. <b>سند حسابداری {w} فقط برای ردیفی صادر می‌شود که کامل باشد (بانک/صندوق یا «حساب دیگر» انتخاب شده باشد).</b> اگر مبلغ را شخص دیگری پرداخت کرده یا تعهد کرده یا به حساب دیگری (مثل سپرده) منتقل شده، «حساب دیگر» و در صورت نیاز «شخص» را انتخاب کنید.
      </Typography.Paragraph>
      <Space size="large" wrap>
        <Statistic title={`مبلغ ${label}`} value={fmtNum(total)} />
        <Statistic title={`${w}ی`} value={fmtNum(paid)} />
        <Statistic title="مانده" value={fmtNum(rem)} valueStyle={{ color: rem < -0.005 ? '#cf1322' : undefined }} />
      </Space>
      {payments.map((p, i) => {
        const ch = p.Method === 'چک';
        const A = p.CAcc ? accById[p.CAcc] : undefined;
        return (
          <Card key={p.k} size="small" type="inner" title={`ردیف ${i + 1}`} extra={<Button size="small" danger onClick={() => onChange(payments.filter((x) => x.k !== p.k))}>✕ حذف</Button>}>
            <GridRow gutter={[12, 8]}>
              {field('تاریخ *', <Input value={p.DateJalali} onChange={(e) => set(p.k, { DateJalali: e.target.value.trim() })} />)}
              {field('روش *', <Select style={{ width: '100%' }} value={p.Method || undefined} options={PAY_METHODS.map((x) => ({ value: x, label: x }))} onChange={(v) => setMethod(p, v)} />)}
              {field('مبلغ (ریال) *', <NumInput value={p.Amount} onChange={(v) => set(p.k, { Amount: v })} />)}
              {!p.CAcc ? field(ch ? 'بانک (برای وصول/پاس)' : 'بانک / صندوق / تنخواه', <Select allowClear showSearch optionFilterProp="label" style={{ width: '100%' }} placeholder="—" value={p.AccountID || undefined} options={accountOpts(rows, ch ? ['bank'] : undefined, p.AccountID)} onChange={(v) => set(p.k, { AccountID: v ?? '' })} />) : null}
              {!ch && allowOther ? field('حساب دیگر (تعهد دیگران / سپرده / تسویه با حساب دیگر)', <Select allowClear showSearch optionFilterProp="label" style={{ width: '100%' }} placeholder="— (بانک / صندوق طبق روش)" value={p.CAcc || undefined} options={otherAccs} onChange={(v) => setOther(p, v ?? '')} />, 12) : null}
              {!ch && A?.Det4 ? field(`${AC_D4[A.Det4]} (الزامی)`, <Select allowClear showSearch optionFilterProp="label" style={{ width: '100%' }} value={p.CDetID || undefined} options={detOpts(A.Det4)} onChange={(v) => set(p.k, { CDetKind: v ? A.Det4 ?? '' : '', CDetID: v ?? '' })} />) : null}
              {!ch && A?.Det5 ? field(`شخص (خریدار / فروشنده / کارمند)${A.Det5 === 'req' ? ' (الزامی)' : ''}`, <Select allowClear showSearch optionFilterProp="label" style={{ width: '100%' }} value={p.CPartyID ? `${p.CPartyType}:${p.CPartyID}` : undefined} options={partyOpts} onChange={(v) => { const s = (v ?? '').indexOf(':'); set(p.k, s > 0 ? { CPartyType: (v as string).slice(0, s), CPartyID: (v as string).slice(s + 1) } : { CPartyType: '', CPartyID: '' }); }} />) : null}
              {p.Method !== '' && p.Method !== 'نقد' && !ch ? field('شماره پیگیری / رسید', <Input value={p.TrackingNo} onChange={(e) => set(p.k, { TrackingNo: e.target.value })} />) : null}
              {ch ? field('شماره چک', <Input value={p.ChequeNo} onChange={(e) => set(p.k, { ChequeNo: e.target.value })} />) : null}
              {ch ? field('شماره صیادی', <Input maxLength={16} value={p.SayadNo} onChange={(e) => set(p.k, { SayadNo: e.target.value })} />) : null}
              {ch ? field('بانک چک', <Input value={p.ChequeBank} onChange={(e) => set(p.k, { ChequeBank: e.target.value })} />) : null}
              {ch ? field('تاریخ سررسید *', <Input value={p.ChequeDueJalali} onChange={(e) => set(p.k, { ChequeDueJalali: e.target.value.trim() })} />) : null}
              {ch ? field('وضعیت چک', <Select style={{ width: '100%' }} value={p.ChequeStatus || statuses[0]} options={statuses.map((x) => ({ value: x, label: x }))} onChange={(v) => set(p.k, { ChequeStatus: v })} />) : null}
              {field('توضیحات', <Input value={p.Description} onChange={(e) => set(p.k, { Description: e.target.value })} />, 12)}
            </GridRow>
          </Card>
        );
      })}
      {payments.length === 0 ? <Typography.Text type="secondary">ردیفی ثبت نشده است.</Typography.Text> : null}
      <div>
        <Button onClick={() => onChange([...payments, newDocPay(defaultDate, rem > 0 ? String(rem) : '', defaultAccount(rows, 'cash'))])}>+ ردیف {w}</Button>
      </div>
    </Space>
  );
}

export const docPayTotals = (payments: DocPay[], total: number) => {
  const paid = r2(payments.reduce((s, p) => s + (p.Method === 'چک' && (p.ChequeStatus === 'عودت شده' || p.ChequeStatus === 'برگشتی') ? 0 : num(p.Amount)), 0));
  return { paid, rem: r2(total - paid) };
};
