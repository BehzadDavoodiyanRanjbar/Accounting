import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Checkbox, Col, Drawer, Form, Input, Row as GridRow, Select, Space, Typography } from 'antd';
import type { FormRule } from 'antd';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { JALALI } from './format';
import type { FieldDef, ItemColumn, Opt, Row } from './types';
import { NumInput } from './NumInput';

interface Props {
  open: boolean;
  title: string;
  fields: FieldDef[];
  initial: Row;
  saving: boolean;
  width?: number;
  onClose: () => void;
  onSubmit: (values: Row) => Promise<void>;
  /** متن یا دکمه‌های اضافه بالای فرم (مثلاً راهنما) */
  note?: ReactNode;
  /** بخش اضافه زیر فیلدها (مثلاً پیش‌نمایش محاسبه)؛ مقدارهای فعلی فرم را می‌گیرد */
  extra?: (values: Row) => ReactNode;
  /** هر بار مقدار فرم عوض شد (برای فیلدهای وابسته مثل لات کالا) */
  onValuesChange?: (all: Row) => void;
}

const resolveOpts = (f: FieldDef, values: Row): Opt[] => (typeof f.options === 'function' ? f.options(values) : f.options ?? []);

function itemControl(c: ItemColumn) {
  if (c.type === 'select') return <Select allowClear showSearch optionFilterProp="label" placeholder="—" options={c.options ?? []} style={{ minWidth: c.width ?? 160 }} />;
  if (c.type === 'money') return <NumInput style={{ width: c.width ?? 160 }} />;
  return <Input style={{ width: c.width ?? 160 }} />;
}

/** فرم عمومی داخل کشو؛ فیلدها از تعریف FieldDef می‌آیند (اعتبارسنجی، فیلد شرطی، لیست قابل‌ویرایش). */
export function RecordDrawer({ open, title, fields, initial, saving, width = 760, onClose, onSubmit, note, extra, onValuesChange }: Props) {
  const [form] = Form.useForm<Row>();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(initial);
    onValuesChange?.({ ...initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, form]);

  const submit = async () => {
    try {
      const v: Row = await form.validateFields();
      const all: Row = { ...v, ...form.getFieldsValue(true) };
      const out: Row = {};
      for (const f of fields) {
        if (f.visible && !f.visible(all)) continue;
        const val = all[f.name];
        out[f.name] = typeof val === 'string' ? val.trim() : val;
      }
      await onSubmit(out);
    } catch {
      /* خطای فیلدها زیر هر فیلد نمایش داده می‌شود؛ خطای سرور را صفحهٔ والد اعلام می‌کند */
    }
  };

  const rules = (f: FieldDef) => {
    const r: FormRule[] = [];
    if (f.required) r.push({ required: true, whitespace: f.type !== 'select', message: `${f.label} را وارد کنید.` });
    if (f.type === 'date') r.push({ pattern: JALALI, message: 'قالب تاریخ: 1405/01/01' });
    if (f.type === 'money') r.push({ pattern: /^[\d,]*$/, message: 'فقط عدد وارد کنید.' });
    return r;
  };

  const renderField = (f: FieldDef, values: Row) => {
    if (f.type === 'check') {
      return (
        <Col key={f.name} xs={24} md={f.span ?? 24}>
          <Form.Item name={f.name} valuePropName="checked">
            <Checkbox disabled={f.disabled}>{f.label}</Checkbox>
          </Form.Item>
        </Col>
      );
    }
    if (f.type === 'items') {
      const cols = f.items ?? [];
      return (
        <Col key={f.name} xs={24}>
          <Form.Item label={f.label} help={f.help}>
            <Form.List name={f.name}>
              {(list, { add, remove }) => (
                <div>
                  {list.map((lf) => (
                    <Space key={lf.key} align="start" wrap style={{ display: 'flex', marginBlockEnd: 8 }}>
                      {cols.map((c) => (
                        <Form.Item key={c.name} name={[lf.name, c.name]} style={{ marginBottom: 0 }}>
                          {itemControl(c)}
                        </Form.Item>
                      ))}
                      <Button danger icon={<DeleteOutlined />} onClick={() => remove(lf.name)} aria-label="حذف ردیف" />
                    </Space>
                  ))}
                  <Button icon={<PlusOutlined />} onClick={() => add({})}>
                    {f.addLabel ?? 'افزودن ردیف'}
                  </Button>
                </div>
              )}
            </Form.List>
          </Form.Item>
        </Col>
      );
    }
    let control: ReactNode;
    switch (f.type) {
      case 'select':
        control = <Select allowClear={!f.required} showSearch optionFilterProp="label" placeholder={f.placeholder ?? '—'} options={resolveOpts(f, values)} disabled={f.disabled} />;
        break;
      case 'textarea':
        control = <Input.TextArea rows={2} disabled={f.disabled} />;
        break;
      case 'money':
      case 'number':
        control = <NumInput placeholder={f.placeholder} disabled={f.disabled} />;
        break;
      case 'date':
        control = <Input placeholder={f.placeholder ?? '1405/01/01'} disabled={f.disabled} />;
        break;
      default:
        control = <Input placeholder={f.placeholder} disabled={f.disabled} />;
    }
    return (
      <Col key={f.name} xs={24} md={f.span ?? 12}>
        <Form.Item name={f.name} label={f.label} rules={rules(f)} extra={f.help}>
          {control}
        </Form.Item>
      </Col>
    );
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={width}
      destroyOnClose
      title={title}
      extra={
        <Space>
          <Button onClick={onClose}>انصراف</Button>
          <Button type="primary" loading={saving} onClick={() => void submit()}>
            ذخیره
          </Button>
        </Space>
      }
    >
      {note ? <Typography.Paragraph type="secondary">{note}</Typography.Paragraph> : null}
      <Form form={form} layout="vertical" requiredMark autoComplete="off" onValuesChange={() => onValuesChange?.(form.getFieldsValue(true))}>
        <GridRow gutter={16}>
          {fields.map((f) => (
            <Form.Item key={f.name} noStyle shouldUpdate>
              {() => {
                const values: Row = form.getFieldsValue(true);
                if (f.visible && !f.visible(values)) return null;
                return renderField(f, values);
              }}
            </Form.Item>
          ))}
        </GridRow>
        {extra ? (
          <Form.Item noStyle shouldUpdate>
            {() => extra(form.getFieldsValue(true) as Row)}
          </Form.Item>
        ) : null}
      </Form>
    </Drawer>
  );
}
