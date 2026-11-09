import { App, Button, Card, Checkbox, Col, Collapse, Input, Popconfirm, Row as ARow, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { errorMessage } from '../../api/client';
import { csCall } from '../../api/costService';
import { useCompany } from '../../api/CompanyContext';
import { fmtNum, fmtQty, str } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import { NumInput } from '../../kit/NumInput';
import type { Row } from '../../kit/types';
import { NeedCompany, isOn, useBankCall } from '../bank/common';

/* ---------- ساختار داده ---------- */
interface Param { key: string; label: string; default: string; unit: string }
interface Item { ProductID: string; QtyFormula: string; WastePct: string; StepNo: number; Notes: string }
interface Labor { serviceId: string; qty: string; rate: string; desc: string }
interface Check { key: string; label: string; type: string; min: string; max: string; unit: string; options: string; failOptions: string; required: boolean; blocking: boolean }
interface Step { Name: string; WorkCenter: string; StdMinutes: string; Instructions: string; Labor: Labor[]; Checks: Check[] }
interface Rec {
  RecipeID: string;
  ProductID: string;
  Name: string;
  OutputQty: string;
  StdOverhead: string;
  Notes: string;
  IsActive: boolean;
  params: Param[];
  items: Item[];
  steps: Step[];
}

const emptyItem = (): Item => ({ ProductID: '', QtyFormula: '', WastePct: '0', StepNo: 0, Notes: '' });
const emptyStep = (): Step => ({ Name: '', WorkCenter: '', StdMinutes: '', Instructions: '', Labor: [], Checks: [] });
const emptyCheck = (): Check => ({ key: '', label: '', type: 'number', min: '', max: '', unit: '', options: '', failOptions: '', required: false, blocking: false });
const newRec = (): Rec => ({ RecipeID: '', ProductID: '', Name: '', OutputQty: '1', StdOverhead: '0', Notes: '', IsActive: true, params: [], items: [emptyItem()], steps: [] });

const list = (v: unknown) => ((v ?? []) as string[]).join('، ');

function fromServer(r: Row): Rec {
  const x = (r.recipe ?? {}) as Row;
  return {
    RecipeID: str(x.RecipeID),
    ProductID: str(x.ProductID),
    Name: str(x.Name),
    OutputQty: str(x.OutputQty),
    StdOverhead: str(x.StdOverhead || 0),
    Notes: str(x.Notes),
    IsActive: str(x.IsActive) !== 'false',
    params: ((r.params ?? []) as Row[]).map((p) => ({ key: str(p.key), label: str(p.label), default: str(p.default), unit: str(p.unit) })),
    items: ((r.items ?? []) as Row[]).map((i) => ({ ProductID: str(i.ProductID), QtyFormula: str(i.QtyFormula), WastePct: str(i.WastePct || 0), StepNo: Number(i.StepNo) || 0, Notes: str(i.Notes) })),
    steps: ((r.steps ?? []) as Row[]).map((s) => ({
      Name: str(s.Name),
      WorkCenter: str(s.WorkCenter),
      StdMinutes: s.StdMinutes ? str(s.StdMinutes) : '',
      Instructions: str(s.Instructions),
      Labor: ((s.Labor ?? []) as Row[]).map((l) => ({ serviceId: str(l.serviceId), qty: str(l.qty), rate: str(l.rate), desc: str(l.desc) })),
      Checks: ((s.Checks ?? []) as Row[]).map((c) => ({
        key: str(c.key),
        label: str(c.label),
        type: str(c.type),
        min: c.min == null ? '' : str(c.min),
        max: c.max == null ? '' : str(c.max),
        unit: str(c.unit),
        options: list(c.options),
        failOptions: list(c.failOptions),
        required: !!c.required,
        blocking: !!c.blocking,
      })),
    })),
  };
}

const payloadOf = (s: Rec): Row => ({
  RecipeID: s.RecipeID,
  ProductID: s.ProductID,
  Name: s.Name,
  OutputQty: s.OutputQty,
  StdOverhead: s.StdOverhead,
  Notes: s.Notes,
  IsActive: s.IsActive,
  Params: s.params,
  items: s.items,
  steps: s.steps,
});

const lab = (t: string) => <div style={{ marginBottom: 4 }}>{t}</div>;

/* ---------- فهرست ---------- */
function RecipeList({ onOpen, onNew, onCopy }: { onOpen: (id: string) => void; onNew: () => void; onCopy: (id: string) => void }) {
  const { message } = App.useApp();
  const call = useBankCall();
  const { company } = useCompany();
  const q = useCsQuery<{ rows: Row[] }>('recipeList', {});
  const rows = q.data?.rows ?? [];

  const toggle = async (id: string) => {
    try {
      const r = await csCall<Row>('recipeGet', company, { id });
      const s = fromServer(r);
      s.IsActive = !s.IsActive;
      await call('recipeSave', payloadOf(s));
    } catch (e) {
      message.error(errorMessage(e));
    }
  };
  const del = async (id: string) => {
    try {
      await call('recipeDelete', { id });
      message.success('حذف شد.');
    } catch (e) {
      message.error(errorMessage(e));
    }
  };

  const columns: TableColumnsType<Row> = [
    { title: 'محصول', dataIndex: 'Product', render: (v: unknown) => <b>{str(v)}</b> },
    { title: 'نام فرمول', dataIndex: 'Name' },
    { title: 'مقدار پایه', align: 'right', render: (_, x) => `${fmtNum(x.OutputQty, 3)} ${str(x.Unit)}` },
    { title: 'مواد', dataIndex: 'items', align: 'right', render: (v: unknown) => fmtNum(v) },
    { title: 'مراحل', dataIndex: 'steps', align: 'right', render: (v: unknown) => fmtNum(v) },
    { title: 'سفارش‌ها', dataIndex: 'orders', align: 'right', render: (v: unknown) => fmtNum(v) },
    { title: 'وضعیت', render: (_, x) => (x.Active ? <Tag color="success">فعال</Tag> : <Tag color="error">غیرفعال</Tag>) },
    {
      title: '',
      render: (_, x) => (
        <Space size="small" onClick={(e) => e.stopPropagation()}>
          <Button size="small" onClick={() => onCopy(str(x.RecipeID))}>
            کپی
          </Button>
          <Button size="small" onClick={() => void toggle(str(x.RecipeID))}>
            {x.Active ? 'غیرفعال' : 'فعال'}
          </Button>
          <Popconfirm title="این فرمول ساخت حذف شود؟" okText="حذف" cancelText="انصراف" onConfirm={() => void del(str(x.RecipeID))}>
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
      <Card
        title="فرمول‌های ساخت"
        extra={
          <Button type="primary" onClick={onNew}>
            + فرمول ساخت جدید
          </Button>
        }
      >
        <Collapse
          ghost
          items={[
            {
              key: 'g',
              label: 'فرمول ساخت چیست؟ (راهنمای ۴ قدمی)',
              children: (
                <ol style={{ lineHeight: 2 }}>
                  <li><b>محصول و مقدار پایه:</b> مشخص کنید فرمول برای ساخت چه چیزی و چه مقدار (مثلاً «۱۰۰ عدد» یا «۵۰ کیلو») نوشته می‌شود.</li>
                  <li><b>مواد:</b> هر ماده را بردارید و مقدار مصرفش را بنویسید؛ عدد ساده یا فرمول (مثل <span dir="ltr">طول*عرض*2</span>) و درصد ضایعات.</li>
                  <li><b>مراحل:</b> مراحل کار (مثلاً برش، مونتاژ، بسته‌بندی) به‌همراه دستمزد (از بخش «خدمات») و کنترل‌های کیفی دلخواه.</li>
                  <li><b>سفارش تولید:</b> بعد از ذخیره، از «سفارش‌های تولید» برای هر مقدار دلخواه سفارش بسازید؛ سیستم مواد و دستمزد را خودکار حساب می‌کند.</li>
                </ol>
              ),
            },
          ]}
        />
      </Card>
      <Card>
        <Table<Row>
          size="small"
          loading={q.isFetching}
          rowKey={(x) => str(x.RecipeID)}
          dataSource={rows}
          columns={columns}
          pagination={{ pageSize: 50, hideOnSinglePage: true }}
          scroll={{ x: 'max-content' }}
          onRow={(x) => ({ onClick: () => onOpen(str(x.RecipeID)), style: { cursor: 'pointer' } })}
          locale={{ emptyText: 'هنوز فرمولی ثبت نشده است. با «فرمول ساخت جدید» شروع کنید.' }}
        />
      </Card>
    </NeedCompany>
  );
}

/* ---------- ویرایشگر ---------- */
interface PrevRes {
  errors: string[];
  materials: Row[];
  labor: Row[];
  cost: Row;
  missingCost: number;
}

function RecipeEditor({ init, onBack }: { init: Rec; onBack: () => void }) {
  const { company, data } = useCompany();
  const { message, modal } = App.useApp();
  const call = useBankCall();
  const [R, setR] = useState<Rec>(init);
  const [busy, setBusy] = useState(false);
  const [pv, setPv] = useState({ qty: '', vals: {} as Record<string, string> });
  const [prev, setPrev] = useState<PrevRes | null>(null);
  const [prevBusy, setPrevBusy] = useState(false);

  const mut = (fn: (d: Rec) => void) =>
    setR((o) => {
      const d = structuredClone(o);
      fn(d);
      return d;
    });

  const products = useMemo(
    () => ((data?.products ?? []) as Row[]).filter((p) => p.CompanyID === company).sort((a, b) => Number(isOn(b.IsActive) || b.IsActive === undefined) - Number(isOn(a.IsActive) || a.IsActive === undefined)),
    [data, company],
  );
  const pOpts = useMemo(() => products.map((p) => ({ value: str(p.ProductID), label: `${str(p.Name)}${p.ProductCode ? ` [${str(p.ProductCode)}]` : ''}` })), [products]);
  const pById = useMemo(() => Object.fromEntries(products.map((p) => [str(p.ProductID), p])), [products]);
  const unit = (id: string) => str(pById[id]?.DefaultUnit);
  const svc = useMemo(
    () => ((data?.services ?? []) as Row[]).filter((s) => s.CompanyID === company && (s.IsActive === undefined || isOn(s.IsActive))).map((s) => ({ value: str(s.ServiceID), label: str(s.Name) })),
    [data, company],
  );

  const u = unit(R.ProductID);

  const save = async () => {
    if (!R.ProductID) return message.warning('محصول ساخته‌شده را از فهرست انتخاب کنید.');
    if (R.items.some((it) => !it.ProductID && it.QtyFormula.trim())) return message.warning('در ردیف مواد، کالا را از فهرست انتخاب کنید (ردیف ناقص با کادر قرمز نشان داده شده).');
    setBusy(true);
    try {
      const r = await call('recipeSave', payloadOf(R));
      message.success('فرمول ذخیره شد.');
      const x = await csCall<Row>('recipeGet', company, { id: str(r.RecipeID) });
      setR(fromServer(x));
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const preview = async () => {
    setPrevBusy(true);
    try {
      const r = await csCall<PrevRes>('recipePreview', company, { ...payloadOf(R), qty: pv.qty || R.OutputQty, values: pv.vals });
      setPrev(r);
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setPrevBusy(false);
    }
  };

  const stepMove = (i: number, d: number) =>
    mut((x) => {
      const j = i + d;
      if (j < 0 || j >= x.steps.length) return;
      [x.steps[i], x.steps[j]] = [x.steps[j], x.steps[i]];
      x.items.forEach((it) => {
        if (it.StepNo === i + 1) it.StepNo = j + 1;
        else if (it.StepNo === j + 1) it.StepNo = i + 1;
      });
    });
  const stepDel = (i: number) =>
    modal.confirm({
      title: 'این مرحله حذف شود؟',
      okText: 'حذف',
      cancelText: 'انصراف',
      onOk: () =>
        mut((x) => {
          x.steps.splice(i, 1);
          x.items.forEach((it) => {
            if (it.StepNo === i + 1) it.StepNo = 0;
            else if (it.StepNo > i + 1) it.StepNo--;
          });
        }),
    });

  const del = (txt: string) => (fn: () => void) => (
    <Button danger size="small" title={txt} onClick={fn}>
      ×
    </Button>
  );
  const rm = del('حذف');

  /* جدول‌ها */
  const paramCols: TableColumnsType<Param & { i: number }> = [
    { title: 'نام متغیر (بدون فاصله)', render: (_, p) => <Input value={p.key} placeholder="مثلاً L" onChange={(e) => mut((d) => (d.params[p.i].key = e.target.value))} /> },
    { title: 'عنوان نمایشی', render: (_, p) => <Input value={p.label} placeholder="مثلاً طول" onChange={(e) => mut((d) => (d.params[p.i].label = e.target.value))} /> },
    { title: 'مقدار پیش‌فرض', render: (_, p) => <NumInput value={p.default} onChange={(v) => mut((d) => (d.params[p.i].default = v))} /> },
    { title: 'واحد', render: (_, p) => <Input value={p.unit} onChange={(e) => mut((d) => (d.params[p.i].unit = e.target.value))} /> },
    { title: '', width: 50, render: (_, p) => rm(() => mut((d) => void d.params.splice(p.i, 1))) },
  ];

  const itemCols: TableColumnsType<Item & { i: number }> = [
    {
      title: 'ماده / نیمه‌ساخته',
      width: 260,
      render: (_, it) => (
        <Select
          style={{ width: '100%' }}
          showSearch
          optionFilterProp="label"
          placeholder="جستجوی کالا"
          status={!it.ProductID && it.QtyFormula ? 'error' : undefined}
          value={it.ProductID || undefined}
          options={pOpts}
          onChange={(v) => mut((d) => (d.items[it.i].ProductID = v))}
        />
      ),
    },
    { title: 'مقدار (عدد یا فرمول)', width: 190, render: (_, it) => <Input dir="ltr" value={it.QtyFormula} placeholder="2.5 یا طول*عرض" onChange={(e) => mut((d) => (d.items[it.i].QtyFormula = e.target.value))} /> },
    { title: 'واحد', width: 80, render: (_, it) => unit(it.ProductID) },
    { title: 'ضایعات ٪', width: 100, render: (_, it) => <NumInput value={it.WastePct} onChange={(v) => mut((d) => (d.items[it.i].WastePct = v))} /> },
    {
      title: 'مرحلهٔ مصرف',
      width: 170,
      render: (_, it) => (
        <Select
          style={{ width: '100%' }}
          value={it.StepNo}
          options={[{ value: 0, label: 'بدون مرحله' }, ...R.steps.map((s, k) => ({ value: k + 1, label: `${k + 1}. ${s.Name || '—'}` }))]}
          onChange={(v) => mut((d) => (d.items[it.i].StepNo = v))}
        />
      ),
    },
    { title: 'یادداشت', render: (_, it) => <Input value={it.Notes} onChange={(e) => mut((d) => (d.items[it.i].Notes = e.target.value))} /> },
    { title: '', width: 50, render: (_, it) => rm(() => mut((d) => void d.items.splice(it.i, 1))) },
  ];

  const laborCols = (si: number): TableColumnsType<Labor & { j: number }> => [
    {
      title: 'خدمت',
      width: 220,
      render: (_, l) => (
        <Select style={{ width: '100%' }} placeholder="— انتخاب خدمت —" showSearch optionFilterProp="label" value={l.serviceId || undefined} options={svc} onChange={(v) => mut((d) => (d.steps[si].Labor[l.j].serviceId = v))} />
      ),
    },
    { title: 'مقدار (ساعت/تعداد/فرمول)', width: 190, render: (_, l) => <Input dir="ltr" value={l.qty} onChange={(e) => mut((d) => (d.steps[si].Labor[l.j].qty = e.target.value))} /> },
    { title: 'نرخ هر واحد (ریال)', width: 170, render: (_, l) => <NumInput value={l.rate} onChange={(v) => mut((d) => (d.steps[si].Labor[l.j].rate = v))} /> },
    { title: 'توضیح', render: (_, l) => <Input value={l.desc} onChange={(e) => mut((d) => (d.steps[si].Labor[l.j].desc = e.target.value))} /> },
    { title: '', width: 50, render: (_, l) => rm(() => mut((d) => void d.steps[si].Labor.splice(l.j, 1))) },
  ];

  const checkCols = (si: number): TableColumnsType<Check & { j: number }> => [
    { title: 'عنوان کنترل', width: 190, render: (_, c) => <Input value={c.label} placeholder="مثلاً: دمای نهایی" onChange={(e) => mut((d) => (d.steps[si].Checks[c.j].label = e.target.value))} /> },
    {
      title: 'نوع',
      width: 150,
      render: (_, c) => (
        <Select
          style={{ width: '100%' }}
          value={c.type}
          onChange={(v) => mut((d) => (d.steps[si].Checks[c.j].type = v))}
          options={[
            { value: 'number', label: 'عدد (با حدود)' },
            { value: 'yesno', label: 'بله/خیر' },
            { value: 'choice', label: 'انتخابی' },
            { value: 'text', label: 'متن' },
          ]}
        />
      ),
    },
    {
      title: 'حدود / گزینه‌ها',
      render: (_, c) =>
        c.type === 'number' ? (
          <Space wrap>
            <NumInput style={{ width: 90 }} placeholder="کمینه" value={c.min} onChange={(v) => mut((d) => (d.steps[si].Checks[c.j].min = v))} />
            <NumInput style={{ width: 90 }} placeholder="بیشینه" value={c.max} onChange={(v) => mut((d) => (d.steps[si].Checks[c.j].max = v))} />
            <Input style={{ width: 80 }} placeholder="واحد" value={c.unit} onChange={(e) => mut((d) => (d.steps[si].Checks[c.j].unit = e.target.value))} />
          </Space>
        ) : c.type === 'choice' ? (
          <Space wrap>
            <Input style={{ width: 220 }} placeholder="گزینه‌ها با ویرگول: خوب، متوسط، بد" value={c.options} onChange={(e) => mut((d) => (d.steps[si].Checks[c.j].options = e.target.value))} />
            <Input style={{ width: 200 }} placeholder="گزینه‌های ردکننده: بد" value={c.failOptions} onChange={(e) => mut((d) => (d.steps[si].Checks[c.j].failOptions = e.target.value))} />
          </Space>
        ) : c.type === 'yesno' ? (
          <Typography.Text type="secondary">«بله» = قبول، «خیر» = رد</Typography.Text>
        ) : (
          <Typography.Text type="secondary">متن آزاد (فقط ثبت می‌شود)</Typography.Text>
        ),
    },
    { title: 'الزامی', width: 70, align: 'center', render: (_, c) => <Checkbox checked={c.required} onChange={(e) => mut((d) => (d.steps[si].Checks[c.j].required = e.target.checked))} /> },
    {
      title: 'بازدارنده',
      width: 80,
      align: 'center',
      render: (_, c) => <Checkbox title="اگر مقدار خارج از حد باشد، تکمیل سفارش ممکن نمی‌شود" checked={c.blocking} onChange={(e) => mut((d) => (d.steps[si].Checks[c.j].blocking = e.target.checked))} />,
    },
    { title: '', width: 50, render: (_, c) => rm(() => mut((d) => void d.steps[si].Checks.splice(c.j, 1))) },
  ];

  const idx = <T,>(a: T[]) => a.map((x, i) => ({ ...x, i }));
  const idxJ = <T,>(a: T[]) => a.map((x, j) => ({ ...x, j }));

  return (
    <NeedCompany company={company}>
      <Card
        title={R.RecipeID ? 'ویرایش فرمول ساخت' : 'فرمول ساخت جدید'}
        extra={
          <Space>
            <Button onClick={onBack}>← فهرست</Button>
            <Button loading={prevBusy} onClick={() => void preview()}>
              پیش‌نمایش محاسبه
            </Button>
            <Button type="primary" loading={busy} onClick={() => void save()}>
              ذخیره
            </Button>
          </Space>
        }
      >
        <ARow gutter={12}>
          <Col xs={24} md={9}>
            {lab('محصول ساخته‌شده *')}
            <Select
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="label"
              placeholder="نام یا کد کالا را بنویسید و انتخاب کنید"
              value={R.ProductID || undefined}
              options={pOpts}
              onChange={(v) => mut((d) => { d.ProductID = v; if (!d.Name) d.Name = str(pById[v]?.Name); })}
            />
          </Col>
          <Col xs={24} md={7}>
            {lab('نام فرمول')}
            <Input value={R.Name} placeholder="مثلاً: روش استاندارد" onChange={(e) => mut((d) => (d.Name = e.target.value))} />
          </Col>
          <Col xs={12} md={4}>
            {lab(`مقدار پایهٔ خروجی${u ? ` (${u})` : ''} *`)}
            <NumInput title="مقدار موادِ نوشته‌شده در فرمول برای تولید همین مقدار است" value={R.OutputQty} onChange={(v) => mut((d) => (d.OutputQty = v))} />
          </Col>
          <Col xs={12} md={4}>
            {lab('سربار استاندارد هر واحد (ریال)')}
            <NumInput value={R.StdOverhead} onChange={(v) => mut((d) => (d.StdOverhead = v))} />
          </Col>
        </ARow>
        <ARow gutter={12} style={{ marginTop: 12 }}>
          <Col xs={24} md={20}>
            {lab('توضیحات')}
            <Input value={R.Notes} onChange={(e) => mut((d) => (d.Notes = e.target.value))} />
          </Col>
          <Col xs={24} md={4} style={{ display: 'flex', alignItems: 'end' }}>
            <Checkbox checked={R.IsActive} onChange={(e) => mut((d) => (d.IsActive = e.target.checked))}>
              فعال
            </Checkbox>
          </Col>
        </ARow>
        <Collapse
          ghost
          style={{ marginTop: 8 }}
          items={[
            {
              key: 'h',
              label: 'راهنمای نوشتن فرمول مقدار',
              children: (
                <div style={{ lineHeight: 1.9 }}>
                  مقدار هر ماده یا دستمزد می‌تواند عدد ساده (مثل <span dir="ltr">2.5</span>) یا فرمول باشد. <b>فرمول، مقدار مصرف برای «یک سری مبنا» (همان مقدار پایهٔ بالا) است</b> و سیستم برای مقدار سفارش خودش متناسب می‌کند؛ پس ضرب در Q لازم نیست.
                  <br />
                  عملگرها: <span dir="ltr">+ - * / ^ ( )</span> | مقایسه: <span dir="ltr">&lt; &gt; &lt;= &gt;= == !=</span>
                  <br />
                  توابع: <span dir="ltr">min(a,b) max(a,b) ceil(x) floor(x) round(x) abs(x) sqrt(x) pow(a,b) if(شرط, اگر درست, اگر نادرست)</span>
                  <br />
                  متغیرها: <span dir="ltr">Q</span> = مقدار سفارش، و هر «پارامتر» که در جدول زیر تعریف کنید (مثلاً <b>طول</b>، <b>عرض</b>، <b>ضخامت</b>).
                  <br />
                  مثال: ماده‌ی مصرفی = <span dir="ltr">طول*عرض*ضخامت*7.85</span> | مقدار شرطی = <span dir="ltr">if(Q&gt;100, 3, 2)</span>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Card
        title={
          <>
            پارامترها (اختیاری) <Typography.Text type="secondary">ورودی‌هایی که هنگام ثبت سفارش پرسیده می‌شوند، مثل ابعاد، رنگ، دما…</Typography.Text>
          </>
        }
        extra={<Button onClick={() => mut((d) => void d.params.push({ key: '', label: '', default: '0', unit: '' }))}>+ پارامتر</Button>}
      >
        <Table size="small" pagination={false} rowKey="i" dataSource={idx(R.params)} columns={paramCols} locale={{ emptyText: 'پارامتری تعریف نشده است.' }} scroll={{ x: 'max-content' }} />
      </Card>

      <Card title="مواد مصرفی" extra={<Button onClick={() => mut((d) => void d.items.push(emptyItem()))}>+ ماده</Button>}>
        <Table size="small" pagination={false} rowKey="i" dataSource={idx(R.items)} columns={itemCols} scroll={{ x: 'max-content' }} />
      </Card>

      <Card
        title={
          <>
            مراحل تولید <Typography.Text type="secondary">هر مرحله می‌تواند دستمزد و کنترل کیفی داشته باشد</Typography.Text>
          </>
        }
        extra={<Button onClick={() => mut((d) => void d.steps.push(emptyStep()))}>+ مرحله</Button>}
      >
        {!R.steps.length ? <Typography.Text type="secondary">مرحله‌ای تعریف نشده است (اختیاری). اگر فقط مواد را مصرف و محصول را تولید می‌کنید لازم نیست مرحله بسازید.</Typography.Text> : null}
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {R.steps.map((s, i) => (
            <Card key={i} type="inner" size="small" title={`مرحلهٔ ${fmtNum(i + 1)}`} extra={
              <Space>
                <Button size="small" disabled={i === 0} onClick={() => stepMove(i, -1)}>↑</Button>
                <Button size="small" disabled={i >= R.steps.length - 1} onClick={() => stepMove(i, 1)}>↓</Button>
                <Button size="small" danger onClick={() => stepDel(i)}>حذف مرحله</Button>
              </Space>
            }>
              <ARow gutter={12}>
                <Col xs={24} md={10}>
                  {lab('نام مرحله *')}
                  <Input value={s.Name} placeholder="مثلاً: برش" onChange={(e) => mut((d) => (d.steps[i].Name = e.target.value))} />
                </Col>
                <Col xs={12} md={7}>
                  {lab('محل/ایستگاه کار')}
                  <Input value={s.WorkCenter} onChange={(e) => mut((d) => (d.steps[i].WorkCenter = e.target.value))} />
                </Col>
                <Col xs={12} md={7}>
                  {lab('زمان استاندارد (دقیقه)')}
                  <NumInput value={s.StdMinutes} onChange={(v) => mut((d) => (d.steps[i].StdMinutes = v))} />
                </Col>
              </ARow>
              <div style={{ marginTop: 8 }}>
                {lab('دستورالعمل کار')}
                <Input value={s.Instructions} onChange={(e) => mut((d) => (d.steps[i].Instructions = e.target.value))} />
              </div>
              <div style={{ marginTop: 12 }}>
                <Space style={{ marginBottom: 6 }}>
                  <b>دستمزد (از بخش «خدمات»)</b>
                  <Button size="small" onClick={() => mut((d) => void d.steps[i].Labor.push({ serviceId: '', qty: '1', rate: '0', desc: '' }))}>
                    + دستمزد
                  </Button>
                </Space>
                {s.Labor.length ? <Table size="small" pagination={false} rowKey="j" dataSource={idxJ(s.Labor)} columns={laborCols(i)} scroll={{ x: 'max-content' }} /> : null}
                {!svc.length ? <Typography.Paragraph type="secondary">هنوز خدمتی تعریف نشده است؛ از منوی «خدمات» دستمزدها (مثل «ساعت کار اپراتور») را تعریف کنید.</Typography.Paragraph> : null}
              </div>
              <div style={{ marginTop: 12 }}>
                <Space style={{ marginBottom: 6 }} wrap>
                  <b>کنترل‌های کیفی</b>
                  <Typography.Text type="secondary">(وزن، دما، ابعاد، ظاهر، بازرسی…)</Typography.Text>
                  <Button size="small" onClick={() => mut((d) => void d.steps[i].Checks.push(emptyCheck()))}>
                    + کنترل
                  </Button>
                </Space>
                {s.Checks.length ? <Table size="small" pagination={false} rowKey="j" dataSource={idxJ(s.Checks)} columns={checkCols(i)} scroll={{ x: 'max-content' }} /> : null}
              </div>
            </Card>
          ))}
        </Space>
      </Card>

      <Card title="پیش‌نمایش محاسبه">
        <Space wrap align="end">
          <div>
            {lab(`مقدار تولید${u ? ` (${u})` : ''}`)}
            <NumInput value={pv.qty || R.OutputQty} onChange={(v) => setPv((o) => ({ ...o, qty: v }))} />
          </div>
          {R.params
            .filter((p) => p.key)
            .map((p) => (
              <div key={p.key}>
                {lab(p.label || p.key)}
                <NumInput value={pv.vals[p.key] ?? p.default} onChange={(v) => setPv((o) => ({ ...o, vals: { ...o.vals, [p.key]: v } }))} />
              </div>
            ))}
          <Button type="primary" loading={prevBusy} onClick={() => void preview()}>
            محاسبه
          </Button>
        </Space>
        {!prev ? (
          <Typography.Paragraph type="secondary" style={{ marginTop: 10 }}>
            برای دیدن مقدار مواد، دستمزد و بهای تخمینی، «محاسبه» را بزنید. هیچ چیزی ثبت نمی‌شود.
          </Typography.Paragraph>
        ) : (
          <Space direction="vertical" style={{ width: '100%', marginTop: 12 }} size="middle">
            {prev.errors.length ? (
              <div style={{ color: '#cf1322' }}>
                <b>ایرادهای فرمول:</b>
                <ul>{prev.errors.map((z, k) => <li key={k}>{z}</li>)}</ul>
              </div>
            ) : null}
            {prev.materials.length ? (
              <Table<Row>
                size="small"
                pagination={false}
                rowKey={(_, k) => String(k)}
                dataSource={prev.materials}
                scroll={{ x: 'max-content' }}
                columns={[
                  { title: 'ماده', dataIndex: 'Name' },
                  { title: 'مقدار لازم', align: 'right', render: (_, m) => fmtQty(m.qty) },
                  { title: 'واحد', dataIndex: 'Unit' },
                  { title: 'موجودی فعلی', align: 'right', render: (_, m) => <span style={{ color: Number(m.balance) < Number(m.qty) ? '#cf1322' : undefined }}>{fmtQty(m.balance)}</span> },
                  { title: 'بهای واحد', align: 'right', render: (_, m) => fmtNum(m.unitCost) },
                  { title: 'بهای ردیف', align: 'right', render: (_, m) => fmtNum(m.cost) },
                ]}
              />
            ) : null}
            {prev.labor.length ? (
              <Table<Row>
                size="small"
                pagination={false}
                rowKey={(_, k) => String(k)}
                dataSource={prev.labor}
                scroll={{ x: 'max-content' }}
                columns={[
                  { title: 'مرحله', dataIndex: 'step' },
                  { title: 'دستمزد', dataIndex: 'name' },
                  { title: 'مقدار', align: 'right', render: (_, l) => fmtQty(l.qty) },
                  { title: 'نرخ', align: 'right', render: (_, l) => fmtNum(l.rate) },
                  { title: 'مبلغ', align: 'right', render: (_, l) => fmtNum(l.cost) },
                ]}
              />
            ) : null}
            <Space size="large" wrap>
              <Statistic title="مواد" value={fmtNum(prev.cost.material)} />
              <Statistic title="دستمزد" value={fmtNum(prev.cost.labor)} />
              <Statistic title="سربار استاندارد" value={fmtNum(prev.cost.overhead)} />
              <Statistic title="بهای کل" value={fmtNum(prev.cost.total)} />
              <Statistic title="بهای هر واحد" value={fmtNum(prev.cost.unit)} />
            </Space>
            {prev.missingCost ? <Typography.Text type="secondary">برای {fmtNum(prev.missingCost)} ماده هنوز فاکتور خریدی ثبت نشده و بهای آن صفر حساب شد.</Typography.Text> : null}
          </Space>
        )}
      </Card>
    </NeedCompany>
  );
}

/* ---------- مسیر ---------- */
export default function RecipesPage() {
  const { company } = useCompany();
  const { message } = App.useApp();
  const [ed, setEd] = useState<{ rec: Rec; k: number } | null>(null);

  const open = async (id: string, copy = false) => {
    try {
      const r = await csCall<Row>('recipeGet', company, { id });
      const s = fromServer(r);
      if (copy) {
        s.RecipeID = '';
        s.Name = `${s.Name} (کپی)`;
      }
      setEd({ rec: s, k: Date.now() });
    } catch (e) {
      message.error(errorMessage(e));
    }
  };

  return ed ? (
    <RecipeEditor key={ed.k} init={ed.rec} onBack={() => setEd(null)} />
  ) : (
    <RecipeList onOpen={(id) => void open(id)} onCopy={(id) => void open(id, true)} onNew={() => setEd({ rec: newRec(), k: Date.now() })} />
  );
}
