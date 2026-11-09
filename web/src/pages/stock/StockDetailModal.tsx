import { Modal, Spin, Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useNavigate } from 'react-router-dom';
import { fmtNum, str } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import type { Row } from '../../kit/types';
import { insName } from './common';

const small = (cols: TableColumnsType<Row>, rows: Row[]) => (
  <Table<Row> size="small" bordered pagination={false} columns={cols} dataSource={rows} rowKey={(_, i) => String(i)} locale={{ emptyText: 'ندارد' }} scroll={{ x: 'max-content' }} />
);

interface Props {
  product: string;
  name: string;
  onClose: () => void;
}

/** ریز موجودی یک کالا: خریدها، فروش‌ها و تولید/مصرف */
export function StockDetailModal({ product, name, onClose }: Props) {
  const nav = useNavigate();
  const q = useCsQuery<Row>('stockDetail', { product }, !!product);
  const r = q.data;
  const open = (id: string) => {
    onClose();
    nav(`/p/po?id=${encodeURIComponent(id)}`);
  };
  return (
    <Modal open={!!product} onCancel={onClose} onOk={onClose} cancelButtonProps={{ style: { display: 'none' } }} okText="بستن" width={900} title={`ریز موجودی: ${name}`}>
      {q.isLoading || !r ? (
        <Spin />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {r.opening ? (
            <div>
              <b>موجودی اولیه (ثبت‌شده هنگام تعریف کالا):</b> {str(r.opening.qty)}
              {r.opening.cost ? ` — بهای هر واحد: ${fmtNum(r.opening.cost)} ریال` : ''}
            </div>
          ) : null}
          <Typography.Text strong>خریدها (ستون خرید)</Typography.Text>
          {small(
            [
              { title: 'شماره فاکتور', dataIndex: 'no' },
              { title: 'تاریخ', dataIndex: 'date' },
              { title: 'فروشنده', dataIndex: 'party' },
              { title: 'نوع', render: (_, z) => (z.ret ? 'برگشت از خرید' : 'خرید') },
              { title: 'مقدار', dataIndex: 'qty' },
              { title: 'منبع', dataIndex: 'source' },
            ],
            r.purchases ?? [],
          )}
          <Typography.Text strong>فروش‌ها (ستون فروش / برگشت)</Typography.Text>
          {small(
            [
              { title: 'سریال', dataIndex: 'no' },
              { title: 'تاریخ', dataIndex: 'date' },
              { title: 'خریدار', dataIndex: 'party' },
              { title: 'موضوع', render: (_, z) => insName(z.ins) },
              { title: 'مقدار', dataIndex: 'qty' },
              { title: 'وضعیت', render: (_, z) => `${str(z.status)}${z.superseded ? ' (کنار گذاشته‌شده)' : ''}` },
            ],
            r.sales ?? [],
          )}
          {r.production && r.production.length ? (
            <>
              <Typography.Text strong>تولید و مصرف در تولید</Typography.Text>
              {small(
                [
                  { title: 'سفارش تولید', render: (_, z) => <a onClick={() => open(str(z.id))}>{str(z.no)}</a> },
                  { title: 'تاریخ', dataIndex: 'date' },
                  { title: 'نوع', render: (_, z) => (z.kind === 'in' ? 'تولید (افزایش)' : 'مصرف (کاهش)') },
                  { title: 'مقدار', dataIndex: 'qty' },
                ],
                r.production,
              )}
            </>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
