import { useQueryClient } from '@tanstack/react-query';
import { App, Alert, Button, Card, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { callApi, errorMessage } from '../../api/client';
import { useCompany } from '../../api/CompanyContext';
import { csCall } from '../../api/costService';
import { downloadCsv } from '../../kit/exporter';
import type { ExportCol } from '../../kit/exporter';
import { fmtNum, fmtQty, str, todayJalali } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import type { Opt, Row } from '../../kit/types';
import { DateBox, NeedCompany, isOn } from '../bank/common';
import { useFyRange } from '../accounting/common';
import { payDetail } from './common';
import { openBlankPrintWindow } from '../print/legacyPrint';
import { mapLimit } from '../print/mapLimit';
import { RangePrintModal } from '../print/RangePrintModal';
import { printInvoice, printInvoices } from './invoicePrint';
import { NumInput } from '../../kit/NumInput';

const sign = (x: Row) => (x.DocType === 'return' ? -1 : 1);
const act = (r: Row) => r.IsActive === undefined || isOn(r.IsActive);
const money = (x: Row, k: string) => {
  const v = sign(x) * (Number(x[k]) || 0);
  return <span style={{ color: v < 0 ? '#cf1322' : undefined }}>{fmtNum(v)}</span>;
};

interface Totals {
  count: number;
  purchases: number;
  returns: number;
  items: number;
  gross: number;
  discount: number;
  afterDiscount: number;
  vat: number;
  grand: number;
  costs: number;
  payable: number;
  paid: number;
  remaining: number;
}
const sumOf = (a: Row[]): Totals => {
  const t: Totals = { count: a.length, purchases: 0, returns: 0, items: 0, gross: 0, discount: 0, afterDiscount: 0, vat: 0, grand: 0, costs: 0, payable: 0, paid: 0, remaining: 0 };
  a.forEach((x) => {
    const s = sign(x);
    if (s < 0) t.returns++;
    else t.purchases++;
    t.items += Number(x.ItemCount) || 0;
    t.gross += s * (Number(x.TotalGross) || 0);
    t.discount += s * (Number(x.TotalDiscount) || 0);
    t.afterDiscount += s * (Number(x.TotalAfterDiscount) || 0);
    t.vat += s * (Number(x.TotalVAT) || 0);
    t.grand += s * (Number(x.GrandTotal) || 0);
    t.costs += s * (Number(x.TotalCosts) || 0);
    t.payable += s * (Number(x.PayableTotal) || 0);
    t.paid += s * (Number(x.TotalPaid) || 0);
    t.remaining += s * (Number(x.Remaining) || 0);
  });
  return t;
};

/** فهرست فاکتورهای خرید و برگشت از خرید */
export default function InvoiceListPage() {
  const { company, data, companies } = useCompany();
  const { message, modal, notification } = App.useApp();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState<Row>({ from: '', to: '', supplier: '', group: '', subgroup: '', product: '', doctype: '', invoiceNo: '', pstatus: '', min: '', max: '' });
  const [applied, setApplied] = useState<Row>(f);
  const [sel, setSel] = useState<string[]>([]);
  const [rp, setRp] = useState(false);
  const [view, setView] = useState<Row | null>(null);
  /* به‌طور پیش‌فرض فقط فاکتورهای سال مالی انتخاب‌شده (سال جاری) نمایش داده می‌شود؛ برای دیدن همه، تاریخ‌ها را پاک کنید */
  const fyReady = useFyRange((from, to) => {
    if (!from || !to) return;
    setF((o) => ({ ...o, from, to }));
    setApplied((o) => ({ ...o, from, to }));
    setSel([]);
  });
  const q = useCsQuery<{ rows: Row[]; totals: Totals }>('listInvoices', applied, fyReady);
  const rows = useMemo(() => q.data?.rows ?? [], [q.data]);
  const T = q.data?.totals;
  const set = (k: string, v: string) => setF((o) => ({ ...o, [k]: v }));

  const mine = (a?: Row[]) => (a ?? []).filter((r) => r.CompanyID === company && act(r));
  const supOpts: Opt[] = mine(data?.suppliers as Row[]).map((s) => ({ value: str(s.SupplierID), label: str(s.Name) }));
  const grpOpts: Opt[] = mine(data?.groups as Row[]).map((s) => ({ value: str(s.GroupID), label: str(s.GroupName) }));
  const subOpts: Opt[] = mine(data?.subs as Row[]).map((s) => ({ value: str(s.SubGroupID), label: str(s.SubGroupName) }));
  const prdOpts: Opt[] = [
    ...mine(data?.products as Row[]).map((s) => ({ value: str(s.ProductID), label: str(s.Name) })),
    ...mine(data?.services as Row[]).map((s) => ({ value: str(s.ServiceID), label: `[خدمت] ${str(s.Name)}` })),
  ];
  const sup = (id: unknown) => str((data?.suppliers ?? []).find((s) => str(s.SupplierID) === str(id))?.Name);
  const co = (id: unknown) => str(companies.find((c) => c.CompanyID === str(id))?.Name);
  const pname = (pid: string) => str(((data?.products ?? []).find((p) => str(p.ProductID) === pid) ?? (data?.services ?? []).find((p) => str(p.ServiceID) === pid))?.Name);

  const selRows = rows.filter((r) => sel.includes(str(r.InvoiceID)));
  const selT = selRows.length ? sumOf(selRows) : null;

  const openView = async (id: string) => {
    try {
      setView(await callApi<Row>('getInvoice', { id }));
    } catch (e) {
      notification.error({ message: 'نمایش انجام نشد', description: errorMessage(e) });
    }
  };
  const print = async (id: string) => {
    try {
      const r = await callApi<Row>('getInvoice', { id });
      const c = (companies.find((x) => x.CompanyID === str(r.CompanyID)) ?? {}) as Row;
      const s = ((data?.suppliers ?? []).find((x) => str(x.SupplierID) === str(r.SupplierID)) ?? {}) as Row;
      if (!printInvoice(r, c, s, pname)) message.warning('پنجرهٔ چاپ مسدود شد؛ اجازهٔ باز شدن پنجره را بدهید.');
    } catch (e) {
      notification.error({ message: 'چاپ انجام نشد', description: errorMessage(e) });
    }
  };
  const printMany = async (list: Row[]) => {
    const w = openBlankPrintWindow();
    if (!w) {
      message.warning('پنجرهٔ چاپ مسدود شد؛ اجازهٔ باز شدن پنجره را بدهید.');
      return;
    }
    try {
      const docs = await mapLimit(list, 5, async (x) => {
        const r = await callApi<Row>('getInvoice', { id: str(x.InvoiceID) });
        const c = (companies.find((y) => y.CompanyID === str(r.CompanyID)) ?? {}) as Row;
        const s = ((data?.suppliers ?? []).find((y) => str(y.SupplierID) === str(r.SupplierID)) ?? {}) as Row;
        return { r, company: c, supplier: s };
      });
      printInvoices(docs, pname, w);
    } catch (e) {
      w.close();
      throw e;
    }
  };
  const del = (r: Row) =>
    modal.confirm({
      title: 'حذف فاکتور',
      content: 'این فاکتور و همهٔ اقلام آن برای همیشه حذف می‌شود. ادامه می‌دهید؟',
      okText: 'حذف',
      okButtonProps: { danger: true },
      cancelText: 'انصراف',
      onOk: async () => {
        try {
          await callApi('deleteInvoice', { id: str(r.InvoiceID) });
          await Promise.all([qc.invalidateQueries({ queryKey: ['csq'] }), qc.invalidateQueries({ queryKey: ['cs'] })]);
          message.success('حذف شد.');
        } catch (e) {
          notification.error({ message: 'حذف انجام نشد', description: errorMessage(e) });
        }
      },
    });

  const ex: ExportCol<Row>[] = [
    { title: 'شماره فاکتور', value: (x) => x.InvoiceNo },
    { title: 'نوع', value: (x) => (sign(x) < 0 ? 'برگشت از خرید' : 'خرید') },
    { title: 'تاریخ', value: (x) => x.DateJalali },
    { title: 'شرکت/مشتری', value: (x) => co(x.CompanyID) },
    { title: 'فروشنده', value: (x) => sup(x.SupplierID) },
    { title: 'تعداد اقلام', value: (x) => x.ItemCount, numeric: true },
    ...(['TotalGross:جمع ناخالص', 'TotalDiscount:تخفیف', 'TotalAfterDiscount:پس از تخفیف', 'TotalVAT:مالیات ارزش افزوده', 'GrandTotal:جمع کالا', 'TotalCosts:هزینه‌ها', 'PayableTotal:قابل پرداخت', 'TotalPaid:پرداخت‌شده', 'Remaining:مانده'].map((s) => {
      const [k, title] = s.split(':');
      return { title, value: (x: Row) => sign(x) * (Number(x[k]) || 0), numeric: true } as ExportCol<Row>;
    })),
    { title: 'وضعیت پرداخت', value: (x) => x.PayStatus },
    { title: 'توضیحات', value: (x) => x.Notes },
  ];
  const exportRows = async (onlySel: boolean) => {
    try {
      let list = selRows;
      let t: Totals | undefined = selT ?? undefined;
      if (!onlySel) {
        const r = await csCall<{ rows: Row[]; totals: Totals }>('listInvoices', company, { ...applied, all: true });
        list = r.rows;
        t = r.totals;
      }
      const foot: Row = t ? { InvoiceNo: `جمع (${t.count} سند)`, ItemCount: t.items, TotalGross: t.gross, TotalDiscount: t.discount, TotalAfterDiscount: t.afterDiscount, TotalVAT: t.vat, GrandTotal: t.grand, TotalCosts: t.costs, PayableTotal: t.payable, TotalPaid: t.paid, Remaining: t.remaining } : {};
      // ردیف جمع نباید دوباره در علامت منفی شود
      downloadCsv(`purchase-invoices-${todayJalali().replace(/\//g, '-')}`, ex, list, foot, ['برگشت از خرید با علامت منفی']);
    } catch (e) {
      notification.error({ message: 'خروجی انجام نشد', description: errorMessage(e) });
    }
  };

  const cols: TableColumnsType<Row> = [
    { title: 'شماره', dataIndex: 'InvoiceNo', width: 100 },
    { title: 'نوع', key: 't', render: (_, x) => (sign(x) < 0 ? <Tag color="red">برگشت از خرید</Tag> : 'خرید'), width: 120 },
    { title: 'تاریخ', dataIndex: 'DateJalali', width: 100 },
    { title: 'شرکت', key: 'c', render: (_, x) => co(x.CompanyID) },
    { title: 'فروشنده', key: 's', render: (_, x) => sup(x.SupplierID) },
    { title: 'اقلام', dataIndex: 'ItemCount', width: 70 },
    { title: 'جمع کالا', key: 'g', align: 'end', render: (_, x) => money(x, 'GrandTotal') },
    { title: 'هزینه‌ها', key: 'c2', align: 'end', render: (_, x) => money(x, 'TotalCosts') },
    { title: 'قابل پرداخت', key: 'p', align: 'end', render: (_, x) => money(x, 'PayableTotal') },
    { title: 'پرداخت‌شده', key: 'pd', align: 'end', render: (_, x) => money(x, 'TotalPaid') },
    { title: 'مانده', key: 'r', align: 'end', render: (_, x) => money(x, 'Remaining') },
    { title: 'وضعیت', dataIndex: 'PayStatus' },
    {
      title: '',
      key: 'a',
      render: (_, x) => (
        <Space size={4} wrap onClick={(e) => e.stopPropagation()}>
          <Button size="small" onClick={() => void openView(str(x.InvoiceID))}>نمایش</Button>
          <Button size="small" onClick={() => void print(str(x.InvoiceID))}>چاپ</Button>
          <Button size="small" onClick={() => nav(`/p/${x.DocType === 'return' ? 'invret' : 'inv'}?id=${encodeURIComponent(str(x.InvoiceID))}`)}>ویرایش</Button>
          <Button size="small" danger onClick={() => del(x)}>حذف</Button>
        </Space>
      ),
    },
  ];

  const totRow = (label: string, t: Totals, key: string) => (
    <Table.Summary.Row key={key} style={{ background: key === 'tot' ? '#fafafa' : '#e6f4ff' }}>
      <Table.Summary.Cell index={0} colSpan={5}><b>{label}</b></Table.Summary.Cell>
      <Table.Summary.Cell index={1}><b>{t.items}</b></Table.Summary.Cell>
      {[t.grand, t.costs, t.payable, t.paid, t.remaining].map((v, i) => (
        <Table.Summary.Cell key={i} index={i + 2} align="end"><b style={{ color: v < 0 ? '#cf1322' : undefined }}>{fmtNum(v)}</b></Table.Summary.Cell>
      ))}
      <Table.Summary.Cell index={7} colSpan={2} />
    </Table.Summary.Row>
  );

  return (
    <NeedCompany company={company}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Title level={3} style={{ margin: 0 }}>فاکتورهای خرید</Typography.Title>
          <Space wrap align="end">
            <DateBox value={str(f.from)} onChange={(v) => set('from', v)} placeholder="از تاریخ" />
            <DateBox value={str(f.to)} onChange={(v) => set('to', v)} placeholder="تا تاریخ" />
            <Select allowClear showSearch optionFilterProp="label" style={{ width: 180 }} placeholder="فروشنده: همه" value={str(f.supplier) || undefined} options={supOpts} onChange={(v) => set('supplier', v ?? '')} />
            <Select allowClear showSearch optionFilterProp="label" style={{ width: 150 }} placeholder="گروه: همه" value={str(f.group) || undefined} options={grpOpts} onChange={(v) => set('group', v ?? '')} />
            <Select allowClear showSearch optionFilterProp="label" style={{ width: 150 }} placeholder="گروه فرعی: همه" value={str(f.subgroup) || undefined} options={subOpts} onChange={(v) => set('subgroup', v ?? '')} />
            <Select allowClear showSearch optionFilterProp="label" style={{ width: 180 }} placeholder="کالا: همه" value={str(f.product) || undefined} options={prdOpts} onChange={(v) => set('product', v ?? '')} />
            <Select allowClear style={{ width: 150 }} placeholder="نوع سند: همه" value={str(f.doctype) || undefined} options={[{ value: 'purchase', label: 'خرید' }, { value: 'return', label: 'برگشت از خرید' }]} onChange={(v) => set('doctype', v ?? '')} />
            <Input style={{ width: 130 }} placeholder="شماره فاکتور" value={str(f.invoiceNo)} onChange={(e) => set('invoiceNo', e.target.value)} />
            <Select allowClear style={{ width: 150 }} placeholder="وضعیت پرداخت" value={str(f.pstatus) || undefined} options={['پرداخت‌نشده', 'بخشی پرداخت', 'تسویه'].map((x) => ({ value: x, label: x }))} onChange={(v) => set('pstatus', v ?? '')} />
            <NumInput style={{ width: 120 }} placeholder="مبلغ از" value={str(f.min)} onChange={(v) => set('min', v)} />
            <NumInput style={{ width: 120 }} placeholder="مبلغ تا" value={str(f.max)} onChange={(v) => set('max', v)} />
            <Button type="primary" onClick={() => { setApplied({ ...f }); setSel([]); }}>اعمال فیلتر</Button>
            <Button onClick={() => void exportRows(false)}>خروجی Excel (CSV)</Button>
            <Button onClick={() => setRp(true)}>چاپ از شماره تا شماره</Button>
            {selRows.length ? <Button onClick={() => void exportRows(true)}>Excel فقط انتخاب‌شده‌ها</Button> : null}
            <Button onClick={() => nav('/p/inv')}>+ فاکتور خرید</Button>
            <Button onClick={() => nav('/p/invret')}>+ برگشت از خرید</Button>
          </Space>
          <Typography.Text type="secondary">برای دیدن جمع چند فاکتور، روی ردیف آن‌ها کلیک کنید (دوباره کلیک = برداشتن). برگشت از خرید در ردیف‌ها و در جمع با علامت منفی (قرمز) می‌آید.</Typography.Text>
        </Space>
      </Card>
      {q.isError ? <Alert type="error" showIcon message={errorMessage(q.error)} /> : null}
      {T && T.count > rows.length ? <Alert type="warning" showIcon message={`فقط ${rows.length} ردیف اول نمایش داده شد؛ ردیف «جمع» و فایل Excel شامل همهٔ ${T.count} فاکتور است.`} /> : null}
      <Card>
        <Table<Row>
          size="small"
          rowKey={(r) => str(r.InvoiceID)}
          loading={q.isFetching}
          columns={cols}
          dataSource={rows}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: [20, 50, 100, 200] }}
          rowClassName={(r) => (sel.includes(str(r.InvoiceID)) ? 'ant-table-row-selected' : '')}
          onRow={(r) => ({ onClick: () => setSel((s) => (s.includes(str(r.InvoiceID)) ? s.filter((x) => x !== str(r.InvoiceID)) : [...s, str(r.InvoiceID)])), style: { cursor: 'pointer' } })}
          locale={{ emptyText: 'فاکتوری یافت نشد.' }}
          summary={() =>
            T ? (
              <Table.Summary fixed>
                {totRow(`جمع کل (${T.count} سند: ${T.purchases} خرید، ${T.returns} برگشت)`, T, 'tot')}
                {selT ? totRow(`جمع انتخاب‌شده (${selRows.length} فاکتور)`, selT, 'sel') : null}
              </Table.Summary>
            ) : null
          }
        />
      </Card>
      <RangePrintModal
        open={rp}
        onClose={() => setRp(false)}
        title="چاپ فاکتورهای خرید از شماره تا شماره"
        rows={rows}
        fields={[{ key: 'InvoiceNo', label: 'شماره فاکتور' }]}
        onPrint={(rs) => printMany(rs)}
      />
      <Modal open={!!view} width={860} footer={null} onCancel={() => setView(null)} title={view ? `${view.DocType === 'return' ? 'برگشت از خرید' : 'فاکتور'} ${str(view.InvoiceNo)} - ${str(view.DateJalali)}` : ''}>
        {view ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text>{sup(view.SupplierID)}</Typography.Text>
            <Table<Row>
              size="small"
              pagination={false}
              rowKey={(_, i) => String(i)}
              dataSource={(view.items ?? []) as Row[]}
              columns={[
                { title: 'کالا', render: (_, i) => pname(str(i.ProductID)) },
                { title: 'واحد', dataIndex: 'Unit' },
                { title: 'تعداد', align: 'end', render: (_, i) => fmtQty(i.Quantity) },
                { title: 'قیمت', align: 'end', render: (_, i) => fmtNum(i.UnitPrice) },
                { title: 'تخفیف', align: 'end', render: (_, i) => fmtNum(i.Discount) },
                { title: 'مالیات', align: 'end', render: (_, i) => fmtNum(i.VAT) },
                { title: 'جمع', align: 'end', render: (_, i) => fmtNum(i.LineTotal) },
              ]}
            />
            {(view.costs ?? []).length ? (
              <Table<Row> size="small" pagination={false} rowKey={(_, i) => String(i)} dataSource={view.costs as Row[]} title={() => 'هزینه‌های جانبی'} columns={[{ title: 'نوع', dataIndex: 'CostType' }, { title: 'طرف حساب', dataIndex: 'Payee' }, { title: 'توضیحات', dataIndex: 'Description' }, { title: 'مبلغ', align: 'end', render: (_, c) => fmtNum(c.Amount) }, { title: 'مالیات', align: 'end', render: (_, c) => fmtNum(c.VAT) }, { title: 'جمع', align: 'end', render: (_, c) => fmtNum(c.Total) }]} />
            ) : null}
            {(view.payments ?? []).length ? (
              <Table<Row> size="small" pagination={false} rowKey={(_, i) => String(i)} dataSource={view.payments as Row[]} title={() => 'پرداخت‌ها'} columns={[{ title: 'تاریخ', dataIndex: 'DateJalali' }, { title: 'روش', dataIndex: 'Method' }, { title: 'مبلغ', align: 'end', render: (_, p) => fmtNum(p.Amount) }, { title: 'جزئیات', render: (_, p) => payDetail(p) }]} />
            ) : null}
            <Space size="large" wrap>
              {([['جمع کالا', view.GrandTotal], ['هزینه‌ها', view.TotalCosts], ['قابل پرداخت', view.PayableTotal], ['پرداخت‌شده', view.TotalPaid], ['مانده', view.Remaining]] as Array<[string, unknown]>).map(([l, v]) => (
                <span key={l}>{l}: <b>{fmtNum(v)}</b></span>
              ))}
              <Tag>{str(view.PayStatus)}</Tag>
            </Space>
            {view.Notes ? <Typography.Text><b>توضیحات:</b> {str(view.Notes)}</Typography.Text> : null}
            <Button type="primary" onClick={() => void print(str(view.InvoiceID))}>چاپ</Button>
          </Space>
        ) : null}
      </Modal>
    </NeedCompany>
  );
}
