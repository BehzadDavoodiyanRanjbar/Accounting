import { InboxOutlined, SettingOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Alert, Button, Card, Drawer, Space, Select, Table, Tabs, Tag, Typography, Upload } from 'antd';
import type { TableColumnsType } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { callApi, errorMessage } from '../../api/client';
import { useCompany } from '../../api/CompanyContext';
import { fmtNum } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import { NumInput } from '../../kit/NumInput';
import { NeedCompany, useBankAccounts } from '../bank/common';
import { KIND_TITLE, SAMPLE_NAME, emptyInsurance, emptyPayments, emptyPayroll, guessMapping, isSheetFile, parseCsv, paymentsFromGrid, payrollFromGrid, readXlsxSheets, sampleDoc } from './extract';
import type { DocKind, Sheet } from './extract';
import { LegacyFramePage } from '../LegacyFramePage';
import { docFromPages } from './ocr/pipeline';
import { ocrProblem, recognizeFile } from './ocr/engine';
import { matchPerson } from './normalize';
import type { Person } from './normalize';
import { ReviewPanel } from './ReviewPanel';
import { ROLE_LABEL, matchPayRows } from './rules';
import type { AccRole, PayrollDoc, Rates } from './rules';
import { sha256File, sha256Text } from './sha256';
import type { DocInit, QItem, QStatus } from './types';

const { Text, Paragraph } = Typography;

const HELP: Record<DocKind, string> = {
  payroll: 'تصویر یا PDF لیست حقوق، یا فایل Excel/CSV لیست حقوق را بارگذاری کنید. با تأیید شما، سند هزینهٔ حقوق و بدهی‌های پرداختنی (حقوق، بیمه، مالیات) به‌صورت پیش‌نویس ساخته می‌شود و مانده بدهی هر کارمند برای مرحلهٔ پرداخت نگه داشته می‌شود.',
  payment: 'فایل Excel/CSV یا PDF/تصویر واریز بانکی را بارگذاری کنید. هر ردیف با کارمند تطبیق داده می‌شود و از بدهی باز حقوق او کم می‌شود. برای وجود بدهی باز، ابتدا تب «شناسایی هزینهٔ حقوق» را ثبت کنید.',
  insurance: 'فیش واریز یا لیست بیمه (تصویر/PDF) را بارگذاری کنید. مبلغ با بدهی باز بیمهٔ همان دوره تطبیق داده می‌شود و جریمهٔ دیرکرد جدا ثبت می‌شود.',
};
const STATUS: Record<QStatus, { t: string; c: string }> = {
  extracting: { t: 'در حال استخراج', c: 'processing' },
  review: { t: 'نیازمند بررسی', c: 'gold' },
  confirmed: { t: 'تأییدشده', c: 'green' },
  rejected: { t: 'ردشده', c: 'default' },
  duplicate: { t: 'تکراری', c: 'orange' },
  error: { t: 'خطا', c: 'red' },
};
const ACC_ROLES = Object.keys(ROLE_LABEL).filter((r) => r !== 'bank') as AccRole[];
const ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.pdf,.xlsx,.csv';

let seq = 1;

/** ثبت از روی اسکن ← حقوق، پرداخت و بیمه */
export default function DocCapturePage({ initialTab = 'payroll' }: { initialTab?: DocKind | 'other' } = {}) {
  const { company } = useCompany();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [tabSel, setTab] = useState<DocKind | 'other'>(initialTab);
  const [items, setItems] = useState<QItem[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [cfgOpen, setCfgOpen] = useState(false);
  const urls = useRef<string[]>([]);

  const init = useQuery({ queryKey: ['docInit', company], queryFn: () => callApi<DocInit>('docInit', { company }), enabled: !!company });
  const banks = useBankAccounts();
  const accOpts = useCsQuery<{ accounts: Array<{ AccID: string; Code: string; Name: string; Post?: boolean; IsActive?: boolean }> }>('accOptions', {});

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  useEffect(() => setItems([]), [company]);

  const accName = useMemo(() => {
    const m: Record<string, string> = {};
    (accOpts.data?.accounts ?? []).forEach((a) => (m[a.AccID] = `${a.Code} - ${a.Name}`));
    return (id: string) => m[id] ?? '';
  }, [accOpts.data]);

  const patch = (id: number, fn: (q: QItem) => QItem) => setItems((prev) => prev.map((q) => (q.id === id ? fn(q) : q)));
  const people = (): Person[] => (init.data?.employees ?? []).map((e) => ({ key: e.key, name: e.name, nationalCode: e.nationalCode }));

  const matchPayroll = (d: PayrollDoc): PayrollDoc => {
    const pp = people();
    return { ...d, rows: d.rows.map((r) => { const m = matchPerson({ name: r.name, nationalCode: r.nationalCode }, pp); return m && m.auto ? { ...r, personKey: m.person.key } : r; }) };
  };

  const base = (kind: DocKind, fileName: string, mime: string): QItem => ({ id: seq++, kind, fileName, hash: '', status: 'extracting', mime, src: {}, extracted: null, corrections: [] });

  /** سند آمادهٔ بررسی را به صف اضافه می‌کند (نمونه و ورود دستی) */
  const addReady = async (kind: DocKind, fileName: string, doc: PayrollDoc | ReturnType<typeof emptyPayments> | ReturnType<typeof emptyInsurance>, manual: boolean) => {
    const it = base(kind, fileName, '');
    const hash = sha256Text(`${manual ? `manual:${Date.now()}:${seq}` : 'sample'}|${kind}|${JSON.stringify(doc)}`);
    const next: QItem = { ...it, hash, status: 'review', extracted: manual ? null : { sample: true } };
    if (kind === 'payroll') next.payroll = matchPayroll(doc as PayrollDoc);
    else if (kind === 'payment') { const d = doc as ReturnType<typeof emptyPayments>; next.payments = { ...d, rows: matchPayRows(d.rows, people()) }; }
    else next.insurance = doc as ReturnType<typeof emptyInsurance>;
    try {
      const chk = await callApi<{ dupFile: { No: string } | null }>('docCheck', { company, hash, trackingNos: [] });
      if (chk.dupFile) { next.status = 'duplicate'; next.dupInfo = `این داده قبلاً در سند شماره ${chk.dupFile.No} ثبت شده است.`; }
    } catch { /* بررسی تکراری هنگام ثبت در سرور هم انجام می‌شود */ }
    setItems((p) => [next, ...p]);
    setOpenId(next.id);
  };

  const handleFile = async (kind: DocKind, f: File) => {
    const sheetFile = isSheetFile(f);
    const it = base(kind, f.name, f.type);
    setItems((p) => [it, ...p]);
    const fail = (e: unknown) => patch(it.id, (q) => ({ ...q, status: 'error', error: errorMessage(e) }));
    try {
      if (f.size > 15 * 1048576) throw new Error('حجم فایل بیش از ۱۵ مگابایت است.');
      if (!new RegExp(`(${ACCEPT.replace(/\./g, '\\.').replace(/,/g, '|')})$`, 'i').test(f.name)) throw new Error('فرمت پشتیبانی‌نشده است (تصویر، PDF، xlsx یا csv).');
      const hash = await sha256File(f);
      const chk = await callApi<{ dupFile: { No: string; FileName: string } | null }>('docCheck', { company, hash, trackingNos: [] });
      if (chk.dupFile) return patch(it.id, (q) => ({ ...q, hash, status: 'duplicate', dupInfo: `این فایل قبلاً ثبت شده است (سند شماره ${chk.dupFile?.No}، فایل «${chk.dupFile?.FileName}»).` }));
      if (sheetFile) {
        if (kind === 'insurance') throw new Error('برای فیش بیمه، تصویر یا PDF بارگذاری کنید یا «ورود دستی» را بزنید.');
        const sheets: Sheet[] = /\.csv$/i.test(f.name) ? [{ name: 'CSV', rows: parseCsv(await f.text()) }] : await readXlsxSheets(company, f);
        if (!sheets.length) throw new Error('فایل خالی است.');
        const k = kind;
        const ms = sheets.map((s) => guessMapping(s.rows, k));
        const idx = ms.reduce((b, m, i) => (m.confidence > ms[b].confidence ? i : b), 0);
        const m = ms[idx];
        if (kind === 'payroll') { const r = payrollFromGrid(sheets[idx].rows, m); patch(it.id, (q) => ({ ...q, hash, status: 'review', sheets, sheetIdx: idx, mapping: m, src: r.src, payroll: matchPayroll(r.doc) })); }
        else { const r = paymentsFromGrid(sheets[idx].rows, m); patch(it.id, (q) => ({ ...q, hash, status: 'review', sheets, sheetIdx: idx, mapping: m, src: r.src, payments: { ...r.doc, rows: matchPayRows(r.doc.rows, people()) } })); }
      } else {
        /* تصویر / PDF ← OCR با Tesseractِ نصب‌شده روی همین سرور (بدون سرویس بیرونی) */
        const problem = await ocrProblem(/\.pdf$/i.test(f.name) || f.type === 'application/pdf');
        if (problem) throw new Error(problem);
        const pages = await recognizeFile(f, kind === 'insurance' ? '4' : '6', (p, msg) => patch(it.id, (q) => ({ ...q, progress: p, progressMsg: msg })));
        pages.forEach((pg) => urls.current.push(pg.imageUrl));
        const res = docFromPages(kind, pages);
        const common = { hash, status: 'review' as QStatus, pages: pages.map((pg) => ({ imageUrl: pg.imageUrl, origin: pg.origin, conf: pg.conf })), ocrText: res.text, warnings: res.warnings, src: res.src, progress: undefined, progressMsg: undefined, ocrCap: pages.every((pg) => pg.origin === 'pdf-text') ? 0.9 : 0.8, extracted: { ocr: true, conf: res.conf } };
        if (res.payroll) patch(it.id, (q) => ({ ...q, ...common, sheets: [{ name: 'OCR', rows: res.grid }], sheetIdx: 0, mapping: res.mapping, payroll: matchPayroll(res.payroll as PayrollDoc) }));
        else if (res.payments) patch(it.id, (q) => ({ ...q, ...common, sheets: [{ name: 'OCR', rows: res.grid }], sheetIdx: 0, mapping: res.mapping, payments: { ...res.payments!, rows: matchPayRows(res.payments!.rows, people()) } }));
        else if (res.insurance) patch(it.id, (q) => ({ ...q, ...common, insurance: res.insurance }));
        else if (kind === 'payroll') patch(it.id, (q) => ({ ...q, ...common, payroll: emptyPayroll() }));
        else if (kind === 'payment') patch(it.id, (q) => ({ ...q, ...common, payments: emptyPayments() }));
        else patch(it.id, (q) => ({ ...q, ...common, insurance: emptyInsurance() }));
      }
    } catch (e) {
      fail(e);
    }
  };

  const tab: DocKind = tabSel === 'other' ? 'payroll' : tabSel;
  const open = items.find((q) => q.id === openId) ?? null;
  const rows = items.filter((q) => q.kind === tab);
  const countOf = (q: QItem) => q.payroll?.rows.length ?? q.payments?.rows.length ?? (q.insurance ? 1 : 0);

  const qCols: TableColumnsType<QItem> = [
    { title: 'فایل', dataIndex: 'fileName' },
    { title: 'وضعیت', width: 170, render: (_v, q) => <Tag color={STATUS[q.status].c}>{STATUS[q.status].t}{q.status === 'extracting' && q.progressMsg ? ` · ${q.progressMsg}${q.progress ? ` ${Math.round(q.progress * 100)}٪` : ''}` : ''}</Tag> },
    { title: 'ردیف‌ها', width: 80, render: (_v, q) => countOf(q) || '' },
    { title: 'توضیح', render: (_v, q) => (q.status === 'error' ? <Text type="danger">{q.error}</Text> : q.status === 'duplicate' ? <Text type="warning">{q.dupInfo}</Text> : q.voucherNo ? `پیش‌نویس سند شماره ${q.voucherNo}` : '') },
    {
      title: '', width: 220,
      render: (_v, q) => (
        <Space>
          {q.status === 'review' || q.status === 'duplicate' ? <Button type="primary" size="small" onClick={() => setOpenId(q.id)}>بررسی</Button> : null}
          {q.status === 'review' ? <Button size="small" danger onClick={() => patch(q.id, (x) => ({ ...x, status: 'rejected' }))}>رد</Button> : null}
          {q.status !== 'extracting' ? <Button size="small" onClick={() => setItems((p) => p.filter((x) => x.id !== q.id))}>حذف از صف</Button> : null}
        </Space>
      ),
    },
  ];

  const recent = (init.data?.recent ?? []).filter((r) => r.Kind === tab);

  const tabItems = [
    ...(['payroll', 'payment', 'insurance'] as DocKind[]).map((k) => ({ key: k, label: KIND_TITLE[k] })),
    { key: 'other', label: 'سایر اسناد (خرید)' },
  ];
  const tabs = <Tabs activeKey={tabSel} onChange={(k) => setTab(k as DocKind | 'other')} items={tabItems} />;

  if (tabSel === 'other') {
    return (
      <NeedCompany company={company}>
        <Card title="ثبت از روی اسکن · سایر اسناد" extra={<Button icon={<SettingOutlined />} onClick={() => setCfgOpen(true)}>تنظیمات نرخ بیمه و حساب‌ها</Button>}>
          {tabs}
          <Alert type="info" showIcon style={{ marginBottom: 12 }} message="اسکن فاکتور و اسناد خرید در همین تب انجام می‌شود (بخش قبلی «اسکن اسناد خرید»)." />
          <LegacyFramePage view="scan" company={company} />
        </Card>
        <SettingsDrawer open={cfgOpen} onClose={() => setCfgOpen(false)} init={init.data} accounts={(accOpts.data?.accounts ?? []).filter((a) => a.Post !== false && a.IsActive !== false)} />
      </NeedCompany>
    );
  }

  return (
    <NeedCompany company={company}>
      <Card
        title="ثبت از روی اسکن · حقوق، پرداخت و بیمه"
        extra={<Button icon={<SettingOutlined />} onClick={() => setCfgOpen(true)}>تنظیمات نرخ بیمه و حساب‌ها</Button>}
      >
        {tabs}
        <Paragraph type="secondary">{HELP[tab]}</Paragraph>
        <Alert type="info" showIcon style={{ marginBottom: 12 }} message="خروجی این بخش همیشه «پیش‌نویس» سند حسابداری است و تأیید نهایی با شماست. اطلاعات حقوق، اطلاعات شخصی حساس است." />
        <Alert type="success" showIcon style={{ marginBottom: 12 }} message="خواندن تصویر و PDF با OCR داخلی (Tesseract روی همین سرور) انجام می‌شود؛ فایل‌ها به هیچ سرویس بیرونی یا هوش مصنوعی ارسال نمی‌شوند. OCR فارسی خطا دارد؛ همهٔ مقادیر را با تصویر مقایسه کنید." />
        <Upload.Dragger multiple accept={ACCEPT} showUploadList={false} beforeUpload={(f) => { void handleFile(tab, f); return false; }}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">فایل را اینجا رها کنید یا کلیک کنید</p>
          <p className="ant-upload-hint">تصویر، PDF، xlsx یا csv — حداکثر ۱۵ مگابایت</p>
        </Upload.Dragger>
        <Space wrap style={{ marginTop: 12 }}>
          <Button onClick={() => void addReady(tab, tab === 'payroll' ? 'ورود دستی حقوق' : tab === 'payment' ? 'ورود دستی پرداخت' : 'ورود دستی بیمه', tab === 'payroll' ? emptyPayroll() : tab === 'payment' ? emptyPayments() : emptyInsurance(), true)}>ورود دستی</Button>
          {SAMPLE_NAME[tab].map((n, i) => (
            <Button key={n} onClick={() => { const s = sampleDoc(tab, i); void addReady(tab, s.fileName, s.doc as PayrollDoc, false); }}>{n}</Button>
          ))}
        </Space>
      </Card>

      <Card title="صف بررسی">
        <Table<QItem> size="small" rowKey="id" pagination={false} dataSource={rows} columns={qCols} locale={{ emptyText: 'هنوز سندی بارگذاری نشده است.' }} />
      </Card>

      <Card title="ثبت‌های اخیر این بخش">
        <Table
          size="small" rowKey="DCID" pagination={{ pageSize: 8, hideOnSinglePage: true }} dataSource={recent}
          columns={[
            { title: 'تاریخ ثبت', dataIndex: 'CreatedAt', width: 170 },
            { title: 'فایل', dataIndex: 'FileName' },
            { title: 'دوره', dataIndex: 'PeriodKey', width: 90 },
            { title: 'سند', width: 110, render: (_v, r) => (r.VID ? <a onClick={() => nav('/p/ac_list')}>شماره {r.No}</a> : <Text type="secondary">حذف‌شده</Text>) },
            { title: 'وضعیت سند', width: 110, render: (_v, r) => (r.Status === 'draft' ? <Tag color="gold">پیش‌نویس</Tag> : r.Status === 'confirmed' ? <Tag color="green">تأییدشده</Tag> : <Tag>حذف‌شده</Tag>) },
            { title: 'مبلغ سند', width: 130, align: 'end', render: (_v, r) => (r.VID ? fmtNum(r.Total) : '') },
            { title: 'ثبت‌کننده', dataIndex: 'ConfirmedBy', width: 140 },
          ]}
          locale={{ emptyText: 'هنوز ثبتی انجام نشده است.' }}
        />
      </Card>

      {open && init.data ? (
        <ReviewPanel
          key={open.id}
          item={open}
          init={init.data}
          banks={banks.data?.rows ?? []}
          accName={accName}
          onPatch={(fn) => patch(open.id, fn)}
          onClose={() => setOpenId(null)}
          onCreated={() => { void qc.invalidateQueries({ queryKey: ['docInit', company] }); void qc.invalidateQueries({ queryKey: ['csq'] }); }}
        />
      ) : null}

      <SettingsDrawer open={cfgOpen} onClose={() => setCfgOpen(false)} init={init.data} accounts={(accOpts.data?.accounts ?? []).filter((a) => a.Post !== false && a.IsActive !== false)} />
    </NeedCompany>
  );
}

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  init?: DocInit;
  accounts: Array<{ AccID: string; Code: string; Name: string }>;
}

/** تنظیمات: نرخ‌های بیمه (فقط پیش‌فرض قابل‌ویرایش) و نگاشت حساب‌ها */
function SettingsDrawer({ open, onClose, init, accounts }: SettingsProps) {
  const { company } = useCompany();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [rates, setRates] = useState<Rates>({ employee: 7, employer: 20, unemployment: 3 });
  const [acc, setAcc] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open && init) {
      setRates(init.settings.rates);
      setAcc({ ...init.settings.acc });
    }
  }, [open, init]);

  const save = async () => {
    setBusy(true);
    try {
      await callApi('docSettingsSave', { company, settings: { rates, acc } });
      await qc.invalidateQueries({ queryKey: ['docInit', company] });
      message.success('تنظیمات ذخیره شد.');
      onClose();
    } catch (e) {
      message.error(errorMessage(e), 6);
    } finally {
      setBusy(false);
    }
  };
  const opts = accounts.map((a) => ({ value: a.AccID, label: `${a.Code} - ${a.Name}` }));
  const rate = (k: keyof Rates, label: string) => (
    <div style={{ marginBottom: 12 }}>
      <div>{label} (٪)</div>
      <NumInput value={rates[k]} onChange={(v) => setRates((r) => ({ ...r, [k]: Number(v) || 0 }))} />
    </div>
  );
  return (
    <Drawer open={open} onClose={onClose} width={460} title="تنظیمات ثبت از روی اسکن" footer={<Button type="primary" loading={busy} onClick={save}>ذخیره</Button>}>
      <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="پیش‌فرض‌ها را با حسابدار تأیید کنید" description="نرخ‌ها فقط مقدار پیش‌فرض قابل‌ویرایش‌اند. اگر سند، سهم کارفرما را خودش چاپ کرده باشد، مقدار سند اعمال می‌شود." />
      {rate('employee', 'سهم بیمه کارمند')}
      {rate('employer', 'سهم بیمه کارفرما')}
      {rate('unemployment', 'بیمه بیکاری (هزینهٔ کارفرما)')}
      <Typography.Title level={5}>حساب‌های سند</Typography.Title>
      {ACC_ROLES.map((r) => (
        <div key={r} style={{ marginBottom: 12 }}>
          <div>{ROLE_LABEL[r]}</div>
          <Select style={{ width: '100%' }} showSearch optionFilterProp="label" value={acc[r] || undefined} options={opts} onChange={(v) => setAcc((a) => ({ ...a, [r]: v }))} placeholder="انتخاب حساب معین" />
        </div>
      ))}
      <Text type="secondary">حساب بانک از «حساب بانک/صندوق» انتخابی هر سند برداشته می‌شود.</Text>
    </Drawer>
  );
}
