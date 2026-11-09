import type { ColumnDef, RowData } from '@tanstack/react-table';
import type { ReactNode } from 'react';

/** نوع فیلتر ستونی */
export type FilterType = 'text' | 'number' | 'date' | 'select' | 'multiselect';

export interface FilterOption {
  label: string;
  value: string;
}

/** مقدار فیلتر عددی */
export interface NumberRange {
  min?: number;
  max?: number;
}

/** مقدار فیلتر تاریخ (رشتهٔ شمسی yyyy/mm/dd) */
export interface DateRange {
  from?: string;
  to?: string;
}

/**
 * قرارداد استاندارد پرس‌وجوی جدول (مستقل از بک‌اند).
 * تبدیل آن به قرارداد واقعی API فقط در «آداپتور» (adapters/tableQuery.ts) انجام می‌شود.
 */
export interface TableQuery {
  page: number; // از ۱ شروع می‌شود
  pageSize: number;
  sorting: Array<{ id: string; desc: boolean }>;
  filters: Array<{ id: string; value: unknown }>;
  globalFilter?: string;
}

/** نتیجهٔ یک صفحه از داده */
export interface TableResult<T> {
  rows: T[];
  total: number;
}

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export const defaultTableQuery = (over: Partial<TableQuery> = {}): TableQuery => ({
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  sorting: [],
  filters: [],
  globalFilter: '',
  ...over,
});

/** فراداده‌ای که هر ستون می‌تواند در columnDef.meta بدهد */
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** عنوان فارسی ستون (برای منوی نمایش ستون‌ها و فیلترها) */
    label?: string;
    filterType?: FilterType;
    filterOptions?: FilterOption[];
    filterPlaceholder?: string;
    width?: number;
    fixed?: 'left' | 'right';
    align?: 'left' | 'right' | 'center';
    /** عددی/مبلغ: چپ‌چین با ارقام هم‌عرض */
    numeric?: boolean;
    /** این ستون در منوی «نمایش ستون‌ها» نیاید (مثلاً ستون عملیات) */
    hideable?: boolean;
  }
}

export interface BulkAction<T> {
  key: string;
  label: string;
  danger?: boolean;
  /** اگر true باشد قبل از اجرا پنجرهٔ تأیید نشان داده می‌شود */
  confirm?: boolean;
  onRun: (selectedIds: string[], selectedRows: T[]) => void | Promise<void>;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  data: T[];
  /** تعداد کل رکوردهای مطابق فیلتر (نه فقط صفحهٔ جاری) */
  total: number;
  query: TableQuery;
  onQueryChange: (next: TableQuery) => void;
  getRowId: (row: T) => string;
  loading?: boolean;
  /** پیام خطا؛ اگر مقدار داشته باشد حالت خطا با دکمهٔ «تلاش دوباره» نمایش داده می‌شود */
  error?: string | null;
  onRetry?: () => void;
  /** جستجوی سراسری (فقط وقتی true باشد نمایش داده می‌شود) */
  globalSearch?: boolean;
  globalSearchPlaceholder?: string;
  /** انتخاب ردیف با چک‌باکس و عملیات گروهی */
  selectable?: boolean;
  bulkActions?: BulkAction<T>[];
  /** کلید ذخیره‌سازی ستون‌های پنهان در مرورگر (خالی = ذخیره نشود) */
  columnVisibilityKey?: string;
  toolbarExtra?: ReactNode;
  emptyText?: string;
  pageSizeOptions?: number[];
  /** عرض افقی برای اسکرول ریسپانسیو */
  scrollX?: number;
  /** ارتفاع ثابت برای هدر چسبان (sticky) */
  scrollY?: number;
}
