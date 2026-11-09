import { Alert, Card, Space, Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { errorMessage } from '../../api/client';
import { CrudPage } from '../../kit/CrudPage';
import { fmtNum, str, thisPeriod, toOpts } from '../../kit/format';
import { useCostCfg, useCsQuery, useKindActions, useKindList } from '../../kit/hooks';
import type { ColSpec, FormSpec, Row } from '../../kit/types';
import { Hint, PeriodInput, RunButtons } from './common';
import { contractOpts, labelOf } from './helpers';

interface MobRates {
  locked: boolean;
  items: Array<{ ContractNo: string; Title: string; Total: number; K: number | string; N: number | string; Amount: number; Formula: string }>;
  skipped: Array<{ Title: string; ContractNo: string; why: string }>;
}

/** تجهیز و برچیدن کارگاه */
export default function MobilizationPage() {
  const cfg = useCostCfg();
  const list = useKindList<Row>('mob');
  const act = useKindActions('mob');
  const [period, setPeriod] = useState(thisPeriod());
  const o = cfg.data?.options;
  const mobk = o?.mobk as Record<string, string> | undefined;
  const rows = list.data?.rows ?? [];

  const cols = useMemo<ColSpec<Row>[]>(
    () => [
      { id: 'ContractNo', label: 'قرارداد', get: (r) => str(r.ContractNo), width: 120 },
      { id: 'Kind', label: 'نوع', get: (r) => labelOf(mobk, r.Kind), width: 120 },
      { id: 'Title', label: 'عنوان', get: (r) => str(r.Title), width: 220 },
      { id: 'Amount', label: 'مبلغ', get: (r) => Number(r.Amount) || 0, type: 'number', width: 140 },
      { id: 'MobAlloc', label: 'روش تسهیم قرارداد', get: (r) => labelOf(o?.mob, r.MobAlloc), width: 190 },
      { id: 'Posted', label: 'تسهیم‌شده تا کنون', get: (r) => Number(r.Posted) || 0, type: 'number', width: 160 },
    ],
    [mobk, o?.mob],
  );

  const buildForm = (row: Row | null): FormSpec => ({
    title: row ? 'ویرایش' : 'تجهیز / برچیدن کارگاه',
    fields: [
      { name: 'ContractID', label: 'قرارداد', type: 'select', required: true, options: contractOpts(cfg.data), span: 12 },
      { name: 'Kind', label: 'نوع', type: 'select', options: toOpts(mobk), span: 12 },
      { name: 'Title', label: 'عنوان', required: true, span: 16 },
      { name: 'Amount', label: 'مبلغ (ریال)', type: 'money', required: true, span: 8 },
      { name: 'Notes', label: 'توضیحات', span: 24 },
    ],
    initial: row ? { ...row, Amount: str(row.Amount) } : { Kind: 'setup' },
  });

  const q = useCsQuery<MobRates>('csMobRates', { period });
  const r = q.data;
  const icols: TableColumnsType<MobRates['items'][number]> = [
    { title: 'قرارداد', key: 'c', render: (_, x) => x.ContractNo },
    { title: 'عنوان', key: 't', render: (_, x) => x.Title },
    { title: 'مبلغ کل', key: 'm', render: (_, x) => fmtNum(x.Total) },
    { title: 'ماه‌های قرارداد', key: 'k', render: (_, x) => `${x.K} از ${x.N}` },
    { title: 'این ماه', key: 'a', render: (_, x) => <b>{fmtNum(x.Amount)}</b> },
    { title: 'فرمول', key: 'f', render: (_, x) => <Typography.Text type="secondary">{x.Formula}</Typography.Text> },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <CrudPage<Row>
        title="تجهیز و برچیدن کارگاه"
        hint="مبلغ تجهیز کارگاه (و برآورد برچیدن) هر قرارداد را وارد کنید؛ طبق «روش تسهیم» همان قرارداد (خط مستقیم طی ماه‌های قرارداد) ماه‌به‌ماه به بهای قرارداد منتقل می‌شود. گرد کردن تجمعی است و جمع ماه‌ها دقیقاً برابر مبلغ می‌شود. روش «بر پایه پیشرفت» پس از مرحله ۵ فعال می‌شود و روش «دستی» از «دفتر هزینه» با عنصر E07 ثبت می‌شود. [نیازمند تأیید: ماهیت و نحوه‌ی شناخت هزینه‌ی برچیدن طبق استاندارد]"
        rows={rows}
        loading={list.isFetching}
        error={list.isError ? errorMessage(list.error) : null}
        onReload={() => void list.refetch()}
        cols={cols}
        getId={(x) => str(x.MobID)}
        nameOf={(x) => str(x.Title)}
        newButtons={[{ label: 'مبلغ تجهیز/برچیدن' }]}
        buildForm={buildForm}
        onSave={async (v, row) => {
          await act.save({ ...v, MobID: row ? str(row.MobID) : '' });
        }}
        onDelete={(x) => act.remove(str(x.MobID))}
        storageKey="mt_v2_cols_cs_mob"
      />
      <Card title="تسهیم ماهانه" loading={q.isLoading}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <PeriodInput value={period} onChange={setPeriod} />
          {q.isError ? <Alert type="error" showIcon message={errorMessage(q.error)} /> : null}
          {r ? (
            <>
              {r.locked ? <Alert type="success" showIcon message="تسهیم این ماه ثبت شده است." /> : null}
              <Table size="small" rowKey={(x) => `${x.ContractNo}-${x.Title}`} pagination={false} dataSource={r.items} columns={icols} scroll={{ x: 'max-content' }} locale={{ emptyText: 'مبلغی برای تسهیم در این ماه نیست.' }} />
              {r.skipped.length ? <Hint>رد شده: {r.skipped.map((s) => `${s.Title} (قرارداد ${s.ContractNo}: ${s.why})`).join('؛ ')}</Hint> : null}
              <RunButtons
                period={period}
                doAction="csMobRun"
                undoAction="csMobUndo"
                doLabel="ثبت تسهیم این ماه"
                undoLabel="لغو تسهیم این ماه"
                doText={`تسهیم تجهیز/برچیدن ماه ${period} ثبت شود؟`}
                undoText="تسهیم این ماه برداشته شود؟"
                resultText={(x, undo) => (undo ? `${String(x.removed)} ردیف برداشته شد.` : `${String(x.entries)} ردیف ثبت شد.`)}
                onDone={() => {
                  void q.refetch();
                  void list.refetch();
                }}
              />
            </>
          ) : null}
        </Space>
      </Card>
    </Space>
  );
}
