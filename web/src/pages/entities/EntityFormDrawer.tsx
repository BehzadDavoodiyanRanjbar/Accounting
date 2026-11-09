import { Button, Col, Drawer, Form, Input, Row, Select, Space, Switch, Typography } from 'antd';
import { useEffect, useMemo } from 'react';
import type { EntityRow } from '../../api/types';
import type { EntityConfig, Field } from './config';

export interface Lookups {
  groups: Array<{ value: string; label: string }>;
  subs: Array<{ value: string; label: string; group: string }>;
  units: Array<{ value: string; label: string }>;
}

type FormValues = Record<string, string | boolean | undefined>;

interface Props {
  open: boolean;
  config: EntityConfig;
  row: EntityRow | null; // null = جدید
  lookups: Lookups;
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
}

/** فرم عمومی اطلاعات پایه؛ فیلدها از تعریف config می‌آیند. */
export function EntityFormDrawer({ open, config, row, lookups, saving, onClose, onSubmit }: Props) {
  const [form] = Form.useForm<FormValues>();
  const hasGroup = config.fields.some((f) => f.kind === 'group');
  const groupValue = Form.useWatch(hasGroup ? 'GroupID' : '__none__', form) as string | undefined;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    const init: FormValues = {};
    for (const f of config.fields) init[f.name] = row?.[f.name] == null ? undefined : String(row[f.name]);
    init.IsActive = row ? row.IsActive !== false : true;
    form.setFieldsValue(init);
  }, [open, row, config, form]);

  const subOptions = useMemo(
    () => lookups.subs.filter((s) => !groupValue || s.group === groupValue).map(({ value, label }) => ({ value, label })),
    [lookups.subs, groupValue],
  );

  const control = (f: Field) => {
    switch (f.kind) {
      case 'textarea':
        return <Input.TextArea rows={2} />;
      case 'select':
        return <Select allowClear placeholder="—" options={f.options} />;
      case 'group':
        return (
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="—"
            options={lookups.groups}
            onChange={() => form.setFieldValue('SubGroupID', undefined)}
          />
        );
      case 'subgroup':
        return <Select allowClear showSearch optionFilterProp="label" placeholder="—" options={subOptions} />;
      case 'unit':
        return <Select allowClear showSearch optionFilterProp="label" placeholder="—" options={lookups.units} />;
      default:
        return <Input />;
    }
  };

  const submit = async () => {
    try {
      const v = await form.validateFields();
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) out[k] = typeof val === 'string' ? val.trim() : val ?? '';
      await onSubmit(out);
    } catch {
      /* خطای فیلدها زیر هر فیلد نمایش داده می‌شود؛ خطای سرور را صفحهٔ والد اعلام می‌کند */
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={760}
      destroyOnClose
      title={row ? `ویرایش ${config.noun}` : config.newLabel}
      extra={
        <Space>
          <Button onClick={onClose}>انصراف</Button>
          <Button type="primary" loading={saving} onClick={() => void submit()}>
            ذخیره
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" requiredMark autoComplete="off">
        <Row gutter={16}>
          {config.fields.map((f) => (
            <Col key={f.name} xs={24} md={f.span ?? 12}>
              <Form.Item name={f.name} label={f.label} rules={f.required ? [{ required: true, whitespace: true, message: `${f.label} را وارد کنید.` }] : undefined}>
                {control(f)}
              </Form.Item>
            </Col>
          ))}
          <Col xs={24} md={12}>
            <Form.Item name="IsActive" label="وضعیت" valuePropName="checked">
              <Switch checkedChildren="فعال" unCheckedChildren="غیرفعال" />
            </Form.Item>
          </Col>
        </Row>
        {config.hint ? <Typography.Paragraph type="secondary">{config.hint}</Typography.Paragraph> : null}
      </Form>
    </Drawer>
  );
}
