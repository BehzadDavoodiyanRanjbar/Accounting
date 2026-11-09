import { Alert, Button, Input, Modal, Space, Typography } from 'antd';
import type { ReactNode } from 'react';
import { App } from 'antd';
import { useState } from 'react';
import { errorMessage } from '../../api/client';
import { useCompany } from '../../api/CompanyContext';
import { csCall } from '../../api/costService';
import { useQueryClient } from '@tanstack/react-query';
import type { Row } from '../../kit/types';

export const PERIOD_RE = /^\d{4}\/\d{2}$/;

/** ورودی «دورهٔ سال/ماه» (مثل 1405/04)؛ فقط مقدار معتبر به صفحه داده می‌شود */
export function PeriodInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  const bad = text !== '' && !PERIOD_RE.test(text);
  return (
    <Space>
      <span>دوره (سال/ماه)</span>
      <Input
        style={{ width: 120 }}
        placeholder="1405/04"
        value={text}
        status={bad ? 'error' : undefined}
        onChange={(e) => {
          const v = e.target.value.trim();
          setText(v);
          if (PERIOD_RE.test(v)) onChange(v);
        }}
      />
    </Space>
  );
}

/** پنل «ثبت در دفتر / لغو» برای محاسبه‌های ماهانه */
export function RunButtons({
  doAction,
  undoAction,
  period,
  params,
  doText,
  undoText,
  doLabel = 'ثبت در دفتر هزینهٔ قراردادها',
  undoLabel = 'لغو محاسبهٔ ماه',
  resultText,
  onDone,
  disabled,
}: {
  doAction: string;
  undoAction: string;
  period?: string;
  /** پارامترهای دلخواه (به‌جای period)؛ مثلاً { year } */
  params?: Row;
  doText: string;
  undoText: string;
  doLabel?: string;
  undoLabel?: string;
  resultText: (r: Row, undo: boolean) => string;
  onDone: () => void;
  disabled?: boolean;
}) {
  const { company } = useCompany();
  const { message, notification } = App.useApp();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const run = (action: string, undo: boolean) => async () => {
    setBusy(true);
    try {
      const r = await csCall<Row>(action, company, params ?? { period });
      message.success(resultText(r, undo));
      await qc.invalidateQueries({ queryKey: ['cs'] });
      await qc.invalidateQueries({ queryKey: ['csq'] });
      onDone();
    } catch (e) {
      notification.error({ message: 'انجام نشد', description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Space wrap>
      <Button type="primary" loading={busy} disabled={disabled} onClick={() => Modal.confirm({ title: 'تأیید', content: doText, okText: 'ثبت', cancelText: 'انصراف', onOk: run(doAction, false) })}>
        {doLabel}
      </Button>
      <Button danger loading={busy} onClick={() => Modal.confirm({ title: 'تأیید', content: undoText, okText: 'لغو', okButtonProps: { danger: true }, cancelText: 'انصراف', onOk: run(undoAction, true) })}>
        {undoLabel}
      </Button>
    </Space>
  );
}

export const Warnings = ({ list }: { list?: string[] }) =>
  list && list.length ? <Alert type="warning" showIcon message={<div style={{ whiteSpace: 'pre-line' }}>{list.join('\n')}</div>} /> : null;

export const Hint = ({ children }: { children: ReactNode }) => <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>{children}</Typography.Paragraph>;
