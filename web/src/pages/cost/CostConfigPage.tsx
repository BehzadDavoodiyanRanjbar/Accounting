import { SaveOutlined } from '@ant-design/icons';
import { App, Button, Card, Checkbox, Input, Select, Space, Table, Tabs, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { errorMessage } from '../../api/client';
import { useCompany } from '../../api/CompanyContext';
import { csCall } from '../../api/costService';
import type { CostRule } from '../../api/types';
import { CrudPage } from '../../kit/CrudPage';
import { str, toOpts } from '../../kit/format';
import { useCostCfg, useKindActions } from '../../kit/hooks';
import type { ColSpec, FormSpec, Row } from '../../kit/types';
import { isTrue, labelOf } from './helpers';

const VerifyTag = ({ v }: { v?: boolean }) => (isTrue(v) ? <Tag color="orange">نیازمند تأیید</Tag> : null);
const activeOpts = [{ value: 'فعال', label: 'فعال' }, { value: 'غیرفعال', label: 'غیرفعال' }];

/** تنظیمات بهای تمام‌شده: عناصر هزینه، قواعد حسابداری، مبناهای تسهیم سربار */
export default function CostConfigPage() {
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          تنظیمات بهای تمام‌شده خدمات
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          هیچ قاعدهٔ حسابداری در برنامه ثابت نیست؛ همهٔ موارد زیر قابل‌ویرایش‌اند. موارد با برچسب «نیازمند تأیید» را با متن رسمی استاندارد/قانون تطبیق دهید و سپس تغییر دهید.
        </Typography.Paragraph>
      </div>
      <Tabs
        items={[
          { key: 'elem', label: 'عناصر هزینه', children: <ElementsTab /> },
          { key: 'rule', label: 'قواعد حسابداری', children: <RulesTab /> },
          { key: 'base', label: 'مبناهای تسهیم سربار', children: <BasesTab /> },
        ]}
      />
    </Space>
  );
}

function ElementsTab() {
  const cfg = useCostCfg();
  const act = useKindActions('elem');
  const o = cfg.data?.options;
  const rows = (cfg.data?.elements ?? []) as unknown as Row[];

  const cols = useMemo<ColSpec<Row>[]>(
    () => [
      { id: 'Code', label: 'کد', get: (r) => str(r.Code), width: 90 },
      { id: 'Name', label: 'نام', get: (r) => str(r.Name), width: 200 },
      { id: 'Grp', label: 'گروه', get: (r) => labelOf(o?.grp, r.Grp), width: 130 },
      { id: 'Treat', label: 'شناخت', get: (r) => labelOf(o?.treat, r.Treat), width: 130 },
      { id: 'Src', label: 'منبع', get: (r) => str(r.Src), render: (r) => <span>{str(r.Src)} <VerifyTag v={r.Verify as boolean} /></span>, width: 260 },
      { id: 'IsActive', label: 'وضعیت', get: (r) => (isTrue(r.IsActive) ? 'فعال' : 'غیرفعال'), type: 'select', options: activeOpts, width: 100 },
    ],
    [o],
  );

  const buildForm = (row: Row | null): FormSpec => {
    const sys = !!row && isTrue(row.IsSystem);
    return {
      title: row ? 'ویرایش عنصر هزینه' : 'عنصر هزینهٔ جدید',
      fields: [
        { name: 'Code', label: 'کد', required: true, span: 8 },
        { name: 'Name', label: 'نام', required: true, span: 16 },
        { name: 'Grp', label: 'گروه', type: 'select', options: toOpts(o?.grp), required: true, disabled: sys, span: 8 },
        { name: 'Treat', label: 'نحوهٔ شناخت', type: 'select', options: toOpts(o?.treat), required: true, disabled: sys, span: 8 },
        { name: 'AccKey', label: 'کلید حساب سیستمی (اختیاری)', placeholder: 'مثلاً exp_wage', span: 8 },
        { name: 'Src', label: 'منبع / مبنا', span: 16 },
        { name: 'Verify', label: 'نیازمند تأیید با متن رسمی', type: 'check', span: 12 },
        { name: 'IsActive', label: 'فعال', type: 'check', span: 12 },
        { name: 'Notes', label: 'توضیحات', type: 'textarea', span: 24 },
      ],
      initial: row
        ? { ...row, Verify: isTrue(row.Verify), IsActive: isTrue(row.IsActive) }
        : { IsActive: true, Grp: 'site', Treat: 'product' },
    };
  };

  return (
    <CrudPage<Row>
      title=""
      rows={rows}
      loading={cfg.isFetching}
      error={cfg.isError ? errorMessage(cfg.error) : null}
      onReload={() => void cfg.refetch()}
      cols={cols}
      getId={(r) => str(r.ElemID)}
      nameOf={(r) => str(r.Name)}
      newButtons={[{ label: 'عنصر هزینهٔ جدید' }]}
      buildForm={buildForm}
      onSave={async (v, row) => {
        await act.save({ ...v, ElemID: row ? str(row.ElemID) : '', Verify: !!v.Verify, IsActive: v.IsActive !== false });
      }}
      onDelete={(r) => act.remove(str(r.ElemID))}
      canDelete={(r) => !isTrue(r.IsSystem)}
      storageKey="mt_v2_cols_cs_elem"
    />
  );
}

function BasesTab() {
  const cfg = useCostCfg();
  const act = useKindActions('base');
  const rows = (cfg.data?.bases ?? []) as unknown as Row[];

  const cols = useMemo<ColSpec<Row>[]>(
    () => [
      { id: 'Code', label: 'کد', get: (r) => str(r.Code), width: 90 },
      { id: 'Name', label: 'نام', get: (r) => str(r.Name), width: 220 },
      { id: 'Src', label: 'منبع', get: (r) => str(r.Src), render: (r) => <span>{str(r.Src)} <VerifyTag v={r.Verify as boolean} /></span>, width: 280 },
      { id: 'IsActive', label: 'وضعیت', get: (r) => (isTrue(r.IsActive) ? 'فعال' : 'غیرفعال'), type: 'select', options: activeOpts, width: 100 },
    ],
    [],
  );

  const buildForm = (row: Row | null): FormSpec => ({
    title: row ? 'ویرایش مبنای تسهیم' : 'مبنای تسهیم جدید',
    fields: [
      { name: 'Code', label: 'کد', required: true, span: 8 },
      { name: 'Name', label: 'نام', required: true, span: 16 },
      { name: 'Src', label: 'منبع / مبنا', span: 24 },
      { name: 'Verify', label: 'نیازمند تأیید', type: 'check', span: 12 },
      { name: 'IsActive', label: 'فعال', type: 'check', span: 12 },
    ],
    initial: row ? { ...row, Verify: isTrue(row.Verify), IsActive: isTrue(row.IsActive) } : { IsActive: true },
  });

  return (
    <CrudPage<Row>
      title=""
      rows={rows}
      loading={cfg.isFetching}
      error={cfg.isError ? errorMessage(cfg.error) : null}
      onReload={() => void cfg.refetch()}
      cols={cols}
      getId={(r) => str(r.BaseID)}
      nameOf={(r) => str(r.Name)}
      newButtons={[{ label: 'مبنای جدید' }]}
      buildForm={buildForm}
      onSave={async (v, row) => {
        await act.save({ ...v, BaseID: row ? str(row.BaseID) : '', Verify: !!v.Verify, IsActive: v.IsActive !== false });
      }}
      onDelete={(r) => act.remove(str(r.BaseID))}
      canDelete={(r) => !isTrue(r.IsSystem)}
      storageKey="mt_v2_cols_cs_base"
    />
  );
}

function RulesTab() {
  const cfg = useCostCfg();
  const { company } = useCompany();
  const { message, notification } = App.useApp();
  const [edits, setEdits] = useState<Record<string, string | boolean>>({});
  const [busy, setBusy] = useState('');
  const rules: CostRule[] = cfg.data?.rules ?? [];

  const valueOf = (r: CostRule): string | boolean => {
    if (r.RuleID in edits) return edits[r.RuleID];
    return r.Kind === 'bool' ? r.Value === '1' : r.Value;
  };

  const save = async (r: CostRule) => {
    setBusy(r.RuleID);
    try {
      await csCall('csRuleSave', company, { obj: { RuleID: r.RuleID, Value: valueOf(r) } });
      await cfg.refetch();
      setEdits((e) => {
        const n = { ...e };
        delete n[r.RuleID];
        return n;
      });
      message.success('ذخیره شد.');
    } catch (e) {
      notification.error({ message: 'ذخیره انجام نشد', description: errorMessage(e) });
    } finally {
      setBusy('');
    }
  };

  const columns: TableColumnsType<CostRule> = [
    { title: 'قاعده', key: 'label', render: (_, r) => r.Label },
    {
      title: 'مقدار',
      key: 'value',
      width: 240,
      render: (_, r) => {
        if (isTrue(r.Locked)) return <span dir="ltr">{r.Value}</span>;
        const v = valueOf(r);
        if (r.Kind === 'bool') return <Checkbox checked={v === true} onChange={(e) => setEdits({ ...edits, [r.RuleID]: e.target.checked })}>بله</Checkbox>;
        if (r.Kind === 'choice') return <Select style={{ minWidth: 200 }} value={String(v)} options={(r.Opts ?? []).map((x) => ({ value: x.v, label: x.t }))} onChange={(x) => setEdits({ ...edits, [r.RuleID]: x })} />;
        return <Input style={{ maxWidth: 140 }} value={String(v)} onChange={(e) => setEdits({ ...edits, [r.RuleID]: e.target.value })} />;
      },
    },
    { title: 'منبع', key: 'src', render: (_, r) => <span>{r.Src} <VerifyTag v={r.Verify} /></span> },
    {
      title: '',
      key: 'act',
      width: 110,
      render: (_, r) =>
        isTrue(r.Locked) ? (
          <Tag>ثابت</Tag>
        ) : (
          <Button size="small" type="primary" icon={<SaveOutlined />} loading={busy === r.RuleID} disabled={!(r.RuleID in edits)} onClick={() => void save(r)}>
            ذخیره
          </Button>
        ),
    },
  ];

  return (
    <Card>
      <Table<CostRule> rowKey="RuleID" size="small" loading={cfg.isFetching} dataSource={rules} columns={columns} pagination={false} scroll={{ x: 700 }} />
    </Card>
  );
}
