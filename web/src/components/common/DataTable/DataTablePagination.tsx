import { Pagination, Space, Typography } from 'antd';
import { PAGE_SIZE_OPTIONS } from './types';

interface Props {
  page: number;
  pageSize: number;
  total: number;
  pageSizeOptions?: number[];
  disabled?: boolean;
  onChange: (page: number, pageSize: number) => void;
}

/** صفحه‌بندی: شمارهٔ صفحهٔ جاری، تعداد کل رکوردها، انتخاب اندازهٔ صفحه. */
export function DataTablePagination({ page, pageSize, total, pageSizeOptions, disabled, onChange }: Props) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <Space style={{ width: '100%', justifyContent: 'space-between', marginBlockStart: 12 }} wrap>
      <Typography.Text type="secondary" aria-live="polite">
        {`نمایش ${from.toLocaleString('en-US')} تا ${to.toLocaleString('en-US')} از ${total.toLocaleString('en-US')} رکورد`}
      </Typography.Text>
      <Pagination
        current={page}
        pageSize={pageSize}
        total={total}
        disabled={disabled}
        showSizeChanger
        pageSizeOptions={(pageSizeOptions ?? PAGE_SIZE_OPTIONS).map(String)}
        showLessItems
        onChange={onChange}
      />
    </Space>
  );
}
