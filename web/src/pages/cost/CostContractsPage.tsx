import { Tag } from 'antd';
import { useMemo } from 'react';
import { errorMessage } from '../../api/client';
import { CrudPage } from '../../kit/CrudPage';
import { fmtNum, str, toOpts } from '../../kit/format';
import { useCostCfg, useKindActions, useKindList } from '../../kit/hooks';
import type { ColSpec, FieldDef, FormSpec, Row } from '../../kit/types';
import { contractOpts, isTrue, labelOf, machineOpts, supplierOpts } from './helpers';

const KIND_LABEL: Record<string, string> = { sub: 'پیمانکار دست‌دوم', rent: 'اجاره' };

/** قراردادهای هزینه‌ای: پیمانکار دست‌دوم (sub) و اجارهٔ ماشین/تجهیز (rent) */
export default function CostContractsPage() {
  const cfg = useCostCfg();
  const list = useKindList<Row>('cc');
  const act = useKindActions('cc');
  const o = cfg.data?.options;
  const rows = list.data?.rows ?? [];

  const cols = useMemo<ColSpec<Row>[]>(
    () => [
      { id: 'Kind', label: 'نوع', get: (r) => KIND_LABEL[str(r.Kind)] ?? str(r.Kind), type: 'select', options: Object.values(KIND_LABEL).map((v) => ({ value: v, label: v })), width: 150 },
      { id: 'No', label: 'شماره', get: (r) => str(r.No), width: 100 },
      { id: 'Title', label: 'عنوان', get: (r) => str(r.Title), width: 200 },
      { id: 'ContractNo', label: 'قرارداد اصلی', get: (r) => str(r.ContractNo), width: 130 },
      { id: 'SupplierName', label: 'طرف قرارداد', get: (r) => str(r.SupplierName), width: 170 },
      {
        id: 'Terms',
        label: 'شرایط',
        width: 320,
        get: (r) =>
          r.Kind === 'sub'
            ? `مبلغ ${fmtNum(r.Amount)}${str(r.AdvPct) !== '' ? ` | پیش‌پرداخت ٪${r.AdvPct}` : ''}${str(r.RetPct) !== '' ? ` | سپرده ٪${r.RetPct}` : ''}`
            : `${labelOf(o?.rateUnit, r.RateUnit)} ${fmtNum(r.Rate)}${r.Operator ? ' | با اپراتور' : ' | بدون اپراتور'} | سوخت: ${r.FuelBy === 'owner' ? 'موجر' : 'مستأجر'}${r.MachName ? ` | ${r.MachName}` : ''}`,
      },
      {
        id: 'Status',
        label: 'وضعیت',
        get: (r) => labelOf(o?.status, r.Status),
        type: 'select',
        options: toOpts(o?.status).map((x) => ({ value: x.label, label: x.label })),
        render: (r) => <Tag>{labelOf(o?.status, r.Status)}</Tag>,
        width: 110,
      },
    ],
    [o],
  );

  const buildForm = (row: Row | null, variant?: string): FormSpec => {
    const kind = row ? str(row.Kind) : variant ?? 'sub';
    const isSub = kind === 'sub';
    const common: FieldDef[] = [
      { name: 'ContractID', label: 'قرارداد اصلی', type: 'select', required: true, options: contractOpts(cfg.data), span: 12 },
      { name: 'No', label: 'شماره', required: true, span: 6 },
      { name: 'Title', label: 'عنوان', required: true, span: 12 },
      { name: 'SupplierID', label: isSub ? 'پیمانکار' : 'موجر', type: 'select', required: true, options: supplierOpts(cfg.data), span: 12 },
      { name: 'StartJ', label: 'تاریخ شروع', type: 'date', span: 8 },
      { name: 'EndJ', label: 'تاریخ پایان', type: 'date', span: 8 },
      { name: 'Status', label: 'وضعیت', type: 'select', options: toOpts(o?.status), required: true, span: 8 },
    ];
    const sub: FieldDef[] = [
      { name: 'Amount', label: 'مبلغ قرارداد (ریال)', type: 'money', required: true, span: 8 },
      { name: 'AdvPct', label: 'درصد پیش‌پرداخت', type: 'number', span: 8 },
      { name: 'RetPct', label: 'درصد سپردهٔ حسن انجام کار', type: 'number', span: 8 },
      {
        name: 'Deductions',
        label: 'سایر کسورات قانونی/قراردادی (از صورت‌وضعیت)',
        type: 'items',
        addLabel: 'افزودن کسر',
        items: [
          { name: 'name', label: 'نام کسر', width: 220 },
          { name: 'pct', label: 'درصد', type: 'money', width: 100 },
        ],
        help: 'درصدها را خودتان (طبق قانون و قرارداد) وارد کنید؛ نرم‌افزار عدد ثابتی فرض نمی‌کند.',
      },
    ];
    const rent: FieldDef[] = [
      { name: 'RateUnit', label: 'واحد نرخ', type: 'select', options: toOpts(o?.rateUnit as Record<string, string> | undefined), span: 8 },
      { name: 'Rate', label: 'نرخ اجاره (ریال)', type: 'money', required: true, span: 8 },
      { name: 'FuelBy', label: 'مسئول سوخت', type: 'select', options: [{ value: 'tenant', label: 'مستأجر (ما)' }, { value: 'owner', label: 'موجر' }], span: 8 },
      { name: 'MachID', label: 'ماشین/تجهیز', type: 'select', options: machineOpts(cfg.data), span: 12 },
      { name: 'Operator', label: 'همراه با اپراتور', type: 'check', span: 12 },
    ];
    const tail: FieldDef[] = [{ name: 'Notes', label: 'توضیحات', type: 'textarea', span: 24 }];

    let initial: Row;
    if (row) {
      let ded: unknown[] = [];
      try {
        ded = row.Deductions ? (JSON.parse(str(row.Deductions)) as unknown[]) : [];
      } catch {
        ded = [];
      }
      initial = { ...row, Amount: str(row.Amount), AdvPct: str(row.AdvPct), RetPct: str(row.RetPct), Rate: str(row.Rate), Operator: isTrue(row.Operator), Deductions: ded };
    } else {
      initial = { Status: 'draft', FuelBy: 'tenant', RateUnit: 'hour', Deductions: [] };
    }
    return {
      title: `${row ? 'ویرایش' : 'جدید'} — ${isSub ? 'پیمانکار دست‌دوم' : 'اجارهٔ ماشین‌آلات / تجهیزات'}`,
      fields: [...common, ...(isSub ? sub : rent), ...tail],
      initial,
    };
  };

  return (
    <CrudPage<Row>
      title="قراردادهای هزینه‌ای (پیمانکار دست‌دوم و اجارهٔ ماشین‌آلات)"
      hint="هر قرارداد هزینه‌ای به یک قرارداد اصلی وصل است. درصدهای کسورات را خودتان (طبق قانون و قرارداد) وارد کنید؛ نرم‌افزار عدد ثابتی فرض نمی‌کند."
      rows={rows}
      loading={list.isFetching}
      error={list.isError ? errorMessage(list.error) : null}
      onReload={() => void list.refetch()}
      cols={cols}
      getId={(r) => str(r.CCID)}
      nameOf={(r) => `${str(r.No)} - ${str(r.Title)}`}
      newButtons={[{ label: 'پیمانکار دست‌دوم جدید', variant: 'sub' }, { label: 'اجارهٔ ماشین/تجهیز جدید', variant: 'rent' }]}
      variantOf={(r) => str(r.Kind)}
      buildForm={buildForm}
      onSave={async (v, row, variant) => {
        const kind = row ? str(row.Kind) : variant ?? 'sub';
        const obj: Row = { ...v, CCID: row ? str(row.CCID) : '', Kind: kind };
        if (kind === 'sub') {
          const ded = Array.isArray(v.Deductions) ? (v.Deductions as Row[]) : [];
          obj.Deductions = ded
            .filter((d) => str(d.name).trim() !== '' || str(d.pct).trim() !== '')
            .map((d) => ({ name: str(d.name), pct: str(d.pct), src: str(d.src) || '[نیازمند تأیید]', verify: d.verify !== false }));
        } else {
          obj.Operator = !!v.Operator;
        }
        await act.save(obj);
      }}
      onDelete={(r) => act.remove(str(r.CCID))}
      storageKey="mt_v2_cols_cs_cc"
    />
  );
}
