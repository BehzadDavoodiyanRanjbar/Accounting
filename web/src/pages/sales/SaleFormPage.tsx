import { DeleteOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { App, AutoComplete, Alert, Button, Card, Col, Input, Modal, Row as GridRow, Select, Space, Statistic, Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { callApi, errorMessage } from '../../api/client';
import { useCompany } from '../../api/CompanyContext';
import { fmtNum, fmtQty, str } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import type { Opt, Row } from '../../kit/types';
import { NeedCompany, isOn } from '../bank/common';
import { DocPayments, docPayTotals } from './DocPayments';
import { SLCQ, SLM, SLP, SLS, SLT, SLX, docPayFromServer, docPayToServer, lineFromServer, newSaleLine, num, r2, slCalc } from './constants';
import type { DocPay, SaleLine } from './constants';
import { printSale } from './salePrint';
import { NumInput } from '../../kit/NumInput';

const act = (r: Row) => r.IsActive === undefined || isOn(r.IsActive);
const toOpts = (m: Record<string, string>): Opt[] => Object.entries(m).map(([value, label]) => ({ value, label }));
const serCount = (v: string) => v.split(/[\s,،;]+/).filter(Boolean).length;

interface Head {
  SaleID: string;
  CustomerID: string;
  SerialNo: string;
  DateJalali: string;
  TimeHM: string;
  Inty: number;
  Inp: number;
  Ins: number;
  RefSaleID: string;
  RefTaxID: string;
  Setm: number;
  Cap: string;
  Insp: string;
  Notes: string;
  x: Row;
}
const emptyHead = (): Head => ({ SaleID: '', CustomerID: '', SerialNo: '', DateJalali: '', TimeHM: '', Inty: 1, Inp: 1, Ins: 1, RefSaleID: '', RefTaxID: '', Setm: 1, Cap: '', Insp: '', Notes: '', x: {} });

/** ثبت و ویرایش صورتحساب فروش (سامانهٔ مؤدیان) */
export default function SaleFormPage() {
  const { company, data } = useCompany();
  const { message, modal, notification } = App.useApp();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [sp] = useSearchParams();
  const editId = sp.get('id') ?? '';
  const amendId = sp.get('amend') ?? '';
  const deriveId = sp.get('derive') ?? '';
  const insParam = Number(sp.get('ins') ?? '0');

  const vat = (data?.vats && data.vats[company] !== undefined ? data.vats[company] : data?.vat) ?? 0;

  const [h, setH] = useState<Head>(emptyHead());
  const [items, setItems] = useState<SaleLine[]>([newSaleLine(vat)]);
  const [pays, setPays] = useState<DocPay[]>([]);
  const [paysOk, setPaysOk] = useState(true);
  const [refs, setRefs] = useState<Row[] | null>(null);
  const [showOd, setShowOd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [ser, setSer] = useState<{ k: number; text: string } | null>(null);
  const [result, setResult] = useState<Row | null>(null);
  const seq = useRef(0);

  const sellers = useCsQuery<{ rows: Row[] }>('report', { id: 'salesBySeller', from: '1300/01/01', to: '1500/12/29' });
  const sellerOpts = useMemo(() => (sellers.data?.rows ?? []).map((x) => str(x.name)).filter((n) => n && n.charAt(0) !== '(').map((n) => ({ value: n })), [sellers.data]);

  const upd = (p: Partial<Head>) => setH((o) => ({ ...o, ...p }));
  const setX = (k: string, v: unknown) => setH((o) => ({ ...o, x: { ...o.x, [k]: v } }));

  const applyServerSale = useCallback(
    (r: Row, base: Partial<Head>, withPays: boolean) => {
      setH({ ...emptyHead(), SaleID: str(r.SaleID), CustomerID: str(r.CustomerID), SerialNo: str(r.SerialNo), DateJalali: str(r.DateJalali), TimeHM: str(r.TimeHM) || '12:00', Inty: Number(r.Inty), Inp: Number(r.Inp), Ins: Number(r.Ins), RefSaleID: str(r.RefSaleID), RefTaxID: str(r.RefTaxID), Setm: Number(r.Setm) || 1, Cap: r.Cap ? str(r.Cap) : '', Insp: r.Insp ? str(r.Insp) : '', Notes: str(r.Notes), x: r.x ?? {}, ...base });
      setItems(((r.items ?? []) as Row[]).map((i) => lineFromServer(i, vat)));
      if (!withPays) setPays([]);
    },
    [vat],
  );

  useEffect(() => {
    if (!company) return;
    const my = ++seq.current;
    setLoading(true);
    setLoadErr('');
    setRefs(null);
    setResult(null);
    (async () => {
      if (editId) {
        const r = await callApi<Row>('getSale', { id: editId });
        if (my !== seq.current) return;
        applyServerSale(r, {}, true);
        setPays([]);
        setPaysOk(true);
        if (Number(r.Ins) !== 3 && String(r.Superseded) !== '1') {
          try {
            const z = await callApi<Row>('docPayGet', { company, type: 'sale', id: editId });
            if (my === seq.current) setPays(((z.payments ?? []) as Row[]).map(docPayFromServer));
          } catch {
            if (my === seq.current) setPaysOk(false);
          }
        }
      } else if (amendId || deriveId) {
        const id = amendId || deriveId;
        const [d, r] = await Promise.all([callApi<Row>('saleDefaults', { company }), callApi<Row>('getSale', { id })]);
        if (my !== seq.current) return;
        if (amendId && !r.TaxNo) {
          setLoadErr('این صورتحساب شماره مالیاتی ندارد؛ ابتدا باید ارسال/تأیید شود.');
          return;
        }
        applyServerSale(r, { SaleID: '', SerialNo: str(d.serial), DateJalali: str(d.dateJalali), TimeHM: str(d.time), Ins: insParam, RefSaleID: id, RefTaxID: str(r.TaxNo), Notes: '' }, false);
        if (deriveId) setRefs([r]);
        setPaysOk(true);
      } else {
        const d = await callApi<Row>('saleDefaults', { company });
        if (my !== seq.current) return;
        setH({ ...emptyHead(), SerialNo: str(d.serial), DateJalali: str(d.dateJalali), TimeHM: str(d.time) });
        setItems([newSaleLine(vat)]);
        setPays([]);
        setPaysOk(true);
      }
    })()
      .catch((e) => my === seq.current && setLoadErr(errorMessage(e)))
      .finally(() => my === seq.current && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, sp]);

  // فهرست مرجع برای اصلاحی/ابطالی/برگشت
  useEffect(() => {
    if (!company || h.Ins < 2 || refs) return;
    callApi<{ rows: Row[] }>('listSales', { company, status: '', noYear: true })
      .then((r) => setRefs(r.rows.filter((z) => Number(z.Ins) !== 3 && String(z.Superseded) !== '1' && str(z.SaleID) !== h.SaleID)))
      .catch(() => setRefs([]));
  }, [company, h.Ins, h.SaleID, refs]);

  const customers = useMemo<Opt[]>(
    () => (data?.customers ?? []).filter((c) => c.CompanyID === company && (act(c) || str(c.CustomerID) === h.CustomerID)).map((c) => ({ value: str(c.CustomerID), label: str(c.Name) })),
    [data, company, h.CustomerID],
  );
  const itemOpts = useMemo(() => {
    const showSv = h.Inp === 1 || h.Inp === 4;
    const sv = showSv ? (data?.services ?? []).filter((x) => x.CompanyID === company && act(x)).map((x) => ({ value: str(x.ServiceID), label: str(x.Name) })) : [];
    const pr = (data?.products ?? []).filter((x) => x.CompanyID === company && act(x)).map((x) => ({ value: str(x.ProductID), label: str(x.Name) }));
    return [...(sv.length ? [{ label: 'خدمات', options: sv }] : []), ...(pr.length ? [{ label: 'کالاها', options: pr }] : [])];
  }, [data, company, h.Inp]);
  const units = useMemo(() => (data?.units ?? []).filter((u) => u.CompanyID === company && act(u)), [data, company]);

  const ins = h.Ins;
  const inp = h.Inp;
  const ro = ins === 3;
  const patterns = h.Inty === 2 ? { '1': SLP['1'], '13': SLP['13'] } : SLP;

  const setLine = (k: number, p: Partial<SaleLine>) => setItems((a) => a.map((l) => (l.k === k ? { ...l, ...p } : l)));
  const pickProduct = (k: number, id: string | undefined) => {
    const pid = id ?? '';
    const p = (data?.products ?? []).find((x) => str(x.ProductID) === pid) ?? (data?.services ?? []).find((x) => str(x.ServiceID) === pid);
    const patch: Partial<SaleLine> = { ProductID: pid };
    if (p) {
      patch.Sstt = str(p.Name);
      if (p.SstID) patch.Sstid = str(p.SstID);
      if (p.VatRate !== '' && p.VatRate != null) patch.Vra = str(p.VatRate);
      if (p.DefaultUnit) {
        patch.unit = str(p.DefaultUnit);
        const u = units.find((z) => str(z.UnitName) === str(p.DefaultUnit));
        patch.Mu = u && u.MuCode ? str(u.MuCode) : '';
      }
    }
    setLine(k, patch);
  };
  const pickUnit = (k: number, name: string | undefined) => {
    const u = units.find((z) => str(z.UnitName) === name);
    setLine(k, { unit: name ?? '', Mu: u && u.MuCode ? str(u.MuCode) : '' });
  };

  const T = useMemo(() => {
    const t = { pr: 0, dis: 0, ad: 0, vam: 0, od: 0, t: 0 };
    items.forEach((l) => {
      const c = slCalc(inp, l);
      t.pr += c.pr;
      t.dis += c.dis;
      t.ad += c.ad;
      t.vam += c.vam;
      t.od += c.od;
      t.t += c.t;
    });
    return t;
  }, [items, inp]);
  const total = r2(T.t);

  const pickRef = async (id: string | undefined) => {
    if (!id) return upd({ RefSaleID: '' });
    try {
      const r = await callApi<Row>('getSale', { id });
      setH((o) => ({ ...o, RefSaleID: id, RefTaxID: str(r.TaxNo) || o.RefTaxID, CustomerID: str(r.CustomerID), Inty: Number(r.Inty), Inp: Number(r.Inp), Setm: Number(r.Setm), Cap: r.Cap ? str(r.Cap) : '', Insp: r.Insp ? str(r.Insp) : '', x: r.x ?? {} }));
      setItems(((r.items ?? []) as Row[]).map((i) => lineFromServer(i, vat)));
    } catch (e) {
      notification.error({ message: 'خواندن مرجع انجام نشد', description: errorMessage(e) });
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      const p: Row = { SaleID: h.SaleID, CompanyID: company, CustomerID: h.CustomerID, SerialNo: h.SerialNo, DateJalali: h.DateJalali, TimeHM: h.TimeHM, Inty: h.Inty, Inp: h.Inp, Ins: h.Ins, RefSaleID: h.RefSaleID, RefTaxID: h.RefTaxID, Setm: h.Setm, Cap: h.Cap, Insp: h.Insp, Notes: h.Notes, x: h.x, items: items.map(({ k: _k, ...l }) => l) };
      const oldId = h.SaleID;
      const r = await callApi<Row>('saveSale', p);
      if (ins !== 3 && paysOk && !(!oldId && !pays.length)) {
        try {
          r.pay = await callApi<Row>('docPaySave', { company, type: 'sale', id: str(r.SaleID), payments: pays.map(docPayToServer) });
        } catch (er) {
          setH((o) => ({ ...o, SaleID: str(r.SaleID) }));
          throw new Error(`فاکتور ذخیره شد ولی ثبت دریافت‌ها خطا دارد: ${errorMessage(er)}`);
        }
      }
      await Promise.all([qc.invalidateQueries({ queryKey: ['csq'] }), qc.invalidateQueries({ queryKey: ['cs'] })]);
      setResult(r);
    } catch (e) {
      notification.error({ message: 'ذخیره انجام نشد', description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  const makeProd = async (id: string) => {
    try {
      const r = await callApi<Row>('prodFromSale', { company, saleId: id });
      modal.info({
        title: 'سفارش‌های تولید ساخته شد',
        content: (
          <div>
            <p>برای فروش {str(r.serial)}:</p>
            <ul>
              {((r.created ?? []) as Row[]).map((x, i) => (
                <li key={i}><b>{str(x.OrderNo)}</b> — {str(x.Name)} ({fmtQty(x.qty)}){x.children ? ` + ${str(x.children)} سفارش نیمه‌ساخته` : ''}</li>
              ))}
            </ul>
            {!(r.created ?? []).length ? <p>کمبودی برای تولید باقی نمانده است.</p> : <p>پس از ساخت محصول، در سفارش، «تأیید تکمیل تولید» را بزنید تا به موجودی اضافه شود.</p>}
          </div>
        ),
        okText: 'رفتن به سفارش‌های تولید',
        onOk: () => nav('/p/po'),
      });
    } catch (e) {
      notification.error({ message: 'انجام نشد', description: errorMessage(e) });
    }
  };

  const lineCols = useMemo<TableColumnsType<SaleLine>>(() => {
    const inpt = (k: keyof SaleLine, w = 100) => (l: SaleLine) => <NumInput style={{ minWidth: w }} disabled={ro} value={l[k] as string} onChange={(v) => setLine(l.k, { [k]: v } as Partial<SaleLine>)} />;
    const txt = (k: keyof SaleLine, w = 120) => (l: SaleLine) => <Input style={{ minWidth: w }} disabled={ro} value={l[k] as string} onChange={(e) => setLine(l.k, { [k]: e.target.value } as Partial<SaleLine>)} />;
    const c: TableColumnsType<SaleLine> = [
      { title: '#', key: 'i', width: 44, render: (_, __, i) => i + 1 },
      { title: 'کالا / خدمت', key: 'p', width: 230, render: (_, l) => <Select showSearch allowClear optionFilterProp="label" style={{ width: 220 }} disabled={ro} placeholder="—" value={l.ProductID || undefined} options={itemOpts} onChange={(v) => pickProduct(l.k, v)} /> },
      { title: 'شناسه کالا/خدمت (۱۳ رقم)', key: 'sid', render: (_, l) => txt('Sstid', 140)(l) },
      { title: 'شرح کالا/خدمت (قابل ویرایش)', key: 'st', render: (_, l) => txt('Sstt', 220)(l) },
      { title: 'واحد', key: 'u', width: 120, render: (_, l) => <Select allowClear showSearch style={{ width: 110 }} disabled={ro} placeholder="—" value={l.unit || undefined} options={units.map((u) => ({ value: str(u.UnitName), label: str(u.UnitName) }))} onChange={(v) => pickUnit(l.k, v)} /> },
    ];
    if (inp === 2) {
      c.push({ title: 'نوع ارز', key: 'cut', render: (_, l) => txt('cut', 80)(l) });
      c.push({ title: 'میزان ارز', key: 'cfee', render: (_, l) => inpt('cfee')(l) });
      c.push({ title: 'نرخ برابری', key: 'exr', render: (_, l) => inpt('exr')(l) });
      c.push({ title: 'نرخ خرید ارز', key: 'cpr', render: (_, l) => inpt('cpr')(l) });
      c.push({ title: 'مأخذ مالیات', key: 'sovat', render: (_, l) => inpt('sovat')(l) });
    }
    c.push({ title: 'تعداد', key: 'am', render: (_, l) => inpt('Am', 90)(l) });
    if (inp !== 2) c.push({ title: 'مبلغ واحد', key: 'fee', render: (_, l) => inpt('Fee', 110)(l) });
    c.push({ title: 'تخفیف', key: 'dis', render: (_, l) => inpt('Dis', 100)(l) });
    c.push({ title: '٪ مالیات', key: 'vra', render: (_, l) => inpt('Vra', 70)(l) });
    if (showOd) {
      c.push({ title: 'موضوع عوارض', key: 'odt', render: (_, l) => txt('Odt', 110)(l) });
      c.push({ title: '٪ عوارض', key: 'odr', render: (_, l) => inpt('Odr', 70)(l) });
      c.push({ title: 'موضوع سایر وجوه', key: 'olt', render: (_, l) => txt('Olt', 110)(l) });
      c.push({ title: '٪ وجوه', key: 'olr', render: (_, l) => inpt('Olr', 70)(l) });
    }
    c.push({ title: 'مالیات', key: 'v', align: 'end', render: (_, l) => fmtNum(slCalc(inp, l).vam) });
    c.push({ title: 'جمع ردیف', key: 't', align: 'end', render: (_, l) => <b>{fmtNum(slCalc(inp, l).t)}</b> });
    c.push({
      title: 'سریال',
      key: 'ser',
      render: (_, l) => {
        const n = serCount(l.serials);
        const q = Math.round(num(l.Am));
        return <Button size="small" danger={n > 0 && q > 0 && n !== q} onClick={() => setSer({ k: l.k, text: l.serials })}>{ro ? 'نمایش' : n ? `سریال (${n})` : '+ سریال'}</Button>;
      },
    });
    c.push({ title: '', key: 'x', width: 50, render: (_, l) => (ro ? null : <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setItems((a) => (a.length > 1 ? a.filter((x) => x.k !== l.k) : a))} />) });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inp, ro, showOd, itemOpts, units, data]);

  const field = (label: string, node: ReactNode, span = 6) => (
    <Col xs={24} md={span}>
      <div style={{ marginBottom: 4 }}>{label}</div>
      {node}
    </Col>
  );

  const xf = SLX[String(inp)] ?? [];
  const sg: Array<{ sgid: string; sgt: string }> = (h.x.sg as Array<{ sgid: string; sgt: string }>) ?? [];
  const rt = ins === 4;
  const payT = docPayTotals(pays, total);

  return (
    <NeedCompany company={company}>
      <Card loading={loading}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Typography.Title level={3} style={{ margin: 0 }}>{h.SaleID ? 'ویرایش صورتحساب فروش' : 'صورتحساب فروش جدید'}</Typography.Title>
          {loadErr ? <Alert type="error" showIcon message={loadErr} /> : null}
          <GridRow gutter={[12, 12]}>
            {field('نوع صورتحساب', <Select style={{ width: '100%' }} value={String(h.Inty)} options={toOpts(SLT)} onChange={(v) => upd({ Inty: Number(v), ...(Number(v) === 2 && !['1', '13'].includes(String(h.Inp)) ? { Inp: 1 } : {}), ...(Number(v) === 2 ? { Setm: 1 } : {}) })} />)}
            {field('الگو', <Select style={{ width: '100%' }} value={String(h.Inp)} options={toOpts(patterns)} onChange={(v) => upd({ Inp: Number(v) })} />)}
            {field('موضوع', <Select style={{ width: '100%' }} value={String(h.Ins)} options={toOpts(SLS)} onChange={(v) => { setRefs(null); upd({ Ins: Number(v), ...(Number(v) === 1 ? { RefSaleID: '', RefTaxID: '' } : {}) }); }} />)}
            {ins >= 2 ? field('صورتحساب مرجع', <Select allowClear showSearch optionFilterProp="label" style={{ width: '100%' }} placeholder="— انتخاب —" value={h.RefSaleID || undefined} options={(refs ?? []).map((r) => ({ value: str(r.SaleID), label: `${str(r.SerialNo)} - ${str(r.DateJalali)} - ${fmtNum(r.Tbill)}` }))} onChange={(v) => void pickRef(v)} />) : null}
            {ins >= 2 ? field('شماره مالیاتی مرجع (۲۲ کاراکتر)', <Input value={h.RefTaxID} onChange={(e) => upd({ RefTaxID: e.target.value })} style={{ direction: 'ltr' }} />) : null}
          </GridRow>
          <GridRow gutter={[12, 12]}>
            {field('سریال صورتحساب *', <Input value={h.SerialNo} onChange={(e) => upd({ SerialNo: e.target.value })} />, 4)}
            {field('تاریخ صدور * (1405/07/09)', <Input value={h.DateJalali} onChange={(e) => upd({ DateJalali: e.target.value.trim() })} />, 4)}
            {field('ساعت (14:30)', <Input value={h.TimeHM} onChange={(e) => upd({ TimeHM: e.target.value })} />, 3)}
            {field('فروشنده / ویزیتور (اختیاری)', <AutoComplete style={{ width: '100%' }} options={sellerOpts} value={str(h.x.seller)} onChange={(v) => setX('seller', v.trim())} filterOption={(i, o) => str(o?.value).includes(i)} />, 5)}
            {field(ins === 1 && h.Inty === 1 && inp !== 11 ? 'مشتری (خریدار) *' : 'مشتری (اختیاری)', <Select allowClear showSearch optionFilterProp="label" style={{ width: '100%' }} placeholder="—" value={h.CustomerID || undefined} options={customers} onChange={(v) => upd({ CustomerID: v ?? '' })} />, 5)}
            {ins !== 3 ? field('روش تسویه', <Select style={{ width: '100%' }} value={String(h.Setm)} options={toOpts(h.Inty === 2 ? { '1': 'نقدی' } : SLM)} onChange={(v) => upd({ Setm: Number(v) })} />, 4) : null}
            {ins !== 3 && h.Setm === 3 ? field('مبلغ نقدی', <NumInput value={h.Cap} onChange={(v) => upd({ Cap: v })} />, 4) : null}
            {ins !== 3 && h.Setm === 3 ? field('مبلغ نسیه', <NumInput value={h.Insp} onChange={(v) => upd({ Insp: v })} />, 4) : null}
          </GridRow>
          <Typography.Text type="secondary">
            اگر مشتری یا کالا در فهرست نیست، ابتدا در «اطلاعات پایه» بسازید ( <a href="#/p/Customers" target="_blank" rel="noreferrer">مشتریان</a>، <a href="#/p/Products" target="_blank" rel="noreferrer">کالاها</a> ) و بعد صفحه را با Ctrl+F5 تازه کنید.
          </Typography.Text>
          {xf.length && ins !== 3 ? (
            <GridRow gutter={[12, 12]}>
              {xf.map((f) => field(f[1], f[2] === 'sel' ? <Select allowClear style={{ width: '100%' }} placeholder="—" value={str(h.x[f[0]]) || undefined} options={(f[3] ?? []).map((z) => ({ value: z[0], label: z[1] }))} onChange={(v) => setX(f[0], v ?? '')} /> : <Input value={str(h.x[f[0]])} onChange={(e) => setX(f[0], e.target.value)} />, 6))}
            </GridRow>
          ) : null}
          {inp === 8 && ins !== 3 ? (
            <Card size="small" title="کالاهای حمل‌شده" extra={<Button size="small" onClick={() => setX('sg', [...sg, { sgid: '', sgt: '' }])}>+ کالای حمل‌شده</Button>}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {sg.map((g, i) => (
                  <Space key={i} wrap>
                    <Input placeholder="شناسه کالا" value={g.sgid} onChange={(e) => setX('sg', sg.map((z, j) => (j === i ? { ...z, sgid: e.target.value } : z)))} />
                    <Input placeholder="شرح" style={{ width: 280 }} value={g.sgt} onChange={(e) => setX('sg', sg.map((z, j) => (j === i ? { ...z, sgt: e.target.value } : z)))} />
                    <Button size="small" danger onClick={() => setX('sg', sg.filter((_, j) => j !== i))}>✕</Button>
                  </Space>
                ))}
              </Space>
            </Card>
          ) : null}
        </Space>
      </Card>

      <Card
        title="اقلام"
        extra={ro ? null : (
          <Space>
            <Button size="small" onClick={() => setItems((a) => [...a, newSaleLine(vat)])}>+ ردیف</Button>
            <Button size="small" onClick={() => setShowOd((v) => !v)}>{showOd ? 'پنهان کردن' : 'نمایش'} عوارض و سایر وجوه</Button>
          </Space>
        )}
      >
        <Table<SaleLine> size="small" rowKey="k" columns={lineCols} dataSource={items} pagination={false} scroll={{ x: 'max-content' }} />
        {ro ? <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>در صورتحساب ابطالی، اقلام از مرجع واکشی می‌شود.</Typography.Paragraph> : null}
        <Space size="large" wrap style={{ marginTop: 12 }}>
          <Statistic title="جمع قبل از تخفیف" value={fmtNum(T.pr)} />
          <Statistic title="جمع تخفیف" value={fmtNum(T.dis)} />
          <Statistic title="جمع پس از تخفیف" value={fmtNum(T.ad)} />
          <Statistic title="مالیات ارزش افزوده" value={fmtNum(T.vam)} />
          <Statistic title="سایر مالیات و عوارض" value={fmtNum(T.od)} />
          <Statistic title="مجموع صورتحساب" value={fmtNum(total)} />
        </Space>
      </Card>

      {ins !== 3 ? (
        <Card title={`${rt ? 'پرداخت' : 'دریافت'}‌ها — ${rt ? 'برگشت از فروش' : 'فاکتور فروش'}`}>
          {paysOk ? (
            <DocPayments payments={pays} onChange={setPays} statuses={SLCQ[rt ? 'out' : 'in']} total={total} dir={rt ? 'out' : 'in'} label={rt ? 'برگشت از فروش' : 'فاکتور فروش'} defaultDate={h.DateJalali} />
          ) : (
            <Alert type="error" showIcon message={`بارگذاری ${rt ? 'پرداخت' : 'دریافت'}‌های این فاکتور انجام نشد؛ فاکتور را دوباره باز کنید.`} />
          )}
        </Card>
      ) : null}

      <Card>
        <div style={{ marginBottom: 4 }}>توضیحات داخلی (در JSON ارسال نمی‌شود)</div>
        <Input.TextArea rows={2} value={h.Notes} onChange={(e) => upd({ Notes: e.target.value })} />
        <Space style={{ marginTop: 12 }}>
          <Button type="primary" loading={saving} onClick={() => void submit()}>ذخیره و کنترل</Button>
          <Button onClick={() => nav('/p/sales')}>انصراف</Button>
        </Space>
        {ins !== 3 && paysOk ? <Typography.Paragraph type="secondary" style={{ margin: '8px 0 0' }}>{rt ? 'پرداختی' : 'دریافتی'} فعلی: {fmtNum(payT.paid)} — مانده: {fmtNum(payT.rem)}</Typography.Paragraph> : null}
      </Card>

      <Modal open={!!ser} title="شماره سریال کالا" okText="تأیید" cancelText="انصراف" onCancel={() => setSer(null)} okButtonProps={{ disabled: ro }} onOk={() => { if (ser && !ro) setLine(ser.k, { serials: ser.text.trim() }); setSer(null); }}>
        <Typography.Paragraph type="secondary">هر شماره سریال را در یک خط بنویسید (یا با ویرگول جدا کنید). تعداد سریال‌ها باید با تعداد کالا برابر باشد. تکراری قبول نمی‌شود.</Typography.Paragraph>
        <Input.TextArea rows={10} style={{ direction: 'ltr' }} disabled={ro} value={ser?.text ?? ''} onChange={(e) => setSer((s) => (s ? { ...s, text: e.target.value } : s))} />
        <div style={{ marginTop: 6 }}>تعداد سریال واردشده: <b>{serCount(ser?.text ?? '')}</b></div>
      </Modal>

      <Modal open={!!result} width={760} footer={null} onCancel={() => setResult(null)} title={result ? (((result.errors ?? []) as string[]).length ? 'ذخیره شد (پیش‌نویس) - خطا دارد' : 'ذخیره شد - آماده ارسال') : ''}>
        {result ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>مجموع صورتحساب: <b>{fmtNum((result.totals as Row | undefined)?.Tbill)}</b> ریال</div>
            {result.pay ? <div>{rt ? 'پرداختی' : 'دریافتی'} ثبت‌شده: <b>{fmtNum((result.pay as Row).paid)}</b> | مانده: <b>{fmtNum((result.pay as Row).remain)}</b> ریال</div> : null}
            {((result.errors ?? []) as string[]).length ? <Alert type="error" showIcon message="خطاها (تا برطرف نشوند «آماده ارسال» نمی‌شود)" description={<ul style={{ margin: 0, paddingInlineStart: 20 }}>{(result.errors as string[]).map((z, i) => <li key={i}>{z}</li>)}</ul>} /> : null}
            {((result.warnings ?? []) as string[]).length ? <Alert type="warning" showIcon message="هشدارها" description={<ul style={{ margin: 0, paddingInlineStart: 20 }}>{(result.warnings as string[]).map((z, i) => <li key={i}>{z}</li>)}</ul>} /> : null}
            {((result.shortage ?? []) as Row[]).length ? (
              <Alert
                type="warning"
                showIcon
                message="موجودی بعضی محصولات برای این فروش کافی نیست (و برایشان فرمول ساخت دارید)"
                description={
                  <div>
                    <Table<Row> size="small" pagination={false} rowKey={(_, i) => String(i)} dataSource={result.shortage as Row[]} columns={[{ title: 'محصول', dataIndex: 'Name' }, { title: 'مقدار فروش', render: (_, x) => `${fmtNum(x.need)} ${str(x.Unit)}` }, { title: 'موجودی', render: (_, x) => fmtNum(x.balance) }, { title: 'در حال تولید', render: (_, x) => fmtNum(x.incoming) }, { title: 'کمبود', render: (_, x) => <b style={{ color: '#cf1322' }}>{fmtNum(x.short)}</b> }]} />
                    <Button style={{ marginTop: 8 }} type="primary" onClick={() => void makeProd(str(result.SaleID))}>ساخت سفارش تولید برای کمبودها</Button>
                    <div style={{ marginTop: 4 }}>یا بدون تولید ادامه دهید (محصول از موجودی کم می‌شود و ممکن است منفی شود).</div>
                  </div>
                }
              />
            ) : null}
            <Space wrap>
              <Button type="primary" onClick={() => { setResult(null); nav('/p/sales'); }}>فهرست فروش</Button>
              <Button onClick={() => { const id = str(result.SaleID); setResult(null); nav(`/p/sale?id=${encodeURIComponent(id)}`); }}>ویرایش</Button>
              <Button onClick={() => void printSale(str(result.SaleID), data, message)}>چاپ</Button>
              <Button onClick={() => { setResult(null); nav(`/p/sale?new=${Date.now()}`); }}>فاکتور جدید</Button>
            </Space>
          </Space>
        ) : null}
      </Modal>
    </NeedCompany>
  );
}
