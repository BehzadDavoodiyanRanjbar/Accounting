import { App, Button, Checkbox, Col, Drawer, Form, Input, Row, Select, Space } from 'antd';
import { useEffect } from 'react';
import type { Contract, ContractInput, CostOptions } from '../api/types';
import { NumInput } from '../kit/NumInput';

const JALALI = /^\d{4}\/\d{2}\/\d{2}$/;
const toOptions = (m: Record<string, string> = {}) => Object.entries(m).map(([value, label]) => ({ value, label }));

interface Props {
  open: boolean;
  contract: Contract | null; // null = قرارداد جدید
  options: CostOptions | undefined;
  saving: boolean;
  onClose: () => void;
  onSubmit: (v: ContractInput) => Promise<void>;
}

type FormValues = Omit<ContractInput, 'GaClaim'> & { GaClaim?: boolean };

/** فرم قرارداد با Ant Design Form و اعتبارسنجی؛ تاریخ‌ها شمسی به‌صورت متن yyyy/mm/dd. */
export function ContractFormDrawer({ open, contract, options, saving, onClose, onSubmit }: Props) {
  const [form] = Form.useForm<FormValues>();
  const { message } = App.useApp();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(
      contract
        ? {
            ...contract,
            Amount: String(contract.Amount ?? ''),
            UnitQty: String(contract.UnitQty ?? ''),
            GaClaim: contract.GaClaim === true || contract.GaClaim === '1' || contract.GaClaim === 'true',
          }
        : { Status: 'draft', ProgMethod: 'cost', ValMethod: 'avg', MobAlloc: 'straight_line' },
    );
  }, [open, contract, form]);

  const noProject = !!options && options.projects.length === 0;

  const submit = async () => {
    try {
      const v = await form.validateFields();
      await onSubmit({ ...v, ContractID: contract?.ContractID });
    } catch (e) {
      // خطای اعتبارسنجی فرم زیر هر فیلد نمایش داده می‌شود؛ خطای سرور در صفحهٔ والد اعلام می‌شود
      if (!(e as { errorFields?: unknown }).errorFields) message.error((e as Error).message);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={720}
      destroyOnClose
      title={contract ? 'ویرایش قرارداد' : 'قرارداد جدید'}
      extra={
        <Space>
          <Button onClick={onClose}>انصراف</Button>
          <Button type="primary" loading={saving} onClick={submit} disabled={noProject}>
            ذخیره
          </Button>
        </Space>
      }
    >
      {noProject ? (
        <p style={{ color: 'var(--ant-color-error, #dc2626)' }}>ابتدا از «حسابداری ← تفصیلی / کارکنان / پروژه» یک پروژه بسازید.</p>
      ) : null}
      <Form form={form} layout="vertical" requiredMark autoComplete="off">
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item name="No" label="شماره قرارداد" rules={[{ required: true, message: 'شماره قرارداد را وارد کنید.' }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={16}>
            <Form.Item name="Title" label="عنوان" rules={[{ required: true, message: 'عنوان را وارد کنید.' }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="ProjID" label="پروژه" rules={[{ required: true, message: 'پروژه را انتخاب کنید.' }]}>
              <Select showSearch optionFilterProp="label" placeholder="انتخاب"
                options={(options?.projects ?? []).map((p) => ({ value: p.id, label: p.Name }))} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="CustomerID" label="خریدار (کارفرما)">
              <Select allowClear showSearch optionFilterProp="label" placeholder="—"
                options={(options?.customers ?? []).map((p) => ({ value: p.id, label: p.Name }))} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="StartJ" label="تاریخ شروع" rules={[{ pattern: JALALI, message: 'قالب تاریخ: 1405/01/01' }]}>
              <Input placeholder="1405/01/01" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="EndJ" label="تاریخ پایان" rules={[{ pattern: JALALI, message: 'قالب تاریخ: 1405/12/29' }]}>
              <Input placeholder="1405/12/29" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="Amount" label="مبلغ قرارداد (ریال)"
              rules={[{ pattern: /^[\d,]*$/, message: 'فقط عدد وارد کنید.' }]}>
              <NumInput />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="Status" label="وضعیت">
              <Select options={toOptions(options?.status)} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="ProgMethod" label="روش اندازه‌گیری پیشرفت">
              <Select options={toOptions(options?.prog)} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="ValMethod" label="روش ارزشیابی مواد">
              <Select options={toOptions(options?.val)} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="MobAlloc" label="تسهیم تجهیز و برچیدن کارگاه">
              <Select options={toOptions(options?.mob)} />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item name="UnitName" label="واحد خدمت">
              <Input placeholder="ساعت، متر مربع، ..." />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item name="UnitQty" label="مقدار کل واحد">
              <NumInput />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="GaClaim" valuePropName="checked">
              <Checkbox>هزینهٔ عمومی و اداری ستاد در این قرارداد قابل‌مطالبه است (جزو بها)</Checkbox>
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="Notes" label="توضیحات">
              <Input.TextArea rows={3} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Drawer>
  );
}
