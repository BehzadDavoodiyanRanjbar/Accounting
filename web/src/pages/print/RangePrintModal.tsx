import { App, Alert, Button, Input, Modal, Radio, Space, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { str } from '../../kit/format';
import type { Row } from '../../kit/types';

export interface NumField {
  key: string;
  label: string;
}

export const MAX_RANGE_DOCS = 300;

/** عدد داخل شماره (ارقام فارسی/انگلیسی)؛ اگر رقمی نداشت NaN */
const numOf = (v: unknown): number => {
  const s = str(v)
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '');
  return s ? Number(s) : NaN;
};

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** ردیف‌های لیست فعلی (با فیلترهای اعمال‌شده) */
  rows: Row[];
  fields: NumField[];
  /** با انتخاب جهت صفحه (فقط اسناد حسابداری) */
  orient?: boolean;
  /** باید پنجرهٔ چاپ را همان لحظه (قبل از هر await) باز کند */
  onPrint: (rows: Row[], orient: 'L' | 'P') => Promise<void>;
}

/** پنجرهٔ مشترک «چاپ از شماره تا شماره» برای فاکتور فروش، فاکتور خرید و سند حسابداری */
export function RangePrintModal({ open, onClose, title, rows, fields, orient, onPrint }: Props) {
  const { message } = App.useApp();
  const [fk, setFk] = useState(fields[0]?.key ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [o, setO] = useState<'L' | 'P'>('L');
  const [busy, setBusy] = useState(false);

  const nums = useMemo(() => rows.map((r) => numOf(r[fk])).filter((n) => !Number.isNaN(n)), [rows, fk]);
  useEffect(() => {
    if (!open) return;
    setFrom(nums.length ? String(Math.min(...nums)) : '');
    setTo(nums.length ? String(Math.max(...nums)) : '');
  }, [open, fk, nums]);

  const picked = useMemo(() => {
    const a = numOf(from);
    const b = numOf(to);
    if (Number.isNaN(a) || Number.isNaN(b)) return [];
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return rows
      .map((r) => ({ r, n: numOf(r[fk]) }))
      .filter((x) => !Number.isNaN(x.n) && x.n >= lo && x.n <= hi)
      .sort((x, y) => x.n - y.n)
      .map((x) => x.r);
  }, [rows, fk, from, to]);

  const go = async () => {
    if (!picked.length) return;
    setBusy(true);
    try {
      await onPrint(picked, o);
      onClose();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'چاپ انجام نشد');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onCancel={busy ? undefined : onClose} title={title} footer={null} destroyOnClose>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Typography.Text type="secondary">
          چاپ بر اساس همین فهرستی است که الان روی صفحه می‌بینید. اگر سند دیگری لازم است، اول فیلتر تاریخ/سال را تنظیم و اعمال کنید.
        </Typography.Text>
        {fields.length > 1 ? (
          <Radio.Group value={fk} onChange={(e) => setFk(e.target.value as string)} options={fields.map((f) => ({ value: f.key, label: f.label }))} />
        ) : null}
        <Space wrap>
          <span>از شماره</span>
          <Input style={{ width: 150 }} inputMode="numeric" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span>تا شماره</span>
          <Input style={{ width: 150 }} inputMode="numeric" value={to} onChange={(e) => setTo(e.target.value)} />
        </Space>
        {orient ? (
          <Radio.Group value={o} onChange={(e) => setO(e.target.value as 'L' | 'P')} options={[{ value: 'L', label: 'چاپ افقی' }, { value: 'P', label: 'چاپ عمودی' }]} />
        ) : null}
        {!nums.length ? <Alert type="warning" showIcon message="در فهرست فعلی شماره‌ای برای چاپ پیدا نشد." /> : null}
        {picked.length > MAX_RANGE_DOCS ? <Alert type="error" showIcon message={`حداکثر ${MAX_RANGE_DOCS} مورد در هر نوبت قابل چاپ است؛ بازه را کوچک‌تر کنید.`} /> : null}
        <div>
          تعداد مورد انتخاب‌شده: <b>{picked.length}</b>
        </div>
        <Button type="primary" loading={busy} disabled={!picked.length || picked.length > MAX_RANGE_DOCS} onClick={() => void go()}>
          چاپ
        </Button>
      </Space>
    </Modal>
  );
}
