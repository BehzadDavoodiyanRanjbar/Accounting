import { Button, Empty, Result } from 'antd';

interface EmptyProps {
  filtered: boolean;
  text?: string;
  onReset: () => void;
}

/** حالت «بدون رکورد»؛ اگر دلیلش فیلتر است، دکمهٔ پاک‌کردن فیلترها را هم نشان می‌دهد. */
export function DataTableEmptyState({ filtered, text, onReset }: EmptyProps) {
  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={filtered ? 'رکوردی با این فیلترها پیدا نشد.' : text ?? 'هنوز رکوردی ثبت نشده است.'}
    >
      {filtered ? <Button onClick={onReset}>پاک‌کردن همهٔ فیلترها</Button> : null}
    </Empty>
  );
}

interface ErrorProps {
  message: string;
  onRetry?: () => void;
}

/** حالت خطا با دکمهٔ تلاش دوباره. */
export function DataTableErrorState({ message, onRetry }: ErrorProps) {
  return (
    <Result
      status="error"
      title="بارگذاری اطلاعات انجام نشد"
      subTitle={message}
      extra={
        onRetry ? (
          <Button type="primary" onClick={onRetry}>
            تلاش دوباره
          </Button>
        ) : null
      }
    />
  );
}
