import type { ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { applyLegacyQuery, type LegacyColumnSpec } from '../adapters/tableQuery';
import { DataTable } from '../components/common/DataTable';
import { defaultTableQuery, type BulkAction, type TableQuery } from '../components/common/DataTable/types';
import { fmtNum, str } from './format';
import type { ColSpec } from './types';

interface Props<T> {
  rows: T[];
  cols: ColSpec<T>[];
  getId: (r: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** ستون «عملیات» (دکمه‌های هر ردیف) */
  actions?: (r: T) => ReactNode;
  actionsWidth?: number;
  selectable?: boolean;
  bulkActions?: BulkAction<T>[];
  emptyText?: string;
  storageKey?: string;
  defaultSort?: { id: string; desc: boolean };
  toolbarExtra?: ReactNode;
  globalSearch?: boolean;
  pageSize?: number;
}

/**
 * جدول عمومی برنامه: DataTable مشترک + فیلتر/مرتب‌سازی/صفحه‌بندی.
 * وضعیت جدول (صفحه، مرتب‌سازی، فیلتر) داخل همین جدول نگه داشته می‌شود تا چند جدول در یک صفحه به هم نخورند.
 */
export function KitTable<T>({
  rows,
  cols,
  getId,
  loading,
  error,
  onRetry,
  actions,
  actionsWidth,
  selectable,
  bulkActions,
  emptyText,
  storageKey,
  defaultSort,
  toolbarExtra,
  globalSearch = true,
  pageSize,
}: Props<T>) {
  const [query, setQuery] = useState<TableQuery>(
    defaultTableQuery({ ...(defaultSort ? { sorting: [defaultSort] } : {}), ...(pageSize ? { pageSize } : {}) }),
  );

  const spec = useMemo(() => {
    const s: Record<string, LegacyColumnSpec<T>> = {};
    for (const c of cols) s[c.id] = { get: (r) => c.get(r) ?? '', type: c.type ?? 'text' };
    return s;
  }, [cols]);
  const globalKeys = useMemo(() => cols.map((c) => (r: T) => c.get(r) ?? ''), [cols]);
  const page = useMemo(() => applyLegacyQuery(rows, query, spec, globalKeys), [rows, query, spec, globalKeys]);

  const columns = useMemo<ColumnDef<T>[]>(() => {
    const base = cols.map<ColumnDef<T>>((c) => ({
      id: c.id,
      accessorFn: (r) => c.get(r) ?? '',
      header: c.label,
      cell: (ctx) => {
        if (c.render) return c.render(ctx.row.original);
        const v = c.get(ctx.row.original);
        return c.type === 'number' ? fmtNum(v) : str(v);
      },
      meta: {
        label: c.label,
        filterType: c.type === 'number' ? 'number' : c.type === 'select' ? 'select' : 'text',
        filterOptions: c.options,
        numeric: c.type === 'number',
        width: c.width,
      },
    }));
    if (actions) {
      base.push({
        id: '__actions',
        header: 'عملیات',
        enableSorting: false,
        cell: (ctx) => actions(ctx.row.original),
        meta: { label: 'عملیات', hideable: false, fixed: 'left', width: actionsWidth ?? 190 },
      });
    }
    return base;
  }, [cols, actions, actionsWidth]);

  return (
    <DataTable<T>
      columns={columns}
      data={page.rows}
      total={page.total}
      query={query}
      onQueryChange={setQuery}
      getRowId={getId}
      loading={loading}
      error={error}
      onRetry={onRetry}
      globalSearch={globalSearch}
      selectable={selectable}
      bulkActions={bulkActions}
      columnVisibilityKey={storageKey}
      emptyText={emptyText ?? 'موردی ثبت نشده است.'}
      toolbarExtra={toolbarExtra}
    />
  );
}
