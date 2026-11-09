import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Col, Form, Input, Modal, Row, Select, Space, Switch, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { errorMessage } from '../api/client';
import { useCompany } from '../api/CompanyContext';
import { deleteEntity, saveEntity } from '../api/costService';
import type { EntityRow } from '../api/types';

type Sheet = 'ProductGroups' | 'ProductSubGroups' | 'Units';
interface BlockDef {
  sheet: Sheet;
  title: string;
  idKey: string;
  nameKey: string;
  listKey: 'groups' | 'subs' | 'units';
  nameLabel: string;
  hasGroup?: boolean;
  hasMuCode?: boolean;
}
const BLOCKS: BlockDef[] = [
  { sheet: 'ProductGroups', title: 'گروه اصلی', idKey: 'GroupID', nameKey: 'GroupName', listKey: 'groups', nameLabel: 'نام گروه اصلی' },
  { sheet: 'ProductSubGroups', title: 'گروه فرعی', idKey: 'SubGroupID', nameKey: 'SubGroupName', listKey: 'subs', nameLabel: 'نام گروه فرعی', hasGroup: true },
  { sheet: 'Units', title: 'واحدها', idKey: 'UnitID', nameKey: 'UnitName', listKey: 'units', nameLabel: 'نام واحد', hasMuCode: true },
];
const str = (v: unknown) => (v == null ? '' : String(v));

/** گروه اصلی، گروه فرعی و واحدهای شرکت فعال؛ سه جدول کوچک با یک فرم مشترک */
export default function GroupsPage() {
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        گروه‌ها و واحدها
      </Typography.Title>
      <Row gutter={[16, 16]}>
        {BLOCKS.map((b) => (
          <Col key={b.sheet} xs={24} xl={8}>
            <Block def={b} />
          </Col>
        ))}
      </Row>
    </Space>
  );
}

function Block({ def }: { def: BlockDef }) {
  const { company, data, reload } = useCompany();
  const { message } = App.useApp();
  const [form] = Form.useForm<Record<string, unknown>>();
  const [editing, setEditing] = useState<EntityRow | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const mine = (k: 'groups' | 'subs' | 'units') => (data?.[k] ?? []).filter((r) => r.CompanyID === company);
  const rows = useMemo(() => mine(def.listKey), [data, company, def.listKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(() => mine('groups').filter((g) => g.IsActive !== false), [data, company]); // eslint-disable-line react-hooks/exhaustive-deps
  const groupName = useMemo(() => new Map(mine('groups').map((g) => [str(g.GroupID), str(g.GroupName)])), [data, company]); // eslint-disable-line react-hooks/exhaustive-deps

  const openForm = (r: EntityRow | null) => {
    setEditing(r);
    setOpen(true);
    form.resetFields();
    form.setFieldsValue({
      [def.nameKey]: r ? str(r[def.nameKey]) : '',
      GroupID: r ? str(r.GroupID) || undefined : undefined,
      MuCode: r ? str(r.MuCode) : '',
      IsActive: r ? r.IsActive !== false : true,
    });
  };

  const submit = async () => {
    const v = await form.validateFields();
    setBusy(true);
    try {
      const obj: Record<string, unknown> = { ...(editing ?? {}), [def.nameKey]: str(v[def.nameKey]).trim(), IsActive: v.IsActive !== false, CompanyID: str(editing?.CompanyID) || company };
      if (def.hasGroup) obj.GroupID = v.GroupID;
      if (def.hasMuCode) obj.MuCode = str(v.MuCode).trim();
      await saveEntity(def.sheet, obj);
      await reload();
      message.success('ذخیره شد.');
      setOpen(false);
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const del = (r: EntityRow) =>
    Modal.confirm({
      title: 'حذف',
      content: `«${str(r[def.nameKey])}» برای همیشه حذف شود؟ (اگر در جایی استفاده شده باشد، حذف نمی‌شود و می‌توانید آن را غیرفعال کنید.)`,
      okText: 'حذف',
      okButtonProps: { danger: true },
      cancelText: 'انصراف',
      onOk: async () => {
        try {
          await deleteEntity(def.sheet, str(r[def.idKey]));
          await reload();
          message.success('حذف شد.');
        } catch (e) {
          Modal.error({ title: 'حذف انجام نشد', content: <span style={{ whiteSpace: 'pre-line' }}>{errorMessage(e)}</span>, okText: 'بستن' });
        }
      },
    });

  const columns: TableColumnsType<EntityRow> = [
    { title: 'نام', key: 'name', render: (_, r) => <>{str(r[def.nameKey])} {r.IsActive === false ? <Tag>غیرفعال</Tag> : null}</> },
    ...(def.hasGroup ? [{ title: 'گروه اصلی', key: 'group', render: (_: unknown, r: EntityRow) => groupName.get(str(r.GroupID)) ?? '' }] : []),
    ...(def.hasMuCode ? [{ title: 'کد مؤدیان', key: 'mu', dataIndex: 'MuCode' }] : []),
    {
      title: '',
      key: 'actions',
      width: 110,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openForm(r)} aria-label="ویرایش" />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => del(r)} aria-label="حذف" />
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={def.title}
      extra={
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openForm(null)}>
          جدید
        </Button>
      }
    >
      <Table<EntityRow>
        size="small"
        rowKey={(r) => str(r[def.idKey])}
        dataSource={rows}
        pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: false }}
        locale={{ emptyText: 'موردی ثبت نشده است.' }}
        columns={columns}
      />
      <Modal title={editing ? `ویرایش ${def.title}` : `${def.title} جدید`} open={open} onCancel={() => setOpen(false)} onOk={() => void submit()} okText="ذخیره" cancelText="انصراف" confirmLoading={busy} destroyOnClose>
        <Form form={form} layout="vertical" autoComplete="off">
          <Form.Item name={def.nameKey} label={def.nameLabel} rules={[{ required: true, whitespace: true, message: 'نام را وارد کنید.' }]}>
            <Input />
          </Form.Item>
          {def.hasGroup ? (
            <Form.Item name="GroupID" label="گروه اصلی" rules={[{ required: true, message: 'گروه اصلی را انتخاب کنید.' }]}>
              <Select showSearch optionFilterProp="label" options={groups.map((g) => ({ value: str(g.GroupID), label: str(g.GroupName) }))} placeholder="انتخاب" />
            </Form.Item>
          ) : null}
          {def.hasMuCode ? (
            <Form.Item name="MuCode" label="کد واحد اندازه‌گیری مؤدیان (اختیاری)">
              <Input />
            </Form.Item>
          ) : null}
          <Form.Item name="IsActive" label="وضعیت" valuePropName="checked">
            <Switch checkedChildren="فعال" unCheckedChildren="غیرفعال" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
