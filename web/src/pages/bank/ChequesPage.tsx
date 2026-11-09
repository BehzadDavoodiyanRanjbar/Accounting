import { App, Button, Input, Modal, Select, Space, Tabs, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { errorMessage } from '../../api/client';
import { useCompany } from '../../api/CompanyContext';
import { CrudPage } from '../../kit/CrudPage';
import { downloadCsv } from '../../kit/exporter';
import type { ExportCol } from '../../kit/exporter';
import { fmtNum, str, toJalali, todayJalali } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import type { ColSpec, FormSpec, Opt, Row } from '../../kit/types';
import { DateBox, accountOpts, defaultAccount, num, useBankAccounts, useBankCall } from './common';
import { NumInput } from '../../kit/NumInput';

interface ChequeResult {
  rows: Row[];
  statuses: string[];
  tabs: Record<string, number>;
  totals: { count: number; amount: number };
}

const FINAL_IN = ['وصول شده', 'تنزیل شده', 'پاس شده'];

const statusHint = (s: string) =>
  s === 'وصول شده'
    ? 'مبلغ چک در ستون «بدهکار» بانک انتخابی می‌نشیند.'
    : s === 'تنزیل شده'
      ? 'مبلغ چک در ستون «بدهکار» و بهره/کارمزد تنزیل در ستون «بستانکار» بانک می‌نشیند.'
      : s === 'پاس شده'
        ? 'مبلغ چک در ستون «بستانکار» بانک انتخابی می‌نشیند.'
        : 'این وضعیت روی گردش بانک اثری ندارد (اگر قبلاً ردیفی ثبت شده بود، برداشته می‌شود).';

/** چک‌های دریافتی و پرداختی: فهرست، ثبت، تغییر وضعیت (تکی و گروهی) و راس‌گیری */
export default function ChequesPage({ dir }: { dir: 'in' | 'out' }) {
  const { company, data } = useCompany();
  const { message, notification } = App.useApp();
  const accs = useBankAccounts();
  const call = useBankCall();
  const [text, setText] = useState('');
  const [account, setAccount] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('all');
  const [applied, setApplied] = useState({ q: '', account: '', from: '', to: '' });
  const params = { dir, status, ...applied };
  const q = useCsQuery<ChequeResult>('chequeList', params);
  const r = q.data;
  const rows = r?.rows ?? [];
  const list = accs.data?.rows;

  const [stFor, setStFor] = useState<{ rows: Row[]; bulk: boolean } | null>(null);
  const [ras, setRas] = useState<Row[] | null>(null);

  const partyOpts = useMemo<Opt[]>(() => {
    const src = dir === 'in' ? data?.customers : data?.suppliers;
    const idKey = dir === 'in' ? 'CustomerID' : 'SupplierID';
    return (src ?? []).filter((c) => c.CompanyID === company && c.IsActive !== false).map((c) => ({ value: str(c[idKey]), label: str(c.Name) }));
  }, [data, dir, company]);

  const cols = useMemo<ColSpec<Row>[]>(
    () => [
      { id: 'No', label: 'شماره', get: (x) => str(x.No), width: 110 },
      { id: 'SayadNo', label: 'شمارهٔ صیاد', get: (x) => str(x.SayadNo), width: 170 },
      { id: 'DateJalali', label: 'تاریخ', get: (x) => str(x.DateJalali), width: 110 },
      { id: 'DueJalali', label: 'سررسید', get: (x) => str(x.DueJalali), render: (x) => <span>{str(x.DueJalali)} {x.Overdue ? <Tag color="red">گذشته</Tag> : null}</span>, width: 140 },
      { id: 'Amount', label: 'مبلغ', get: (x) => num(x.Amount), type: 'number', width: 140 },
      { id: 'PartyName', label: dir === 'in' ? 'پرداخت‌کننده' : 'در وجه', get: (x) => str(x.PartyName), width: 180 },
      { id: 'BankName', label: 'بانک چک', get: (x) => str(x.BankName), width: 130 },
      ...(dir === 'in'
        ? ([
            { id: 'Branch', label: 'شعبه', get: (x) => str(x.Branch), width: 110 },
            { id: 'Interest', label: 'بهره', get: (x) => num(x.Interest) || '', type: 'number', width: 100 },
          ] as ColSpec<Row>[])
        : []),
      { id: 'Account', label: 'حساب ما', get: (x) => str(x.Account), width: 170 },
      {
        id: 'Status',
        label: 'وضعیت',
        get: (x) => str(x.Status),
        render: (x) => <Tag color={/وصول شده|پاس شده/.test(str(x.Status)) ? 'green' : /عودت|برگشت/.test(str(x.Status)) ? 'red' : 'blue'}>{str(x.Status)}</Tag>,
        width: 130,
      },
      { id: 'StatusDate', label: dir === 'in' ? 'تاریخ دریافت/وصول' : 'تاریخ پرداخت', get: (x) => str(x.StatusDate), width: 140 },
    ],
    [dir],
  );

  const buildForm = (row: Row | null): FormSpec => ({
    title: `${row ? 'ویرایش' : 'ثبت'} ${dir === 'in' ? 'چک دریافتی' : 'چک پرداختی'}`,
    fields: [
      { name: 'No', label: 'شمارهٔ چک', span: 8 },
      { name: 'SayadNo', label: 'شمارهٔ صیادی (۱۶ رقم)', span: 8 },
      { name: 'Amount', label: 'مبلغ (ریال)', type: 'money', required: true, span: 8 },
      { name: 'DateJalali', label: 'تاریخ چک', type: 'date', required: true, span: 12 },
      { name: 'DueJalali', label: 'تاریخ سررسید', type: 'date', required: true, span: 12 },
      { name: 'PartyID', label: dir === 'in' ? 'پرداخت‌کننده (از فهرست مشتریان)' : 'در وجه (از فهرست فروشندگان)', type: 'select', options: partyOpts, span: 12 },
      { name: 'PartyName', label: 'یا نام (دستی)', span: 12 },
      { name: 'BankName', label: 'بانک چک', span: 8 },
      { name: 'Branch', label: 'شعبه', span: 8 },
      { name: 'AccountID', label: 'حساب بانکی ما (اختیاری)', type: 'select', options: accountOpts(list, ['bank'], str(row?.AccountID)), span: 8 },
      { name: 'Description', label: 'توضیحات', span: 24 },
    ],
    initial: row
      ? {
          No: str(row.No),
          SayadNo: str(row.SayadNo),
          Amount: str(row.Amount),
          DateJalali: str(row.DateJalali),
          DueJalali: str(row.DueJalali),
          PartyID: row.PartyID || undefined,
          PartyName: row.PartyID ? '' : str(row.PartyName),
          BankName: str(row.BankName),
          Branch: str(row.Branch),
          AccountID: row.AccountID || undefined,
          Description: str(row.Description),
        }
      : { DateJalali: todayJalali() },
  });

  const tabItems = [
    { key: 'all', label: 'همه' },
    ...(dir === 'in' ? [{ key: 'عادی', label: 'عادی' }, { key: 'overdue', label: 'سررسید گذشته' }, ...(r?.statuses ?? []).filter((s) => s !== 'عادی').map((s) => ({ key: s, label: s }))] : [{ key: 'overdue', label: 'سررسید گذشته' }, ...(r?.statuses ?? []).map((s) => ({ key: s, label: s }))]),
  ].map((t) => ({ key: t.key, label: `${t.label} (${r?.tabs[t.key] ?? 0})` }));

  const exCols: ExportCol<Row>[] = [
    { title: 'شماره', value: (x) => str(x.No) },
    { title: 'شمارهٔ صیاد', value: (x) => str(x.SayadNo) },
    { title: 'تاریخ', value: (x) => str(x.DateJalali) },
    { title: 'سررسید', value: (x) => str(x.DueJalali) },
    { title: 'مبلغ', value: (x) => num(x.Amount) },
    { title: dir === 'in' ? 'پرداخت‌کننده' : 'در وجه', value: (x) => str(x.PartyName) },
    { title: 'بانک چک', value: (x) => str(x.BankName) },
    ...(dir === 'in' ? [{ title: 'شعبه', value: (x: Row) => str(x.Branch) }, { title: 'بهره', value: (x: Row) => num(x.Interest) }] : []),
    { title: 'حساب ما', value: (x) => str(x.Account) },
    { title: 'وضعیت', value: (x) => str(x.Status) },
    { title: dir === 'in' ? 'تاریخ وصول' : 'تاریخ پرداخت', value: (x) => str(x.StatusDate) },
  ];

  const submitStatus = async (v: { status: string; date: string; account: string; interest: string }) => {
    if (!stFor) return;
    if (!stFor.bulk) {
      await call('chequeStatus', { id: str(stFor.rows[0].ChequeID), status: v.status, date: v.date, account: v.account, interest: v.interest });
      message.success('وضعیت چک ثبت شد.');
      return;
    }
    let ok = 0;
    for (const c of stFor.rows) {
      try {
        await call('chequeStatus', { id: str(c.ChequeID), status: v.status, date: v.date, account: v.account || str(c.AccountID) });
        ok++;
      } catch (e) {
        notification.error({ message: `چک ${str(c.No || c.SayadNo)}`, description: `${errorMessage(e)} — عملیات متوقف شد (${ok} چک انجام شد).` });
        return;
      }
    }
    message.success(`${ok} چک تغییر وضعیت یافت.`);
  };

  return (
    <>
      <CrudPage<Row>
        title={dir === 'in' ? 'لیست چک‌های دریافتی' : 'لیست چک‌های پرداختی'}
        filters={
          <Space wrap>
            <Input style={{ width: 230 }} placeholder="جستجو: شماره، صیاد، نام، بانک" value={text} onChange={(e) => setText(e.target.value)} onPressEnter={() => setApplied({ q: text, account, from, to })} allowClear />
            <Select style={{ minWidth: 200 }} showSearch optionFilterProp="label" allowClear placeholder="همهٔ بانک‌ها" value={account || undefined} options={accountOpts(list, ['bank'])} onChange={(v) => setAccount(v ?? '')} />
            <DateBox value={from} onChange={setFrom} placeholder="سررسید از" />
            <DateBox value={to} onChange={setTo} placeholder="تا" />
            <Button type="primary" onClick={() => setApplied({ q: text, account, from, to })}>نمایش</Button>
          </Space>
        }
        summary={
          <Space direction="vertical" style={{ width: '100%' }}>
            <Tabs activeKey={status} items={tabItems} onChange={setStatus} />
            {r ? <Typography.Text>جمع ({r.totals.count} چک): <b>{fmtNum(r.totals.amount)}</b></Typography.Text> : null}
          </Space>
        }
        headerExtra={
          <Space wrap>
            <Button onClick={() => setRas(rows)} disabled={!rows.length}>راس‌گیری همهٔ فهرست</Button>
            <Button onClick={() => downloadCsv(`${dir === 'in' ? 'cheques-received' : 'cheques-paid'}-${todayJalali().replace(/\//g, '-')}`, exCols, rows)}>خروجی Excel (CSV)</Button>
          </Space>
        }
        rows={rows}
        loading={q.isFetching}
        error={q.isError ? errorMessage(q.error) : null}
        onReload={() => void q.refetch()}
        cols={cols}
        getId={(x) => str(x.ChequeID)}
        nameOf={(x) => `چک ${str(x.No || x.SayadNo)}`}
        newButtons={[{ label: dir === 'in' ? 'چک دریافتی جدید' : 'چک پرداختی جدید' }]}
        buildForm={buildForm}
        canEdit={(x) => !!x.Manual}
        canDelete={(x) => !!x.Manual}
        rowActions={(x) => (
          <>
            <Button size="small" type="primary" ghost onClick={() => setStFor({ rows: [x], bulk: false })}>
              تغییر وضعیت
            </Button>
            {!x.Manual ? <Tag>{str(x.SrcType)}</Tag> : null}
          </>
        )}
        actionsWidth={290}
        selectable
        bulkActions={[
          { key: 'status', label: 'تغییر وضعیت گروهی', onRun: (_ids, sel) => setStFor({ rows: sel, bulk: true }) },
          { key: 'ras', label: 'راس‌گیری انتخاب‌شده', onRun: (_ids, sel) => setRas(sel) },
        ]}
        onSave={async (v, row) => {
          await call('chequeSave', {
            obj: {
              ChequeID: row ? str(row.ChequeID) : '',
              Dir: dir,
              No: str(v.No),
              SayadNo: str(v.SayadNo),
              DateJalali: str(v.DateJalali),
              DueJalali: str(v.DueJalali),
              Amount: str(v.Amount),
              PartyID: str(v.PartyID),
              PartyName: str(v.PartyName),
              BankName: str(v.BankName),
              Branch: str(v.Branch),
              AccountID: str(v.AccountID),
              Description: str(v.Description),
            },
          });
        }}
        onDelete={async (x) => {
          await call('chequeDelete', { id: str(x.ChequeID) });
        }}
        emptyText="چکی در این فهرست نیست."
        defaultSort={{ id: 'DueJalali', desc: false }}
        storageKey={`mt_v2_cols_bk_cheque_${dir}`}
      />
      <StatusModal
        open={!!stFor}
        title={stFor ? (stFor.bulk ? `تغییر وضعیت گروهی (${stFor.rows.length} چک)` : `تغییر وضعیت چک ${str(stFor.rows[0].No || stFor.rows[0].SayadNo)} — ${fmtNum(stFor.rows[0].Amount)}`) : ''}
        statuses={(r?.statuses ?? []).filter((s) => !(stFor?.bulk && s === 'تنزیل شده'))}
        initialStatus={stFor && !stFor.bulk ? str(stFor.rows[0].Status) : ''}
        initialAccount={stFor && !stFor.bulk ? str(stFor.rows[0].AccountID) || defaultAccount(list, 'bank') : defaultAccount(list, 'bank')}
        initialInterest={stFor && !stFor.bulk && stFor.rows[0].Interest ? str(stFor.rows[0].Interest) : ''}
        withInterest={dir === 'in' && !!stFor && !stFor.bulk}
        accountOptions={accountOpts(list, ['bank'])}
        onClose={() => setStFor(null)}
        onSubmit={submitStatus}
      />
      <RasModal rows={ras} onClose={() => setRas(null)} />
    </>
  );
}

function StatusModal({
  open,
  title,
  statuses,
  initialStatus,
  initialAccount,
  initialInterest,
  withInterest,
  accountOptions,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  statuses: string[];
  initialStatus: string;
  initialAccount: string;
  initialInterest: string;
  withInterest: boolean;
  accountOptions: Opt[];
  onClose: () => void;
  onSubmit: (v: { status: string; date: string; account: string; interest: string }) => Promise<void>;
}) {
  const { notification } = App.useApp();
  // با هر بار باز شدن، مقدارها دوباره از چک گرفته می‌شوند (key)
  return open ? (
    <StatusModalBody
      key={`${title}-${initialStatus}`}
      title={title}
      statuses={statuses}
      initialStatus={initialStatus}
      initialAccount={initialAccount}
      initialInterest={initialInterest}
      withInterest={withInterest}
      accountOptions={accountOptions}
      onClose={onClose}
      onSubmit={async (v) => {
        try {
          await onSubmit(v);
          onClose();
        } catch (e) {
          notification.error({ message: 'ثبت انجام نشد', description: errorMessage(e) });
        }
      }}
    />
  ) : null;
}

function StatusModalBody(p: Omit<Parameters<typeof StatusModal>[0], 'open'>) {
  const [status, setStatus] = useState(p.initialStatus || p.statuses[0] || '');
  const [date, setDate] = useState(todayJalali());
  const [account, setAccount] = useState(p.initialAccount);
  const [interest, setInterest] = useState(p.initialInterest);
  const [busy, setBusy] = useState(false);
  const fin = FINAL_IN.includes(status);
  return (
    <Modal
      open
      title={p.title}
      okText="ثبت وضعیت"
      cancelText="انصراف"
      confirmLoading={busy}
      onCancel={p.onClose}
      onOk={async () => {
        setBusy(true);
        try {
          await p.onSubmit({ status, date, account, interest: status === 'تنزیل شده' ? interest : '' });
        } finally {
          setBusy(false);
        }
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <span>وضعیت جدید</span>
        <Select style={{ width: '100%' }} value={status || undefined} options={p.statuses.map((s) => ({ value: s, label: s }))} onChange={setStatus} />
        <span>تاریخ (وصول/پاس/تغییر)</span>
        <Input value={date} placeholder="1405/08/10" onChange={(e) => setDate(e.target.value.trim())} />
        {fin ? (
          <>
            <span>بانک (حساب)</span>
            <Select style={{ width: '100%' }} showSearch optionFilterProp="label" allowClear placeholder="—" value={account || undefined} options={p.accountOptions} onChange={(v) => setAccount(v ?? '')} />
          </>
        ) : null}
        {p.withInterest && status === 'تنزیل شده' ? (
          <>
            <span>بهره/کارمزد تنزیل (ریال)</span>
            <NumInput value={interest} onChange={(v) => setInterest(v)} />
          </>
        ) : null}
        <Typography.Text type="secondary">{statusHint(status)}</Typography.Text>
      </Space>
    </Modal>
  );
}

/** راس‌گیری: میانگین موزونِ سررسید چک‌ها (وزن = مبلغ) */
function RasModal({ rows, onClose }: { rows: Row[] | null; onClose: () => void }) {
  if (!rows) return null;
  let sum = 0;
  let w = 0;
  let mn = '9999';
  let mx = '';
  rows.forEach((x) => {
    const g = str(x.DueGregorian);
    const t = Date.UTC(Number(g.slice(0, 4)), Number(g.slice(5, 7)) - 1, Number(g.slice(8, 10)));
    const a = num(x.Amount);
    sum += a;
    w += a * t;
    const d = str(x.DueJalali);
    if (d < mn) mn = d;
    if (d > mx) mx = d;
  });
  const avg = sum ? new Date(Math.round(w / sum)) : new Date();
  const [jy, jm, jd] = toJalali(avg.getUTCFullYear(), avg.getUTCMonth() + 1, avg.getUTCDate());
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((avg.getTime() - today) / 864e5);
  const p2 = (n: number) => String(n).padStart(2, '0');
  return (
    <Modal open title="راس‌گیری چک‌ها" footer={<Button onClick={onClose}>بستن</Button>} onCancel={onClose}>
      <Typography.Paragraph type="secondary">{rows.length} چک — راس = میانگین موزون سررسید (وزن هر چک = مبلغ آن).</Typography.Paragraph>
      <Space direction="vertical">
        <div>جمع مبلغ: <b>{fmtNum(Math.round(sum * 100) / 100)}</b></div>
        <div>تاریخ راس (میانگین سررسید): <b>{`${jy}/${p2(jm)}/${p2(jd)}`}</b></div>
        <div>فاصله تا امروز: <b>{days >= 0 ? `${days} روز دیگر` : `${-days} روز پیش`}</b></div>
        <div>نخستین / آخرین سررسید: <b>{mn} — {mx}</b></div>
      </Space>
    </Modal>
  );
}
