import { Empty, Tooltip, theme } from 'antd';
import type { ReactNode } from 'react';
import { fmtNum } from './format';

/** نمودارهای سبک بدون کتابخانهٔ اضافه؛ ارقام با فونت برنامه فارسی نمایش داده می‌شوند */

/** نام ماه جلالی از کلید «1405/08» */
export const monthLabel = (key: string): string => {
  const M = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  const [y, m] = key.split('/');
  const i = Number(m) - 1;
  return i >= 0 && i < 12 ? `${M[i]} ${y}` : key;
};

/** اختصار مبلغ: میلیارد / میلیون / هزار */
export const compact = (v: number): string => {
  const a = Math.abs(v);
  const s = v < 0 ? '-' : '';
  const f = (x: number) => fmtNum(Math.round(x * 10) / 10, 1).replace(/\.0$/, '').replace(/٫۰$/, '');
  if (a >= 1e9) return `${s}${f(a / 1e9)} میلیارد`;
  if (a >= 1e6) return `${s}${f(a / 1e6)} میلیون`;
  if (a >= 1e3) return `${s}${f(a / 1e3)} هزار`;
  return `${s}${fmtNum(a)}`;
};

export interface BarPoint {
  label: string;
  a: number;
  b: number;
}

/** ستونی دوتایی ماه‌به‌ماه؛ اولین ماه سمت راست است */
export function PairBars({ data, aName, bName, aColor, bColor, height = 220 }: { data: BarPoint[]; aName: string; bName: string; aColor: string; bColor: string; height?: number }) {
  const { token } = theme.useToken();
  if (!data.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="داده‌ای در این بازه نیست" />;
  const max = Math.max(1, ...data.map((d) => Math.max(d.a, d.b)));
  const grid = [1, 0.75, 0.5, 0.25];
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 13 }}>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: aColor, marginInlineEnd: 6 }} />{aName}</span>
        {bName ? <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: bColor, marginInlineEnd: 6 }} />{bName}</span> : null}
      </div>
      <div style={{ position: 'relative', overflowX: 'auto', paddingTop: 4 }}>
        <div style={{ position: 'relative', height, minWidth: Math.max(320, data.length * 64) }}>
          {grid.map((g) => (
            <div key={g} style={{ position: 'absolute', insetInline: 0, bottom: `${g * 100}%`, borderTop: `1px dashed ${token.colorBorderSecondary}`, fontSize: 11, color: token.colorTextTertiary }}>
              <span style={{ position: 'absolute', insetInlineStart: 0, bottom: 2, lineHeight: 1.2 }}>{compact(max * g)}</span>
            </div>
          ))}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            {data.map((d) => (
              <Tooltip
                key={d.label}
                title={
                  <div>
                    <div>{d.label}</div>
                    <div>{aName}: {fmtNum(d.a)}</div>
                    {bName ? <div>{bName}: {fmtNum(d.b)}</div> : null}
                  </div>
                }
              >
                <div style={{ flex: 1, minWidth: 48, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4, cursor: 'default' }}>
                  <div style={{ width: bName ? '38%' : '50%', maxWidth: bName ? 22 : 34, height: `${(d.a / max) * 100}%`, minHeight: d.a ? 2 : 0, background: aColor, borderRadius: '4px 4px 0 0' }} />
                  {bName ? <div style={{ width: '38%', maxWidth: 22, height: `${(d.b / max) * 100}%`, minHeight: d.b ? 2 : 0, background: bColor, borderRadius: '4px 4px 0 0' }} /> : null}
                </div>
              </Tooltip>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, minWidth: Math.max(320, data.length * 64), marginTop: 6 }}>
          {data.map((d) => (
            <div key={d.label} style={{ flex: 1, minWidth: 48, textAlign: 'center', fontSize: 11, color: token.colorTextSecondary }}>
              {d.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface HItem {
  name: string;
  value: number;
  /** متن اختیاری کنار مقدار */
  text?: string;
}

/** میله‌های افقی برای «بیشترین‌ها» */
export function HBars({ items, color, empty = 'داده‌ای نیست.' }: { items: HItem[]; color: string; empty?: string }) {
  const { token } = theme.useToken();
  if (!items.length) return <div style={{ color: token.colorTextTertiary }}>{empty}</div>;
  const max = Math.max(1, ...items.map((x) => Math.abs(x.value)));
  return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0 }}>
      {items.map((x, i) => (
        <div key={`${x.name}-${i}`} style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, minWidth: 0 }}>
            <span style={{ flex: '1 1 0', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={x.name}>{x.name}</span>
            <span style={{ flex: '0 0 auto', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{x.text ?? fmtNum(x.value)}</span>
          </div>
          <div style={{ height: 8, background: token.colorFillTertiary, borderRadius: 4, marginTop: 3 }}>
            <div style={{ width: `${Math.max(1.5, (Math.abs(x.value) / max) * 100)}%`, height: '100%', background: color, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface Seg {
  name: string;
  value: number;
  color: string;
}

/** نوار ترکیبی درصدی با راهنما */
export function StackBar({ segs, footer }: { segs: Seg[]; footer?: ReactNode }) {
  const { token } = theme.useToken();
  const total = segs.reduce((t, s) => t + s.value, 0);
  if (total <= 0) return <div style={{ color: token.colorTextTertiary }}>داده‌ای نیست.</div>;
  return (
    <div>
      <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 }}>
        {segs.filter((s) => s.value > 0).map((s) => (
          <Tooltip key={s.name} title={`${s.name}: ${fmtNum(s.value)}`}>
            <div style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
          </Tooltip>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
        {segs.map((s) => (
          <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 8 }}>
            <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: s.color, marginInlineEnd: 7 }} />{s.name} <span style={{ color: token.colorTextTertiary }}>({fmtNum((s.value / total) * 100)}٪)</span></span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtNum(s.value)}</span>
          </div>
        ))}
      </div>
      {footer}
    </div>
  );
}
