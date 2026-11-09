import { Space, Tabs, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { errorMessage } from '../../api/client';
import { CrudPage } from '../../kit/CrudPage';
import { str } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import type { ColSpec, FieldDef, FormSpec, Row } from '../../kit/types';
import { isOn, useBankCall } from '../bank/common';

type Kind = 'detail' | 'emp' | 'proj';
const NAMES: Record<Kind, { t: string; tp: string; key: string; hint: string }> = {
  detail: { t: 'تفصیلی', tp: 'تفصیلی‌های عمومی', key: 'DetID', hint: '«تفصیلی عمومی» (سطح ۴): برای حساب‌هایی که تفصیلی دارند (مثلاً اسناد پرداختنی، جاری شرکا). بانک/صندوق/تنخواه از «بانکداری» و کالا از «کالاها» خوانده می‌شود.' },
  emp: { t: 'کارمند', tp: 'کارکنان', key: 'EmpID', hint: 'کارکنان (سطح ۵: شخص / مرکز هزینه). خریداران و فروشندگان از «اطلاعات پایه» خوانده می‌شوند.' },
  proj: { t: 'پروژه', tp: 'پروژه‌ها', key: 'ProjID', hint: 'پروژه‌ها (سطح ۶). می‌توانید در سند، روی هر ردیف یا کل سند پروژه انتخاب کنید.' },
};

/** تفصیلی عمومی، کارکنان و پروژه‌ها */
export default function DimensionsPage() {
  const [kind, setKind] = useState<Kind>('detail');
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        تفصیلی / کارکنان / پروژه
      </Typography.Title>
      <Tabs
        activeKey={kind}
        onChange={(k) => setKind(k as Kind)}
        items={(Object.keys(NAMES) as Kind[]).map((k) => ({ key: k, label: NAMES[k].tp }))}
      />
      <DimList key={kind} kind={kind} />
    </Space>
  );
}

function DimList({ kind }: { kind: Kind }) {
  const N = NAMES[kind];
  const emp = kind === 'emp';
  const q = useCsQuery<{ rows: Row[] }>('accDimList', { kind });
  const call = useBankCall();
  const rows = q.data?.rows ?? [];

  const cols = useMemo<ColSpec<Row>[]>(
    () => [
      { id: 'Code', label: 'کد', get: (r) => str(r.Code), width: 100 },
      { id: 'Name', label: 'نام', get: (r) => str(r.Name), width: 220 },
      ...(emp
        ? ([
            { id: 'NationalID', label: 'کد ملی', get: (r) => str(r.NationalID), width: 130 },
            { id: 'Position', label: 'سمت', get: (r) => str(r.Position), width: 140 },
          ] as ColSpec<Row>[])
        : []),
      { id: 'Notes', label: 'توضیحات', get: (r) => str(r.Notes), width: 220 },
      {
        id: 'IsActive',
        label: 'وضعیت',
        get: (r) => `${isOn(r.IsActive) ? 'فعال' : 'غیرفعال'}${r.Used ? ` (${str(r.Used)} ردیف سند)` : ''}`,
        render: (r) => (
          <span>
            <Tag color={isOn(r.IsActive) ? 'green' : 'default'}>{isOn(r.IsActive) ? 'فعال' : 'غیرفعال'}</Tag>
            {r.Used ? <Typography.Text type="secondary">{str(r.Used)} ردیف سند</Typography.Text> : null}
          </span>
        ),
        width: 190,
      },
    ],
    [emp],
  );

  const buildForm = (row: Row | null): FormSpec => {
    const fields: FieldDef[] = [
      { name: 'Code', label: `کد${row ? '' : ' (خودکار)'}`, span: 8, placeholder: 'خودکار' },
      { name: 'Name', label: 'نام', required: true, span: 16 },
      ...(emp ? ([{ name: 'NationalID', label: 'کد ملی', span: 12 }, { name: 'Position', label: 'سمت', span: 12 }] as FieldDef[]) : []),
      { name: 'Notes', label: 'توضیحات', span: 24 },
      { name: 'IsActive', label: 'فعال', type: 'check', span: 6 },
    ];
    return {
      title: `${row ? 'ویرایش' : 'ثبت'} ${N.t}`,
      fields,
      initial: row ? { Code: str(row.Code), Name: str(row.Name), NationalID: str(row.NationalID), Position: str(row.Position), Notes: str(row.Notes), IsActive: isOn(row.IsActive) } : { IsActive: true },
    };
  };

  return (
    <CrudPage<Row>
      title=""
      hint={N.hint}
      rows={rows}
      loading={q.isFetching}
      error={q.isError ? errorMessage(q.error) : null}
      onReload={() => void q.refetch()}
      cols={cols}
      getId={(r) => str(r[N.key])}
      nameOf={(r) => str(r.Name)}
      newButtons={[{ label: `${N.t} جدید` }]}
      buildForm={buildForm}
      onSave={async (v, row) => {
        const o: Row = { Code: str(v.Code), Name: str(v.Name), Notes: str(v.Notes), IsActive: !!v.IsActive, [N.key]: row ? str(row[N.key]) : '' };
        if (emp) {
          o.NationalID = str(v.NationalID);
          o.Position = str(v.Position);
        }
        await call('accDimSave', { kind, obj: o });
      }}
      onDelete={async (r) => {
        await call('accDimDelete', { kind, id: str(r[N.key]) });
      }}
      emptyText="هنوز موردی ثبت نشده است."
      storageKey={`mt_v2_cols_ac_dim_${kind}`}
    />
  );
}
