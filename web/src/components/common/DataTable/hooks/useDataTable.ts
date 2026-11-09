import { useEffect, useMemo, useState } from 'react';
import {
  functionalUpdate,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import type { TableQuery } from '../types';

/** مقدار را با تأخیر برمی‌گرداند (برای جلوگیری از درخواست به‌ازای هر کلید). */
export function useDebouncedValue<V>(value: V, delay = 400): V {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/** state ساده با ذخیره در localStorage (خطاها بی‌صدا نادیده گرفته می‌شود). */
export function usePersistentState<V>(key: string | undefined, initial: V): [V, (v: V) => void] {
  const [state, setState] = useState<V>(() => {
    if (!key) return initial;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as V) : initial;
    } catch {
      return initial;
    }
  });
  const set = (v: V) => {
    setState(v);
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  };
  return [state, set];
}

export interface UseDataTableOptions<T> {
  columns: ColumnDef<T, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  data: T[];
  total: number;
  query: TableQuery;
  onQueryChange: (next: TableQuery) => void;
  getRowId: (row: T) => string;
  selectable?: boolean;
  columnVisibilityKey?: string;
}

/**
 * موتور جدول: TanStack Table وضعیت (مرتب‌سازی، فیلتر، صفحه‌بندی، انتخاب، ستون‌ها) را نگه می‌دارد؛
 * نمایش بر عهدهٔ Ant Design است. همهٔ عملیات «manual» است یعنی انجام آن‌ها با بک‌اند/آداپتور است.
 * هر تغییر فیلتر/مرتب‌سازی/اندازهٔ صفحه، شمارهٔ صفحه را به ۱ برمی‌گرداند.
 */
export function useDataTable<T>(o: UseDataTableOptions<T>) {
  const { query, onQueryChange, total } = o;
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = usePersistentState<VisibilityState>(o.columnVisibilityKey, {});

  const pagination: PaginationState = { pageIndex: Math.max(0, query.page - 1), pageSize: query.pageSize };
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));

  const table = useReactTable<T>({
    data: o.data,
    columns: o.columns,
    getRowId: (row) => o.getRowId(row),
    state: {
      sorting: query.sorting as SortingState,
      columnFilters: query.filters as ColumnFiltersState,
      globalFilter: query.globalFilter ?? '',
      pagination,
      columnVisibility,
      rowSelection,
    },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount,
    enableMultiSort: true,
    enableRowSelection: !!o.selectable,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: (u) => onQueryChange({ ...query, sorting: functionalUpdate(u, query.sorting as SortingState), page: 1 }),
    onColumnFiltersChange: (u) =>
      onQueryChange({ ...query, filters: functionalUpdate(u, query.filters as ColumnFiltersState), page: 1 }),
    onGlobalFilterChange: (u) =>
      onQueryChange({ ...query, globalFilter: functionalUpdate(u, query.globalFilter ?? '') as string, page: 1 }),
    onPaginationChange: (u) => {
      const n = functionalUpdate(u, pagination);
      const sizeChanged = n.pageSize !== query.pageSize;
      onQueryChange({ ...query, pageSize: n.pageSize, page: sizeChanged ? 1 : n.pageIndex + 1 });
    },
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: (u) => setColumnVisibility(functionalUpdate(u, columnVisibility)),
  });

  /** اگر صفحهٔ جاری بعد از تغییر داده/فیلتر از آخرین صفحه بیشتر شد، اصلاح می‌شود. */
  const pageTooHigh = total > 0 && query.page > pageCount;
  useEffect(() => {
    if (pageTooHigh) onQueryChange({ ...query, page: pageCount });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageTooHigh, pageCount]);

  const selectedIds = useMemo(() => Object.keys(rowSelection).filter((k) => rowSelection[k]), [rowSelection]);
  const hasFilters = query.filters.length > 0 || !!query.globalFilter;

  return {
    table,
    pageCount,
    selectedIds,
    clearSelection: () => setRowSelection({}),
    hasFilters,
    resetFilters: () => onQueryChange({ ...query, filters: [], globalFilter: '', page: 1 }),
  };
}
