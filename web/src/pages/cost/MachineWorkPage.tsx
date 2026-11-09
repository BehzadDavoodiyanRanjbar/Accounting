import { Alert, Button, Card, Select, Space, Table, Tabs, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { errorMessage } from '../../api/client';
import { CrudPage } from '../../kit/CrudPage';
import { fmtNum, str, thisPeriod, todayJalali, toOpts } from '../../kit/format';
import { useCostCfg, useCsQuery, useKindActions, useKindList } from '../../kit/hooks';
import type { ColSpec, FormSpec, Row } from '../../kit/types';
import { Hint, PeriodInput, RunButtons, Warnings } from './common';
import { contractOpts, labelOf } from './helpers';

const num = (v: unknown) => Number(String(v ?? '').replace(/,/g, '')) || 0;

interface CostContractOpt {
  id: string;
  Kind: string;
  No: string;
  Title: string;
}

/** کارکرد و هزینهٔ ماشین‌آلات: کارکرد روزانه، هزینهٔ ماهانه، محاسبه و ثبت، جدول استهلاک */
export default function MachineWorkPage() {
  const [period, setPeriod] = useState(thisPeriod());
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          کارکرد و هزینهٔ ماشین‌آلات
        </Typography.Title>
        <Hint>
          ۱) کارکرد روزانهٔ هر ماشین خودی یا قرارداد اجاره را روی قرارداد ثبت کنید (ساعت «خواب» هم ثبت می‌شود). ۲) برای ماشین خودی، سوخت، تعمیر، بیمه و اپراتور همان ماه را وارد کنید. ۳) در «محاسبه و ثبت ماه»، استهلاک (از مشخصات ماشین) + هزینه‌ها بر پایهٔ ساعت بین قراردادها تقسیم می‌شود؛ اجاره بر پایهٔ نرخ قرارداد اجاره. سهم ساعت خواب طبق قاعدهٔ «تنظیمات» هزینهٔ دوره است. [نیازمند تأیید: ضریب استهلاک نزولی، شروع استهلاک، تعریف ساعت مبنا]
        </Hint>
        <PeriodInput value={period} onChange={setPeriod} />
      </div>
      <Tabs
        destroyInactiveTabPane
        items={[
          { key: 'log', label: 'کارکرد روزانه', children: <LogTab period={period} /> },
          { key: 'cost', label: 'هزینهٔ ماهانهٔ ماشین', children: <MonthlyCostTab period={period} /> },
          { key: 'run', label: 'محاسبه و ثبت ماه', children: <RunTab period={period} /> },
          { key: 'dep', label: 'جدول استهلاک', children: <DepTab period={period} /> },
        ]}
      />
    </Space>
  );
}

function ownMachines(cfg?: { options: { machines: Array<{ id: string; Name: string; Own: boolean }> } }) {
  return (cfg?.options.machines ?? []).filter((m) => m.Own).map((m) => ({ value: m.id, label: m.Name }));
}

function LogTab({ period }: { period: string }) {
  const cfg = useCostCfg();
  const list = useKindList<Row>('mlog', { period });
  const act = useKindActions('mlog');
  const o = cfg.data?.options;
  const mht = o?.mht as Record<string, string> | undefined;
  const rows = list.data?.rows ?? [];
  const rents = ((o?.costContracts as CostContractOpt[] | undefined) ?? []).filter((c) => c.Kind === 'rent');
  const srcOpts = [
    ...ownMachines(cfg.data).map((m) => ({ value: `M:${m.value}`, label: `خودی: ${m.label}` })),
    ...rents.map((c) => ({ value: `R:${c.id}`, label: `اجاره: ${c.No} - ${c.Title}` })),
  ];

  const cols = useMemo<ColSpec<Row>[]>(
    () => [
      { id: 'DateJalali', label: 'تاریخ', get: (r) => str(r.DateJalali), width: 110 },
      { id: 'MachName', label: 'ماشین / قرارداد اجاره', get: (r) => `${str(r.MachName)}${r.Kind === 'rent' ? ` (اجاره ${str(r.CCNo)})` : ''}`, width: 230 },
      { id: 'ContractNo', label: 'قرارداد (محل کار)', get: (r) => str(r.ContractNo), width: 140 },
      { id: 'HType', label: 'نوع', get: (r) => labelOf(mht, r.HType), width: 100 },
      { id: 'Hours', label: 'ساعت', get: (r) => num(r.Hours), type: 'number', width: 90 },
      { id: 'Notes', label: 'توضیحات', get: (r) => str(r.Notes), width: 200 },
    ],
    [mht],
  );

  const buildForm = (row: Row | null): FormSpec => ({
    title: row ? 'ویرایش کارکرد' : 'ثبت کارکرد ماشین',
    fields: [
      { name: 'Src', label: 'ماشین / قرارداد اجاره', type: 'select', required: true, options: srcOpts, span: 24 },
      { name: 'ContractID', label: 'قرارداد (محل کار)', type: 'select', required: true, options: contractOpts(cfg.data, false), span: 12 },
      { name: 'DateJalali', label: 'تاریخ', type: 'date', required: true, span: 12 },
      { name: 'HType', label: 'نوع', type: 'select', options: toOpts(mht), span: 8 },
      { name: 'Hours', label: 'ساعت', type: 'number', required: true, span: 8 },
      { name: 'Notes', label: 'توضیحات', span: 24, help: '«خواب» یعنی ماشین در محل قرارداد بوده ولی کار نکرده. جمع ساعت یک ماشین در یک روز حداکثر ۲۴ است.' },
    ],
    initial: row
      ? { ...row, Hours: str(row.Hours), Src: row.CCID ? `R:${str(row.CCID)}` : row.MachID ? `M:${str(row.MachID)}` : undefined }
      : { DateJalali: todayJalali(), HType: 'work' },
  });

  return (
    <CrudPage<Row>
      title=""
      rows={rows}
      loading={list.isFetching}
      error={list.isError ? errorMessage(list.error) : null}
      onReload={() => void list.refetch()}
      cols={cols}
      getId={(r) => str(r.LogID)}
      nameOf={(r) => `کارکرد ${str(r.DateJalali)}`}
      newButtons={[{ label: 'ثبت کارکرد' }]}
      buildForm={buildForm}
      onSave={async (v, row) => {
        const s = str(v.Src);
        await act.save({
          LogID: row ? str(row.LogID) : '',
          MachID: s.indexOf('M:') === 0 ? s.slice(2) : '',
          CCID: s.indexOf('R:') === 0 ? s.slice(2) : '',
          ContractID: str(v.ContractID),
          DateJalali: str(v.DateJalali),
          HType: str(v.HType),
          Hours: str(v.Hours),
          Notes: str(v.Notes),
        });
      }}
      onDelete={(r) => act.remove(str(r.LogID))}
      defaultSort={{ id: 'DateJalali', desc: false }}
      storageKey="mt_v2_cols_cs_mlog"
    />
  );
}

function MonthlyCostTab({ period }: { period: string }) {
  const cfg = useCostCfg();
  const list = useKindList<Row>('mcost', { period });
  const act = useKindActions('mcost');
  const rows = list.data?.rows ?? [];

  const cols = useMemo<ColSpec<Row>[]>(
    () => [
      { id: 'MachName', label: 'ماشین', get: (r) => str(r.MachName), width: 200 },
      { id: 'Fuel', label: 'سوخت', get: (r) => num(r.Fuel), type: 'number', width: 120 },
      { id: 'Repair', label: 'تعمیر و نگهداری', get: (r) => num(r.Repair), type: 'number', width: 150 },
      { id: 'Insurance', label: 'بیمه', get: (r) => num(r.Insurance), type: 'number', width: 120 },
      { id: 'Operator', label: 'اپراتور', get: (r) => num(r.Operator), type: 'number', width: 120 },
      { id: 'Other', label: 'سایر', get: (r) => num(r.Other), type: 'number', width: 120 },
    ],
    [],
  );

  const buildForm = (row: Row | null): FormSpec => ({
    title: row ? 'ویرایش هزینهٔ ماهانه' : 'هزینهٔ ماهانهٔ ماشین',
    fields: [
      { name: 'MachID', label: 'ماشین خودی', type: 'select', required: true, options: ownMachines(cfg.data), span: 16 },
      { name: 'Period', label: 'دوره', required: true, placeholder: '1405/04', span: 8 },
      { name: 'Fuel', label: 'سوخت', type: 'money', span: 12 },
      { name: 'Repair', label: 'تعمیر و نگهداری', type: 'money', span: 12 },
      { name: 'Insurance', label: 'بیمه', type: 'money', span: 12 },
      { name: 'Operator', label: 'اپراتور', type: 'money', span: 12 },
      { name: 'Other', label: 'سایر', type: 'money', span: 12 },
    ],
    initial: row ? { ...row, Fuel: str(row.Fuel), Repair: str(row.Repair), Insurance: str(row.Insurance), Operator: str(row.Operator), Other: str(row.Other) } : { Period: period },
  });

  return (
    <CrudPage<Row>
      title=""
      hint="استهلاک خودکار از مشخصات ماشین محاسبه می‌شود و نیازی به ثبت ندارد."
      rows={rows}
      loading={list.isFetching}
      error={list.isError ? errorMessage(list.error) : null}
      onReload={() => void list.refetch()}
      cols={cols}
      getId={(r) => str(r.MCID)}
      nameOf={(r) => str(r.MachName)}
      newButtons={[{ label: 'هزینهٔ ماهانهٔ ماشین' }]}
      buildForm={buildForm}
      onSave={async (v, row) => {
        await act.save({ ...v, MCID: row ? str(row.MCID) : '' });
      }}
      onDelete={(r) => act.remove(str(r.MCID))}
      storageKey="mt_v2_cols_cs_mcost"
    />
  );
}

interface MachRates {
  locked: boolean;
  warnings: string[];
  idleExcluded: boolean;
  machines: Array<{ Name: string; Dep: number; Opex: number; Total: number; WorkHours: number | string; IdleHours: number | string; Rate: number; Contracts: Array<{ ContractNo: string; Hours: number | string; Amount: number }>; PeriodAmt: number; DepFormula: string; Formula: string }>;
  rents: Array<{ No: string; Title: string; Rate: number; Unit: string; Contracts: Array<{ ContractNo: string; Qty: number | string; Amount: number; IdleAmount?: number }>; PeriodAmt: number; Formula: string }>;
  totals: { contracts: number; period: number; noContract?: number };
}

function RunTab({ period }: { period: string }) {
  const cfg = useCostCfg();
  const q = useCsQuery<MachRates>('csMachRates', { period });
  const r = q.data;
  const rateUnit = cfg.data?.options.rateUnit;

  const mcols: TableColumnsType<MachRates['machines'][number]> = [
    { title: 'ماشین', key: 'n', render: (_, x) => x.Name },
    { title: 'استهلاک', key: 'd', render: (_, x) => fmtNum(x.Dep) },
    { title: 'هزینه‌های ماه', key: 'o', render: (_, x) => fmtNum(x.Opex) },
    { title: 'جمع', key: 't', render: (_, x) => <b>{fmtNum(x.Total)}</b> },
    { title: 'ساعت کار / خواب', key: 'h', render: (_, x) => `${x.WorkHours} / ${x.IdleHours}` },
    { title: 'نرخ ساعتی', key: 'r', render: (_, x) => fmtNum(x.Rate) },
    { title: 'سهم قراردادها', key: 'c', render: (_, x) => x.Contracts.map((c) => <div key={c.ContractNo}>{`قرارداد ${c.ContractNo}: ${c.Hours} ساعت → ${fmtNum(c.Amount)}`}</div>) },
    { title: 'هزینهٔ دوره', key: 'p', render: (_, x) => fmtNum(x.PeriodAmt) },
  ];
  const rcols: TableColumnsType<MachRates['rents'][number]> = [
    { title: 'قرارداد اجاره', key: 'n', render: (_, x) => `${x.No} - ${x.Title}` },
    { title: 'نرخ', key: 'r', render: (_, x) => `${fmtNum(x.Rate)} (${labelOf(rateUnit, x.Unit)})` },
    { title: 'سهم قراردادها', key: 'c', render: (_, x) => x.Contracts.map((c) => <div key={c.ContractNo}>{`قرارداد ${c.ContractNo}: ${c.Qty} → ${fmtNum(c.Amount)}${c.IdleAmount ? ` + خواب ${fmtNum(c.IdleAmount)}` : ''}`}</div>) },
    { title: 'هزینهٔ دوره', key: 'p', render: (_, x) => fmtNum(x.PeriodAmt) },
  ];

  return (
    <Card loading={q.isLoading}>
      {q.isError ? <Alert type="error" showIcon message={errorMessage(q.error)} /> : null}
      {r ? (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {r.locked ? <Alert type="success" showIcon message="هزینهٔ ماشین‌آلات این ماه در دفتر هزینه ثبت شده است." /> : null}
          <Warnings list={r.warnings} />
          <Hint>ساعت مبنا: {r.idleExcluded ? 'کارکرد + خواب (سهم خواب هزینهٔ دوره)' : 'فقط کارکرد (کل هزینه روی قراردادها)'} — قاعدهٔ «هزینهٔ ساعات خواب ماشین‌آلات به پروژه تخصیص نیابد» در تنظیمات.</Hint>
          <Typography.Title level={5}>ماشین‌های خودی</Typography.Title>
          <Table size="small" rowKey="Name" pagination={false} dataSource={r.machines} columns={mcols} scroll={{ x: 'max-content' }} locale={{ emptyText: 'ماشین خودی‌ای با کارکرد/هزینه در این ماه نیست.' }}
            expandable={{ expandedRowRender: (x) => <Typography.Text type="secondary">{x.DepFormula}<br />{x.Formula}</Typography.Text> }} />
          <Typography.Title level={5}>ماشین‌های اجاره‌ای</Typography.Title>
          <Table size="small" rowKey="No" pagination={false} dataSource={r.rents} columns={rcols} scroll={{ x: 'max-content' }} locale={{ emptyText: 'کارکرد اجاره‌ای در این ماه نیست.' }}
            expandable={{ expandedRowRender: (x) => <Typography.Text type="secondary">{x.Formula}</Typography.Text> }} />
          <div>
            جمع سهم قراردادها: <b>{fmtNum(r.totals.contracts)}</b> | هزینهٔ دوره: <b>{fmtNum(r.totals.period)}</b>
            {r.totals.noContract ? <> | بدون قرارداد: <b>{fmtNum(r.totals.noContract)}</b></> : null}
          </div>
          {r.machines.length || r.rents.length ? (
            <RunButtons
              period={period}
              doAction="csMachRun"
              undoAction="csMachUndo"
              doText={`هزینهٔ ماشین‌آلات ماه ${period} ثبت شود؟ (ثبت مجدد، ردیف‌های قبلی همین ماه را جایگزین می‌کند)`}
              undoText={`ردیف‌های ماشین‌آلات ماه ${period} برداشته شود؟`}
              resultText={(x, undo) => (undo ? `${String(x.removed)} ردیف برداشته شد.` : `${String(x.entries)} ردیف ثبت شد.`)}
              onDone={() => void q.refetch()}
            />
          ) : null}
        </Space>
      ) : null}
    </Card>
  );
}

function DepTab({ period }: { period: string }) {
  const cfg = useCostCfg();
  const [mach, setMach] = useState('');
  const [applied, setApplied] = useState('');
  const q = useCsQuery<{ rows: Array<{ period: string; amount: number; accum: number; book: number; formula: string }> }>('csDeprSched', { mach: applied, period }, !!applied);
  const cols: TableColumnsType<{ period: string; amount: number; accum: number; book: number; formula: string }> = [
    { title: 'ماه', key: 'p', render: (_, x) => x.period },
    { title: 'استهلاک', key: 'a', render: (_, x) => fmtNum(x.amount) },
    { title: 'استهلاک انباشته', key: 'c', render: (_, x) => fmtNum(x.accum) },
    { title: 'ارزش دفتری', key: 'b', render: (_, x) => fmtNum(x.book) },
    { title: 'فرمول', key: 'f', render: (_, x) => <Typography.Text type="secondary">{x.formula}</Typography.Text> },
  ];
  return (
    <Card>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space wrap>
          <span>ماشین خودی</span>
          <Select style={{ minWidth: 260 }} showSearch optionFilterProp="label" placeholder="— انتخاب —" value={mach || undefined} options={ownMachines(cfg.data)} onChange={(v) => setMach(v)} />
          <Button type="primary" disabled={!mach} onClick={() => setApplied(mach)}>
            نمایش جدول تا ماه {period}
          </Button>
        </Space>
        {q.isError ? <Alert type="error" showIcon message={errorMessage(q.error)} /> : null}
        {applied ? <Table size="small" rowKey="period" loading={q.isFetching} pagination={false} dataSource={q.data?.rows ?? []} columns={cols} scroll={{ x: 'max-content' }} /> : null}
      </Space>
    </Card>
  );
}
