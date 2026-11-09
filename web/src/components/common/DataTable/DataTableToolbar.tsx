import { FilterOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons';
import type { RowData, Table } from '@tanstack/react-table';
import { Badge, Button, Checkbox, Dropdown, Input, Modal, Space, Typography } from 'antd';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useDebouncedValue } from './hooks/useDataTable';
import type { BulkAction } from './types';

interface Props<T extends RowData> {
  table: Table<T>;
  globalSearch?: boolean;
  globalSearchPlaceholder?: string;
  globalFilter: string;
  onGlobalFilter: (v: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  filterCount: number;
  selectedIds: string[];
  selectedRows: T[];
  bulkActions?: BulkAction<T>[];
  onClearSelection: () => void;
  extra?: ReactNode;
}

/** نوار ابزار: جستجوی سراسری، فیلترها، نمایش ستون‌ها، عملیات گروهی روی ردیف‌های انتخاب‌شده. */
export function DataTableToolbar<T extends RowData>(p: Props<T>) {
  const [q, setQ] = useState(p.globalFilter);
  const debounced = useDebouncedValue(q, 400);
  const first = useRef(true);
  useEffect(() => setQ(p.globalFilter), [p.globalFilter]);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (debounced !== p.globalFilter) p.onGlobalFilter(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const hideable = p.table.getAllLeafColumns().filter((c) => c.columnDef.meta?.hideable !== false && c.getCanHide());

  const runBulk = (a: BulkAction<T>) => {
    const go = async () => {
      await a.onRun(p.selectedIds, p.selectedRows);
      p.onClearSelection();
    };
    if (a.confirm) {
      Modal.confirm({
        title: a.label,
        content: `این عملیات روی ${p.selectedIds.length.toLocaleString('en-US')} رکورد انتخاب‌شده اجرا می‌شود. ادامه می‌دهید؟`,
        okText: 'تأیید',
        cancelText: 'انصراف',
        okButtonProps: { danger: a.danger },
        onOk: go,
      });
    } else {
      void go();
    }
  };

  return (
    <div style={{ marginBlockEnd: 12 }}>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          {p.globalSearch ? (
            <Input
              allowClear
              style={{ width: 260 }}
              prefix={<SearchOutlined />}
              placeholder={p.globalSearchPlaceholder ?? 'جستجو در همهٔ ستون‌ها'}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="جستجوی سراسری"
            />
          ) : null}
          <Badge count={p.filterCount} size="small">
            <Button icon={<FilterOutlined />} type={p.showFilters ? 'primary' : 'default'} onClick={p.onToggleFilters}>
              فیلترها
            </Button>
          </Badge>
          <Dropdown
            trigger={['click']}
            dropdownRender={() => (
              <div style={{ background: 'var(--ant-color-bg-elevated, #fff)', padding: 12, borderRadius: 8, boxShadow: '0 6px 16px rgba(0,0,0,.12)' }}>
                <Space direction="vertical">
                  {hideable.map((c) => (
                    <Checkbox key={c.id} checked={c.getIsVisible()} onChange={c.getToggleVisibilityHandler()}>
                      {c.columnDef.meta?.label ?? (typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id)}
                    </Checkbox>
                  ))}
                </Space>
              </div>
            )}
          >
            <Button icon={<SettingOutlined />}>ستون‌ها</Button>
          </Dropdown>
        </Space>
        {p.extra}
      </Space>

      {p.selectedIds.length > 0 && (
        <Space wrap style={{ marginBlockStart: 12 }}>
          <Typography.Text strong>{p.selectedIds.length.toLocaleString('en-US')} رکورد انتخاب شده</Typography.Text>
          {(p.bulkActions ?? []).map((a) => (
            <Button key={a.key} danger={a.danger} onClick={() => runBulk(a)}>
              {a.label}
            </Button>
          ))}
          <Button type="link" onClick={p.onClearSelection}>
            لغو انتخاب
          </Button>
        </Space>
      )}
    </div>
  );
}
