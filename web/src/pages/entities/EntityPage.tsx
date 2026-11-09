import { DeleteOutlined, EditOutlined, NumberOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { App, Button, Card, Modal, Space, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { applyLegacyQuery, type LegacyColumnSpec } from '../../adapters/tableQuery';
import { errorMessage } from '../../api/client';
import { useCompany } from '../../api/CompanyContext';
import { autoCodeCommit, autoCodePreview, deleteEntity, saveEntity } from '../../api/costService';
import type { EntityRow } from '../../api/types';
import { DataTable } from '../../components/common/DataTable';
import { defaultTableQuery } from '../../components/common/DataTable/types';
import { useTableQueryState } from '../../hooks/useTableQueryState';
import type { EntityConfig } from './config';
import { EntityFormDrawer, type Lookups } from './EntityFormDrawer';

const str = (v: unknown) => (v == null ? '' : String(v));
const isActive = (r: EntityRow) => r.IsActive !== false;

/** ساخت گزینه‌های گروه/زیرگروه/واحد برای شرکت فعال */
export function useLookups(): Lookups {
  const { data, company } = useCompany();
  return useMemo(() => {
    const mine = (a?: EntityRow[]) => (a ?? []).filter((r) => r.CompanyID === company && isActive(r));
    return {
      groups: mine(data?.groups).map((g) => ({ value: str(g.GroupID), label: str(g.GroupName) })),
      subs: mine(data?.subs).map((s) => ({ value: str(s.SubGroupID), label: str(s.SubGroupName), group: str(s.GroupID) })),
      units: mine(data?.units).map((u) => ({ value: str(u.UnitName), label: str(u.UnitName) })),
    };
  }, [data, company]);
}

/**
 * صفحهٔ عمومی اطلاعات پایه (مشتری، فروشنده، کالا، خدمت).
 * فقط تعریف ستون‌ها و فیلدها (config) برای هر نوع فرق می‌کند؛ رفتار جدول و فرم مشترک است.
 */
export default function EntityPage({ config }: { config: EntityConfig }) {
  const { company, data, reload } = useCompany();
  const { message, notification } = App.useApp();
  const lookups = useLookups();
  const [query, setQuery] = useTableQueryState(defaultTableQuery({ sorting: [{ id: config.nameField, desc: false }] }));
  const [editing, setEditing] = useState<EntityRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const rows = useMemo(() => (data?.[config.listKey] ?? []).filter((r) => r.CompanyID === company), [data, config.listKey, company]);

  const groupName = useMemo(() => new Map(lookups.groups.map((g) => [g.value, g.label])), [lookups.groups]);
  const subName = useMemo(() => new Map(lookups.subs.map((g) => [g.value, g.label])), [lookups.subs]);
  const display = (r: EntityRow, name: string, kind?: 'group' | 'subgroup') => {
    const v = str(r[name]);
    if (kind === 'group') return groupName.get(v) ?? v;
    if (kind === 'subgroup') return subName.get(v) ?? v;
    return v;
  };

  const spec = useMemo(() => {
    const s: Record<string, LegacyColumnSpec<EntityRow>> = {};
    for (const c of config.columns) s[c.name] = { get: (r) => display(r, c.name, c.kind), type: 'text' };
    s.IsActive = { get: (r) => (isActive(r) ? 'active' : 'inactive'), type: 'select' };
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, groupName, subName]);
  const globalKeys = useMemo(() => config.columns.map((c) => (r: EntityRow) => display(r, c.name, c.kind)), [config, groupName, subName]); // eslint-disable-line react-hooks/exhaustive-deps
  const page = useMemo(() => applyLegacyQuery(rows, query, spec, globalKeys), [rows, query, spec, globalKeys]);

  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) => saveEntity(config.sheet, { ...(editing ?? {}), ...v, CompanyID: str(editing?.CompanyID) || company }),
    onSuccess: async () => {
      message.success('ذخیره شد.');
      setFormOpen(false);
      await reload();
    },
    onError: (e) => notification.error({ message: 'ذخیره انجام نشد', description: errorMessage(e) }),
  });

  const remove = async (id: string) => {
    try {
      await deleteEntity(config.sheet, id);
      await reload();
      message.success('حذف شد.');
    } catch (e) {
      // پیام‌های حذف‌نشدن (مثلاً «در فاکتور استفاده شده») کامل و خوانا نمایش داده می‌شود
      Modal.error({ title: 'حذف انجام نشد', content: <span style={{ whiteSpace: 'pre-line' }}>{errorMessage(e)}</span>, okText: 'بستن' });
      throw e;
    }
  };

  const confirmDelete = (r: EntityRow) =>
    Modal.confirm({
      title: `حذف ${config.noun}`,
      content: `«${str(r[config.nameField])}» برای همیشه حذف شود؟ (اگر در فاکتور یا فرمول ساخت استفاده شده باشد، حذف نمی‌شود و می‌توانید آن را غیرفعال کنید.)`,
      okText: 'حذف',
      okButtonProps: { danger: true },
      cancelText: 'انصراف',
      onOk: () => remove(str(r[config.idKey])).catch(() => undefined),
    });

  const runAutoCode = async () => {
    try {
      const pre = await autoCodePreview(company);
      const L: Array<['Products' | 'Suppliers' | 'Customers', string]> = [
        ['Products', 'کالاها'],
        ['Suppliers', 'فروشندگان'],
        ['Customers', 'مشتریان'],
      ];
      const total = L.reduce((n, [k]) => n + pre[k].toAssign, 0);
      if (!total) {
        Modal.info({ title: 'کدگذاری خودکار', content: 'همهٔ کالاها، فروشندگان و مشتریان کد دارند.', okText: 'بستن' });
        return;
      }
      Modal.confirm({
        title: 'کدگذاری خودکار',
        width: 620,
        okText: 'تأیید و ثبت کدها',
        cancelText: 'انصراف',
        content: (
          <div>
            <p>
              کالا: کد گروه (۲ رقم) + ترتیبی (۴ رقم) مثل 010001 | مشتری: 100001 به بعد | فروشنده: 200001 به بعد. کدهای موجود تغییر نمی‌کنند و رکوردهای جدید هم خودکار کد می‌گیرند.
            </p>
            {L.map(([k, label]) => (
              <div key={k}>
                <b>{label}</b> (بدون کد / کل): {pre[k].toAssign} / {pre[k].total}
                {pre[k].sample.length ? <ul>{pre[k].sample.map((z) => <li key={z.name + z.code}>{z.name} ← {z.code}</li>)}</ul> : null}
              </div>
            ))}
            <Typography.Text type="secondary">فقط چند نمونهٔ اول نمایش داده شد.</Typography.Text>
          </div>
        ),
        onOk: async () => {
          const r = await autoCodeCommit(company);
          await reload();
          message.success(`کدگذاری شد: کالا ${r.Products}، فروشنده ${r.Suppliers}، مشتری ${r.Customers}`);
        },
      });
    } catch (e) {
      notification.error({ message: 'کدگذاری انجام نشد', description: errorMessage(e) });
    }
  };

  const columns = useMemo<ColumnDef<EntityRow>[]>(
    () => [
      ...config.columns.map<ColumnDef<EntityRow>>((c) => ({
        id: c.name,
        accessorFn: (r) => display(r, c.name, c.kind),
        header: c.label,
        meta: { label: c.label, filterType: 'text', width: c.width },
      })),
      {
        id: 'IsActive',
        accessorFn: (r) => (isActive(r) ? 'active' : 'inactive'),
        header: 'وضعیت',
        cell: ({ row }) => (isActive(row.original) ? <Tag color="green">فعال</Tag> : <Tag>غیرفعال</Tag>),
        meta: {
          label: 'وضعیت',
          filterType: 'select',
          filterOptions: [
            { value: 'active', label: 'فعال' },
            { value: 'inactive', label: 'غیرفعال' },
          ],
          width: 110,
        },
      },
      {
        id: 'actions',
        header: 'عملیات',
        enableSorting: false,
        cell: ({ row }) => (
          <Space>
            <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(row.original); setFormOpen(true); }}>
              ویرایش
            </Button>
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => confirmDelete(row.original)}>
              حذف
            </Button>
          </Space>
        ),
        meta: { label: 'عملیات', hideable: false, fixed: 'left', width: 190 },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, groupName, subName],
  );

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {config.title}
          </Typography.Title>
          {config.subtitle ? <Typography.Text type="secondary">{config.subtitle}</Typography.Text> : null}
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => void reload()}>
            بازخوانی
          </Button>
          {config.autoCode ? (
            <Button icon={<NumberOutlined />} onClick={() => void runAutoCode()}>
              کدگذاری خودکار
            </Button>
          ) : null}
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setFormOpen(true); }}>
            {config.newLabel}
          </Button>
        </Space>
      </div>

      <Card>
        <DataTable<EntityRow>
          columns={columns}
          data={page.rows}
          total={page.total}
          query={query}
          onQueryChange={setQuery}
          getRowId={(r) => str(r[config.idKey])}
          globalSearch
          selectable
          columnVisibilityKey={`mt_v2_cols_${config.sheet}`}
          emptyText={`هنوز ${config.noun}ی ثبت نشده است.`}
          bulkActions={[
            {
              key: 'delete',
              label: 'حذف انتخاب‌شده‌ها',
              danger: true,
              confirm: true,
              onRun: async (ids) => {
                for (const id of ids) await remove(id);
              },
            },
          ]}
        />
      </Card>

      <EntityFormDrawer
        open={formOpen}
        config={config}
        row={editing}
        lookups={lookups}
        saving={save.isPending}
        onClose={() => setFormOpen(false)}
        onSubmit={async (v) => {
          await save.mutateAsync(v);
        }}
      />
    </Space>
  );
}
