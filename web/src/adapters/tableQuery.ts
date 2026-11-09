import type {
  DateRange,
  FilterType,
  NumberRange,
  TableQuery,
  TableResult,
} from '../components/common/DataTable/types';
import { DEFAULT_PAGE_SIZE, defaultTableQuery } from '../components/common/DataTable/types';

/* ------------------------------------------------------------------ */
/* ۱) همگام‌سازی با آدرس صفحه (URL)                                    */
/* ------------------------------------------------------------------ */

/** ارقام فارسی/عربی را به لاتین تبدیل می‌کند (برای جستجو و مرتب‌سازی یکسان). */
export function normalizeDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

export function queryToSearchParams(q: TableQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.page > 1) p.set('page', String(q.page));
  if (q.pageSize !== DEFAULT_PAGE_SIZE) p.set('size', String(q.pageSize));
  if (q.sorting.length) p.set('sort', q.sorting.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(','));
  if (q.filters.length) p.set('filters', JSON.stringify(q.filters));
  if (q.globalFilter) p.set('q', q.globalFilter);
  return p;
}

export function searchParamsToQuery(p: URLSearchParams, base: Partial<TableQuery> = {}): TableQuery {
  const num = (v: string | null, d: number) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : d;
  };
  let filters: TableQuery['filters'] = [];
  try {
    const raw = p.get('filters');
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        filters = parsed.filter(
          (x): x is { id: string; value: unknown } => !!x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string',
        );
      }
    }
  } catch {
    filters = [];
  }
  const sorting = (p.get('sort') ?? '')
    .split(',')
    .filter(Boolean)
    .map((part) => {
      const [id, dir] = part.split(':');
      return { id, desc: dir === 'desc' };
    });
  return defaultTableQuery({
    ...base,
    page: num(p.get('page'), 1),
    pageSize: num(p.get('size'), base.pageSize ?? DEFAULT_PAGE_SIZE),
    sorting: sorting.length ? sorting : base.sorting ?? [],
    filters: filters.length ? filters : base.filters ?? [],
    globalFilter: p.get('q') ?? base.globalFilter ?? '',
  });
}

/* ------------------------------------------------------------------ */
/* ۲) تبدیل به قرارداد واقعی بک‌اند                                    */
/* ------------------------------------------------------------------ */

export type BackendOp = 'contains' | 'eq' | 'in' | 'gte' | 'lte' | 'between';

/** نگاشت یک ستون جدول به فیلد و عملگر بک‌اند (نام‌ها لزوماً یکی نیستند). */
export interface BackendFieldMap {
  field: string;
  type: FilterType;
}

export interface BackendRequest {
  page: number;
  pageSize: number;
  sort: Array<{ field: string; dir: 'asc' | 'desc' }>;
  filters: Array<{ field: string; op: BackendOp; value: unknown }>;
  search?: string;
}

/**
 * آداپتور اصلی: TableQuery ← درخواست بک‌اند.
 * وقتی بک‌اند صفحه‌بندی/فیلتر سمت سرور را پشتیبانی کرد، فقط همین تابع (و نگاشت ستون‌ها) تنظیم می‌شود.
 * ستونی که در نگاشت نباشد نادیده گرفته می‌شود (هرگز فرض نمی‌کنیم id ستون = نام فیلد بک‌اند).
 */
export function toBackendRequest(q: TableQuery, map: Record<string, BackendFieldMap>): BackendRequest {
  const filters: BackendRequest['filters'] = [];
  for (const f of q.filters) {
    const m = map[f.id];
    if (!m || f.value === undefined || f.value === null || f.value === '') continue;
    switch (m.type) {
      case 'text':
        filters.push({ field: m.field, op: 'contains', value: String(f.value) });
        break;
      case 'select':
        filters.push({ field: m.field, op: 'eq', value: f.value });
        break;
      case 'multiselect':
        if (Array.isArray(f.value) && f.value.length) filters.push({ field: m.field, op: 'in', value: f.value });
        break;
      case 'number': {
        const r = f.value as NumberRange;
        if (r.min !== undefined) filters.push({ field: m.field, op: 'gte', value: r.min });
        if (r.max !== undefined) filters.push({ field: m.field, op: 'lte', value: r.max });
        break;
      }
      case 'date': {
        const r = f.value as DateRange;
        if (r.from) filters.push({ field: m.field, op: 'gte', value: r.from });
        if (r.to) filters.push({ field: m.field, op: 'lte', value: r.to });
        break;
      }
    }
  }
  return {
    page: q.page,
    pageSize: q.pageSize,
    sort: q.sorting.filter((s) => map[s.id]).map((s) => ({ field: map[s.id].field, dir: s.desc ? 'desc' : 'asc' })),
    filters,
    search: q.globalFilter || undefined,
  };
}

/* ------------------------------------------------------------------ */
/* ۳) آداپتور موقت برای APIهایی که همهٔ ردیف‌ها را یک‌جا برمی‌گردانند   */
/* ------------------------------------------------------------------ */

export interface LegacyColumnSpec<T> {
  get: (row: T) => unknown;
  type: FilterType;
}

/**
 * API فعلی برنامه (مثل csList) همهٔ رکوردها را یک‌جا می‌دهد؛ تا زمانی که بک‌اند صفحه‌بندی سمت سرور
 * ندارد، همین تابع فیلتر/مرتب‌سازی/صفحه‌بندی را روی آرایه انجام می‌دهد. خروجی دقیقاً همان شکل پاسخ
 * سرور (rows + total) است؛ پس با آمدن API سمت‌سرور فقط منبع داده عوض می‌شود و DataTable دست نمی‌خورد.
 * برای داده‌های خیلی بزرگ (ده‌ها هزار ردیف) باید API سمت‌سرور ساخته شود.
 */
export function applyLegacyQuery<T>(
  rows: T[],
  q: TableQuery,
  spec: Record<string, LegacyColumnSpec<T>>,
  globalKeys: Array<(row: T) => unknown> = [],
): TableResult<T> {
  const norm = (v: unknown) => normalizeDigits(String(v ?? '')).toLowerCase();
  let out = rows;

  for (const f of q.filters) {
    const s = spec[f.id];
    if (!s || f.value === undefined || f.value === null || f.value === '') continue;
    out = out.filter((r) => {
      const v = s.get(r);
      switch (s.type) {
        case 'text':
          return norm(v).includes(norm(f.value));
        case 'select':
          return String(v ?? '') === String(f.value);
        case 'multiselect':
          return !Array.isArray(f.value) || f.value.length === 0 || f.value.map(String).includes(String(v ?? ''));
        case 'number': {
          const r = f.value as NumberRange;
          const n = Number(v);
          if (Number.isNaN(n)) return false;
          return (r.min === undefined || n >= r.min) && (r.max === undefined || n <= r.max);
        }
        case 'date': {
          const r = f.value as DateRange;
          const d = String(v ?? '');
          if (!d) return false;
          return (!r.from || d >= normalizeDigits(r.from)) && (!r.to || d <= normalizeDigits(r.to));
        }
        default:
          return true;
      }
    });
  }

  const g = q.globalFilter?.trim();
  if (g && globalKeys.length) {
    const needle = norm(g);
    out = out.filter((r) => globalKeys.some((k) => norm(k(r)).includes(needle)));
  }

  if (q.sorting.length) {
    const sorted = [...out];
    sorted.sort((a, b) => {
      for (const s of q.sorting) {
        const sp = spec[s.id];
        if (!sp) continue;
        const x = sp.get(a);
        const y = sp.get(b);
        const nx = Number(x);
        const ny = Number(y);
        let c: number;
        if (x !== '' && y !== '' && x != null && y != null && !Number.isNaN(nx) && !Number.isNaN(ny)) c = nx - ny;
        else c = String(x ?? '').localeCompare(String(y ?? ''), 'fa');
        if (c !== 0) return s.desc ? -c : c;
      }
      return 0;
    });
    out = sorted;
  }

  const total = out.length;
  const start = (Math.max(1, q.page) - 1) * q.pageSize;
  return { rows: out.slice(start, start + q.pageSize), total };
}
