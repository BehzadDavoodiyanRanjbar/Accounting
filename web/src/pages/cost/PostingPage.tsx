import { App, Alert, Button, Card, Collapse, Select, Space, Table, Tabs, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { errorMessage } from '../../api/client';
import { useCompany } from '../../api/CompanyContext';
import { csCall } from '../../api/costService';
import { CrudPage } from '../../kit/CrudPage';
import { downloadCsv, printTable } from '../../kit/exporter';
import type { ExportCol } from '../../kit/exporter';
import { fmtNum, str, thisPeriod, todayJalali } from '../../kit/format';
import { useCostCfg, useCsQuery } from '../../kit/hooks';
import type { ColSpec, FormSpec, Row } from '../../kit/types';
import { Hint, PeriodInput, Warnings } from './common';
import { contractOpts } from './helpers';

const num = (v: unknown) => Number(String(v ?? '').replace(/,/g, '')) || 0;

/** صدور سند و گزارش جامع بهای خدمات (مرحلهٔ ۶) */
export default function PostingPage() {
  const [period, setPeriod] = useState(thisPeriod());
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          صدور سند و گزارش جامع بهای خدمات
        </Typography.Title>
        <Hint>هر ماه: ۱) «پیش‌نمایش» اسنادی را که ساخته می‌شود ببینید؛ ۲) «صدور» اسناد را به‌صورت «پیش‌نویس» در بخش حسابداری می‌سازد؛ ۳) پس از بررسی، اسناد را در «سندهای حسابداری» تأیید کنید. مبلغ هر صدور = مقدار تجمعی تا پایان ماه منهای آنچه قبلاً صادر شده؛ پس صدور ماه‌های جاافتاده یا اصلاح‌شده خودکار جبران می‌شود. فقط «آخرین صدور» قابل‌برگشت است.</Hint>
        <PeriodInput value={period} onChange={setPeriod} />
      </div>
      <Tabs
        destroyInactiveTabPane
        items={[
          { key: 'post', label: 'صدور سند (پیش‌نویس)', children: <PostTab period={period} /> },
          { key: 'bill', label: 'الحاقیه و صورت‌وضعیت کارفرما', children: <BillTab /> },
          { key: 'rep', label: 'گزارش جامع دوره', children: <ReportTab period={period} /> },
          { key: 'ver', label: 'موارد نیازمند تأیید', children: <VerifyTab /> },
        ]}
      />
    </Space>
  );
}

interface RunRow {
  RunID: string;
  Period: string;
  DateJalali: string;
  vouchers: Array<{ label: string; exists: boolean; No: string }>;
  confirmed?: number;
  drafts?: number;
  missing?: number;
  canUndo?: boolean;
  isLast?: boolean;
}

function RunsTable({ rows, onUndo }: { rows: RunRow[]; onUndo?: (id: string) => void }) {
  const cols: TableColumnsType<RunRow> = [
    { title: 'ماه', key: 'p', render: (_, r) => r.Period },
    { title: 'تاریخ', key: 'd', render: (_, r) => r.DateJalali },
    { title: 'اسناد', key: 'v', render: (_, r) => r.vouchers.map((v) => `${v.label}${v.exists ? ` (سند ${v.No})` : ' (حذف‌شده!)'}`).join('، ') },
    {
      title: 'وضعیت',
      key: 's',
      render: (_, r) => (
        <>
          {r.confirmed ? `${r.confirmed} تأییدشده ` : ''}
          {r.drafts ? `${r.drafts} پیش‌نویس` : ''}
          {r.missing ? <Typography.Text type="danger"> {r.missing} سند ناموجود</Typography.Text> : null}
        </>
      ),
    },
    {
      title: '',
      key: 'u',
      render: (_, r) =>
        r.canUndo && onUndo ? (
          <Button size="small" danger onClick={() => onUndo(r.RunID)}>
            برگشت
          </Button>
        ) : r.isLast ? (
          <Typography.Text type="secondary">برای برگشت، اسناد تأییدشده را به پیش‌نویس برگردانید</Typography.Text>
        ) : null,
    },
  ];
  return <Table size="small" rowKey="RunID" pagination={false} dataSource={rows} columns={cols} scroll={{ x: 'max-content' }} locale={{ emptyText: 'هنوز صدوری انجام نشده است.' }} />;
}

interface Plan {
  period: string;
  dateJ: string;
  canRun: boolean;
  why?: string;
  lastRun?: { Period: string };
  trfRows: unknown[];
  warnings: string[];
  notes: string[];
  disclaimer: string;
  vouchers: Array<{ title: string; D: number; C: number; balanced: boolean; lines: Array<{ code: string; name: string; desc: string; dr: number; cr: number }> }>;
}

function PostTab({ period }: { period: string }) {
  const { company } = useCompany();
  const { message, notification, modal } = App.useApp();
  const q = useCsQuery<Plan>('csPostPreview', { period });
  const runs = useCsQuery<{ rows: RunRow[] }>('csPostList', {});
  const [busy, setBusy] = useState(false);
  const pl = q.data;

  const refresh = async () => {
    await Promise.all([q.refetch(), runs.refetch()]);
  };
  const run = () => {
    if (!pl) return;
    modal.confirm({
      title: 'تأیید صدور',
      content: `برای ماه ${pl.period} تعداد ${pl.vouchers.length} سند «پیش‌نویس» ساخته شود و ${pl.trfRows.length} ردیف دفتر هزینه قفل شود؟`,
      okText: 'صدور',
      cancelText: 'انصراف',
      onOk: async () => {
        setBusy(true);
        try {
          const r = await csCall<{ vouchers: unknown[] }>('csPostRun', company, { period: pl.period });
          message.success(`صادر شد: ${r.vouchers.length} سند پیش‌نویس.`);
          await refresh();
        } catch (e) {
          notification.error({ message: 'صدور انجام نشد', description: errorMessage(e) });
        } finally {
          setBusy(false);
        }
      },
    });
  };
  const undo = (id: string) =>
    modal.confirm({
      title: 'برگشت صدور',
      content: 'این صدور برگشت داده شود؟ اسناد پیش‌نویس آن حذف و ردیف‌های دفتر هزینه دوباره باز می‌شود.',
      okText: 'برگشت',
      okButtonProps: { danger: true },
      cancelText: 'انصراف',
      onOk: async () => {
        try {
          const r = await csCall<{ vouchers: number }>('csPostUndo', company, { runId: id });
          message.success(`برگشت داده شد (${r.vouchers} سند حذف شد).`);
          await refresh();
        } catch (e) {
          notification.error({ message: 'برگشت انجام نشد', description: errorMessage(e) });
        }
      },
    });

  const vcols: TableColumnsType<Plan['vouchers'][number]['lines'][number]> = [
    { title: 'کد حساب', key: 'c', render: (_, x) => x.code },
    { title: 'نام حساب', key: 'n', render: (_, x) => x.name },
    { title: 'شرح', key: 'd', render: (_, x) => x.desc },
    { title: 'بدهکار', key: 'dr', render: (_, x) => (x.dr ? fmtNum(x.dr) : '—') },
    { title: 'بستانکار', key: 'cr', render: (_, x) => (x.cr ? fmtNum(x.cr) : '—') },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {q.isError ? <Alert type="error" showIcon message={errorMessage(q.error)} /> : null}
      <Card loading={q.isLoading}>
        {pl ? (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              ماه <b>{pl.period}</b> | تاریخ اسناد: <b>{pl.dateJ}</b> | اسناد قابل‌صدور: <b>{pl.vouchers.length}</b> | ردیف دفتر هزینهٔ صادرنشده: <b>{pl.trfRows.length}</b>
              {pl.lastRun ? <> | آخرین صدور: <b>{pl.lastRun.Period}</b></> : null}
            </div>
            {pl.canRun ? (
              <div>
                <Button type="primary" loading={busy} onClick={run}>
                  صدور اسناد پیش‌نویس
                </Button>
              </div>
            ) : (
              <Typography.Text type="secondary">{pl.why || 'صدور ممکن نیست.'}</Typography.Text>
            )}
          </Space>
        ) : null}
      </Card>
      {pl ? <Warnings list={pl.warnings} /> : null}
      {pl?.vouchers.map((v, i) => (
        <Card key={i} size="small" title={<>{v.title} <Typography.Text type="secondary">(جمع {fmtNum(v.D)} ریال{v.balanced ? '' : ' — تراز نیست!'})</Typography.Text></>}>
          <Table
            size="small"
            rowKey={(_, j) => String(j)}
            pagination={false}
            dataSource={v.lines}
            columns={vcols}
            scroll={{ x: 'max-content' }}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3}>جمع</Table.Summary.Cell>
                <Table.Summary.Cell index={3}>{fmtNum(v.D)}</Table.Summary.Cell>
                <Table.Summary.Cell index={4}>{fmtNum(v.C)}</Table.Summary.Cell>
              </Table.Summary.Row>
            )}
          />
        </Card>
      ))}
      <Card size="small" title="صدورهای انجام‌شده" loading={runs.isLoading}>
        <RunsTable rows={runs.data?.rows ?? []} onUndo={undo} />
      </Card>
      {pl ? (
        <Collapse
          items={[
            {
              key: 'n',
              label: 'مبناها و فرض‌های این صدور (نیازمند تأیید)',
              children: (
                <>
                  <ul>
                    {pl.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                  <Hint>{pl.disclaimer}</Hint>
                </>
              ),
            },
          ]}
        />
      ) : null}
    </Space>
  );
}

function BillTab() {
  const cfg = useCostCfg();
  const [ctr, setCtr] = useState('');
  const opts = contractOpts(cfg.data, false);
  const contract = ctr || opts[0]?.value || '';
  const am = useCsQuery<{ rows: Row[]; contracts: Array<{ ContractID: string; BaseAmount: number; amend: number; Effective: number }> }>('csList', { kind: 'amend', contract }, !!contract);
  const bl = useCsQuery<{ rows: Row[]; totals: { a: number; v: number } }>('csList', { kind: 'bill', contract }, !!contract);
  const cur = am.data?.contracts.find((c) => c.ContractID === contract);

  const { company } = useCompany();
  const refresh = async () => {
    await Promise.all([am.refetch(), bl.refetch()]);
  };

  const amCols = useMemo<ColSpec<Row>[]>(
    () => [
      { id: 'DateJalali', label: 'تاریخ اثر', get: (r) => str(r.DateJalali), width: 120 },
      { id: 'Delta', label: 'تغییر مبلغ (ریال)', get: (r) => num(r.Delta), type: 'number', width: 170 },
      { id: 'Notes', label: 'توضیحات', get: (r) => str(r.Notes), width: 260 },
    ],
    [],
  );
  const blCols = useMemo<ColSpec<Row>[]>(
    () => [
      { id: 'No', label: 'شماره', get: (r) => str(r.No), width: 90 },
      { id: 'DateJalali', label: 'تاریخ', get: (r) => str(r.DateJalali), width: 120 },
      { id: 'Amount', label: 'مبلغ (بدون ارزش افزوده)', get: (r) => num(r.Amount), type: 'number', width: 190 },
      { id: 'Vat', label: 'ارزش افزوده', get: (r) => num(r.Vat), type: 'number', width: 140 },
      { id: 'Posted', label: 'وضعیت', get: (r) => (r.Posted ? 'در سند صادر شده' : 'صادرنشده'), render: (r) => <Tag color={r.Posted ? 'green' : 'default'}>{r.Posted ? 'در سند صادر شده' : 'صادرنشده'}</Tag>, width: 150 },
      { id: 'Notes', label: 'توضیحات', get: (r) => str(r.Notes), width: 220 },
    ],
    [],
  );

  const save = async (kind: string, obj: Row) => {
    await csCall('csSave', company, { kind, obj });
    await refresh();
  };
  const del = async (kind: string, id: string) => {
    await csCall('csDelete', company, { kind, id });
    await refresh();
  };

  const amForm = (row: Row | null): FormSpec => ({
    title: row ? 'ویرایش الحاقیه' : 'الحاقیهٔ جدید',
    fields: [
      { name: 'DateJalali', label: 'تاریخ اثر', type: 'date', required: true, span: 12 },
      { name: 'Delta', label: 'تغییر مبلغ (ریال؛ برای کاهش با منفی)', type: 'money', required: true, span: 12 },
      { name: 'Notes', label: 'توضیحات', span: 24 },
    ],
    initial: row ? { ...row, Delta: str(row.Delta) } : { DateJalali: todayJalali() },
  });
  const blForm = (row: Row | null): FormSpec => ({
    title: row ? 'ویرایش صورت‌وضعیت' : 'صورت‌وضعیت جدید',
    fields: [
      { name: 'No', label: 'شماره (خالی = خودکار)', span: 8 },
      { name: 'DateJalali', label: 'تاریخ', type: 'date', required: true, span: 8 },
      { name: 'Amount', label: 'مبلغ بدون ارزش افزوده', type: 'money', required: true, span: 8 },
      { name: 'Vat', label: 'ارزش افزوده (مبلغ؛ خالی = ندارد)', type: 'money', span: 12 },
      { name: 'Notes', label: 'توضیحات', span: 12 },
    ],
    initial: row ? { ...row, No: str(row.No), Amount: str(row.Amount), Vat: str(row.Vat) } : { DateJalali: todayJalali() },
  });

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space wrap>
            <span>قرارداد</span>
            <Select style={{ minWidth: 300 }} showSearch optionFilterProp="label" value={contract || undefined} options={opts} onChange={setCtr} />
          </Space>
          {cur ? (
            <div>
              مبلغ پایه: <b>{fmtNum(cur.BaseAmount)}</b> | جمع الحاقیه‌ها: <b>{fmtNum(cur.amend)}</b> | مبلغ فعلی: <b>{fmtNum(cur.Effective)}</b>
            </div>
          ) : null}
          <Hint>الحاقیه، مبلغ قرارداد را از ماه تاریخ اثر کم یا زیاد می‌کند (اثر آن به‌صورت جبران تجمعی در درآمد همان ماه می‌آید). صورت‌وضعیت کارفرما در صدور بعدی به‌صورت سند «حساب‌های دریافتنی ← دارایی قرارداد (و ارزش افزودهٔ فروش)» صادر می‌شود تا درآمد دوبار ثبت نشود؛ پس برای همان مبلغ فاکتور فروش جداگانه نزنید. ارزش افزوده را خودتان وارد می‌کنید. هر دو [نیازمند تأیید حسابدار].</Hint>
        </Space>
      </Card>
      <CrudPage<Row>
        title="الحاقیه‌های قرارداد"
        rows={am.data?.rows ?? []}
        loading={am.isFetching}
        error={am.isError ? errorMessage(am.error) : null}
        onReload={() => void am.refetch()}
        cols={amCols}
        getId={(r) => str(r.AMID)}
        nameOf={(r) => `الحاقیه ${str(r.DateJalali)}`}
        newButtons={contract ? [{ label: 'الحاقیه' }] : []}
        buildForm={amForm}
        onSave={(v, row) => save('amend', { ...v, AMID: row ? str(row.AMID) : '', ContractID: contract })}
        onDelete={(r) => del('amend', str(r.AMID))}
        emptyText="الحاقیه‌ای ثبت نشده است."
        storageKey="mt_v2_cols_cs_amend"
      />
      <CrudPage<Row>
        title="صورت‌وضعیت‌های صادرشده برای کارفرما"
        summary={bl.data ? <Typography.Text>جمع مبلغ: <b>{fmtNum(bl.data.totals.a)}</b> | جمع ارزش افزوده: <b>{fmtNum(bl.data.totals.v)}</b></Typography.Text> : null}
        rows={bl.data?.rows ?? []}
        loading={bl.isFetching}
        error={bl.isError ? errorMessage(bl.error) : null}
        onReload={() => void bl.refetch()}
        cols={blCols}
        getId={(r) => str(r.BLID)}
        nameOf={(r) => `صورت‌وضعیت ${str(r.No)}`}
        newButtons={contract ? [{ label: 'صورت‌وضعیت' }] : []}
        buildForm={blForm}
        canEdit={(r) => !r.Posted}
        canDelete={(r) => !r.Posted}
        onSave={(v, row) => save('bill', { ...v, BLID: row ? str(row.BLID) : '', ContractID: contract })}
        onDelete={(r) => del('bill', str(r.BLID))}
        emptyText="صورت‌وضعیتی ثبت نشده است."
        storageKey="mt_v2_cols_cs_bill"
      />
    </Space>
  );
}

interface RepRow {
  ContractID: string;
  No: string;
  Title: string;
  computable: boolean;
  progressPct: number;
  Amount: number;
  revCum: number;
  costCum: number;
  gpCum: number;
  wipBalance: number;
  assetBalance: number;
  provision: number;
  posted: { rev: number; cost: number; prov: number };
  billed: number;
  unbilled: number;
  contractLiab: number;
  pending: { rev: number; cost: number; prov: number };
  loss: number;
}
interface Report {
  period: string;
  disclaimer: string;
  warnings: string[];
  rows: RepRow[];
  counts: { contracts: number; incomplete: number; lossContracts: number };
  totals: Record<string, number>;
  checks: Array<{ ok: boolean; info?: boolean; text: string }>;
  overhead?: {
    error?: string;
    policy: string;
    pools?: Array<{ Code: string; Name: string; Absorbed: number; Actual: number; Variance: number; VolumeVar: number; SpendingVar: number; Unused: number }>;
    totals: { absorbed: number; actual: number; variance: number; unused: number };
  };
  periodCosts: Array<{ Code: string; Name: string; period: number; cum: number }>;
  runs: RunRow[];
}

function ReportTab({ period }: { period: string }) {
  const { message } = App.useApp();
  const q = useCsQuery<Report>('csRep6', { period });
  const r = q.data;

  const exCols: ExportCol<RepRow | 'foot'>[] = r
    ? [
        { title: 'قرارداد', value: (x) => (x === 'foot' ? 'جمع' : `${x.No} - ${x.Title}`) },
        { title: 'پیشرفت (٪)', value: (x) => (x === 'foot' ? '' : x.computable ? `${Math.round(x.progressPct * 100) / 100}٪` : 'نیاز به برآورد') },
        { title: 'مبلغ قرارداد', numeric: true, value: (x) => (x === 'foot' ? r.totals.amount : x.Amount) },
        { title: 'درآمد تجمعی', numeric: true, value: (x) => (x === 'foot' ? r.totals.revCum : x.revCum) },
        { title: 'بهای خدمات تجمعی', numeric: true, value: (x) => (x === 'foot' ? r.totals.costCum : x.costCum) },
        { title: 'سود ناخالص تجمعی', numeric: true, value: (x) => (x === 'foot' ? r.totals.gpCum : x.gpCum) },
        { title: 'هزینهٔ در جریان (نصب‌نشده)', numeric: true, value: (x) => (x === 'foot' ? r.totals.wip : x.wipBalance) },
        { title: 'دارایی کسب/ایفا', numeric: true, value: (x) => (x === 'foot' ? r.totals.asset : x.assetBalance) },
        { title: 'ذخیرهٔ زیان', numeric: true, value: (x) => (x === 'foot' ? r.totals.provision : x.provision) },
        { title: 'درآمد صادرشده', numeric: true, value: (x) => (x === 'foot' ? r.totals.pRev : x.posted.rev) },
        { title: 'بهای صادرشده', numeric: true, value: (x) => (x === 'foot' ? r.totals.pCost : x.posted.cost) },
        { title: 'ذخیرهٔ صادرشده', numeric: true, value: (x) => (x === 'foot' ? r.totals.pProv : x.posted.prov) },
        { title: 'صورت‌وضعیت کارفرما', numeric: true, value: (x) => (x === 'foot' ? r.totals.billed : x.billed) },
        { title: 'دارایی قرارداد (درآمد مطالبه‌نشده)', numeric: true, value: (x) => (x === 'foot' ? r.totals.unbilled : x.unbilled) },
        { title: 'بدهی قرارداد (پیش از درآمد)', numeric: true, value: (x) => (x === 'foot' ? r.totals.liab : x.contractLiab) },
        { title: 'صادرنشده (درآمد / بها / ذخیره)', value: (x) => (x === 'foot' ? '' : x.computable ? `${x.pending.rev} / ${x.pending.cost} / ${x.pending.prov}` : '—') },
      ]
    : [];

  const doCsv = () => {
    if (!r) return;
    downloadCsv(`cost-report-${r.period.replace(/\//g, '-')}`, exCols, r.rows, 'foot', ['گزارش کمکی؛ نیازمند تأیید حسابدار/حسابرس رسمی.', ...r.warnings.slice(0, 20)]);
  };
  const doPrint = () => {
    if (!r) return;
    if (!printTable('گزارش جامع بهای تمام‌شده خدمات', `ماه ${r.period} | تاریخ تهیه: ${todayJalali()}`, exCols, r.rows, 'foot', [r.disclaimer, ...r.warnings.slice(0, 20)])) message.warning('مرورگر تب جدید را مسدود کرد.');
  };

  const cols: TableColumnsType<RepRow> = [
    { title: 'قرارداد', key: 'c', render: (_, x) => `${x.No} - ${x.Title}` },
    { title: 'پیشرفت', key: 'g', render: (_, x) => (x.computable ? `${Math.round(x.progressPct * 100) / 100}٪` : <Typography.Text type="danger">نیاز به برآورد</Typography.Text>) },
    { title: 'مبلغ قرارداد', key: 'a', render: (_, x) => fmtNum(x.Amount) },
    { title: 'درآمد تجمعی', key: 'b', render: (_, x) => fmtNum(x.revCum) },
    { title: 'بهای خدمات تجمعی', key: 'd', render: (_, x) => fmtNum(x.costCum) },
    { title: 'سود ناخالص تجمعی', key: 'e', render: (_, x) => fmtNum(x.gpCum) },
    { title: 'هزینهٔ در جریان (نصب‌نشده)', key: 'f', render: (_, x) => fmtNum(x.wipBalance) },
    { title: 'دارایی کسب/ایفا', key: 'h', render: (_, x) => fmtNum(x.assetBalance) },
    { title: 'ذخیرهٔ زیان', key: 'i', render: (_, x) => fmtNum(x.provision) },
    { title: 'درآمد صادرشده', key: 'j', render: (_, x) => fmtNum(x.posted.rev) },
    { title: 'بهای صادرشده', key: 'k', render: (_, x) => fmtNum(x.posted.cost) },
    { title: 'ذخیرهٔ صادرشده', key: 'l', render: (_, x) => fmtNum(x.posted.prov) },
    { title: 'صورت‌وضعیت کارفرما', key: 'm', render: (_, x) => fmtNum(x.billed) },
    { title: 'دارایی قرارداد (درآمد مطالبه‌نشده)', key: 'n', render: (_, x) => fmtNum(x.unbilled) },
    { title: 'بدهی قرارداد (پیش از درآمد)', key: 'o', render: (_, x) => fmtNum(x.contractLiab) },
    { title: 'صادرنشده (درآمد / بها / ذخیره)', key: 'p', render: (_, x) => (x.computable ? `${x.pending.rev} / ${x.pending.cost} / ${x.pending.prov}` : '—') },
  ];
  const T: Record<string, number> = r?.totals ?? {};
  const oh = r?.overhead;
  const ohCols: TableColumnsType<NonNullable<NonNullable<Report['overhead']>['pools']>[number]> = [
    { title: 'مرکز سربار', key: 'n', render: (_, p) => `${p.Code} - ${p.Name}` },
    { title: 'جذب‌شده', key: 'a', render: (_, p) => fmtNum(p.Absorbed) },
    { title: 'واقعی', key: 'b', render: (_, p) => fmtNum(p.Actual) },
    { title: 'کم(+)/بیش(−) جذب', key: 'c', render: (_, p) => fmtNum(p.Variance) },
    { title: 'انحراف حجم', key: 'd', render: (_, p) => fmtNum(p.VolumeVar) },
    { title: 'انحراف مصرف', key: 'e', render: (_, p) => fmtNum(p.SpendingVar) },
    { title: 'ظرفیت بلااستفاده', key: 'f', render: (_, p) => fmtNum(p.Unused) },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {q.isError ? <Alert type="error" showIcon message={errorMessage(q.error)} /> : null}
      <Card
        loading={q.isLoading}
        title={r ? `گزارش جامع بهای تمام‌شده خدمات — ماه ${r.period}` : undefined}
        extra={
          r ? (
            <Space>
              <Button onClick={doCsv}>Excel (CSV)</Button>
              <Button onClick={doPrint}>چاپ</Button>
            </Space>
          ) : null
        }
      >
        {r ? (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              قراردادها: <b>{r.counts.contracts}</b> | بدون پیشرفت قابل‌محاسبه: <b>{r.counts.incomplete}</b> | زیان‌ده: <b>{r.counts.lossContracts}</b>
            </div>
            <Table
              size="small"
              rowKey="ContractID"
              pagination={false}
              dataSource={r.rows}
              columns={cols}
              scroll={{ x: 'max-content' }}
              onRow={(x) => ({ style: x.loss > 0 ? { background: 'rgba(200,0,0,.06)' } : undefined })}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}>جمع</Table.Summary.Cell>
                  <Table.Summary.Cell index={1} />
                  {['amount', 'revCum', 'costCum', 'gpCum', 'wip', 'asset', 'provision', 'pRev', 'pCost', 'pProv', 'billed', 'unbilled', 'liab'].map((k, i) => (
                    <Table.Summary.Cell key={k} index={i + 2}>
                      {fmtNum(T[k])}
                    </Table.Summary.Cell>
                  ))}
                  <Table.Summary.Cell index={15} />
                </Table.Summary.Row>
              )}
            />
          </Space>
        ) : null}
      </Card>
      {r ? (
        <>
          <Card size="small" title="کنترل‌ها">
            <ul style={{ margin: 0, paddingInlineStart: 20 }}>
              {r.checks.map((c, i) => (
                <li key={i} style={{ color: c.ok ? undefined : c.info ? '#8c8c8c' : '#cf1322' }}>
                  {c.ok ? '✔ ' : '✖ '}
                  {c.text}
                </li>
              ))}
            </ul>
          </Card>
          {oh && !oh.error ? (
            <Card size="small" title="سربار تسهیم‌شده، کم/بیش‌جذب و ظرفیت بلااستفاده (همین ماه)">
              <Hint>سربار واقعی در حساب‌های طبیعی هزینه مانده و سربار جذب‌شده با حساب «هزینه‌های جذب‌شده» (بستانکار) خارج می‌شود؛ مانده خالص (کم‌جذب = بدهکار، بیش‌جذب = بستانکار) در سود و زیان دوره می‌ماند و سند جدا ندارد. سیاست سال: {oh.policy === 'prorate' ? 'تعدیل در پایان سال' : 'هزینه/درآمد دوره'}.</Hint>
              <Table
                size="small"
                rowKey="Code"
                pagination={false}
                dataSource={oh.pools ?? []}
                columns={ohCols}
                scroll={{ x: 'max-content' }}
                locale={{ emptyText: 'مرکز سربار تعریف نشده است.' }}
                summary={() =>
                  oh.pools && oh.pools.length ? (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0}>جمع</Table.Summary.Cell>
                      <Table.Summary.Cell index={1}>{fmtNum(oh.totals.absorbed)}</Table.Summary.Cell>
                      <Table.Summary.Cell index={2}>{fmtNum(oh.totals.actual)}</Table.Summary.Cell>
                      <Table.Summary.Cell index={3}>{fmtNum(oh.totals.variance)}</Table.Summary.Cell>
                      <Table.Summary.Cell index={4} />
                      <Table.Summary.Cell index={5} />
                      <Table.Summary.Cell index={6}>{fmtNum(oh.totals.unused)}</Table.Summary.Cell>
                    </Table.Summary.Row>
                  ) : null
                }
              />
            </Card>
          ) : null}
          {r.periodCosts.length ? (
            <Card size="small" title="هزینه‌های دوره‌ای (خارج از بهای قرارداد)">
              <Table
                size="small"
                rowKey="Code"
                pagination={false}
                dataSource={r.periodCosts}
                scroll={{ x: 'max-content' }}
                columns={[
                  { title: 'کد', dataIndex: 'Code' },
                  { title: 'عنصر', dataIndex: 'Name' },
                  { title: 'همین ماه', render: (_, x) => fmtNum(x.period) },
                  { title: 'تجمعی', render: (_, x) => fmtNum(x.cum) },
                ]}
              />
            </Card>
          ) : null}
          <Warnings list={r.warnings} />
          <Card size="small" title="صدورهای اخیر">
            <RunsTable rows={r.runs} />
            <Hint>{r.disclaimer}</Hint>
          </Card>
        </>
      ) : null}
    </Space>
  );
}

interface VerifyItem {
  type: string;
  code: string;
  title: string;
  value: string;
  source: string;
}

function VerifyTab() {
  const { message } = App.useApp();
  const q = useCsQuery<{ disclaimer: string; counts: { rules: number; elems: number; bases: number; notes: number }; items: VerifyItem[] }>('csVerify6', {});
  const r = q.data;
  const exCols: ExportCol<VerifyItem>[] = [
    { title: 'نوع', value: (x) => x.type },
    { title: 'کد/کلید', value: (x) => x.code },
    { title: 'موضوع', value: (x) => x.title },
    { title: 'مقدار فعلی', value: (x) => x.value },
    { title: 'منبع / مبنا', value: (x) => x.source },
    { title: 'تأییدکننده / تاریخ', value: () => '' },
  ];
  const cols: TableColumnsType<VerifyItem> = [
    { title: 'نوع', dataIndex: 'type' },
    { title: 'کد/کلید', dataIndex: 'code' },
    { title: 'موضوع', dataIndex: 'title' },
    { title: 'مقدار فعلی', dataIndex: 'value' },
    { title: 'منبع / مبنا', dataIndex: 'source' },
    { title: 'تأییدکننده / تاریخ', render: () => '' },
  ];
  return (
    <Card
      loading={q.isLoading}
      title="فهرست جامع موارد «نیازمند تأیید»"
      extra={
        r ? (
          <Space>
            <Button onClick={() => downloadCsv('needs-confirmation', exCols, r.items, undefined, [r.disclaimer])}>Excel (CSV)</Button>
            <Button onClick={() => { if (!printTable('موارد نیازمند تأیید — بهای تمام‌شده خدمات', `تاریخ تهیه: ${todayJalali()}`, exCols, r.items, undefined, [r.disclaimer])) message.warning('مرورگر تب جدید را مسدود کرد.'); }}>چاپ</Button>
          </Space>
        ) : null
      }
    >
      {q.isError ? <Alert type="error" showIcon message={errorMessage(q.error)} /> : null}
      {r ? (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Hint>{r.disclaimer}</Hint>
          <div>
            قواعد: <b>{r.counts.rules}</b> | عناصر هزینه: <b>{r.counts.elems}</b> | مبناهای تسهیم: <b>{r.counts.bases}</b> | مبناهای صدور سند: <b>{r.counts.notes}</b>. تغییر قواعد در «تنظیمات بهای خدمات».
          </div>
          <Table size="small" rowKey={(x) => `${x.type}-${x.code}-${x.title}`} pagination={{ pageSize: 50, hideOnSinglePage: true }} dataSource={r.items} columns={cols} scroll={{ x: 'max-content' }} />
        </Space>
      ) : null}
    </Card>
  );
}
