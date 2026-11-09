import { Button, Card, Checkbox, Input, Modal, Space, Spin, Statistic, Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../api/CompanyContext';
import { downloadCsv } from '../../kit/exporter';
import type { ExportCol } from '../../kit/exporter';
import { fmtNum, fmtQty, str, todayJalali } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import type { Row } from '../../kit/types';
import { NeedCompany } from '../bank/common';
import { insName, nk, sumCols } from './common';

const KEYS = ['opening', 'produced', 'sold', 'returned', 'consumed', 'balance', 'value', 'batches'];

const num = (v: unknown, bold = false, money = false) => {
  const n = Number(v) || 0;
  return <span style={{ color: bold && n < 0 ? '#cf1322' : undefined, fontWeight: bold ? 700 : undefined }}>{money ? fmtNum(n) : fmtQty(n)}</span>;
};

function DetailModal({ product, name, onClose }: { product: string; name: string; onClose: () => void }) {
  const nav = useNavigate();
  const q = useCsQuery<Row>('madeDetail', { product }, !!product);
  const r = q.data;
  const open = (id: string) => {
    onClose();
    nav(`/p/po?id=${encodeURIComponent(id)}`);
  };
  const tbl = (cols: TableColumnsType<Row>, rows: Row[]) => (
    <Table<Row> size="small" bordered pagination={false} columns={cols} dataSource={rows} rowKey={(_, i) => String(i)} locale={{ emptyText: 'ندارد' }} scroll={{ x: 'max-content' }} />
  );
  const n = (title: string, key: string, qty = false): TableColumnsType<Row>[number] => ({ title, dataIndex: key, align: 'right', render: (v: unknown) => (qty ? fmtQty(v) : fmtNum(v)) });
  return (
    <Modal open={!!product} onCancel={onClose} onOk={onClose} cancelButtonProps={{ style: { display: 'none' } }} okText="بستن" width={960} title={`ریز کالای ساخته‌شده: ${name}`}>
      {q.isLoading || !r ? (
        <Spin />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {r.opening ? (
            <div>
              <b>موجودی اولیه (ثبت‌شده هنگام تعریف کالا):</b> {str(r.opening.qty)}
              {r.opening.cost ? ` — بهای هر واحد: ${fmtNum(r.opening.cost)} ریال` : ''}
            </div>
          ) : null}
          <Typography.Text strong>سری‌های تولید (ورود به این انبار)</Typography.Text>
          {tbl(
            [
              { title: 'شماره سری/سفارش', render: (_, z) => <a onClick={() => open(str(z.id))}><b>{str(z.no)}</b></a> },
              { title: 'تاریخ', dataIndex: 'date' },
              n('مقدار', 'qty', true),
              n('بهای مواد', 'material'),
              n('دستمزد', 'labor'),
              n('سربار', 'overhead'),
              n('بهای کل', 'total'),
              n('بهای واحد', 'unitCost'),
            ],
            r.batches ?? [],
          )}
          <Typography.Text strong>فروش و برگشت از فروش (خروج از این انبار)</Typography.Text>
          {tbl(
            [
              { title: 'سریال', dataIndex: 'no' },
              { title: 'تاریخ', dataIndex: 'date' },
              { title: 'خریدار', dataIndex: 'party' },
              { title: 'موضوع', render: (_, z) => insName(z.ins) },
              n('مقدار', 'qty', true),
              { title: 'وضعیت', render: (_, z) => `${str(z.status)}${z.superseded ? ' (کنار گذاشته‌شده)' : ''}` },
            ],
            r.sales ?? [],
          )}
          <Typography.Text strong>مصرف به‌عنوان ماده‌ی نیمه‌ساخته در تولید دیگر</Typography.Text>
          {tbl([{ title: 'سفارش', render: (_, z) => <a onClick={() => open(str(z.id))}>{str(z.no)}</a> }, { title: 'تاریخ', dataIndex: 'date' }, n('مقدار', 'qty', true)], r.usedIn ?? [])}
        </div>
      )}
    </Modal>
  );
}

export default function MadeGoodsPage() {
  const { company } = useCompany();
  const nav = useNavigate();
  const q = useCsQuery<{ totals: Row; rows: Row[] }>('madeGoods', {});
  const [text, setText] = useState('');
  const [onlyPos, setOnlyPos] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [det, setDet] = useState<Row | null>(null);

  const all: Row[] = useMemo(() => q.data?.rows ?? [], [q.data]);
  const T = q.data?.totals ?? {};
  const vis = useMemo(() => {
    const k = nk(text);
    return all.filter((x) => (!k || nk(`${x.Name} ${x.Code ?? ''}`).includes(k)) && (!onlyPos || Number(x.balance) > 0));
  }, [all, text, onlyPos]);
  const selRows = all.filter((x) => sel.includes(x.ProductID));
  const tVis = sumCols(vis, KEYS, 2);
  const tSel = sumCols(selRows, KEYS, 2);

  const col = (title: string, key: string, bold = false, money = false): TableColumnsType<Row>[number] => ({ title, dataIndex: key, align: 'right', render: (v: unknown) => num(v, bold, money) });
  const columns: TableColumnsType<Row> = [
    {
      title: 'کالا',
      dataIndex: 'Name',
      width: 220,
      render: (v: unknown, r) => (
        <span>
          <b>{str(v)}</b>
          {r.hasRecipe ? '' : <small style={{ color: '#888' }}> (بدون فرمول فعال)</small>}
        </span>
      ),
    },
    { title: 'کد', dataIndex: 'Code', width: 90 },
    { title: 'واحد', dataIndex: 'Unit', width: 70 },
    col('موجودی اولیه', 'opening'),
    col('تولید', 'produced'),
    col('فروش', 'sold'),
    col('برگشت از فروش', 'returned'),
    col('مصرف به‌عنوان نیمه‌ساخته', 'consumed'),
    col('موجودی', 'balance', true),
    col('میانگین بهای واحد', 'avgCost', false, true),
    col('ارزش موجودی', 'value', false, true),
    col('سری‌ها', 'batches'),
    { title: 'آخرین تولید', dataIndex: 'lastDate', render: (v: unknown) => str(v) || '—' },
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
    { title: 'واحد', value: (r) => r.Unit },
    ...(
      [
        ['موجودی اولیه', 'opening'],
        ['تولید', 'produced'],
        ['فروش', 'sold'],
        ['برگشت از فروش', 'returned'],
        ['مصرف به‌عنوان نیمه‌ساخته', 'consumed'],
        ['موجودی', 'balance'],
        ['میانگین بهای واحد', 'avgCost'],
        ['ارزش موجودی', 'value'],
        ['تعداد سری', 'batches'],
      ] as [string, string][]
    ).map(([title, k]): ExportCol<Row> => ({ title, numeric: true, value: (r) => Number(r[k]) || 0 })),
    { title: 'آخرین تولید', value: (r) => r.lastDate },
  ];
  const doExport = () => downloadCsv(`made-goods-${todayJalali().replace(/\//g, '-')}`, exportCols, vis, { Name: `جمع (${vis.length} کالا)`, ...tVis, avgCost: '' } as Row);

  const sumRow = (label: string, t: Record<string, number>, bg: string) => (
    <Table.Summary.Row style={{ background: bg, fontWeight: 700 }}>
      <Table.Summary.Cell index={0} colSpan={4}>
        {label}
      </Table.Summary.Cell>
      {['opening', 'produced', 'sold', 'returned', 'consumed', 'balance'].map((k, i) => (
        <Table.Summary.Cell key={k} index={i + 4} align="right">
          {num(t[k], k === 'balance')}
        </Table.Summary.Cell>
      ))}
      <Table.Summary.Cell index={10} />
      <Table.Summary.Cell index={11} align="right">
        {num(t.value, true, true)}
      </Table.Summary.Cell>
      <Table.Summary.Cell index={12} align="right">
        {num(t.batches)}
      </Table.Summary.Cell>
      <Table.Summary.Cell index={13} colSpan={2} />
    </Table.Summary.Row>
  );

  return (
    <NeedCompany company={company}>
      <Space wrap size="large">
        <Statistic title="تعداد کالای ساخته‌شده" value={Number(T.count) || 0} />
        <Statistic title="جمع تولید (همه‌ی سری‌ها)" value={fmtQty(T.produced)} />
        <Statistic title="ارزش موجودی (ریال)" value={fmtNum(T.value)} />
        <Statistic title="تعداد سری‌های تولید" value={Number(T.batches) || 0} />
        <Statistic title="موجودی منفی" value={Number(T.negative) || 0} valueStyle={{ color: Number(T.negative) ? '#cf1322' : undefined }} />
      </Space>
      <Card size="small">
        <Space wrap>
          <Typography.Title level={5} style={{ margin: 0 }}>
            کالای ساخته‌شده <small style={{ color: '#888', fontWeight: 400 }}>انبار محصولات تولیدی، جدا از موجودی مواد اولیه</small>
          </Typography.Title>
        </Space>
        <Space wrap style={{ marginTop: 10 }}>
          <Input allowClear placeholder="نام یا کد کالا" style={{ width: 220 }} value={text} onChange={(e) => setText(e.target.value)} />
          <Checkbox checked={onlyPos} onChange={(e) => setOnlyPos(e.target.checked)}>
            فقط دارای موجودی
          </Checkbox>
          <Button onClick={() => nav('/p/po')}>سفارش‌های تولید</Button>
          <Button type="primary" onClick={doExport} disabled={!vis.length}>
            خروجی Excel (CSV)
          </Button>
        </Space>
        <Typography.Paragraph type="secondary" style={{ margin: '8px 0 0', fontSize: 12 }}>
          هر محصول وقتی در «سفارش تولید» با «تأیید تکمیل تولید» ثبت شود، همین‌جا (با شماره‌ی سری ساخت و بهای تمام‌شده) ذخیره می‌شود. موجودی = تولید + برگشت از فروش − فروش − مصرف به‌عنوان نیمه‌ساخته. ارزش موجودی با میانگین بهای تمام‌شده‌ی سری‌های تولید حساب می‌شود. برای انتخاب چند ردیف روی آن‌ها کلیک کنید.
        </Typography.Paragraph>
      </Card>
      <Table<Row>
        size="small"
        bordered
        loading={q.isLoading}
        columns={columns}
        dataSource={vis}
        rowKey="ProductID"
        pagination={{ pageSize: 100, showSizeChanger: true, pageSizeOptions: [50, 100, 200, 500] }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'کالای ساخته‌شده‌ای پیدا نشد. ابتدا یک «فرمول ساخت» بسازید و یک «سفارش تولید» را تکمیل کنید.' }}
        rowSelection={{ selectedRowKeys: sel, onChange: (keys) => setSel((prev) => [...prev.filter((k) => !vis.some((v) => v.ProductID === k)), ...keys.map(String)]) }}
        onRow={(r) => ({
          style: { cursor: 'pointer' },
          onClick: () => setSel((p) => (p.includes(r.ProductID) ? p.filter((x) => x !== r.ProductID) : [...p, r.ProductID])),
        })}
        summary={() => (
          <Table.Summary>
            {sumRow(`جمع (${vis.length} کالا)`, tVis, '#f2f4f7')}
            {selRows.length ? sumRow(`جمع انتخاب‌شده‌ها (${selRows.length} کالا)`, tSel, '#dcebff') : null}
          </Table.Summary>
        )}
      />
      {det ? <DetailModal product={str(det.ProductID)} name={str(det.Name)} onClose={() => setDet(null)} /> : null}
    </NeedCompany>
  );
}
