import { Button, Select, Space, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { errorMessage } from '../../api/client';
import { CrudPage } from '../../kit/CrudPage';
import { downloadCsv } from '../../kit/exporter';
import type { ExportCol } from '../../kit/exporter';
import { fmtNum, str, todayJalali } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import type { ColSpec, FormSpec, Row } from '../../kit/types';
import { useFyRange } from '../accounting/common';
import { DateBox, accountOpts, defaultAccount, num, useBankAccounts, useBankCall } from './common';

interface TransferResult {
  rows: Row[];
  totals: { count: number; amount: number; fee: number };
}

/** انتقال بین بانک‌ها، صندوق‌ها و تنخواه‌گردان‌ها (ثبت و فهرست) */
export default function TransfersPage() {
  const accs = useBankAccounts();
  const call = useBankCall();
  const [account, setAccount] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState({ account: '', from: '', to: '' });
  const ready = useFyRange((fj, tj) => {
    setFrom(fj);
    setTo(tj);
    setApplied((o) => ({ ...o, from: fj, to: tj }));
  });
  const q = useCsQuery<TransferResult>('transferList', applied, ready);
  const rows = q.data?.rows ?? [];
  const T = q.data?.totals;
  const list = accs.data?.rows;

  const cols = useMemo<ColSpec<Row>[]>(
    () => [
      { id: 'No', label: 'شماره', get: (r) => str(r.No), width: 90 },
      { id: 'DateJalali', label: 'تاریخ', get: (r) => str(r.DateJalali), width: 110 },
      { id: 'From', label: 'از', get: (r) => str(r.From), width: 200 },
      { id: 'To', label: 'به', get: (r) => str(r.To), width: 200 },
      { id: 'Amount', label: 'مبلغ', get: (r) => num(r.Amount), type: 'number', width: 140 },
      { id: 'Fee', label: 'کارمزد', get: (r) => num(r.Fee), type: 'number', width: 110 },
      { id: 'Description', label: 'شرح', get: (r) => str(r.Description), width: 220 },
      { id: 'Ref', label: 'ارجاع', get: (r) => str(r.Ref), width: 140 },
    ],
    [],
  );

  const buildForm = (row: Row | null): FormSpec => {
    const fk = defaultAccount(list, 'bank') ? 'bank' : 'cash';
    const tk = fk === 'bank' ? 'cash' : 'bank';
    const opts = accountOpts(list, undefined, undefined);
    const withKeep = (id: unknown) => accountOpts(list, undefined, str(id));
    return {
      title: row ? `ویرایش انتقال شمارهٔ ${str(row.No)}` : 'ثبت انتقال',
      fields: [
        { name: 'No', label: 'شماره (خودکار)', span: 8, placeholder: 'خودکار' },
        { name: 'DateJalali', label: 'تاریخ', type: 'date', required: true, span: 8 },
        { name: 'Description', label: 'شرح', span: 8 },
        { name: 'FromID', label: 'از (مبدأ)', type: 'select', required: true, options: row ? withKeep(row.FromID) : opts, span: 12 },
        { name: 'ToID', label: 'به (مقصد)', type: 'select', required: true, options: row ? withKeep(row.ToID) : opts, span: 12 },
        { name: 'Amount', label: 'مبلغ (ریال)', type: 'money', required: true, span: 8 },
        { name: 'Fee', label: 'کارمزد خدمات بانکی (ریال)', type: 'money', span: 8 },
        { name: 'Ref', label: 'ارجاع / شمارهٔ پیگیری', span: 8 },
      ],
      initial: row
        ? { No: str(row.No), DateJalali: str(row.DateJalali), Description: str(row.Description), FromID: str(row.FromID), ToID: str(row.ToID), Amount: str(row.Amount), Fee: row.Fee ? str(row.Fee) : '', Ref: str(row.Ref) }
        : { DateJalali: todayJalali(), FromID: defaultAccount(list, fk) || undefined, ToID: defaultAccount(list, tk) || undefined },
    };
  };

  const exCols: ExportCol<Row>[] = [
    { title: 'شماره', value: (r) => str(r.No) },
    { title: 'تاریخ', value: (r) => str(r.DateJalali) },
    { title: 'از', value: (r) => str(r.From) },
    { title: 'به', value: (r) => str(r.To) },
    { title: 'مبلغ', value: (r) => num(r.Amount) },
    { title: 'کارمزد', value: (r) => num(r.Fee) },
    { title: 'شرح', value: (r) => str(r.Description) },
    { title: 'ارجاع', value: (r) => str(r.Ref) },
  ];

  return (
    <CrudPage<Row>
      title="انتقال بین حساب‌ها"
      hint="مبلغ انتقال از حساب مبدأ در ستون «بستانکار» و در حساب مقصد در ستون «بدهکار» می‌نشیند. کارمزد فقط از حساب مبدأ کسر می‌شود."
      filters={
        <Space wrap>
          <span>حساب</span>
          <Select style={{ minWidth: 240 }} showSearch optionFilterProp="label" allowClear placeholder="همه" value={account || undefined} options={accountOpts(list)} onChange={(v) => setAccount(v ?? '')} />
          <DateBox value={from} onChange={setFrom} placeholder="از تاریخ" />
          <DateBox value={to} onChange={setTo} placeholder="تا تاریخ" />
          <Button type="primary" onClick={() => setApplied({ account, from, to })}>نمایش</Button>
        </Space>
      }
      summary={T ? <Typography.Text>جمع ({T.count} انتقال): مبلغ <b>{fmtNum(T.amount)}</b> | کارمزد <b>{fmtNum(T.fee)}</b></Typography.Text> : null}
      headerExtra={<Button onClick={() => downloadCsv(`transfers-${todayJalali().replace(/\//g, '-')}`, exCols, rows)}>خروجی Excel (CSV)</Button>}
      rows={rows}
      loading={q.isFetching}
      error={q.isError ? errorMessage(q.error) : null}
      onReload={() => void q.refetch()}
      cols={cols}
      getId={(r) => str(r.TransferID)}
      nameOf={(r) => `انتقال شمارهٔ ${str(r.No)}`}
      newButtons={[{ label: 'انتقال جدید' }]}
      buildForm={buildForm}
      onSave={async (v, row) => {
        await call('transferSave', {
          obj: { TransferID: row ? str(row.TransferID) : '', No: str(v.No), DateJalali: str(v.DateJalali), Description: str(v.Description), FromID: str(v.FromID), ToID: str(v.ToID), Amount: str(v.Amount), Fee: str(v.Fee), Ref: str(v.Ref) },
        });
      }}
      onDelete={async (r) => {
        await call('transferDelete', { id: str(r.TransferID) });
      }}
      emptyText="انتقالی ثبت نشده است."
      defaultSort={{ id: 'No', desc: true }}
      storageKey="mt_v2_cols_bk_transfers"
    />
  );
}
