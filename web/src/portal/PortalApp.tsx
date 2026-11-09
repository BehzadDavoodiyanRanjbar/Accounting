import { App as AntApp, Alert, Button, Card, Checkbox, ConfigProvider, Form, Input, Layout, Menu, Space, Spin, Typography } from 'antd';
import faIR from 'antd/locale/fa_IR';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { appTheme } from '../theme';
import { clearPToken, getPToken, pcall, PortalError, perr, setPToken } from './client';
import { Cheques, Invoices, Overview, Statement } from './pages';

interface Me {
  fullName: string;
  customer: string;
  company: string;
}
type Phase = 'boot' | 'login' | 'change' | 'app';

const logout = () => {
  clearPToken();
  window.location.reload();
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 0, refetchOnWindowFocus: false, staleTime: 30_000 } },
  queryCache: new QueryCache({
    onError: (e) => {
      if (e instanceof PortalError && e.code === 'NEEDCODE') logout();
    },
  }),
});

function Frame({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center', padding: 16, background: '#f5f7fb' }}>
      <Card style={{ width: 'min(100%, 400px)' }}>
        <Typography.Title level={4} style={{ marginTop: 0 }}>پنل مشتری</Typography.Title>
        {children}
      </Card>
    </div>
  );
}

function LoginView({ onDone }: { onDone: (mustChange: boolean) => void }) {
  const [capOn, setCapOn] = useState(true);
  const [cap, setCap] = useState<{ tok: string; svg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const loadCap = useCallback(async () => {
    try {
      setCap(await pcall<{ tok: string; svg: string }>('captcha', {}, false));
    } catch (e) {
      setErr(perr(e));
    }
  }, []);
  useEffect(() => {
    void (async () => {
      try {
        const s = await pcall<{ captcha?: boolean }>('authStatus', {}, false);
        setCapOn(s.captcha !== false);
        if (s.captcha !== false) await loadCap();
      } catch {
        await loadCap();
      }
    })();
  }, [loadCap]);

  const submit = async (v: { username: string; password: string; capAns?: string; remember?: boolean }) => {
    setBusy(true);
    setErr('');
    try {
      const r = await pcall<{ token: string; remember?: boolean; me: { mustChange?: boolean } }>(
        'login',
        { username: v.username, password: v.password, remember: !!v.remember, capTok: cap?.tok ?? '', capAns: capOn ? v.capAns ?? '' : '', portal: true },
        false,
      );
      setPToken(r.token, !!r.remember);
      onDone(!!r.me.mustChange);
    } catch (e) {
      setErr(perr(e));
      if (capOn) await loadCap();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame>
      <Form layout="vertical" onFinish={(v) => void submit(v)} requiredMark={false}>
        <Form.Item name="username" label="نام کاربری" rules={[{ required: true, message: 'نام کاربری را وارد کنید' }]}>
          <Input autoFocus autoComplete="username" style={{ direction: 'ltr' }} />
        </Form.Item>
        <Form.Item name="password" label="رمز عبور" rules={[{ required: true, message: 'رمز عبور را وارد کنید' }]}>
          <Input.Password autoComplete="current-password" style={{ direction: 'ltr' }} />
        </Form.Item>
        {capOn ? (
          <Form.Item label="کد امنیتی" required>
            <Space align="start">
              <Form.Item name="capAns" noStyle rules={[{ required: true, message: 'کد را وارد کنید' }]}>
                <Input inputMode="numeric" style={{ width: 120, direction: 'ltr' }} />
              </Form.Item>
              {cap ? <img alt="کد امنیتی" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(cap.svg)}`} style={{ height: 36, cursor: 'pointer' }} title="برای کد تازه کلیک کنید" onClick={() => void loadCap()} /> : <Spin size="small" />}
            </Space>
          </Form.Item>
        ) : null}
        <Form.Item name="remember" valuePropName="checked">
          <Checkbox>مرا به خاطر بسپار</Checkbox>
        </Form.Item>
        {err ? <Alert type="error" showIcon message={err} style={{ marginBottom: 12 }} /> : null}
        <Button type="primary" htmlType="submit" block loading={busy}>
          ورود
        </Button>
      </Form>
      <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
        نام کاربری و رمز را شرکت به شما می‌دهد. این صفحه فقط برای مشاهدهٔ حساب شما نزد شرکت است.
      </Typography.Paragraph>
    </Frame>
  );
}

function ChangeView({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (v: { old: string; n1: string }) => {
    setBusy(true);
    setErr('');
    try {
      const r = await pcall<{ token: string; remember?: boolean }>('changeMyPassword', { old: v.old, password: v.n1 });
      setPToken(r.token, !!r.remember);
      onDone();
    } catch (e) {
      setErr(perr(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame>
      <Typography.Paragraph>برای ادامه، رمز عبور تازه‌ای انتخاب کنید.</Typography.Paragraph>
      <Form layout="vertical" onFinish={(v) => void submit(v)} requiredMark={false}>
        <Form.Item name="old" label="رمز فعلی" rules={[{ required: true, message: 'رمز فعلی را وارد کنید' }]}>
          <Input.Password style={{ direction: 'ltr' }} autoComplete="current-password" />
        </Form.Item>
        <Form.Item name="n1" label="رمز جدید" rules={[{ required: true, message: 'رمز جدید را وارد کنید' }]}>
          <Input.Password style={{ direction: 'ltr' }} autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="n2"
          label="تکرار رمز جدید"
          dependencies={['n1']}
          rules={[{ required: true, message: 'تکرار رمز را وارد کنید' }, ({ getFieldValue }) => ({ validator: (_, x) => (!x || getFieldValue('n1') === x ? Promise.resolve() : Promise.reject(new Error('تکرار رمز با رمز جدید یکی نیست'))) })]}
        >
          <Input.Password style={{ direction: 'ltr' }} autoComplete="new-password" />
        </Form.Item>
        {err ? <Alert type="error" showIcon message={err} style={{ marginBottom: 12 }} /> : null}
        <Space>
          <Button type="primary" htmlType="submit" loading={busy}>
            ذخیره رمز
          </Button>
          {onCancel ? <Button onClick={onCancel}>انصراف</Button> : <Button onClick={logout}>خروج</Button>}
        </Space>
      </Form>
    </Frame>
  );
}

const TABS = [
  { key: 'ov', label: 'نمای کلی' },
  { key: 'inv', label: 'فاکتورها' },
  { key: 'st', label: 'صورت‌حساب' },
  { key: 'ch', label: 'چک‌ها' },
];

function Shell({ me, onChangePw }: { me: Me; onChangePw: () => void }) {
  const [tab, setTab] = useState('ov');
  return (
    <Layout style={{ minHeight: '100%' }}>
      <Layout.Header className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0 16px', borderBottom: '1px solid #eee', flexWrap: 'wrap', height: 'auto', lineHeight: 'normal', paddingBlock: 8 }}>
        <div>
          <Typography.Text strong>پنل مشتری</Typography.Text>
          <div style={{ fontSize: 12, color: '#888' }}>حساب شما نزد «{me.company}»</div>
        </div>
        <Menu mode="horizontal" selectedKeys={[tab]} items={TABS} onClick={(e) => setTab(e.key)} style={{ flex: 1, minWidth: 260, borderBottom: 'none' }} />
        <Space>
          <Typography.Text>{me.customer}</Typography.Text>
          <Button size="small" onClick={onChangePw}>تغییر رمز</Button>
          <Button size="small" onClick={logout}>خروج</Button>
        </Space>
      </Layout.Header>
      <Layout.Content style={{ padding: 16, maxWidth: 1200, width: '100%', margin: '0 auto' }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {tab === 'ov' ? <Overview go={setTab} /> : null}
          {tab === 'inv' ? <Invoices /> : null}
          {tab === 'st' ? <Statement customer={me.customer} company={me.company} /> : null}
          {tab === 'ch' ? <Cheques /> : null}
        </Space>
      </Layout.Content>
    </Layout>
  );
}

export default function PortalApp() {
  const [phase, setPhase] = useState<Phase>('boot');
  const [me, setMe] = useState<Me | null>(null);
  const [changing, setChanging] = useState(false);

  const boot = useCallback(async () => {
    if (!getPToken()) return setPhase('login');
    try {
      setMe(await pcall<Me>('portalMe'));
      setPhase('app');
    } catch (e) {
      if (e instanceof PortalError && e.code === 'MUSTCHANGE') return setPhase('change');
      clearPToken();
      setPhase('login');
    }
  }, []);
  useEffect(() => {
    void boot();
  }, [boot]);

  return (
    <ConfigProvider direction="rtl" locale={faIR} theme={appTheme}>
      <AntApp style={{ minHeight: '100%' }}>
        <QueryClientProvider client={queryClient}>
          {phase === 'boot' ? <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}><Spin /></div> : null}
          {phase === 'login' ? <LoginView onDone={(m) => (m ? setPhase('change') : void boot())} /> : null}
          {phase === 'change' ? <ChangeView onDone={() => void boot()} /> : null}
          {phase === 'app' && me ? (changing ? <ChangeView onDone={() => setChanging(false)} onCancel={() => setChanging(false)} /> : <Shell me={me} onChangePw={() => setChanging(true)} />) : null}
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}
