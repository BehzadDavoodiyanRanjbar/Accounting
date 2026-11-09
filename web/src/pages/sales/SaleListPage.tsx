import { useQueryClient } from '@tanstack/react-query';
import { App, Alert, Button, Card, Input, Modal, Progress, Select, Space, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { callApi, errorMessage } from '../../api/client';
import { useCompany } from '../../api/CompanyContext';
import { downloadCsv } from '../../kit/exporter';
import type { ExportCol } from '../../kit/exporter';
import { fmtNum, str, todayJalali } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import type { Opt, Row } from '../../kit/types';
import { DateBox, NeedCompany, isOn } from '../bank/common';
import { useFyRange } from '../accounting/common';
import { DocPayments } from './DocPayments';
import { SLCQ, SLP, SLS, SLST, SLT, docPayFromServer, docPayToServer } from './constants';
import type { DocPay } from './constants';
import { RangePrintModal } from '../print/RangePrintModal';
import { printSale, printSales } from './salePrint';

const sgn = (x: Row) => (Number(x.Ins) === 4 ? -1 : 1);
const ok = (x: Row) => String(x.Superseded) !== '1' && Number(x.Ins) !== 3 && x.SendStatus !== 'ردشده';
const act = (r: Row) => r.IsActive === undefined || isOn(r.IsActive);
const toOpts = (m: Record<string, string>): Opt[] => Object.entries(m).map(([value, label]) => ({ value, label }));
const money = (v: number) => <span style={{ color: v < 0 ? '#cf1322' : undefined }}>{fmtNum(v)}</span>;

interface STot {
  count: number;
  sales: number;
  returns: number;
  skipped: number;
  tadis: number;
  tvam: number;
  tbill: number;
}
const sumOf = (a: Row[]): STot => {
  const t: STot = { count: 0, sales: 0, returns: 0, skipped: 0, tadis: 0, tvam: 0, tbill: 0 };
  a.forEach((x) => {
    if (!ok(x)) {
      t.skipped++;
      return;
    }
    const s = sgn(x);
    t.count++;
    if (s < 0) t.returns++;
    else t.sales++;
    t.tadis += s * (Number(x.Tadis) || 0);
    t.tvam += s * (Number(x.Tvam) || 0);
    t.tbill += s * (Number(x.Tbill) || 0);
  });
  t.tadis = Math.round(t.tadis * 100) / 100;
  t.tvam = Math.round(t.tvam * 100) / 100;
  t.tbill = Math.round(t.tbill * 100) / 100;
  return t;
};

interface Job {
  title: string;
  action: string;
  ids: string[];
  summarize: (S: Record<string, number>) => string;
  /** پس از اتمام: دکمهٔ ادامه برای بقیهٔ شناسه‌ها */
  rest?: string[];
}

/** اجرای دسته‌ای (ارسال/استعلام) با نوار پیشرفت؛ هر بار ۵۰ مورد */
function BatchModal({ job, onClose, onContinue }: { job: Job | null; onClose: () => void; onContinue: (j: Job) => void }) {
  const [done, setDone] = useState(0);
  const [finished, setFinished] = useState(false);
  const [text, setText] = useState('آماده‌سازی...');
  const [bad, setBad] = useState<string[]>([]);
  const [stat, setStat] = useState<Record<string, number>>({});
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!job) return;
    let stop = false;
    setDone(0);
    setFinished(false);
    setBad([]);
    setStat({});
    setErr('');
    setText('آماده‌سازی...');
    (async () => {
      const S: Record<string, number> = {};
      const badL: string[] = [];
      let i = 0;
      const n = job.ids.length;
      try {
        while (i < n && !stop) {
          setText(`در حال پردازش ${Math.min(i + 50, n)} از ${n} ...`);
          const r = await callApi<Row>(job.action, { ids: job.ids.slice(i, i + 50) });
          const rs = (r.results ?? {}) as Record<string, Row>;
          Object.keys(rs).forEach((id) => {
            const x = rs[id];
            const k = str(x.state) || (x.ok ? 'sent' : x.keep ? 'kept' : 'failed');
            S[k] = (S[k] || 0) + 1;
            if (x.error || (x.msg && k !== 'ok' && k !== 'wait')) badL.push(`${id}: ${str(x.error || x.msg)}`);
          });
          i += 50;
          setDone(Math.min(i, n));
        }
        if (!stop) {
          setStat(S);
          setBad(badL);
          setText(`پایان. ${job.summarize(S)}`);
          setFinished(true);
        }
      } catch (e) {
        if (!stop) setErr(`توقف: ${errorMessage(e)}${i ? ` (تا اینجا ${i} مورد انجام شده است)` : ''}`);
      }
    })();
    return () => {
      stop = true;
    };
  }, [job]);

  const clean = !(stat.failed || stat.kept);
  return (
    <Modal open={!!job} title={job?.title} footer={null} onCancel={onClose} maskClosable={false} width={640}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Progress percent={job && job.ids.length ? Math.round((done / job.ids.length) * 100) : 0} />
        {err ? <Alert type="error" showIcon message={err} /> : <Typography.Text>{text}</Typography.Text>}
        {bad.length ? (
          <Alert type="warning" showIcon message="موارد دارای مشکل" description={<ul style={{ margin: 0, paddingInlineStart: 20, maxHeight: 240, overflow: 'auto' }}>{bad.slice(0, 100).map((z, i) => <li key={i}>{z}</li>)}</ul>} />
        ) : null}
        {finished && job?.rest?.length ? (
          clean ? (
            <Button type="primary" onClick={() => onContinue({ ...job, title: 'ارسال بقیهٔ صورتحساب‌ها', ids: job.rest ?? [], rest: undefined })}>ادامهٔ ارسال {job.rest.length} مورد باقی‌مانده</Button>
          ) : (
            <Alert type="error" message="همهٔ موارد بدون خطا ارسال نشد؛ ادامهٔ خودکار انجام نمی‌شود. ابتدا خطاهای بالا را بررسی کنید." />
          )
        ) : null}
        <Button onClick={onClose}>بستن</Button>
      </Space>
    </Modal>
  );
}

/** فهرست فاکتورهای فروش و ارسال به سامانهٔ مؤدیان */
export default function SaleListPage() {
  const { company, data } = useCompany();
  const [rp, setRp] = useState(false);
  const { message, modal, notification } = App.useApp();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState<Row>({ from: '', to: '', customer: '', pattern: '', subject: '', status: '', serial: '' });
  const [applied, setApplied] = useState<Row>(f);
  const [sel, setSel] = useState<string[]>([]);
  /* به‌طور پیش‌فرض فقط فاکتورهای سال مالی انتخاب‌شده (سال جاری) نمایش داده می‌شود؛ برای دیدن همه، تاریخ‌ها را پاک کنید */
  const fyReady = useFyRange((from, to) => {
    if (!from || !to) return;
    setF((o) => ({ ...o, from, to }));
    setApplied((o) => ({ ...o, from, to }));
    setSel([]);
  });
  const q = useCsQuery<{ rows: Row[]; total: number; totals: STot }>('listSales', applied, fyReady);
  const env = useCsQuery<{ env: string }>('moInfo', {});
  const rows = useMemo(() => q.data?.rows ?? [], [q.data]);
  const T = q.data?.totals;
  const set = (k: string, v: string) => setF((o) => ({ ...o, [k]: v }));
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['csq'] }), qc.invalidateQueries({ queryKey: ['cs'] })]);
  const fail = (t: string) => (e: unknown) => notification.error({ message: t, description: errorMessage(e) });

  const [job, setJob] = useState<Job | null>(null);
  const [json, setJson] = useState<{ id: string; r: Row } | null>(null);
  const [status, setStatus] = useState<Row | null>(null);
  const [stForm, setStForm] = useState({ status: '', taxNo: '', ref: '', error: '' });
  const [rcv, setRcv] = useState<{ row: Row; pays: DocPay[]; total: number } | null>(null);
  const [rcvBusy, setRcvBusy] = useState(false);
  const [s2p, setS2p] = useState<Row | null>(null);
  const [s2pRun, setS2pRun] = useState<{ done: number; n: number; res?: Record<string, number> } | null>(null);

  const customers: Opt[] = (data?.customers ?? []).filter((c) => c.CompanyID === company && act(c)).map((c) => ({ value: str(c.CustomerID), label: str(c.Name) }));
  const cname = (id: unknown) => str((data?.customers ?? []).find((c) => str(c.CustomerID) === str(id))?.Name);
  const envText = env.data?.env === 'prod' ? 'محیط واقعی' : env.data?.env ? 'محیط آزمایشی' : '';

  const selRows = rows.filter((r) => sel.includes(str(r.SaleID)));
  const selT = selRows.length ? sumOf(selRows) : null;

  const finishJob = () => {
    setJob(null);
    void refresh();
  };

  const sendAll = () => {
    const ids = rows.filter((x) => x.SendStatus === 'آماده ارسال').map((x) => str(x.SaleID));
    if (!ids.length) return void message.info('موردی برای این عملیات در فهرست نیست.');
    const sm = (S: Record<string, number>) => `ارسال‌شده: ${S.sent || 0} | ردشده: ${S.failed || 0} | نیازمند تلاش مجدد: ${S.kept || 0}. برای نتیجهٔ نهایی، چند لحظه بعد «استعلام ارسال‌شده‌ها» را بزنید.`;
    if (ids.length > 5) {
      modal.confirm({
        title: 'ارسال به سامانهٔ مؤدیان',
        width: 560,
        content: `${ids.length} صورتحساب آماده ارسال است (${envText}). برای ایمنی، ابتدا فقط ۳ مورد ارسال می‌شود. اگر هر ۳ مورد بدون خطا ارسال شد، می‌توانید بقیه را با یک دکمه ادامه دهید. ادامه می‌دهید؟`,
        okText: 'ارسال ۳ مورد اول',
        cancelText: 'انصراف',
        onOk: () => setJob({ title: 'ارسال آزمایشی ۳ مورد اول', action: 'moSend', ids: ids.slice(0, 3), summarize: sm, rest: ids.slice(3) }),
      });
      return;
    }
    modal.confirm({
      title: 'ارسال به سامانهٔ مؤدیان',
      content: `${ids.length} صورتحساب به سامانهٔ مؤدیان ارسال می‌شود (${envText}). ادامه می‌دهید؟`,
      okText: 'ارسال',
      okButtonProps: { danger: env.data?.env === 'prod' },
      cancelText: 'انصراف',
      onOk: () => setJob({ title: 'ارسال به سامانهٔ مؤدیان', action: 'moSend', ids, summarize: sm }),
    });
  };
  const inquireSum = (S: Record<string, number>) => `تأییدشده: ${S.ok || 0} | ردشده: ${S.fail || 0} | هنوز در حال پردازش: ${S.wait || 0} | نامشخص: ${S.unknown || 0}`;
  const inquireAll = () => {
    const ids = rows.filter((x) => x.SendStatus === 'ارسال‌شده').map((x) => str(x.SaleID));
    if (!ids.length) return void message.info('موردی برای این عملیات در فهرست نیست.');
    setJob({ title: 'استعلام وضعیت از سامانه', action: 'moInquire', ids, summarize: inquireSum });
  };
  const sendOne = (id: string) => setJob({ title: 'ارسال به سامانهٔ مؤدیان', action: 'moSend', ids: [id], summarize: (S) => `ارسال‌شده: ${S.sent || 0} | ردشده: ${S.failed || 0} | نیازمند تلاش مجدد: ${S.kept || 0}` });
  const inquireOne = (id: string) => setJob({ title: 'استعلام وضعیت', action: 'moInquire', ids: [id], summarize: inquireSum });

  const download = (name: string, obj: unknown) => {
    const b = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  };
  const jsonAll = async () => {
    const ready = rows.filter((x) => x.SendStatus === 'آماده ارسال');
    if (!ready.length) return void message.info('صورتحساب «آماده ارسال» در فهرست نیست.');
    try {
      const a = await Promise.all(ready.map((x) => callApi<Row>('saleJson', { id: str(x.SaleID) })));
      download(`invoices-${ready.length}.json`, a.map((z) => z.json));
      message.success(`${ready.length} صورتحساب در یک فایل ذخیره شد.`);
    } catch (e) {
      fail('ساخت JSON انجام نشد')(e);
    }
  };
  const openJson = async (id: string) => {
    try {
      setJson({ id, r: await callApi<Row>('saleJson', { id }) });
    } catch (e) {
      fail('ساخت JSON انجام نشد')(e);
    }
  };
  const openStatus = (x: Row) => {
    setStatus(x);
    setStForm({ status: str(x.SendStatus), taxNo: str(x.TaxNo), ref: str(x.SendRef), error: str(x.SendError) });
  };
  const saveStatus = async () => {
    if (!status) return;
    try {
      await callApi('saleStatus', { id: str(status.SaleID), status: stForm.status, taxNo: stForm.taxNo, ref: stForm.ref, error: stForm.error });
      setStatus(null);
      message.success('ثبت شد.');
      await refresh();
    } catch (e) {
      fail('ثبت انجام نشد')(e);
    }
  };
  const del = (x: Row) =>
    modal.confirm({
      title: 'حذف صورتحساب',
      content: 'این صورتحساب برای همیشه حذف می‌شود. ادامه می‌دهید؟',
      okText: 'حذف',
      okButtonProps: { danger: true },
      cancelText: 'انصراف',
      onOk: async () => {
        try {
          await callApi('deleteSale', { id: str(x.SaleID) });
          message.success('حذف شد.');
          await refresh();
        } catch (e) {
          fail('حذف انجام نشد')(e);
        }
      },
    });
  const amend = (x: Row, ins: 2 | 3) =>
    modal.confirm({
      title: ins === 3 ? 'ابطال صورتحساب' : 'اصلاح صورتحساب',
      content: `یک صورتحساب «${ins === 3 ? 'ابطال' : 'اصلاح'}ی» جدید با مرجع این صورتحساب ساخته می‌شود (هنوز ارسال نمی‌شود). ادامه می‌دهید؟`,
      okText: 'ادامه',
      cancelText: 'انصراف',
      onOk: () => nav(`/p/sale?amend=${encodeURIComponent(str(x.SaleID))}&ins=${ins}`),
    });

  const openReceipts = async (x: Row) => {
    try {
      const z = await callApi<Row>('docPayGet', { company, type: 'sale', id: str(x.SaleID) });
      setRcv({ row: x, pays: ((z.payments ?? []) as Row[]).map(docPayFromServer), total: Number(x.Tbill) || 0 });
    } catch (e) {
      fail('بارگذاری انجام نشد')(e);
    }
  };
  const saveReceipts = async () => {
    if (!rcv) return;
    setRcvBusy(true);
    try {
      await callApi('docPaySave', { company, type: 'sale', id: str(rcv.row.SaleID), payments: rcv.pays.map(docPayToServer) });
      setRcv(null);
      message.success('ذخیره شد.');
      await refresh();
    } catch (e) {
      fail('ذخیره انجام نشد')(e);
    } finally {
      setRcvBusy(false);
    }
  };

  const openS2p = async () => {
    try {
      const r = await callApi<Row>('salesToPurchase', { ...applied, company, preview: true });
      setS2pRun(null);
      setS2p(r);
    } catch (e) {
      fail('بررسی انجام نشد')(e);
    }
  };
  const runS2p = async () => {
    if (!s2p) return;
    const ids = ((s2p.ids ?? []) as string[]).slice();
    const n = ids.length;
    const tot: Record<string, number> = { converted: 0, dup: 0, skipped: 0, newSuppliers: 0 };
    const imp = `S2P-${Date.now()}`;
    setS2pRun({ done: 0, n });
    try {
      while (ids.length) {
        const ch = ids.splice(0, 30);
        const r = await callApi<Row>('salesToPurchase', { company, ids: ch, importId: imp });
        Object.keys(tot).forEach((k) => (tot[k] += Number(r[k]) || 0));
        setS2pRun({ done: n - ids.length, n });
      }
      setS2pRun({ done: n, n, res: tot });
      await Promise.all([refresh(), qc.invalidateQueries({ queryKey: ['bootstrap'] })]);
    } catch (e) {
      setS2pRun(null);
      fail('تبدیل انجام نشد')(e);
    }
  };

  const ex: ExportCol<Row>[] = [
    { title: 'سریال', value: (x) => x.SerialNo },
    { title: 'تاریخ', value: (x) => x.DateJalali },
    { title: 'مشتری', value: (x) => cname(x.CustomerID) },
    { title: 'الگو', value: (x) => SLP[str(x.Inp)] ?? x.Inp },
    { title: 'نوع', value: (x) => SLT[str(x.Inty)] },
    { title: 'موضوع', value: (x) => SLS[str(x.Ins)] },
    { title: 'پیش از مالیات', value: (x) => sgn(x) * (Number(x.Tadis) || 0), numeric: true },
    { title: 'مالیات', value: (x) => sgn(x) * (Number(x.Tvam) || 0), numeric: true },
    { title: 'مجموع', value: (x) => sgn(x) * (Number(x.Tbill) || 0), numeric: true },
    { title: 'وضعیت', value: (x) => x.SendStatus },
    { title: 'شماره مالیاتی', value: (x) => x.TaxNo },
  ];
  const exportRows = (only: boolean) => {
    const l = only ? selRows : rows;
    const t = only && selT ? selT : T;
    downloadCsv(`sales-${todayJalali().replace(/\//g, '-')}`, ex, l, t ? { SerialNo: `جمع (${t.count} صورتحساب)`, Tadis: t.tadis, Tvam: t.tvam, Tbill: t.tbill, Ins: 1 } : undefined, ['برگشت از فروش با علامت منفی؛ موارد کنارگذاشته، ابطال و ردشده در جمع نمی‌آیند.']);
  };

  const cols: TableColumnsType<Row> = [
    { title: 'سریال', dataIndex: 'SerialNo', width: 90 },
    { title: 'تاریخ', dataIndex: 'DateJalali', width: 100 },
    { title: 'مشتری', key: 'c', render: (_, x) => cname(x.CustomerID) },
    { title: 'الگو', key: 'p', render: (_, x) => `${SLP[str(x.Inp)] ?? str(x.Inp)} (${SLT[str(x.Inty)] ?? ''})` },
    { title: 'موضوع', key: 's', render: (_, x) => <span>{SLS[str(x.Ins)]}{String(x.Superseded) === '1' ? ' - کنارگذاشته' : ''}</span> },
    { title: 'پیش از مالیات', key: 'a', align: 'end', render: (_, x) => money(sgn(x) * (Number(x.Tadis) || 0)) },
    { title: 'مالیات', key: 'v', align: 'end', render: (_, x) => money(sgn(x) * (Number(x.Tvam) || 0)) },
    { title: 'مجموع', key: 't', align: 'end', render: (_, x) => money(sgn(x) * (Number(x.Tbill) || 0)) },
    { title: 'وضعیت', key: 'st', render: (_, x) => <Tag color={x.SendStatus === 'تأییدشده' ? 'green' : x.SendStatus === 'ردشده' ? 'red' : x.SendStatus === 'ارسال‌شده' ? 'blue' : x.SendStatus === 'آماده ارسال' ? 'gold' : undefined}>{str(x.SendStatus)}</Tag> },
    { title: 'شماره مالیاتی', dataIndex: 'TaxNo', width: 190 },
    {
      title: '',
      key: 'act',
      render: (_, x) => {
        const id = str(x.SaleID);
        const lock = ['ارسال‌شده', 'تأییدشده'].includes(str(x.SendStatus));
        const ins = Number(x.Ins);
        const rt = ins === 4;
        const rem = Number(x.Remain) || 0;
        return (
          <Space size={4} wrap onClick={(e) => e.stopPropagation()}>
            {x.SendStatus === 'آماده ارسال' ? <Button size="small" type="primary" onClick={() => sendOne(id)}>ارسال</Button> : null}
            {x.SendStatus === 'ارسال‌شده' ? <Button size="small" onClick={() => inquireOne(id)}>استعلام</Button> : null}
            {x.TaxNo && (ins === 1 || ins === 2) && lock ? <Button size="small" onClick={() => amend(x, 3)}>ابطال</Button> : null}
            {x.TaxNo && (ins === 1 || ins === 2) && lock ? <Button size="small" onClick={() => amend(x, 2)}>اصلاح</Button> : null}
            {ok(x) ? <Tag color={rem <= 0.005 ? 'green' : 'orange'}>{rt ? 'پرداخت' : 'دریافت'} {fmtNum(x.Received)} | مانده {fmtNum(rem)}</Tag> : null}
            {ok(x) ? <Button size="small" onClick={() => void openReceipts(x)}>{rt ? 'پرداخت' : 'دریافت'}</Button> : null}
            <Button size="small" onClick={() => void printSale(id, data, message)}>چاپ</Button>
            <Button size="small" onClick={() => void openJson(id)}>JSON</Button>
            <Button size="small" onClick={() => openStatus(x)}>وضعیت</Button>
            {lock ? (
              ins !== 3 ? (
                <>
                  <Button size="small" onClick={() => nav(`/p/sale?derive=${encodeURIComponent(id)}&ins=2`)}>اصلاحی</Button>
                  <Button size="small" onClick={() => nav(`/p/sale?derive=${encodeURIComponent(id)}&ins=4`)}>برگشت</Button>
                  <Button size="small" onClick={() => nav(`/p/sale?derive=${encodeURIComponent(id)}&ins=3`)}>ابطال</Button>
                </>
              ) : null
            ) : (
              <>
                <Button size="small" onClick={() => nav(`/p/sale?id=${encodeURIComponent(id)}`)}>ویرایش</Button>
                <Button size="small" danger onClick={() => del(x)}>حذف</Button>
              </>
            )}
          </Space>
        );
      },
    },
  ];

  const totRow = (label: string, t: STot, key: string) => (
    <Table.Summary.Row key={key} style={{ background: key === 'tot' ? '#fafafa' : '#e6f4ff' }}>
      <Table.Summary.Cell index={0} colSpan={5}><b>{label}</b></Table.Summary.Cell>
      {[t.tadis, t.tvam, t.tbill].map((v, i) => <Table.Summary.Cell key={i} index={i + 1} align="end"><b style={{ color: v < 0 ? '#cf1322' : undefined }}>{fmtNum(v)}</b></Table.Summary.Cell>)}
      <Table.Summary.Cell index={4} colSpan={3} />
    </Table.Summary.Row>
  );

  return (
    <NeedCompany company={company}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space wrap>
            <Typography.Title level={3} style={{ margin: 0 }}>فاکتورهای فروش</Typography.Title>
            {envText ? <Tag color={env.data?.env === 'prod' ? 'red' : 'orange'}>{envText}</Tag> : null}
          </Space>
          <Space wrap align="end">
            <DateBox value={str(f.from)} onChange={(v) => set('from', v)} placeholder="از تاریخ" />
            <DateBox value={str(f.to)} onChange={(v) => set('to', v)} placeholder="تا تاریخ" />
            <Select allowClear showSearch optionFilterProp="label" style={{ width: 180 }} placeholder="مشتری: همه" value={str(f.customer) || undefined} options={customers} onChange={(v) => set('customer', v ?? '')} />
            <Select allowClear style={{ width: 170 }} placeholder="الگو: همه" value={str(f.pattern) || undefined} options={toOpts(SLP)} onChange={(v) => set('pattern', v ?? '')} />
            <Select allowClear style={{ width: 140 }} placeholder="موضوع: همه" value={str(f.subject) || undefined} options={toOpts(SLS)} onChange={(v) => set('subject', v ?? '')} />
            <Select allowClear style={{ width: 140 }} placeholder="وضعیت: همه" value={str(f.status) || undefined} options={SLST.map((z) => ({ value: z, label: z }))} onChange={(v) => set('status', v ?? '')} />
            <Input style={{ width: 120 }} placeholder="سریال" value={str(f.serial)} onChange={(e) => set('serial', e.target.value)} />
            <Button type="primary" onClick={() => { setApplied({ ...f }); setSel([]); }}>جستجو</Button>
          </Space>
          <Space wrap>
            <Button onClick={() => nav('/p/sale')}>+ فاکتور فروش</Button>
            <Button type="primary" onClick={sendAll}>ارسال آماده‌ها به سامانه</Button>
            <Button onClick={inquireAll}>استعلام ارسال‌شده‌ها</Button>
            <Button onClick={() => void jsonAll()}>JSON آماده‌های ارسال</Button>
            <Button onClick={() => exportRows(false)}>خروجی Excel (CSV)</Button>
            <Button onClick={() => setRp(true)}>چاپ از شماره تا شماره</Button>
            {selRows.length ? <Button onClick={() => exportRows(true)}>Excel فقط انتخاب‌شده‌ها</Button> : null}
            <Button onClick={() => void openS2p()}>تبدیل به فاکتور خرید</Button>
          </Space>
          <Typography.Text type="secondary">برای دیدن جمع چند صورتحساب روی ردیف آن‌ها کلیک کنید (دوباره کلیک = برداشتن). برگشت از فروش با علامت منفی می‌آید؛ موارد کنارگذاشته، ابطال و ردشده در جمع نمی‌آیند.</Typography.Text>
        </Space>
      </Card>
      {q.isError ? <Alert type="error" showIcon message={errorMessage(q.error)} /> : null}
      {q.data && q.data.total > rows.length ? <Alert type="warning" showIcon message={`فقط ${rows.length} ردیف اول نمایش داده شد؛ ردیف «جمع» شامل همهٔ ${q.data.total} صورتحساب است.`} /> : null}
      <Card>
        <Table<Row>
          size="small"
          rowKey={(r) => str(r.SaleID)}
          loading={q.isFetching}
          columns={cols}
          dataSource={rows}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: [20, 50, 100, 200] }}
          rowClassName={(r) => (sel.includes(str(r.SaleID)) ? 'ant-table-row-selected' : '')}
          onRow={(r) => ({ onClick: () => setSel((s) => (s.includes(str(r.SaleID)) ? s.filter((x) => x !== str(r.SaleID)) : [...s, str(r.SaleID)])), style: { cursor: 'pointer', opacity: ok(r) ? 1 : 0.55 } })}
          locale={{ emptyText: 'صورتحسابی یافت نشد.' }}
          summary={() =>
            T ? (
              <Table.Summary fixed>
                {totRow(`جمع کل (${T.count} صورتحساب: ${T.sales} فروش، ${T.returns} برگشت${T.skipped ? ` - ${T.skipped} مورد کنارگذاشته/ابطال/ردشده در جمع نیامده` : ''})`, T, 'tot')}
                {selT ? totRow(`جمع انتخاب‌شده (${selRows.length} صورتحساب${selRows.some((x) => !ok(x)) ? ' - موارد کنارگذاشته/ابطال/ردشده حساب نشد' : ''})`, selT, 'sel') : null}
              </Table.Summary>
            ) : null
          }
        />
      </Card>

      <BatchModal job={job} onClose={finishJob} onContinue={setJob} />

      <RangePrintModal
        open={rp}
        onClose={() => setRp(false)}
        title="چاپ صورتحساب‌های فروش از شماره تا شماره"
        rows={rows}
        fields={[{ key: 'SerialNo', label: 'شماره سریال' }]}
        onPrint={(rs) => printSales(rs.map((x) => str(x.SaleID)), data, message)}
      />
      <Modal open={!!json} width={820} footer={null} onCancel={() => setJson(null)} title="خروجی JSON مؤدیان">
        {json ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            {((json.r.errors ?? []) as string[]).length ? <Alert type="error" showIcon message="خطاها" description={<ul style={{ margin: 0, paddingInlineStart: 20 }}>{(json.r.errors as string[]).map((z, i) => <li key={i}>{z}</li>)}</ul>} /> : null}
            {((json.r.warnings ?? []) as string[]).length ? <Alert type="warning" showIcon message="هشدارها" description={<ul style={{ margin: 0, paddingInlineStart: 20 }}>{(json.r.warnings as string[]).map((z, i) => <li key={i}>{z}</li>)}</ul>} /> : null}
            <div>پیشوند ۲۱ کاراکتری شماره مالیاتی (قبل از رقم کنترلی): <b dir="ltr">{str(json.r.taxPrefix) || '—'}</b></div>
            <Input.TextArea readOnly rows={12} style={{ direction: 'ltr' }} value={JSON.stringify(json.r.json, null, 2)} />
            <Space>
              <Button type="primary" onClick={() => download(`invoice-${json.id}.json`, json.r.json)}>دانلود فایل JSON</Button>
              <Button onClick={() => setJson(null)}>بستن</Button>
            </Space>
          </Space>
        ) : null}
      </Modal>

      <Modal open={!!status} title="ثبت وضعیت ارسال به سامانهٔ مؤدیان" okText="ذخیره" cancelText="انصراف" onCancel={() => setStatus(null)} onOk={() => void saveStatus()}>
        <Typography.Paragraph type="secondary">این بخش برای ثبت دستی نتیجه است؛ ارسال خودکار را با دکمهٔ «ارسال» انجام دهید. با «ارسال‌شده/تأییدشده» صورتحساب قفل می‌شود.</Typography.Paragraph>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select style={{ width: '100%' }} value={stForm.status || undefined} options={SLST.map((z) => ({ value: z, label: z }))} onChange={(v) => setStForm((o) => ({ ...o, status: v }))} />
          <Input placeholder="شماره مالیاتی (۲۲ کاراکتر)" style={{ direction: 'ltr' }} value={stForm.taxNo} onChange={(e) => setStForm((o) => ({ ...o, taxNo: e.target.value }))} />
          <Input placeholder="شماره پیگیری/ارجاع" value={stForm.ref} onChange={(e) => setStForm((o) => ({ ...o, ref: e.target.value }))} />
          <Input placeholder="پیام خطا (در صورت رد)" value={stForm.error} onChange={(e) => setStForm((o) => ({ ...o, error: e.target.value }))} />
        </Space>
      </Modal>

      <Modal open={!!rcv} width={900} title={rcv ? `${Number(rcv.row.Ins) === 4 ? 'پرداخت' : 'دریافت'} — سریال ${str(rcv.row.SerialNo)}` : ''} okText="ذخیره" cancelText="انصراف" confirmLoading={rcvBusy} onCancel={() => setRcv(null)} onOk={() => void saveReceipts()}>
        {rcv ? (
          <DocPayments
            payments={rcv.pays}
            onChange={(p) => setRcv((o) => (o ? { ...o, pays: p } : o))}
            statuses={SLCQ[Number(rcv.row.Ins) === 4 ? 'out' : 'in']}
            total={rcv.total}
            dir={Number(rcv.row.Ins) === 4 ? 'out' : 'in'}
            label={Number(rcv.row.Ins) === 4 ? 'برگشت از فروش' : 'فاکتور فروش'}
            defaultDate={str(rcv.row.DateJalali)}
          />
        ) : null}
      </Modal>

      <Modal open={!!s2p} width={720} footer={null} onCancel={() => { setS2p(null); setS2pRun(null); }} title="تبدیل فاکتورهای فروشِ اشتباه به فاکتور خرید" maskClosable={false}>
        {s2p ? (
          Number(s2p.eligible) ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Paragraph>این کار هر فاکتور فروشِ فهرست فعلی (با همین فیلترها) را به <b>فاکتور خرید</b> تبدیل می‌کند: «مشتری» ← «فروشنده»، «سریال» ← «شمارهٔ فاکتور»، و فاکتور فروش حذف می‌شود.</Typography.Paragraph>
              <Space size="large" wrap>
                <span>قابل تبدیل: <b>{str(s2p.eligible)}</b></span>
                <span>ردشده (ارسال‌شده/غیراصلی): <b>{str(s2p.skipped)}</b></span>
                <span>فروشندهٔ جدید: <b>{str(s2p.newSuppliers)}</b></span>
                <span>تکراری در خرید: <b>{str(s2p.duplicates)}</b></span>
                <span>جمع مبلغ: <b>{fmtNum(s2p.total)}</b></span>
              </Space>
              <Table<Row> size="small" pagination={false} rowKey={(_, i) => String(i)} dataSource={(s2p.sample ?? []) as Row[]} columns={[{ title: 'سریال', dataIndex: 'no' }, { title: 'تاریخ', dataIndex: 'date' }, { title: 'مشتری ← فروشنده', dataIndex: 'party' }, { title: 'مبلغ', align: 'end', render: (_, x) => fmtNum(x.total) }]} />
              <Typography.Text type="secondary">فقط ۸ نمونهٔ اول نمایش داده شد. پیشنهاد: ابتدا از «تنظیمات و پشتیبان» نسخهٔ پشتیبان بگیرید.</Typography.Text>
              {s2pRun ? (
                <div>
                  <Progress percent={Math.round((s2pRun.done / Math.max(1, s2pRun.n)) * 100)} />
                  {s2pRun.res ? <Alert type="success" showIcon message={`تبدیل انجام شد — تبدیل‌شده: ${s2pRun.res.converted} | تکراری (تبدیل نشد): ${s2pRun.res.dup} | ردشده: ${s2pRun.res.skipped} | فروشندهٔ جدید: ${s2pRun.res.newSuppliers}`} /> : <Typography.Text>در حال تبدیل... لطفاً صفحه را نبندید.</Typography.Text>}
                </div>
              ) : (
                <Space>
                  <Button type="primary" danger onClick={() => void runS2p()}>تأیید و تبدیل {str(s2p.eligible)} فاکتور</Button>
                  <Button onClick={() => setS2p(null)}>انصراف</Button>
                </Space>
              )}
            </Space>
          ) : (
            <Typography.Paragraph>فاکتور قابل تبدیل با فیلتر فعلی پیدا نشد ({str(s2p.found)} فاکتور یافت شد؛ فاکتورهای ارسال‌شده/تأییدشده/غیراصلی تبدیل نمی‌شوند).</Typography.Paragraph>
          )
        ) : null}
      </Modal>
    </NeedCompany>
  );
}
