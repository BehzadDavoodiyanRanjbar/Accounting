import { Alert, Card, Select, Space, Table, Tabs, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { errorMessage } from '../../api/client';
import { CrudPage } from '../../kit/CrudPage';
import { fmtNum, str, thisPeriod, todayJalali, toOpts } from '../../kit/format';
import { useCostCfg, useCsQuery, useKindActions, useKindList } from '../../kit/hooks';
import type { ColSpec, FormSpec, Row } from '../../kit/types';
import { contractOpts, employeeOpts, labelOf } from './helpers';
import { Hint, PeriodInput, RunButtons, Warnings } from './common';

const num = (v: unknown) => Number(String(v ?? '').replace(/,/g, '')) || 0;

/** دستمزد نیروی کار قراردادها: حقوق ماهانه، برگهٔ ساعت کار، محاسبه و ثبت */
export default function PayrollPage() {
  const [period, setPeriod] = useState(thisPeriod());
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          دستمزد نیروی کار قراردادها
        </Typography.Title>
        <Hint>
          مراحل کار: ۱) حقوق و مزایای ماهِ هر کارمند را وارد کنید. ۲) ساعت کار روزانهٔ هر کارمند را در «برگهٔ ساعت کار» برای قراردادها (و ساعت بیکاری) ثبت کنید. ۳) در «محاسبه و ثبت دستمزد ماه» نرخ ساعتی و سهم هر قرارداد را ببینید و ثبت کنید. ساعت بیکاری و ظرفیت بلااستفاده طبق قاعدهٔ «مبنای ساعت» هزینهٔ دوره می‌شود. [نیازمند تأیید: تعریف «ساعت مفید» طبق استاندارد]
        </Hint>
        <PeriodInput value={period} onChange={setPeriod} />
      </div>
      <Tabs
        destroyInactiveTabPane
        items={[
          { key: 'pay', label: 'حقوق ماهانه', children: <PayTab period={period} /> },
          { key: 'ts', label: 'برگهٔ ساعت کار', children: <TimesheetTab period={period} /> },
          { key: 'run', label: 'محاسبه و ثبت دستمزد ماه', children: <RunTab period={period} /> },
        ]}
      />
    </Space>
  );
}

function PayTab({ period }: { period: string }) {
  const cfg = useCostCfg();
  const list = useKindList<Row>('pay', { period });
  const act = useKindActions('pay');
  const o = cfg.data?.options;
  const pmode = o?.pmode as Record<string, string> | undefined;
  const umode = o?.umode as Record<string, string> | undefined;
  const rows = list.data?.rows ?? [];

  const cols = useMemo<ColSpec<Row>[]>(
    () => [
      { id: 'EmpName', label: 'کارمند', get: (r) => str(r.EmpName), width: 180 },
      { id: 'Mode', label: 'نوع', get: (r) => labelOf(pmode, r.Mode), width: 110 },
      { id: 'Gross', label: 'حقوق و مزایا / نرخ ساعتی', get: (r) => num(r.Mode === 'hourly' ? r.HourlyDirect : r.Gross), type: 'number', width: 190 },
      { id: 'Employer', label: 'سهم کارفرما', get: (r) => num(r.Employer), type: 'number', width: 130 },
      { id: 'Bonus', label: 'عیدی و پاداش', get: (r) => num(r.Bonus), type: 'number', width: 130 },
      { id: 'Seniority', label: 'سنوات', get: (r) => num(r.Seniority), type: 'number', width: 110 },
      { id: 'Other', label: 'سایر ذخایر', get: (r) => num(r.Other), type: 'number', width: 120 },
      { id: 'Useful', label: 'ساعت مفید', get: (r) => (r.UsefulMode === 'fixed' ? `${str(r.UsefulHours)} (ثابت)` : 'از برگهٔ ساعت'), width: 140 },
    ],
    [pmode],
  );

  const buildForm = (row: Row | null): FormSpec => ({
    title: row ? 'ویرایش حقوق ماهانه' : 'حقوق ماهانه',
    fields: [
      { name: 'EmpID', label: 'کارمند', type: 'select', required: true, options: employeeOpts(cfg.data), span: 12 },
      { name: 'Period', label: 'دوره', required: true, placeholder: '1405/04', span: 6 },
      { name: 'Mode', label: 'نوع', type: 'select', options: toOpts(pmode), required: true, span: 6 },
      { name: 'Gross', label: 'حقوق و مزایای ماه (ریال)', type: 'money', span: 12 },
      { name: 'HourlyDirect', label: 'نرخ ساعتی مستقیم (ریال)', type: 'money', span: 12 },
      { name: 'Employer', label: 'سهم کارفرما (بیمه و ...) — مبلغ', type: 'money', span: 12 },
      { name: 'Bonus', label: 'عیدی و پاداش — سهم ماه', type: 'money', span: 12 },
      { name: 'Seniority', label: 'حق سنوات — سهم ماه', type: 'money', span: 12 },
      { name: 'Other', label: 'سایر ذخایر', type: 'money', span: 12, help: 'مبالغ را به ریال و به‌صورت «مبلغ همین ماه» وارد کنید (نرم‌افزار درصدی فرض نمی‌کند).' },
      { name: 'UsefulMode', label: 'ساعت مفید از', type: 'select', options: toOpts(umode), span: 12 },
      { name: 'UsefulHours', label: 'ساعت مفید ماهانه (اگر ثابت)', type: 'number', span: 12 },
      { name: 'Notes', label: 'توضیحات', type: 'textarea', span: 24 },
    ],
    initial: row ? { ...row, Gross: str(row.Gross), HourlyDirect: str(row.HourlyDirect), Employer: str(row.Employer), Bonus: str(row.Bonus), Seniority: str(row.Seniority), Other: str(row.Other), UsefulHours: str(row.UsefulHours) } : { Mode: 'monthly', UsefulMode: 'timesheet', Period: period },
  });

  return (
    <CrudPage<Row>
      title=""
      rows={rows}
      loading={list.isFetching}
      error={list.isError ? errorMessage(list.error) : null}
      onReload={() => void list.refetch()}
      cols={cols}
      getId={(r) => str(r.PayID)}
      nameOf={(r) => `حقوق «${str(r.EmpName)}»`}
      newButtons={[{ label: 'حقوق ماهانهٔ جدید' }]}
      newDisabledReason={cfg.data && cfg.data.options.employees.length === 0 ? 'ابتدا از «حسابداری ← تفصیلی / کارکنان / پروژه» کارمند تعریف کنید.' : undefined}
      buildForm={buildForm}
      onSave={async (v, row) => {
        await act.save({ ...v, PayID: row ? str(row.PayID) : '' });
      }}
      onDelete={(r) => act.remove(str(r.PayID))}
      storageKey="mt_v2_cols_cs_pay"
    />
  );
}

function TimesheetTab({ period }: { period: string }) {
  const cfg = useCostCfg();
  const [emp, setEmp] = useState('');
  const list = useKindList<Row>('ts', { period, emp });
  const act = useKindActions('ts');
  const o = cfg.data?.options;
  const ht = o?.ht as Record<string, string> | undefined;
  const rows = list.data?.rows ?? [];
  const locked = !!list.data?.locked;

  const cols = useMemo<ColSpec<Row>[]>(
    () => [
      { id: 'DateJalali', label: 'تاریخ', get: (r) => str(r.DateJalali), width: 110 },
      { id: 'EmpName', label: 'کارمند', get: (r) => str(r.EmpName), width: 170 },
      { id: 'ContractNo', label: 'قرارداد', get: (r) => str(r.ContractNo), width: 110 },
      { id: 'HType', label: 'نوع', get: (r) => labelOf(ht, r.HType), width: 110 },
      { id: 'Hours', label: 'ساعت', get: (r) => num(r.Hours), type: 'number', width: 90 },
      { id: 'Notes', label: 'توضیحات', get: (r) => str(r.Notes), width: 220 },
    ],
    [ht],
  );

  const buildForm = (row: Row | null): FormSpec => ({
    title: row ? 'ویرایش ساعت کار' : 'ثبت ساعت کار',
    fields: [
      { name: 'EmpID', label: 'کارمند', type: 'select', required: true, options: employeeOpts(cfg.data), span: 12 },
      { name: 'DateJalali', label: 'تاریخ', type: 'date', required: true, span: 12 },
      { name: 'HType', label: 'نوع ساعت', type: 'select', options: toOpts(ht), required: true, span: 8 },
      { name: 'ContractID', label: 'قرارداد', type: 'select', options: contractOpts(cfg.data, false), placeholder: '— (برای بیکاری اختیاری) —', span: 16 },
      { name: 'Hours', label: 'ساعت', type: 'number', required: true, span: 8 },
      { name: 'Notes', label: 'توضیحات', span: 16, help: '«بیکاری» یعنی ساعتی که کارمند حقوق می‌گیرد ولی روی قراردادی کار نکرده؛ هزینهٔ آن (طبق قاعدهٔ مبنای ساعت) هزینهٔ دوره می‌شود. جمع ساعت یک کارمند در یک روز حداکثر ۲۴ است.' },
    ],
    initial: row ? { ...row, Hours: str(row.Hours) } : { DateJalali: todayJalali(), HType: 'normal', EmpID: emp || undefined },
  });

  return (
    <CrudPage<Row>
      title=""
      summary={locked ? <Alert type="error" showIcon message="دستمزد این ماه محاسبه شده است؛ برای تغییر، ابتدا در تب «محاسبه» گزینهٔ «لغو محاسبهٔ ماه» را بزنید." /> : undefined}
      filters={
        <Space>
          <span>کارمند</span>
          <Select style={{ minWidth: 240 }} allowClear showSearch optionFilterProp="label" placeholder="همه" value={emp || undefined} options={employeeOpts(cfg.data)} onChange={(v) => setEmp(v ?? '')} />
        </Space>
      }
      rows={rows}
      loading={list.isFetching}
      error={list.isError ? errorMessage(list.error) : null}
      onReload={() => void list.refetch()}
      cols={cols}
      getId={(r) => str(r.TSID)}
      nameOf={(r) => `ساعت ${str(r.EmpName)} ${str(r.DateJalali)}`}
      newButtons={[{ label: 'ثبت ساعت کار' }]}
      buildForm={buildForm}
      onSave={async (v, row) => {
        await act.save({ ...v, TSID: row ? str(row.TSID) : '' });
      }}
      onDelete={(r) => act.remove(str(r.TSID))}
      defaultSort={{ id: 'DateJalali', desc: false }}
      storageKey="mt_v2_cols_cs_ts"
    />
  );
}

interface LaborRates {
  divisor: string;
  locked: boolean;
  warnings: string[];
  employees: Array<{ EmpName: string; Total: number; WorkedHours: number | string; IdleHours: number | string; UsefulHours: number | string; Rate: number; Contracts: Array<{ ContractNo: string; Hours: number | string; E02: number; E03: number }>; PeriodAmt: number; Formula: string }>;
  totals: { all: number; contracts: number; period: number };
}

function RunTab({ period }: { period: string }) {
  const q = useCsQuery<LaborRates>('csLaborRates', { period });
  const r = q.data;
  const columns: TableColumnsType<LaborRates['employees'][number]> = [
    { title: 'کارمند', key: 'n', render: (_, x) => x.EmpName },
    { title: 'کل هزینهٔ ماه', key: 't', render: (_, x) => fmtNum(x.Total) },
    { title: 'ساعت کار', key: 'w', render: (_, x) => String(x.WorkedHours) },
    { title: 'ساعت بیکاری', key: 'i', render: (_, x) => String(x.IdleHours) },
    { title: 'ساعت مفید', key: 'u', render: (_, x) => String(x.UsefulHours) },
    { title: 'نرخ ساعتی', key: 'r', render: (_, x) => fmtNum(x.Rate) },
    { title: 'سهم قراردادها (دستمزد + سربار)', key: 'c', render: (_, x) => x.Contracts.map((c) => <div key={c.ContractNo}>{`قرارداد ${c.ContractNo}: ${c.Hours} ساعت → ${fmtNum(c.E02)} + ${fmtNum(c.E03)}`}</div>) },
    { title: 'هزینهٔ دوره', key: 'p', render: (_, x) => fmtNum(x.PeriodAmt) },
  ];
  return (
    <Card loading={q.isLoading}>
      {q.isError ? <Alert type="error" showIcon message={errorMessage(q.error)} /> : null}
      {r ? (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Hint>مبنای ساعت (قاعدهٔ «تنظیمات»): <b>{r.divisor === 'worked' ? 'فقط ساعت کار' : 'ساعت مفید ظرفیت (کار + بیکاری)'}</b>. [نیازمند تأیید]</Hint>
          {r.locked ? <Alert type="success" showIcon message="دستمزد این ماه در دفتر هزینه ثبت شده است." /> : null}
          <Warnings list={r.warnings} />
          <Table size="small" rowKey="EmpName" pagination={false} dataSource={r.employees} columns={columns} scroll={{ x: 'max-content' }}
            expandable={{ expandedRowRender: (x) => <Typography.Text type="secondary">{x.Formula}</Typography.Text> }}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}>جمع</Table.Summary.Cell>
                <Table.Summary.Cell index={1}>{fmtNum(r.totals.all)}</Table.Summary.Cell>
                <Table.Summary.Cell index={2} colSpan={5}>سهم قراردادها: {fmtNum(r.totals.contracts)}</Table.Summary.Cell>
                <Table.Summary.Cell index={3}>{fmtNum(r.totals.period)}</Table.Summary.Cell>
              </Table.Summary.Row>
            )}
          />
          {r.employees.length ? (
            <RunButtons
              period={period}
              doAction="csLaborRun"
              undoAction="csLaborUndo"
              doText={`دستمزد ماه ${period} در دفتر هزینهٔ قراردادها ثبت شود؟ (ثبت مجدد، ردیف‌های قبلی همین ماه را جایگزین می‌کند)`}
              undoText={`ردیف‌های دستمزد ماه ${period} از دفتر هزینه برداشته شود؟`}
              resultText={(x, undo) => (undo ? `${String(x.removed)} ردیف برداشته شد.` : `${String(x.entries)} ردیف هزینه ثبت شد.`)}
              onDone={() => void q.refetch()}
            />
          ) : (
            <Typography.Text type="secondary">برای این ماه ردیف حقوق ثبت نشده است.</Typography.Text>
          )}
        </Space>
      ) : null}
    </Card>
  );
}
