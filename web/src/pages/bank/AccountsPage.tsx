import { Button, Space, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { errorMessage } from '../../api/client';
import { CrudPage } from '../../kit/CrudPage';
import { downloadCsv } from '../../kit/exporter';
import type { ExportCol } from '../../kit/exporter';
import { fmtNum, str, todayJalali } from '../../kit/format';
import type { ColSpec, FieldDef, FormSpec, Row } from '../../kit/types';
import { KIND_LABEL, balText, isOn, num, useBankAccounts, useBankCall } from './common';
import type { BankAcc, BankKind } from './common';
import { AccountLedger } from './Ledger';

const BANK_FIELDS: Array<[string, string]> = [
  ['Name', 'نام بانک / حساب'],
  ['Branch', 'شعبه'],
  ['CardNo', 'شماره کارت'],
  ['OwnerName', 'صاحب حساب'],
  ['AccountNo', 'شماره حساب'],
  ['Sheba', 'شماره شبا (با IR)'],
  ['PosNo', 'شماره POS'],
  ['Mobile', 'موبایل ثبت‌شده در بانک'],
  ['SwitchNo', 'شماره سوییچ'],
  ['TerminalNo', 'شماره ترمینال'],
  ['MerchantNo', 'شماره پذیرنده'],
];

/** بانک‌ها، صندوق‌ها و تنخواه‌گردان‌ها (هر سه با همین صفحه؛ فقط نوع فرق می‌کند) */
export default function AccountsPage({ kind }: { kind: BankKind }) {
  const L = KIND_LABEL[kind];
  const q = useBankAccounts();
  const call = useBankCall();
  const [ledger, setLedger] = useState<string | null>(null);
  const rows = useMemo(() => (q.data?.rows ?? []).filter((a) => a.Kind === kind), [q.data, kind]);

  const T = rows.reduce((t, a) => ({ d: t.d + num(a.Debit), c: t.c + num(a.Credit), b: t.b + num(a.Balance) }), { d: 0, c: 0, b: 0 });

  const cols = useMemo<ColSpec<BankAcc>[]>(
    () => [
      { id: 'Code', label: 'کد', get: (r) => str(r.Code), width: 90 },
      { id: 'Name', label: 'نام', get: (r) => str(r.Name), width: 200 },
      ...(kind === 'bank'
        ? ([
            { id: 'Branch', label: 'شعبه', get: (r) => str(r.Branch), width: 130 },
            { id: 'AccountNo', label: 'شمارهٔ حساب', get: (r) => str(r.AccountNo), width: 170 },
            { id: 'CardNo', label: 'شمارهٔ کارت', get: (r) => str(r.CardNo).replace(/(\d{4})(?=\d)/g, '$1 '), width: 180 },
          ] as ColSpec<BankAcc>[])
        : []),
      { id: 'Debit', label: 'دریافتی (بدهکار)', get: (r) => num(r.Debit), type: 'number', width: 150 },
      { id: 'Credit', label: 'پرداختی (بستانکار)', get: (r) => num(r.Credit), type: 'number', width: 150 },
      {
        id: 'Balance',
        label: 'مانده',
        get: (r) => Math.abs(num(r.Balance)),
        type: 'number',
        render: (r) => (
          <span>
            {fmtNum(Math.abs(num(r.Balance)))} <Tag color={r.Status === 'بس' ? 'red' : r.Status === 'بد' ? 'green' : 'default'}>{r.Status || '—'}</Tag>
          </span>
        ),
        width: 150,
      },
      { id: 'TxCount', label: 'ردیف گردش', get: (r) => num(r.TxCount), type: 'number', width: 110 },
      {
        id: 'IsActive',
        label: 'وضعیت',
        get: (r) => `${isOn(r.IsActive) ? 'فعال' : 'غیرفعال'}${isOn(r.IsDefault) ? ' (پیش‌فرض)' : ''}`,
        render: (r) => (
          <Space size={4}>
            <Tag color={isOn(r.IsActive) ? 'green' : 'default'}>{isOn(r.IsActive) ? 'فعال' : 'غیرفعال'}</Tag>
            {isOn(r.IsDefault) ? <Tag color="blue">پیش‌فرض</Tag> : null}
          </Space>
        ),
        width: 160,
      },
    ],
    [kind],
  );

  const fields = useMemo<FieldDef[]>(() => {
    const f: FieldDef[] = [{ name: 'Code', label: 'کد حسابداری (خودکار)', span: 8, placeholder: 'خودکار' }];
    if (kind === 'bank') BANK_FIELDS.forEach(([name, label]) => f.push({ name, label: name === 'Name' ? `${label}` : label, required: name === 'Name', span: 8 }));
    else f.push({ name: 'Name', label: `نام ${L.t}`, required: true, span: 16 });
    f.push({ name: 'Notes', label: 'توضیحات', span: 24 });
    f.push({ name: 'OpeningAmount', label: 'مانده افتتاحیه (ریال)', type: 'money', span: 8 });
    f.push({
      name: 'OpeningSign',
      label: 'ماهیت افتتاحیه',
      type: 'select',
      required: true,
      options: [
        { value: 'bd', label: 'بد (بدهکار)' },
        { value: 'bs', label: 'بس (بستانکار)' },
      ],
      span: 8,
    });
    f.push({ name: 'OpeningDate', label: 'تاریخ افتتاحیه', type: 'date', span: 8 });
    f.push({ name: 'IsActive', label: 'فعال', type: 'check', span: 6 });
    f.push({ name: 'IsDefault', label: 'پیش‌فرض', type: 'check', span: 6 });
    return f;
  }, [kind, L.t]);

  const buildForm = (row: BankAcc | null): FormSpec => {
    const base: Row = {};
    const keys = kind === 'bank' ? BANK_FIELDS.map((x) => x[0]) : ['Name'];
    if (row) {
      [...keys, 'Code', 'Notes', 'OpeningDate'].forEach((k) => (base[k] = str((row as unknown as Row)[k])));
      base.OpeningAmount = row.OpeningAmount ? String(Math.abs(row.OpeningAmount)) : '';
      base.OpeningSign = row.OpeningAmount < 0 ? 'bs' : 'bd';
      base.IsActive = isOn(row.IsActive);
      base.IsDefault = isOn(row.IsDefault);
    } else {
      base.OpeningSign = 'bd';
      base.IsActive = true;
      base.IsDefault = false;
    }
    return { title: row ? `ویرایش ${L.t}` : `ثبت ${L.t}`, fields, initial: base, width: 820 };
  };

  const exCols: ExportCol<BankAcc>[] = [
    { title: 'کد', value: (a) => a.Code },
    { title: 'نام', value: (a) => a.Name },
    { title: 'شعبه', value: (a) => a.Branch ?? '' },
    { title: 'شمارهٔ حساب', value: (a) => a.AccountNo ?? '' },
    { title: 'شمارهٔ کارت', value: (a) => a.CardNo ?? '' },
    { title: 'شبا', value: (a) => a.Sheba ?? '' },
    { title: 'وضعیت', value: (a) => (isOn(a.IsActive) ? 'فعال' : 'غیرفعال') },
    { title: 'دریافتی (بدهکار)', value: (a) => num(a.Debit) },
    { title: 'پرداختی (بستانکار)', value: (a) => num(a.Credit) },
    { title: 'مانده', value: (a) => Math.abs(num(a.Balance)) },
    { title: 'تشخیص', value: (a) => a.Status },
  ];

  if (ledger) return <AccountLedger accountId={ledger} onBack={() => setLedger(null)} />;

  return (
    <CrudPage<BankAcc>
      title={L.tp}
      summary={
        <Space wrap size="large">
          <Typography.Text>جمع دریافتی‌ها (بدهکار): <b>{fmtNum(Math.round(T.d * 100) / 100)}</b></Typography.Text>
          <Typography.Text>جمع پرداختی‌ها (بستانکار): <b>{fmtNum(Math.round(T.c * 100) / 100)}</b></Typography.Text>
          <Typography.Text>مانده کل: <b>{balText(T.b, T.b > 0.005 ? 'بد' : T.b < -0.005 ? 'بس' : '')}</b></Typography.Text>
        </Space>
      }
      rows={rows}
      loading={q.isFetching}
      error={q.isError ? errorMessage(q.error) : null}
      onReload={() => void q.refetch()}
      cols={cols}
      getId={(a) => a.AccountID}
      nameOf={(a) => a.Name}
      newButtons={[{ label: `${L.t} جدید` }]}
      headerExtra={<Button onClick={() => downloadCsv(`bank-accounts-${kind}-${todayJalali().replace(/\//g, '-')}`, exCols, rows)}>خروجی Excel (CSV)</Button>}
      buildForm={buildForm}
      onSave={async (v, row) => {
        const o: Row = { Kind: kind, AccountID: row ? row.AccountID : '', Code: str(v.Code), IsActive: !!v.IsActive, IsDefault: !!v.IsDefault, Notes: str(v.Notes), OpeningDate: str(v.OpeningDate) };
        (kind === 'bank' ? BANK_FIELDS.map((x) => x[0]) : ['Name']).forEach((k) => (o[k] = str(v[k])));
        o.OpeningAmount = num(v.OpeningAmount) * (v.OpeningSign === 'bs' ? -1 : 1) || '';
        await call('bankAccSave', { obj: o });
      }}
      onDelete={async (a) => {
        await call('bankAccDelete', { id: a.AccountID });
      }}
      rowActions={(a) => (
        <Button size="small" type="primary" ghost onClick={() => setLedger(a.AccountID)}>
          گردش حساب
        </Button>
      )}
      actionsWidth={260}
      emptyText={`هنوز ${L.t}ی ثبت نشده است. با دکمهٔ «${L.t} جدید» شروع کنید.`}
      storageKey={`mt_v2_cols_bk_${kind}`}
    />
  );
}
