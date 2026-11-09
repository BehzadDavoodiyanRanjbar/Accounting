import { Button, Col, Input, InputNumber, Row, Select, Space, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import type { Column, RowData, Table } from '@tanstack/react-table';
import { useDebouncedValue } from './hooks/useDataTable';
import type { DateRange, NumberRange } from './types';

const JALALI = /^\d{4}\/\d{2}\/\d{2}$/;

function labelOf<T extends RowData>(c: Column<T, unknown>): string {
  const m = c.columnDef.meta;
  if (m?.label) return m.label;
  return typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id;
}

/** فیلتر متنی با تأخیر (debounce) تا به‌ازای هر کلید درخواست نرود. */
function TextFilter({ value, onChange, placeholder }: { value: string; onChange: (v: string | undefined) => void; placeholder?: string }) {
  const [local, setLocal] = useState(value);
  const debounced = useDebouncedValue(local, 400);
  const first = useRef(true);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (debounced !== value) onChange(debounced === '' ? undefined : debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  return <Input allowClear value={local} placeholder={placeholder ?? 'جستجو...'} onChange={(e) => setLocal(e.target.value)} />;
}

function NumberFilter({ value, onChange }: { value?: NumberRange; onChange: (v: NumberRange | undefined) => void }) {
  const set = (k: 'min' | 'max', n: number | null) => {
    const next = { ...(value ?? {}), [k]: n ?? undefined } as NumberRange;
    onChange(next.min === undefined && next.max === undefined ? undefined : next);
  };
  return (
    <Space.Compact style={{ width: '100%' }}>
      <InputNumber style={{ width: '50%' }} placeholder="از" value={value?.min} onChange={(n) => set('min', n)} />
      <InputNumber style={{ width: '50%' }} placeholder="تا" value={value?.max} onChange={(n) => set('max', n)} />
    </Space.Compact>
  );
}

/** تاریخ شمسی به‌صورت متن yyyy/mm/dd (مطابق بقیهٔ برنامه)؛ فقط مقدار معتبر اعمال می‌شود. */
function DateFilter({ value, onChange }: { value?: DateRange; onChange: (v: DateRange | undefined) => void }) {
  const [from, setFrom] = useState(value?.from ?? '');
  const [to, setTo] = useState(value?.to ?? '');
  useEffect(() => {
    setFrom(value?.from ?? '');
    setTo(value?.to ?? '');
  }, [value?.from, value?.to]);
  const apply = (f: string, t: string) => {
    const ok = (s: string) => s === '' || JALALI.test(s);
    if (!ok(f) || !ok(t)) return;
    onChange(f || t ? { from: f || undefined, to: t || undefined } : undefined);
  };
  return (
    <Space.Compact style={{ width: '100%' }}>
      <Input
        placeholder="از 1405/01/01"
        status={from && !JALALI.test(from) ? 'error' : undefined}
        value={from}
        onChange={(e) => {
          setFrom(e.target.value);
          apply(e.target.value, to);
        }}
      />
      <Input
        placeholder="تا 1405/12/29"
        status={to && !JALALI.test(to) ? 'error' : undefined}
        value={to}
        onChange={(e) => {
          setTo(e.target.value);
          apply(from, e.target.value);
        }}
      />
    </Space.Compact>
  );
}

interface Props<T extends RowData> {
  table: Table<T>;
  onReset: () => void;
  hasFilters: boolean;
}

/** نوار فیلترهای ستونی (متن، عدد، تاریخ، تک‌انتخابی، چندانتخابی) با پاک‌کردن تکی و کلی. */
export function DataTableFilters<T extends RowData>({ table, onReset, hasFilters }: Props<T>) {
  const cols = table.getAllLeafColumns().filter((c) => c.columnDef.meta?.filterType);
  if (!cols.length) return null;
  return (
    <div role="search" aria-label="فیلترهای جدول" style={{ marginBlockEnd: 12 }}>
      <Row gutter={[12, 12]}>
        {cols.map((c) => {
          const m = c.columnDef.meta!;
          const v = c.getFilterValue();
          return (
            <Col key={c.id} xs={24} sm={12} md={8} lg={6}>
              <Typography.Text type="secondary" style={{ display: 'block', marginBlockEnd: 4 }}>
                {labelOf(c)}
              </Typography.Text>
              {m.filterType === 'text' && (
                <TextFilter value={(v as string) ?? ''} onChange={(x) => c.setFilterValue(x)} placeholder={m.filterPlaceholder} />
              )}
              {m.filterType === 'number' && <NumberFilter value={v as NumberRange | undefined} onChange={(x) => c.setFilterValue(x)} />}
              {m.filterType === 'date' && <DateFilter value={v as DateRange | undefined} onChange={(x) => c.setFilterValue(x)} />}
              {m.filterType === 'select' && (
                <Select
                  allowClear
                  style={{ width: '100%' }}
                  placeholder="همه"
                  options={m.filterOptions}
                  value={(v as string | undefined) ?? undefined}
                  onChange={(x) => c.setFilterValue(x ?? undefined)}
                />
              )}
              {m.filterType === 'multiselect' && (
                <Select
                  mode="multiple"
                  allowClear
                  maxTagCount="responsive"
                  style={{ width: '100%' }}
                  placeholder="همه"
                  options={m.filterOptions}
                  value={(v as string[] | undefined) ?? []}
                  onChange={(x: string[]) => c.setFilterValue(x.length ? x : undefined)}
                />
              )}
            </Col>
          );
        })}
      </Row>
      {hasFilters ? (
        <Button type="link" onClick={onReset} style={{ paddingInline: 0, marginBlockStart: 4 }}>
          پاک‌کردن همهٔ فیلترها
        </Button>
      ) : null}
    </div>
  );
}
