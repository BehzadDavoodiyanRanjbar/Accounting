import { Input } from 'antd';
import type { InputProps, InputRef } from 'antd';
import { useLayoutEffect, useRef } from 'react';

/** ارقام فارسی/عربی ← لاتین؛ فقط رقم، یک نقطهٔ اعشار و علامت منفی اول رشته می‌ماند (مقدار خام بدون جداکننده) */
export function cleanNum(s: string): string {
  const t = s
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫]/g, '.')
    .replace(/[^0-9.\-]/g, '');
  const neg = t.startsWith('-');
  const body = t.replace(/-/g, '');
  const i = body.indexOf('.');
  const clean = i < 0 ? body : body.slice(0, i + 1) + body.slice(i + 1).replace(/\./g, '');
  return (neg ? '-' : '') + clean;
}

/** مقدار خام ← نمایش با جداکنندهٔ سه‌رقمی از راست (1,250,000) */
export function groupNum(raw: string): string {
  const neg = raw.startsWith('-');
  const body = neg ? raw.slice(1) : raw;
  const i = body.indexOf('.');
  const int = i < 0 ? body : body.slice(0, i);
  const frac = i < 0 ? '' : body.slice(i);
  return (neg ? '-' : '') + int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + frac;
}

type Props = Omit<InputProps, 'value' | 'onChange' | 'defaultValue'> & {
  value?: string | number | null;
  /** مقدار خام (بدون ویرگول) را برمی‌گرداند */
  onChange?: (v: string) => void;
};

/**
 * کادر ورود عدد: هنگام تایپ، سه‌رقم‌سه‌رقم از راست جدا می‌کند و ارقام فارسی را می‌پذیرد.
 * مقداری که به برنامه می‌رسد همیشه خام و لاتین است، پس محاسبه‌ها تغییری نمی‌کنند.
 */
export function NumInput({ value, onChange, className, style, ...rest }: Props) {
  const ref = useRef<InputRef>(null);
  const caret = useRef<number | null>(null);
  const shown = groupNum(cleanNum(value == null ? '' : String(value)));

  useLayoutEffect(() => {
    const el = ref.current?.input;
    if (caret.current == null || !el) return;
    let n = caret.current;
    let pos = 0;
    while (pos < el.value.length && n > 0) {
      if (/[0-9.\-]/.test(el.value[pos])) n--;
      pos++;
    }
    el.setSelectionRange(pos, pos);
    caret.current = null;
  });

  return (
    <Input
      inputMode="decimal"
      autoComplete="off"
      {...rest}
      ref={ref}
      className={`num-input ${className ?? ''}`}
      style={style}
      value={shown}
      onChange={(e) => {
        const el = e.target;
        const next = cleanNum(el.value);
        if (next !== cleanNum(value == null ? '' : String(value))) {
          const before = el.selectionStart ?? el.value.length;
          caret.current = cleanNum(el.value.slice(0, before)).length;
        }
        onChange?.(next);
      }}
    />
  );
}
