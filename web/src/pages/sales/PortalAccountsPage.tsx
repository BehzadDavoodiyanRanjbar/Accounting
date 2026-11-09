import { App, Alert, Button, Card, Input, Modal, Space, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useState } from 'react';
import { errorMessage } from '../../api/client';
import { useCompany } from '../../api/CompanyContext';
import { useCsQuery } from '../../kit/hooks';
import { NeedCompany, useBankCall } from '../bank/common';

interface Acc {
  customerId: string;
  code: string;
  name: string;
  hasAccount: boolean;
  username: string;
  accountActive: boolean;
  mustChange: boolean;
  lastLogin: string;
}

/** رمز تصادفی ۱۰ کاراکتری (حرف + عدد) بدون نویسه‌های گمراه‌کننده */
const genPass = (): string => {
  const L = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ', D = '23456789';
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const a = new Uint32Array(8);
  crypto.getRandomValues(a);
  const mix = Array.from(a, (n, i) => (i % 3 === 0 ? D : L)[n % (i % 3 === 0 ? D.length : L.length)]);
  return [pick(L), pick(D), ...mix].sort(() => Math.random() - 0.5).join('');
};

/** مدیریت حساب‌های ورود خریداران به «پنل مشتری» */
export default function PortalAccountsPage() {
  const { company } = useCompany();
  const { message, modal } = App.useApp();
  const call = useBankCall();
  const q = useCsQuery<Acc[]>('portalAccList', {});
  const [ed, setEd] = useState<{ acc: Acc; username: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const url = `${window.location.origin}/portal`;

  const save = async (p: Record<string, unknown>, okMsg: string) => {
    setBusy(true);
    try {
      await call('portalAccSave', p);
      message.success(okMsg);
      return true;
    } catch (e) {
      message.error(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!ed) return;
    const ok = await save({ customerId: ed.acc.customerId, username: ed.username, password: ed.password }, ed.acc.hasAccount ? 'رمز جدید ثبت شد.' : 'حساب ساخته شد.');
    if (!ok) return;
    const info = `آدرس: ${url}\nنام کاربری: ${ed.acc.hasAccount ? ed.acc.username : ed.username}\nرمز: ${ed.password}`;
    setEd(null);
    modal.info({
      title: 'اطلاعات ورود را به خریدار بدهید',
      content: (
        <div>
          <pre style={{ direction: 'ltr', textAlign: 'left', whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 12, borderRadius: 6 }}>{info}</pre>
          <Typography.Paragraph type="secondary">این رمز دیگر نمایش داده نمی‌شود. خریدار در اولین ورود باید رمز تازه بگذارد.</Typography.Paragraph>
        </div>
      ),
      okText: 'کپی و بستن',
      onOk: () => void navigator.clipboard?.writeText(info).catch(() => undefined),
    });
  };

  const toggle = async (a: Acc) => {
    await save({ customerId: a.customerId, active: !a.accountActive }, a.accountActive ? 'حساب غیرفعال شد.' : 'حساب فعال شد.');
  };

  const cols: TableColumnsType<Acc> = [
    { title: 'کد', dataIndex: 'code', width: 90 },
    { title: 'خریدار', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
    { title: 'حساب پنل', render: (_, a) => (!a.hasAccount ? <Tag>ندارد</Tag> : a.accountActive ? <Tag color="success">فعال</Tag> : <Tag color="error">غیرفعال</Tag>) },
    { title: 'نام کاربری', dataIndex: 'username', render: (v: string) => <span style={{ direction: 'ltr', display: 'inline-block' }}>{v}</span> },
    { title: 'آخرین ورود', dataIndex: 'lastLogin' },
    { title: 'رمز اولیه', render: (_, a) => (a.hasAccount && a.mustChange ? <Tag color="warning">هنوز تغییر نکرده</Tag> : null) },
    {
      title: '',
      render: (_, a) => (
        <Space size="small">
          {!a.hasAccount ? (
            <Button size="small" type="primary" onClick={() => setEd({ acc: a, username: '', password: genPass() })}>
              ساخت حساب
            </Button>
          ) : (
            <>
              <Button size="small" onClick={() => setEd({ acc: a, username: a.username, password: genPass() })}>
                رمز جدید
              </Button>
              <Button size="small" danger={a.accountActive} onClick={() => void toggle(a)}>
                {a.accountActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <NeedCompany company={company}>
      <Alert
        type="info"
        showIcon
        message="پنل مشتری"
        description={
          <div>
            هر خریدار با نام کاربری و رمز جدا وارد <b style={{ direction: 'ltr', display: 'inline-block' }}>{url}</b> می‌شود و فقط فاکتورها، صورت‌حساب و چک‌های خودش را می‌بیند. فاکتورهای پیش‌نویس و ردشده نمایش داده نمی‌شوند. اتصال یک خریدار به حساب، فقط از همین صفحه انجام می‌شود.
          </div>
        }
      />
      <Card title="حساب خریداران">
        <Table<Acc> size="small" loading={q.isFetching} rowKey="customerId" dataSource={q.data ?? []} columns={cols} pagination={{ pageSize: 50, hideOnSinglePage: true }} scroll={{ x: 'max-content' }} locale={{ emptyText: 'خریداری ثبت نشده است. ابتدا از «مشتریان» خریدار اضافه کنید.' }} />
      </Card>
      <Modal open={!!ed} title={ed ? (ed.acc.hasAccount ? `رمز جدید — ${ed.acc.name}` : `ساخت حساب — ${ed.acc.name}`) : ''} okText="ثبت" cancelText="انصراف" confirmLoading={busy} onCancel={() => setEd(null)} onOk={() => void submit()}>
        {ed ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>نام کاربری (انگلیسی یا فارسی، ۳ تا ۳۲ کاراکتر، بدون فاصله)</div>
            <Input disabled={ed.acc.hasAccount} style={{ direction: 'ltr' }} value={ed.username} onChange={(e) => setEd({ ...ed, username: e.target.value.trim() })} />
            <div>رمز موقت (حداقل ۸ کاراکتر، هم حرف انگلیسی هم عدد)</div>
            <Space.Compact style={{ width: '100%' }}>
              <Input style={{ direction: 'ltr' }} value={ed.password} onChange={(e) => setEd({ ...ed, password: e.target.value })} />
              <Button onClick={() => setEd({ ...ed, password: genPass() })}>تولید رمز</Button>
            </Space.Compact>
          </Space>
        ) : null}
      </Modal>
    </NeedCompany>
  );
}
