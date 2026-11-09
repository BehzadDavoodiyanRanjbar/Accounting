import { Alert, Button, Card, Checkbox, Select, Space, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { useCompany } from '../../api/CompanyContext';
import { downloadCsv, printTable } from '../../kit/exporter';
import type { ExportCol } from '../../kit/exporter';
import { fmtNum, str, todayJalali } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import type { Row } from '../../kit/types';
import { DateBox, NeedCompany } from '../bank/common';
import { useFyDefaults } from './common';

interface AccOpts {
  accounts: Array<{ AccID: string; Code: string; Name: string; IsActive?: boolean; Det4?: string }>;
}
interface LedgerRes {
  account: { Code: string; Name: string };
  carry: number;
  carrySign: string;
  rows: Row[];
  totals: { debit: number; credit: number; balance: number; sign: string };
}

/** دفتر معین */
export default function AccLedgerPage() {
  const { company } = useCompany();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const fy = useFyDefaults();
  const opts = useCsQuery<AccOpts>('accOptions', {});
  const [acc, setAcc] = useState(sp.get('acc') ?? '');
  const [from, setFrom] = useState(sp.get('from') ?? '');
  const [to, setTo] = useState(sp.get('to') ?? '');
  const [draft, setDraft] = useState(sp.get('draft') === '1');
  const [applied, setApplied] = useState<Record<string, unknown> | null>(
    sp.get('acc') ? { acc: sp.get('acc'), from: sp.get('from') ?? '', to: sp.get('to') ?? '', includeDraft: sp.get('draft') === '1' } : null,
  );

  useEffect(() => {
    if (fy.ready && fy.from && !from && !to) {
      setFrom(fy.from);
      setTo(fy.to);
    }
  }, [fy.ready, fy.from, fy.to, from, to]);

  const accOptions = useMemo(
    () => (opts.data?.accounts ?? []).filter((a) => a.IsActive !== false).map((a) => ({ value: a.AccID, label: `${a.Code} - ${a.Name}` })),
    [opts.data],
  );

  const q = useCsQuery<LedgerRes>('accLedger', applied ?? {}, !!applied);
  const r = q.data;

  const cols: TableColumnsType<Row> = [
    { title: 'تاریخ', key: 'd', render: (_, x) => str(x.DateJalali), width: 100 },
    { title: 'شماره سند', key: 'n', render: (_, x) => <a onClick={() => nav(`/p/ac_new?id=${encodeURIComponent(str(x.VID))}`)}>{str(x.No)}</a>, width: 90 },
    { title: 'ارجاع', key: 'rf', render: (_, x) => str(x.RefNo), width: 80 },
    { title: 'وضعیت', key: 'st', render: (_, x) => (x.Status === 'draft' ? <Tag>پیش‌نویس</Tag> : null), width: 80 },
    { title: 'شرح', key: 'ds', render: (_, x) => str(x.Description || x.VDesc) },
    { title: 'تفصیلی / شخص', key: 'p', render: (_, x) => [x.Det, x.Party].filter(Boolean).join(' / ') },
    { title: 'پروژه', key: 'pr', render: (_, x) => str(x.Proj) },
    { title: 'بدهکار', key: 'D', align: 'end', render: (_, x) => (x.Debit ? fmtNum(x.Debit) : '') },
    { title: 'بستانکار', key: 'C', align: 'end', render: (_, x) => (x.Credit ? fmtNum(x.Credit) : '') },
    { title: 'مانده', key: 'B', align: 'end', render: (_, x) => `${fmtNum(Math.abs(Number(x.Balance) || 0))} ${str(x.Sign)}` },
  ];

  const ex: ExportCol<Row>[] = [
    { title: 'تاریخ', value: (x) => x.DateJalali },
    { title: 'شماره سند', value: (x) => x.No },
    { title: 'ارجاع', value: (x) => x.RefNo },
    { title: 'شرح', value: (x) => x.Description || x.VDesc },
    { title: 'تفصیلی / شخص', value: (x) => [x.Det, x.Party].filter(Boolean).join(' / ') },
    { title: 'پروژه', value: (x) => x.Proj },
    { title: 'بدهکار', value: (x) => x.Debit || '', numeric: true },
    { title: 'بستانکار', value: (x) => x.Credit || '', numeric: true },
    { title: 'مانده', value: (x) => `${fmtNum(Math.abs(Number(x.Balance) || 0))} ${str(x.Sign)}`, numeric: true },
  ];
  const foot: Row | undefined = r ? { Description: 'جمع', Debit: r.totals.debit, Credit: r.totals.credit, Balance: r.totals.balance, Sign: r.totals.sign } : undefined;
  const title = r ? `دفتر معین: ${r.account.Code} - ${r.account.Name}` : 'دفتر معین';
  const sub = `از ${from || '—'} تا ${to || '—'}`;

  return (
    <NeedCompany company={company}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Title level={3} style={{ margin: 0 }}>دفتر معین</Typography.Title>
          <Space wrap align="end">
            <Select showSearch optionFilterProp="label" style={{ width: 320 }} placeholder="حساب (کد یا نام)" value={acc || undefined} onChange={setAcc} options={accOptions} loading={opts.isLoading} />
            <DateBox value={from} onChange={setFrom} placeholder="از تاریخ" />
            <DateBox value={to} onChange={setTo} placeholder="تا تاریخ" />
            <Checkbox checked={draft} onChange={(e) => setDraft(e.target.checked)}>شامل پیش‌نویس‌ها</Checkbox>
            <Button type="primary" disabled={!acc} onClick={() => setApplied({ acc, from, to, includeDraft: draft })}>نمایش</Button>
            <Button disabled={!r?.rows.length} onClick={() => downloadCsv(`ledger-${todayJalali().replace(/\//g, '-')}`, ex, r!.rows, foot, [title, sub])}>خروجی Excel (CSV)</Button>
            <Button disabled={!r?.rows.length} onClick={() => printTable(title, sub, ex, r!.rows, foot)}>چاپ</Button>
          </Space>
        </Space>
      </Card>
      {q.isError ? <Alert type="error" showIcon message={errorMessage(q.error)} /> : null}
      {r ? (
        <Card title={title} extra={<span>مانده از قبل: <b>{fmtNum(Math.abs(r.carry))} {r.carrySign}</b></span>}>
          <Table<Row>
            size="small"
            rowKey={(x, i) => `${str(x.VID)}-${i}`}
            loading={q.isFetching}
            columns={cols}
            dataSource={r.rows}
            pagination={{ pageSize: 100, showSizeChanger: true }}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: 'گردشی در این بازه نیست.' }}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={7}><b>جمع</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="end"><b>{fmtNum(r.totals.debit)}</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="end"><b>{fmtNum(r.totals.credit)}</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="end"><b>{fmtNum(Math.abs(r.totals.balance))} {r.totals.sign}</b></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Card>
      ) : null}
    </NeedCompany>
  );
}
