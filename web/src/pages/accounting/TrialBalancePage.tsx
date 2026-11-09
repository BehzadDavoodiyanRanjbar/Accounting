import { Alert, Button, Card, Checkbox, Select, Space, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { useCompany } from '../../api/CompanyContext';
import { downloadCsv, printTable } from '../../kit/exporter';
import type { ExportCol } from '../../kit/exporter';
import { fmtNum, todayJalali } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import { DateBox, NeedCompany } from '../bank/common';
import { LEVEL_NAME, useFyDefaults } from './common';

interface TbRow {
  AccID: string;
  Level: number;
  Code: string;
  Name: string;
  OpenDebit: number;
  OpenCredit: number;
  Debit: number;
  Credit: number;
  EndDebit: number;
  EndCredit: number;
}
interface TbResult {
  rows: TbRow[];
  totals: { od: number; oc: number; d: number; c: number; ed: number; ec: number };
}

const z = (n: number) => (n ? fmtNum(n) : '');

/** تراز آزمایشی (۶ سطحی) */
export default function TrialBalancePage() {
  const { company } = useCompany();
  const nav = useNavigate();
  const fy = useFyDefaults();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [level, setLevel] = useState('3');
  const [draft, setDraft] = useState(false);
  const [hideZero, setHideZero] = useState(true);
  const [incClose, setIncClose] = useState(false);
  const [incOpen, setIncOpen] = useState(true);
  const [applied, setApplied] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (fy.ready && fy.from && !applied) {
      setFrom(fy.from);
      setTo(fy.to);
      setApplied({ from: fy.from, to: fy.to, level: '3', includeDraft: false, hideZero: true, incClose: false, incOpen: true });
    }
  }, [fy.ready, fy.from, fy.to, applied]);

  const q = useCsQuery<TbResult>('accTrial', applied ?? {}, !!applied);
  const rows = q.data?.rows ?? [];
  const T = q.data?.totals;
  const balanced = T ? Math.abs(T.d - T.c) < 0.01 && Math.abs(T.ed - T.ec) < 0.01 : true;

  const run = () => setApplied({ from, to, level, includeDraft: draft, hideZero, incClose, incOpen });

  const cols: TableColumnsType<TbRow> = useMemo(
    () => [
      { title: 'کد', dataIndex: 'Code', width: 120 },
      {
        title: 'نام حساب',
        key: 'n',
        render: (_, r) => <span style={{ paddingInlineStart: Math.max(0, r.Level - 1) * 14, fontWeight: r.Level <= 2 ? 700 : 400 }}>{r.Name}</span>,
      },
      { title: 'گردش اول دوره — بدهکار', key: 'od', align: 'end', render: (_, r) => z(r.OpenDebit) },
      { title: 'گردش اول دوره — بستانکار', key: 'oc', align: 'end', render: (_, r) => z(r.OpenCredit) },
      { title: 'گردش دوره — بدهکار', key: 'd', align: 'end', render: (_, r) => z(r.Debit) },
      { title: 'گردش دوره — بستانکار', key: 'c', align: 'end', render: (_, r) => z(r.Credit) },
      { title: 'مانده — بدهکار', key: 'ed', align: 'end', render: (_, r) => z(r.EndDebit) },
      { title: 'مانده — بستانکار', key: 'ec', align: 'end', render: (_, r) => z(r.EndCredit) },
    ],
    [],
  );

  const ex: ExportCol<TbRow>[] = [
    { title: 'کد', value: (r) => r.Code },
    { title: 'نام حساب', value: (r) => r.Name },
    { title: 'اول دوره بدهکار', value: (r) => r.OpenDebit, numeric: true },
    { title: 'اول دوره بستانکار', value: (r) => r.OpenCredit, numeric: true },
    { title: 'گردش بدهکار', value: (r) => r.Debit, numeric: true },
    { title: 'گردش بستانکار', value: (r) => r.Credit, numeric: true },
    { title: 'مانده بدهکار', value: (r) => r.EndDebit, numeric: true },
    { title: 'مانده بستانکار', value: (r) => r.EndCredit, numeric: true },
  ];
  const foot: TbRow | undefined = T ? { AccID: '', Level: 0, Code: '', Name: 'جمع', OpenDebit: T.od, OpenCredit: T.oc, Debit: T.d, Credit: T.c, EndDebit: T.ed, EndCredit: T.ec } : undefined;
  const sub = `از ${from} تا ${to} — سطح ${LEVEL_NAME[Number(level)]}`;

  const fyOpts = (fy.data?.rows ?? []).filter((y) => y.vouchers > 0 || y.sy === fy.data?.active).sort((a, b) => b.sy - a.sy);

  return (
    <NeedCompany company={company}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Title level={3} style={{ margin: 0 }}>تراز آزمایشی</Typography.Title>
          <Space wrap align="end">
            <Select
              style={{ width: 230 }}
              placeholder="سال مالی"
              value={fyOpts.find((y) => y.fj === from && y.tj === to)?.sy}
              options={fyOpts.map((y) => ({ value: y.sy, label: `${y.title}${y.status === 'closed' ? ' (بسته)' : ''}` }))}
              onChange={(v) => {
                const y = fyOpts.find((x) => x.sy === v);
                if (y) {
                  setFrom(y.fj);
                  setTo(y.tj);
                }
              }}
            />
            <DateBox value={from} onChange={setFrom} placeholder="از تاریخ" />
            <DateBox value={to} onChange={setTo} placeholder="تا تاریخ" />
            <Select style={{ width: 170 }} value={level} onChange={setLevel} options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `سطح ${n}: ${LEVEL_NAME[n]}` }))} />
            <Checkbox checked={draft} onChange={(e) => setDraft(e.target.checked)}>شامل پیش‌نویس‌ها</Checkbox>
            <Checkbox checked={hideZero} onChange={(e) => setHideZero(e.target.checked)}>بدون ردیف‌های صفر</Checkbox>
            <Checkbox checked={incClose} onChange={(e) => setIncClose(e.target.checked)}>شامل سند اختتامیه</Checkbox>
            <Checkbox checked={incOpen} onChange={(e) => setIncOpen(e.target.checked)}>شامل سند افتتاحیه</Checkbox>
            <Button type="primary" onClick={run}>نمایش</Button>
            <Button disabled={!rows.length} onClick={() => downloadCsv(`trial-balance-${todayJalali().replace(/\//g, '-')}`, ex, rows, foot, [sub])}>خروجی Excel (CSV)</Button>
            <Button disabled={!rows.length} onClick={() => printTable('تراز آزمایشی', sub, ex, rows, foot)}>چاپ</Button>
          </Space>
          <Typography.Text type="secondary">فقط اسناد «تأیید شده» (و در صورت تیک، پیش‌نویس‌ها). با کلیک روی یک ردیف (سطح معین به بعد)، دفتر معین همان حساب باز می‌شود.</Typography.Text>
        </Space>
      </Card>
      {q.isError ? <Alert type="error" showIcon message={errorMessage(q.error)} /> : null}
      {T ? (
        <Alert
          type={balanced ? 'success' : 'error'}
          showIcon
          message={balanced ? 'تراز است: جمع بدهکار = جمع بستانکار' : `تراز نیست! اختلاف گردش: ${fmtNum(Math.abs(T.d - T.c))} — اختلاف مانده: ${fmtNum(Math.abs(T.ed - T.ec))}`}
        />
      ) : null}
      <Card>
        <Table<TbRow>
          size="small"
          rowKey={(r) => `${r.Level}-${r.AccID}-${r.Code}`}
          loading={q.isFetching}
          columns={cols}
          dataSource={rows}
          pagination={{ pageSize: 100, showSizeChanger: true, pageSizeOptions: [50, 100, 200, 500] }}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'ردیفی نیست.' }}
          onRow={(r) => ({
            onClick: () => {
              if (r.Level >= 3 && r.AccID) nav(`/p/ac_led?acc=${encodeURIComponent(r.AccID)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&draft=${draft ? 1 : 0}`);
            },
            style: { cursor: r.Level >= 3 ? 'pointer' : 'default' },
          })}
          summary={() =>
            T ? (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={2}><b>جمع <Tag color={balanced ? 'green' : 'red'}>{balanced ? 'تراز' : 'ناتراز'}</Tag></b></Table.Summary.Cell>
                  {[T.od, T.oc, T.d, T.c, T.ed, T.ec].map((v, i) => (
                    <Table.Summary.Cell key={i} index={i + 2} align="end"><b>{fmtNum(v)}</b></Table.Summary.Cell>
                  ))}
                </Table.Summary.Row>
              </Table.Summary>
            ) : null
          }
        />
      </Card>
    </NeedCompany>
  );
}
