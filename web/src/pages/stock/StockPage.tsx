import { Alert, Button, Card, Checkbox, Input, Select, Space, Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { useCompany } from '../../api/CompanyContext';
import { downloadCsv } from '../../kit/exporter';
import type { ExportCol } from '../../kit/exporter';
import { fmtQty, str, todayJalali } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import type { Row } from '../../kit/types';
import { NeedCompany, isOn } from '../bank/common';
import { StockDetailModal } from './StockDetailModal';
import { nk, sumCols } from './common';

const KEYS = ['opening', 'purchased', 'retPurch', 'sold', 'returned', 'produced', 'consumed', 'cu', 'adj', 'balance'];

const num = (v: unknown, bold = false) => {
  const n = Number(v) || 0;
  return <span style={{ color: bold && n < 0 ? '#cf1322' : undefined, fontWeight: bold ? 700 : undefined }}>{fmtQty(n)}</span>;
};

export default function StockPage() {
  const { company, data } = useCompany();
  const q = useCsQuery<Row[]>('stock', {});
  const [text, setText] = useState('');
  const [group, setGroup] = useState('');
  const [kind, setKind] = useState('raw');
  const [onlyNeg, setOnlyNeg] = useState(false);
  const [onlySel, setOnlySel] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [det, setDet] = useState<Row | null>(null);

  const all: Row[] = useMemo(() => q.data ?? [], [q.data]);
  const groups: Row[] = useMemo(
    () => ((data?.groups ?? []) as Row[]).filter((g) => (!g.CompanyID || g.CompanyID === company) && (g.IsActive === undefined || isOn(g.IsActive))),
    [data, company],
  );
  const groupName = (id: unknown) => str(groups.find((g) => g.GroupID === id)?.GroupName);

  const vis = useMemo(() => {
    const k = nk(text);
    return all.filter(
      (x) =>
        (kind === 'all' || (kind === 'made' ? x.made : !x.made)) &&
        (!k || nk(`${x.Name} ${x.Code ?? ''}`).includes(k)) &&
        (!group || x.GroupID === group) &&
        (!onlyNeg || Number(x.balance) < 0) &&
        (!onlySel || sel.includes(x.ProductID)),
    );
  }, [all, text, group, kind, onlyNeg, onlySel, sel]);

  const negs = all.filter((x) => Number(x.balance) < 0);
  const selRows = all.filter((x) => sel.includes(x.ProductID));
  const filtered = !!(text || group || onlyNeg || onlySel);
  const tVis = sumCols(vis, KEYS);
  const tSel = sumCols(selRows, KEYS);

  const col = (title: string, key: string, bold = false): TableColumnsType<Row>[number] => ({
    title,
    dataIndex: key,
    align: 'right',
    render: (v: unknown) => num(v, bold),
  });
  const columns: TableColumnsType<Row> = [
    { title: 'کالا', dataIndex: 'Name', width: 220 },
    { title: 'کد', dataIndex: 'Code', width: 90 },
    { title: 'واحد', dataIndex: 'Unit', width: 70 },
    col('موجودی اولیه', 'opening'),
    col('خرید', 'purchased'),
    col('برگشت از خرید', 'retPurch'),
    col('فروش', 'sold'),
    col('برگشت از فروش', 'returned'),
    col('تولید', 'produced'),
    col('مصرف در تولید', 'consumed'),
    col('مصرف قراردادها', 'cu'),
    col('تعدیل', 'adj'),
    col('موجودی', 'balance', true),
    {
      title: '',
      width: 70,
      render: (_, r) => (
        <Button
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setDet(r);
          }}
        >
          ریز
        </Button>
      ),
    },
  ];

  const exportCols: ExportCol<Row>[] = [
    { title: 'کالا', value: (r) => r.Name },
    { title: 'کد', value: (r) => r.Code },
    { title: 'گروه', value: (r) => groupName(r.GroupID) },
    { title: 'واحد', value: (r) => r.Unit },
    ...(
      [
        ['موجودی اولیه', 'opening'],
        ['خرید', 'purchased'],
        ['برگشت از خرید', 'retPurch'],
        ['فروش', 'sold'],
        ['برگشت از فروش', 'returned'],
        ['تولید', 'produced'],
        ['مصرف در تولید', 'consumed'],
        ['مصرف قراردادها', 'cu'],
        ['تعدیل', 'adj'],
        ['موجودی', 'balance'],
      ] as [string, string][]
    ).map(([title, k]): ExportCol<Row> => ({ title, numeric: true, value: (r) => Number(r[k]) || 0 })),
  ];
  const doExport = () => {
    const foot: Row = { Name: `جمع (${vis.length} کالا)`, ...tVis };
    downloadCsv(`stock-${todayJalali().replace(/\//g, '-')}`, exportCols, vis, foot, [
      'موجودی = موجودی اولیه + خرید − برگشت از خرید − فروش + برگشت از فروش + تولید − مصرف در تولید − مصرف قراردادها + تعدیل',
    ]);
  };

  const sumRow = (label: string, t: Record<string, number>, bg: string) => (
    <Table.Summary.Row style={{ background: bg, fontWeight: 700 }}>
      <Table.Summary.Cell index={0} colSpan={4}>
        {label}
      </Table.Summary.Cell>
      {KEYS.map((k, i) => (
        <Table.Summary.Cell key={k} index={i + 4} align="right">
          {num(t[k], k === 'balance')}
        </Table.Summary.Cell>
      ))}
      <Table.Summary.Cell index={14} />
    </Table.Summary.Row>
  );

  return (
    <NeedCompany company={company}>
      <Card size="small">
        <Typography.Title level={5} style={{ margin: 0 }}>
          موجودی کالا = موجودی اولیه (مانده‌ی پایان سال قبل) + خرید − برگشت از خرید − فروش + برگشت از فروش + تولید − مصرف در تولید + تعدیل
        </Typography.Title>
        <Space wrap style={{ marginTop: 10 }}>
          <Input allowClear placeholder="جستجوی نام یا کد کالا" style={{ width: 220 }} value={text} onChange={(e) => setText(e.target.value)} />
          <Select
            style={{ width: 180 }}
            value={group}
            onChange={setGroup}
            options={[{ value: '', label: 'همه گروه‌ها' }, ...groups.map((g) => ({ value: str(g.GroupID), label: str(g.GroupName) }))]}
          />
          <Select
            style={{ width: 230 }}
            value={kind}
            onChange={setKind}
            options={[
              { value: 'raw', label: 'مواد اولیه و کالای خریداری‌شده' },
              { value: 'made', label: 'کالای ساخته‌شده' },
              { value: 'all', label: 'همه' },
            ]}
          />
          <Checkbox checked={onlyNeg} onChange={(e) => setOnlyNeg(e.target.checked)}>
            فقط موجودی منفی
          </Checkbox>
          <Checkbox checked={onlySel} onChange={(e) => setOnlySel(e.target.checked)}>
            فقط کالاهای انتخاب‌شده
          </Checkbox>
          <Button onClick={() => setSel(Array.from(new Set([...sel, ...vis.map((x) => str(x.ProductID))])))}>انتخاب همه‌ی نمایان‌ها</Button>
          <Button onClick={() => setSel([])}>پاک‌کردن انتخاب</Button>
          <Button type="primary" onClick={doExport} disabled={!vis.length}>
            خروجی Excel (CSV)
          </Button>
        </Space>
        <Typography.Paragraph type="secondary" style={{ margin: '8px 0 0', fontSize: 12 }}>
          برای انتخاب چند کالا روی ردیف آن‌ها کلیک کنید (دوباره کلیک = برداشتن انتخاب). ردیف «جمع» در پایین جدول با فیلتر و انتخاب شما تغییر می‌کند. برای دیدن ریز خرید و فروش یک کالا دکمه‌ی «ریز» را بزنید.
          <b> کالاهای ساخته‌شده (دارای فرمول ساخت) به‌طور پیش‌فرض در این جدول نیستند و در «کالای ساخته‌شده» دیده می‌شوند</b> (از فیلتر «نوع کالا» هم می‌توانید ببینید).
        </Typography.Paragraph>
      </Card>

      {negs.length ? (
        <Alert
          type="error"
          showIcon
          message={`${negs.length} کالا مانده‌ی منفی دارد`}
          description={`(${negs
            .slice(0, 6)
            .map((x) => `${x.Name}: ${fmtQty(x.balance)}`)
            .join('، ')}${negs.length > 6 ? ' و ...' : ''}) — معمولاً یعنی خرید یا تولید ثبت نشده است. بهتر است پیش از پایان سال اصلاح شود؛ در غیر این صورت هنگام بستن سال مالی با «تعدیل موجودی» صفر می‌شود و مانده‌ی منفی به سال بعد نمی‌رود.`}
        />
      ) : null}

      <Table<Row>
        size="small"
        bordered
        loading={q.isLoading}
        columns={columns}
        dataSource={vis}
        rowKey="ProductID"
        pagination={{ pageSize: 100, showSizeChanger: true, pageSizeOptions: [50, 100, 200, 500] }}
        scroll={{ x: 'max-content' }}
        rowSelection={{ selectedRowKeys: sel, onChange: (keys) => setSel((prev) => [...prev.filter((k) => !vis.some((v) => v.ProductID === k)), ...keys.map(String)]) }}
        onRow={(r) => ({
          style: { cursor: 'pointer' },
          onClick: () => setSel((p) => (p.includes(r.ProductID) ? p.filter((x) => x !== r.ProductID) : [...p, r.ProductID])),
        })}
        summary={() => (
          <Table.Summary>
            {sumRow(`جمع (${vis.length} کالا${filtered ? ' - طبق فیلتر' : ''})`, tVis, '#f2f4f7')}
            {selRows.length && !onlySel ? sumRow(`جمع کالاهای انتخاب‌شده (${selRows.length} کالا)`, tSel, '#dcebff') : null}
          </Table.Summary>
        )}
      />
      {det ? <StockDetailModal product={str(det.ProductID)} name={str(det.Name)} onClose={() => setDet(null)} /> : null}
    </NeedCompany>
  );
}
