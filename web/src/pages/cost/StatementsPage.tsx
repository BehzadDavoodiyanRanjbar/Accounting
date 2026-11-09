import { CheckOutlined, RollbackOutlined } from '@ant-design/icons';
import { App, Button, Modal, Select, Space, Tag } from 'antd';
import { useMemo, useState } from 'react';
import { errorMessage } from '../../api/client';
import { useCompany } from '../../api/CompanyContext';
import { csCall } from '../../api/costService';
import { CrudPage } from '../../kit/CrudPage';
import { fmtNum, str, todayJalali } from '../../kit/format';
import { useCostCfg, useKindActions, useKindList } from '../../kit/hooks';
import { PreviewBox } from '../../kit/PreviewBox';
import type { ColSpec, FormSpec, Row } from '../../kit/types';

const num = (v: unknown) => Number(String(v ?? '').replace(/,/g, '')) || 0;

interface CostContractOpt {
  id: string;
  Kind: string;
  No: string;
  Title: string;
}

/** صورت‌وضعیت پیمانکاران دست‌دوم */
export default function StatementsPage() {
  const { company } = useCompany();
  const { message, notification } = App.useApp();
  const cfg = useCostCfg();
  const [cc, setCc] = useState('');
  const list = useKindList<Row>('stmt', { cc });
  const act = useKindActions('stmt');

  const subs = ((cfg.data?.options.costContracts as CostContractOpt[] | undefined) ?? [])
    .filter((c) => c.Kind === 'sub')
    .map((c) => ({ value: c.id, label: `${c.No} - ${c.Title}` }));
  const rows = list.data?.rows ?? [];

  const cols = useMemo<ColSpec<Row>[]>(
    () => [
      { id: 'No', label: 'شماره', get: (r) => str(r.No), width: 100 },
      { id: 'DateJalali', label: 'تاریخ', get: (r) => str(r.DateJalali), width: 110 },
      { id: 'Party', label: 'پیمانکار / قرارداد', get: (r) => `${str(r.SupplierName)} — ${str(r.CCNo)} ${str(r.CCTitle)}`, width: 260 },
      { id: 'Gross', label: 'ناخالص', get: (r) => num(r.Gross), type: 'number', width: 140 },
      { id: 'AdvDeduct', label: 'پیش‌پرداخت', get: (r) => num(r.AdvDeduct), type: 'number', width: 130 },
      { id: 'Retention', label: 'سپرده', get: (r) => num(r.Retention), type: 'number', width: 120 },
      { id: 'DedTotal', label: 'سایر کسورات', get: (r) => num(r.DedTotal), type: 'number', width: 130 },
      { id: 'Net', label: 'خالص پرداختنی', get: (r) => num(r.Net), type: 'number', width: 150 },
      {
        id: 'Status',
        label: 'وضعیت',
        get: (r) => (r.Status === 'approved' ? 'تأییدشده' : 'پیش‌نویس'),
        type: 'select',
        options: [{ value: 'تأییدشده', label: 'تأییدشده' }, { value: 'پیش‌نویس', label: 'پیش‌نویس' }],
        render: (r) => (r.Status === 'approved' ? <Tag color="green">تأییدشده</Tag> : <Tag>پیش‌نویس</Tag>),
        width: 110,
      },
    ],
    [],
  );

  const stmtObj = (v: Row, id: string): Row => ({ STID: id, CCID: str(v.CCID), No: str(v.No), DateJalali: str(v.DateJalali), Gross: str(v.Gross), AdvDeduct: str(v.AdvDeduct), Notes: str(v.Notes) });

  const buildForm = (row: Row | null): FormSpec => ({
    title: row ? 'ویرایش صورت‌وضعیت' : 'صورت‌وضعیت جدید',
    fields: [
      { name: 'CCID', label: 'قرارداد پیمانکار', type: 'select', required: true, options: subs, span: 12 },
      { name: 'No', label: 'شماره (خودکار)', span: 6 },
      { name: 'DateJalali', label: 'تاریخ', type: 'date', required: true, span: 6 },
      { name: 'Gross', label: 'مبلغ ناخالص کار انجام‌شده (ریال)', type: 'money', required: true, span: 12 },
      { name: 'AdvDeduct', label: 'کسر پیش‌پرداخت (خالی = خودکار)', type: 'money', span: 12 },
      { name: 'Notes', label: 'توضیحات', span: 24 },
    ],
    initial: row ? { ...row, Gross: str(row.Gross), AdvDeduct: str(row.AdvDeduct) } : { DateJalali: todayJalali(), CCID: cc || undefined },
  });

  const setStatus = (r: Row, to: 'approved' | 'draft') =>
    Modal.confirm({
      title: 'تأیید',
      content: to === 'approved' ? `صورت‌وضعیت ${str(r.No)} تأیید و در دفتر هزینه ثبت شود؟` : 'تأیید برگردانده شود و ردیف دفتر هزینه حذف شود؟',
      okText: 'بله',
      cancelText: 'انصراف',
      onOk: async () => {
        try {
          await csCall('csStmtStatus', company, { id: str(r.STID), status: to });
          message.success('انجام شد.');
          await act.refresh();
        } catch (e) {
          notification.error({ message: 'انجام نشد', description: errorMessage(e) });
        }
      },
    });

  return (
    <CrudPage<Row>
      title="صورت‌وضعیت پیمانکاران دست‌دوم"
      hint="هر صورت‌وضعیت با مبلغ ناخالص کار انجام‌شده ثبت می‌شود؛ پیش‌پرداخت، سپرده و سایر کسورات طبق شرایط «قرارداد هزینه‌ای» محاسبه می‌شود. پس از «تأیید»، فقط مبلغ ناخالص کار انجام‌شده (هزینهٔ پیمانکار) در دفتر هزینهٔ قرارداد ثبت می‌شود؛ ثبت بدهی به پیمانکار در این مرحله انجام نمی‌شود. [نیازمند تأیید: درصدهای کسورات طبق قرارداد و قانون]"
      rows={rows}
      loading={list.isFetching}
      error={list.isError ? errorMessage(list.error) : null}
      onReload={() => void list.refetch()}
      cols={cols}
      getId={(r) => str(r.STID)}
      nameOf={(r) => `صورت‌وضعیت ${str(r.No)}`}
      filters={
        <Space>
          <span>قرارداد پیمانکار</span>
          <Select style={{ minWidth: 300 }} allowClear showSearch optionFilterProp="label" placeholder="همه" value={cc || undefined} options={subs} onChange={(v) => setCc(v ?? '')} />
        </Space>
      }
      newButtons={[{ label: 'صورت‌وضعیت جدید' }]}
      buildForm={buildForm}
      onSave={async (v, row) => {
        const r = await act.save(stmtObj(v, row ? str(row.STID) : ''));
        message.success(`ذخیره شد. خالص: ${fmtNum(r.Net)}`);
      }}
      onDelete={(r) => act.remove(str(r.STID))}
      canEdit={(r) => r.Status !== 'approved'}
      canDelete={(r) => r.Status !== 'approved'}
      rowActions={(r) =>
        r.Status === 'approved' ? (
          <Button size="small" icon={<RollbackOutlined />} onClick={() => setStatus(r, 'draft')}>
            برگشت از تأیید
          </Button>
        ) : (
          <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => setStatus(r, 'approved')}>
            تأیید
          </Button>
        )
      }
      actionsWidth={290}
      drawerExtra={(v) => (
        <div style={{ marginTop: 8 }}>
          <PreviewBox
            run={async () => {
              const r = await csCall<Row>('csStmtCalc', company, { obj: stmtObj(v, '') });
              const ded = (Array.isArray(r.Deductions) ? r.Deductions : []) as Row[];
              return (
                <div>
                  <b>خالص پرداختنی: {fmtNum(r.Net)}</b>
                  <div>{str(r.Formula)}</div>
                  <div>
                    سپرده: {fmtNum(r.Retention)} | کسورات: {ded.map((d) => `${str(d.name)} ${fmtNum(d.amount)} (${str(d.pct)}٪ ${str(d.src)})`).join('، ')}
                  </div>
                  <div>
                    جمع صورت‌وضعیت‌ها با این مورد: {fmtNum(r.grossSum)} از {fmtNum(r.contractAmount)} | باقیماندهٔ پیش‌پرداخت پس از این: {fmtNum(r.advRemain)}
                  </div>
                </div>
              );
            }}
          />
        </div>
      )}
      defaultSort={{ id: 'DateJalali', desc: true }}
      storageKey="mt_v2_cols_cs_st"
    />
  );
}
