import { CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { App, Alert, Button, Card, Col, Input, Modal, Row as GridRow, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { callApi, errorMessage } from '../../api/client';
import { useCompany } from '../../api/CompanyContext';
import { fmtNum, str, todayJalali } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import type { Opt, Row } from '../../kit/types';
import { NeedCompany, accountOpts, isOn, useBankAccounts } from '../bank/common';
import { CHEQUE_STATUS, COST_TYPES, PAY_METHODS, invTotals, lineCalc, newCost, newLine, newPay, payStatus, r2, toNum } from './common';
import type { InvCost, InvLine, InvPay } from './common';
import { printInvoice } from './invoicePrint';
import { NumInput } from '../../kit/NumInput';

const serCount = (v: string) => v.split(/[\s,،;]+/).filter(Boolean).length;
const act = (r: Row) => r.IsActive === undefined || isOn(r.IsActive);

/** ثبت و ویرایش فاکتور خرید / برگشت از خرید */
export default function InvoiceFormPage({ kind }: { kind: 'purchase' | 'return' }) {
  const ret = kind === 'return';
  const { company, data, companies, reload } = useCompany();
  const { message, modal, notification } = App.useApp();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [sp] = useSearchParams();
  const id = sp.get('id') ?? '';
  const bank = useBankAccounts();

  const [no, setNo] = useState('');
  const [date, setDate] = useState(todayJalali());
  const [supplier, setSupplier] = useState('');
  const [refInv, setRefInv] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<InvLine[]>([newLine()]);
  const [costs, setCosts] = useState<InvCost[]>([]);
  const [pays, setPays] = useState<InvPay[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [ser, setSer] = useState<{ k: number; text: string } | null>(null);
  const seq = useRef(0);

  const vat = (data?.vats && data.vats[company] !== undefined ? data.vats[company] : data?.vat) ?? 0;

  const reset = useCallback(() => {
    setNo('');
    setDate(todayJalali());
    setSupplier('');
    setRefInv('');
    setNotes('');
    setItems([newLine()]);
    setCosts([]);
    setPays([]);
    setLoadErr('');
  }, []);

  useEffect(() => {
    if (!company) return;
    if (!id) return reset();
    const my = ++seq.current;
    setLoading(true);
    callApi<Row>('getInvoice', { id })
      .then((r) => {
        if (my !== seq.current) return;
        setNo(str(r.InvoiceNo));
        setDate(str(r.DateJalali));
        setSupplier(str(r.SupplierID));
        setRefInv(str(r.RefInvoiceID));
        setNotes(str(r.Notes));
        setItems(
          ((r.items ?? []) as Row[]).map((i) => ({ ...newLine(), ProductID: str(i.ProductID), Unit: str(i.Unit), Quantity: str(i.Quantity), UnitPrice: str(i.UnitPrice), Discount: str(i.Discount), VAT: str(i.VAT), Serials: str(i.Serials) })),
        );
        setCosts(((r.costs ?? []) as Row[]).map((c) => ({ ...newCost(), CostType: str(c.CostType), Payee: str(c.Payee), Description: str(c.Description), Amount: str(c.Amount), VAT: str(c.VAT) })));
        setPays(((r.payments ?? []) as Row[]).map((p) => ({ ...newPay('', ''), DateJalali: str(p.DateJalali), Method: str(p.Method), Amount: str(p.Amount), FromAccount: str(p.FromAccount), TrackingNo: str(p.TrackingNo), DestAccount: str(p.DestAccount), CardLast4: str(p.CardLast4), ChequeNo: str(p.ChequeNo), SayadNo: str(p.SayadNo), ChequeBank: str(p.ChequeBank), ChequeDueJalali: str(p.ChequeDueJalali), ChequeStatus: str(p.ChequeStatus), Description: str(p.Description), AccountID: str(p.AccountID) })));
        setLoadErr('');
      })
      .catch((e) => my === seq.current && setLoadErr(errorMessage(e)))
      .finally(() => my === seq.current && setLoading(false));
  }, [company, id, reset, sp]);

  const suppliers = useMemo<Opt[]>(
    () => (data?.suppliers ?? []).filter((s) => s.CompanyID === company && (act(s) || str(s.SupplierID) === supplier)).map((s) => ({ value: str(s.SupplierID), label: `${str(s.SupplierCode) ? `${str(s.SupplierCode)} - ` : ''}${str(s.Name)}` })),
    [data, company, supplier],
  );
  const itemOpts = useMemo(() => {
    const p = (data?.products ?? []).filter((x) => x.CompanyID === company && act(x)).map((x) => ({ value: str(x.ProductID), label: str(x.Name) }));
    const s = (data?.services ?? []).filter((x) => x.CompanyID === company && act(x)).map((x) => ({ value: str(x.ServiceID), label: str(x.Name) }));
    return [...(p.length ? [{ label: 'کالاها', options: p }] : []), ...(s.length ? [{ label: 'خدمات', options: s }] : [])];
  }, [data, company]);
  const defUnit = useMemo(() => {
    const m: Record<string, string> = {};
    (data?.products ?? []).forEach((x) => (m[str(x.ProductID)] = str(x.DefaultUnit)));
    (data?.services ?? []).forEach((x) => (m[str(x.ServiceID)] = str(x.DefaultUnit)));
    return m;
  }, [data]);
  const unitOpts = useMemo<Opt[]>(() => (data?.units ?? []).filter((u) => u.CompanyID === company && act(u)).map((u) => ({ value: str(u.UnitName), label: str(u.UnitName) })), [data, company]);

  const refList = useCsQuery<{ rows: Row[] }>('listInvoices', { supplier, doctype: 'purchase', noYear: true }, ret && !!supplier);
  const refOpts = useMemo<Opt[]>(() => (refList.data?.rows ?? []).map((x) => ({ value: str(x.InvoiceID), label: `${str(x.InvoiceNo)} - ${str(x.DateJalali)} (${fmtNum(x.GrandTotal)})` })), [refList.data]);

  const T = useMemo(() => invTotals(items, costs, pays), [items, costs, pays]);

  const setLine = (k: number, p: Partial<InvLine>) => setItems((a) => a.map((l) => (l.k === k ? { ...l, ...p } : l)));
  const setCost = (k: number, p: Partial<InvCost>) => setCosts((a) => a.map((l) => (l.k === k ? { ...l, ...p } : l)));
  const setPay = (k: number, p: Partial<InvPay>) => setPays((a) => a.map((l) => (l.k === k ? { ...l, ...p } : l)));

  const calcVat = () => setItems((a) => a.map((l) => ({ ...l, VAT: String(r2((lineCalc(l).n * vat) / 100)) })));

  const submit = async (force = false) => {
    if (!supplier) return void message.warning('فروشنده را انتخاب کنید.');
    setSaving(true);
    try {
      const p: Row = {
        DocType: kind,
        RefInvoiceID: ret ? refInv : '',
        InvoiceID: id,
        CompanyID: company,
        SupplierID: supplier,
        InvoiceNo: no,
        DateJalali: date,
        force,
        Notes: notes,
        costs: costs.map((c) => ({ CostType: c.CostType, Payee: c.Payee, Description: c.Description, Amount: toNum(c.Amount), VAT: toNum(c.VAT) })),
        payments: pays.map(({ k: _k, ...y }) => ({ ...y, Amount: toNum(y.Amount) })),
        items: items.map((l) => ({ ProductID: l.ProductID, Unit: l.Unit, Quantity: toNum(l.Quantity), UnitPrice: toNum(l.UnitPrice), Discount: toNum(l.Discount), VAT: toNum(l.VAT), Serials: l.Serials })),
      };
      const r = await callApi<Row>('saveInvoice', p);
      if (r.duplicate) {
        modal.confirm({ title: 'فاکتور تکراری؟', content: str(r.message), okText: 'ذخیره شود', cancelText: 'انصراف', onOk: () => submit(true) });
        return;
      }
      await Promise.all([qc.invalidateQueries({ queryKey: ['csq'] }), qc.invalidateQueries({ queryKey: ['cs'] })]);
      message.success(`${ret ? 'برگشت از خرید ذخیره شد. مبلغ: ' : 'فاکتور ذخیره شد. مبلغ نهایی: '}${fmtNum(r.total)}`);
      const warn = ((r.warnings ?? []) as string[]).join('\n');
      if (warn) notification.warning({ message: 'هشدار', description: <div style={{ whiteSpace: 'pre-line' }}>{warn}</div>, duration: 0 });
      const savedId = str(r.InvoiceID);
      modal.confirm({
        title: `${ret ? 'سند برگشت از خرید' : 'فاکتور'} ذخیره شد`,
        content: 'چاپ شود؟',
        okText: 'چاپ',
        cancelText: 'بستن',
        onOk: () => void print(savedId),
      });
      if (id) nav('/p/list');
      else nav(`/p/${ret ? 'invret' : 'inv'}?new=${Date.now()}`);
    } catch (e) {
      notification.error({ message: 'ذخیره انجام نشد', description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  const print = async (invId: string) => {
    try {
      const r = await callApi<Row>('getInvoice', { id: invId });
      const co = (companies.find((c) => c.CompanyID === str(r.CompanyID)) ?? {}) as Row;
      const sup = ((data?.suppliers ?? []).find((s) => str(s.SupplierID) === str(r.SupplierID)) ?? {}) as Row;
      const nm = (pid: string) => str(((data?.products ?? []).find((p) => str(p.ProductID) === pid) ?? (data?.services ?? []).find((p) => str(p.ServiceID) === pid))?.Name);
      if (!printInvoice(r, co, sup, nm)) message.warning('پنجرهٔ چاپ مسدود شد؛ اجازهٔ باز شدن پنجره را بدهید.');
    } catch (e) {
      notification.error({ message: 'چاپ انجام نشد', description: errorMessage(e) });
    }
  };

  const lineCols: TableColumnsType<InvLine> = [
    { title: '#', key: 'i', width: 44, render: (_, __, i) => i + 1 },
    {
      title: 'کالا / خدمت',
      key: 'p',
      width: 250,
      render: (_, l) => (
        <Select
          showSearch
          optionFilterProp="label"
          style={{ width: 240 }}
          placeholder="—"
          value={l.ProductID || undefined}
          options={itemOpts}
          onChange={(v) => setLine(l.k, { ProductID: v ?? '', ...(defUnit[v ?? ''] ? { Unit: defUnit[v ?? ''] } : {}) })}
        />
      ),
    },
    { title: 'واحد', key: 'u', width: 120, render: (_, l) => <Select allowClear showSearch style={{ width: 110 }} placeholder="—" value={l.Unit || undefined} options={unitOpts} onChange={(v) => setLine(l.k, { Unit: v ?? '' })} /> },
    { title: 'تعداد', key: 'q', width: 100, render: (_, l) => <NumInput value={l.Quantity} onChange={(v) => setLine(l.k, { Quantity: v })} /> },
    { title: 'قیمت واحد', key: 'pr', width: 130, render: (_, l) => <NumInput value={l.UnitPrice} onChange={(v) => setLine(l.k, { UnitPrice: v })} /> },
    { title: 'ناخالص', key: 'g', align: 'end', render: (_, l) => fmtNum(lineCalc(l).g) },
    { title: 'تخفیف', key: 'd', width: 120, render: (_, l) => <NumInput value={l.Discount} onChange={(v) => setLine(l.k, { Discount: v })} /> },
    { title: 'بعد از تخفیف', key: 'n', align: 'end', render: (_, l) => fmtNum(lineCalc(l).n) },
    { title: 'مالیات', key: 'v', width: 120, render: (_, l) => <NumInput value={l.VAT} onChange={(v) => setLine(l.k, { VAT: v })} /> },
    { title: 'جمع ردیف', key: 't', align: 'end', render: (_, l) => <b>{fmtNum(lineCalc(l).t)}</b> },
    {
      title: 'سریال',
      key: 's',
      render: (_, l) => {
        const n = serCount(l.Serials);
        const q = Math.round(toNum(l.Quantity));
        return <Button size="small" danger={n > 0 && q > 0 && n !== q} onClick={() => setSer({ k: l.k, text: l.Serials })}>{n ? `سریال (${n})` : '+ سریال'}</Button>;
      },
    },
    {
      title: '',
      key: 'x',
      width: 80,
      render: (_, l) => (
        <Space size={2}>
          <Button size="small" type="text" icon={<CopyOutlined />} title="کپی ردیف" onClick={() => setItems((a) => { const i = a.findIndex((x) => x.k === l.k); return [...a.slice(0, i + 1), { ...l, k: newLine().k, Serials: '' }, ...a.slice(i + 1)]; })} />
          <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setItems((a) => (a.length > 1 ? a.filter((x) => x.k !== l.k) : a))} />
        </Space>
      ),
    },
  ];

  const costCols: TableColumnsType<InvCost> = [
    { title: 'نوع هزینه', key: 't', width: 170, render: (_, c) => <Select allowClear style={{ width: 160 }} placeholder="—" value={c.CostType || undefined} options={COST_TYPES.map((x) => ({ value: x, label: x }))} onChange={(v) => setCost(c.k, { CostType: v ?? '' })} /> },
    { title: 'طرف حساب', key: 'p', render: (_, c) => <Input value={c.Payee} onChange={(e) => setCost(c.k, { Payee: e.target.value })} /> },
    { title: 'توضیحات', key: 'd', render: (_, c) => <Input value={c.Description} onChange={(e) => setCost(c.k, { Description: e.target.value })} /> },
    { title: 'مبلغ', key: 'a', width: 140, render: (_, c) => <NumInput value={c.Amount} onChange={(v) => setCost(c.k, { Amount: v })} /> },
    { title: 'مالیات', key: 'v', width: 130, render: (_, c) => <NumInput value={c.VAT} onChange={(v) => setCost(c.k, { VAT: v })} /> },
    { title: 'جمع', key: 'j', align: 'end', render: (_, c) => fmtNum(toNum(c.Amount) + toNum(c.VAT)) },
    { title: '', key: 'x', width: 50, render: (_, c) => <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setCosts((a) => a.filter((x) => x.k !== c.k))} /> },
  ];

  const field = (label: string, node: ReactNode, span = 6) => (
    <Col xs={24} md={span}>
      <div style={{ marginBottom: 4 }}>{label}</div>
      {node}
    </Col>
  );

  const title = `${id ? 'ویرایش' : 'ثبت'} ${ret ? 'برگشت از خرید' : 'فاکتور خرید'}${id ? ` ${no}` : ''}`;

  return (
    <NeedCompany company={company}>
      <Card loading={loading}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Typography.Title level={3} style={{ margin: 0 }}>{title}</Typography.Title>
          {loadErr ? <Alert type="error" showIcon message={loadErr} /> : null}
          <GridRow gutter={[12, 12]}>
            {field(ret ? 'شماره سند برگشت *' : 'شماره فاکتور *', <Input value={no} onChange={(e) => setNo(e.target.value)} />)}
            {field('تاریخ شمسی * (1405/07/09)', <Input value={date} onChange={(e) => setDate(e.target.value.trim())} />)}
            {field('فروشنده *', <Select showSearch allowClear optionFilterProp="label" style={{ width: '100%' }} placeholder="—" value={supplier || undefined} options={suppliers} onChange={(v) => { setSupplier(v ?? ''); setRefInv(''); }} />)}
            {ret ? field('فاکتور خرید اصلی (اختیاری؛ برای کنترل تعداد برگشتی)', <Select allowClear showSearch optionFilterProp="label" style={{ width: '100%' }} placeholder="— بدون مرجع —" value={refInv || undefined} options={refOpts} loading={refList.isFetching} onChange={(v) => setRefInv(v ?? '')} />) : null}
          </GridRow>
          <Typography.Text type="secondary">
            اگر فروشنده یا کالا در فهرست نیست، ابتدا در «اطلاعات پایه» بسازید (
            <a href="#/p/Suppliers" target="_blank" rel="noreferrer">فروشندگان</a>، <a href="#/p/Products" target="_blank" rel="noreferrer">کالاها</a>) و بعد <a onClick={() => void reload()}>تازه‌سازی فهرست</a> را بزنید.
          </Typography.Text>
        </Space>
      </Card>

      <Card title="اقلام" extra={<Space><Button size="small" onClick={() => setItems((a) => [...a, newLine()])}>+ ردیف</Button><Button size="small" onClick={calcVat}>محاسبه مالیات از نرخ ({vat}٪)</Button></Space>}>
        <Table<InvLine> size="small" rowKey="k" columns={lineCols} dataSource={items} pagination={false} scroll={{ x: 'max-content' }} />
        <Space size="large" wrap style={{ marginTop: 12 }}>
          <Statistic title="جمع ناخالص" value={fmtNum(T.g)} />
          <Statistic title="جمع تخفیف" value={fmtNum(T.d)} />
          <Statistic title="جمع بعد از تخفیف" value={fmtNum(T.n)} />
          <Statistic title="جمع مالیات" value={fmtNum(T.v)} />
          <Statistic title="جمع کالا (با مالیات)" value={fmtNum(T.t)} />
        </Space>
      </Card>

      <Card title="هزینه‌های جانبی (باربری، بیمه و ...)" extra={<Button size="small" onClick={() => setCosts((a) => [...a, newCost()])}>+ هزینه</Button>}>
        <Table<InvCost> size="small" rowKey="k" columns={costCols} dataSource={costs} pagination={false} scroll={{ x: 'max-content' }} locale={{ emptyText: 'هزینه‌ای ثبت نشده است.' }} />
      </Card>

      <Card title={ret ? 'وجوه دریافتی از فروشنده (بابت این برگشت)' : 'پرداخت‌های فاکتور'} extra={<Button size="small" onClick={() => setPays((a) => [...a, newPay(todayJalali(), T.rem > 0 ? String(T.rem) : '')])}>+ پرداخت</Button>}>
        {pays.length === 0 ? <Typography.Text type="secondary">پرداختی ثبت نشده است.</Typography.Text> : null}
        <Space direction="vertical" style={{ width: '100%' }}>
          {pays.map((p, i) => {
            const ch = p.Method === 'چک';
            const bk = p.Method === 'انتقال بانکی';
            const cc = p.Method === 'کارت‌به‌کارت';
            const tk = p.Method !== '' && p.Method !== 'نقد' && !ch;
            return (
              <Card key={p.k} size="small" type="inner" title={`پرداخت ${i + 1}`} extra={<Button size="small" danger onClick={() => setPays((a) => a.filter((x) => x.k !== p.k))}>✕ حذف</Button>}>
                <GridRow gutter={[12, 8]}>
                  {field('تاریخ پرداخت *', <Input value={p.DateJalali} onChange={(e) => setPay(p.k, { DateJalali: e.target.value.trim() })} />, 6)}
                  {field('روش پرداخت *', <Select style={{ width: '100%' }} value={p.Method || undefined} options={PAY_METHODS.map((x) => ({ value: x, label: x }))} onChange={(v) => setPay(p.k, { Method: v, ...(v === 'چک' && !p.ChequeStatus ? { ChequeStatus: CHEQUE_STATUS[0] } : {}) })} />, 6)}
                  {field('مبلغ (ریال) *', <NumInput value={p.Amount} onChange={(v) => setPay(p.k, { Amount: v })} />, 6)}
                  {field('حساب/صندوق پرداخت‌کننده (توضیح)', <Input value={p.FromAccount} onChange={(e) => setPay(p.k, { FromAccount: e.target.value })} />, 6)}
                  {field('بانک/صندوق (برای گردش حساب)', <Select allowClear showSearch optionFilterProp="label" style={{ width: '100%' }} placeholder="—" value={p.AccountID || undefined} options={accountOpts(bank.data?.rows, ch ? ['bank'] : undefined, p.AccountID)} onChange={(v) => setPay(p.k, { AccountID: v ?? '' })} />, 6)}
                  {tk ? field('شماره پیگیری / رسید', <Input value={p.TrackingNo} onChange={(e) => setPay(p.k, { TrackingNo: e.target.value })} />, 6) : null}
                  {bk ? field('شماره حساب / شبا مقصد', <Input value={p.DestAccount} onChange={(e) => setPay(p.k, { DestAccount: e.target.value })} />, 6) : null}
                  {cc ? field('چهار رقم آخر کارت مقصد', <Input maxLength={4} value={p.CardLast4} onChange={(e) => setPay(p.k, { CardLast4: e.target.value })} />, 6) : null}
                  {ch ? field('شماره چک', <Input value={p.ChequeNo} onChange={(e) => setPay(p.k, { ChequeNo: e.target.value })} />, 6) : null}
                  {ch ? field('شماره صیادی', <Input value={p.SayadNo} onChange={(e) => setPay(p.k, { SayadNo: e.target.value })} />, 6) : null}
                  {ch ? field('بانک چک', <Input value={p.ChequeBank} onChange={(e) => setPay(p.k, { ChequeBank: e.target.value })} />, 6) : null}
                  {ch ? field('تاریخ سررسید *', <Input value={p.ChequeDueJalali} onChange={(e) => setPay(p.k, { ChequeDueJalali: e.target.value.trim() })} />, 6) : null}
                  {ch ? field('وضعیت چک', <Select style={{ width: '100%' }} value={p.ChequeStatus || CHEQUE_STATUS[0]} options={CHEQUE_STATUS.map((x) => ({ value: x, label: x }))} onChange={(v) => setPay(p.k, { ChequeStatus: v })} />, 6) : null}
                  {field('توضیحات', <Input value={p.Description} onChange={(e) => setPay(p.k, { Description: e.target.value })} />, 12)}
                </GridRow>
              </Card>
            );
          })}
        </Space>
      </Card>

      <Card>
        <div style={{ marginBottom: 4 }}>توضیحات فاکتور</div>
        <Input.TextArea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Space size="large" wrap style={{ margin: '12px 0' }}>
          <Statistic title="جمع کالا" value={fmtNum(T.t)} />
          <Statistic title="هزینه‌های جانبی" value={fmtNum(T.c)} />
          <Statistic title="مبلغ قابل پرداخت" value={fmtNum(T.pay)} />
          <Statistic title="پرداخت‌شده" value={fmtNum(T.paid)} />
          <Statistic title="مانده" value={fmtNum(T.rem)} />
          <div><div style={{ color: 'rgba(0,0,0,.45)', fontSize: 14 }}>وضعیت پرداخت</div><Tag style={{ marginTop: 6 }}>{payStatus(T.pay, T.paid)}</Tag></div>
        </Space>
        <Space>
          <Button type="primary" loading={saving} onClick={() => void submit(false)}>ذخیره فاکتور</Button>
          {id ? <Button onClick={() => void print(id)}>چاپ</Button> : null}
          <Button onClick={() => nav('/p/list')}>فهرست فاکتورها</Button>
        </Space>
      </Card>

      <Modal open={!!ser} title="شماره سریال کالا" okText="تأیید" cancelText="انصراف" onCancel={() => setSer(null)} onOk={() => { if (ser) setLine(ser.k, { Serials: ser.text.trim() }); setSer(null); }}>
        <Typography.Paragraph type="secondary">هر شماره سریال را در یک خط بنویسید (یا با ویرگول جدا کنید). تعداد سریال‌ها باید با تعداد کالا برابر باشد. تکراری قبول نمی‌شود.</Typography.Paragraph>
        <Input.TextArea rows={10} style={{ direction: 'ltr' }} value={ser?.text ?? ''} onChange={(e) => setSer((s) => (s ? { ...s, text: e.target.value } : s))} />
        <div style={{ marginTop: 6 }}>تعداد سریال واردشده: <b>{serCount(ser?.text ?? '')}</b></div>
      </Modal>
    </NeedCompany>
  );
}
