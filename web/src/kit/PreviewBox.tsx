import { Alert, Button, Space } from 'antd';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { errorMessage } from '../api/client';

/** دکمهٔ «محاسبه (پیش‌نمایش)» با نمایش نتیجه یا خطا؛ run نتیجه را به‌صورت JSX برمی‌گرداند. */
export function PreviewBox({ label = 'محاسبه (پیش‌نمایش)', run }: { label?: string; run: () => Promise<ReactNode> }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReactNode>(null);
  const [err, setErr] = useState('');

  const go = async () => {
    setBusy(true);
    setErr('');
    try {
      setResult(await run());
    } catch (e) {
      setResult(null);
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Button onClick={() => void go()} loading={busy}>
        {label}
      </Button>
      {result ? <Alert type="info" showIcon={false} message={result} /> : null}
      {err ? <Alert type="error" showIcon message={err} /> : null}
    </Space>
  );
}
