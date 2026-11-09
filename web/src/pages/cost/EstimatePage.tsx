import { App, Alert, Button, Card, Input, Modal, Select, Space, Table, Tabs, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '../../api/client';
import { useCompany } from '../../api/CompanyContext';
import { csCall } from '../../api/costService';
import { CrudPage } from '../../kit/CrudPage';
import { fmtNum, str, thisPeriod, todayJalali, toOpts } from '../../kit/format';
import { useCostCfg, useCsQuery, useKindActions, useKindList } from '../../kit/hooks';
import type { ColSpec, FormSpec, Row } from '../../kit/types';
import { Hint, PeriodInput } from './common';
import { contractOpts, labelOf } from './helpers';
import { NumInput } from '../../kit/NumInput';

const num = (v: unknown) => Number(String(v ?? '').replace(/,/g, '')) || 0;
const pct = (x: unknown) => (x == null || x === '' ? '—' : `${Math.round(Number(x) * 100) / 100}٪`);

/** برآورد تکمیل و ورودی‌های پیشرفت (برآورد باقی‌مانده، مراحل، نصب مصالح، هزینهٔ کسب قرارداد) */
export default function EstimatePage() {
  const cfg = useCostCfg();
  const opts = contractOpts(cfg.data, false);
  const [contract, setContract] = useState('');
  const [period, setPeriod] = useState(thisPeriod());
  useEffect(() => {
    if (!contract && opts.length) setContract(opts[0].value);
  }, [contract, opts]);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          برآورد تکمیل و ورودی‌های پیشرفت
        </Typography.Title>
        <Hint>
          ۱) هر ماه برای هر عنصر هزینه، «برآورد باقی‌مانده تا پایان قرارداد» را وارد کنید؛ برآورد کل هزینه (EAC) = هزینهٔ واقعی تا پایان ماه + برآورد باقی‌مانده. ۲) اگر روش پیشرفت قرارداد «ساعت کار» است، ساعت باقی‌مانده را هم وارد کنید؛ اگر «مراحل» است، مراحل و وزن آن‌ها را تعریف کنید؛ «گذشت زمان» ورودی اضافه نمی‌خواهد. ۳) مصالحی که تحویل شده ولی نصب نشده در «نصب مصالح» ثبت می‌شود. ۴) نحوهٔ شناخت هزینه‌های کسب قرارداد را برای هر قرارداد در تب «هزینهٔ کسب قرارداد» انتخاب کنید. این مرحله فقط محاسبه و گزارش است و سندی صادر نمی‌کند. [نیازمند تأیید: قواعد در «تنظیمات»]
        </Hint>
        <Space wrap>
          <span>قرارداد</span>
          <Select style={{ minWidth: 280 }} showSearch optionFilterProp="label" allowClear placeholder="— همه —" value={contract || undefined} options={opts} onChange={(v) => setContract(v ?? '')} />
          <PeriodInput value={period} onChange={setPeriod} />
        </Space>
      </div>
      <Tabs
        destroyInactiveTabPane
        items={[
          { key: 'est', label: 'برآورد باقی‌مانده هزینه', children: <EstTab contract={contract} period={period} /> },
          { key: 'ms', label: 'مراحل پیشرفت', children: <MilestoneTab contract={contract} /> },
          { key: 'inst', label: 'نصب مصالح', children: <InstallTab contract={contract} /> },
          { key: 'acq', label: 'هزینهٔ کسب قرارداد', children: <AcqTab contract={contract} /> },
        ]}
      />
    </Space>
  );
}

interface EstGrid {
  contract: { No: string; Title: string; Amount: number; ProgMethod: string };
  period: string;
  grid: Array<{ ElemID: string; Code: string; Name: string; Treat: string; actual: number; prevRem: number | string; suggested: number | string; rem: number | string }>;
  hours: { done: number | string; suggested: number | string; rem: number | string };
}

function EstTab({ contract, period }: { contract: string; period: string }) {
  const { company } = useCompany();
  const { message, notification } = App.useApp();
  const cfg = useCostCfg();
  const q = useCsQuery<EstGrid>('csList', { kind: 'est', contract, period }, !!contract);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [hrs, setHrs] = useState('');
  const [busy, setBusy] = useState(false);
  const r = q.data;

  useEffect(() => {
    if (!r) return;
    const m: Record<string, string> = {};
    r.grid.forEach((x) => (m[x.ElemID] = str(x.rem)));
    setVals(m);
    setHrs(str(r.hours?.rem));
  }, [r]);

  if (!contract) return <Alert type="info" showIcon message="یک قرارداد انتخاب کنید." />;

  const fill = () => {
    if (!r) return;
    setVals((cur) => {
      const m = { ...cur };
      r.grid.forEach((x) => {
        if ((m[x.ElemID] ?? '') === '' && x.suggested !== '') m[x.ElemID] = str(x.suggested);
      });
      return m;
    });
  };

  const save = async () => {
    if (!r) return;
    setBusy(true);
    try {
      const o: Row = { ContractID: contract, Period: r.period, rows: r.grid.map((x) => ({ ElemID: x.ElemID, Remaining: vals[x.ElemID] ?? '' })) };
      if (r.contract.ProgMethod === 'hours') o.RemHours = hrs;
      const res = await csCall<Row>('csSave', company, { kind: 'est', obj: o });
      message.success(`ذخیره شد (${String(res.saved)} مورد).`);
      await q.refetch();
    } catch (e) {
      notification.error({ message: 'ذخیره انجام نشد', description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const cols: TableColumnsType<EstGrid['grid'][number]> = [
    { title: 'کد', key: 'c', render: (_, x) => x.Code },
    { title: 'عنصر هزینه', key: 'n', render: (_, x) => x.Name },
    { title: 'نحوه شناخت', key: 't', render: (_, x) => labelOf(cfg.data?.options.treat, x.Treat) },
    { title: 'هزینهٔ واقعی تا پایان ماه', key: 'a', render: (_, x) => fmtNum(x.actual) },
    { title: 'برآورد باقی‌مانده ماه قبل', key: 'p', render: (_, x) => (x.prevRem === '' ? '—' : fmtNum(x.prevRem)) },
    { title: 'پیشنهاد (برآورد قبل − هزینهٔ بعدی)', key: 's', render: (_, x) => (x.suggested === '' ? '—' : fmtNum(x.suggested)) },
    {
      title: 'برآورد باقی‌مانده این ماه',
      key: 'r',
      render: (_, x) => <NumInput style={{ width: 150 }} value={vals[x.ElemID] ?? ''} onChange={(v) => setVals((m) => ({ ...m, [x.ElemID]: v }))} />,
    },
  ];

  return (
    <Card loading={q.isLoading}>
      {q.isError ? <Alert type="error" showIcon message={errorMessage(q.error)} /> : null}
      {r ? (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            قرارداد <b>{`${r.contract.No} - ${r.contract.Title}`}</b> | مبلغ: <b>{fmtNum(r.contract.Amount)}</b> | روش پیشرفت: <b>{labelOf(cfg.data?.options.prog, r.contract.ProgMethod)}</b> | ماه: <b>{r.period}</b>
          </div>
          <Table size="small" rowKey="ElemID" pagination={false} dataSource={r.grid} columns={cols} scroll={{ x: 'max-content' }} />
          {r.contract.ProgMethod === 'hours' ? (
            <Space wrap>
              <span>
                ساعت کار انجام‌شده تا پایان ماه (از برگهٔ ساعت کار): <b>{str(r.hours.done)}</b>
              </span>
              <span>ساعت باقی‌مانده تا پایان قرارداد{r.hours.suggested !== '' ? ` (پیشنهاد: ${str(r.hours.suggested)})` : ''}</span>
              <NumInput style={{ width: 140 }} value={hrs} onChange={(v) => setHrs(v)} />
            </Space>
          ) : null}
          <Hint>خانهٔ خالی = برآوردی ثبت نمی‌شود (برآورد قبلیِ همان ماه، در صورت وجود، حذف می‌شود). اگر برای ماه جاری چیزی وارد نکنید، سیستم در گزارش از برآورد آخرین ماه ثبت‌شده منهای هزینه‌های بعد از آن استفاده می‌کند و هشدار می‌دهد. برای عنصری که چیزی باقی نمانده «۰» بنویسید.</Hint>
          <Space wrap>
            <Button onClick={fill}>پر کردن خانه‌های خالی با پیشنهاد</Button>
            <Button type="primary" loading={busy} onClick={() => void save()}>
              ذخیرهٔ برآوردها
            </Button>
          </Space>
        </Space>
      ) : null}
    </Card>
  );
}

function MilestoneTab({ contract }: { contract: string }) {
  const list = useKindList<Row>('ms', { contract });
  const act = useKindActions('ms');
  const rows = list.data?.rows ?? [];
  const cols = useMemo<ColSpec<Row>[]>(
    () => [
      { id: 'ContractNo', label: 'قرارداد', get: (r) => str(r.ContractNo), width: 120 },
      { id: 'Title', label: 'مرحله', get: (r) => str(r.Title), width: 220 },
      { id: 'Weight', label: 'وزن', get: (r) => num(r.Weight), type: 'number', width: 90 },
      { id: 'Share', label: 'سهم از کل', get: (r) => (r.Share == null ? '' : pct(r.Share)), width: 110 },
      { id: 'DueJ', label: 'تاریخ برنامه', get: (r) => str(r.DueJ), width: 120 },
      { id: 'DoneJ', label: 'تاریخ تکمیل', get: (r) => (r.DoneJ ? str(r.DoneJ) : 'تکمیل نشده'), width: 120 },
    ],
    [],
  );
  const buildForm = (row: Row | null): FormSpec => ({
    title: row ? 'ویرایش مرحله' : 'مرحلهٔ جدید',
    fields: [
      { name: 'Title', label: 'عنوان', required: true, span: 16 },
      { name: 'Weight', label: 'وزن', type: 'number', required: true, span: 8 },
      { name: 'DueJ', label: 'تاریخ برنامه', type: 'date', span: 12 },
      { name: 'DoneJ', label: 'تاریخ تکمیل (خالی = تکمیل نشده)', type: 'date', span: 12 },
    ],
    initial: row ? { ...row, Weight: str(row.Weight), DueJ: str(row.DueJ), DoneJ: str(row.DoneJ) } : {},
  });
  return (
    <CrudPage<Row>
      title=""
      hint="برای قراردادهایی که روش پیشرفت آن‌ها «مراحل / نقاط عطف» است. درصد پیشرفت = جمع وزن مراحل تکمیل‌شده (تا پایان ماه گزارش) ÷ جمع وزن همهٔ مراحل. وزن می‌تواند درصد یا هر عدد نسبی باشد."
      rows={rows}
      loading={list.isFetching}
      error={list.isError ? errorMessage(list.error) : null}
      onReload={() => void list.refetch()}
      cols={cols}
      getId={(r) => str(r.MSID)}
      nameOf={(r) => str(r.Title)}
      newButtons={contract ? [{ label: 'مرحله' }] : []}
      buildForm={buildForm}
      onSave={async (v, row) => {
        await act.save({ ...v, MSID: row ? str(row.MSID) : '', ContractID: row ? str(row.ContractID) : contract });
      }}
      onDelete={(r) => act.remove(str(r.MSID))}
      emptyText="مرحله‌ای ثبت نشده است."
      storageKey="mt_v2_cols_cs_ms"
    />
  );
}

interface InstData {
  issues: Array<{ IssueID: string; No: string; ContractNo: string; DateJalali: string; Amount: number; Installed: number; Remaining: number }>;
  rows: Array<{ ILID: string; ContractNo: string; DateJalali: string; Amount: number; Notes: string }>;
}

function InstallTab({ contract }: { contract: string }) {
  const { company } = useCompany();
  const { message, notification, modal } = App.useApp();
  const q = useCsQuery<InstData>('csList', { kind: 'inst', contract });
  const [target, setTarget] = useState<InstData['issues'][number] | null>(null);
  const [date, setDate] = useState(todayJalali());
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const r = q.data;

  const open = (x: InstData['issues'][number]) => {
    setTarget(x);
    setDate(todayJalali());
    setAmount(str(x.Remaining));
    setNotes('');
  };
  const save = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await csCall('csSave', company, { kind: 'inst', obj: { IssueID: target.IssueID, DateJalali: date, Amount: amount, Notes: notes } });
      message.success('ثبت شد.');
      setTarget(null);
      await q.refetch();
    } catch (e) {
      notification.error({ message: 'ثبت انجام نشد', description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  const del = (x: InstData['rows'][number]) =>
    modal.confirm({
      title: 'تأیید',
      content: 'این رکورد نصب حذف شود؟',
      okText: 'حذف',
      okButtonProps: { danger: true },
      cancelText: 'انصراف',
      onOk: async () => {
        try {
          await csCall('csDelete', company, { kind: 'inst', id: x.ILID });
          message.success('حذف شد.');
          await q.refetch();
        } catch (e) {
          notification.error({ message: 'حذف انجام نشد', description: errorMessage(e) });
        }
      },
    });

  const icols: TableColumnsType<InstData['issues'][number]> = [
    { title: 'حواله', key: 'n', render: (_, x) => x.No },
    { title: 'قرارداد', key: 'c', render: (_, x) => x.ContractNo },
    { title: 'تاریخ', key: 'd', render: (_, x) => x.DateJalali },
    { title: 'بهای حواله (پس از برگشت/انتقال)', key: 'a', render: (_, x) => fmtNum(x.Amount) },
    { title: 'نصب‌شده', key: 'i', render: (_, x) => fmtNum(x.Installed) },
    { title: 'مانده نصب‌نشده', key: 'r', render: (_, x) => <b>{fmtNum(x.Remaining)}</b> },
    { title: '', key: 'x', render: (_, x) => (x.Remaining > 0 ? <Button size="small" type="primary" onClick={() => open(x)}>ثبت نصب</Button> : null) },
  ];
  const rcols: TableColumnsType<InstData['rows'][number]> = [
    { title: 'قرارداد', key: 'c', render: (_, x) => x.ContractNo },
    { title: 'تاریخ', key: 'd', render: (_, x) => x.DateJalali },
    { title: 'مبلغ نصب‌شده', key: 'a', render: (_, x) => fmtNum(x.Amount) },
    { title: 'توضیحات', key: 'n', render: (_, x) => x.Notes },
    { title: '', key: 'x', render: (_, x) => <Button size="small" danger onClick={() => del(x)}>حذف</Button> },
  ];

  return (
    <Card loading={q.isLoading}>
      {q.isError ? <Alert type="error" showIcon message={errorMessage(q.error)} /> : null}
      {r ? (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Hint>حواله‌هایی که با گزینهٔ «نصب‌نشده» ثبت شده‌اند. تا نصب، بهای آن‌ها از پیشرفت هزینه‌به‌هزینه و بهای خدمات ارائه‌شده کنار می‌ماند. هر بار بخشی از آن نصب شد، تاریخ و مبلغ نصب را ثبت کنید. [نیازمند تأیید: استاندارد ۴۳ — اندازه‌گیری پیشرفت]</Hint>
          <Typography.Title level={5}>حواله‌های نصب‌نشده</Typography.Title>
          <Table size="small" rowKey="IssueID" pagination={false} dataSource={r.issues} columns={icols} scroll={{ x: 'max-content' }} locale={{ emptyText: 'حوالهٔ نصب‌نشده‌ای نیست.' }} />
          <Typography.Title level={5}>سوابق نصب</Typography.Title>
          <Table size="small" rowKey="ILID" pagination={false} dataSource={r.rows} columns={rcols} scroll={{ x: 'max-content' }} />
        </Space>
      ) : null}
      <Modal open={!!target} title={target ? `ثبت نصب — حواله ${target.No}` : ''} okText="ذخیره" cancelText="انصراف" confirmLoading={busy} onOk={() => void save()} onCancel={() => setTarget(null)} destroyOnClose>
        <Space direction="vertical" style={{ width: '100%' }}>
          <span>تاریخ نصب</span>
          <Input value={date} placeholder="1405/05/01" onChange={(e) => setDate(e.target.value)} />
          <span>مبلغ نصب‌شده (ریال)</span>
          <NumInput value={amount} onChange={(v) => setAmount(v)} />
          <span>توضیحات</span>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Space>
      </Modal>
    </Card>
  );
}

interface AcqRow {
  ContractID: string;
  No: string;
  Title: string;
  ProgMethod: string;
  AcqTotal: number;
  AcqTreat: string;
  Effective: string;
  EffectiveWhy: string;
}

function AcqTab({ contract }: { contract: string }) {
  const { company } = useCompany();
  const { message, notification } = App.useApp();
  const cfg = useCostCfg();
  const q = useCsQuery<{ rows: AcqRow[] }>('csList', { kind: 'ccfg', contract });
  const [sel, setSel] = useState<Record<string, string>>({});
  const acqt = cfg.data?.options.acqt as Record<string, string> | undefined;
  const rows = q.data?.rows ?? [];
  useEffect(() => {
    const m: Record<string, string> = {};
    rows.forEach((x) => (m[x.ContractID] = str(x.AcqTreat)));
    setSel(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  const save = async (x: AcqRow) => {
    try {
      await csCall('csSave', company, { kind: 'ccfg', obj: { ContractID: x.ContractID, AcqTreat: sel[x.ContractID] ?? '' } });
      message.success('ذخیره شد.');
      await q.refetch();
    } catch (e) {
      notification.error({ message: 'ذخیره انجام نشد', description: errorMessage(e) });
    }
  };

  const cols: TableColumnsType<AcqRow> = [
    { title: 'قرارداد', key: 'c', render: (_, x) => `${x.No} - ${x.Title}` },
    { title: 'روش پیشرفت', key: 'p', render: (_, x) => labelOf(cfg.data?.options.prog, x.ProgMethod) },
    { title: 'جمع هزینهٔ کسب ثبت‌شده', key: 't', render: (_, x) => fmtNum(x.AcqTotal) },
    {
      title: 'انتخاب این قرارداد',
      key: 's',
      render: (_, x) => (
        <Space>
          <Select style={{ minWidth: 190 }} value={sel[x.ContractID] ?? ''} options={[{ value: '', label: 'پیش‌فرض شرکت' }, ...toOpts(acqt)]} onChange={(v) => setSel((m) => ({ ...m, [x.ContractID]: v }))} />
          <Button size="small" type="primary" onClick={() => void save(x)}>
            ذخیره
          </Button>
        </Space>
      ),
    },
    {
      title: 'روش مؤثر',
      key: 'e',
      render: (_, x) => (
        <div>
          {labelOf(acqt, x.Effective)}
          <br />
          <Typography.Text type="secondary">{x.EffectiveWhy}</Typography.Text>
        </div>
      ),
    },
  ];

  return (
    <Card loading={q.isLoading}>
      {q.isError ? <Alert type="error" showIcon message={errorMessage(q.error)} /> : null}
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Hint>هزینه‌های کسب قرارداد (مناقصه، ضمانت‌نامه، کمیسیون، حق‌الزحمهٔ دلال و ...) را با عنصر «هزینه‌های کسب قرارداد» در دفتر هزینه ثبت کنید. در حالت «دارایی»، مبلغ به نسبت درصد پیشرفت به بهای خدمات منتقل می‌شود؛ در حالت «هزینهٔ دوره»، همان ماه وقوع هزینه می‌شود. «پیش‌فرض شرکت» تابع قاعده‌های «تنظیمات» است (از جمله معافیت عملی برای قراردادهای کوتاه‌مدت). [نیازمند تأیید: استاندارد ۴۳]</Hint>
        <Table size="small" rowKey="ContractID" pagination={false} dataSource={rows} columns={cols} scroll={{ x: 'max-content' }} />
      </Space>
    </Card>
  );
}
