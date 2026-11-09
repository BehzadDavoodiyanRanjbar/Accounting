import { Alert, Button, Card, Select, Space, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useState } from 'react';
import { errorMessage } from '../../api/client';
import { fmtNum, thisPeriod } from '../../kit/format';
import { useCostCfg, useCsQuery } from '../../kit/hooks';
import { Hint, PeriodInput, Warnings } from './common';
import { contractOpts, labelOf } from './helpers';

const pct = (x: unknown) => (x == null || x === '' ? '—' : `${Math.round(Number(x) * 100) / 100}٪`);
const nz = (x: unknown) => (x == null || x === '' ? '—' : fmtNum(x));

interface Eac {
  actual: number;
  remaining: number;
  total: number | null;
}
interface CompareRow {
  ContractID: string;
  No: string;
  Title: string;
  ProgMethod: string;
  Amount: number;
  computable: boolean;
  progressPct: number;
  revCum: number;
  rev: number;
  costCum: number;
  cost: number;
  gpCum: number;
  gp: number;
  eac: Eac;
  loss: number;
  lossLower: number;
  provision: number;
}
interface Detail {
  No: string;
  Title: string;
  ProgMethod: string;
  Amount: number;
  computable: boolean;
  progressPct: number;
  basis?: string;
  revCum: number;
  rev: number;
  costCum: number;
  cost: number;
  gpCum: number;
  gp: number;
  comps: { product: number; productRecognised: number; uninstalled: number; acqIncurred: number; acqRecognised: number; fulIncurred: number; fulRecognised: number; periodCosts: number };
  acqTreat: string;
  acqWhy: string;
  lines: Array<{ Code: string; Name: string; Treat: string; actual: number; remaining: number; total: number; mode: string; from?: string }>;
  eac: Eac;
  expectedMargin: number | null;
  loss: number;
  provision: number;
  schedule: Array<{ period: string; computable: boolean; progressPct: number; decreased?: boolean; revCum: number; rev: number; costCum: number; cost: number; gpCum: number; gp: number; estStatus: string }>;
  check: { equal: boolean; revEqual: boolean; costEqual: boolean };
  warnings: string[];
}
interface ProgResult {
  period: string;
  disclaimer: string;
  warnings: string[];
  detail?: Detail;
  rows: CompareRow[];
  counts: { contracts: number; incomplete: number; lossContracts: number };
  totals: { amount: number; revCum: number; rev: number; costCum: number; cost: number; gpCum: number; gp: number; loss: number; provision: number };
}

/** درآمد و بهای خدمات ارائه‌شده (پیشرفت) */
export default function ProgressPage() {
  const cfg = useCostCfg();
  const [contract, setContract] = useState('');
  const [period, setPeriod] = useState(thisPeriod());
  const q = useCsQuery<ProgResult>('csProg', { period, contract });
  const r = q.data;
  const o = cfg.data?.options;

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          پیشرفت، درآمد و بهای خدمات ارائه‌شده
        </Typography.Title>
        <Hint>برای هر قرارداد: درصد پیشرفت، درآمد قابل‌شناسایی (مبلغ قرارداد × پیشرفت)، بهای خدمات ارائه‌شده (هزینهٔ انجام‌شده منهای مصالح نصب‌نشده + هزینهٔ کسب/ایفای قرارداد به نسبت پیشرفت)، سود ناخالص و آزمون قرارداد زیان‌ده. گزارش فقط محاسبه است و سندی صادر نمی‌کند (صدور سند در «صدور سند و گزارش جامع»). نتیجه «تحلیل کمکی» است و قواعد آن «نیازمند تأیید» حسابدار/حسابرس رسمی است.</Hint>
        <Space wrap>
          <span>قرارداد</span>
          <Select style={{ minWidth: 300 }} showSearch optionFilterProp="label" allowClear placeholder="همهٔ قراردادها (مقایسه)" value={contract || undefined} options={contractOpts(cfg.data)} onChange={(v) => setContract(v ?? '')} />
          <PeriodInput value={period} onChange={setPeriod} />
        </Space>
      </div>
      {q.isError ? <Alert type="error" showIcon message={errorMessage(q.error)} /> : null}
      <Card loading={q.isLoading}>
        {r && r.detail ? (
          <DetailView d={r.detail} r={r} prog={o?.prog} treat={o?.treat} acqt={o?.acqt as Record<string, string> | undefined} onBack={() => setContract('')} />
        ) : r ? (
          <CompareView r={r} prog={o?.prog} onPick={(id) => setContract(id)} />
        ) : null}
      </Card>
    </Space>
  );
}

function CompareView({ r, prog, onPick }: { r: ProgResult; prog?: Record<string, string>; onPick: (id: string) => void }) {
  const T = r.totals;
  const cols: TableColumnsType<CompareRow> = [
    { title: 'قرارداد', key: 'c', render: (_, x) => (<><Button type="link" size="small" onClick={() => onPick(x.ContractID)}>{x.No}</Button> {x.Title}</>) },
    { title: 'روش پیشرفت', key: 'p', render: (_, x) => labelOf(prog, x.ProgMethod) },
    { title: 'مبلغ قرارداد', key: 'a', render: (_, x) => fmtNum(x.Amount) },
    { title: 'پیشرفت', key: 'g', render: (_, x) => (x.computable ? pct(x.progressPct) : <Typography.Text type="danger">نیاز به برآورد</Typography.Text>) },
    { title: 'درآمد تجمعی', key: 'rc', render: (_, x) => fmtNum(x.revCum) },
    { title: 'درآمد این ماه', key: 'r', render: (_, x) => fmtNum(x.rev) },
    { title: 'بهای خدمات تجمعی', key: 'cc', render: (_, x) => fmtNum(x.costCum) },
    { title: 'بهای این ماه', key: 'co', render: (_, x) => fmtNum(x.cost) },
    { title: 'سود ناخالص تجمعی', key: 'gc', render: (_, x) => fmtNum(x.gpCum) },
    { title: 'سود ناخالص این ماه', key: 'gp', render: (_, x) => fmtNum(x.gp) },
    { title: 'برآورد کل هزینه', key: 'e', render: (_, x) => nz(x.eac.total) },
    { title: 'زیان کل مورد انتظار', key: 'l', render: (_, x) => (x.loss > 0 ? <Typography.Text type="danger" strong>{fmtNum(x.loss)}</Typography.Text> : x.lossLower > 0 ? `حداقل ${fmtNum(x.lossLower)}` : '—') },
    { title: 'ذخیرهٔ زیان باقی‌مانده', key: 'v', render: (_, x) => (x.provision > 0 ? fmtNum(x.provision) : '—') },
  ];
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        ماه گزارش: <b>{r.period}</b> | قراردادها: <b>{r.counts.contracts}</b> | بدون پیشرفت قابل‌محاسبه: <b>{r.counts.incomplete}</b> | زیان‌ده: <b>{r.counts.lossContracts}</b>
      </div>
      <Table
        size="small"
        rowKey="ContractID"
        pagination={false}
        dataSource={r.rows}
        columns={cols}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'قرارداد فعال یا دارای هزینه‌ای پیدا نشد.' }}
        onRow={(x) => ({ style: x.loss > 0 ? { background: 'rgba(200,0,0,.06)' } : undefined })}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0}>جمع</Table.Summary.Cell>
            <Table.Summary.Cell index={1} />
            <Table.Summary.Cell index={2}>{fmtNum(T.amount)}</Table.Summary.Cell>
            <Table.Summary.Cell index={3} />
            <Table.Summary.Cell index={4}>{fmtNum(T.revCum)}</Table.Summary.Cell>
            <Table.Summary.Cell index={5}>{fmtNum(T.rev)}</Table.Summary.Cell>
            <Table.Summary.Cell index={6}>{fmtNum(T.costCum)}</Table.Summary.Cell>
            <Table.Summary.Cell index={7}>{fmtNum(T.cost)}</Table.Summary.Cell>
            <Table.Summary.Cell index={8}>{fmtNum(T.gpCum)}</Table.Summary.Cell>
            <Table.Summary.Cell index={9}>{fmtNum(T.gp)}</Table.Summary.Cell>
            <Table.Summary.Cell index={10} />
            <Table.Summary.Cell index={11}>{fmtNum(T.loss)}</Table.Summary.Cell>
            <Table.Summary.Cell index={12}>{fmtNum(T.provision)}</Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
      <Warnings list={r.warnings} />
      <Hint>{r.disclaimer}</Hint>
    </Space>
  );
}

function DetailView({ d, r, prog, treat, acqt, onBack }: { d: Detail; r: ProgResult; prog?: Record<string, string>; treat?: Record<string, string>; acqt?: Record<string, string>; onBack: () => void }) {
  const c = d.comps;
  const compRows = [
    { k: 'a', name: 'هزینه‌های جزو بهای خدمات (مواد، دستمزد، ماشین، پیمانکار، سربار و ...)', inc: fmtNum(c.product), rec: fmtNum(c.productRecognised) },
    { k: 'b', name: 'منها: مصالح تحویل‌شده ولی نصب‌نشده', inc: fmtNum(c.uninstalled), rec: '—' },
    { k: 'c', name: `هزینه‌های کسب قرارداد (${labelOf(acqt, d.acqTreat)})`, inc: fmtNum(c.acqIncurred), rec: fmtNum(c.acqRecognised) },
    { k: 'd', name: 'هزینه‌های ایفای قرارداد (دارایی)', inc: fmtNum(c.fulIncurred), rec: fmtNum(c.fulRecognised) },
    { k: 'e', name: 'هزینه‌های دوره (خارج از بهای خدمات: ضایعات غیرعادی، ظرفیت بلااستفاده و ...)', inc: fmtNum(c.periodCosts), rec: '—' },
  ];
  const lcols: TableColumnsType<Detail['lines'][number]> = [
    { title: 'عنصر', key: 'n', render: (_, x) => `${x.Code} - ${x.Name}` },
    { title: 'نحوه شناخت', key: 't', render: (_, x) => labelOf(treat, x.Treat) },
    { title: 'هزینهٔ واقعی', key: 'a', render: (_, x) => fmtNum(x.actual) },
    { title: 'برآورد باقی‌مانده', key: 'r', render: (_, x) => fmtNum(x.remaining) },
    { title: 'برآورد کل', key: 'o', render: (_, x) => fmtNum(x.total) },
    { title: 'منبع برآورد', key: 's', render: (_, x) => (x.mode === 'exact' ? 'برآورد همین ماه' : x.mode === 'derived' ? `مشتق از ${x.from ?? ''}` : <Typography.Text type="danger">ثبت نشده</Typography.Text>) },
  ];
  const scols: TableColumnsType<Detail['schedule'][number]> = [
    { title: 'ماه', key: 'p', render: (_, x) => x.period },
    { title: 'پیشرفت', key: 'g', render: (_, x) => (x.computable ? `${pct(x.progressPct)}${x.decreased ? ' ⚠' : ''}` : '—') },
    { title: 'درآمد تجمعی', key: 'a', render: (_, x) => fmtNum(x.revCum) },
    { title: 'درآمد ماه', key: 'b', render: (_, x) => fmtNum(x.rev) },
    { title: 'بهای خدمات تجمعی', key: 'c', render: (_, x) => fmtNum(x.costCum) },
    { title: 'بهای ماه', key: 'd', render: (_, x) => fmtNum(x.cost) },
    { title: 'سود ناخالص تجمعی', key: 'e', render: (_, x) => fmtNum(x.gpCum) },
    { title: 'سود ناخالص ماه', key: 'f', render: (_, x) => fmtNum(x.gp) },
    { title: 'برآورد', key: 'g2', render: (_, x) => (x.estStatus === 'exact' ? 'ثبت‌شده' : x.estStatus === 'derived' ? 'مشتق‌شده' : 'ندارد') },
  ];
  const ok = (b: boolean) => (b ? '✔' : '✘');

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Button onClick={onBack}>← بازگشت به مقایسهٔ همهٔ قراردادها</Button>
      <Typography.Title level={4} style={{ margin: 0 }}>
        قرارداد {d.No} - {d.Title} — تا پایان {r.period}
      </Typography.Title>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 8 }}>
        <div>روش پیشرفت: <b>{labelOf(prog, d.ProgMethod)}</b></div>
        <div>مبلغ قرارداد: <b>{fmtNum(d.Amount)}</b></div>
        <div>درصد پیشرفت: <b>{d.computable ? pct(d.progressPct) : 'قابل‌محاسبه نیست'}</b></div>
        <div>مبنای محاسبه: {d.basis || '—'}</div>
        <div>درآمد قابل‌شناسایی (تجمعی): <b>{fmtNum(d.revCum)}</b></div>
        <div>درآمد این ماه: {fmtNum(d.rev)}</div>
        <div>بهای خدمات ارائه‌شده (تجمعی): <b>{fmtNum(d.costCum)}</b></div>
        <div>بهای این ماه: {fmtNum(d.cost)}</div>
        <div>سود (زیان) ناخالص تجمعی: <b>{fmtNum(d.gpCum)}</b></div>
        <div>سود ناخالص این ماه: {fmtNum(d.gp)}</div>
      </div>
      <Typography.Title level={5}>اجزای بهای خدمات ارائه‌شده</Typography.Title>
      <Table
        size="small"
        rowKey="k"
        pagination={false}
        dataSource={compRows}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: 'جزء', dataIndex: 'name' },
          { title: 'هزینهٔ انجام‌شده تا امروز', dataIndex: 'inc' },
          { title: 'مورد شناسایی (بهای خدمات)', dataIndex: 'rec' },
        ]}
      />
      <Hint>شناخت هزینهٔ کسب: {d.acqWhy}</Hint>
      <Typography.Title level={5}>برآورد تکمیل (EAC) به تفکیک عنصر</Typography.Title>
      <Table
        size="small"
        rowKey="Code"
        pagination={false}
        dataSource={d.lines}
        columns={lcols}
        scroll={{ x: 'max-content' }}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={2}>جمع</Table.Summary.Cell>
            <Table.Summary.Cell index={2}>{fmtNum(d.eac.actual)}</Table.Summary.Cell>
            <Table.Summary.Cell index={3}>{fmtNum(d.eac.remaining)}</Table.Summary.Cell>
            <Table.Summary.Cell index={4}>{nz(d.eac.total)}</Table.Summary.Cell>
            <Table.Summary.Cell index={5} />
          </Table.Summary.Row>
        )}
      />
      <Typography.Title level={5}>آزمون قرارداد زیان‌ده</Typography.Title>
      <div>
        برآورد کل هزینهٔ قرارداد: <b>{nz(d.eac.total)}</b> | مبلغ قرارداد: <b>{fmtNum(d.Amount)}</b> | حاشیهٔ مورد انتظار: <b>{nz(d.expectedMargin)}</b> |{' '}
        {d.loss > 0 ? (
          <>
            <Tag color="red">زیان کل مورد انتظار: {fmtNum(d.loss)}</Tag> ذخیرهٔ زیان باقی‌مانده (زیان کل − زیان شناخته‌شده در سود ناخالص): <b>{fmtNum(d.provision)}</b>
          </>
        ) : (
          'قرارداد زیان‌ده نیست.'
        )}
      </div>
      <Hint>[نیازمند تأیید: مبنای شناسایی و ذخیرهٔ قرارداد زیان‌ده — استاندارد ۴۳ و ۱۴۲؛ صدور سند ذخیره در «صدور سند و گزارش جامع»]</Hint>
      <Typography.Title level={5}>روند ماه‌به‌ماه</Typography.Title>
      <Table size="small" rowKey="period" pagination={false} dataSource={d.schedule} columns={scols} scroll={{ x: 'max-content' }} />
      <Hint>
        کنترل: جمع اجزای بها = بهای تجمعی {ok(d.check.equal)} | جمع درآمد ماهانه = درآمد تجمعی {ok(d.check.revEqual)} | جمع بهای ماهانه = بهای تجمعی {ok(d.check.costEqual)}
      </Hint>
      <Warnings list={d.warnings} />
      <Hint>{r.disclaimer}</Hint>
    </Space>
  );
}
