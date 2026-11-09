import { Select } from 'antd';
import { useMemo } from 'react';
import { useCompany } from '../api/CompanyContext';
import { todayJalali } from '../kit/format';
import { useCsQuery } from '../kit/hooks';
import { setSelectedFy, useSelectedFy } from '../pages/accounting/common';
import type { FyList } from '../pages/accounting/common';

/** نوار ثابت پایین همهٔ صفحه‌ها: سال مالی، تاریخ امروز و نام کاربر (مثل نسخهٔ قبلی برنامه) */
export const FY_BAR_HEIGHT = 46;

export function FiscalYearBar() {
  const { company, me } = useCompany();
  const q = useCsQuery<FyList>('yearList', {});
  const picked = useSelectedFy(company);
  const d = q.data;

  const v = useMemo(() => {
    if (!d) return null;
    const act = d.active;
    const sel = d.rows.some((y) => String(y.sy) === picked) ? Number(picked) : act;
    const rows = d.rows
      .filter((y) => y.vouchers > 0 || y.status === 'closed' || y.sy === act || y.sy === d.byDate || y.sy === sel)
      .sort((a, b) => b.sy - a.sy);
    const actRow = d.rows.find((y) => y.sy === act);
    return { act, sel, rows, off: sel !== act, actTj: actRow?.tj ?? '', dirty: d.rows.some((y) => y.dirty) };
  }, [d, picked]);

  if (!company || !v) return null;
  const label = (y: FyList['rows'][number]) => `سال مالی منتهی به ${y.tj}${y.status === 'closed' ? (y.dirty ? ' (بسته‌شده - نیازمند بستن مجدد)' : ' (بسته‌شده)') : ''}`;

  return (
    <div
      className="fy-bar"
      style={{
        position: 'fixed',
        insetInline: 0,
        bottom: 0,
        zIndex: 50,
        minHeight: FY_BAR_HEIGHT,
        background: v.off ? '#b54708' : '#1d2939',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        padding: '6px 14px',
        fontSize: 13,
      }}
    >
      <span>سال مالی:</span>
      <Select
        size="small"
        style={{ minWidth: 280 }}
        value={v.sel}
        options={v.rows.map((y) => ({ value: y.sy, label: label(y) }))}
        onChange={(sy) => setSelectedFy(company, String(sy))}
      />
      {v.off ? (
        <span style={{ fontWeight: 700 }}>
          ⚠ در حال مشاهدهٔ {v.sel < v.act ? 'سال قبل' : 'سال بعد'} هستید — برای بازگشت، «سال مالی منتهی به {v.actTj}» را انتخاب کنید.
        </span>
      ) : null}
      {v.dirty ? <span style={{ background: '#b42318', padding: '2px 8px', borderRadius: 10 }}>⚠ سال بسته‌شده ویرایش شده؛ بستن مجدد لازم است</span> : null}
      <span style={{ flex: 1 }} />
      <span style={{ opacity: 0.85 }}>امروز: {todayJalali()}</span>
      <span style={{ opacity: 0.85 }}>{me?.fullName || me?.username}</span>
    </div>
  );
}
