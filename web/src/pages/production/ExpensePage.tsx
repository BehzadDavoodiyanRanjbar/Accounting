import { App, Button, Card, Checkbox, Col, Input, Modal, Popconfirm, Row as ARow, Select, Space, Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../../api/client';
import { csCall } from '../../api/costService';
import { useCompany } from '../../api/CompanyContext';
import { downloadCsv } from '../../kit/exporter';
import type { ExportCol } from '../../kit/exporter';
import { fmtNum, str, todayJalali } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import { NumInput } from '../../kit/NumInput';
import type { Row } from '../../kit/types';
import { DateBox, NeedCompany, isOn, useBankCall } from '../bank/common';
import { DocPayments } from '../sales/DocPayments';
import { SLCQ, docPayFromServer, docPayToServer } from '../sales/constants';
import type { DocPay } from '../sales/constants';
import { n0 } from './common';

interface Res {
  rows: Row[];
  totals: { count: number; amount: number; base: number; allocated: number; remaining: number };
}

interface Form {
  ExpenseID: string;
  DocNo: string;
  DateJalali: string;
  SupplierID: string;
  Payee: string;
  Category: string;
  Description: string;
  Amount: string;
  VAT: string;
  VATInCost: boolean;
  Notes: string;
}

const lab = (t: string) => <div style={{ marginBottom: 4 }}>{t}</div>;
const sum = (rows: Row[], k: string) => rows.reduce((t, x) => t + (Number(x[k]) || 0), 0);

/** فاکتور هزینه (سربار): ثبت، فهرست، پرداخت */
export default function ExpensePage() {
  const { company, data } = useCompany();
  const { message } = App.useApp();
  const call = useBankCall();
  const top = useRef<HTMLDivElement>(null);
  const cfg = useCsQuery<Row>('prodCfgGet', {});
  const cats = useMemo(() => (cfg.data?.categories ?? []) as string[], [cfg.data]);
  const blank = (): Form => ({
    ExpenseID: '',
    DocNo: '',
    DateJalali: todayJalali(),
    SupplierID: '',
    Payee: '',
    Category: cats[0] ?? '',
    Description: '',
    Amount: '',
    VAT: '0',
    VATInCost: !!cfg.data?.vatInCost,
    Notes: '',
  });
  const [f, setF] = useState<Form>(blank);
  const [busy, setBusy] = useState(false);
  const [flt, setFlt] = useState({ category: '', from: '', to: '' });
  const q = useCsQuery<Res>('expenseList', flt);
  const rows = q.data?.rows ?? [];
  const T = q.data?.totals;

  // پس از رسیدن تنظیمات، نوع پیش‌فرض و مالیات پیش‌فرض را بگذار (فقط برای فرم تازه)
  useEffect(() => {
    if (cfg.data) setF((o) => (o.ExpenseID || o.DocNo || o.Amount ? o : { ...o, Category: o.Category || cats[0] || '', VATInCost: !!cfg.data?.vatInCost }));
  }, [cfg.data, cats]);

  const sups = useMemo(
    () =>
      ((data?.suppliers ?? []) as Row[])
        .filter((s) => s.CompanyID === company && (isOn(s.IsActive) || s.IsActive === undefined))
        .map((s) => ({ value: str(s.SupplierID), label: `${s.SupplierCode ? `${str(s.SupplierCode)} - ` : ''}${str(s.Name)}` })),
    [data, company],
  );
  const catOpts = [...cats, ...(f.Category && !cats.includes(f.Category) ? [f.Category] : [])].map((c) => ({ value: c, label: c }));

  const save = async () => {
    setBusy(true);
    try {
      await call('expenseSave', { ...f });
      message.success('ذخیره شد.');
      setF(blank());
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const edit = (x: Row) => {
    setF({
      ExpenseID: str(x.ExpenseID),
      DocNo: str(x.DocNo),
      DateJalali: str(x.DateJalali),
      SupplierID: str(x.SupplierID),
      Payee: str(x.Payee),
      Category: str(x.Category),
      Description: str(x.Description),
      Amount: str(x.Amount),
      VAT: str(x.VAT),
      VATInCost: !!x.VATInCost,
      Notes: str(x.Notes),
    });
    top.current?.scrollIntoView({ behavior: 'smooth' });
  };
  const del = async (id: string) => {
    try {
      await call('expenseDelete', { id });
      message.success('حذف شد.');
      if (f.ExpenseID === id) setF(blank());
    } catch (e) {
      message.error(errorMessage(e));
    }
  };

  // پرداخت
  const [pay, setPay] = useState<{ row: Row; pays: DocPay[]; total: number } | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const openPay = async (x: Row) => {
    try {
      const z = await csCall<Row>('docPayGet', company, { type: 'expense', id: str(x.ExpenseID) });
      setPay({ row: x, pays: ((z.payments ?? []) as Row[]).map(docPayFromServer), total: Number((z.doc as Row | undefined)?.total) || n0(x.Amount) + (x.VATInCost ? 0 : n0(x.VAT)) });
    } catch (e) {
      message.error(errorMessage(e));
    }
  };
  const savePay = async () => {
    if (!pay) return;
    setPayBusy(true);
    try {
      await call('docPaySave', { type: 'expense', id: str(pay.row.ExpenseID), payments: pay.pays.map(docPayToServer) });
      setPay(null);
      message.success('ذخیره شد.');
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setPayBusy(false);
    }
  };

  const csv = () => {
    const cols: ExportCol<Row>[] = [
      { title: 'شماره', value: (x) => str(x.DocNo) },
      { title: 'تاریخ', value: (x) => str(x.DateJalali) },
      { title: 'طرف حساب', value: (x) => str(x.Supplier || x.Payee) },
      { title: 'نوع', value: (x) => str(x.Category) },
      { title: 'شرح', value: (x) => str(x.Description) },
      { title: 'مبلغ', value: (x) => Math.round(Number(x.Amount) || 0), numeric: true },
      { title: 'مالیات', value: (x) => Math.round(Number(x.VAT) || 0), numeric: true },
      { title: 'مبنای هزینه', value: (x) => Math.round(Number(x.CostBase) || 0), numeric: true },
      { title: 'تخصیص‌یافته', value: (x) => Math.round(Number(x.Allocated) || 0), numeric: true },
      { title: 'مانده تخصیص', value: (x) => Math.round(Number(x.Remaining) || 0), numeric: true },
      { title: 'پرداخت‌شده', value: (x) => Math.round(Number(x.Paid) || 0), numeric: true },
      { title: 'مانده پرداخت', value: (x) => Math.round(Number(x.PayRemain) || 0), numeric: true },
    ];
    const foot: Row = { DocNo: 'جمع', Amount: T?.amount, CostBase: T?.base, Allocated: T?.allocated, Remaining: T?.remaining, Paid: sum(rows, 'Paid'), PayRemain: sum(rows, 'PayRemain') };
    downloadCsv(`expense-invoices-${todayJalali().replace(/\//g, '-')}`, cols, rows, foot);
  };

  const num = (k: string, bold = false) => ({ align: 'right' as const, render: (_: unknown, x: Row) => (bold ? <b>{fmtNum(x[k])}</b> : fmtNum(x[k])) });
  const columns: TableColumnsType<Row> = [
    { title: 'شماره', dataIndex: 'DocNo', render: (v: unknown) => <b>{str(v)}</b> },
    { title: 'تاریخ', dataIndex: 'DateJalali' },
    { title: 'طرف حساب', render: (_, x) => str(x.Supplier || x.Payee) },
    { title: 'نوع', dataIndex: 'Category' },
    { title: 'شرح', dataIndex: 'Description' },
    { title: 'مبلغ', ...num('Amount') },
    {
      title: 'مالیات',
      align: 'right',
      render: (_, x) => (
        <>
          {fmtNum(x.VAT)}
          {x.VATInCost ? <small style={{ color: '#888' }}> (جزو هزینه)</small> : null}
        </>
      ),
    },
    { title: 'مبنای هزینه', ...num('CostBase') },
    { title: 'تخصیص‌یافته', ...num('Allocated') },
    { title: 'مانده تخصیص', ...num('Remaining', true) },
    { title: 'پرداخت‌شده', ...num('Paid') },
    { title: 'مانده پرداخت', ...num('PayRemain', true) },
    {
      title: '',
      fixed: 'right',
      render: (_, x) => (
        <Space size="small">
          <Button size="small" onClick={() => void openPay(x)}>
            پرداخت
          </Button>
          <Button size="small" onClick={() => edit(x)}>
            ویرایش
          </Button>
          <Popconfirm title="این فاکتور هزینه حذف شود؟" okText="حذف" cancelText="انصراف" onConfirm={() => void del(str(x.ExpenseID))}>
            <Button size="small" danger>
              حذف
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <NeedCompany company={company}>
      <div ref={top} />
      <Card title={f.ExpenseID ? 'ویرایش فاکتور هزینه' : 'ثبت فاکتور هزینه'} loading={cfg.isLoading}>
        <Typography.Paragraph type="secondary">
          هزینه‌های غیرمستقیم (برق، اجاره، استهلاک، …) را اینجا ثبت کنید؛ بعد در «سفارش تولید» هر مقدار از آن را به‌عنوان سربار به همان سفارش تخصیص می‌دهید.
        </Typography.Paragraph>
        <ARow gutter={12}>
          <Col xs={24} md={6}>
            {lab('شماره فاکتور *')}
            <Input value={f.DocNo} onChange={(e) => setF({ ...f, DocNo: e.target.value })} />
          </Col>
          <Col xs={24} md={6}>
            {lab('تاریخ *')}
            <Input value={f.DateJalali} onChange={(e) => setF({ ...f, DateJalali: e.target.value.trim() })} />
          </Col>
          <Col xs={24} md={6}>
            {lab('نوع هزینه *')}
            <Select style={{ width: '100%' }} value={f.Category || undefined} options={catOpts} onChange={(v) => setF({ ...f, Category: v })} />
          </Col>
          <Col xs={24} md={6}>
            {lab('طرف حساب (فروشنده)')}
            <Select style={{ width: '100%' }} allowClear showSearch optionFilterProp="label" placeholder="— بدون فروشنده —" value={f.SupplierID || undefined} options={sups} onChange={(v) => setF({ ...f, SupplierID: v ?? '' })} />
          </Col>
        </ARow>
        <ARow gutter={12} style={{ marginTop: 12 }}>
          {!f.SupplierID ? (
            <Col xs={24} md={6}>
              {lab('یا نام دریافت‌کننده')}
              <Input value={f.Payee} onChange={(e) => setF({ ...f, Payee: e.target.value })} />
            </Col>
          ) : null}
          <Col xs={24} md={f.SupplierID ? 12 : 6}>
            {lab('شرح')}
            <Input value={f.Description} onChange={(e) => setF({ ...f, Description: e.target.value })} />
          </Col>
          <Col xs={12} md={4}>
            {lab('مبلغ (ریال) *')}
            <NumInput value={f.Amount} onChange={(v) => setF({ ...f, Amount: v })} />
          </Col>
          <Col xs={12} md={4}>
            {lab('مالیات ارزش افزوده')}
            <NumInput value={f.VAT} onChange={(v) => setF({ ...f, VAT: v })} />
          </Col>
          <Col xs={24} md={4} style={{ display: 'flex', alignItems: 'end' }}>
            <Checkbox checked={f.VATInCost} onChange={(e) => setF({ ...f, VATInCost: e.target.checked })}>
              مالیات جزو هزینه حساب شود
            </Checkbox>
          </Col>
        </ARow>
        <div style={{ marginTop: 12 }}>
          {lab('یادداشت')}
          <Input value={f.Notes} onChange={(e) => setF({ ...f, Notes: e.target.value })} />
        </div>
        <Space style={{ marginTop: 12 }}>
          <Button type="primary" loading={busy} onClick={() => void save()}>
            ذخیره
          </Button>
          {f.ExpenseID ? <Button onClick={() => setF(blank())}>انصراف از ویرایش</Button> : null}
        </Space>
      </Card>

      <Card
        title="فاکتورهای هزینه"
        extra={
          <Space wrap>
            <Select
              style={{ width: 160 }}
              allowClear
              placeholder="همهٔ انواع"
              value={flt.category || undefined}
              options={cats.map((c) => ({ value: c, label: c }))}
              onChange={(v) => setFlt((o) => ({ ...o, category: v ?? '' }))}
            />
            <DateBox placeholder="از تاریخ" value={flt.from} onChange={(v) => setFlt((o) => ({ ...o, from: v }))} />
            <DateBox placeholder="تا تاریخ" value={flt.to} onChange={(v) => setFlt((o) => ({ ...o, to: v }))} />
            <Button onClick={csv} disabled={!rows.length}>
              خروجی Excel (CSV)
            </Button>
          </Space>
        }
      >
        <Table<Row>
          size="small"
          loading={q.isFetching}
          rowKey={(x) => str(x.ExpenseID)}
          dataSource={rows}
          columns={columns}
          pagination={{ pageSize: 50, hideOnSinglePage: true }}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'فاکتور هزینه‌ای ثبت نشده است.' }}
          summary={() =>
            T ? (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={5}>
                  <b>جمع ({fmtNum(T.count)} فاکتور)</b>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <b>{fmtNum(T.amount)}</b>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} />
                <Table.Summary.Cell index={3} align="right">
                  <b>{fmtNum(T.base)}</b>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">
                  <b>{fmtNum(T.allocated)}</b>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <b>{fmtNum(T.remaining)}</b>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">
                  <b>{fmtNum(sum(rows, 'Paid'))}</b>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={7} align="right">
                  <b>{fmtNum(sum(rows, 'PayRemain'))}</b>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={8} />
              </Table.Summary.Row>
            ) : null
          }
        />
      </Card>

      <Modal open={!!pay} width={900} title={pay ? `پرداخت — فاکتور هزینه ${str(pay.row.DocNo)}` : ''} okText="ذخیره" cancelText="انصراف" confirmLoading={payBusy} onCancel={() => setPay(null)} onOk={() => void savePay()}>
        {pay ? (
          <DocPayments
            payments={pay.pays}
            onChange={(p) => setPay((o) => (o ? { ...o, pays: p } : o))}
            statuses={SLCQ.out}
            total={pay.total}
            dir="out"
            label={`فاکتور هزینه ${str(pay.row.DocNo)}`}
            defaultDate={str(pay.row.DateJalali)}
            allowOther={false}
          />
        ) : null}
      </Modal>
    </NeedCompany>
  );
}
