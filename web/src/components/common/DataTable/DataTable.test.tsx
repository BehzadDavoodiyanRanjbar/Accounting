import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ColumnDef } from '@tanstack/react-table';
import { ConfigProvider } from 'antd';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { applyLegacyQuery, type LegacyColumnSpec } from '../../../adapters/tableQuery';
import { DataTable } from './DataTable';
import { defaultTableQuery, type TableQuery } from './types';

interface Row {
  id: string;
  name: string;
  amount: number;
}
const ALL: Row[] = Array.from({ length: 25 }, (_, i) => ({ id: String(i + 1), name: `نام ${i + 1}`, amount: (i + 1) * 10 }));
const spec: Record<string, LegacyColumnSpec<Row>> = {
  name: { get: (r) => r.name, type: 'text' },
  amount: { get: (r) => r.amount, type: 'number' },
};
const columns: ColumnDef<Row>[] = [
  { id: 'name', accessorKey: 'name', header: 'نام', meta: { label: 'نام', filterType: 'text' } },
  { id: 'amount', accessorKey: 'amount', header: 'مبلغ', meta: { label: 'مبلغ', numeric: true } },
];

/** کنترل‌کنندهٔ ساده: query را نگه می‌دارد و داده را با آداپتور تولید می‌کند (مثل صفحهٔ واقعی). */
function Harness(props: {
  onQuery?: (q: TableQuery) => void;
  error?: string | null;
  onRetry?: () => void;
  data?: Row[];
  selectable?: boolean;
}) {
  const [query, setQuery] = useState(defaultTableQuery({ pageSize: 10 }));
  const page = applyLegacyQuery(props.data ?? ALL, query, spec);
  return (
    <ConfigProvider direction="rtl">
      <DataTable<Row>
        columns={columns}
        data={page.rows}
        total={page.total}
        query={query}
        onQueryChange={(q) => {
          props.onQuery?.(q);
          setQuery(q);
        }}
        getRowId={(r) => r.id}
        error={props.error}
        onRetry={props.onRetry}
        selectable={props.selectable}
        emptyText="خالی است"
      />
    </ConfigProvider>
  );
}

describe('DataTable', () => {
  it('ردیف‌ها و تعداد کل را نشان می‌دهد', () => {
    render(<Harness />);
    expect(screen.getByText('نام 1')).toBeInTheDocument();
    expect(screen.queryByText('نام 11')).not.toBeInTheDocument();
    expect(screen.getByText(/از 25 رکورد/)).toBeInTheDocument();
  });

  it('کلیک روی سرستون مرتب‌سازی را تغییر می‌دهد و صفحه را به ۱ برمی‌گرداند', () => {
    const onQuery = vi.fn();
    render(<Harness onQuery={onQuery} />);
    fireEvent.click(screen.getByRole('button', { name: /مرتب‌سازی بر اساس مبلغ/ }));
    const last = onQuery.mock.calls.at(-1)![0] as TableQuery;
    expect(last.sorting).toEqual([{ id: 'amount', desc: false }]);
    expect(last.page).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: /مرتب‌سازی بر اساس مبلغ/ }));
    expect((onQuery.mock.calls.at(-1)![0] as TableQuery).sorting).toEqual([{ id: 'amount', desc: true }]);
  });

  it('رفتن به صفحهٔ بعد داده را عوض می‌کند', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTitle('2'));
    expect(screen.getByText('نام 11')).toBeInTheDocument();
    expect(screen.queryByText('نام 1')).not.toBeInTheDocument();
  });

  it('فیلتر ستونی (با debounce) اعمال می‌شود و صفحه به ۱ برمی‌گردد', async () => {
    const onQuery = vi.fn();
    render(<Harness onQuery={onQuery} />);
    fireEvent.click(screen.getByTitle('2'));
    fireEvent.click(screen.getByRole('button', { name: /فیلترها/ }));
    fireEvent.change(screen.getByPlaceholderText('جستجو...'), { target: { value: 'نام 2' } });
    await waitFor(() => expect(screen.getByText(/از 7 رکورد/)).toBeInTheDocument(), { timeout: 2000 });
    const last = onQuery.mock.calls.at(-1)![0] as TableQuery;
    expect(last.page).toBe(1);
    expect(last.filters).toEqual([{ id: 'name', value: 'نام 2' }]);
  });

  it('حالت خالی با فیلتر، دکمهٔ پاک‌کردن فیلتر دارد', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /فیلترها/ }));
    fireEvent.change(screen.getByPlaceholderText('جستجو...'), { target: { value: 'چیزی که نیست' } });
    await waitFor(() => expect(screen.getByText('رکوردی با این فیلترها پیدا نشد.')).toBeInTheDocument(), { timeout: 2000 });
    fireEvent.click(screen.getAllByText('پاک‌کردن همهٔ فیلترها')[0]);
    await waitFor(() => expect(screen.getByText('نام 1')).toBeInTheDocument());
  });

  it('حالت خالی بدون فیلتر متن پیش‌فرض را نشان می‌دهد', () => {
    render(<Harness data={[]} />);
    expect(screen.getByText('خالی است')).toBeInTheDocument();
  });

  it('حالت خطا دکمهٔ تلاش دوباره دارد', () => {
    const retry = vi.fn();
    render(<Harness error="قطع ارتباط" onRetry={retry} />);
    expect(screen.getByText('قطع ارتباط')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /تلاش دوباره/ }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('انتخاب ردیف تعداد انتخاب‌شده‌ها را نشان می‌دهد', () => {
    render(<Harness selectable />);
    const boxes = screen.getAllByRole('checkbox');
    fireEvent.click(boxes[1]);
    expect(screen.getByText(/1 رکورد انتخاب شده/)).toBeInTheDocument();
  });
});
