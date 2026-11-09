import { App, Button, Card, Input, Popconfirm, Progress, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../api/CompanyContext';
import { errorMessage } from '../../api/client';
import { fmtNum, str } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import type { Row } from '../../kit/types';
import { DateBox, NeedCompany, useBankCall } from '../bank/common';
import { NewOrderModal } from './NewOrderModal';
import { PSTC, PST_COLOR } from './common';

interface Res {
  kpi: { draft: number; run: number; done: number; doneCost: number; cancel: number };
  rows: Row[];
}

export default function OrderListPage() {
  const { company } = useCompany();
  const { message } = App.useApp();
  const nav = useNavigate();
  const call = useBankCall();
  const [f, setF] = useState({ status: '', q: '', from: '', to: '' });
  const [applied, setApplied] = useState(f);
  const [open, setOpen] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>();
  const q = useCsQuery<Res>('prodList', applied);
  const k = q.data?.kpi;

  useEffect(() => {
    clearTimeout(t.current);
    t.current = setTimeout(() => setApplied(f), 350);
    return () => clearTimeout(t.current);
  }, [f]);

  const del = async (id: string) => {
    try {
      await call('prodDelete', { id });
      message.success('حذف شد.');
    } catch (e) {
      message.error(errorMessage(e));
    }
  };

  const columns: TableColumnsType<Row> = [
    { title: 'شماره', dataIndex: 'OrderNo', render: (v: unknown) => <b>{str(v)}</b> },
    { title: 'تاریخ', dataIndex: 'DateJalali' },
    { title: 'محصول', dataIndex: 'Product' },
    { title: 'مقدار برنامه', align: 'right', render: (_, r) => `${fmtNum(r.PlannedQty, 3)} ${str(r.Unit)}` },
    { title: 'تولید واقعی', align: 'right', render: (_, r) => (r.ActualQty === '' ? '—' : `${fmtNum(r.ActualQty, 3)} ${str(r.Unit)}`) },
    {
      title: 'مراحل',
      render: (_, r) =>
        r.steps ? (
          <div style={{ minWidth: 80 }}>
            <small>
              {fmtNum(r.stepsDone)} از {fmtNum(r.steps)}
            </small>
            <Progress percent={Math.round((100 * Number(r.stepsDone)) / Number(r.steps))} size="small" showInfo={false} />
          </div>
        ) : (
          '—'
        ),
    },
    { title: 'بهای واحد', align: 'right', render: (_, r) => (r.UnitCost ? fmtNum(r.UnitCost) : '—') },
    { title: 'بهای کل', align: 'right', render: (_, r) => (r.TotalCost ? fmtNum(r.TotalCost) : '—') },
    { title: 'وضعیت', dataIndex: 'Status', render: (v: string) => <Tag color={PST_COLOR[PSTC[v]] ?? 'default'}>{v}</Tag> },
    {
      title: 'مربوط به',
      render: (_, r) =>
        [r.SaleSerial ? `فروش ${str(r.SaleSerial)}` : '', r.ParentNo ? `نیمه‌ساخته‌ی ${str(r.ParentNo)}` : ''].filter(Boolean).join(' | '),
    },
    {
      title: '',
      render: (_, r) => (
        <Space onClick={(e) => e.stopPropagation()}>
          <Button size="small" onClick={() => nav(`/p/po?id=${encodeURIComponent(str(r.OrderID))}`)}>
            باز کردن
          </Button>
          {r.Status === 'پیش‌نویس' || r.Status === 'لغو' ? (
            <Popconfirm title="این سفارش حذف شود؟" okText="حذف" cancelText="انصراف" onConfirm={() => del(str(r.OrderID))}>
              <Button size="small" danger>
                حذف
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <NeedCompany company={company}>
      <Space wrap size="large">
        <Statistic title="پیش‌نویس" value={fmtNum(k?.draft)} />
        <Statistic title="در حال تولید" value={fmtNum(k?.run)} />
        <Statistic title="تکمیل‌شده" value={fmtNum(k?.done)} />
        <Statistic title="جمع بهای تولیدهای تکمیل‌شده (ریال)" value={fmtNum(k?.doneCost)} />
        <Statistic title="لغو شده" value={fmtNum(k?.cancel)} />
      </Space>
      <Card size="small">
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Typography.Title level={5} style={{ margin: 0 }}>
            سفارش‌های تولید
          </Typography.Title>
          <Button type="primary" onClick={() => setOpen(true)}>
            + سفارش تولید جدید
          </Button>
        </Space>
        <Space wrap style={{ marginTop: 10 }}>
          <Select
            style={{ width: 160 }}
            value={f.status}
            onChange={(v) => setF({ ...f, status: v })}
            options={[{ value: '', label: 'همه وضعیت‌ها' }, ...Object.keys(PSTC).map((s) => ({ value: s, label: s }))]}
          />
          <Input allowClear style={{ width: 220 }} placeholder="جستجوی شماره یا محصول" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          <DateBox value={f.from} onChange={(v) => setF({ ...f, from: v })} placeholder="از تاریخ" />
          <DateBox value={f.to} onChange={(v) => setF({ ...f, to: v })} placeholder="تا تاریخ" />
        </Space>
      </Card>
      <Table<Row>
        size="small"
        bordered
        loading={q.isLoading}
        columns={columns}
        dataSource={q.data?.rows ?? []}
        rowKey="OrderID"
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 50, showSizeChanger: true }}
        locale={{ emptyText: 'سفارشی پیدا نشد. با «سفارش تولید جدید» شروع کنید.' }}
        onRow={(r) => ({ style: { cursor: 'pointer' }, onClick: () => nav(`/p/po?id=${encodeURIComponent(str(r.OrderID))}`) })}
      />
      <NewOrderModal open={open} onClose={() => setOpen(false)} />
    </NeedCompany>
  );
}
