import { App, Alert, Button, Card, Checkbox, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { useCompany } from '../../api/CompanyContext';
import { fmtNum, fmtQty, str } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import type { Row } from '../../kit/types';
import { NeedCompany, num, useBankCall } from '../bank/common';
import { setSelectedFy } from './common';
import { NumInput } from '../../kit/NumInput';

const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

interface YearRow {
  sy: number;
  fj: string;
  tj: string;
  title: string;
  status: string;
  dirty?: boolean;
  vouchers: number;
  drafts?: number;
  profit?: number | '';
  current?: boolean;
  closedAt?: string;
  canClose?: boolean;
  canReopen?: boolean;
}
interface YearList {
  rows: YearRow[];
  active: number;
  month: number;
  taxRate: number | string;
  reservePct: number | string;
  capPct: number | string;
  canChangeMonth: boolean;
}
interface Check {
  year: { title: string };
  range: { fj: string; tj: string; nj: string };
  blockers?: string[];
  warns?: string[];
  calc: { profitBeforeTax: number; taxExisting: number; profit: number; capital: number; reserve: number };
  suggest: { tax: number; reserve: number };
  balancing?: { items: Row[]; unmapped: Row[] };
  negStock?: Row[];
  notes?: string[];
  infos?: string[];
}

const List = ({ items, color }: { items?: string[]; color?: string }) =>
  items && items.length ? (
    <ul style={{ margin: '4px 0', paddingInlineStart: 20, color }}>
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  ) : null;

/** سال مالی و بستن حساب‌ها */
export default function FiscalYearPage() {
  const { company, me } = useCompany();
  const isAdmin = me?.role === 'admin';
  const { message, modal, notification } = App.useApp();
  const nav = useNavigate();
  const call = useBankCall();
  const q = useCsQuery<YearList>('yearList', {});
  const d = q.data;
  const [month, setMonth] = useState('1');
  const [tax, setTax] = useState('');
  const [res, setRes] = useState('');
  const [cap, setCap] = useState('');
  const [chk, setChk] = useState<{ sy: number; c: Check } | null>(null);

  useEffect(() => {
    if (d) {
      setMonth(String(d.month ?? 1));
      setTax(str(d.taxRate));
      setRes(str(d.reservePct));
      setCap(str(d.capPct));
    }
  }, [d]);

  const fail = (title: string) => (e: unknown) => notification.error({ message: title, description: errorMessage(e) });

  const saveCfg = async () => {
    try {
      const o: Row = { taxRate: tax, reservePct: res, capPct: cap };
      if (d?.canChangeMonth) o.month = month;
      await call('yearSave', o);
      message.success('تنظیمات ذخیره شد.');
    } catch (e) {
      fail('ذخیره انجام نشد')(e);
    }
  };

  const startClose = async (sy: number) => {
    try {
      const c = await call('yearCheck', { sy, taxRate: tax, reservePct: res, capPct: cap });
      setChk({ sy, c: c as unknown as Check });
    } catch (e) {
      fail('بررسی بستن سال انجام نشد')(e);
    }
  };

  const reclose = (y: YearRow) =>
    modal.confirm({
      title: 'بستن مجدد',
      content: 'سال مالی برای اصلاح دوباره باز می‌شود (اسناد اختتامیه/افتتاحیه، سند توازن و تعدیل موجودی این سال و سال‌های بعدِ ویرایش‌شده حذف می‌شوند) و سپس پنجرهٔ بستن سال نمایش داده می‌شود. ادامه می‌دهید؟',
      okText: 'ادامه',
      cancelText: 'انصراف',
      onOk: async () => {
        try {
          await call('yearOpen', { sy: y.sy });
          await startClose(y.sy);
        } catch (e) {
          fail('انجام نشد')(e);
        }
      },
    });

  const reopen = (y: YearRow) =>
    modal.confirm({
      title: 'باز کردن مجدد سال مالی',
      content: 'سال مالی باز شود؟ اسناد اختتامیه و افتتاحیهٔ این سال حذف می‌شوند و باید بعد از اصلاح، دوباره سال را ببندید.',
      okText: 'باز شود',
      okButtonProps: { danger: true },
      cancelText: 'انصراف',
      onOk: async () => {
        try {
          const r = await call('yearOpen', { sy: y.sy });
          message.success(`${str(r.title)} دوباره باز شد (${str(r.removed)} سند سیستمی حذف شد${r.adjRemoved ? `، ${str(r.adjRemoved)} تعدیل موجودی برگشت` : ''}).`);
        } catch (e) {
          fail('انجام نشد')(e);
        }
      },
    });

  const dirty = (d?.rows ?? []).filter((y) => y.dirty);

  const cols: TableColumnsType<YearRow> = [
    { title: 'سال مالی', key: 't', render: (_, y) => <span><b>{y.title}</b> {y.current ? <Tag color="blue">جاری</Tag> : null}</span> },
    { title: 'از تاریخ', dataIndex: 'fj' },
    { title: 'تا تاریخ', dataIndex: 'tj' },
    {
      title: 'وضعیت',
      key: 's',
      render: (_, y) =>
        y.status === 'closed' ? (
          <span>
            {y.dirty ? <Tag color="red">بسته‌شده — ویرایش‌شده، نیازمند بستن مجدد</Tag> : <Tag color="green">بسته‌شده</Tag>} <Typography.Text type="secondary">{str(y.closedAt).substring(0, 16)}</Typography.Text>
          </span>
        ) : (
          <Tag>باز</Tag>
        ),
    },
    { title: 'تعداد سند', dataIndex: 'vouchers' },
    { title: 'پیش‌نویس', key: 'dr', render: (_, y) => (y.drafts ? <b style={{ color: '#cf1322' }}>{y.drafts}</b> : 0) },
    { title: 'سود (زیان) خالص', key: 'p', render: (_, y) => (y.profit === '' || y.profit == null ? '' : fmtNum(y.profit)) },
    {
      title: '',
      key: 'a',
      render: (_, y) => (
        <Space wrap size={4}>
          <Button size="small" onClick={() => nav(`/p/ac_list?fy=${y.sy}`)}>اسناد این سال</Button>
          {y.status === 'open' && y.canClose && y.vouchers > 0 ? <Button size="small" type="primary" onClick={() => void startClose(y.sy)}>بستن سال مالی</Button> : null}
          {y.status === 'closed' && y.dirty && isAdmin ? <Button size="small" type="primary" onClick={() => reclose(y)}>بستن مجدد</Button> : null}
          {y.status === 'closed' && y.canReopen && isAdmin ? <Button size="small" danger onClick={() => reopen(y)}>باز کردن مجدد</Button> : null}
          <Button size="small" onClick={() => { setSelectedFy(company, String(y.sy)); message.success('این سال برای گزارش‌ها انتخاب شد.'); }}>مشاهدهٔ این سال</Button>
        </Space>
      ),
    },
  ];

  return (
    <NeedCompany company={company}>
      {dirty.length ? (
        <Alert type="error" showIcon message="هشدار سال مالی" description={`اطلاعات ${dirty.map((y) => `«${y.title}»`).join('، ')} پس از بسته‌شدن ویرایش شده است؛ اسناد اختتامیه/افتتاحیه و ارقام سال‌های بعد تا زمان «بستن مجدد» قابل اتکا نیستند.`} />
      ) : null}
      <Card>
        <Typography.Title level={3} style={{ margin: 0 }}>سال مالی و بستن حساب‌ها</Typography.Title>
        <Typography.Paragraph type="secondary" style={{ margin: '6px 0 0' }}>
          در پایان هر سال مالی، سود و زیان سال بسته می‌شود، مانده‌ی حساب‌های ترازنامه‌ای با «سند اختتامیه» بسته می‌شود و همان مانده‌ها با «سند افتتاحیه» در اولین روز سال بعد باز می‌شود. شماره‌ی اسناد هر سال از ۱ شروع می‌شود (شماره ارجاع دائمی و پیوسته است).
        </Typography.Paragraph>
      </Card>
      {q.isError ? <Alert type="error" showIcon message={errorMessage(q.error)} /> : null}
      <Card title="تنظیمات سال مالی این شرکت">
        <Space wrap align="end">
          <label>ماه شروع سال مالی<br /><Select style={{ width: 150 }} value={month} disabled={!d?.canChangeMonth} onChange={setMonth} options={MONTHS.map((n, i) => ({ value: String(i + 1), label: n }))} /></label>
          <label>نرخ مالیات عملکرد برای پیشنهاد (٪)<br /><Input style={{ width: 170 }} value={tax} onChange={(e) => setTax(e.target.value)} /></label>
          <label>درصد اندوختهٔ قانونی (٪ سود خالص)<br /><NumInput style={{ width: 190 }} value={res} onChange={(v) => setRes(v)} /></label>
          <label>سقف اندوخته (٪ سرمایه)<br /><Input style={{ width: 150 }} value={cap} onChange={(e) => setCap(e.target.value)} /></label>
          <Button type="primary" onClick={() => void saveCfg()}>ذخیره تنظیمات</Button>
        </Space>
        <Typography.Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
          {d?.canChangeMonth ? 'ماه شروع سال را فقط تا پیش از بستن اولین سال می‌توان عوض کرد (پیش‌فرض: فروردین).' : 'ماه شروع سال به‌دلیل وجود سال بسته‌شده قابل تغییر نیست.'} نرخ‌ها فقط برای «پیشنهاد» هستند و باید با قانون و آخرین بخشنامهٔ همان سال تطبیق داده شوند؛ مبلغ نهایی را هنگام بستن می‌توانید ویرایش کنید.
        </Typography.Paragraph>
      </Card>
      <Card>
        <Table<YearRow> size="small" rowKey="sy" loading={q.isFetching} columns={cols} dataSource={d?.rows ?? []} pagination={false} scroll={{ x: 'max-content' }} />
      </Card>
      <Card title="ترتیب کار پیشنهادی در پایان سال">
        <ol style={{ margin: 0, paddingInlineStart: 20, lineHeight: 1.9 }}>
          <li>همهٔ فاکتورها، دریافت‌ها و پرداخت‌ها و اسناد دستی سال را ثبت و پیش‌نویس‌ها را تأیید کنید.</li>
          <li>استهلاک دارایی‌ها، سود تقسیمی و سایر اسناد تعدیلی را (در صورت لزوم) با سند دستی ثبت کنید. (استهلاک در این نسخه خودکار نیست.)</li>
          <li>تراز آزمایشی و ترازنامه را بررسی کنید؛ پیش از بستن از اطلاعات پشتیبان بگیرید.</li>
          <li>«بستن سال مالی» را بزنید، مبلغ ذخیرهٔ مالیات و اندوخته را بازبینی و تأیید کنید.</li>
          <li>اگر اشتباهی دیدید، مدیر سیستم می‌تواند سال بسته را «باز کند» یا برای اصلاح «بستن مجدد» بزند.</li>
        </ol>
      </Card>
      {chk ? <CloseWizard sy={chk.sy} c={chk.c} onClose={() => setChk(null)} onDone={() => setChk(null)} /> : null}
    </NeedCompany>
  );
}

function CloseWizard({ sy, c, onClose, onDone }: { sy: number; c: Check; onClose: () => void; onDone: () => void }) {
  const { message, notification } = App.useApp();
  const call = useBankCall();
  const [tax, setTax] = useState(String(c.suggest.tax ?? 0));
  const [rsv, setRsv] = useState(String(c.suggest.reserve ?? 0));
  const [okBal, setOkBal] = useState(false);
  const [okStock, setOkStock] = useState(false);
  const [okBackup, setOkBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const B = c.balancing ?? { items: [], unmapped: [] };
  const NS = c.negStock ?? [];
  const bl = c.blockers ?? [];
  const net = Math.round((c.calc.profit - num(tax)) * 100) / 100;

  const submit = async () => {
    if (B.items.length && !okBal) return void message.warning('برای ادامه باید اجازهٔ صدور «سند توازن» را تأیید کنید.');
    if (NS.length && !okStock) return void message.warning('برای ادامه باید تعدیل مانده‌ی منفی موجودی را تأیید کنید.');
    if (!okBackup) return void message.warning('ابتدا کادر تأیید پشتیبان‌گیری را علامت بزنید.');
    setBusy(true);
    try {
      const r = await call('yearClose', { sy, tax: num(tax), reserve: num(rsv), confirm: true, balance: B.items.length > 0, stockFix: NS.length > 0 });
      notification.success({ message: `${str(r.title)} بسته شد`, description: `${str(r.vouchers)} سند ساخته شد${r.balanced ? ' (شامل سند توازن)' : ''}${r.stockAdj ? ` و ${str(r.stockAdj)} کالا تعدیل شد` : ''}. سود (زیان) خالص: ${fmtNum(r.profit)}`, duration: 0 });
      onDone();
    } catch (e) {
      notification.error({ message: 'بستن سال انجام نشد', description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const simple = (rows: Row[], cols: Array<[string, (x: Row) => string]>) => (
    <Table size="small" pagination={false} rowKey={(_, i) => String(i)} dataSource={rows} columns={cols.map(([title, f]) => ({ title, key: title, render: (_: unknown, x: Row) => f(x) }))} />
  );

  return (
    <Modal open title={`بستن ${c.year.title}`} onCancel={onClose} width={900} footer={null} destroyOnClose>
      <Typography.Paragraph type="secondary">از {c.range.fj} تا {c.range.tj} — سند افتتاحیه در {c.range.nj} ساخته می‌شود.</Typography.Paragraph>
      {bl.length ? <Alert type="error" showIcon message="موانع (تا برطرف نشود سال بسته نمی‌شود)" description={<List items={bl} />} style={{ marginBottom: 8 }} /> : null}
      {c.warns?.length ? <Alert type="warning" showIcon message="هشدارها" description={<List items={c.warns} />} style={{ marginBottom: 8 }} /> : null}
      <Table
        size="small"
        pagination={false}
        showHeader={false}
        rowKey="k"
        style={{ marginBottom: 8 }}
        dataSource={[
          { k: 'a', t: 'سود (زیان) قبل از مالیات', v: c.calc.profitBeforeTax },
          { k: 'b', t: 'مالیات عملکرد ثبت‌شده تا الان', v: c.calc.taxExisting },
          { k: 'c', t: 'سود (زیان) خالص فعلی', v: c.calc.profit },
          { k: 'd', t: 'سرمایه (حساب ۵۱۰۱)', v: c.calc.capital },
          { k: 'e', t: 'اندوختهٔ قانونی فعلی (حساب ۵۲۰۱)', v: c.calc.reserve },
        ]}
        columns={[{ dataIndex: 't' }, { dataIndex: 'v', align: 'end', render: (v: number) => <b>{fmtNum(v)}</b> }]}
      />
      {B.items.length || B.unmapped.length ? (
        <Card size="small" title="مانده‌هایی که ماهیت برعکس دارند (سند توازن)" style={{ marginBottom: 8 }}>
          <Typography.Paragraph type="secondary">مثلاً حساب دریافتنی که در پایان سال مانده‌ی بستانکار دارد، باید به حساب بدهی منتقل شود تا ترازنامه درست نمایش داده شود.</Typography.Paragraph>
          {simple(
            [...B.items, ...B.unmapped.map((x) => ({ ...x, _bad: true }))],
            [
              ['حساب', (x) => `${str(x.code)} - ${str(x.accName)}`],
              ['شخص / تفصیلی', (x) => str(x.who)],
              ['مانده', (x) => str(x.side)],
              ['مبلغ', (x) => fmtNum(x.amount)],
              ['انتقال به حساب', (x) => (x._bad ? `قابل اصلاح خودکار نیست (${str(x.why)}) — با سند دستی اصلاح کنید` : `${str(x.toCode)} - ${str(x.toName)}`)],
            ],
          )}
          {B.items.length ? <Checkbox checked={okBal} onChange={(e) => setOkBal(e.target.checked)} style={{ marginTop: 8 }}>اجازه می‌دهم «سند توازن» صادر شود و این مانده‌ها به حساب مقابل منتقل شوند.</Checkbox> : null}
        </Card>
      ) : null}
      {NS.length ? (
        <Card size="small" title="کالاهای دارای مانده‌ی منفی" style={{ marginBottom: 8 }}>
          <Typography.Paragraph type="secondary">مانده‌ی منفی کالا به سال بعد منتقل نمی‌شود. با «تعدیل موجودی» در تاریخ پایان سال، مقدار منفی صفر می‌شود (اثر آن روی سود و مالیات همین سال قرار می‌گیرد). بهتر است پیش از ادامه، خرید یا تولید ثبت‌نشده را وارد کنید.</Typography.Paragraph>
          {simple(NS, [['کالا', (x) => str(x.name)], ['کد', (x) => str(x.code)], ['واحد', (x) => str(x.unit)], ['مانده', (x) => fmtQty(x.qty)]])}
          <Checkbox checked={okStock} onChange={(e) => setOkStock(e.target.checked)} style={{ marginTop: 8 }}>اجازه می‌دهم مانده‌ی منفی این کالاها با سند تعدیل صفر شود.</Checkbox>
        </Card>
      ) : null}
      <Space wrap align="end">
        <label>ذخیرهٔ مالیات عملکرد که ثبت شود (ریال)<br /><Input style={{ width: 220 }} value={tax} onChange={(e) => setTax(e.target.value)} /></label>
        <label>انتقال به اندوختهٔ قانونی (ریال)<br /><Input style={{ width: 220 }} value={rsv} onChange={(e) => setRsv(e.target.value)} /></label>
      </Space>
      <Typography.Paragraph style={{ margin: '8px 0' }}>
        سود (زیان) خالص پس از ثبت این ذخیره: <b>{fmtNum(net)}</b> — پس از انتقال به اندوخته، سود انباشتهٔ افزوده‌شده: <b>{fmtNum(Math.round((net - num(rsv)) * 100) / 100)}</b>
      </Typography.Paragraph>
      {(c.notes ?? []).map((n, i) => <Typography.Paragraph key={i} type="secondary" style={{ margin: '2px 0' }}>{n}</Typography.Paragraph>)}
      <List items={c.infos} />
      <Checkbox checked={okBackup} onChange={(e) => setOkBackup(e.target.checked)} style={{ display: 'block', margin: '8px 0' }}>
        از اطلاعات پشتیبان گرفته‌ام و می‌دانم بعد از بستن، ثبت یا ویرایش هر سندی در این سال ممکن نیست (مگر با «باز کردن مجدد» توسط مدیر سیستم).
      </Checkbox>
      <Space>
        {bl.length ? null : <Button type="primary" loading={busy} onClick={() => void submit()}>بستن سال و ساخت سند افتتاحیه</Button>}
        <Button onClick={onClose}>انصراف</Button>
      </Space>
    </Modal>
  );
}
