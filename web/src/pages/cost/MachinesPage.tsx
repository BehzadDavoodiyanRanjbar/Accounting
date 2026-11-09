import { Tag } from 'antd';
import { useMemo } from 'react';
import { errorMessage } from '../../api/client';
import { CrudPage } from '../../kit/CrudPage';
import { str, toOpts } from '../../kit/format';
import { useCostCfg, useCsQuery, useKindActions, useKindList } from '../../kit/hooks';
import type { ColSpec, FormSpec, Row } from '../../kit/types';
import { isTrue, labelOf } from './helpers';

interface AccOptions {
  accounts: Array<{ AccID: string; Code: string; Name: string }>;
}

/** ماشین‌آلات و تجهیزات: خودی (با استهلاک) و اجاره‌ای (فقط نام) */
export default function MachinesPage() {
  const cfg = useCostCfg();
  const list = useKindList<Row>('machine');
  const acc = useCsQuery<AccOptions>('accOptions', {});
  const act = useKindActions('machine');
  const o = cfg.data?.options;
  const rows = list.data?.rows ?? [];

  const accOpts = (prefix: string) =>
    (acc.data?.accounts ?? []).filter((a) => String(a.Code).indexOf(prefix) === 0).map((a) => ({ value: a.AccID, label: `${a.Code} - ${a.Name}` }));

  const cols = useMemo<ColSpec<Row>[]>(
    () => [
      { id: 'Code', label: 'کد', get: (r) => str(r.Code), width: 100 },
      { id: 'Name', label: 'نام', get: (r) => str(r.Name), width: 200 },
      { id: 'Own', label: 'مالکیت', get: (r) => (isTrue(r.Own) ? 'خودی' : 'اجاره‌ای'), type: 'select', options: [{ value: 'خودی', label: 'خودی' }, { value: 'اجاره‌ای', label: 'اجاره‌ای' }], width: 110 },
      { id: 'Cost', label: 'بهای تمام‌شده', get: (r) => (isTrue(r.Own) ? Number(String(r.Cost).replace(/,/g, '')) || 0 : null), type: 'number', width: 150 },
      { id: 'Salvage', label: 'ارزش اسقاط', get: (r) => (isTrue(r.Own) ? Number(String(r.Salvage).replace(/,/g, '')) || 0 : null), type: 'number', width: 140 },
      { id: 'Depr', label: 'روش استهلاک', get: (r) => (isTrue(r.Own) ? labelOf(o?.depr, r.DeprMethod) : ''), width: 150 },
      {
        id: 'IsActive',
        label: 'وضعیت',
        get: (r) => (r.IsActive === false || r.IsActive === '0' ? 'غیرفعال' : 'فعال'),
        type: 'select',
        options: [{ value: 'فعال', label: 'فعال' }, { value: 'غیرفعال', label: 'غیرفعال' }],
        render: (r) => (r.IsActive === false || r.IsActive === '0' ? <Tag>غیرفعال</Tag> : <Tag color="green">فعال</Tag>),
        width: 100,
      },
    ],
    [o],
  );

  const buildForm = (row: Row | null): FormSpec => ({
    title: row ? 'ویرایش ماشین / تجهیز' : 'ماشین / تجهیز جدید',
    fields: [
      { name: 'Code', label: 'کد (خودکار)', placeholder: 'خودکار', span: 8 },
      { name: 'Name', label: 'نام', required: true, span: 16 },
      { name: 'Own', label: 'متعلق به خود شرکت است (استهلاک دارد)', type: 'check' },
      { name: 'Cost', label: 'بهای تمام‌شدهٔ دارایی (ریال)', type: 'money', required: true, span: 12, visible: (v) => !!v.Own },
      { name: 'Salvage', label: 'ارزش اسقاط (ریال)', type: 'money', span: 12, visible: (v) => !!v.Own },
      { name: 'LifeYears', label: 'عمر مفید (سال)', type: 'number', span: 12, visible: (v) => !!v.Own },
      { name: 'EstHours', label: 'ساعت مفید برآوردی', type: 'number', span: 12, visible: (v) => !!v.Own },
      { name: 'DeprMethod', label: 'روش استهلاک', type: 'select', options: toOpts(o?.depr), span: 12, visible: (v) => !!v.Own },
      { name: 'InServiceJ', label: 'تاریخ شروع بهره‌برداری', type: 'date', span: 12, visible: (v) => !!v.Own },
      { name: 'AssetAccID', label: 'حساب دارایی', type: 'select', options: accOpts('21'), span: 12, visible: (v) => !!v.Own },
      { name: 'AccumAccID', label: 'حساب استهلاک انباشته', type: 'select', options: accOpts('22'), span: 12, visible: (v) => !!v.Own },
      { name: 'IsActive', label: 'فعال', type: 'check' },
      { name: 'Notes', label: 'توضیحات', type: 'textarea', span: 24 },
    ],
    initial: row
      ? { ...row, Own: isTrue(row.Own), IsActive: !(row.IsActive === false || row.IsActive === '0'), Cost: str(row.Cost), Salvage: str(row.Salvage), LifeYears: str(row.LifeYears), EstHours: str(row.EstHours) }
      : { Own: true, IsActive: true, DeprMethod: 'sl' },
  });

  return (
    <CrudPage<Row>
      title="ماشین‌آلات و تجهیزات"
      hint="ماشین‌های متعلق به خود (با اطلاعات استهلاک) و ماشین‌های اجاره‌ای (فقط نام، برای قرارداد اجاره). روش استهلاک و ساعت مفید را خودتان تعیین می‌کنید؛ مبنای استاندارد ۱۱ با برچسب «نیازمند تأیید» نگه‌داری می‌شود. نرخ ساعتی در مرحلهٔ «کارکرد و هزینه ماشین‌آلات» محاسبه می‌شود."
      rows={rows}
      loading={list.isFetching}
      error={list.isError ? errorMessage(list.error) : null}
      onReload={() => void list.refetch()}
      cols={cols}
      getId={(r) => str(r.MachID)}
      nameOf={(r) => str(r.Name)}
      newButtons={[{ label: 'ماشین / تجهیز جدید' }]}
      buildForm={buildForm}
      onSave={async (v, row) => {
        const own = !!v.Own;
        const obj: Row = { ...v, MachID: row ? str(row.MachID) : '', Own: own, IsActive: v.IsActive !== false };
        await act.save(obj);
      }}
      onDelete={(r) => act.remove(str(r.MachID))}
      storageKey="mt_v2_cols_cs_mc"
    />
  );
}
