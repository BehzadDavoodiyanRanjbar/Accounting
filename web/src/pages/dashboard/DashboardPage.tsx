import { Alert, Card, Col, Collapse, Descriptions, Empty, Row as ARow, Select, Space, Statistic, Table, Tabs, Tag, Typography, theme } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCompany } from '../../api/CompanyContext';
import { HBars, PairBars, StackBar, monthLabel } from '../../kit/charts';
import type { BarPoint, Seg } from '../../kit/charts';
import { fmtNum, str } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import type { Opt, Row } from '../../kit/types';
import { useFyRange } from '../accounting/common';
import { DateBox, NeedCompany, isOn, useBankAccounts } from '../bank/common';

interface Dash {
  total: Row;
  inv?: Row | null;
  bySupplier: Row[];
  byMonth: Row[];
  byGroup: Row[];
  bySub: Row[];
  byProduct: Row[];
  sales?: { total: Row; byCustomer: Row[]; byMonth: Row[]; byGroup: Row[]; bySub: Row[]; byProduct: Row[]; diag?: Row };
}
interface Chq {
  rows: Row[];
  totals: { count: number; amount: number };
}
interface Party {
  sup?: { rows: Row[]; total: Row };
  cus?: { rows: Row[]; total: Row };
}

const PENDING = ['عادی', 'در جریان وصول'];
const num = (v: unknown) => Number(v) || 0;
const act = (r: Row) => r.IsActive === undefined || isOn(r.IsActive);

/** داشبورد مدیریتی با دادهٔ واقعی شرکت فعال (تم روشن برنامه) */
export default function DashboardPage() {
  return <DashboardInner />;
}

function DashboardInner() {
  const { company, data } = useCompany();
  const { token } = theme.useToken();
  const [f, setF] = useState({ from: '', to: '', supplier: '', customer: '', group: '', subgroup: '', product: '' });
  const ready = useFyRange((from, to) => setF((o) => ({ ...o, from, to })));
  const q = useCsQuery<Dash>('dashboard', f, ready);
  const banks = useBankAccounts();
  const party = useCsQuery<Party>('partyReport', {});
  const chIn = useCsQuery<Chq>('chequeList', { dir: 'in', status: 'all' });
  const chOut = useCsQuery<Chq>('chequeList', { dir: 'out', status: 'all' });
  const exp = useCsQuery<{ rows: Row[] }>('expenseList', { category: '', from: f.from, to: f.to }, ready);

  const mine = (a?: Row[]) => (a ?? []).filter((r) => (!r.CompanyID || r.CompanyID === company) && act(r));
  const opts = useMemo(() => {
    const o = (a: Row[], id: string, name: string, pre = ''): Opt[] => a.map((r) => ({ value: str(r[id]), label: `${pre}${str(r[name])}` }));
    return {
      sup: o(mine(data?.suppliers as Row[]), 'SupplierID', 'Name'),
      cus: o(mine(data?.customers as Row[]), 'CustomerID', 'Name'),
      grp: o(mine(data?.groups as Row[]), 'GroupID', 'GroupName'),
      sub: o(mine(data?.subs as Row[]), 'SubGroupID', 'SubGroupName'),
      prd: [...o(mine(data?.products as Row[]), 'ProductID', 'Name'), ...o(mine(data?.services as Row[]), 'ServiceID', 'Name', '[خدمت] ')],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, company]);

  const d = q.data;
  const T = d?.total ?? {};
  const S = d?.sales;
  const ST = S?.total ?? {};

  const months = useMemo<BarPoint[]>(() => {
    const m = new Map<string, BarPoint>();
    const put = (rows: Row[] | undefined, k: 'a' | 'b') =>
      (rows ?? []).forEach((r) => {
        const key = str(r.name);
        const p = m.get(key) ?? { label: key, a: 0, b: 0 };
        p[k] += num(r.net);
        m.set(key, p);
      });
    put(S?.byMonth, 'a');
    put(d?.byMonth, 'b');
    return [...m.values()].sort((x, y) => (x.label < y.label ? -1 : 1)).map((p) => ({ ...p, label: monthLabel(p.label) }));
  }, [d, S]);

  const cash = useMemo(() => {
    const rows = (banks.data?.rows ?? []).filter((a) => isOn(a.IsActive));
    return { sum: rows.reduce((t, a) => t + num(a.Balance), 0), n: rows.length };
  }, [banks.data]);

  const pending = (c?: Chq) => (c?.rows ?? []).filter((r) => PENDING.includes(str(r.Status)));
  const pIn = pending(chIn.data);
  const pOut = pending(chOut.data);
  const sum = (a: Row[]) => a.reduce((t, r) => t + num(r.Amount), 0);

  const expSegs = useMemo<Seg[]>(() => {
    const colors = [token.colorPrimary, token.colorWarning, token.colorSuccess, '#13c2c2', token.colorError, '#722ed1', '#8c8c8c'];
    const m = new Map<string, number>();
    (exp.data?.rows ?? []).forEach((r) => m.set(str(r.Category) || 'بدون نوع', (m.get(str(r.Category) || 'بدون نوع') ?? 0) + num(r.CostBase || r.Amount)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }));
  }, [exp.data, token]);

  const top = (rows: Row[] | undefined, k: string, n = 8) => (rows ?? []).slice(0, n).map((r) => ({ name: str(r.name), value: num(r[k]) }));
  const topQty = (rows: Row[] | undefined) => (rows ?? []).slice().sort((a, b) => num(b.qty) - num(a.qty)).slice(0, 8).map((r) => ({ name: str(r.name), value: num(r.qty) }));
  const owed = (p?: { rows: Row[] }, sign = 1) =>
    (p?.rows ?? [])
      .filter((r) => num(r.closing) * sign > 0.5)
      .sort((a, b) => num(b.closing) * sign - num(a.closing) * sign)
      .slice(0, 6)
      .map((r) => ({ name: str(r.name), value: Math.abs(num(r.closing)) }));

  const set = (p: Partial<typeof f>) => setF((o) => ({ ...o, ...p }));
  const sel = (ph: string, v: string, o: Opt[], k: keyof typeof f) => (
    <Select style={{ width: 170 }} allowClear showSearch optionFilterProp="label" placeholder={ph} value={v || undefined} options={o} onChange={(x) => set({ [k]: x ?? '' } as Partial<typeof f>)} />
  );

  const sumCols = (first: string): TableColumnsType<Row> => [
    { title: first, dataIndex: 'name' },
    { title: 'فاکتور', dataIndex: 'count', align: 'right', render: (v: unknown) => fmtNum(v) },
    { title: 'مبلغ', dataIndex: 'gross', align: 'right', render: (v: unknown) => fmtNum(v) },
    { title: 'تخفیف', dataIndex: 'disc', align: 'right', render: (v: unknown) => fmtNum(v) },
    { title: 'مالیات', dataIndex: 'vat', align: 'right', render: (v: unknown) => fmtNum(v) },
    { title: 'قابل پرداخت', dataIndex: 'total', align: 'right', render: (v: unknown) => <b>{fmtNum(v)}</b> },
  ];
  const tab = (title: string, rows: Row[] | undefined, first: string) => {
    const a = rows ?? [];
    const t = (k: string) => a.reduce((s, r) => s + num(r[k]), 0);
    return (
      <Card size="small" title={title}>
        <Table<Row>
          size="small"
          rowKey={(_, i) => String(i)}
          dataSource={a}
          columns={sumCols(first)}
          pagination={{ pageSize: 15, hideOnSinglePage: true }}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'داده‌ای نیست.' }}
          summary={() =>
            a.length > 1 ? (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}><b>جمع</b></Table.Summary.Cell>
                <Table.Summary.Cell index={1} />
                <Table.Summary.Cell index={2} align="right"><b>{fmtNum(t('gross'))}</b></Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right"><b>{fmtNum(t('disc'))}</b></Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right"><b>{fmtNum(t('vat'))}</b></Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right"><b>{fmtNum(t('total'))}</b></Table.Summary.Cell>
              </Table.Summary.Row>
            ) : null
          }
        />
      </Card>
    );
  };

  const chequeList = (rows: Row[], c: Chq | undefined, link: string) => (
    <div>
      <Space size="large" wrap style={{ marginBottom: 8 }}>
        <span>در جریان: <b>{fmtNum(rows.length)}</b> چک</span>
        <span>جمع: <b>{fmtNum(sum(rows))}</b></span>
        <span>سررسیدگذشته: <b style={{ color: token.colorError }}>{fmtNum(rows.filter((r) => r.Overdue).length)}</b></span>
        <Link to={link}>همه ›</Link>
      </Space>
      {rows.length ? (
        <Table<Row>
          size="small"
          showHeader={false}
          pagination={false}
          rowKey={(r) => str(r.ChequeID ?? `${r.No}-${r.DueJalali}`)}
          dataSource={rows.slice(0, 6)}
          columns={[
            { render: (_, r) => <div><b>{str(r.PartyName) || '—'}</b><div style={{ color: token.colorTextTertiary, fontSize: 12 }}>{str(r.BankName)} {r.No ? `· ${str(r.No)}` : ''}</div></div> },
            { render: (_, r) => <span>{str(r.DueJalali)} {r.Overdue ? <Tag color="red">گذشته</Tag> : null}</span> },
            { align: 'right', render: (_, r) => <b>{fmtNum(r.Amount)}</b> },
          ]}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={c ? 'چک در جریان نیست' : 'در حال بارگذاری…'} />
      )}
    </div>
  );

  const hasData = num(T.invoices) > 0 || num(ST.invoices) > 0;

  return (
    <NeedCompany company={company}>
      <Card size="small">
        <Space wrap>
          <DateBox placeholder="از تاریخ" value={f.from} onChange={(v) => set({ from: v })} />
          <DateBox placeholder="تا تاریخ" value={f.to} onChange={(v) => set({ to: v })} />
          {sel('فروشنده', f.supplier, opts.sup, 'supplier')}
          {sel('خریدار', f.customer, opts.cus, 'customer')}
          {sel('گروه', f.group, opts.grp, 'group')}
          {sel('گروه فرعی', f.subgroup, opts.sub, 'subgroup')}
          {sel('کالا / خدمت', f.product, opts.prd, 'product')}
        </Space>
      </Card>

      {q.isError ? <Alert type="error" showIcon message="بارگذاری داشبورد انجام نشد." /> : null}
      {!q.isLoading && d && !hasData ? (
        <Alert type="info" showIcon message="در این بازه فاکتور خرید یا فروشی ثبت نشده است. شرکت فعال و فیلتر تاریخ را بررسی کنید." />
      ) : null}

      <ARow gutter={[12, 12]}>
        {[
          { t: 'موجودی بانک، صندوق و تنخواه', v: cash.sum, s: `${fmtNum(cash.n)} حساب فعال`, c: cash.sum < 0 ? token.colorError : undefined, ok: !banks.isError },
          { t: 'فروش دوره (مبلغ نهایی)', v: num(ST.total), s: `${fmtNum(ST.invoices)} فاکتور`, c: token.colorPrimary, ok: !!d },
          { t: 'خرید دوره (مبلغ نهایی)', v: num(T.total), s: `${fmtNum(T.invoices)} فاکتور`, c: token.colorWarning, ok: !!d },
          { t: 'مانده طلب از خریداران', v: num(party.data?.cus?.total?.closing), s: 'تا امروز، با احتساب دریافت‌ها', c: token.colorSuccess, ok: !party.isError },
          { t: 'مانده بدهی به فروشندگان', v: num(party.data?.sup?.total?.closing), s: 'تا امروز، با احتساب پرداخت‌ها', c: token.colorError, ok: !party.isError },
        ]
          .filter((k) => k.ok)
          .map((k) => (
            <Col key={k.t} xs={24} sm={12} lg={8} xl={{ flex: '1 1 0' }}>
              <Card loading={q.isLoading && k.t.includes('دوره')}>
                <Statistic title={k.t} value={fmtNum(k.v)} valueStyle={{ color: k.c, fontSize: 22 }} suffix={<small style={{ fontSize: 12 }}>ریال</small>} />
                <div style={{ color: token.colorTextTertiary, fontSize: 12, marginTop: 4 }}>{k.s}</div>
              </Card>
            </Col>
          ))}
      </ARow>

      <Card title="فروش و خرید ماهانه (مبلغ بعد از تخفیف)" loading={q.isLoading}>
        <PairBars data={months} aName="فروش" bName="خرید" aColor={token.colorPrimary} bColor={token.colorWarning} />
      </Card>

      <ARow gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card title="چک‌های دریافتنی در جریان" loading={chIn.isLoading} style={{ height: '100%' }}>
            {chIn.isError ? <Typography.Text type="secondary">دسترسی یا دادهٔ چک در دسترس نیست.</Typography.Text> : chequeList(pIn, chIn.data, '/p/bk_chi')}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="چک‌های پرداختنی در جریان" loading={chOut.isLoading} style={{ height: '100%' }}>
            {chOut.isError ? <Typography.Text type="secondary">دسترسی یا دادهٔ چک در دسترس نیست.</Typography.Text> : chequeList(pOut, chOut.data, '/p/bk_cho')}
          </Card>
        </Col>
      </ARow>

      <ARow gutter={[12, 12]}>
        <Col xs={24} lg={8}>
          <Card title="بیشترین بدهکاران (طلب ما)" loading={party.isLoading} style={{ height: '100%' }}>
            <HBars items={owed(party.data?.cus)} color={token.colorSuccess} empty="خریدار بدهکاری نیست." />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="بیشترین بستانکاران (بدهی ما)" loading={party.isLoading} style={{ height: '100%' }}>
            <HBars items={owed(party.data?.sup)} color={token.colorError} empty="به فروشنده‌ای بدهکار نیستیم." />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="ترکیب هزینه‌های سربار دوره" loading={exp.isLoading} style={{ height: '100%' }}>
            {exp.isError ? <Typography.Text type="secondary">دادهٔ فاکتور هزینه در دسترس نیست.</Typography.Text> : <StackBar segs={expSegs} />}
          </Card>
        </Col>
      </ARow>

      <Card loading={q.isLoading}>
        <Tabs
          items={[
            {
              key: 's',
              label: 'نمودارهای فروش',
              children: (
                <ARow gutter={[16, 16]}>
                  {[
                    ['به تفکیک خریدار', top(S?.byCustomer, 'total')],
                    ['به تفکیک گروه کالا/خدمت', top(S?.byGroup, 'net')],
                    ['پرفروش‌ترین‌ها (مبلغ)', top(S?.byProduct, 'net')],
                    ['پرفروش‌ترین‌ها (تعداد)', topQty(S?.byProduct)],
                  ].map(([t, items]) => (
                    <Col key={t as string} xs={24} md={12} xl={6}>
                      <Typography.Title level={5}>{t as string}</Typography.Title>
                      <HBars items={items as { name: string; value: number }[]} color={token.colorPrimary} />
                    </Col>
                  ))}
                </ARow>
              ),
            },
            {
              key: 'p',
              label: 'نمودارهای خرید',
              children: (
                <ARow gutter={[16, 16]}>
                  {[
                    ['به تفکیک فروشنده', top(d?.bySupplier, 'net')],
                    ['به تفکیک گروه کالا', top(d?.byGroup, 'net')],
                    ['بیشترین کالا (مبلغ)', top(d?.byProduct, 'net')],
                    ['بیشترین کالا (تعداد)', topQty(d?.byProduct)],
                  ].map(([t, items]) => (
                    <Col key={t as string} xs={24} md={12} xl={6}>
                      <Typography.Title level={5}>{t as string}</Typography.Title>
                      <HBars items={items as { name: string; value: number }[]} color={token.colorWarning} />
                    </Col>
                  ))}
                </ARow>
              ),
            },
          ]}
        />
      </Card>

      <Collapse
        items={[
          {
            key: 'sum',
            label: 'خلاصهٔ ارقام خرید و فروش دوره',
            children: (
              <ARow gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Descriptions size="small" bordered column={1} title="خرید">
                    <Descriptions.Item label="تعداد فاکتور">{fmtNum(T.invoices)}</Descriptions.Item>
                    <Descriptions.Item label="تعداد فروشنده">{fmtNum(T.suppliers)}</Descriptions.Item>
                    <Descriptions.Item label="جمع ناخالص">{fmtNum(T.gross)}</Descriptions.Item>
                    <Descriptions.Item label="جمع تخفیف">{fmtNum(T.disc)}</Descriptions.Item>
                    <Descriptions.Item label="جمع بعد از تخفیف">{fmtNum(T.net)}</Descriptions.Item>
                    <Descriptions.Item label="جمع مالیات">{fmtNum(T.vat)}</Descriptions.Item>
                    <Descriptions.Item label="مبلغ نهایی">{fmtNum(T.total)}</Descriptions.Item>
                    {num(T.retCount) ? <Descriptions.Item label="برگشت از خرید">{fmtNum(T.retCount)} فاکتور / {fmtNum(T.retTotal)}</Descriptions.Item> : null}
                    {d?.inv ? (
                      <>
                        <Descriptions.Item label="هزینه‌های جانبی">{fmtNum(d.inv.costs)}</Descriptions.Item>
                        <Descriptions.Item label="قابل پرداخت">{fmtNum(d.inv.payable)}</Descriptions.Item>
                        <Descriptions.Item label="پرداخت‌شده">{fmtNum(d.inv.paid)}</Descriptions.Item>
                        <Descriptions.Item label="مانده">{fmtNum(d.inv.remaining)}</Descriptions.Item>
                      </>
                    ) : null}
                  </Descriptions>
                </Col>
                <Col xs={24} lg={12}>
                  <Descriptions size="small" bordered column={1} title="فروش کالا و خدمات">
                    <Descriptions.Item label="تعداد فاکتور">{fmtNum(ST.invoices)}</Descriptions.Item>
                    <Descriptions.Item label="تعداد خریدار">{fmtNum(ST.customers)}</Descriptions.Item>
                    <Descriptions.Item label="جمع ناخالص">{fmtNum(ST.gross)}</Descriptions.Item>
                    <Descriptions.Item label="جمع تخفیف">{fmtNum(ST.disc)}</Descriptions.Item>
                    <Descriptions.Item label="جمع بعد از تخفیف">{fmtNum(ST.net)}</Descriptions.Item>
                    <Descriptions.Item label="جمع مالیات">{fmtNum(ST.vat)}</Descriptions.Item>
                    <Descriptions.Item label="مبلغ نهایی">{fmtNum(ST.total)}</Descriptions.Item>
                  </Descriptions>
                  <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
                    فاکتورهای ابطال‌شده، اصلاح‌شده و ردشده حساب نمی‌شوند؛ برگشت از فروش کسر می‌شود{num(ST.drafts) ? ` · شامل ${fmtNum(ST.drafts)} پیش‌نویس` : ''}.
                    {S?.diag?.all ? ` از ${fmtNum(S.diag.all)} فاکتور فروش این بازه، ${fmtNum(ST.invoices)} محاسبه شد.` : ''}
                  </Typography.Paragraph>
                </Col>
              </ARow>
            ),
          },
          { key: 'tb', label: 'جدول خریداران و فروشندگان', children: <ARow gutter={[12, 12]}><Col xs={24} xl={12}>{tab('خریداران (فروش به مشتریان)', S?.byCustomer, 'خریدار')}</Col><Col xs={24} xl={12}>{tab('فروشندگان (خرید از تأمین‌کنندگان)', d?.bySupplier, 'فروشنده')}</Col></ARow> },
        ]}
      />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        مبالغ به ریال و بر پایهٔ فاکتورهای ثبت‌شده است. نمودار ماهانه فقط ماه‌های دارای فاکتور را نشان می‌دهد.
      </Typography.Text>
    </NeedCompany>
  );
}
