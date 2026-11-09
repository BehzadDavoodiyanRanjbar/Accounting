import { flexRender, type Row } from '@tanstack/react-table';
import { Skeleton, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { DataTableColumnHeader } from './DataTableColumnHeader';
import { DataTableEmptyState, DataTableErrorState } from './DataTableEmptyState';
import { DataTableFilters } from './DataTableFilters';
import { DataTablePagination } from './DataTablePagination';
import { DataTableToolbar } from './DataTableToolbar';
import { useDataTable } from './hooks/useDataTable';
import type { DataTableProps } from './types';

/**
 * جدول داده‌ای مشترک.
 * - وضعیت و رفتار (مرتب‌سازی، فیلتر، صفحه‌بندی، انتخاب، ستون‌ها): TanStack Table
 * - ظاهر و کنترل‌ها: Ant Design
 * - منطق کسب‌وکار (نام API، فیلدها، عملیات): بیرون از این کامپوننت، در صفحه‌ها
 *
 * صفحه‌بندی/مرتب‌سازی/فیلتر «manual» است: DataTable فقط query را تغییر می‌دهد (onQueryChange) و
 * صفحه‌ی بعدی داده (data + total) را از بیرون می‌گیرد.
 */
export function DataTable<T>(props: DataTableProps<T>) {
  const { query, onQueryChange, loading, error, onRetry, data, total } = props;
  const [showFilters, setShowFilters] = useState(query.filters.length > 0);
  const { table, selectedIds, clearSelection, hasFilters, resetFilters } = useDataTable<T>({
    columns: props.columns,
    data,
    total,
    query,
    onQueryChange,
    getRowId: props.getRowId,
    selectable: props.selectable,
    columnVisibilityKey: props.columnVisibilityKey,
  });

  const rows = table.getRowModel().rows;
  const sortedCount = query.sorting.length;

  const antColumns = useMemo<ColumnsType<Row<T>>>(
    () =>
      table.getVisibleLeafColumns().map((col) => {
        const m = col.columnDef.meta;
        const header = col.columnDef.header;
        const title = typeof header === 'string' ? header : m?.label ?? col.id;
        return {
          key: col.id,
          title: <DataTableColumnHeader column={col} title={title} sortedCount={sortedCount} />,
          width: m?.width,
          fixed: m?.fixed,
          align: m?.align,
          className: m?.numeric ? 'num-cell' : undefined,
          render: (_: unknown, row: Row<T>) => {
            const cell = row.getVisibleCells().find((c) => c.column.id === col.id);
            return cell ? flexRender(col.columnDef.cell, cell.getContext()) : null;
          },
        };
      }),
    // ستون‌های قابل‌مشاهده و مرتب‌سازی بر ظاهر سرستون اثر دارند
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, props.columns, table.getState().columnVisibility, query.sorting, sortedCount],
  );

  const selectedRows = useMemo(() => rows.filter((r) => selectedIds.includes(r.id)).map((r) => r.original), [rows, selectedIds]);

  const filterCount = query.filters.length + (query.globalFilter ? 1 : 0);

  return (
    <div>
      <DataTableToolbar
        table={table}
        globalSearch={props.globalSearch}
        globalSearchPlaceholder={props.globalSearchPlaceholder}
        globalFilter={query.globalFilter ?? ''}
        onGlobalFilter={(v) => table.setGlobalFilter(v)}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((s) => !s)}
        filterCount={filterCount}
        selectedIds={selectedIds}
        selectedRows={selectedRows}
        bulkActions={props.bulkActions}
        onClearSelection={clearSelection}
        extra={props.toolbarExtra}
      />
      {showFilters ? <DataTableFilters table={table} hasFilters={hasFilters} onReset={resetFilters} /> : null}

      {error ? (
        <DataTableErrorState message={error} onRetry={onRetry} />
      ) : loading && rows.length === 0 ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <Table<Row<T>>
          size="middle"
          bordered={false}
          rowKey={(r) => r.id}
          dataSource={rows}
          columns={antColumns}
          loading={loading}
          pagination={false}
          sticky={props.scrollY ? undefined : { offsetHeader: 0 }}
          scroll={{ x: props.scrollX ?? 'max-content', y: props.scrollY }}
          locale={{
            emptyText: <DataTableEmptyState filtered={hasFilters} text={props.emptyText} onReset={resetFilters} />,
          }}
          rowSelection={
            props.selectable
              ? {
                  selectedRowKeys: selectedIds,
                  preserveSelectedRowKeys: true,
                  onChange: (keys) => table.setRowSelection(Object.fromEntries(keys.map((k) => [String(k), true]))),
                }
              : undefined
          }
        />
      )}

      {!error ? (
        <DataTablePagination
          page={query.page}
          pageSize={query.pageSize}
          total={total}
          disabled={loading}
          pageSizeOptions={props.pageSizeOptions}
          onChange={(page, pageSize) => table.setPagination({ pageIndex: page - 1, pageSize })}
        />
      ) : null}
    </div>
  );
}
