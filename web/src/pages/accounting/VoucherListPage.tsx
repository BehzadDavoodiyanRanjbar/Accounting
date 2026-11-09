import { App, Alert, Button, Card, Input, Select, Space, Statistic, Table, Tabs, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { useCompany } from '../../api/CompanyContext';
import { csCall } from '../../api/costService';
import { downloadCsv } from '../../kit/exporter';
import type { ExportCol } from '../../kit/exporter';
import { fmtNum, str, todayJalali } from '../../kit/format';
import { useCsQuery } from '../../kit/hooks';
import type { Row } from '../../kit/types';
import { DateBox, NeedCompany, useBankCall } from '../bank/common';
import type { FyList } from './common';
import { useFyDefaults } from './common';
import { openBlankPrintWindow } from '../print/legacyPrint';
import { mapLimit } from '../print/mapLimit';
import { RangePrintModal } from '../print/RangePrintModal';
import { printVoucher, printVouchers } from './voucherPrint';

const TABS: Array<[string, string]> = [['all', 'همه'], ['draft', 'پیش‌نویس'], ['confirmed', 'تأیید شده'], ['manual', 'دستی'], ['auto', 'اتوماتیک'], ['sys', 'اختتامیه/افتتاحیه']];
const norm = (s: string) => s.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').toLowerCase();

interface ListRes {
  rows: Row[];
  nextNo?: number;
  autoErr?: { n: number; msgs: string[] };
  sorted?: boolean;
}

/** لیست اسناد حسابداری */
export default function VoucherListPage() {
  const { company, companies } = useCompany();
  const { message, modal, notification } = App.useApp();
  const nav = useNavigate();
  const call = useBankCall();
  const [sp] = useSearchParams();
  const years = useCsQuery<FyList>('yearList', {});
  const [fy, setFy] = useState(sp.get('fy') ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState<Row>({ from: '', to: '', fy: sp.get('fy') ?? '' });
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState('');
  const [rp, setRp] = useState(false);
  /* به‌طور پیش‌فرض فقط اسناد سال مالی انتخاب‌شده (سال جاری) نمایش داده می‌شود؛ با «همهٔ سال‌ها» همه دیده می‌شود */
  const fyd = useFyDefaults();
  const [initFor, setInitFor] = useState(sp.get('fy') ? company : '');
  useEffect(() => {
    if (!company || initFor === company || !fyd.ready) return;
    if (fyd.sy) {
      setFy(fyd.sy);
      setApplied((o) => ({ ...o, fy: fyd.sy }));
    }
    setInitFor(company);
  }, [company, initFor, fyd.ready, fyd.sy]);
  const q = useCsQuery<ListRes>('voucherList', applied, initFor === company);
  const all = useMemo(() => q.data?.rows ?? [], [q.data]);

  const list = useMemo(() => {
    const s = norm(search.trim());
    return all.filter((r) => {
      if (tab === 'draft' && r.Status !== 'draft') return false;
      if (tab === 'confirmed' && r.Status !== 'confirmed') return false;
      if (tab === 'manual' && r.Source !== 'manual') return false;
      if (tab === 'auto' && r.Source !== 'auto') return false;
      if (tab === 'sys' && r.Source !== 'sys') return false;
      return !s || norm(`${str(r.No)} ${str(r.RefNo)} ${str(r.Ref)} ${str(r.Description)}`).includes(s);
    });
  }, [all, tab, search]);
  const total = list.reduce((t, r) => t + (Number(r.TotalDebit) || 0), 0);
  const rec = all.find((r) => str(r.VID) === sel);

  const need = () => {
    if (!rec) message.info('ابتدا یک سند را از جدول انتخاب کنید.');
    return rec;
  };
  const fail = (t: string) => (e: unknown) => notification.error({ message: t, description: errorMessage(e) });

  const toggle = async () => {
    const r = need();
    if (!r) return;
    try {
      const x = await call('voucherStatus', { id: str(r.VID), status: r.Status === 'draft' ? 'confirmed' : 'draft' });
      message.success(`وضعیت سند ${str(r.No)}: ${x.Status === 'draft' ? 'پیش‌نویس' : 'تأیید شده'}`);
    } catch (e) {
      fail('تغییر وضعیت انجام نشد')(e);
    }
  };
  const del = () => {
    const r = need();
    if (!r) return;
    modal.confirm({
      title: 'حذف سند',
      content: `سند شماره ${str(r.No)} حذف شود؟`,
      okText: 'حذف',
      okButtonProps: { danger: true },
      cancelText: 'انصراف',
      onOk: async () => {
        try {
          await call('voucherDelete', { id: str(r.VID) });
          setSel('');
          message.success('حذف شد.');
        } catch (e) {
          fail('حذف انجام نشد')(e);
        }
      },
    });
  };
  const printMany = async (rs: Row[], o: 'L' | 'P') => {
    const w = openBlankPrintWindow();
    if (!w) {
      message.warning('پنجرهٔ چاپ مسدود شد؛ اجازهٔ باز شدن پنجره را بدهید.');
      return;
    }
    try {
      const docs = await mapLimit(rs, 5, (x) => csCall<Row>('voucherGet', company, { id: str(x.VID) }));
      const co = companies.find((c) => c.CompanyID === company);
      printVouchers(docs, o, str(co?.Name), w);
    } catch (e) {
      w.close();
      throw e;
    }
  };
  const print = async (o: 'L' | 'P') => {
    const r = need();
    if (!r) return;
    try {
      const x = await csCall<Row>('voucherGet', company, { id: str(r.VID) });
      const co = companies.find((c) => c.CompanyID === company);
      if (!printVoucher(x, o, str(co?.Name))) message.warning('پنجرهٔ چاپ مسدود شد؛ اجازهٔ باز شدن پنجره را بدهید.');
    } catch (e) {
      fail('چاپ انجام نشد')(e);
    }
  };
  const sort = () =>
    modal.confirm({
      title: 'مرتب‌سازی بر اساس تاریخ',
      width: 560,
      content: 'شمارهٔ سند اسناد هر سال مالی (به‌جز سال‌های بسته‌شده) بر اساس تاریخ (و در تاریخ‌های برابر بر اساس شماره ارجاع) از ۱ دوباره شماره‌گذاری شود؟ شماره ارجاع (دائمی) هیچ تغییری نمی‌کند. شمارهٔ سند فقط یک شمارهٔ موقت است؛ اگر شمارهٔ سند قبلی را چاپ کرده‌اید، با شماره ارجاع آن را پیدا کنید.',
      okText: 'مرتب‌سازی',
      cancelText: 'انصراف',
      onOk: async () => {
        try {
          const r = await call('voucherRenumber', {});
          message.success(r.changed ? `مرتب‌سازی انجام شد: شمارهٔ ${str(r.changed)} سند از ${str(r.total)} سند عوض شد.` : 'اسناد از قبل مرتب بودند.');
        } catch (e) {
          fail('مرتب‌سازی انجام نشد')(e);
        }
      },
    });
  const rebuild = () =>
    modal.confirm({
      title: 'بازسازی اسناد خودکار',
      content: 'همهٔ اسناد خودکار از روی فاکتورها، تولید، بانک و چک‌ها دوباره بررسی شود؟ (سندهای بدون تغییر دست نمی‌خورند و شماره‌شان ثابت می‌ماند)',
      okText: 'بازسازی',
      cancelText: 'انصراف',
      onOk: async () => {
        try {
          const r = await call('autoRebuild', {});
          message.success(`بررسی شد: ${str(r.created)} سند جدید، ${str(r.updated)} اصلاح، ${str(r.deleted)} حذف${r.errors ? ` — ${str(r.errors)} مورد خطا` : ''}.`);
        } catch (e) {
          fail('بازسازی انجام نشد')(e);
        }
      },
    });

  const ex: ExportCol<Row>[] = [
    { title: 'شماره سند (موقت)', value: (r) => r.No },
    { title: 'ارجاع (دائمی)', value: (r) => r.RefNo },
    { title: 'مرجع', value: (r) => r.Ref },
    { title: 'تاریخ', value: (r) => r.DateJalali },
    { title: 'شرح', value: (r) => r.Description },
    { title: 'مبلغ بدهکار', value: (r) => r.TotalDebit, numeric: true },
    { title: 'مبلغ بستانکار', value: (r) => r.TotalCredit, numeric: true },
    { title: 'وضعیت', value: (r) => (r.Status === 'draft' ? 'پیش‌نویس' : 'تأیید شده') },
    { title: 'پروژه', value: (r) => r.ProjName },
    { title: 'نوع', value: (r) => (r.Source === 'auto' ? 'خودکار' : r.Source === 'sys' ? 'سیستمی' : 'دستی') },
  ];

  const cols: TableColumnsType<Row> = [
    { title: 'شماره سند (موقت)', key: 'no', render: (_, r) => <b>{str(r.No)}</b>, sorter: (a, b) => Number(a.No) - Number(b.No), width: 120 },
    { title: 'ارجاع (دائمی)', dataIndex: 'RefNo', width: 110, sorter: (a, b) => Number(a.RefNo) - Number(b.RefNo) },
    { title: 'تاریخ', key: 'd', render: (_, r) => <span>{str(r.DateJalali)} <Typography.Text type="secondary">{str(r.Time)}</Typography.Text></span>, sorter: (a, b) => str(a.DateJalali).localeCompare(str(b.DateJalali)), width: 130 },
    { title: 'شرح', dataIndex: 'Description', width: 300 },
    {
      title: 'مبلغ',
      key: 'a',
      align: 'end',
      render: (_, r) => (
        <span>
          {fmtNum(r.TotalDebit)} {Math.abs((Number(r.TotalDebit) || 0) - (Number(r.TotalCredit) || 0)) > 0.005 ? <Tag color="red">ناتراز</Tag> : null}
        </span>
      ),
      sorter: (a, b) => Number(a.TotalDebit) - Number(b.TotalDebit),
    },
    { title: 'وضعیت', key: 's', render: (_, r) => (r.Status === 'draft' ? <Tag>پیش‌نویس</Tag> : <Tag color="green">تأیید شده</Tag>), width: 100 },
    { title: 'پروژه', dataIndex: 'ProjName' },
    {
      title: 'نوع / منبع',
      key: 'src',
      render: (_, r) =>
        r.Source === 'auto' ? (
          <span><Tag color="blue">خودکار</Tag> <Typography.Text type="secondary">{str(r.SrcLabel)}</Typography.Text></span>
        ) : r.Source === 'sys' ? (
          <span><Tag color="purple">سیستمی</Tag> <Typography.Text type="secondary">{str(r.SrcLabel)}</Typography.Text></span>
        ) : (
          'دستی'
        ),
    },
  ];

  const er = q.data?.autoErr;

  return (
    <NeedCompany company={company}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Title level={3} style={{ margin: 0 }}>لیست اسناد حسابداری</Typography.Title>
          <Space wrap>
            <Button type="primary" onClick={() => nav(`/p/ac_new?new=${Date.now()}`)}>+ سند جدید</Button>
            <Button onClick={() => { const r = need(); if (r) nav(`/p/ac_new?id=${encodeURIComponent(str(r.VID))}`); }}>مشاهده / ویرایش</Button>
            <Button onClick={() => void toggle()}>تأیید / پیش‌نویس</Button>
            <Button onClick={() => void print('L')}>چاپ افقی</Button>
            <Button onClick={() => void print('P')}>چاپ عمودی</Button>
            <Button onClick={() => setRp(true)}>چاپ از شماره تا شماره</Button>
            <Button danger onClick={del}>حذف</Button>
            <Button onClick={() => downloadCsv(`vouchers-${todayJalali().replace(/\//g, '-')}`, ex, list)}>خروجی Excel (CSV)</Button>
            <Button onClick={sort}>مرتب‌سازی بر اساس تاریخ</Button>
            <Button onClick={rebuild}>بازسازی اسناد خودکار</Button>
          </Space>
          <Space wrap align="end">
            <Input style={{ width: 280 }} placeholder="جستجو (شماره سند، ارجاع، شرح)" value={search} onChange={(e) => setSearch(e.target.value)} allowClear />
            <Select
              style={{ width: 230 }}
              value={fy}
              onChange={setFy}
              options={[{ value: '', label: 'همهٔ سال‌ها' }, ...(years.data?.rows ?? []).map((y) => ({ value: String(y.sy), label: `${y.title}${y.status === 'closed' ? ' (بسته)' : ''}` }))]}
            />
            <DateBox value={from} onChange={setFrom} placeholder="از تاریخ" />
            <DateBox value={to} onChange={setTo} placeholder="تا تاریخ" />
            <Button type="primary" onClick={() => setApplied({ from, to, fy })}>نمایش</Button>
          </Space>
        </Space>
      </Card>
      {q.data?.sorted === false ? (
        <Alert type="warning" showIcon message="ترتیب شمارهٔ اسناد با تاریخ‌ها هم‌خوان نیست (مثلاً سندی با تاریخ قدیمی‌تر بعداً ثبت شده). برای اصلاح، دکمهٔ «مرتب‌سازی بر اساس تاریخ» را بزنید؛ شماره ارجاع دائمی عوض نمی‌شود." />
      ) : null}
      {er && er.n ? (
        <Alert
          type="error"
          showIcon
          message={`${er.n} مورد از اسناد خودکار صادر نشد:`}
          description={
            <div>
              <ul style={{ margin: 0, paddingInlineStart: 20 }}>{er.msgs.map((m, i) => <li key={i}>{m}</li>)}</ul>
              <div style={{ marginTop: 6 }}>معمولاً با افزودن حساب‌های استاندارد گم‌شده (در «جدول حساب‌ها») یا اصلاح همان سند مبدأ برطرف می‌شود؛ سپس «بازسازی اسناد خودکار» را بزنید.</div>
            </div>
          }
        />
      ) : null}
      {q.isError ? <Alert type="error" showIcon message={errorMessage(q.error)} /> : null}
      <Card>
        <Tabs activeKey={tab} onChange={setTab} items={TABS.map(([key, label]) => ({ key, label }))} />
        <Space size="large" style={{ marginBottom: 8 }} wrap>
          <Statistic title="تعداد اسناد (با فیلتر)" value={list.length} />
          <Statistic title="پیش‌نویس" value={list.filter((r) => r.Status === 'draft').length} />
          <Statistic title="جمع مبلغ اسناد" value={fmtNum(Math.round(total * 100) / 100)} />
        </Space>
        <Table<Row>
          size="small"
          rowKey={(r) => str(r.VID)}
          loading={q.isFetching}
          columns={cols}
          dataSource={list}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 30, 50, 100] }}
          rowClassName={(r) => (str(r.VID) === sel ? 'ant-table-row-selected' : '')}
          onRow={(r) => ({
            onClick: () => setSel((s) => (s === str(r.VID) ? '' : str(r.VID))),
            onDoubleClick: () => nav(`/p/ac_new?id=${encodeURIComponent(str(r.VID))}`),
            style: { cursor: 'pointer' },
          })}
          locale={{ emptyText: 'سندی یافت نشد. با «+ سند جدید» شروع کنید.' }}
        />
        <Typography.Text type="secondary">برای انتخاب روی ردیف کلیک کنید؛ برای ویرایش روی ردیف دو بار کلیک کنید.</Typography.Text>
      </Card>
      <RangePrintModal
        open={rp}
        onClose={() => setRp(false)}
        title="چاپ اسناد حسابداری از شماره تا شماره"
        rows={list}
        fields={[{ key: 'No', label: 'شماره سند' }, { key: 'RefNo', label: 'ارجاع (دائمی)' }]}
        orient
        onPrint={(rs, o) => printMany(rs, o)}
      />
    </NeedCompany>
  );
}
