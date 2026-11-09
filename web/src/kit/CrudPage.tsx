import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { App, Button, Card, Modal, Space, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { errorMessage } from '../api/client';
import type { BulkAction } from '../components/common/DataTable/types';
import { KitTable } from './KitTable';
import { RecordDrawer } from './RecordDrawer';
import type { ColSpec, FormSpec, Row } from './types';

export interface NewButton {
  label: string;
  variant?: string;
}

interface Props<T extends Row> {
  title: string;
  hint?: ReactNode;
  rows: T[];
  loading?: boolean;
  error?: string | null;
  onReload: () => void;
  cols: ColSpec<T>[];
  getId: (r: T) => string;
  /** ساخت فرم برای رکورد جدید (row = null) یا ویرایش */
  buildForm: (row: T | null, variant?: string) => FormSpec;
  onSave: (values: Row, row: T | null, variant?: string) => Promise<void>;
  onDelete?: (row: T) => Promise<void>;
  /** دکمه‌های «جدید»؛ پیش‌فرض یک دکمه */
  newButtons?: NewButton[];
  /** برای ویرایش: نوع (variant) رکورد را برمی‌گرداند */
  variantOf?: (r: T) => string | undefined;
  nameOf?: (r: T) => string;
  canEdit?: (r: T) => boolean;
  canDelete?: (r: T) => boolean;
  rowActions?: (r: T) => ReactNode;
  actionsWidth?: number;
  /** بالای جدول (فیلترها) */
  filters?: ReactNode;
  /** زیر عنوان (خلاصه‌ها) */
  summary?: ReactNode;
  headerExtra?: ReactNode;
  storageKey?: string;
  defaultSort?: { id: string; desc: boolean };
  emptyText?: string;
  drawerNote?: ReactNode;
  newDisabledReason?: string;
  drawerExtra?: (values: Row) => ReactNode;
  onDrawerChange?: (values: Row) => void;
  /** انتخاب ردیف با چک‌باکس و عملیات گروهی */
  selectable?: boolean;
  bulkActions?: BulkAction<T>[];
}

/** صفحهٔ عمومی «جدول + فرم + حذف»؛ هر بخش فقط ستون‌ها و فیلدها را تعریف می‌کند. */
export function CrudPage<T extends Row>(p: Props<T>) {
  const { message, notification } = App.useApp();
  const [spec, setSpec] = useState<{ form: FormSpec; row: T | null; variant?: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const openForm = (row: T | null, variant?: string) => {
    setSpec({ form: p.buildForm(row, variant), row, variant });
    setOpen(true);
  };

  const submit = async (values: Row) => {
    if (!spec) return;
    setSaving(true);
    try {
      await p.onSave(values, spec.row, spec.variant);
      message.success('ذخیره شد.');
      setOpen(false);
    } catch (e) {
      notification.error({ message: 'ذخیره انجام نشد', description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (r: T) => {
    if (!p.onDelete) return;
    try {
      await p.onDelete(r);
      message.success('حذف شد.');
    } catch (e) {
      Modal.error({ title: 'حذف انجام نشد', content: <span style={{ whiteSpace: 'pre-line' }}>{errorMessage(e)}</span>, okText: 'بستن' });
      throw e;
    }
  };

  const confirmDelete = (r: T) =>
    Modal.confirm({
      title: 'حذف',
      content: `«${p.nameOf ? p.nameOf(r) : p.getId(r)}» حذف شود؟ این کار قابل‌بازگشت نیست.`,
      okText: 'حذف',
      okButtonProps: { danger: true },
      cancelText: 'انصراف',
      onOk: () => doDelete(r).catch(() => undefined),
    });

  const buttons = p.newButtons ?? [{ label: 'جدید' }];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          {p.title ? (
            <Typography.Title level={3} style={{ margin: 0 }}>
              {p.title}
            </Typography.Title>
          ) : null}
          {p.hint ? <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>{p.hint}</Typography.Paragraph> : null}
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={p.onReload} loading={p.loading}>
            بازخوانی
          </Button>
          {p.headerExtra}
          {buttons.map((b, i) => (
            <Button key={b.label} type={i === 0 ? 'primary' : 'default'} icon={<PlusOutlined />} disabled={!!p.newDisabledReason} title={p.newDisabledReason} onClick={() => openForm(null, b.variant)}>
              {b.label}
            </Button>
          ))}
        </Space>
      </div>
      {p.summary}
      {p.filters ? <Card size="small">{p.filters}</Card> : null}
      <Card>
        <KitTable<T>
          rows={p.rows}
          cols={p.cols}
          getId={p.getId}
          loading={p.loading}
          error={p.error}
          onRetry={p.onReload}
          storageKey={p.storageKey}
          defaultSort={p.defaultSort}
          emptyText={p.emptyText}
          actionsWidth={p.actionsWidth}
          selectable={p.selectable}
          bulkActions={p.bulkActions}
          actions={(r) => (
            <Space size={4} wrap>
              {p.rowActions ? p.rowActions(r) : null}
              {!p.canEdit || p.canEdit(r) ? (
                <Button size="small" icon={<EditOutlined />} onClick={() => openForm(r, p.variantOf ? p.variantOf(r) : undefined)}>
                  ویرایش
                </Button>
              ) : null}
              {p.onDelete && (!p.canDelete || p.canDelete(r)) ? (
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => confirmDelete(r)}>
                  حذف
                </Button>
              ) : null}
            </Space>
          )}
        />
      </Card>
      {spec ? (
        <RecordDrawer
          open={open}
          title={spec.form.title}
          fields={spec.form.fields}
          initial={spec.form.initial}
          width={spec.form.width}
          saving={saving}
          note={p.drawerNote}
          extra={p.drawerExtra}
          onValuesChange={p.onDrawerChange}
          onClose={() => setOpen(false)}
          onSubmit={submit}
        />
      ) : null}
    </Space>
  );
}
