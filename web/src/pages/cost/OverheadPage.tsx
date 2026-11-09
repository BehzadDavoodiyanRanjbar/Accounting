import { Alert, Card, Space, Table, Tabs, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { errorMessage } from '../../api/client';
import { CrudPage } from '../../kit/CrudPage';
import { fmtNum, str, thisPeriod, toOpts } from '../../kit/format';
import { useCostCfg, useCsQuery, useKindActions, useKindList } from '../../kit/hooks';
import type { ColSpec, FormSpec, Row } from '../../kit/types';
import { Hint, PeriodInput, RunButtons, Warnings } from './common';
import { contractOpts, isTrue, labelOf } from './helpers';

const num = (v: unknown) => Number(String(v ?? '').replace(/,/g, '')) || 0;

/** سربار و تسهیم (مراکز سربار، سربار واقعی، مقدار مبنا، تسهیم ماه، خلاصهٔ سال) */
export default function OverheadPage() {
  const [period, setPeriod] = useState(thisPeriod());
  const year = period.slice(0, 4);
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          سربار و تسهیم
        </Typography.Title>
        <Hint>
          ۱) برای هر مرکز سربار، بودجهٔ سالانهٔ ثابت و متغیر و «ظرفیت عادی» سالانه (مثلاً جمع ساعت کار مستقیم عادی سال) را وارد کنید؛ نرخ از پیش تعیین‌شده = بودجه ÷ ظرفیت عادی. ۲) هر ماه سربار واقعی را ثبت کنید. ۳) پس از ثبت دستمزد، ماشین‌آلات و مواد همان ماه، «تسهیم ماه» را بزنید: سربار جذب‌شدهٔ هر قرارداد = نرخ × مبنای واقعی همان قرارداد. تفاوت با سربار واقعی = کم/بیش‌جذب‌شده؛ سهم ظرفیت بلااستفاده طبق قاعدهٔ «تنظیمات» هزینهٔ دوره است. [نیازمند تأیید: روش تسهیم، ظرفیت عادی و برخورد با کم/بیش‌جذب‌شده طبق استاندارد]
        </Hint>
        <PeriodInput value={period} onChange={setPeriod} />
      </div>
      <Tabs
        destroyInactiveTabPane
        items={[
          { key: 'pool', label: 'مراکز سربار و بودجه', children: <PoolTab year={year} /> },
          { key: 'act', label: 'سربار واقعی ماه', children: <ActualTab period={period} /> },
          { key: 'bq', label: 'مقدار مبنا (دستی)', children: <BaseQtyTab period={period} /> },
          { key: 'run', label: 'تسهیم ماه', children: <RunTab period={period} /> },
          { key: 'year', label: 'خلاصه سال و تعدیل', children: <YearTab year={year} /> },
        ]}
      />
    </Space>
  );
}

function PoolTab({ year }: { year: string }) {
  const cfg = useCostCfg();
  const list = useKindList<Row>('pool');
  const act = useKindActions('pool');
  const ohk = cfg.data?.options.ohk as Record<string, string> | undefined;
  const rows = list.data?.rows ?? [];
  const baseOpts = (cfg.data?.bases ?? []).filter((b) => b.IsActive).map((b) => ({ value: b.BaseID, label: `${b.Code} - ${b.Name}` }));

  const cols = useMemo<ColSpec<Row>[]>(
    () => [
      { id: 'Year', label: 'سال', get: (r) => str(r.Year), width: 80 },
      { id: 'Code', label: 'کد', get: (r) => str(r.Code), width: 90 },
      { id: 'Name', label: 'نام', get: (r) => str(r.Name), width: 200 },
      { id: 'Kind', label: 'نوع', get: (r) => labelOf(ohk, r.Kind), width: 170 },
      { id: 'BaseName', label: 'مبنا', get: (r) => `${str(r.BaseName)} (${str(r.Unit)})`, width: 190 },
      { id: 'BudgetFixed', label: 'بودجه ثابت', get: (r) => num(r.BudgetFixed), type: 'number', width: 130 },
      { id: 'BudgetVar', label: 'بودجه متغیر', get: (r) => num(r.BudgetVar), type: 'number', width: 130 },
      { id: 'BudgetBase', label: 'ظرفیت عادی سال', get: (r) => num(r.BudgetBase), type: 'number', width: 140 },
      { id: 'FixedRate', label: 'نرخ ثابت', get: (r) => num(r.FixedRate), type: 'number', width: 110 },
      { id: 'VarRate', label: 'نرخ متغیر', get: (r) => num(r.VarRate), type: 'number', width: 110 },
      {
        id: 'IsActive',
        label: 'وضعیت',
        get: (r) => `${isTrue(r.IsActive) ? 'فعال' : 'غیرفعال'}${r.Runs ? ` (${str(r.Runs)} ماه تسهیم)` : ''}`,
        render: (r) => <Tag color={isTrue(r.IsActive) ? 'green' : 'default'}>{`${isTrue(r.IsActive) ? 'فعال' : 'غیرفعال'}${r.Runs ? ` (${str(r.Runs)} ماه تسهیم)` : ''}`}</Tag>,
        width: 160,
      },
    ],
    [ohk],
  );

  const buildForm = (row: Row | null): FormSpec => ({
    title: row ? 'ویرایش مرکز سربار' : 'مرکز سربار جدید',
    fields: [
      { name: 'Year', label: 'سال', required: true, span: 8 },
      { name: 'Code', label: 'کد', required: true, span: 8 },
      { name: 'Name', label: 'نام', required: true, span: 8 },
      { name: 'Kind', label: 'نوع', type: 'select', options: toOpts(ohk), span: 12 },
      { name: 'BaseID', label: 'مبنای تسهیم', type: 'select', required: true, options: baseOpts, span: 12 },
      { name: 'BudgetBase', label: 'ظرفیت عادی سالانه (به واحد مبنا)', type: 'number', required: true, span: 8 },
      { name: 'BudgetFixed', label: 'بودجهٔ سربار ثابت سالانه (ریال)', type: 'money', span: 8 },
      { name: 'BudgetVar', label: 'بودجهٔ سربار متغیر سالانه (ریال)', type: 'money', span: 8 },
      { name: 'IsActive', label: 'فعال', type: 'check', span: 6 },
      { name: 'Notes', label: 'توضیحات', span: 24, help: 'مبناها: «ساعت کار مستقیم» از برگهٔ ساعت کار، «ساعت ماشین» از کارکرد ماشین، «هزینه دستمزد مستقیم» و «هزینه مستقیم کل» از دفتر هزینه محاسبه می‌شوند (ابتدا دستمزد/ماشین/مواد همان ماه را ثبت کنید). برای مبنای دیگر در «تنظیمات ← مبناهای تسهیم» مبنا بسازید و مقدار هر ماه را در تب «مقدار مبنا» وارد کنید. «هزینه عمومی و اداری ستاد» فقط به قراردادهای «قابل‌مطالبه» می‌رسد و هزینه دوره است.' },
    ],
    initial: row
      ? { ...row, Year: str(row.Year), BudgetBase: str(row.BudgetBase), BudgetFixed: str(row.BudgetFixed), BudgetVar: str(row.BudgetVar), IsActive: isTrue(row.IsActive) }
      : { Kind: 'overhead', Year: year, IsActive: true },
  });

  return (
    <CrudPage<Row>
      title=""
      rows={rows}
      loading={list.isFetching}
      error={list.isError ? errorMessage(list.error) : null}
      onReload={() => void list.refetch()}
      cols={cols}
      getId={(r) => str(r.PoolID)}
      nameOf={(r) => str(r.Name)}
      newButtons={[{ label: 'مرکز سربار' }]}
      buildForm={buildForm}
      onSave={async (v, row) => {
        await act.save({ ...v, PoolID: row ? str(row.PoolID) : '', IsActive: isTrue(v.IsActive) });
      }}
      onDelete={(r) => act.remove(str(r.PoolID))}
      storageKey="mt_v2_cols_cs_pool"
    />
  );
}

function ActualTab({ period }: { period: string }) {
  const pools = useKindList<Row>('pool');
  const list = useKindList<Row>('oact', { period });
  const act = useKindActions('oact');
  const rows = list.data?.rows ?? [];
  const poolOpts = (pools.data?.rows ?? []).map((p) => ({ value: str(p.PoolID), label: `${str(p.Year)} - ${str(p.Code)} - ${str(p.Name)}` }));

  const cols = useMemo<ColSpec<Row>[]>(
    () => [
      { id: 'Period', label: 'دوره', get: (r) => str(r.Period), width: 100 },
      { id: 'PoolName', label: 'مرکز سربار', get: (r) => str(r.PoolName), width: 220 },
      { id: 'Fixed', label: 'ثابت (ریال)', get: (r) => num(r.Fixed), type: 'number', width: 140 },
      { id: 'Variable', label: 'متغیر (ریال)', get: (r) => num(r.Variable), type: 'number', width: 140 },
      { id: 'Notes', label: 'توضیحات', get: (r) => str(r.Notes), width: 220 },
    ],
    [],
  );

  const buildForm = (row: Row | null): FormSpec => ({
    title: row ? 'ویرایش سربار واقعی' : 'سربار واقعی ماه',
    fields: [
      { name: 'PoolID', label: 'مرکز سربار', type: 'select', required: true, options: poolOpts, span: 16 },
      { name: 'Period', label: 'دوره', required: true, span: 8 },
      { name: 'Fixed', label: 'سربار ثابت واقعی (ریال)', type: 'money', span: 12 },
      { name: 'Variable', label: 'سربار متغیر واقعی (ریال)', type: 'money', span: 12 },
      { name: 'Notes', label: 'توضیحات / سند مبنا', span: 24 },
    ],
    initial: row ? { ...row, Fixed: str(row.Fixed), Variable: str(row.Variable) } : { Period: period },
  });

  return (
    <CrudPage<Row>
      title=""
      rows={rows}
      loading={list.isFetching}
      error={list.isError ? errorMessage(list.error) : null}
      onReload={() => void list.refetch()}
      cols={cols}
      getId={(r) => str(r.OAID)}
      nameOf={(r) => `${str(r.PoolName)} ${str(r.Period)}`}
      newButtons={[{ label: 'سربار واقعی ماه' }]}
      buildForm={buildForm}
      onSave={async (v, row) => {
        await act.save({ ...v, OAID: row ? str(row.OAID) : '' });
      }}
      onDelete={(r) => act.remove(str(r.OAID))}
      emptyText="برای این ماه سربار واقعی ثبت نشده است."
      storageKey="mt_v2_cols_cs_oact"
    />
  );
}

function BaseQtyTab({ period }: { period: string }) {
  const cfg = useCostCfg();
  const list = useKindList<Row>('bqty', { period });
  const act = useKindActions('bqty');
  const rows = list.data?.rows ?? [];
  const baseOpts = (cfg.data?.bases ?? [])
    .filter((b) => b.IsActive && ['B1', 'B2', 'B3', 'B4'].indexOf(b.Code) < 0)
    .map((b) => ({ value: b.BaseID, label: `${b.Code} - ${b.Name}` }));

  const cols = useMemo<ColSpec<Row>[]>(
    () => [
      { id: 'Period', label: 'دوره', get: (r) => str(r.Period), width: 100 },
      { id: 'BaseName', label: 'مبنا', get: (r) => str(r.BaseName), width: 220 },
      { id: 'ContractNo', label: 'قرارداد', get: (r) => str(r.ContractNo), width: 130 },
      { id: 'Qty', label: 'مقدار', get: (r) => num(r.Qty), type: 'number', width: 120 },
    ],
    [],
  );

  const buildForm = (row: Row | null): FormSpec => ({
    title: 'مقدار مبنا',
    fields: [
      { name: 'BaseID', label: 'مبنا', type: 'select', required: true, options: baseOpts, span: 12 },
      { name: 'ContractID', label: 'قرارداد', type: 'select', required: true, options: contractOpts(cfg.data), span: 12 },
      { name: 'Period', label: 'دوره', required: true, span: 12 },
      { name: 'Qty', label: 'مقدار', type: 'number', required: true, span: 12 },
    ],
    initial: row ? { ...row, Qty: str(row.Qty) } : { Period: period },
  });

  return (
    <CrudPage<Row>
      title=""
      hint="فقط برای مبناهای سفارشی (غیر از چهار مبنای خودکار). مثلاً «تعداد بازدید نظارتی» هر قرارداد در ماه."
      rows={rows}
      loading={list.isFetching}
      error={list.isError ? errorMessage(list.error) : null}
      onReload={() => void list.refetch()}
      cols={cols}
      getId={(r) => str(r.BQID)}
      nameOf={(r) => `${str(r.BaseName)} ${str(r.Period)}`}
      newButtons={[{ label: 'مقدار مبنا' }]}
      buildForm={buildForm}
      onSave={async (v, row) => {
        await act.save({ ...v, BQID: row ? str(row.BQID) : '' });
      }}
      onDelete={(r) => act.remove(str(r.BQID))}
      emptyText="موردی ثبت نشده است."
      storageKey="mt_v2_cols_cs_bqty"
    />
  );
}

interface OhRates {
  locked: boolean;
  warnings: string[];
  unusedOn: boolean;
  pools: Array<{
    Code: string;
    Name: string;
    Unit: string;
    Contracts: Array<{ ContractNo: string; Base: number | string; Fixed: number; Var: number; Amount: number }>;
    BaseTotal: number | string;
    AbsorbedFixed: number;
    AbsorbedVar: number;
    Absorbed: number;
    ActualFixed: number;
    ActualVar: number;
    Variance: number;
    VolumeVar: number;
    SpendingVar: number;
    Unused?: number;
    Formula: string;
    UnusedNote?: string;
  }>;
  totals: { absorbed: number; actual: number; variance: number };
}

function RunTab({ period }: { period: string }) {
  const q = useCsQuery<OhRates>('csOhRates', { period });
  const r = q.data;
  const cc: TableColumnsType<OhRates['pools'][number]['Contracts'][number]> = [
    { title: 'قرارداد', key: 'c', render: (_, x) => x.ContractNo },
    { title: 'مبنای واقعی', key: 'b', render: (_, x) => String(x.Base) },
    { title: 'جذب ثابت', key: 'f', render: (_, x) => fmtNum(x.Fixed) },
    { title: 'جذب متغیر', key: 'v', render: (_, x) => fmtNum(x.Var) },
    { title: 'جمع جذب‌شده', key: 'a', render: (_, x) => <b>{fmtNum(x.Amount)}</b> },
  ];
  return (
    <Card loading={q.isLoading}>
      {q.isError ? <Alert type="error" showIcon message={errorMessage(q.error)} /> : null}
      {r ? (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {r.locked ? <Alert type="success" showIcon message="تسهیم این ماه ثبت شده است." /> : null}
          <Warnings list={r.warnings} />
          <Hint>
            قاعدهٔ «سربار ظرفیت بلااستفاده به بهای پروژه تسهیم نشود»: <b>{r.unusedOn ? 'روشن' : 'خاموش'}</b>
          </Hint>
          {r.pools.map((x) => (
            <div key={x.Code}>
              <Typography.Title level={5}>
                {x.Code} - {x.Name} <Typography.Text type="secondary">({x.Unit})</Typography.Text>
              </Typography.Title>
              <Table
                size="small"
                rowKey="ContractNo"
                pagination={false}
                dataSource={x.Contracts}
                columns={cc}
                scroll={{ x: 'max-content' }}
                summary={() => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0}>جمع</Table.Summary.Cell>
                    <Table.Summary.Cell index={1}>{String(x.BaseTotal)}</Table.Summary.Cell>
                    <Table.Summary.Cell index={2}>{fmtNum(x.AbsorbedFixed)}</Table.Summary.Cell>
                    <Table.Summary.Cell index={3}>{fmtNum(x.AbsorbedVar)}</Table.Summary.Cell>
                    <Table.Summary.Cell index={4}>{fmtNum(x.Absorbed)}</Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
              <div style={{ marginTop: 8 }}>
                سربار واقعی: <b>{fmtNum(x.ActualFixed + x.ActualVar)}</b> | {x.Variance > 0 ? 'کم‌جذب‌شده' : x.Variance < 0 ? 'بیش‌جذب‌شده' : 'بدون اختلاف'}: <b>{fmtNum(Math.abs(x.Variance))}</b> (اثر ظرفیت/حجم {fmtNum(x.VolumeVar)} + اثر هزینه/مصرف {fmtNum(x.SpendingVar)})
                {x.Unused ? <Typography.Text type="danger"> | ظرفیت بلااستفاده (هزینهٔ دوره): {fmtNum(x.Unused)}</Typography.Text> : null}
              </div>
              <Hint>
                {x.Formula}
                {x.UnusedNote ? <><br />{x.UnusedNote}</> : null}
              </Hint>
            </div>
          ))}
          {r.pools.length ? (
            <>
              <div>
                جمع جذب‌شده: <b>{fmtNum(r.totals.absorbed)}</b> | سربار واقعی: <b>{fmtNum(r.totals.actual)}</b> | کم/بیش‌جذب‌شده: <b>{fmtNum(r.totals.variance)}</b>
              </div>
              <RunButtons
                period={period}
                doAction="csOhRun"
                undoAction="csOhUndo"
                doLabel="ثبت تسهیم این ماه در دفتر هزینه"
                undoLabel="لغو تسهیم این ماه"
                doText={`تسهیم سربار ماه ${period} ثبت شود؟ (ثبت مجدد، ردیف‌های قبلی همین ماه را جایگزین می‌کند)`}
                undoText="تسهیم این ماه برداشته شود؟"
                resultText={(x, undo) => (undo ? `${String(x.removed)} ردیف برداشته شد.` : `${String(x.entries)} ردیف ثبت شد.`)}
                onDone={() => void q.refetch()}
              />
            </>
          ) : (
            <Alert type="info" showIcon message="برای سال این ماه مرکز سربار فعالی نیست." />
          )}
        </Space>
      ) : null}
    </Card>
  );
}

interface OhYear {
  policy: string;
  pools: Array<{
    Code: string;
    Name: string;
    Months: number | string;
    posted?: boolean;
    Actual: number;
    Absorbed: number;
    Variance: number;
    Unused: number;
    Adjust: number;
    Contracts: Array<{ ContractNo: string; Absorbed: number; Adjust: number }>;
  }>;
}

function YearTab({ year }: { year: string }) {
  const q = useCsQuery<OhYear>('csOhYear', { year });
  const r = q.data;
  const cc: TableColumnsType<OhYear['pools'][number]['Contracts'][number]> = [
    { title: 'قرارداد', key: 'c', render: (_, x) => x.ContractNo },
    { title: 'جذب‌شده', key: 'a', render: (_, x) => fmtNum(x.Absorbed) },
    { title: 'سهم تعدیل', key: 'j', render: (_, x) => fmtNum(x.Adjust) },
  ];
  return (
    <Card loading={q.isLoading} title={`سال ${year}`}>
      {q.isError ? <Alert type="error" showIcon message={errorMessage(q.error)} /> : null}
      {r ? (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Hint>
            قاعدهٔ «سربار کم/بیش‌جذب‌شدهٔ سال»: <b>{r.policy === 'prorate' ? 'تعدیل در پایان سال به نسبت سربار جذب‌شده' : 'هزینه (یا درآمد) دوره'}</b> (در «تنظیمات ← قواعد»). [نیازمند تأیید]
          </Hint>
          {r.pools.map((x) => (
            <div key={x.Code}>
              <Typography.Title level={5}>
                {x.Code} - {x.Name} ({String(x.Months)} ماه تسهیم‌شده) {x.posted ? <Tag color="green">تعدیل ثبت شده</Tag> : null}
              </Typography.Title>
              <div style={{ marginBottom: 8 }}>
                سربار واقعی: <b>{fmtNum(x.Actual)}</b> | جذب‌شده: <b>{fmtNum(x.Absorbed)}</b> | کم/بیش‌جذب‌شده: <b>{fmtNum(x.Variance)}</b> | ظرفیت بلااستفاده (هزینهٔ دوره): <b>{fmtNum(x.Unused)}</b> | مبلغ قابل‌تعدیل بین قراردادها: <b>{fmtNum(x.Adjust)}</b>
              </div>
              <Table size="small" rowKey="ContractNo" pagination={false} dataSource={x.Contracts} columns={cc} scroll={{ x: 'max-content' }} />
            </div>
          ))}
          {r.pools.length ? (
            <RunButtons
              params={{ year }}
              doAction="csOhYearPost"
              undoAction="csOhYearUndo"
              doLabel="ثبت تعدیل پایان سال"
              undoLabel="لغو تعدیل سال"
              doText={`تعدیل سربار کم/بیش‌جذب‌شدهٔ سال ${year} روی قراردادها ثبت شود؟`}
              undoText="تعدیل سال برداشته شود؟"
              resultText={(x, undo) => (undo ? `${String(x.removed)} ردیف برداشته شد.` : `${String(x.entries)} ردیف ثبت شد.`)}
              onDone={() => void q.refetch()}
            />
          ) : (
            <Alert type="info" showIcon message="برای این سال تسهیمی ثبت نشده است." />
          )}
        </Space>
      ) : null}
    </Card>
  );
}
