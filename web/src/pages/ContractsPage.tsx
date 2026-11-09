import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { App, Button, Card, Modal, Space, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { applyLegacyQuery, type LegacyColumnSpec } from '../adapters/tableQuery';
import { errorMessage } from '../api/client';
import { useCompany } from '../api/CompanyContext';
import { deleteContract, getCostConfig, listContracts, saveContract } from '../api/costService';
import type { Contract, ContractInput } from '../api/types';
import { DataTable } from '../components/common/DataTable';
import { defaultTableQuery } from '../components/common/DataTable/types';
import { useTableQueryState } from '../hooks/useTableQueryState';
import { ContractFormDrawer } from './ContractFormDrawer';

const fmt = (v: unknown) => (v === '' || v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 }));

/** ستون‌ها ← نحوهٔ خواندن مقدار برای مرتب‌سازی/فیلتر (آداپتور موقت تا آمدن API سمت‌سرور) */
const SPEC: Record<string, LegacyColumnSpec<Contract>> = {
  No: { get: (r) => r.No, type: 'text' },
  Title: { get: (r) => r.Title, type: 'text' },
  ProjName: { get: (r) => r.ProjName, type: 'text' },
  CustomerName: { get: (r) => r.CustomerName, type: 'text' },
  Amount: { get: (r) => r.Amount, type: 'number' },
  Status: { get: (r) => r.Status, type: 'select' },
  CostTotal: { get: (r) => r.CostTotal, type: 'number' },
};
const GLOBAL_KEYS = [(r: Contract) => r.No, (r: Contract) => r.Title, (r: Contract) => r.ProjName, (r: Contract) => r.CustomerName];

export default function ContractsPage() {
  const { company } = useCompany();
  const { message, notification } = App.useApp();
  const qc = useQueryClient();
  const [query, setQuery] = useTableQueryState(defaultTableQuery({ sorting: [{ id: 'No', desc: false }] }));
  const [editing, setEditing] = useState<Contract | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const listQ = useQuery({
    queryKey: ['contracts', company],
    queryFn: ({ signal }) => listContracts(company, signal),
    enabled: !!company,
    placeholderData: keepPreviousData,
  });
  const cfgQ = useQuery({
    queryKey: ['costCfg', company],
    queryFn: ({ signal }) => getCostConfig(company, signal),
    enabled: !!company,
    staleTime: 60_000,
  });
  const statusMap = cfgQ.data?.options.status ?? {};

  const page = useMemo(
    () => applyLegacyQuery(listQ.data ?? [], query, SPEC, GLOBAL_KEYS),
    [listQ.data, query],
  );

  const save = useMutation({
    mutationFn: (v: ContractInput) => saveContract(company, v),
    onSuccess: () => {
      message.success('قرارداد ذخیره شد.');
      setFormOpen(false);
      void qc.invalidateQueries({ queryKey: ['contracts', company] });
    },
    onError: (e) => notification.error({ message: 'ذخیره انجام نشد', description: errorMessage(e) }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteContract(company, id),
    onSuccess: () => {
      message.success('قرارداد حذف شد.');
      void qc.invalidateQueries({ queryKey: ['contracts', company] });
    },
    onError: (e) => notification.error({ message: 'حذف انجام نشد', description: errorMessage(e) }),
  });

  const confirmDelete = (c: Contract) =>
    Modal.confirm({
      title: 'حذف قرارداد',
      content: `«${c.No} - ${c.Title}» حذف شود؟ این کار قابل‌بازگشت نیست.`,
      okText: 'حذف',
      okButtonProps: { danger: true },
      cancelText: 'انصراف',
      onOk: () => del.mutateAsync(c.ContractID),
    });

  const columns = useMemo<ColumnDef<Contract>[]>(
    () => [
      { id: 'No', accessorKey: 'No', header: 'شماره', meta: { label: 'شماره', filterType: 'text', width: 110 } },
      { id: 'Title', accessorKey: 'Title', header: 'عنوان', meta: { label: 'عنوان', filterType: 'text', width: 220 } },
      { id: 'ProjName', accessorKey: 'ProjName', header: 'پروژه', meta: { label: 'پروژه', filterType: 'text' } },
      { id: 'CustomerName', accessorKey: 'CustomerName', header: 'خریدار', meta: { label: 'خریدار', filterType: 'text' } },
      {
        id: 'Amount',
        accessorKey: 'Amount',
        header: 'مبلغ قرارداد',
        cell: (c) => fmt(c.getValue()),
        meta: { label: 'مبلغ قرارداد', filterType: 'number', numeric: true, width: 150 },
      },
      {
        id: 'Status',
        accessorKey: 'Status',
        header: 'وضعیت',
        cell: (c) => <Tag>{statusMap[String(c.getValue())] ?? String(c.getValue() ?? '')}</Tag>,
        meta: {
          label: 'وضعیت',
          filterType: 'select',
          filterOptions: Object.entries(statusMap).map(([value, label]) => ({ value, label })),
          width: 120,
        },
      },
      {
        id: 'CostTotal',
        accessorKey: 'CostTotal',
        header: 'جمع هزینه ثبت‌شده',
        cell: (c) => fmt(c.getValue()),
        meta: { label: 'جمع هزینه ثبت‌شده', filterType: 'number', numeric: true, width: 160 },
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
    [statusMap],
  );

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            قراردادها (شیء هزینه)
          </Typography.Title>
          <Typography.Text type="secondary">
            هر قرارداد به یک «پروژه» وصل است و بهای تمام‌شده روی آن جمع می‌شود. روش پیشرفت و ارزشیابی مواد برای هر قرارداد جدا تعیین می‌شود.
          </Typography.Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void listQ.refetch()} loading={listQ.isFetching}>
            بازخوانی
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setFormOpen(true); }}>
            قرارداد جدید
          </Button>
        </Space>
      </div>

      <Card>
        <DataTable<Contract>
          columns={columns}
          data={page.rows}
          total={page.total}
          query={query}
          onQueryChange={setQuery}
          getRowId={(r) => r.ContractID}
          loading={listQ.isFetching}
          error={listQ.isError ? errorMessage(listQ.error) : null}
          onRetry={() => void listQ.refetch()}
          globalSearch
          selectable
          columnVisibilityKey="mt_v2_cols_contracts"
          emptyText="هنوز قراردادی ثبت نشده است."
          bulkActions={[
            {
              key: 'delete',
              label: 'حذف انتخاب‌شده‌ها',
              danger: true,
              confirm: true,
              onRun: async (ids) => {
                for (const id of ids) await del.mutateAsync(id);
              },
            },
          ]}
        />
      </Card>

      <ContractFormDrawer
        open={formOpen}
        contract={editing}
        options={cfgQ.data?.options}
        saving={save.isPending}
        onClose={() => setFormOpen(false)}
        onSubmit={async (v) => {
          await save.mutateAsync(v);
        }}
      />
    </Space>
  );
}
