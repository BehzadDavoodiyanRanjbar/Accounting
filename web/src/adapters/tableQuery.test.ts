import { describe, expect, it } from 'vitest';
import {
  applyLegacyQuery,
  normalizeDigits,
  queryToSearchParams,
  searchParamsToQuery,
  toBackendRequest,
  type LegacyColumnSpec,
} from './tableQuery';
import { defaultTableQuery } from '../components/common/DataTable/types';

interface Row {
  id: string;
  name: string;
  amount: number;
  date: string;
  status: string;
}
const rows: Row[] = [
  { id: '1', name: 'آلفا', amount: 300, date: '1405/01/10', status: 'a' },
  { id: '2', name: 'بتا', amount: 100, date: '1405/02/10', status: 'b' },
  { id: '3', name: 'گاما', amount: 200, date: '1405/03/10', status: 'a' },
  { id: '4', name: 'دلتا ۱۲', amount: 200, date: '1405/04/10', status: 'c' },
];
const spec: Record<string, LegacyColumnSpec<Row>> = {
  name: { get: (r) => r.name, type: 'text' },
  amount: { get: (r) => r.amount, type: 'number' },
  date: { get: (r) => r.date, type: 'date' },
  status: { get: (r) => r.status, type: 'select' },
  multi: { get: (r) => r.status, type: 'multiselect' },
};

describe('applyLegacyQuery', () => {
  it('صفحه‌بندی و تعداد کل', () => {
    const r = applyLegacyQuery(rows, defaultTableQuery({ pageSize: 2, page: 2 }), spec);
    expect(r.total).toBe(4);
    expect(r.rows.map((x) => x.id)).toEqual(['3', '4']);
  });

  it('مرتب‌سازی عددی نزولی و چندستونه', () => {
    const r = applyLegacyQuery(
      rows,
      defaultTableQuery({ sorting: [{ id: 'amount', desc: true }, { id: 'name', desc: false }] }),
      spec,
    );
    expect(r.rows.map((x) => x.id)).toEqual(['1', '4', '3', '2']) // در تساوی مبلغ، «دلتا» قبل از «گاما» (ترتیب الفبای فارسی);
  });

  it('فیلتر متنی با ارقام فارسی و لاتین یکسان', () => {
    expect(normalizeDigits('۱۲٣')).toBe('123');
    const r = applyLegacyQuery(rows, defaultTableQuery({ filters: [{ id: 'name', value: '12' }] }), spec);
    expect(r.rows.map((x) => x.id)).toEqual(['4']);
  });

  it('فیلتر عددی، تاریخ، تک‌انتخابی و چندانتخابی', () => {
    expect(applyLegacyQuery(rows, defaultTableQuery({ filters: [{ id: 'amount', value: { min: 150, max: 250 } }] }), spec).total).toBe(2);
    expect(applyLegacyQuery(rows, defaultTableQuery({ filters: [{ id: 'date', value: { from: '1405/02/01', to: '1405/03/30' } }] }), spec).total).toBe(2);
    expect(applyLegacyQuery(rows, defaultTableQuery({ filters: [{ id: 'status', value: 'a' }] }), spec).total).toBe(2);
    expect(applyLegacyQuery(rows, defaultTableQuery({ filters: [{ id: 'multi', value: ['a', 'c'] }] }), spec).total).toBe(3);
  });

  it('جستجوی سراسری', () => {
    const r = applyLegacyQuery(rows, defaultTableQuery({ globalFilter: 'بتا' }), spec, [(x) => x.name]);
    expect(r.rows.map((x) => x.id)).toEqual(['2']);
  });

  it('فیلتر خالی یا ستون ناشناخته نادیده گرفته می‌شود', () => {
    const r = applyLegacyQuery(rows, defaultTableQuery({ filters: [{ id: 'name', value: '' }, { id: 'nope', value: 'x' }] }), spec);
    expect(r.total).toBe(4);
  });
});

describe('همگام‌سازی با URL', () => {
  it('رفت‌وبرگشت query', () => {
    const q = defaultTableQuery({
      page: 3,
      pageSize: 50,
      sorting: [{ id: 'amount', desc: true }, { id: 'name', desc: false }],
      filters: [{ id: 'name', value: 'الف' }, { id: 'amount', value: { min: 1 } }],
      globalFilter: 'جستجو',
    });
    const back = searchParamsToQuery(queryToSearchParams(q));
    expect(back).toEqual(q);
  });

  it('JSON خراب فیلتر باعث خطا نمی‌شود', () => {
    const p = new URLSearchParams('filters=%7Bbad&page=abc');
    const q = searchParamsToQuery(p);
    expect(q.filters).toEqual([]);
    expect(q.page).toBe(1);
  });
});

describe('toBackendRequest', () => {
  it('نام ستون را به نام فیلد بک‌اند و عملگر ترجمه می‌کند', () => {
    const req = toBackendRequest(
      defaultTableQuery({
        page: 2,
        sorting: [{ id: 'amount', desc: true }, { id: 'unknown', desc: false }],
        filters: [
          { id: 'name', value: 'الف' },
          { id: 'amount', value: { min: 5, max: 9 } },
          { id: 'status', value: 'a' },
          { id: 'ghost', value: 'x' },
        ],
        globalFilter: 'q',
      }),
      {
        name: { field: 'Title', type: 'text' },
        amount: { field: 'Amount', type: 'number' },
        status: { field: 'Status', type: 'select' },
      },
    );
    expect(req.sort).toEqual([{ field: 'Amount', dir: 'desc' }]);
    expect(req.filters).toEqual([
      { field: 'Title', op: 'contains', value: 'الف' },
      { field: 'Amount', op: 'gte', value: 5 },
      { field: 'Amount', op: 'lte', value: 9 },
      { field: 'Status', op: 'eq', value: 'a' },
    ]);
    expect(req.search).toBe('q');
    expect(req.page).toBe(2);
  });
});
