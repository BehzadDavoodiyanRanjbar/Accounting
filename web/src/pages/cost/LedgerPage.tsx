import { Alert, Button, Card, Col, Input, Row as GridRow, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '../../api/client';
import { CrudPage } from '../../kit/CrudPage';
import { fmtNum, str, todayJalali } from '../../kit/format';
import { useCostCfg, useCsQuery, useKindActions, useKindList } from '../../kit/hooks';
import type { ColSpec, FormSpec, Row } from '../../kit/types';
import { contractOpts, isTrue, labelOf } from './helpers';

interface CardResult {
  contract: { No: string; Title: string; Amount: string | number };
  periods: string[];
  rows: Array<{ Code: string; Name: string; byPeriod: Record<string, number>; total: number }>;
  periodTotals: Array<{ total: number; cumulative: number }>;
  totals: { all: number; product: number; asset: number; period: number };
  check: { equal: boolean };
}

const MANUAL = ['manual', 'purchase', 'expense', 'voucher'];

/** دفتر هزینهٔ قرارداد و کارت بهای تمام‌شده */
export default function LedgerPage() {
  const cfg = useCostCfg();
  const act = useKindActions('ledger');
  const o = cfg.data?.options;
  const cts = contractOpts(cfg.data);

  const [draft, setDraft] = useState({ contract: '', elem: '', from: '', to: '' });
  const [applied, setApplied] = useState(draft);

  // وقتی فهرست قراردادها آمد، اولین قرارداد انتخاب می‌شود
  useEffect(() => {
    if (!draft.contract && cts.length) {
      const d = { ...draft, contract: cts[0].value };
      setDraft(d);
      setApplied(d);
    }
  }, [cts, draft]);

  const params = { contract: applied.contract, elem: applied.elem, from: applied.from, to: applied.to };
  const list = useKindList<Row>('ledger', params, !!applied.contract);
  const card = useCsQuery<CardResult>('csCard', { contract: applied.contract, from: applied.from, to: applied.to }, !!applied.contract);
  const rows = list.data?.rows ?? [];

  const elemOpts = (cfg.data?.elements ?? []).filter((x) => x.IsActive).map((x) => ({ value: x.ElemID, label: `${x.Code} - ${x.Name}` }));

  const cols = useMemo<ColSpec<Row>[]>(
    () => [
      { id: 'DateJalali', label: 'تاریخ', get: (r) => str(r.DateJalali), type: 'text', width: 110 },
      { id: 'Period', label: 'دوره', get: (r) => str(r.Period), width: 90 },
      { id: 'ElemName', label: 'عنصر', get: (r) => str(r.ElemName), render: (r) => <span>{str(r.ElemName)} {isTrue(r.Abnormal) ? <Tag color="red">غیرعادی</Tag> : null}</span>, width: 170 },
      { id: 'Qty', label: 'مقدار', get: (r) => (str(r.Qty) === '' ? null : Number(String(r.Qty).replace(/,/g, ''))), type: 'number', width: 100 },
      { id: 'Rate', label: 'نرخ', get: (r) => (str(r.Rate) === '' ? null : Number(String(r.Rate).replace(/,/g, ''))), type: 'number', width: 120 },
      { id: 'Amount', label: 'مبلغ', get: (r) => Number(String(r.Amount).replace(/,/g, '')) || 0, type: 'number', width: 140 },
      { id: 'Treat', label: 'شناخت', get: (r) => labelOf(o?.treat, r.Treat), width: 120 },
      { id: 'Src', label: 'سند مبنا', get: (r) => `${labelOf(o?.src, r.SrcType)}: ${str(r.SrcID)}`, width: 180 },
      { id: 'Formula', label: 'فرمول / ورودی‌ها', get: (r) => str(r.Formula), width: 220 },
      { id: 'Description', label: 'توضیحات', get: (r) => str(r.Description), width: 180 },
    ],
    [o],
  );

  const buildForm = (row: Row | null): FormSpec => ({
    title: row ? 'ویرایش ردیف هزینه' : 'ردیف هزینهٔ جدید',
    fields: [
      { name: 'ContractID', label: 'قرارداد', type: 'select', required: true, options: cts, span: 12 },
      { name: 'ElemID', label: 'عنصر هزینه', type: 'select', required: true, span: 12, options: (cfg.data?.elements ?? []).filter((x) => x.IsActive || (row && x.ElemID === row.ElemID)).map((x) => ({ value: x.ElemID, label: `${x.Code} - ${x.Name} (${labelOf(o?.treat, x.Treat)})` })) },
      { name: 'DateJalali', label: 'تاریخ', type: 'date', required: true, span: 8 },
      { name: 'Qty', label: 'مقدار (اختیاری)', type: 'number', span: 8 },
      { name: 'Rate', label: 'نرخ (ریال)', type: 'money', span: 8 },
      { name: 'Amount', label: 'مبلغ (ریال)', type: 'money', required: true, span: 12, help: 'اگر «مقدار» و «نرخ» را بدهید، مبلغ = مقدار × نرخ به‌صورت دقیق (گرد به ریال) محاسبه می‌شود؛ در غیر این صورت فقط مبلغ را وارد کنید.' },
      { name: 'Abnormal', label: 'ضایعات/هزینهٔ غیرعادی (هزینهٔ دوره شود)', type: 'check', span: 12 },
      { name: 'SrcType', label: 'نوع سند مبنا', type: 'select', required: true, span: 8, options: MANUAL.map((k) => ({ value: k, label: labelOf(o?.src, k) })) },
      { name: 'SrcID', label: 'شمارهٔ/شناسهٔ سند مبنا', required: true, span: 16 },
      { name: 'Description', label: 'توضیحات', span: 24 },
    ],
    initial: row
      ? { ...row, Qty: str(row.Qty), Rate: str(row.Rate), Amount: str(row.Amount), Abnormal: isTrue(row.Abnormal) }
      : { ContractID: applied.contract, DateJalali: todayJalali(), SrcType: 'manual' },
  });

  const c = card.data;
  const periodCols: TableColumnsType<CardResult['rows'][number]> = c
    ? [
        { title: 'عنصر هزینه', key: 'e', render: (_, r) => `${r.Code} - ${r.Name}` },
        ...c.periods.map((q) => ({ title: q, key: q, render: (_: unknown, r: CardResult['rows'][number]) => fmtNum(r.byPeriod[q] || 0) })),
        { title: 'جمع', key: 'tot', render: (_, r) => <b>{fmtNum(r.total)}</b> },
      ]
    : [];

  const filters = (
    <Space wrap align="end">
      <div>
        <div>قرارداد</div>
        <Select style={{ minWidth: 260 }} showSearch optionFilterProp="label" placeholder="— انتخاب —" value={draft.contract || undefined} options={cts} onChange={(v) => setDraft({ ...draft, contract: v })} />
      </div>
      <div>
        <div>عنصر هزینه</div>
        <Select style={{ minWidth: 220 }} allowClear showSearch optionFilterProp="label" placeholder="همه" value={draft.elem || undefined} options={elemOpts} onChange={(v) => setDraft({ ...draft, elem: v ?? '' })} />
      </div>
      <div>
        <div>از تاریخ</div>
        <Input style={{ width: 130 }} placeholder="1405/01/01" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
      </div>
      <div>
        <div>تا تاریخ</div>
        <Input style={{ width: 130 }} placeholder="1405/12/29" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
      </div>
      <Button type="primary" onClick={() => setApplied(draft)}>
        نمایش
      </Button>
    </Space>
  );

  const summary = !applied.contract ? (
    <Alert type="info" showIcon message={cts.length ? 'قرارداد را انتخاب کنید.' : 'هنوز قراردادی ثبت نشده است؛ ابتدا از «قراردادها» یک قرارداد بسازید.'} />
  ) : card.isError ? (
    <Alert type="error" showIcon message="کارت بهای تمام‌شده خوانده نشد" description={errorMessage(card.error)} />
  ) : c ? (
    <Card loading={card.isFetching} title={`کارت بهای تمام‌شده — ${c.contract.No} ${c.contract.Title}`}>
      <Table size="small" rowKey="Code" pagination={false} dataSource={c.rows} columns={periodCols} scroll={{ x: 'max-content' }} summary={() => (
        <>
          <Table.Summary.Row>
            <Table.Summary.Cell index={0}>جمع دوره</Table.Summary.Cell>
            {c.periodTotals.map((q, i) => (
              <Table.Summary.Cell key={i} index={i + 1}>{fmtNum(q.total)}</Table.Summary.Cell>
            ))}
            <Table.Summary.Cell index={c.periodTotals.length + 1}><b>{fmtNum(c.totals.all)}</b></Table.Summary.Cell>
          </Table.Summary.Row>
          <Table.Summary.Row>
            <Table.Summary.Cell index={0}>جمع تجمعی</Table.Summary.Cell>
            {c.periodTotals.map((q, i) => (
              <Table.Summary.Cell key={i} index={i + 1}>{fmtNum(q.cumulative)}</Table.Summary.Cell>
            ))}
            <Table.Summary.Cell index={c.periodTotals.length + 1} />
          </Table.Summary.Row>
        </>
      )} />
      <GridRow gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={12} md={8} lg={4}><Statistic title="جزو بهای خدمات" value={fmtNum(c.totals.product)} /></Col>
        <Col xs={12} md={8} lg={4}><Statistic title="دارایی (هزینهٔ قرارداد)" value={fmtNum(c.totals.asset)} /></Col>
        <Col xs={12} md={8} lg={4}><Statistic title="هزینهٔ دوره" value={fmtNum(c.totals.period)} /></Col>
        <Col xs={12} md={8} lg={4}><Statistic title="جمع کل" value={fmtNum(c.totals.all)} /></Col>
        <Col xs={12} md={8} lg={4}><Statistic title="مبلغ قرارداد" value={fmtNum(c.contract.Amount)} /></Col>
      </GridRow>
      {c.check.equal ? null : <Typography.Text type="danger">هشدار: جمع عناصر با جمع دفتر برابر نیست.</Typography.Text>}
    </Card>
  ) : null;

  return (
    <CrudPage<Row>
      title="دفتر هزینه و کارت بهای تمام‌شدهٔ قرارداد"
      hint="هر هزینه یک ردیف با قرارداد، عنصر هزینه، دوره و سند مبنا است. مبلغ و فرمول هر ردیف (Audit Trail) در جدول دیده می‌شود. ردیف‌های تولیدشده از مراحل بعد (مواد، دستمزد، ماشین‌آلات ...) هم در همین دفتر جمع می‌شوند."
      rows={rows}
      loading={list.isFetching}
      error={list.isError ? errorMessage(list.error) : null}
      onReload={() => {
        void list.refetch();
        void card.refetch();
      }}
      cols={cols}
      getId={(r) => str(r.CLID)}
      nameOf={(r) => `${str(r.ElemName)} - ${fmtNum(r.Amount)}`}
      filters={filters}
      summary={summary}
      newButtons={[{ label: 'ثبت ردیف هزینه' }]}
      buildForm={buildForm}
      onSave={async (v, row) => {
        await act.save({ ...v, CLID: row ? str(row.CLID) : '', Abnormal: !!v.Abnormal });
        setApplied({ ...applied, contract: str(v.ContractID) });
        setDraft({ ...draft, contract: str(v.ContractID) });
      }}
      onDelete={(r) => act.remove(str(r.CLID))}
      canEdit={(r) => MANUAL.indexOf(str(r.SrcType)) >= 0}
      canDelete={(r) => MANUAL.indexOf(str(r.SrcType)) >= 0}
      rowActions={(r) => (MANUAL.indexOf(str(r.SrcType)) >= 0 ? null : <Typography.Text type="secondary">تولید خودکار</Typography.Text>)}
      defaultSort={{ id: 'DateJalali', desc: false }}
      storageKey="mt_v2_cols_cs_lg"
    />
  );
}
