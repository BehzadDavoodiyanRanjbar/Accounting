import { App, Button, Card, Col, Descriptions, Input, Modal, Row as ARow, Select, Space, Spin, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { csCall } from '../../api/costService';
import { useCompany } from '../../api/CompanyContext';
import { NumInput } from '../../kit/NumInput';
import { fmtNum, str, todayJalali } from '../../kit/format';
import type { Row } from '../../kit/types';
import { NeedCompany } from '../bank/common';
import { printOrder } from './orderPrint';
import { PSTC, PST_COLOR, STST, ckState, costCalc, n0, orderPayload } from './common';

const badge = (s: string) => <Tag color={PST_COLOR[PSTC[s]] ?? 'default'}>{s}</Tag>;
const ckTag = (st: string) =>
  st === 'ok' ? <Tag color="success">✓ مطابق</Tag> : st === 'fail' ? <Tag color="error">✗ خارج از حد</Tag> : st === 'missing' ? <Tag color="warning">الزامی</Tag> : null;
const lab = (t: string) => <div style={{ fontSize: 12, color: '#667085', marginBottom: 2 }}>{t}</div>;

export default function OrderPage({ id }: { id: string }) {
  const { company, data } = useCompany();
  const { message, modal } = App.useApp();
  const nav = useNavigate();
  const [po, setPo] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [comp, setComp] = useState<{ qty: string; date: string } | null>(null);
  const [exp, setExp] = useState<{ rows: Row[]; id: string; amount: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setPo(await csCall<Row>('prodGet', company, { id }));
    } catch (e) {
      message.error(errorMessage(e));
    }
  }, [company, id, message]);
  useEffect(() => {
    setPo(null);
    void load();
  }, [load]);

  const mut = (fn: (c: Row) => void) =>
    setPo((p) => {
      if (!p) return p;
      const c = JSON.parse(JSON.stringify(p)) as Row;
      fn(c);
      return c;
    });
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) message.success(ok);
      return true;
    } catch (e) {
      message.error(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!po)
    return (
      <NeedCompany company={company}>
        <Spin />
      </NeedCompany>
    );

  const o = po.order as Row;
  const ed = !!o.editable;
  const steps = po.steps as Row[];
  const mats = po.materials as Row[];
  const ovh = po.overheads as Row[];
  const cfg = (po.cfg ?? { fields: [] }) as Row;
  const rparams = (po.recipeParams ?? []) as Row[];
  const cost = o.Status === 'تکمیل‌شده' ? (po.cost as Row) : costCalc(po);
  const companyName = str(((data?.companies ?? []) as Row[]).find((c) => c.CompanyID === company)?.Name);

  const save = async (quiet = false) => {
    const ok = await run(() => csCall('prodSave', company, orderPayload(company, po, str(o.DateJalali))), quiet ? undefined : 'ذخیره شد.');
    if (ok) await load();
    return ok;
  };
  const status = async (to: string, ok: string, extra: Row = {}) => {
    const r = await run(() => csCall('prodStatus', company, { id: o.OrderID, to, ...extra }), ok);
    if (r) await load();
    return r;
  };
  const recompute = () =>
    modal.confirm({
      title: 'محاسبهٔ مجدد از فرمول',
      content: 'مواد و دستمزدها دوباره از فرمول (با پارامترهای فعلی) محاسبه می‌شود و تغییرات دستی مواد از بین می‌رود. ادامه؟',
      okText: 'ادامه',
      cancelText: 'انصراف',
      onOk: async () => {
        if (await run(() => csCall('prodSave', company, orderPayload(company, po, str(o.DateJalali), { recompute: true })), 'از فرمول محاسبه شد.')) await load();
      },
    });
  const cancel = () =>
    modal.confirm({ title: 'این سفارش لغو شود؟', okText: 'لغو سفارش', okButtonProps: { danger: true }, cancelText: 'انصراف', onOk: () => status('cancel', 'سفارش لغو شد.') });
  const reopen = () =>
    modal.confirm({
      title: 'بازگشایی سفارش',
      content: o.Status === 'تکمیل‌شده' ? 'سفارش به حالت «در حال تولید» برمی‌گردد و اثر آن از موجودی برداشته می‌شود. ادامه؟' : 'سفارش به پیش‌نویس برمی‌گردد. ادامه؟',
      okText: 'بازگشایی',
      cancelText: 'انصراف',
      onOk: () => status('reopen', 'بازگشایی شد.'),
    });
  const child = async (rid: string, short: number) => {
    const ok = await run(async () => {
      const r = await csCall<Row>('prodCreate', company, { recipeId: rid, qty: short, parentId: o.OrderID, saleId: o.SaleID, date: o.DateJalali });
      message.success(`سفارش ${r.OrderNo} ساخته شد.`);
      try {
        await csCall('prodSave', company, orderPayload(company, po, str(o.DateJalali)));
      } catch {
        /* ذخیرهٔ خودکار اختیاری است */
      }
    });
    if (ok) await load();
  };

  const shortMats = mats.filter((m) => Number(m.short) > 0);
  const openSteps = steps.filter((s) => s.Status !== 'انجام شد').length;
  const startComplete = async () => {
    if (!(await save(true))) return;
    setComp({ qty: str(o.ActualQty !== '' ? o.ActualQty : o.PlannedQty), date: todayJalali() });
  };
  const completeGo = async (force: boolean) => {
    if (!comp) return;
    setBusy(true);
    try {
      const r = await csCall<Row>('prodStatus', company, { id: o.OrderID, to: 'complete', ActualQty: comp.qty, doneDate: comp.date, force });
      setComp(null);
      message.success('تولید تکمیل شد و موجودی به‌روز شد.' + (r.warnings?.length ? ' ' + (r.warnings as string[]).join(' ') : ''));
      await load();
    } catch (e) {
      const m = errorMessage(e);
      if (/^STEPS:/.test(m))
        modal.confirm({ title: 'مراحل ناتمام', content: `${m.replace('STEPS:', '')} — با این حال تکمیل شود؟`, okText: 'تکمیل شود', cancelText: 'انصراف', onOk: () => completeGo(true) });
      else message.error(m);
    } finally {
      setBusy(false);
    }
  };

  const openExpense = async () => {
    try {
      const r = await csCall<{ rows: Row[] }>('expenseList', company, { open: true, noYear: true });
      if (!r.rows.length) {
        message.warning('فاکتور هزینه‌ی دارای مانده‌ی قابل تخصیص وجود ندارد. از منوی «فاکتور هزینه» ثبت کنید.');
        return;
      }
      setExp({ rows: r.rows, id: str(r.rows[0].ExpenseID), amount: str(r.rows[0].Remaining) });
    } catch (e) {
      message.error(errorMessage(e));
    }
  };
  const expRow = exp?.rows.find((x) => x.ExpenseID === exp.id);
  const expAdd = () => {
    if (!exp || !expRow) return;
    const a = n0(exp.amount);
    if (!(a > 0)) {
      message.warning('مبلغ را وارد کنید.');
      return;
    }
    mut((c) => (c.overheads as Row[]).push({ ExpenseID: expRow.ExpenseID, DocNo: expRow.DocNo, Category: expRow.Category, Description: expRow.Description, Amount: a }));
    setExp(null);
  };

  const matCols: TableColumnsType<Row> = [
    { title: 'ماده', dataIndex: 'Name' },
    { title: 'مرحله', render: (_, m) => str(steps[Number(m.StepNo) - 1]?.Name) || '—' },
    {
      title: 'مقدار برنامه',
      render: (_, m, i) => <NumInput style={{ width: 110 }} disabled={!ed} value={m.PlannedQty} onChange={(v) => mut((c) => ((c.materials as Row[])[i].PlannedQty = v))} />,
    },
    {
      title: 'مصرف واقعی',
      render: (_, m, i) => <NumInput style={{ width: 110 }} disabled={!ed} placeholder="= برنامه" value={m.ActualQty} onChange={(v) => mut((c) => ((c.materials as Row[])[i].ActualQty = v))} />,
    },
    { title: 'واحد', dataIndex: 'Unit' },
    { title: 'موجودی فعلی', align: 'right', render: (_, m) => <span style={{ color: Number(m.short) > 0 ? '#cf1322' : undefined, fontWeight: Number(m.short) > 0 ? 700 : undefined }}>{fmtNum(m.balance, 3)}</span> },
    { title: 'بهای واحد', align: 'right', render: (_, m) => fmtNum(m.UnitCost) },
    { title: 'بهای ردیف', align: 'right', render: (_, m) => fmtNum(m.Cost) },
    {
      title: '',
      render: (_, m) =>
        Number(m.short) > 0 ? (
          <Space>
            <span style={{ color: '#cf1322' }}>کمبود {fmtNum(m.short, 3)}</span>
            {m.hasRecipe && m.recipeId && ed ? (
              <Button size="small" onClick={() => child(str(m.recipeId), Number(m.short))}>
                ساخت سفارش نیمه‌ساخته
              </Button>
            ) : null}
          </Space>
        ) : null,
    },
  ];

  const stepCard = (s: Row, i: number) => (
    <Card
      key={i}
      size="small"
      style={{ marginBottom: 10, borderInlineStart: `4px solid ${s.Status === 'انجام شد' ? '#12b76a' : s.Status === 'در حال انجام' ? '#2e90fa' : '#d0d5dd'}` }}
      title={
        <span>
          {i + 1}. {str(s.Name)} {s.WorkCenter ? <small style={{ color: '#667085' }}>({str(s.WorkCenter)})</small> : null}
        </span>
      }
      extra={
        <Space wrap>
          <Select
            style={{ width: 130 }}
            disabled={!ed}
            value={str(s.Status)}
            onChange={(v) => mut((c) => ((c.steps as Row[])[i].Status = v))}
            options={STST.map((x) => ({ value: x, label: x }))}
          />
          <NumInput
            style={{ width: 150 }}
            disabled={!ed}
            placeholder={s.StdMinutes ? `استاندارد ${fmtNum(s.StdMinutes)} دقیقه` : 'زمان واقعی (دقیقه)'}
            value={s.ActualMinutes}
            onChange={(v) => mut((c) => ((c.steps as Row[])[i].ActualMinutes = v))}
          />
        </Space>
      }
    >
      {s.Instructions ? <Typography.Paragraph type="secondary">{str(s.Instructions)}</Typography.Paragraph> : null}
      {(s.Labor as Row[]).length ? (
        <Table<Row>
          size="small"
          bordered
          pagination={false}
          rowKey={(_, j) => String(j)}
          dataSource={s.Labor as Row[]}
          columns={[
            { title: 'دستمزد (خدمت)', render: (_, z) => <span>{str(z.name)} {z.desc ? <small style={{ color: '#667085' }}>{str(z.desc)}</small> : null}</span> },
            { title: 'مقدار (ساعت/واحد)', render: (_, z, j) => <NumInput style={{ width: 110 }} disabled={!ed} value={z.qty} onChange={(v) => mut((c) => (((c.steps as Row[])[i].Labor as Row[])[j].qty = v))} /> },
            { title: 'نرخ (ریال)', render: (_, z, j) => <NumInput style={{ width: 130 }} disabled={!ed} value={z.rate} onChange={(v) => mut((c) => (((c.steps as Row[])[i].Labor as Row[])[j].rate = v))} /> },
            { title: 'مبلغ', align: 'right', render: (_, z) => fmtNum(n0(z.qty) * n0(z.rate)) },
          ]}
        />
      ) : null}
      {(s.Checks as Row[]).length ? (
        <div style={{ marginTop: 8 }}>
          <Typography.Text type="secondary">کنترل‌های کیفی</Typography.Text>
          {(s.Checks as Row[]).map((c, k) => {
            const setV = (v: string) => mut((x) => (((x.steps as Row[])[i].Checks as Row[])[k].value = v));
            const hasMin = String(c.min ?? '') !== '';
            const hasMax = String(c.max ?? '') !== '';
            let inp;
            if (c.type === 'number')
              inp = (
                <Space>
                  <NumInput style={{ width: 120 }} disabled={!ed} value={c.value} onChange={setV} />
                  <small style={{ color: '#667085' }}>
                    {str(c.unit)}
                    {hasMin || hasMax ? ` (مجاز: ${hasMin ? str(c.min) : '…'} تا ${hasMax ? str(c.max) : '…'})` : ''}
                  </small>
                </Space>
              );
            else if (c.type === 'yesno')
              inp = (
                <Select style={{ width: 120 }} disabled={!ed} allowClear value={str(c.value) || undefined} onChange={(v) => setV(v ?? '')} options={[{ value: 'yes', label: 'بله' }, { value: 'no', label: 'خیر' }]} />
              );
            else if (c.type === 'choice')
              inp = <Select style={{ width: 180 }} disabled={!ed} allowClear value={str(c.value) || undefined} onChange={(v) => setV(v ?? '')} options={((c.options ?? []) as string[]).map((x) => ({ value: x, label: x }))} />;
            else inp = <Input style={{ width: 220 }} disabled={!ed} value={str(c.value)} onChange={(e) => setV(e.target.value)} />;
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ minWidth: 170 }}>
                  {str(c.label)} {c.required ? <b style={{ color: '#cf1322' }}>*</b> : null}
                  {c.blocking ? <small style={{ color: '#667085' }} title="در صورت خارج بودن از حد، تکمیل تولید ممکن نیست"> (بازدارنده)</small> : null}
                </span>
                {inp}
                {ckTag(ckState(c))}
              </div>
            );
          })}
        </div>
      ) : null}
      <Input style={{ marginTop: 8 }} placeholder="یادداشت مرحله" disabled={!ed} value={str(s.Notes)} onChange={(e) => mut((c) => ((c.steps as Row[])[i].Notes = e.target.value))} />
    </Card>
  );

  return (
    <NeedCompany company={company}>
      <Card size="small">
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Typography.Title level={5} style={{ margin: 0 }}>
            سفارش تولید {str(o.OrderNo)} — {str(o.Product)} {badge(str(o.Status))}
          </Typography.Title>
          <Space wrap>
            <Button onClick={() => nav('/p/po')}>← فهرست</Button>
            {o.Status === 'پیش‌نویس' ? (
              <Button type="primary" loading={busy} onClick={() => status('start', 'تولید شروع شد.')}>
                شروع تولید
              </Button>
            ) : null}
            {ed ? (
              <>
                <Button loading={busy} onClick={() => save()}>
                  ذخیره
                </Button>
                <Button style={{ background: '#12b76a', color: '#fff', borderColor: '#12b76a' }} loading={busy} onClick={startComplete}>
                  تأیید تکمیل تولید…
                </Button>
                <Button danger onClick={cancel}>
                  لغو سفارش
                </Button>
              </>
            ) : null}
            {o.Status === 'تکمیل‌شده' || o.Status === 'لغو' ? <Button onClick={reopen}>بازگشایی</Button> : null}
            <Button onClick={() => !printOrder(po, companyName) && message.error('مرورگر تب جدید را مسدود کرد.')}>چاپ برگه‌ی تولید</Button>
          </Space>
        </Space>
        {o.SaleID || o.ParentOrderID ? (
          <Typography.Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
            {o.SaleID ? <span>برای فروش شماره <b>{str(o.SaleSerial)}</b></span> : null}
            {o.SaleID && o.ParentOrderID ? ' | ' : null}
            {o.ParentOrderID ? (
              <span>
                نیمه‌ساخته‌ی سفارش <a onClick={() => nav(`/p/po?id=${encodeURIComponent(str(o.ParentOrderID))}`)}>{str(o.ParentNo)}</a>
              </span>
            ) : null}
          </Typography.Paragraph>
        ) : null}
        <ARow gutter={12} style={{ marginTop: 10 }}>
          <Col xs={12} md={6}>
            {lab('تاریخ سفارش')}
            <Input disabled={!ed} value={str(o.DateJalali)} onChange={(e) => mut((c) => ((c.order as Row).DateJalali = e.target.value.trim()))} />
          </Col>
          <Col xs={12} md={6}>
            {lab(`مقدار برنامه‌ریزی (${str(o.Unit)})`)}
            <NumInput disabled={!ed} value={o.PlannedQty} onChange={(v) => mut((c) => ((c.order as Row).PlannedQty = v))} />
          </Col>
          <Col xs={12} md={6}>
            {lab(`تولید واقعی (${str(o.Unit)})`)}
            <NumInput disabled={!ed} placeholder="هنگام تکمیل" value={o.ActualQty} onChange={(v) => mut((c) => ((c.order as Row).ActualQty = v))} />
          </Col>
          <Col xs={12} md={6}>
            {lab('فرمول ساخت')}
            <Input disabled value={str(o.RecipeName)} />
          </Col>
          {o.DoneJalali ? (
            <Col xs={12} md={6}>
              {lab('تاریخ تکمیل')}
              <Input disabled value={str(o.DoneJalali)} />
            </Col>
          ) : null}
        </ARow>
        {rparams.length ? (
          <ARow gutter={12} style={{ marginTop: 8 }} align="bottom">
            {rparams.map((p) => (
              <Col key={str(p.key)} xs={12} md={6}>
                {lab(`${str(p.label || p.key)}${p.unit ? ` (${str(p.unit)})` : ''}`)}
                <NumInput disabled={!ed} value={(o.Params as Row)?.[str(p.key)] ?? p.default} onChange={(v) => mut((c) => (((c.order as Row).Params ??= {})[str(p.key)] = v))} />
              </Col>
            ))}
            {ed ? (
              <Col>
                <Button onClick={recompute} title="مقدار مواد و دستمزد را دوباره از فرمول با پارامترهای بالا حساب می‌کند (ویرایش‌های دستی مواد از بین می‌رود)">
                  محاسبه‌ی مجدد از فرمول
                </Button>
              </Col>
            ) : null}
          </ARow>
        ) : null}
        {((cfg.fields ?? []) as Row[]).length ? (
          <ARow gutter={12} style={{ marginTop: 8 }}>
            {((cfg.fields ?? []) as Row[]).map((f) => {
              const v = (o.Extra as Row)?.[str(f.key)] ?? '';
              const set = (x: string) => mut((c) => (((c.order as Row).Extra ??= {})[str(f.key)] = x));
              return (
                <Col key={str(f.key)} xs={12} md={6}>
                  {lab(`${str(f.label)}${f.required ? ' *' : ''}`)}
                  {f.type === 'choice' ? (
                    <Select style={{ width: '100%' }} disabled={!ed} allowClear value={str(v) || undefined} onChange={(x) => set(x ?? '')} options={((f.options ?? []) as string[]).map((x) => ({ value: x, label: x }))} />
                  ) : f.type === 'number' ? (
                    <NumInput disabled={!ed} value={v} onChange={set} />
                  ) : (
                    <Input disabled={!ed} value={str(v)} onChange={(e) => set(e.target.value)} />
                  )}
                </Col>
              );
            })}
          </ARow>
        ) : null}
        <div style={{ marginTop: 8 }}>
          {lab('توضیحات')}
          <Input disabled={!ed} value={str(o.Notes)} onChange={(e) => mut((c) => ((c.order as Row).Notes = e.target.value))} />
        </div>
      </Card>

      <Card size="small" title="مراحل تولید">
        {steps.length ? steps.map(stepCard) : <Typography.Text type="secondary">برای این فرمول مرحله‌ای تعریف نشده است.</Typography.Text>}
      </Card>

      <Card size="small" title="مواد مصرفی">
        <Table<Row> size="small" bordered pagination={false} columns={matCols} dataSource={mats} rowKey={(_, i) => String(i)} scroll={{ x: 'max-content' }} />
      </Card>

      <Card
        size="small"
        title="سربار"
        extra={
          ed ? (
            <Space>
              <Button size="small" onClick={openExpense}>
                + از فاکتور هزینه
              </Button>
              <Button size="small" onClick={() => mut((c) => (c.overheads as Row[]).push({ ExpenseID: '', Description: '', Amount: '' }))}>
                + سربار دستی
              </Button>
            </Space>
          ) : null
        }
      >
        {ovh.length ? (
          <Table<Row>
            size="small"
            bordered
            pagination={false}
            rowKey={(_, i) => String(i)}
            dataSource={ovh}
            columns={[
              { title: 'منبع', render: (_, z) => (z.ExpenseID ? `فاکتور هزینه ${str(z.DocNo)} (${str(z.Category)})` : 'دستی') },
              { title: 'شرح', render: (_, z, i) => <Input disabled={!ed} value={str(z.Description)} onChange={(e) => mut((c) => ((c.overheads as Row[])[i].Description = e.target.value))} /> },
              { title: 'مبلغ (ریال)', render: (_, z, i) => <NumInput style={{ width: 150 }} disabled={!ed} value={z.Amount} onChange={(v) => mut((c) => ((c.overheads as Row[])[i].Amount = v))} /> },
              { title: '', render: (_, __, i) => (ed ? <Button size="small" danger onClick={() => mut((c) => (c.overheads as Row[]).splice(i, 1))}>×</Button> : null) },
            ]}
          />
        ) : (
          <Typography.Text type="secondary">سربار ثبت نشده است (برق، اجاره و ... را از «فاکتور هزینه» تخصیص دهید).</Typography.Text>
        )}
      </Card>

      <ARow gutter={12}>
        <Col xs={24} md={12}>
          <Card size="small" title="بهای تمام‌شده">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="مواد مصرفی">{fmtNum(cost.material)}</Descriptions.Item>
              <Descriptions.Item label="دستمزد (از خدمات)">{fmtNum(cost.labor)}</Descriptions.Item>
              <Descriptions.Item label="سربار">{fmtNum(cost.overhead)}</Descriptions.Item>
              <Descriptions.Item label={<b>بهای کل تولید</b>}><b>{fmtNum(cost.total)}</b></Descriptions.Item>
              <Descriptions.Item label={`بهای هر واحد ${str(o.Unit)} (${o.ActualQty !== '' && n0(o.ActualQty) > 0 ? 'بر اساس تولید واقعی' : 'بر اساس مقدار برنامه'})`}>{fmtNum(cost.unit)}</Descriptions.Item>
            </Descriptions>
            {(po.cost as Row)?.missing?.length && o.Status !== 'تکمیل‌شده' ? (
              <Typography.Paragraph style={{ color: '#b54708', marginTop: 8 }}>قیمت خرید ثبت‌نشده برای: {((po.cost as Row).missing as string[]).join('، ')} (بهای آن‌ها صفر حساب شد)</Typography.Paragraph>
            ) : null}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card size="small" title="اثر روی موجودی">
            <Typography.Paragraph style={{ margin: 0 }} type="secondary">
              {o.Status === 'تکمیل‌شده' ? (
                <>این سفارش تکمیل شده است: مواد بالا از موجودی کم و <b>{fmtNum(o.ActualQty, 3)} {str(o.Unit)}</b> «{str(o.Product)}» به موجودی اضافه شده است.</>
              ) : (
                'تا «تأیید تکمیل تولید» موجودی تغییری نمی‌کند. با تأیید شما، مصرف واقعی مواد از موجودی کم و تولید واقعی به موجودی محصول اضافه می‌شود.'
              )}
            </Typography.Paragraph>
            {((po.children ?? []) as Row[]).length ? (
              <div style={{ marginTop: 10 }}>
                <b>سفارش‌های نیمه‌ساخته</b>
                {(po.children as Row[]).map((c) => (
                  <div key={str(c.OrderID)}>
                    <a onClick={() => nav(`/p/po?id=${encodeURIComponent(str(c.OrderID))}`)}>{str(c.OrderNo)}</a> — {str(c.Product)} ({fmtNum(c.Qty, 3)}) {badge(str(c.Status))}
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        </Col>
      </ARow>

      <Modal
        open={!!comp}
        title={`تأیید تکمیل تولید — ${str(o.OrderNo)}`}
        onCancel={() => setComp(null)}
        okText="تأیید می‌کنم، تولید انجام شده است"
        cancelText="انصراف"
        confirmLoading={busy}
        onOk={() => completeGo(false)}
        width={640}
      >
        {comp ? (
          <>
            <p>با تأیید شما موجودی به این شکل تغییر می‌کند:</p>
            <Table<Row>
              size="small"
              bordered
              pagination={false}
              rowKey={(_, i) => String(i)}
              columns={[
                { title: 'کالا', dataIndex: 'name' },
                { title: 'تغییر موجودی', render: (_, r) => <span style={{ color: r.up ? '#12b76a' : '#cf1322' }}>{r.up ? '+' : '−'} {fmtNum(r.qty, 3)} {str(r.unit)} {r.short ? <b>(موجودی کافی نیست)</b> : null}</span> },
              ]}
              dataSource={[
                { name: o.Product, up: true, qty: n0(comp.qty), unit: o.Unit },
                ...mats.map((m) => ({ name: m.Name, up: false, qty: n0(m.ActualQty === '' ? m.PlannedQty : m.ActualQty), unit: m.Unit, short: Number(m.short) > 0 })),
              ]}
            />
            <ARow gutter={12} style={{ marginTop: 10 }}>
              <Col span={12}>
                {lab(`مقدار تولید واقعی (${str(o.Unit)})`)}
                <NumInput value={comp.qty} onChange={(v) => setComp({ ...comp, qty: v })} />
              </Col>
              <Col span={12}>
                {lab('تاریخ تکمیل')}
                <Input value={comp.date} onChange={(e) => setComp({ ...comp, date: e.target.value.trim() })} />
              </Col>
            </ARow>
            {openSteps ? <p style={{ color: '#b54708', marginTop: 8 }}>⚠ {fmtNum(openSteps)} مرحله هنوز «انجام شد» نیست.</p> : null}
            {shortMats.length ? <p style={{ color: '#b54708' }}>⚠ موجودی {fmtNum(shortMats.length)} ماده کافی نیست؛ پس از تکمیل، موجودی آن‌ها منفی می‌شود (می‌توانید اول سفارش نیمه‌ساخته یا فاکتور خرید ثبت کنید).</p> : null}
          </>
        ) : null}
      </Modal>

      <Modal open={!!exp} title="تخصیص فاکتور هزینه به این سفارش" onCancel={() => setExp(null)} onOk={expAdd} okText="افزودن" cancelText="انصراف">
        {exp ? (
          <>
            {lab('فاکتور هزینه')}
            <Select
              style={{ width: '100%' }}
              value={exp.id}
              onChange={(v) => setExp({ ...exp, id: v, amount: str(exp.rows.find((x) => x.ExpenseID === v)?.Remaining) })}
              options={exp.rows.map((x) => ({ value: str(x.ExpenseID), label: `${str(x.DocNo)} — ${str(x.Category)} — مانده ${fmtNum(x.Remaining)}` }))}
            />
            <div style={{ marginTop: 8 }}>
              {lab('مبلغ تخصیص (ریال)')}
              <NumInput value={exp.amount} onChange={(v) => setExp({ ...exp, amount: v })} />
            </div>
            {expRow ? <Typography.Paragraph type="secondary" style={{ marginTop: 6 }}>مانده‌ی قابل تخصیص: {fmtNum(expRow.Remaining)} ریال (از {fmtNum(expRow.CostBase)})</Typography.Paragraph> : null}
          </>
        ) : null}
      </Modal>
    </NeedCompany>
  );
}
