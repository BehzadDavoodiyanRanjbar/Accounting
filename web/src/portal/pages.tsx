import { Alert, Button, Card, Col, Descriptions, Input, Modal, Row as ARow, Space, Statistic, Table, Tag, Typography, theme } from 'antd';
import type { TableColumnsType } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { PairBars, monthLabel } from '../kit/charts';
import { downloadCsv } from '../kit/exporter';
import type { ExportCol } from '../kit/exporter';
import { fmtNum } from '../kit/format';
import { pcall, perr } from './client';

/* ---------- انواع داده (دقیقاً همان خروجی سرور) ---------- */
interface Inv {
  id: string;
  no: string;
  date: string;
  ret: boolean;
  kind: string;
  total: number;
  received: number | null;
  remain: number | null;
}
interface OverviewData {
  customer: string;
  company: string;
  balance: number;
  sales: number;
  returns: number;
  received: number;
  invoices: number;
  unpaidCount: number;
  unpaidSum: number;
  settledPct: number | null;
  months: { m: string; total: number }[];
  cheques: { total: number; byStatus: Record<string, number>; pendingSum: number; overdue: number };
  last: Inv[];
}
interface Chq {
  no: string;
  sayad: string;
  date: string;
  due: string;
  amount: number;
  bank: string;
  branch: string;
  status: string;
  statusDate: string;
  overdue: boolean;
}
interface Line {
  date: string;
  kind: string;
  no: string;
  desc: string;
  inc: number;
  dec: number;
  bal: number;
}

function usePq<T>(action: string, params: Record<string, unknown> = {}) {
  return useQuery<T, Error>({ queryKey: ['p', action, params], queryFn: () => pcall<T>(action, params) });
}

const money = (v: unknown) => fmtNum(v);
const tabular = { fontVariantNumeric: 'tabular-nums' } as const;

function Err({ e }: { e: Error | null }) {
  return e ? <Alert type="error" showIcon message={perr(e)} /> : null;
}

/** مانده حساب: مثبت = بدهی مشتری به شرکت */
const balText = (b: number) => (b > 0.5 ? 'مانده بدهی شما' : b < -0.5 ? 'مانده طلب شما (بستانکار)' : 'حساب شما تسویه است');

/* ---------- نمای کلی ---------- */
export function Overview({ go }: { go: (k: string) => void }) {
  const { token } = theme.useToken();
  const q = usePq<OverviewData>('portalOverview');
  const d = q.data;
  const months = useMemo(() => (d?.months ?? []).map((x) => ({ label: monthLabel(x.m), a: Math.max(0, x.total), b: 0 })), [d]);
  const kpi = (title: string, value: string, sub?: string, color?: string) => (
    <Col xs={24} sm={12} lg={8} xl={{ flex: '1 1 0' }}>
      <Card loading={q.isLoading}>
        <Statistic title={title} value={value} valueStyle={{ color, fontSize: 22 }} suffix={<small style={{ fontSize: 12 }}>ریال</small>} />
        {sub ? <div style={{ color: token.colorTextTertiary, fontSize: 12, marginTop: 4 }}>{sub}</div> : null}
      </Card>
    </Col>
  );
  return (
    <>
      <Err e={q.error} />
      {d && d.cheques.overdue > 0 ? <Alert type="warning" showIcon message={`${fmtNum(d.cheques.overdue)} چک شما از سررسید گذشته و هنوز وصول نشده است.`} action={<Button size="small" onClick={() => go('ch')}>مشاهده</Button>} /> : null}
      {d && d.unpaidCount > 0 ? <Alert type="info" showIcon message={`${fmtNum(d.unpaidCount)} فاکتور شما هنوز تسویه کامل نشده است (جمع مانده: ${money(d.unpaidSum)} ریال).`} action={<Button size="small" onClick={() => go('inv')}>مشاهدهٔ فاکتورها</Button>} /> : null}
      <ARow gutter={[12, 12]}>
        {kpi(d ? balText(d.balance) : 'مانده حساب', money(d ? Math.abs(d.balance) : 0), 'بر پایهٔ دفاتر شرکت تا امروز', d && d.balance > 0.5 ? token.colorError : token.colorSuccess)}
        {kpi('جمع خرید شما', money(d?.sales), `${fmtNum(d?.invoices ?? 0)} فاکتور و برگشتی ثبت‌شده`, token.colorPrimary)}
        {kpi('جمع دریافت‌شده از شما', money(d?.received), d && d.settledPct != null ? `${fmtNum(d.settledPct)}٪ از خرید تسویه شده` : undefined, token.colorSuccess)}
        {kpi('چک‌های در جریان', money(d?.cheques.pendingSum), d ? `${fmtNum(d.cheques.total)} چک ثبت‌شده` : undefined, token.colorWarning)}
      </ARow>
      <Card title="خرید ماهانهٔ شما" loading={q.isLoading}>
        <PairBars data={months} aName="خرید (خالص از برگشتی)" bName="" aColor={token.colorPrimary} bColor={token.colorPrimary} />
      </Card>
      <ARow gutter={[12, 12]}>
        <Col xs={24} lg={14}>
          <Card title="آخرین فاکتورها" extra={<a onClick={() => go('inv')}>همه ›</a>} loading={q.isLoading}>
            <Table<Inv>
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={d?.last ?? []}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: 'فاکتوری ثبت نشده است.' }}
              columns={[
                { title: 'شماره', dataIndex: 'no' },
                { title: 'تاریخ', dataIndex: 'date' },
                { title: 'نوع', dataIndex: 'kind' },
                { title: 'مبلغ', align: 'right', render: (_, r) => money(r.total) },
                { title: 'مانده', align: 'right', render: (_, r) => (r.remain == null ? '—' : money(r.remain)) },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="وضعیت چک‌های شما" loading={q.isLoading}>
            {d && d.cheques.total ? (
              <Space wrap>
                {Object.entries(d.cheques.byStatus).map(([k, v]) => (
                  <Tag key={k} color={k === 'وصول شده' || k === 'تنزیل شده' ? 'success' : k === 'عادی' || k === 'در جریان وصول' ? 'processing' : 'error'}>
                    {k}: {fmtNum(v)}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Typography.Text type="secondary">چکی ثبت نشده است.</Typography.Text>
            )}
          </Card>
        </Col>
      </ARow>
    </>
  );
}

/* ---------- فاکتورها ---------- */
interface Detail {
  head: Inv;
  items: { name: string; qty: number; unit: string; fee: number; discount: number; vat: number; total: number }[];
  payments: { date: string; method: string; amount: number; chequeNo: string; chequeStatus: string }[];
}

function InvoiceModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useQuery<Detail, Error>({ queryKey: ['p', 'portalInvoice', id], queryFn: () => pcall<Detail>('portalInvoice', { id }), enabled: !!id });
  const d = q.data;
  return (
    <Modal open={!!id} onCancel={onClose} footer={null} width={820} title={d ? `${d.head.kind} شمارهٔ ${d.head.no}` : 'فاکتور'}>
      <Err e={q.error} />
      {d ? (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Descriptions size="small" bordered column={{ xs: 1, sm: 2 }}>
            <Descriptions.Item label="تاریخ">{d.head.date}</Descriptions.Item>
            <Descriptions.Item label="مبلغ نهایی">{money(d.head.total)}</Descriptions.Item>
            {d.head.received != null ? <Descriptions.Item label="دریافت‌شده">{money(d.head.received)}</Descriptions.Item> : null}
            {d.head.remain != null ? <Descriptions.Item label="مانده">{money(d.head.remain)}</Descriptions.Item> : null}
          </Descriptions>
          <Table
            size="small"
            pagination={false}
            rowKey={(_, i) => String(i)}
            dataSource={d.items}
            scroll={{ x: 'max-content' }}
            columns={[
              { title: 'کالا / خدمت', dataIndex: 'name' },
              { title: 'مقدار', align: 'right', render: (_, r) => `${fmtNum(r.qty, 3)} ${r.unit}` },
              { title: 'فی', align: 'right', render: (_, r) => money(r.fee) },
              { title: 'تخفیف', align: 'right', render: (_, r) => money(r.discount) },
              { title: 'مالیات', align: 'right', render: (_, r) => money(r.vat) },
              { title: 'جمع', align: 'right', render: (_, r) => <b>{money(r.total)}</b> },
            ]}
          />
          {d.payments.length ? (
            <Table
              size="small"
              pagination={false}
              title={() => <b>پرداخت‌های ثبت‌شده برای این فاکتور</b>}
              rowKey={(_, i) => String(i)}
              dataSource={d.payments}
              columns={[
                { title: 'تاریخ', dataIndex: 'date' },
                { title: 'روش', dataIndex: 'method' },
                { title: 'شمارهٔ چک', dataIndex: 'chequeNo' },
                { title: 'وضعیت چک', dataIndex: 'chequeStatus' },
                { title: 'مبلغ', align: 'right', render: (_, r) => money(r.amount) },
              ]}
            />
          ) : null}
        </Space>
      ) : null}
    </Modal>
  );
}

export function Invoices() {
  const [f, setF] = useState({ from: '', to: '', q: '' });
  const [open, setOpen] = useState<string | null>(null);
  const q = usePq<{ rows: Inv[]; totals: { count: number; sales: number; returns: number; remain: number } }>('portalInvoices', { from: f.from, to: f.to });
  const rows = useMemo(() => (q.data?.rows ?? []).filter((r) => !f.q || r.no.includes(f.q)), [q.data, f.q]);
  const T = q.data?.totals;
  const cols: TableColumnsType<Inv> = [
    { title: 'شماره', dataIndex: 'no', render: (v: string, r) => <a onClick={() => setOpen(r.id)}>{v}</a> },
    { title: 'تاریخ', dataIndex: 'date' },
    { title: 'نوع', dataIndex: 'kind', render: (v: string, r) => (r.ret ? <Tag color="orange">{v}</Tag> : v) },
    { title: 'مبلغ', align: 'right', render: (_, r) => <span style={tabular}>{money(r.total)}</span> },
    { title: 'دریافت‌شده', align: 'right', render: (_, r) => (r.received == null ? '—' : money(r.received)) },
    { title: 'مانده', align: 'right', render: (_, r) => (r.remain == null ? '—' : <b>{money(r.remain)}</b>) },
    { title: 'وضعیت', render: (_, r) => (r.ret ? null : (r.remain ?? 0) > 0.5 ? <Tag color="error">مانده‌دار</Tag> : <Tag color="success">تسویه</Tag>) },
    { title: '', render: (_, r) => <Button size="small" onClick={() => setOpen(r.id)}>جزئیات</Button> },
  ];
  const csv = () => {
    const c: ExportCol<Inv>[] = [
      { title: 'شماره', value: (r) => r.no },
      { title: 'تاریخ', value: (r) => r.date },
      { title: 'نوع', value: (r) => r.kind },
      { title: 'مبلغ', value: (r) => Math.round(r.total), numeric: true },
      { title: 'دریافت‌شده', value: (r) => (r.received == null ? '' : Math.round(r.received)), numeric: true },
      { title: 'مانده', value: (r) => (r.remain == null ? '' : Math.round(r.remain)), numeric: true },
    ];
    downloadCsv('my-invoices', c, rows);
  };
  return (
    <>
      <Card
        title="فاکتورهای من"
        extra={
          <Space wrap>
            <Input style={{ width: 130 }} allowClear placeholder="از تاریخ (1405/01/01)" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value.trim() })} />
            <Input style={{ width: 130 }} allowClear placeholder="تا تاریخ" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value.trim() })} />
            <Input style={{ width: 130 }} allowClear placeholder="شمارهٔ فاکتور" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value.trim() })} />
            <Button onClick={csv} disabled={!rows.length}>خروجی Excel (CSV)</Button>
          </Space>
        }
      >
        <Err e={q.error} />
        {T ? (
          <Space size="large" wrap style={{ marginBottom: 12 }}>
            <span>تعداد: <b>{fmtNum(T.count)}</b></span>
            <span>جمع خرید: <b>{money(T.sales)}</b></span>
            <span>برگشت از فروش: <b>{money(T.returns)}</b></span>
            <span>جمع مانده فاکتورها: <b>{money(T.remain)}</b></span>
          </Space>
        ) : null}
        <Table<Inv> size="small" loading={q.isFetching} rowKey="id" dataSource={rows} columns={cols} scroll={{ x: 'max-content' }} pagination={{ pageSize: 30, hideOnSinglePage: true }} locale={{ emptyText: 'فاکتوری پیدا نشد.' }} />
      </Card>
      <InvoiceModal id={open} onClose={() => setOpen(null)} />
    </>
  );
}

/* ---------- صورت‌حساب ---------- */
export function Statement({ customer, company }: { customer: string; company: string }) {
  const [f, setF] = useState({ from: '', to: '' });
  const q = usePq<{ row: { opening: number; sales: number; returns: number; received: number; closing: number }; lines: Line[] }>('portalStatement', f);
  const d = q.data;
  const csv = () => {
    const c: ExportCol<Line>[] = [
      { title: 'تاریخ', value: (r) => r.date },
      { title: 'نوع', value: (r) => r.kind },
      { title: 'شماره', value: (r) => r.no },
      { title: 'شرح', value: (r) => r.desc },
      { title: 'بدهکار', value: (r) => Math.round(r.inc), numeric: true },
      { title: 'بستانکار', value: (r) => Math.round(r.dec), numeric: true },
      { title: 'مانده', value: (r) => Math.round(r.bal), numeric: true },
    ];
    downloadCsv('my-statement', c, d?.lines ?? []);
  };
  return (
    <Card
      title={`صورت‌حساب ${customer} نزد ${company}`}
      extra={
        <Space wrap className="no-print">
          <Input style={{ width: 130 }} allowClear placeholder="از تاریخ" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value.trim() })} />
          <Input style={{ width: 130 }} allowClear placeholder="تا تاریخ" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value.trim() })} />
          <Button onClick={csv} disabled={!d?.lines.length}>CSV</Button>
          <Button onClick={() => window.print()}>چاپ</Button>
        </Space>
      }
    >
      <Err e={q.error} />
      {d ? (
        <ARow gutter={[12, 12]} style={{ marginBottom: 12 }}>
          {[
            ['مانده اول دوره', d.row.opening],
            ['فروش به شما', d.row.sales],
            ['برگشت از فروش', d.row.returns],
            ['دریافت از شما', d.row.received],
            [balText(d.row.closing), Math.abs(d.row.closing)],
          ].map(([t, v]) => (
            <Col key={t as string} xs={12} md={8} xl={{ flex: '1 1 0' }}>
              <Statistic title={t as string} value={money(v)} valueStyle={{ fontSize: 18 }} />
            </Col>
          ))}
        </ARow>
      ) : null}
      <Table<Line>
        size="small"
        loading={q.isFetching}
        rowKey={(_, i) => String(i)}
        dataSource={d?.lines ?? []}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'گردشی در این بازه نیست.' }}
        columns={[
          { title: 'تاریخ', dataIndex: 'date' },
          { title: 'نوع', dataIndex: 'kind' },
          { title: 'شماره', dataIndex: 'no' },
          { title: 'شرح', dataIndex: 'desc' },
          { title: 'بدهکار', align: 'right', render: (_, r) => (r.inc ? money(r.inc) : '') },
          { title: 'بستانکار', align: 'right', render: (_, r) => (r.dec ? money(r.dec) : '') },
          { title: 'مانده', align: 'right', render: (_, r) => <b>{money(r.bal)}</b> },
        ]}
      />
      <Typography.Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12 }}>
        «بدهکار» یعنی فاکتور فروش به شما؛ «بستانکار» یعنی دریافت از شما یا برگشت از فروش. این گزارش از دفاتر شرکت تهیه شده و در صورت مغایرت با شرکت تماس بگیرید.
      </Typography.Paragraph>
      <style>{'@media print{.no-print{display:none!important}body{background:#fff}}'}</style>
    </Card>
  );
}

/* ---------- چک‌ها ---------- */
export function Cheques() {
  const q = usePq<{ rows: Chq[]; totals: { count: number; pending: number; cleared: number; returned: number } }>('portalCheques');
  const T = q.data?.totals;
  const colorOf = (s: string) => (s === 'وصول شده' || s === 'تنزیل شده' ? 'success' : s === 'عادی' || s === 'در جریان وصول' ? 'processing' : 'error');
  return (
    <Card title="چک‌های من">
      <Err e={q.error} />
      {T ? (
        <Space size="large" wrap style={{ marginBottom: 12 }}>
          <span>تعداد: <b>{fmtNum(T.count)}</b></span>
          <span>در جریان وصول: <b>{money(T.pending)}</b></span>
          <span>وصول‌شده: <b>{money(T.cleared)}</b></span>
          <span>برگشتی/عودت‌شده: <b>{money(T.returned)}</b></span>
        </Space>
      ) : null}
      <Table<Chq>
        size="small"
        loading={q.isFetching}
        rowKey={(r, i) => `${r.no}-${r.sayad}-${i}`}
        dataSource={q.data?.rows ?? []}
        pagination={{ pageSize: 30, hideOnSinglePage: true }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'چکی ثبت نشده است.' }}
        columns={[
          { title: 'شمارهٔ چک', dataIndex: 'no' },
          { title: 'شمارهٔ صیاد', dataIndex: 'sayad' },
          { title: 'بانک', render: (_, r) => `${r.bank}${r.branch ? ` / ${r.branch}` : ''}` },
          { title: 'تاریخ چک', dataIndex: 'date' },
          { title: 'سررسید', render: (_, r) => (<span>{r.due} {r.overdue ? <Tag color="red">گذشته</Tag> : null}</span>) },
          { title: 'مبلغ', align: 'right', render: (_, r) => <b>{money(r.amount)}</b> },
          { title: 'وضعیت', render: (_, r) => <Tag color={colorOf(r.status)}>{r.status}</Tag> },
          { title: 'تاریخ وضعیت', dataIndex: 'statusDate' },
        ]}
      />
    </Card>
  );
}
