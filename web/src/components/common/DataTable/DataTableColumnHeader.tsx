import { CaretDownOutlined, CaretUpOutlined } from '@ant-design/icons';
import type { Column, RowData } from '@tanstack/react-table';
import { Space, theme } from 'antd';
import type { MouseEvent, ReactNode } from 'react';

interface Props<T extends RowData> {
  column: Column<T, unknown>;
  title: ReactNode;
  /** تعداد ستون‌های مرتب‌شده؛ اگر بیش از یکی بود شمارهٔ اولویت نشان داده می‌شود */
  sortedCount?: number;
}

/**
 * سرستون: کلیک = مرتب‌سازی (صعودی ← نزولی ← حذف)، Shift+کلیک = مرتب‌سازی چندستونه.
 * جهت مرتب‌سازی هم با آیکن و هم با aria-sort برای صفحه‌خوان‌ها نمایش داده می‌شود.
 */
export function DataTableColumnHeader<T extends RowData>({ column, title, sortedCount = 0 }: Props<T>) {
  const { token } = theme.useToken();
  const canSort = column.getCanSort();
  const dir = column.getIsSorted();
  const order = column.getSortIndex();

  if (!canSort) return <span>{title}</span>;

  const onClick = (e: MouseEvent) => column.getToggleSortingHandler()?.(e);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}
      aria-label={`مرتب‌سازی بر اساس ${typeof title === 'string' ? title : column.id}`}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: token.marginXXS,
        fontWeight: 'inherit',
      }}
    >
      <span>{title}</span>
      <Space size={0} direction="vertical" style={{ lineHeight: 0, fontSize: 10 }}>
        <CaretUpOutlined style={{ color: dir === 'asc' ? token.colorPrimary : token.colorTextQuaternary }} />
        <CaretDownOutlined style={{ color: dir === 'desc' ? token.colorPrimary : token.colorTextQuaternary }} />
      </Space>
      {sortedCount > 1 && order >= 0 ? <sup style={{ color: token.colorPrimary }}>{order + 1}</sup> : null}
    </button>
  );
}
