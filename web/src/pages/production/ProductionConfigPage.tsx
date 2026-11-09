import { App, Button, Card, Checkbox, Input, Select, Space, Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useCompany } from '../../api/CompanyContext';
import { errorMessage } from '../../api/client';
import { useCsQuery } from '../../kit/hooks';
import type { Row } from '../../kit/types';
import { NeedCompany, useBankCall } from '../bank/common';

interface Field {
  key: string;
  label: string;
  type: string;
  options: string;
  required: boolean;
}
interface Cfg {
  method: string;
  prefix: string;
  strictSteps: boolean;
  vatInCost: boolean;
  categories: string;
  fields: Field[];
}

const toEdit = (c: Row): Cfg => ({
  method: String(c.method ?? 'avg'),
  prefix: String(c.prefix ?? ''),
  strictSteps: !!c.strictSteps,
  vatInCost: !!c.vatInCost,
  categories: ((c.categories ?? []) as string[]).join('\n'),
  fields: ((c.fields ?? []) as Row[]).map((f) => ({
    key: String(f.key ?? ''),
    label: String(f.label ?? ''),
    type: String(f.type ?? 'text'),
    options: Array.isArray(f.options) ? (f.options as string[]).join('، ') : String(f.options ?? ''),
    required: !!f.required,
  })),
});

/** تنظیمات تولید برای شرکت فعال */
export default function ProductionConfigPage() {
  const { company } = useCompany();
  const { message } = App.useApp();
  const call = useBankCall();
  const q = useCsQuery<Row>('prodCfgGet', {});
  const [c, setC] = useState<Cfg | null>(null);
  const [busy, setBusy] = useState(false);
  const loadedFor = useRef('');

  useEffect(() => {
    if (q.data && loadedFor.current !== company) {
      loadedFor.current = company;
      setC(toEdit(q.data));
    }
  }, [q.data, company]);

  const set = (p: Partial<Cfg>) => setC((o) => (o ? { ...o, ...p } : o));
  const setField = (i: number, p: Partial<Field>) => setC((o) => (o ? { ...o, fields: o.fields.map((f, k) => (k === i ? { ...f, ...p } : f)) } : o));

  const save = async () => {
    if (!c) return;
    setBusy(true);
    try {
      const cfg = { ...c, categories: c.categories.split(/\n/), fields: c.fields };
      const r = await call('prodCfgSave', { cfg });
      setC(toEdit(r));
      message.success('تنظیمات تولید ذخیره شد.');
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const cols: TableColumnsType<Field & { i: number }> = [
    { title: 'عنوان', render: (_, f) => <Input value={f.label} onChange={(e) => setField(f.i, { label: e.target.value })} /> },
    {
      title: 'نوع',
      width: 140,
      render: (_, f) => (
        <Select
          style={{ width: '100%' }}
          value={f.type}
          onChange={(v) => setField(f.i, { type: v })}
          options={[
            { value: 'text', label: 'متن' },
            { value: 'number', label: 'عدد' },
            { value: 'date', label: 'تاریخ' },
            { value: 'choice', label: 'انتخابی' },
          ]}
        />
      ),
    },
    {
      title: 'گزینه‌ها (برای انتخابی)',
      render: (_, f) => (f.type === 'choice' ? <Input value={f.options} placeholder="گزینه‌ها با ویرگول" onChange={(e) => setField(f.i, { options: e.target.value })} /> : null),
    },
    { title: 'الزامی', width: 80, align: 'center', render: (_, f) => <Checkbox checked={f.required} onChange={(e) => setField(f.i, { required: e.target.checked })} /> },
    {
      title: '',
      width: 60,
      render: (_, f) => (
        <Button danger onClick={() => setC((o) => (o ? { ...o, fields: o.fields.filter((_x, k) => k !== f.i) } : o))}>
          ×
        </Button>
      ),
    },
  ];

  return (
    <NeedCompany company={company}>
      <Card
        loading={q.isLoading || !c}
        title="تنظیمات تولید (برای شرکت فعال)"
        extra={
          <Button type="primary" loading={busy} onClick={() => void save()}>
            ذخیره
          </Button>
        }
      >
        {c ? (
          <Space size="large" wrap align="end">
            <div>
              <div>روش بهای مواد</div>
              <Select
                style={{ width: 300 }}
                value={c.method}
                onChange={(v) => set({ method: v })}
                options={[
                  { value: 'avg', label: 'میانگین موزون خرید و تولید (پیشنهادی)' },
                  { value: 'last', label: 'آخرین قیمت خرید' },
                ]}
              />
            </div>
            <div>
              <div>پیشوند شماره سفارش</div>
              <Input style={{ width: 120, direction: 'ltr' }} value={c.prefix} onChange={(e) => set({ prefix: e.target.value })} />
            </div>
            <Checkbox checked={c.strictSteps} onChange={(e) => set({ strictSteps: e.target.checked })}>
              هنگام تکمیل، همهٔ مراحل باید «انجام شد» باشند
            </Checkbox>
            <Checkbox checked={c.vatInCost} onChange={(e) => set({ vatInCost: e.target.checked })}>
              مالیات فاکتور هزینه به‌طور پیش‌فرض جزو هزینه باشد
            </Checkbox>
          </Space>
        ) : null}
      </Card>

      {c ? (
        <>
          <Card title="گروه‌های هزینهٔ سربار" size="small">
            <Typography.Paragraph type="secondary">هر خط یک گروه (برای فاکتور هزینه).</Typography.Paragraph>
            <Input.TextArea rows={6} value={c.categories} onChange={(e) => set({ categories: e.target.value })} />
          </Card>
          <Card
            title={
              <>
                فیلدهای اختصاصی سفارش تولید <Typography.Text type="secondary">هر چه صنعت شما نیاز دارد: شماره بچ، مشتری سفارش‌دهنده، رنگ، سایز، شیفت…</Typography.Text>
              </>
            }
            extra={<Button onClick={() => set({ fields: [...c.fields, { key: '', label: '', type: 'text', options: '', required: false }] })}>+ فیلد</Button>}
          >
            <Table<Field & { i: number }>
              size="small"
              pagination={false}
              rowKey="i"
              locale={{ emptyText: 'فیلد اختصاصی تعریف نشده است.' }}
              dataSource={c.fields.map((f, i) => ({ ...f, i }))}
              columns={cols}
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </>
      ) : null}
    </NeedCompany>
  );
}
