import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { queryToSearchParams, searchParamsToQuery } from '../adapters/tableQuery';
import type { TableQuery } from '../components/common/DataTable/types';

/**
 * وضعیت جدول (صفحه، اندازه، مرتب‌سازی، فیلترها، جستجو) را در آدرس صفحه نگه می‌دارد؛
 * پس با رفرش یا اشتراک لینک، همان نمای جدول برمی‌گردد.
 */
export function useTableQueryState(base: Partial<TableQuery> = {}): [TableQuery, (q: TableQuery) => void] {
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => searchParamsToQuery(params, base), [params]); // eslint-disable-line react-hooks/exhaustive-deps
  const setQuery = useCallback((q: TableQuery) => setParams(queryToSearchParams(q), { replace: true }), [setParams]);
  return [query, setQuery];
}
